import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  attributeSignup,
  payReferralReward,
  readSourceCookie,
} from "@/lib/signup-attribution";
import { isFreshSignup, postAuthDestination } from "@/lib/first-run";

/**
 * THE OAUTH DOOR, where Google puts people down.
 *
 * Nothing is drawn here, so there is no markup in this file. What it decides
 * is which page of the binder opens first, which makes it the earliest design
 * decision every Google account on the site ever meets.
 *
 * The job itself is small: trade the `code` query param for a session, then
 * redirect. The destination is built as an absolute URL off the request
 * origin, so local, preview and production all behave the same way.
 *
 * ATTRIBUTION. This route is the only thing that runs on a Google signup. The
 * email path's server action never executes. Until 2026-08-10 it recorded
 * nothing at all, so Google signups landed with a NULL `source` (59 to 61% of
 * every signup on the site) and no `referred_by` whatsoever. It now writes the
 * same attribution the email path writes, through the same shared module, and
 * it pays the referral reward here because Google has already proved the
 * address is real. The email path has to wait for /auth/confirm to get that
 * same guarantee.
 *
 * FIRST RUN. A brand-new account whose destination is the GENERIC dashboard is
 * sent to /start instead: one question, then a five-lesson plan. 45% of
 * accounts never finish a single lesson, and that loss happens entirely
 * upstream of the content, so the fix belongs at the door and not in the
 * lessons. `isNew` is the same created_at test that gates attribution below,
 * which keeps one definition of "new account" in this route rather than two
 * that can drift apart.
 *
 * WHAT IS DELIBERATELY LEFT ALONE. An explicit `next` is handed back verbatim:
 * an invite link, a lesson someone was part-way through while signed out, a
 * tool page. Only the literal string "/dashboard" is ever swapped out. `ref`
 * and `via` are read straight off this URL for attribution, and the
 * destination choice never touches either of them. Referrals through this file
 * were silently dead for 24 days once already, so the invite path is a hard
 * constraint here, not a preference.
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

  // Set only once a brand-new account is confirmed, and read once at the very
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

    // Only a fresh account gets attributed. Someone signing back in has to
    // keep the source they first arrived with. attributeSignup also refuses to
    // overwrite a source that is already set, so this is belt and braces.
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
        // pay now. Waiting on a confirmation click would wait forever: this
        // flow never produces one.
        if (referredBy) await payReferralReward(user.id);
      } catch (e) {
        // Never block a sign-in on analytics. Log it loudly though, because a
        // silent failure right here is exactly how the last gap went unnoticed
        // for three weeks.
        console.error("auth/callback attribution failed:", e);
      }
    }
  }

  return NextResponse.redirect(
    new URL(postAuthDestination(next, isNew), origin)
  );
}
