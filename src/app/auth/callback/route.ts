import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  attributeSignup,
  payReferralReward,
  readSourceCookie,
} from "@/lib/signup-attribution";

/** A user created within this window is treated as a brand-new signup. */
const NEW_USER_WINDOW_MS = 5 * 60 * 1000;

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
    const createdAt = user?.created_at ? Date.parse(user.created_at) : NaN;
    const isNew =
      Number.isFinite(createdAt) && Date.now() - createdAt < NEW_USER_WINDOW_MS;

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

  return NextResponse.redirect(new URL(next, origin));
}
