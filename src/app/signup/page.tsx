import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, Sparkles, Check, ArrowRight, LayoutGrid } from "lucide-react";
import { Icon } from "@/lib/icon-map";
import { deptMeta } from "@/lib/departments";
import { DEPT_CATALOG } from "@/lib/dept-catalog";
import { AuthForm } from "@/components/auth/auth-form";
import { AnimatedCounter } from "@/components/animated-counter";
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

/** What a free account unlocks — spoken in one glance. */
const PERKS = [
  "Free forever — no card, no paywalls",
  "394 lessons across all 11 departments",
  "Save progress, earn XP, climb the leaderboard",
];

const STATS = [
  { value: 11, suffix: "", label: "departments" },
  { value: 394, suffix: "+", label: "lessons" },
  { value: 100, suffix: "%", label: "free, forever" },
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
    <main className="relative min-h-[100svh] overflow-x-clip">
      {/* Ambient drifting glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="aq-float absolute left-[-8%] top-[-6%] h-[460px] w-[460px] rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute right-[-10%] top-[20%] h-[440px] w-[440px] rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute bottom-[-12%] left-[36%] h-[400px] w-[400px] rounded-full bg-primary/15 blur-3xl" />
      </div>

      <div className="mx-auto grid min-h-[100svh] w-full max-w-6xl items-center gap-10 px-4 py-12 sm:gap-12 sm:px-6 sm:py-16 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 lg:py-24">
        {/* ============ LEFT: the welcoming glass auth card ============ */}
        <div className="order-1">
          {/* Global navbar provides branding — no page-level logo. */}
          <div className="aq-glass aq-float aq-rise aq-rise-2 relative w-full max-w-md rounded-3xl p-6 sm:p-8">
            <span className="aq-chip inline-flex items-center gap-1.5">
              <span className="aq-pulse inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
              Free forever
            </span>

            <h1 className="aq-display mt-5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Create your free{" "}
              <span className="aq-grad-anim" style={HEADING_GRADIENT}>
                account
              </span>
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              A few details and you&apos;re into build season — every seat on the
              team, unlocked.
            </p>

            <hr className="aq-divider my-6" />

            <AuthForm mode="signup" next={safeNext} referrer={refValue} />
          </div>
        </div>

        {/* ===== RIGHT: signature — "your whole team, unlocked" ===== */}
        <div className="order-2">
          <p className="aq-eyebrow aq-rise aq-rise-1">
            New to the pit? Start here
          </p>
          <h2 className="aq-display aq-rise aq-rise-2 mt-3 max-w-xl text-3xl font-bold leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl">
            Go from rookie to{" "}
            <span className="aq-grad-anim" style={HEADING_GRADIENT}>
              robot-ready
            </span>
          </h2>
          <p className="aq-rise aq-rise-3 mt-4 max-w-lg text-lg leading-relaxed text-foreground/70">
            One account unlocks every department — drivetrain and code to
            scouting and the Impact Award. It&apos;s free, forever.
          </p>

          {/* Perks — what you get, at a glance */}
          <ul className="aq-rise aq-rise-4 mt-6 grid gap-2.5">
            {PERKS.map((perk, i) => (
              <li
                key={perk}
                className="aq-reveal flex items-center gap-2.5 text-[15px] text-foreground/80"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <span
                  className="aq-badge grid h-6 w-6 shrink-0 place-items-center"
                  style={{ "--a": "var(--primary)" } as CSSProperties}
                >
                  <Check className="h-3.5 w-3.5 text-foreground" aria-hidden />
                </span>
                {perk}
              </li>
            ))}
          </ul>

          {/* Count-up stats */}
          <dl className="aq-rise aq-rise-4 mt-8 flex flex-wrap gap-x-8 gap-y-4">
            {STATS.map((s) => (
              <div key={s.label} className="aq-reveal">
                <dt className="aq-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  <AnimatedCounter value={s.value} suffix={s.suffix} />
                </dt>
                <dd className="mt-0.5 text-sm text-muted-foreground">
                  {s.label}
                </dd>
              </div>
            ))}
          </dl>

          {/* SIGNATURE: department tile constellation you unlock */}
          <div className="aq-rise aq-rise-5 mt-9">
            <div className="mb-3 flex items-center justify-between">
              <span className="aq-eyebrow">What you unlock</span>
              <Link
                href="/guides"
                className="group inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
              >
                Preview guides
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {DEPT_CATALOG.map((d, i) => {
                const m = deptMeta(d.slug);
                return (
                  <div
                    key={d.slug}
                    className="aq-tile aq-reveal group flex flex-col items-center gap-2 rounded-2xl p-3 text-center"
                    style={
                      {
                        "--a": m.color,
                        animationDelay: `${(i % 4) * 70}ms`,
                      } as CSSProperties
                    }
                    title={d.name}
                  >
                    <span
                      className="aq-badge grid h-10 w-10 place-items-center rounded-[14px]"
                      style={{ "--a": m.color } as CSSProperties}
                    >
                      <Icon name={m.icon} className="h-[20px] w-[20px]" />
                    </span>
                    <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-foreground/85">
                      {d.name}
                    </span>
                  </div>
                );
              })}
              {/* trailing "all departments" tile */}
              <div
                className="aq-tile aq-reveal group flex flex-col items-center justify-center gap-2 rounded-2xl p-3 text-center"
                style={
                  {
                    "--a": "#2560e6",
                    animationDelay: `${(DEPT_CATALOG.length % 4) * 70}ms`,
                  } as CSSProperties
                }
              >
                <span
                  className="aq-badge grid h-10 w-10 place-items-center rounded-[14px]"
                  style={{ "--a": "#2560e6" } as CSSProperties}
                >
                  <LayoutGrid
                    className="h-[20px] w-[20px] text-foreground"
                    aria-hidden
                  />
                </span>
                <span className="text-[11px] font-semibold leading-tight text-foreground/85">
                  All 11
                </span>
              </div>
            </div>
          </div>

          <p
            className="aq-reveal mt-7 text-sm text-muted-foreground"
            style={{ animationDelay: "260ms" }}
          >
            Trusted sources · Real part numbers &amp; code · Built for every seat
            on the team.
          </p>
        </div>
      </div>
    </main>
  );
}
