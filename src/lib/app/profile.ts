import "server-only";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import type { SupabaseClient } from "@supabase/supabase-js";
import { firstProfaneField } from "@/lib/profanity";
import {
  chosenUsernameError,
  needsUsernameStep,
  normalizeUsername,
} from "@/lib/usernames";
import { usernameHasContact } from "@/lib/classes/contact-patterns";
import type { Profile } from "@/lib/types";
import { levelForXp, tierFor } from "@/lib/app/levels";
import { toIso } from "@/lib/app/format";
import { readAppleRevocation, revokeAppleTokens } from "@/lib/app/apple-sign-in";
import { beforeAccountDeleted } from "@/lib/app/classes";
import type { AccountDeletionReason } from "@/lib/classes/types";
import { fail, type AppClients, type AppUser, type Result } from "@/lib/app/result";

/**
 * Profile rules, shared by the website's Server Actions
 * (src/app/actions/profile.ts) and the app's /api/app/profile,
 * /api/app/profile/setup, /api/app/email-opt-in and /api/app/account routes.
 *
 * Every `profiles` read and write here is service-role and scoped to the id
 * auth.getUser() verified: no API role can SELECT `profiles` any more, and
 * Postgres needs SELECT on `id` for an UPDATE's WHERE.
 */

const ROLES = ["student", "mentor", "alum", "coach", "other"];

// The rule itself lives in src/lib/usernames.ts (client-safe); re-exported
// here because the sign-in lookup and older imports read it from this file.
export { normalizeUsername };

/* ------------------------------------------------------------------ */
/*  A username someone chooses for their own account                   */
/* ------------------------------------------------------------------ */

/**
 * The one server check for a username a person submits: sign-up
 * (registerAccount), Settings (updateProfileFields) and the username step
 * (saveProfileSetupFields). Normalizes it, then the shape rules
 * (chosenUsernameError: blank, 3 to 20 characters, not reserved, and for a
 * new name no contact details, since everyone in a live class sees it), the
 * profanity filter, and whether someone else has it.
 *
 * Keeping the name you already have always passes the shape rules, so the few
 * older names over 20 characters, or on today's reserved list, can still save
 * their other Settings fields. `changed` says whether it differs from
 * `currentUsername`.
 */
export async function validateChosenUsername(
  admin: SupabaseClient,
  raw: string,
  opts: { currentUsername: string | null; userId?: string }
): Promise<Result<{ username: string; changed: boolean }>> {
  const username = normalizeUsername(raw.trim());
  const shape = chosenUsernameError(username, opts.currentUsername, usernameHasContact);
  if (shape) return fail("validation", shape);
  if (firstProfaneField({ username }))
    return fail("validation", "That username isn't allowed. Please choose another.");

  const changed = username !== opts.currentUsername;
  if (changed) {
    // Exact match on one handle, `id` only: a taken/not-taken answer, not a
    // listing.
    let q = admin.from("profiles").select("id").eq("username", username);
    if (opts.userId) q = q.neq("id", opts.userId);
    const { data: taken } = await q.maybeSingle();
    if (taken) return fail("conflict", "That username is already taken.");
  }
  return { ok: true, username, changed };
}

/* ------------------------------------------------------------------ */
/*  The signed-in user's own profile, as /api/app/me sends it          */
/* ------------------------------------------------------------------ */

export type MeProfile = {
  id: string;
  /** Always set since 2026-11-11 (the database fills one in). */
  username: string | null;
  /**
   * The username was generated, not chosen. True until the person keeps it or
   * picks their own (the username step; `needsUsernameSetup` on /me).
   */
  usernameGenerated: boolean;
  /** The caller's OWN name. Never sent for anyone else. */
  fullName: string | null;
  avatarUrl: string | null;
  teamNumber: number | null;
  bio: string | null;
  role: string;
  xp: number;
  level: number;
  tier: string;
  createdAt: string;
  emailOptIn: boolean;
  emailChoiceAt: string | null;
};

export function toMeProfile(p: Profile): MeProfile {
  const xp = p.xp ?? 0;
  const level = levelForXp(xp);
  return {
    id: p.id,
    username: p.username,
    usernameGenerated: p.username_generated === true,
    fullName: p.full_name,
    avatarUrl: p.avatar_url,
    teamNumber: p.team_number,
    bio: p.bio,
    role: p.role || "student",
    xp,
    level,
    tier: tierFor(level),
    createdAt: toIso(p.created_at) ?? p.created_at,
    emailOptIn: p.email_opt_in === true,
    emailChoiceAt: toIso(p.email_choice_at),
  };
}

/**
 * Ask about reminder emails until the member has answered once (signup box,
 * Settings, the prompt, or an unsubscribe link). Not while they're still on
 * the username step, which has the screen to itself.
 */
export function shouldAskAboutEmail(profile: Profile | null): boolean {
  return !!profile && !profile.email_choice_at && !needsUsernameStep(profile);
}

/* ------------------------------------------------------------------ */
/*  Settings: edit profile                                             */
/* ------------------------------------------------------------------ */

/**
 * Every settings field as raw text, the way the website's form submits it.
 * Blank means "none" for every field except role, which defaults to student.
 */
export type ProfileFields = {
  fullName: string;
  bio: string;
  avatarUrl: string;
  username: string;
  teamNumber: string;
  role: string;
};

export async function updateProfileFields(
  user: AppUser,
  { admin }: AppClients,
  fields: ProfileFields
): Promise<Result> {
  // Every other write in this codebase is rate limited; this one was the
  // exception. Keyed on the user id (not just the IP) so one account can't
  // spray edits from a rotating address.
  if (!(await rateLimit("update-profile", 20, 3600, user.id)))
    return fail("rate_limited", "Too many profile updates. Try again in a bit.", 3600);

  const full_name = fields.fullName.trim() || null;
  const bio = fields.bio.trim() || null;
  const avatar_url = fields.avatarUrl.trim() || null;
  if (avatar_url && !/^https?:\/\//i.test(avatar_url))
    return fail("validation", "Avatar URL must start with http:// or https://");
  const teamStr = fields.teamNumber.trim();
  const roleRaw = fields.role || "student";

  let team_number: number | null = null;
  if (teamStr) {
    team_number = parseInt(teamStr, 10);
    if (Number.isNaN(team_number) || team_number < 1 || team_number > 99999)
      return fail("validation", "Enter a valid FRC team number.");
  }

  // `team_number` is self-declared and it is the key to the team roster, so an
  // unthrottled edit here is a team-hopping primitive: set it, load the
  // roster, set it again. Three CHANGES per day is generous for a real
  // correction and useless for walking the team list.
  //
  // Deliberately gated on an actual change: comparing against the stored value
  // means someone fixing a typo in their bio never burns the budget, and it
  // costs one indexed primary-key read.
  //
  // rateLimit() FAILS OPEN on infrastructure error (see src/lib/rate-limit.ts),
  // which is the right trade here: this is anti-abuse friction on a legitimate
  // settings field, not an authorization boundary.
  const { data: currentRow } = await admin
    .from("profiles")
    .select("team_number, username")
    .eq("id", user.id)
    .maybeSingle();
  const current = currentRow as { team_number: number | null; username: string | null } | null;
  const priorTeam = current?.team_number ?? null;
  if (
    team_number !== priorTeam &&
    !(await rateLimit("profile-team-number", 3, 86400, user.id))
  )
    return fail(
      "rate_limited",
      "You've changed your team number a few times today. Try again tomorrow.",
      86400
    );

  // A username can't be cleared: blank is refused here (and the database
  // keeps the old one if anything else ever tries).
  const checked = await validateChosenUsername(admin, fields.username, {
    currentUsername: current?.username ?? null,
    userId: user.id,
  });
  if (!checked.ok) return checked;
  const username = checked.username;

  const role = ROLES.includes(roleRaw) ? roleRaw : "student";

  // Block offensive name / bio on edit (local, no AI). The username was
  // checked above.
  const badField = firstProfaneField({
    full_name: full_name ?? "",
    bio: bio ?? "",
  });
  if (badField)
    return fail(
      "validation",
      badField === "full_name"
        ? "That name isn't allowed. Please use a different one."
        : "Please remove the inappropriate language from your bio."
    );

  // A new name is the person's own, so it's no longer a generated one.
  const { error } = await admin
    .from("profiles")
    .update({
      full_name,
      bio,
      username,
      team_number,
      role,
      avatar_url,
      ...(checked.changed ? { username_generated: false } : {}),
    })
    .eq("id", user.id);
  if (error) {
    // Unique-index race: someone took the username between the check and here.
    if (error.code === "23505") return fail("conflict", "That username is already taken.");
    console.error("updateProfileFields:", error.message);
    return fail("server", "Couldn't save that. Try again.");
  }

  revalidatePath("/settings");
  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/*  The username step, and the dashboard's team-number card            */
/* ------------------------------------------------------------------ */

/**
 * The username step (/account/username, and the app's UsernameSetupView) and
 * the dashboard's team-number card.
 *
 * For an account whose username was generated (`needsUsernameStep`), the
 * username is required: submitting the same handle keeps it (`keep`, or the
 * app sending it back unchanged), a different one replaces it, and either way
 * the flag clears. Validation is the same as sign-up and Settings
 * (validateChosenUsername).
 *
 * For an account whose username is its own, `username` is ignored, so this is
 * not a back door around Settings for renames; only the team number saves.
 * Keeping (or sending the current name) once the step is already done answers
 * ok with nothing written.
 */
export async function saveProfileSetupFields(
  user: AppUser,
  { admin }: AppClients,
  fields: { username: string; teamNumber: string; keep?: boolean }
): Promise<Result> {
  const { data: current } = await admin
    .from("profiles")
    .select("username, username_generated, team_number")
    .eq("id", user.id)
    .maybeSingle();

  const currentUsername: string | null = current?.username ?? null;
  const currentTeam: number | null = current?.team_number ?? null;
  const wantsUsername = needsUsernameStep(current);

  const teamStr = fields.teamNumber.trim();
  let team_number: number | null = null;
  if (teamStr) {
    team_number = parseInt(teamStr, 10);
    if (Number.isNaN(team_number) || team_number < 1 || team_number > 99999)
      return fail("validation", "Enter a valid FRC team number.");
  }

  const payload: { username?: string; username_generated?: boolean; team_number?: number } =
    {};

  if (wantsUsername) {
    const checked = await validateChosenUsername(
      admin,
      fields.keep ? (currentUsername ?? "") : fields.username,
      { currentUsername, userId: user.id }
    );
    if (!checked.ok) return checked;
    // Keeping the handle writes only the flag; a new one writes both.
    if (checked.changed) payload.username = checked.username;
    payload.username_generated = false;
  }

  if (team_number !== null && team_number !== currentTeam) {
    // Same budget as Settings (updateProfileFields): the team number is the key
    // to a roster, so this door mustn't be a way to walk the team list either.
    if (!(await rateLimit("profile-team-number", 3, 86400, user.id)))
      return fail(
        "rate_limited",
        "You've changed your team number a few times today. Try again tomorrow.",
        86400
      );
    payload.team_number = team_number;
  }

  if (Object.keys(payload).length === 0) {
    // The username step is already done (Keep pressed in another tab, or on the
    // website while the app still shows its cached gate): keeping again, or
    // sending the same name back, has nothing left to do, so the step moves on.
    const sameName =
      currentUsername !== null && normalizeUsername(fields.username.trim()) === currentUsername;
    if (!wantsUsername && (fields.keep || sameName)) return { ok: true };
    // Nothing to write: a team-only ask left blank. Say so rather than
    // reporting a silent success that leaves the same card sitting there.
    return fail("validation", "Enter your team number, or choose Skip for now.");
  }

  // Guard the username write against a race: only touch the exact handle we
  // decided was still generated (or the missing one). The `.eq("id", user.id)`
  // is the only thing scoping this service-role write to the caller; never
  // widen it.
  let q = admin.from("profiles").update(payload).eq("id", user.id);
  if (wantsUsername)
    q = currentUsername === null
      ? q.is("username", null)
      : q.eq("username", currentUsername).eq("username_generated", true);

  const { data: updated, error } = await q.select("id").maybeSingle();
  if (error) {
    // Unique-index race (someone grabbed it between check and write).
    if (error.code === "23505") return fail("conflict", "That username is already taken.");
    console.error("saveProfileSetupFields:", error.message);
    return fail("server", "Couldn't save that. Try again.");
  }
  if (!updated)
    return fail("conflict", "Your profile changed in another tab. Reload and retry.");

  revalidatePath("/", "layout");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/*  Reminder emails                                                    */
/* ------------------------------------------------------------------ */

/**
 * Turn learning-reminder emails on or off. Reminders are opt-in (owner,
 * 2026-10-12): accounts start with email_opt_in false, and the box at signup,
 * the Settings switch, or the one-time prompt is the only way to turn them on.
 * Essential account mail (verification, password reset) isn't affected.
 *
 * Every call records email_choice_at, which is what stops the prompt from
 * asking again and what the reminder sender requires before mailing anyone.
 */
export async function setEmailChoice(
  user: AppUser,
  { admin }: AppClients,
  optIn: unknown
): Promise<Result<{ optIn: boolean; emailChoiceAt: string }>> {
  if (typeof optIn !== "boolean") return fail("validation", "Something went wrong. Try again.");
  if (!(await rateLimit("email-opt-in", 30, 3600, user.id)))
    return fail("rate_limited", "Too many changes. Try again in a bit.", 3600);

  const emailChoiceAt = new Date().toISOString();
  const { error } = await admin
    .from("profiles")
    .update({ email_opt_in: optIn, email_choice_at: emailChoiceAt })
    .eq("id", user.id);
  if (error) return fail("server", "Couldn't save that. Try again.");
  revalidatePath("/settings");
  return { ok: true, optIn, emailChoiceAt };
}

/* ------------------------------------------------------------------ */
/*  Account deletion                                                   */
/* ------------------------------------------------------------------ */

/**
 * Permanently delete the user's own account and all their data. The child
 * rows also cascade from auth.users, but deleting them explicitly first keeps
 * this correct even if a foreign key ever changes.
 *
 * An account that signed in with Apple has its Apple tokens revoked, as Apple
 * requires (src/lib/app/apple-sign-in.ts). The tokens are read first, while
 * the auth user and its kept tokens still exist, and revoked after the
 * response, once the account is gone, so a slow Apple never holds up (or times
 * out) the deletion. Nothing is revoked if the deletion fails.
 *
 * Live classes come first (beforeAccountDeleted in src/lib/app/classes.ts):
 * evidence holds when the account is banned or the subject of an open safety
 * case, cancelling the person's upcoming classes as a teacher, deleting their
 * RealtimeKit participants, and stamping their consent records, which outlive
 * the account. `opts.reason` says why the account is going: the person's own
 * choice (the default), a ban from the report desk, or an under-13 answer on
 * the classes age screen. It never throws.
 */
export async function deleteAccountData(
  user: AppUser,
  { admin }: AppClients,
  opts: { reason?: AccountDeletionReason } = {}
): Promise<Result> {
  const uid = user.id;
  await beforeAccountDeleted(uid, opts.reason ?? "self");
  const apple = await readAppleRevocation(uid);
  await admin.from("lesson_progress").delete().eq("user_id", uid);
  await admin.from("bookmarks").delete().eq("user_id", uid);
  await admin.from("user_achievements").delete().eq("user_id", uid);
  await admin.from("profiles").delete().eq("id", uid);
  const { error } = await admin.auth.admin.deleteUser(uid);
  if (error) {
    console.error("deleteAccountData:", error.message);
    return fail("server", "Couldn't delete the account. Try again.");
  }
  if (apple) after(() => revokeAppleTokens(apple));
  return { ok: true };
}
