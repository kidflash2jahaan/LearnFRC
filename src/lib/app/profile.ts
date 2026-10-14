import "server-only";
import { revalidatePath } from "next/cache";
import { rateLimit } from "@/lib/rate-limit";
import { firstProfaneField } from "@/lib/profanity";
import { isPlaceholderUsername } from "@/lib/onboarding";
import { needsUsernameSetup } from "@/lib/onboarding-server";
import type { Profile } from "@/lib/types";
import { levelForXp, tierFor } from "@/lib/app/levels";
import { toIso } from "@/lib/app/format";
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

/** Username rule shared by signup, settings and setup: a–z, 0–9 and _ only. */
export function normalizeUsername(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

/* ------------------------------------------------------------------ */
/*  The signed-in user's own profile, as /api/app/me sends it          */
/* ------------------------------------------------------------------ */

export type MeProfile = {
  id: string;
  username: string | null;
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
  return !!profile && !profile.email_choice_at && !needsUsernameSetup(profile);
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
  const usernameRaw = fields.username.trim();
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
  const { data: currentTeam } = await admin
    .from("profiles")
    .select("team_number")
    .eq("id", user.id)
    .maybeSingle();
  const priorTeam =
    (currentTeam as { team_number: number | null } | null)?.team_number ?? null;
  if (
    team_number !== priorTeam &&
    !(await rateLimit("profile-team-number", 3, 86400, user.id))
  )
    return fail(
      "rate_limited",
      "You've changed your team number a few times today. Try again tomorrow.",
      86400
    );

  let username: string | null = null;
  if (usernameRaw) {
    username = normalizeUsername(usernameRaw);
    if (username.length < 3)
      return fail("validation", "Username must be at least 3 characters (a–z, 0–9, _).");
    // Exact match on one handle, `id` only: a taken/not-taken answer, not a
    // listing.
    const { data: taken } = await admin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .neq("id", user.id)
      .maybeSingle();
    if (taken) return fail("conflict", "That username is already taken.");
  }

  const role = ROLES.includes(roleRaw) ? roleRaw : "student";

  // Block offensive username / name / bio on edit (local, no AI).
  const badField = firstProfaneField({
    username: username ?? "",
    full_name: full_name ?? "",
    bio: bio ?? "",
  });
  if (badField)
    return fail(
      "validation",
      badField === "username"
        ? "That username isn't allowed. Please choose another."
        : badField === "full_name"
          ? "That name isn't allowed. Please use a different one."
          : "Please remove the inappropriate language from your bio."
    );

  const { error } = await admin
    .from("profiles")
    .update({ full_name, bio, username, team_number, role, avatar_url })
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
/*  The username step (accounts that never saw the signup form)        */
/* ------------------------------------------------------------------ */

/**
 * Finish the profile of an account that never saw the signup form (Google
 * sign-in, and later Sign in with Apple).
 *
 * Writes the username only when the account has none or is still carrying a
 * machine-minted placeholder; a handle the user actually chose is left alone,
 * so this is not a back door around Settings for renames. Validation is
 * identical to signup.
 */
export async function saveProfileSetupFields(
  user: AppUser,
  { admin }: AppClients,
  fields: { username: string; teamNumber: string }
): Promise<Result> {
  const { data: current } = await admin
    .from("profiles")
    .select("username, team_number")
    .eq("id", user.id)
    .maybeSingle();

  const currentUsername: string | null = current?.username ?? null;
  const currentTeam: number | null = current?.team_number ?? null;
  const wantsUsername = !currentUsername || isPlaceholderUsername(currentUsername);

  const teamStr = fields.teamNumber.trim();
  let team_number: number | null = null;
  if (teamStr) {
    team_number = parseInt(teamStr, 10);
    if (Number.isNaN(team_number) || team_number < 1 || team_number > 99999)
      return fail("validation", "Enter a valid FRC team number.");
  }

  const payload: { username?: string; team_number?: number } = {};

  if (wantsUsername) {
    const username = normalizeUsername(fields.username.trim());
    if (username.length < 3)
      return fail("validation", "Username must be at least 3 characters (a–z, 0–9, _).");
    if (firstProfaneField({ username }))
      return fail("validation", "That username isn't allowed. Please choose another.");

    if (username !== currentUsername) {
      const { data: taken } = await admin
        .from("profiles")
        .select("id")
        .eq("username", username)
        .neq("id", user.id)
        .maybeSingle();
      if (taken) return fail("conflict", "That username is already taken.");
      payload.username = username;
    }
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

  // Nothing to write: either a team-only ask left blank, or a placeholder
  // handle resubmitted unchanged. Say so rather than reporting a silent
  // success that leaves the same card sitting there.
  if (Object.keys(payload).length === 0)
    return fail(
      "validation",
      wantsUsername
        ? "Nothing to save. Choose a different username, add your team number, or Skip for now."
        : "Enter your team number, or choose Skip for now."
    );

  // Guard the username write against a race: only overwrite the exact value we
  // decided was fair game (null, or the placeholder we just read). The
  // `.eq("id", user.id)` is the only thing scoping this service-role write to
  // the caller; never widen it.
  let q = admin.from("profiles").update(payload).eq("id", user.id);
  if (payload.username !== undefined)
    q = currentUsername === null
      ? q.is("username", null)
      : q.eq("username", currentUsername);

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
 */
export async function deleteAccountData(
  user: AppUser,
  { admin }: AppClients
): Promise<Result> {
  const uid = user.id;
  await admin.from("lesson_progress").delete().eq("user_id", uid);
  await admin.from("bookmarks").delete().eq("user_id", uid);
  await admin.from("user_achievements").delete().eq("user_id", uid);
  await admin.from("profiles").delete().eq("id", uid);
  const { error } = await admin.auth.admin.deleteUser(uid);
  if (error) {
    console.error("deleteAccountData:", error.message);
    return fail("server", "Couldn't delete the account. Try again.");
  }
  return { ok: true };
}
