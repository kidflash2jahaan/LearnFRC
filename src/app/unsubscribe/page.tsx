import type { CSSProperties } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Unsubscribe · LearnFRC",
  robots: { index: false, follow: false },
};

const GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

/**
 * One-click unsubscribe from lifecycle email (CAN-SPAM). Token-gated, no login.
 * Idempotent: sets email_opt_in=false for the matching profile. `resub=1`
 * re-enables it, so an accidental click is reversible.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; resub?: string }>;
}) {
  const { token, resub } = await searchParams;
  const optIn = resub === "1";
  let ok = false;

  if (token && /^[0-9a-f-]{36}$/i.test(token)) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .update({ email_opt_in: optIn })
      .eq("unsubscribe_token", token)
      .select("id")
      .maybeSingle();
    ok = !!data;
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-28 text-center">
      <div className="ac-glass w-full rounded-2xl p-8">
        {ok ? (
          <>
            <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-primary" aria-hidden />
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {optIn ? (
                <>You&apos;re <span style={GRADIENT}>resubscribed</span></>
              ) : (
                <>You&apos;re <span style={GRADIENT}>unsubscribed</span></>
              )}
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-foreground/70">
              {optIn
                ? "You'll get learning reminders again. You can change this anytime in your settings."
                : "You won't receive any more learning-reminder emails. Your account and progress are untouched."}
            </p>
            {!optIn && token && (
              <Link
                href={`/unsubscribe?token=${token}&resub=1`}
                className="ac-btn-ghost mt-6 inline-flex text-sm"
              >
                Changed your mind? Resubscribe
              </Link>
            )}
            <div className="mt-6">
              <Link href="/" className="text-sm font-semibold text-primary hover:underline">
                Back to LearnFRC
              </Link>
            </div>
          </>
        ) : (
          <>
            <XCircle className="mx-auto mb-4 h-10 w-10 text-muted-foreground" aria-hidden />
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Link not recognized
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-foreground/70">
              This unsubscribe link is invalid or expired. You can manage email
              preferences from your account settings.
            </p>
            <Link href="/settings" className="ac-btn mt-6 inline-flex text-sm">
              Go to settings
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
