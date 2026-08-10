import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { payReferralReward } from "@/lib/signup-attribution";
import { sendEmail, welcomeEmailHtml } from "@/lib/email";

/**
 * Email confirmation via token hash (works across devices/browsers — no PKCE
 * verifier cookie required). The confirmation email links here.
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
      // Best-effort welcome email on first confirmation
      const email = data.user?.email;
      const name = (data.user?.user_metadata?.full_name as string) || null;
      if (email && type === "signup") {
        void sendEmail({
          to: email,
          subject: "Welcome to LearnFRC 🤖",
          html: welcomeEmailHtml(name),
        });
      }

      // Pay out the referral reward exactly once, now that this user is
      // verified (farm-resistant — requires a real, confirmed inbox).
      // Shared with the OAuth path (/auth/callback) so the two can't drift —
      // see src/lib/signup-attribution.ts for why that matters.
      if (type === "signup" && data.user) {
        await payReferralReward(data.user.id);
      }

      return NextResponse.redirect(new URL(next, origin));
    }
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, origin)
    );
  }

  return NextResponse.redirect(
    new URL("/login?error=Invalid+or+expired+link", origin)
  );
}
