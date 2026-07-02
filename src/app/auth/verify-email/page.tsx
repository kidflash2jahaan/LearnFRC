import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, MousePointerClick, LogIn, Wrench } from "lucide-react";
import { ResendButton } from "@/components/auth/resend-button";
import { AnimatedCounter } from "@/components/animated-counter";
import { Rise, RiseGroup, RiseItem, Glow } from "@/components/motion/primitives";
import { SignalBeacon } from "./_signal-beacon";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false },
};

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const NEXT_STEPS = [
  {
    icon: MousePointerClick,
    title: "Open the email",
    body: "Tap the verification link inside. It activates your account instantly.",
  },
  {
    icon: LogIn,
    title: "Sign in",
    body: "Come back and log in — your progress dashboard is waiting.",
  },
  {
    icon: Wrench,
    title: "Enter the pit",
    body: "Pick a department and start your first guide, free.",
  },
];

const STATS = [
  { value: 11, suffix: "", label: "Departments" },
  { value: 394, suffix: "", label: "Lessons" },
  { value: 100, suffix: "%", label: "Free" },
];

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "560px", pos: { left: "-180px", top: "-200px" }, color: "#8bbcff", opacity: 0.6 },
          { size: "520px", pos: { right: "-160px", top: "-120px" }, color: "#6ff0ea", opacity: 0.5, delay: 2 },
          { size: "480px", pos: { left: "30%", bottom: "-220px" }, color: "#c8b6ff", opacity: 0.4, delay: 4 },
        ]}
      />

      <section className="mx-auto flex min-h-[100svh] max-w-xl flex-col items-center justify-center px-4 pb-16 pt-28 sm:px-6 sm:pb-20">
        <Rise className="flex justify-center">
          <span className="ac-chip inline-flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
            <span className="ac-eyebrow">One quick step</span>
          </span>
        </Rise>

        <Rise delay={0.08} className="mt-6 w-full">
          <div className="ac-glass relative w-full overflow-hidden p-6 sm:p-9">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(26,169,214,0.25),transparent_70%)] blur-2xl"
            />

            <SignalBeacon />

            <h1 className="mt-5 text-balance text-center font-display text-3xl font-extrabold leading-[1.05] sm:text-4xl">
              Your link is <span style={BRAND_GRADIENT}>on its way.</span>
            </h1>

            <p className="mx-auto mt-3 max-w-md text-pretty text-center text-base leading-relaxed text-foreground/70">
              We sent a verification link to{" "}
              {email ? (
                <span className="break-all font-semibold text-foreground">{email}</span>
              ) : (
                "your inbox"
              )}
              . Open it to activate your account — this takes about 30 seconds.
            </p>

            {/* progress rail: where you are in sign-up */}
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-primary" />
                  Almost in the pit
                </span>
                <span className="tabular-nums">Step 3 of 4</span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-white/60"
                role="progressbar"
                aria-valuenow={3}
                aria-valuemin={1}
                aria-valuemax={4}
                aria-label="Sign-up progress: step 3 of 4"
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: "75%", background: "linear-gradient(90deg,var(--primary),var(--accent))" }}
                />
              </div>
            </div>

            {/* what happens next: a 3-step rail */}
            <RiseGroup className="mt-6 space-y-2.5" stagger={0.07}>
              {NEXT_STEPS.map((step, i) => (
                <RiseItem key={step.title}>
                  <div className="ac-card flex items-start gap-3 p-3.5 text-left">
                    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
                      <span
                        className="ac-badge flex h-10 w-10 items-center justify-center"
                        style={{ "--a": "#2560e6" } as CSSProperties}
                      >
                        <step.icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span
                        className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white shadow-sm"
                        aria-hidden
                      >
                        {i + 1}
                      </span>
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{step.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                        {step.body}
                      </p>
                    </div>
                  </div>
                </RiseItem>
              ))}
            </RiseGroup>

            {/* reassurance: what awaits */}
            <div className="mt-6 grid grid-cols-3 gap-2.5">
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className="ac-tile rounded-2xl p-3 text-center"
                  style={{ "--a": "#2560e6" } as CSSProperties}
                >
                  <div className="font-display text-xl font-extrabold text-foreground">
                    <AnimatedCounter value={s.value} suffix={s.suffix} />
                  </div>
                  <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              Not seeing it? Check your spam folder, then resend below.
            </p>

            {/* actions */}
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/login" className="ac-btn min-h-11 text-sm">
                Go to sign in
              </Link>
              {email && <ResendButton email={email} />}
            </div>

            <div className="ac-divider mt-8" />

            <div className="mt-6 text-center">
              <Link
                href="/"
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:text-primary"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden /> Back home
              </Link>
            </div>
          </div>
        </Rise>
      </section>
    </div>
  );
}
