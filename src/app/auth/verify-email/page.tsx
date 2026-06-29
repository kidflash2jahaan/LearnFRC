import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { TerminalFrame, StatusPill, TypeLine } from "@/components/motion/terminal";
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
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-grid mask-radial-faded opacity-40"
      />

      <Reveal className="w-full max-w-md">
        <TerminalFrame
          title="auth — ~/verify"
          glow
          bodyClassName="p-7 text-center sm:p-8"
          right={<StatusPill tone="accent">pending</StatusPill>}
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary glow-primary">
            <MailCheck className="h-8 w-8" />
          </div>

          <h1 className="mt-6 font-display text-2xl font-bold tracking-tight">
            Verify your <span className="text-gradient">email</span>
          </h1>
          <p className="mt-2 text-pretty text-muted-foreground">
            We sent a verification link to{" "}
            {email ? (
              <span className="font-mono font-medium text-foreground">
                {email}
              </span>
            ) : (
              "your inbox"
            )}
            . Click it to activate your account, then sign in.
          </p>

          <TypeLine
            prompt="~/learnfrc $"
            text="auth verify --await-link"
            className="mt-5 block text-xs text-muted-foreground"
          />

          <p className="mt-4 text-sm text-muted-foreground">
            Can&apos;t find it? Check your spam folder, or resend the link.
          </p>

          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            {email && <ResendButton email={email} />}
            <Button asChild variant="brand">
              <Link href="/login">Go to sign in</Link>
            </Button>
          </div>

          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Back home
          </Link>
        </TerminalFrame>
      </Reveal>
    </div>
  );
}
