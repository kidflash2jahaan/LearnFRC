import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { payReferralReward } from "@/lib/signup-attribution";
import { sendEmail, welcomeEmailHtml } from "@/lib/email";
import {
  CONFIRMED_SIGNUP_WINDOW_MS,
  isFreshSignup,
  postAuthDestination,
} from "@/lib/first-run";

/**
 * THE CONFIRMATION LINK, the one clicked out of an inbox.
 *
 * Email confirmation by token hash, which works across devices and browsers
 * because it needs no PKCE verifier cookie. Someone signs up on the shop
 * laptop and clicks the link on their phone, and it still lands. The
 * confirmation email points here.
 *
 * FIRST RUN. A just-confirmed signup whose destination is the GENERIC
 * dashboard lands on /start instead. That is the same swap /auth/callback
 * makes, through the same shared helper, so the two doors cannot drift apart.
 *
 * Two conditions have to hold. `type === "signup"` would keep every other
 * token type out, so that a password recovery still reaches /account/password
 * and an email change is never mistaken for a new account. `isFreshSignup` is
 * the same created_at rule the OAuth path uses, on the longer window: the
 * account is created the moment the form is submitted, but this link gets
 * clicked whenever the inbox is next read, and a five-minute window would miss
 * most of them.
 *
 * `next` is honoured verbatim whenever it names a real destination, whether
 * that is a team invite, a lesson or /account/password. Only the literal
 * "/dashboard" is ever swapped.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next");
  const next =
    nextParam &&
    nextParam.startsWith("/") &&
    !nextParam.startsWith("//") &&
    !nextParam.startsWith("/\\")
      ? nextParam
      : "/dashboard";

  if (token_hash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      // DO NOT GATE ANY OF THIS ON `type === "signup"`.
      // The live Supabase confirmation template links here as
      //   /auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard
      // verified 2026-08-10 against the project's own
      // mailer_templates_confirmation_content. It sends type=email and it has
      // NEVER sent type=signup, so every branch that required "signup" was
      // dead for the roughly 87% of accounts created by email: the welcome
      // email never sent, /start was unreachable, and the +25 XP referral
      // reward never paid. 12 profiles carry referred_by and 0 have
      // referral_rewarded set, so not one referral has ever paid out.
      //
      // The fix is to stop asking the token what kind of event this is and ask
      // the ACCOUNT instead. Freshness is decided by created_at, and the
      // reward is decided by payReferralReward, which is already idempotent:
      // it no-ops unless referred_by is set and referral_rewarded is false. So
      // calling it on any successful confirmation is both safe and correct,
      // and an email-change confirmation on an old account simply pays nothing.
      const isNew = isFreshSignup(
        data.user?.created_at,
        CONFIRMED_SIGNUP_WINDOW_MS
      );

      // The welcome email goes out on a genuinely new account only. An
      // email-change confirmation must not re-welcome somebody who joined
      // weeks ago.
      const email = data.user?.email;
      const name = (data.user?.user_metadata?.full_name as string) || null;
      if (email && isNew) {
        void sendEmail({
          to: email,
          subject: "Welcome to LearnFRC 🤖",
          html: welcomeEmailHtml(name),
        });
      }

      // Pay the referral reward now that the inbox is proven real. That
      // confirmation is the whole thing keeping this farm-resistant. Shared
      // with the OAuth path at /auth/callback so the two cannot drift, and
      // src/lib/signup-attribution.ts says why that matters.
      if (data.user) {
        await payReferralReward(data.user.id);
      }

      return NextResponse.redirect(
        new URL(postAuthDestination(next, isNew), origin)
      );
    }
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, origin)
    );
  }

  return NextResponse.redirect(
    new URL("/login?error=Invalid+or+expired+link", origin)
  );
}
