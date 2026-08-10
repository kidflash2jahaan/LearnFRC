/**
 * The shape of a team-space invite link, in one place.
 *
 * Imported by the consent page, the pre-auth hand-off route and the lead's
 * invite panel, so the URL can never drift between the thing that MINTS the
 * link and the thing that READS it. Plain module: no server-only imports, no
 * secrets, safe in a Client Component.
 *
 * WHY THE TOKEN IS A QUERY PARAM AND NOT A PATH SEGMENT
 * -----------------------------------------------------
 * `/join/space?t=<token>` rather than `/join/space/<token>`, deliberately.
 * Both beacons this app runs report the PATHNAME and drop the query:
 * PageViewBeacon sends `usePathname()` to /api/page-view (persisted forever in
 * `page_views.path`), and @vercel/analytics sends the same pathname to a third
 * party. A path segment would write a live invite credential into both on every
 * single visit. As a query param the token stays out of analytics entirely and
 * `/join/space` aggregates as one clean row.
 */

/** Where an invite link points. Already covered by robots.ts (`/join`). */
export const INVITE_PATH = "/join/space";

/** Query param carrying the token. */
export const INVITE_PARAM = "t";

/**
 * Belt-and-braces carrier for the signed-out round trip.
 *
 * The token also rides in `?next=`, which is the primary path and the only one
 * that survives confirming your email in a different browser. The cookie is the
 * backup for the failure mode this codebase has already lived through once: on
 * 2026-07-23 the Google button shipped without forwarding its params and every
 * referral silently vanished for 24 days. A signed-out invite now has to
 * survive Supabase, Google and a redirect chain that re-encodes a nested query
 * string; if any hop mangles it the cookie still brings the invite back.
 *
 * Scoped to INVITE_PATH so it is only ever sent to the one page that reads it.
 */
export const INVITE_COOKIE = "lf_invite";

/** Matches the invite TTL in team-space.ts — a stale cookie is never useful. */
export const INVITE_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

/** `?via=` surface for signups that started from an invite link. */
export const INVITE_VIA = "team-invite";

/**
 * Reduce an untrusted token to the exact charset `randomBytes().toString(
 * "base64url")` produces, or "" if it could not have come from us. Length is
 * bounded well under team-space.ts's own 128-char guard.
 */
export function normaliseInviteToken(raw: string | null | undefined): string {
  const v = String(raw ?? "").trim();
  return /^[A-Za-z0-9_-]{16,128}$/.test(v) ? v : "";
}

/** Site-relative invite link. */
export function invitePath(token: string): string {
  return `${INVITE_PATH}?${INVITE_PARAM}=${encodeURIComponent(token)}`;
}

/**
 * Absolute invite link — what the lead copies, and what the QR encodes.
 * `origin` should be NEXT_PUBLIC_SITE_URL; it falls back to production so a
 * missing env var can never produce a link pointing at "undefined".
 */
export function inviteUrl(token: string, origin?: string | null): string {
  const base = (origin || "https://learnfrc.com").replace(/\/+$/, "");
  return `${base}${invitePath(token)}`;
}
