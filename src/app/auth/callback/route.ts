import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  attributeSignup,
  payReferralReward,
  readSourceCookie,
} from "@/lib/signup-attribution";
import { isFreshSignup, postAuthDestination } from "@/lib/first-run";

/**
 * OAuth / email-confirmation callback.
 * Exchanges the `code` query param for a session, then redirects to `next`
 * (or /dashboard). Built as an absolute URL from the request origin so it
 * works across local, preview, and production.
 *
 * ATTRIBUTION: this route is the ONLY thing that runs on a Google signup — the
 * email path's server action never executes. Until 2026-08-10 it recorded
 * nothing, so Google signups landed with a NULL `source` (59-61% of all
 * signups) and no `referred_by` at all. It now writes the same attribution the
 * email path does, via the shared module, and pays the referral reward here
 * because Google has already verified the address (the email path waits for
 * /auth/confirm to get that same guarantee).
 *
 * FIRST RUN: a brand-new account whose destination is the GENERIC dashboard is
 * sent to /start instead — one question, then a five-lesson plan, because 45%
 * of accounts never finish a lesson and the loss is entirely upstream of the
 * content. `isNew` is the same created_at test that already gates attribution
 * below, so there is one definition of "new account" in this route, not two.
 *
 * WHAT IS DELIBERATELY NOT TOUCHED: an explicit `next` — a team invite
 * (`/join/space?t=…`), a lesson a signed-out reader was on, a tool page — is
 * returned verbatim, because only the literal string "/dashboard" is ever
 * swapped. `ref` and `via` are read straight off this URL for attribution and
 * are unaffected by the destination choice. Referrals through this file were
 * silently dead for 24 days once already; the invite path is a hard constraint
 * here, not a nice-to-have.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next =
    nextParam &&
    nextParam.startsWith("/") &&
    !nextParam.startsWith("//") &&
    !nextParam.startsWith("/\\")
      ? nextParam
      : "/dashboard";

  // Set only on a confirmed brand-new account, and read once at the very
  // bottom to choose between /start and the resolved destination.
  let isNew = false;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, origin)
      );
    }

    // Only a fresh account gets attributed; a returning user signing in again
    // must keep the source they arrived with. attributeSignup additionally
    // refuses to overwrite a non-empty source, so this is belt-and-braces.
    const user = data?.user;
    isNew = isFreshSignup(user?.created_at);

    if (user && isNew) {
      const hdrs = request.headers;
      const signupIp =
        (hdrs.get("x-forwarded-for") || "").split(",")[0].trim() ||
        hdrs.get("x-real-ip") ||
        null;
      try {
        const { referredBy } = await attributeSignup({
          userId: user.id,
          ref: searchParams.get("ref"),
          via: searchParams.get("via"),
          srcCookie: readSourceCookie(hdrs.get("cookie")),
          signupIp,
        });
        // Google has already verified the address, so the reward is safe to
        // pay now rather than waiting for a confirmation click that this flow
        // never produces.
        if (referredBy) await payReferralReward(user.id);
      } catch (e) {
        // Never block sign-in on analytics. Log loudly — a silent failure here
        // is precisely how the previous gap went unnoticed for three weeks.
        console.error("auth/callback attribution failed:", e);
      }
    }
  }

  return NextResponse.redirect(
    new URL(postAuthDestination(next, isNew), origin)
  );
}
