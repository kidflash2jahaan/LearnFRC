"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createTeamSpace,
  createSpaceInvite,
  revokeSpaceInvite,
  removeSpaceMember,
  leaveSpace,
  deleteTeamSpace,
  getMyTeamSpace,
  type TeamSpaceError,
} from "@/lib/team-space";

/**
 * TEAM MODE — the write surface for creating and running a team space.
 *
 * Everything dangerous already lives in src/lib/team-space.ts, which re-derives
 * authorisation from auth.getUser() + a membership row on every single call.
 * This file exists only to turn those results into fixed, server-authored copy
 * a form can render. The rules it adds on top:
 *
 *  1. NO SPACE ID EVER CROSSES THE WIRE. Every management action below resolves
 *     the caller's own space with getMyTeamSpace() instead of accepting an id
 *     from the client. The DB enforces one active membership per user
 *     platform-wide, so there is exactly one answer and nothing to guess. A
 *     forged id is not "rejected" — there is no parameter to forge.
 *  2. NOTHING READS AUTHORITY FROM FORMDATA. No role, no ownership flag, no
 *     "isLead". The only values taken from a client are a team number (parsed
 *     to an integer and range-checked), a program from a 3-item allow-list, an
 *     opaque memberKey (32 hex chars, resolved and scoped inside team-space.ts)
 *     and two booleans.
 *  3. EVERY STRING RETURNED TO THE BROWSER IS WRITTEN HERE. Errors arrive as a
 *     closed union of codes and are mapped through COPY below, so no database
 *     message, no other user's data and no caller input is ever echoed back.
 *     The one interpolation — the team number in the "taken" message — is an
 *     integer this function itself parsed and bounds-checked.
 *  4. NO FREE TEXT. There is no rename, no description, no invite note and no
 *     removal reason, because there is no field anywhere in this feature that
 *     carries typed text from one user to another. See renameSpaceAction's
 *     absence, and the note on it in the manage UI.
 */

/** Programs the DB CHECK constraint accepts. */
const PROGRAMS = ["frc", "ftc", "fll"] as const;

/**
 * Fixed copy for every error the library can return. Deliberately vague about
 * WHY something was not found: `not_found` covers "no such space", "you are not
 * a member" and "you are not the lead" alike, and must never be split into
 * messages that would confirm which one it was.
 */
const COPY: Record<TeamSpaceError, string> = {
  unauthenticated: "You've been signed out. Sign in again and retry.",
  not_found:
    "That's not available right now. Reload the page and try again.",
  rate_limited:
    "We couldn't complete that — either you've hit today's limit, or a safety check didn't come back. Try again later.",
  taken: "That team already has a space.",
  already_in_space:
    "You're already in a team space. Leave that one first — you can only be in one at a time.",
  already_member: "You're already in this space.",
  invalid_team_number: "Enter a team number between 1 and 99999.",
  invalid_invite: "That invite link is no longer valid.",
  blocked:
    "You've blocked this space, so you can't rejoin it from a link. Undo that first if you've changed your mind.",
  not_eligible:
    "Finish one lesson before starting a space. It takes a couple of minutes — it's just there to stop throwaway accounts creating spaces in bulk.",
  server_error: "Something went wrong on our end. Try again in a moment.",
};

function say(error: TeamSpaceError): string {
  return COPY[error] ?? COPY.server_error;
}

/**
 * The caller's own space, only if they lead it. Returns the id for the library
 * call and nothing else — the id itself never reaches a browser.
 */
async function myLeadSpaceId(): Promise<string | null> {
  const space = await getMyTeamSpace();
  return space && space.myRole === "lead" ? space.id : null;
}

/* ------------------------------------------------------------------ */
/*  Create / claim                                                     */
/* ------------------------------------------------------------------ */

/**
 * Claim the space for a program + team number. First claimer wins.
 *
 * `taken` is NOT an error state in the UI sense — it is the normal, expected
 * outcome for the second person on a team, and it is answered with "ask your
 * team for the link", never with an ownership-transfer flow or a hint about who
 * holds it. `takenNumber` is returned so the form can swap to that panel.
 */
export async function createSpaceAction(
  _prev: { error?: string; takenNumber?: number } | undefined,
  formData: FormData
): Promise<{ error?: string; takenNumber?: number } | undefined> {
  const raw = String(formData.get("team_number") || "").trim();
  const programRaw = String(formData.get("program") || "frc")
    .trim()
    .toLowerCase();
  const program = (PROGRAMS as readonly string[]).includes(programRaw)
    ? programRaw
    : "frc";

  const teamNumber = Number.parseInt(raw, 10);
  if (
    !raw ||
    !Number.isInteger(teamNumber) ||
    teamNumber < 1 ||
    teamNumber > 99999
  )
    return { error: COPY.invalid_team_number };

  const res = await createTeamSpace({ teamNumber, program });

  if (!res.ok) {
    if (res.error === "taken")
      return {
        // The number is an integer this function parsed and range-checked, so
        // this interpolation cannot carry anything a user typed.
        error: `Team ${teamNumber} already has a space on LearnFRC. Ask someone who's already in it for the invite link — anyone in the space can share it. We don't show who set it up.`,
        takenNumber: teamNumber,
      };
    return { error: say(res.error) };
  }

  revalidatePath("/teams/space");
  revalidatePath("/teams");
  redirect("/teams/space");
}

/* ------------------------------------------------------------------ */
/*  Invite link                                                        */
/* ------------------------------------------------------------------ */

/**
 * Mint the space's link, replacing whatever was live before. Rotation IS
 * revocation here — the DB allows at most one un-revoked invite per space, so
 * pressing this kills the old URL the instant the new one exists.
 */
export async function createInviteAction(): Promise<{ error: string | null }> {
  const spaceId = await myLeadSpaceId();
  if (!spaceId) return { error: COPY.not_found };
  const res = await createSpaceInvite(spaceId);
  if (!res.ok) return { error: say(res.error) };
  revalidatePath("/teams/space");
  return { error: null };
}

/** Turn the link off without minting a replacement. */
export async function revokeInviteAction(): Promise<{ error: string | null }> {
  const spaceId = await myLeadSpaceId();
  if (!spaceId) return { error: COPY.not_found };
  const res = await revokeSpaceInvite(spaceId);
  if (!res.ok) return { error: say(res.error) };
  revalidatePath("/teams/space");
  return { error: null };
}

/* ------------------------------------------------------------------ */
/*  Membership                                                         */
/* ------------------------------------------------------------------ */

/**
 * Lead removes a member. One DELETE against one membership row — no write to
 * profiles, lesson_progress, user_achievements or xp exists anywhere on this
 * path, so "removal damages nothing" is a property of the code rather than a
 * promise in the copy.
 *
 * `memberKey` is the opaque per-space HMAC; the shape check here is hygiene
 * (it keeps junk out of the constant-time comparison), and the real scoping is
 * done inside removeSpaceMember, which only ever matches keys belonging to
 * non-lead members of this exact space.
 */
export async function removeMemberAction(
  memberKey: string
): Promise<{ error: string | null }> {
  const spaceId = await myLeadSpaceId();
  if (!spaceId) return { error: COPY.not_found };

  const key = String(memberKey || "").trim();
  if (!/^[a-f0-9]{32}$/.test(key)) return { error: COPY.not_found };

  const res = await removeSpaceMember(spaceId, key);
  if (!res.ok) return { error: say(res.error) };
  revalidatePath("/teams/space");
  return { error: null };
}

/**
 * A member's own exit. No lead approval, no notice period. Optionally blocks
 * the space permanently, which survives leaving and cannot be undone by the
 * lead — that veto is what makes remove-and-reinvite churn unworkable.
 *
 * A LEAD CANNOT LEAVE. Leadership is immutable in Postgres (there is no
 * promote, no co-lead and no transfer in v1), so a lead walking out would leave
 * a space full of minors with nobody accountable for it. They delete it
 * instead. The UI must say this in words, not just disable a button.
 */
export async function leaveSpaceAction(
  block?: boolean
): Promise<{ error: string } | undefined> {
  const space = await getMyTeamSpace();
  if (!space) return { error: COPY.not_found };
  if (space.myRole === "lead")
    return {
      error:
        "You run this space, so you can't leave it — that would leave everyone in it with nobody responsible. Delete the space instead; nobody loses any progress.",
    };

  const res = await leaveSpace(space.id, { block: block === true });
  if (!res.ok) return { error: say(res.error) };

  revalidatePath("/teams/space");
  revalidatePath("/teams");
  redirect("/teams");
}

/**
 * The lead's only exit. Cascades to members, invites, plan items and events —
 * and touches nothing that belongs to a member's account, so everyone keeps
 * every lesson, every badge and every point of XP.
 *
 * Requires the team number to be typed back. That is not theatre: server
 * actions are reachable by direct POST, and this is the one call in the feature
 * that cannot be undone.
 */
export async function deleteSpaceAction(
  confirmTeamNumber: number
): Promise<{ error: string } | undefined> {
  const space = await getMyTeamSpace();
  if (!space || space.myRole !== "lead") return { error: COPY.not_found };
  if (Number(confirmTeamNumber) !== space.teamNumber)
    return { error: "Type your team number exactly as shown to confirm." };

  const res = await deleteTeamSpace(space.id);
  if (!res.ok) return { error: say(res.error) };

  revalidatePath("/teams/space");
  revalidatePath("/teams");
  redirect("/teams");
}
