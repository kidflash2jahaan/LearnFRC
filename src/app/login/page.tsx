import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, GitBranch, Gauge, Trophy } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { TerminalFrame, StatusPill, TypeLine } from "@/components/motion/terminal";
import { AuthForm } from "@/components/auth/auth-form";
import { getSession } from "@/lib/auth";

export const metadata = {
  title: "Log in",
  description: "Welcome back. Sign in to pick up where you left off.",
  robots: { index: false, follow: true },
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
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid opacity-40 mask-b-faded" />
        <div className="absolute left-1/2 top-[-12%] h-[440px] w-[720px] -translate-x-1/2 rounded-full opacity-25 blur-3xl aurora-bg animate-aurora" />
        {/* code-bracket accents */}
        <span className="absolute left-[6%] top-[16%] hidden select-none font-mono text-[8rem] leading-none text-primary/[0.06] lg:block">
          {"{"}
        </span>
        <span className="absolute bottom-[10%] right-[6%] hidden select-none font-mono text-[8rem] leading-none text-primary/[0.06] lg:block">
          {"}"}
        </span>
      </div>

      <div className="mx-auto flex min-h-[100svh] w-full max-w-md flex-col justify-center px-4 py-24 sm:px-6">
        {/* Wordmark */}
        <Reveal>
          <Link
            href="/"
            className="mx-auto inline-flex items-center gap-2.5"
            aria-label="LearnFRC home"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary glow-primary">
              <Bot className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              Learn<span className="text-primary">FRC</span>
            </span>
          </Link>
        </Reveal>

        {/* Terminal login card */}
        <Reveal delay={0.08} className="mt-8">
          <TerminalFrame
            title="auth — ~/login"
            glow
            bodyClassName="p-6 sm:p-8"
            right={<StatusPill tone="accent">secure</StatusPill>}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
              // welcome back
            </p>
            <h1 className="mt-3 font-display text-2xl font-bold tracking-tight">
              Sign in to <span className="text-gradient">LearnFRC</span>
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Pick up exactly where you left off.
            </p>

            <TypeLine
              prompt="~/learnfrc $"
              text="auth login --resume"
              className="mt-5 block text-xs text-muted-foreground"
            />

            <div className="mt-5">
              <AuthForm mode="login" next={safeNext} />
            </div>
          </TerminalFrame>
        </Reveal>

        {/* Value props as terminal output */}
        <Reveal delay={0.16} className="mt-6">
          <div className="panel rounded-xl p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              // what&apos;s waiting for you
            </p>
            <Stagger className="mt-3 space-y-2.5" stagger={0.07}>
              {VALUE_PROPS.map((p) => (
                <StaggerItem key={p.title}>
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                      <p.icon className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-sm leading-relaxed">
                      <span className="font-medium text-foreground">
                        {p.title}.
                      </span>{" "}
                      <span className="text-muted-foreground">{p.body}</span>
                    </p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </Reveal>

        <Reveal delay={0.24} className="mt-5">
          <p className="text-center font-mono text-xs text-muted-foreground">
            100% free · No experience needed · Built for every seat on the team.
          </p>
        </Reveal>
      </div>
    </main>
  );
}
