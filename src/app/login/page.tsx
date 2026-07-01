import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, GitBranch, Gauge, Trophy, ShieldCheck } from "lucide-react";
import { AuthForm } from "@/components/auth/auth-form";
import { getSession } from "@/lib/auth";

export const metadata = {
  title: "Log in",
  description: "Welcome back. Sign in to pick up where you left off.",
  robots: { index: false, follow: true },
};

const HEADING_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const VALUE_PROPS = [
  {
    icon: GitBranch,
    title: "Your progress, saved",
    body: "Resume any lesson exactly where you left off across all 11 departments.",
  },
  {
    icon: Gauge,
    title: "Track your mastery",
    body: "Watch your XP climb and see how far you've come at a glance.",
  },
  {
    icon: Trophy,
    title: "Badges & leaderboard",
    body: "Keep your streak going and hold your spot among learners everywhere.",
  },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const { user } = await getSession();
  if (user) redirect("/dashboard");

  const safeNext = next && next.startsWith("/") ? next : undefined;

  return (
    <main className="relative min-h-[100svh] overflow-hidden">
      {/* Ambient glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[-8%] top-[-6%] h-[460px] w-[460px] rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute right-[-10%] top-[24%] h-[420px] w-[420px] rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute bottom-[-12%] left-[38%] h-[380px] w-[380px] rounded-full bg-violet-400/15 blur-3xl" />
      </div>

      <div className="mx-auto grid min-h-[100svh] w-full max-w-6xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        {/* Left: welcome + what you get */}
        <div className="order-2 lg:order-1">
          <Link
            href="/"
            className="aq-rise aq-rise-1 inline-flex items-center gap-2.5"
            aria-label="LearnFRC home"
          >
            <span className="aq-badge grid h-9 w-9 place-items-center" style={{ "--a": "#2560e6" } as CSSProperties}>
              <Bot className="h-5 w-5 text-foreground" />
            </span>
            <span className="aq-display text-lg font-bold tracking-tight text-foreground">
              Learn<span className="text-primary">FRC</span>
            </span>
          </Link>

          <p className="aq-eyebrow aq-rise aq-rise-1 mt-8">Welcome back to the pit</p>
          <h1 className="aq-rise aq-rise-2 mt-3 max-w-xl text-4xl font-bold tracking-tight sm:text-5xl">
            Pick up right where{" "}
            <span style={HEADING_GRADIENT}>you left off</span>
          </h1>
          <p className="aq-rise aq-rise-3 mt-4 max-w-lg text-lg leading-relaxed text-foreground/70">
            Sign in to keep building. Your lessons, XP, and streak are waiting —
            every seat on the team, from drivetrain to scouting.
          </p>

          <ul className="aq-rise aq-rise-4 mt-10 grid gap-4 sm:grid-cols-2">
            {VALUE_PROPS.map((p) => (
              <li
                key={p.title}
                className="aq-card aq-card-hover aq-reveal flex items-start gap-3.5 p-5"
              >
                <span className="aq-icon grid h-10 w-10 shrink-0 place-items-center">
                  <p.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">{p.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {p.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <p className="aq-reveal mt-8 text-sm text-muted-foreground">
            100% free · No experience needed · Built for every seat on the team.
          </p>
        </div>

        {/* Right: welcoming glass auth card */}
        <div className="order-1 lg:order-2">
          <div className="aq-glass aq-rise aq-rise-2 relative mx-auto w-full max-w-md rounded-3xl p-6 sm:p-8">
            <span className="aq-chip inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Secure sign in
            </span>

            <h2 className="aq-display mt-5 text-2xl font-bold tracking-tight text-foreground">
              Sign in to <span style={HEADING_GRADIENT}>LearnFRC</span>
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Enter your details to jump back into build season.
            </p>

            <hr className="aq-divider my-6" />

            <AuthForm mode="login" next={safeNext} />
          </div>
        </div>
      </div>
    </main>
  );
}
