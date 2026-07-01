import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, BookOpenCheck, Sparkles, Trophy, Rocket } from "lucide-react";
import { AuthForm } from "@/components/auth/auth-form";
import { getSession } from "@/lib/auth";

export const metadata = {
  title: "Sign up",
  description:
    "Create your free LearnFRC account and start mastering FIRST Robotics.",
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
    icon: BookOpenCheck,
    title: "A complete FRC curriculum",
    body: "11 departments of structured, web-grounded lessons — from swerve and WPILib to the Impact Award.",
  },
  {
    icon: Sparkles,
    title: "Free forever",
    body: "No paywalls, no credit card. Just sign up and start learning today.",
  },
  {
    icon: Trophy,
    title: "Earn XP & badges",
    body: "Track progress, unlock achievements, and climb the global leaderboard.",
  },
];

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; ref?: string }>;
}) {
  const { next, ref } = await searchParams;
  const { user } = await getSession();
  if (user) redirect("/dashboard");

  const safeNext = next && next.startsWith("/") ? next : undefined;
  const refValue =
    (ref || "").toLowerCase().replace(/[^a-z0-9_]/g, "") || undefined;

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
            <span
              className="aq-badge grid h-9 w-9 place-items-center"
              style={{ "--a": "#2560e6" } as CSSProperties}
            >
              <Bot className="h-5 w-5 text-foreground" />
            </span>
            <span className="aq-display text-lg font-bold tracking-tight text-foreground">
              Learn<span className="text-primary">FRC</span>
            </span>
          </Link>

          <p className="aq-eyebrow aq-rise aq-rise-1 mt-8">
            New to the pit? Start here
          </p>
          <h1 className="aq-rise aq-rise-2 mt-3 max-w-xl text-4xl font-bold tracking-tight sm:text-5xl">
            Go from rookie to{" "}
            <span style={HEADING_GRADIENT}>robot-ready</span>
          </h1>
          <p className="aq-rise aq-rise-3 mt-4 max-w-lg text-lg leading-relaxed text-foreground/70">
            Create your free account and learn every seat on the team — from
            drivetrain and code to scouting and the Impact Award. It&apos;s free,
            forever.
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
            Trusted sources · Real part numbers &amp; code · Built for every seat
            on the team.
          </p>
        </div>

        {/* Right: welcoming glass auth card */}
        <div className="order-1 lg:order-2">
          <div className="aq-glass aq-rise aq-rise-2 relative mx-auto w-full max-w-md rounded-3xl p-6 sm:p-8">
            <span className="aq-chip inline-flex items-center gap-1.5">
              <Rocket className="h-3.5 w-3.5 text-primary" />
              Free forever
            </span>

            <h2 className="aq-display mt-5 text-2xl font-bold tracking-tight text-foreground">
              Create your free{" "}
              <span style={HEADING_GRADIENT}>account</span>
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              A few details and you&apos;re into build season.
            </p>

            <hr className="aq-divider my-6" />

            <AuthForm mode="signup" next={safeNext} referrer={refValue} />
          </div>
        </div>
      </div>
    </main>
  );
}
