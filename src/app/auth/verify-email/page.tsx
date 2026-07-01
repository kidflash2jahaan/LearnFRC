import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck, ArrowLeft, Inbox, ShieldCheck } from "lucide-react";
import { ResendButton } from "@/components/auth/resend-button";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="relative flex min-h-[100svh] flex-col items-center justify-center px-4 py-24">
      {/* Ambient glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-24 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(37,96,230,0.18), transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 right-[8%] h-96 w-96 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(26,169,214,0.16), transparent 70%)" }}
        />
        <div
          className="absolute top-1/3 left-[6%] h-72 w-72 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(124,92,246,0.12), transparent 70%)" }}
        />
      </div>

      <div className="aq-glass aq-rise aq-rise-1 w-full max-w-md rounded-3xl p-8 text-center sm:p-10">
        <span className="aq-badge aq-rise aq-rise-1 mx-auto flex h-16 w-16 items-center justify-center" style={{ "--a": "#2560e6" } as CSSProperties}>
          <MailCheck className="h-8 w-8" aria-hidden />
        </span>

        <p className="aq-eyebrow aq-rise aq-rise-2 mt-6 justify-center">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          One quick step
        </p>

        <h1 className="aq-display aq-rise aq-rise-2 mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
          Verify your{" "}
          <span
            style={{
              background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            email
          </span>
        </h1>

        <p className="aq-rise aq-rise-3 mx-auto mt-3 max-w-sm text-pretty text-base leading-relaxed text-foreground/70">
          We sent a verification link to{" "}
          {email ? (
            <span className="font-mono font-semibold text-foreground">{email}</span>
          ) : (
            "your inbox"
          )}
          . Click it to activate your account, then head to the pit and sign in.
        </p>

        <div className="aq-rise aq-rise-3 mt-6 flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-4 text-left">
          <span className="aq-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <Inbox className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Can&apos;t find it? Check your spam folder, then resend the link below.
          </p>
        </div>

        <div className="aq-rise aq-rise-4 mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {email && <ResendButton email={email} />}
          <Link
            href="/login"
            className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
          >
            Go to sign in
          </Link>
        </div>

        <div className="aq-divider mt-8" />

        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back home
        </Link>
      </div>
    </div>
  );
}
