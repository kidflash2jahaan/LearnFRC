import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, MousePointerClick, LogIn, Wrench } from "lucide-react";
import { ResendButton } from "@/components/auth/resend-button";
import { AnimatedCounter } from "@/components/animated-counter";
import { DeliveryScene } from "./_delivery-scene";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false },
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

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div
      data-theme="arena"
      className="aq-root relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-x-clip px-4 py-20 text-foreground sm:py-24"
    >
      {/* ambient light the glass refracts */}
      <div className="aq-glow" aria-hidden>
        <span
          className="h-[620px] w-[620px] opacity-70"
          style={{ left: "-180px", top: "-200px", background: "radial-gradient(circle, #8bbcff, transparent 70%)" }}
        />
        <span
          className="h-[560px] w-[560px] opacity-60"
          style={{ right: "-160px", top: "-120px", background: "radial-gradient(circle, #6ff0ea, transparent 70%)" }}
        />
        <span
          className="h-[520px] w-[520px] opacity-50"
          style={{ left: "34%", bottom: "-220px", background: "radial-gradient(circle, #c8b6ff, transparent 70%)" }}
        />
      </div>

      <div className="aq-glass aq-sheen aq-float aq-rise aq-rise-1 w-full max-w-lg rounded-[28px] p-6 sm:p-9">
        {/* ── SIGNATURE: link-in-flight delivery scene ── */}
        <div className="aq-rise aq-rise-1">
          <DeliveryScene />
        </div>

        {/* ── headline block ── */}
        <div className="mt-2 text-center">
          <span className="aq-eyebrow aq-rise aq-rise-2 justify-center">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            One quick step
          </span>

          <h1 className="aq-display aq-rise aq-rise-2 mt-3 text-balance text-3xl font-extrabold leading-[1.05] sm:text-4xl">
            Your link is{" "}
            <span
              className="aq-grad-anim"
              style={{
                background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              on its way.
            </span>
          </h1>

          <p className="aq-rise aq-rise-3 mx-auto mt-3 max-w-md text-pretty text-base leading-relaxed text-foreground/70">
            We sent a verification link to{" "}
            {email ? (
              <span className="font-semibold text-foreground break-all">{email}</span>
            ) : (
              "your inbox"
            )}
            . Open it to activate your account — this takes about 30 seconds.
          </p>
        </div>

        {/* ── progress rail: where you are in sign-up ── */}
        <div className="aq-rise aq-rise-3 mt-6">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="aq-pulse inline-block h-2 w-2 rounded-full"
                style={{ background: "var(--primary)" } as CSSProperties}
              />
              Almost in the pit
            </span>
            <span className="tabular-nums">Step 3 of 4</span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-card"
            role="progressbar"
            aria-valuenow={3}
            aria-valuemin={1}
            aria-valuemax={4}
            aria-label="Sign-up progress: step 3 of 4"
          >
            <div
              className="aq-bar-anim h-full rounded-full"
              style={{ width: "75%", background: "linear-gradient(90deg,var(--primary),var(--accent))" } as CSSProperties}
            />
          </div>
        </div>

        {/* ── what happens next: a 3-step rail ── */}
        <ol className="mt-6 space-y-2.5">
          {NEXT_STEPS.map((step, i) => (
            <li
              key={step.title}
              className="aq-card aq-card-hover aq-reveal flex items-start gap-3 rounded-2xl p-3.5 text-left"
              style={{ animationDelay: `${i * 0.08}s` } as CSSProperties}
            >
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
                <span className="aq-icon aq-badge-bob flex h-10 w-10 items-center justify-center rounded-xl">
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
            </li>
          ))}
        </ol>

        {/* ── reassurance: what awaits + spam nudge ── */}
        <div
          className="aq-reveal mt-6 grid grid-cols-3 gap-2.5"
          style={{ animationDelay: "120ms" } as CSSProperties}
        >
          {[
            { value: 12, suffix: "+", label: "Departments" },
            { value: 80, suffix: "+", label: "Lessons" },
            { value: 100, suffix: "%", label: "Free" },
          ].map((s) => (
            <div
              key={s.label}
              className="aq-tile aq-card-hover rounded-2xl p-3 text-center"
              style={{ "--a": "var(--primary)" } as CSSProperties}
            >
              <div className="aq-display text-xl font-extrabold text-foreground">
                <AnimatedCounter value={s.value} suffix={s.suffix} />
              </div>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        <p
          className="aq-reveal mt-4 text-center text-sm text-muted-foreground"
          style={{ animationDelay: "180ms" } as CSSProperties}
        >
          Not seeing it? Check your spam folder, then resend below.
        </p>

        {/* ── actions ── */}
        <div className="aq-rise aq-rise-5 mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {email && <ResendButton email={email} />}
          <Link
            href="/login"
            className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
          >
            Go to sign in
          </Link>
        </div>

        <div className="aq-divider mt-8" />

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:text-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
