import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
      if (type === "signup" && data.user) {
        const admin = createAdminClient();
        const { data: prof } = await admin
          .from("profiles")
          .select("referred_by, referral_rewarded")
          .eq("id", data.user.id)
          .maybeSingle();
        if (prof?.referred_by && !prof.referral_rewarded) {
          const { data: refUser } = await admin
            .from("profiles")
            .select("id, xp")
            .eq("id", prof.referred_by)
            .maybeSingle();
          if (refUser) {
            await admin
              .from("profiles")
              .update({ xp: ((refUser.xp as number) ?? 0) + 25 })
              .eq("id", refUser.id);
          }
          await admin
            .from("profiles")
            .update({ referral_rewarded: true })
            .eq("id", data.user.id);
        }
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
