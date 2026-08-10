import { NextResponse } from "next/server";
import {
  INVITE_COOKIE,
  INVITE_COOKIE_MAX_AGE,
  INVITE_PATH,
  INVITE_VIA,
  invitePath,
  normaliseInviteToken,
} from "../invite-link";

export const dynamic = "force-dynamic";

/**
 * The signed-out hand-off: /join/space/continue?t=<token>&to=signup|login
 *
 * WHY THIS EXISTS AT ALL — a plain <Link> to /signup would have been shorter.
 * A signed-out invite has to survive: /signup → the auth form → Supabase →
 * Google or an emailed confirmation link → /auth/callback → back to the consent
 * screen. It rides in `?next=` the whole way, which is the mechanism the Google
 * button already uses for `ref` and `via`, and it is the only carrier that
 * survives confirming your email in a DIFFERENT browser from the one that
 * opened the link.
 *
 * But `next` now has to carry a nested, encoded query string of its own
 * (`next=%2Fjoin%2Fspace%3Ft%3D…`) through three redirect hops we don't own. So
 * this route also drops the token into a scoped, httpOnly cookie on the way
 * past. If any hop re-encodes `next` badly the visitor still lands on
 * /join/space, and the page falls back to the cookie and shows them their
 * invite anyway.
 *
 * Referrals on this site were silently broken for 24 days because the Google
 * path dropped its params. Two independent carriers is the cheap way to not
 * repeat that.
 *
 * Sets no state beyond the caller's own cookie and touches no database, so it
 * needs no rate limit of its own — the token it carries is validated (and
 * IP-rate-limited) on the consent screen and again at redeem.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const token = normaliseInviteToken(searchParams.get("t"));

  // Closed set — this can never be pointed at an arbitrary destination.
  const dest = searchParams.get("to") === "login" ? "/login" : "/signup";

  const url = new URL(dest, origin);
  url.searchParams.set("next", token ? invitePath(token) : INVITE_PATH);
  // Attribution for signups that started from a team invite. Allow-listed in
  // src/lib/signup-attribution.ts; the login path has nothing to attribute.
  if (dest === "/signup") url.searchParams.set("via", INVITE_VIA);

  const res = NextResponse.redirect(url);
  if (token) {
    res.cookies.set(INVITE_COOKIE, token, {
      // Scoped to the one page that reads it — never sent anywhere else.
      path: INVITE_PATH,
      httpOnly: true,
      // Lax, not Strict: the browser comes back from Google (and from a mail
      // client) as a top-level GET, and Strict would drop the cookie on exactly
      // the navigation it exists for.
      sameSite: "lax",
      secure: origin.startsWith("https://"),
      maxAge: INVITE_COOKIE_MAX_AGE,
    });
  }
  return res;
}
