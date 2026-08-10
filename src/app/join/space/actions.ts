"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  acceptInvite,
  createSpaceInvite,
  getSpaceInvite,
  revokeSpaceInvite,
  type TeamSpaceError,
} from "@/lib/team-space";
import { INVITE_COOKIE, INVITE_PATH, inviteUrl, normaliseInviteToken } from "./invite-link";

/**
 * Every server action behind the invite + consent flow.
 *
 * THE RULES THESE OBEY (they are the security-critical half of Team Mode):
 *  - Nothing here decides authority. `spaceId` and `token` arrive from the
 *    client, and every function in team-space.ts re-derives who the caller is
 *    from `auth.getUser()` plus a membership row before it touches a thing. No
 *    action reads a role, an owner id or an "isLead" flag out of FormData.
 *  - Joining is a POST from an explicit button press. Server Actions carry
 *    Next's origin check, so a link, an <img> or a cross-site form cannot
 *    trigger one — visiting an invite URL can never join you to anything.
 *  - Errors are rendered from this fixed table, never from a server message or
 *    anything the caller typed. "Doesn't exist", "expired", "revoked" and
 *    "used up" all collapse to one sentence, so probing tokens tells you
 *    nothing about which spaces are real.
 */

// ── fixed, server-authored copy ─────────────────────────────────────────────
const DEAD_LINK =
  "This invite link isn't valid any more. Ask your team for a fresh one.";

const JOIN_ERROR: Record<TeamSpaceError, string> = {
  unauthenticated: "Your session expired. Log in and open the invite link again.",
  // Uniform on purpose: an attacker must not be able to tell a real-but-expired
  // token from a token that never existed.
  not_found: DEAD_LINK,
  invalid_invite: DEAD_LINK,
  invalid_team_number: DEAD_LINK,
  taken: DEAD_LINK,
  // The one exception: this is the user's OWN earlier decision, so saying so is
  // honest rather than a leak.
  blocked: "You blocked this team space, so its invite links can't add you.",
  already_in_space:
    "You're already in a team space. You can only be in one at a time — leave that one from your team page, then open this link again.",
  already_member: "You're already in this space.",
  not_eligible: "Finish one lesson first, then you can join a team space.",
  rate_limited:
    "A lot of people have joined from this network in the last hour. Wait a few minutes and try again — your invite link still works.",
  server_error: "Something went wrong on our end. Try that again in a moment.",
};

const INVITE_ERROR: Record<TeamSpaceError, string> = {
  ...JOIN_ERROR,
  not_found: "We couldn't find that team space.",
  rate_limited:
    "You've made a lot of invite links today. Try again tomorrow — the link you already have keeps working.",
  server_error: "Couldn't update the invite link. Try again in a moment.",
};

// ── shared helpers ──────────────────────────────────────────────────────────
/**
 * Clear the signed-out carry-over cookie. Must repeat the path it was set with
 * — `delete()` defaults to "/" and would silently leave a scoped cookie behind.
 */
async function clearInviteCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(INVITE_COOKIE, "", { path: INVITE_PATH, maxAge: 0 });
}

// ── the consent moment ──────────────────────────────────────────────────────
export type JoinState = { error: string } | undefined;

/**
 * Join the space this token belongs to. Only ever reached from a button press
 * on the consent screen, which has already stated — in words — exactly what
 * the space will see and exactly what it will not.
 */
export async function joinTeamSpaceAction(
  _prev: JoinState,
  formData: FormData
): Promise<JoinState> {
  const token = normaliseInviteToken(String(formData.get("token") || ""));
  if (!token) return { error: DEAD_LINK };

  const res = await acceptInvite(token);
  if (!res.ok) return { error: JOIN_ERROR[res.error] };

  await clearInviteCookie();
  revalidatePath("/teams");
  redirect("/teams");
}

/** "No thanks" — drops the carried invite so it stops following them around. */
export async function declineInviteAction(): Promise<void> {
  await clearInviteCookie();
  redirect("/dashboard");
}

// ── the lead's link ─────────────────────────────────────────────────────────
/** What the panel renders. Carries the URL, never a bare token to reassemble. */
export type PanelInvite = {
  url: string;
  expiresAt: string;
  maxUses: number;
  uses: number;
};

export type InviteResult =
  | { ok: true; invite: PanelInvite | null }
  | { ok: false; error: string };

function toPanel(invite: {
  token: string;
  expiresAt: string;
  maxUses: number;
  uses: number;
}): PanelInvite {
  return {
    url: inviteUrl(invite.token, process.env.NEXT_PUBLIC_SITE_URL),
    expiresAt: invite.expiresAt,
    maxUses: invite.maxUses,
    uses: invite.uses,
  };
}

/**
 * The space's live link, if there is one. Lead-only — enforced inside
 * getSpaceInvite, which returns `not_found` (never "forbidden") to anyone else,
 * so this cannot be used to confirm a space exists.
 */
export async function loadSpaceInviteAction(spaceId: string): Promise<InviteResult> {
  const res = await getSpaceInvite(String(spaceId || ""));
  if (!res.ok) return { ok: false, error: INVITE_ERROR[res.error] };
  return { ok: true, invite: res.data ? toPanel(res.data) : null };
}

/**
 * Mint a link, replacing whatever was live before.
 *
 * ROTATION IS REVOCATION: the schema allows at most one un-revoked invite per
 * space, so pressing this kills the previous link instantly. That is the fix
 * for the leaked-link case — a code pasted into a public Discord dies the
 * moment the lead presses "New link", and a removed member cannot be walked
 * back in by an old URL.
 *
 * Rate limited inside createSpaceInvite: 10 per day per lead and 30 per day per
 * IP, through a FAIL-CLOSED wrapper around the same `check_rate_limit` RPC that
 * src/lib/rate-limit.ts uses. The shared `rateLimit()` helper deliberately fails
 * OPEN (right for finishing a lesson, wrong for minting a credential into a
 * space full of minors), which is why the stricter sibling is used here.
 */
export async function createSpaceInviteAction(spaceId: string): Promise<InviteResult> {
  const res = await createSpaceInvite(String(spaceId || ""));
  if (!res.ok) return { ok: false, error: INVITE_ERROR[res.error] };
  revalidatePath("/teams");
  return { ok: true, invite: toPanel(res.data) };
}

/** Turn the link off entirely, without minting a replacement. */
export async function revokeSpaceInviteAction(spaceId: string): Promise<InviteResult> {
  const res = await revokeSpaceInvite(String(spaceId || ""));
  if (!res.ok) return { ok: false, error: INVITE_ERROR[res.error] };
  revalidatePath("/teams");
  return { ok: true, invite: null };
}
