import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, CheckCircle2, ArrowRight, LayoutGrid } from "lucide-react";
import { Icon } from "@/lib/icon-map";
import { deptMeta, inkFor } from "@/lib/departments";
import { DEPT_CATALOG } from "@/lib/dept-catalog";
import { AuthForm } from "@/components/auth/auth-form";
import { AnimatedCounter } from "@/components/animated-counter";
import { getSession } from "@/lib/auth";
import {
  Rise,
  RiseGroup,
  RiseItem,
  Reveal,
  RevealGroup,
  RevealItem,
  Hover,
  Glow,
} from "@/components/motion/primitives";

export const metadata = {
  title: "Sign up",
  description:
    "Create your free LearnFRC account and start mastering FIRST Robotics.",
  robots: { index: false, follow: true },
};

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
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
  { value: 394, suffix: "", label: "lessons" },
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
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "560px", pos: { left: "-160px", top: "-200px" }, color: "#8bbcff", opacity: 0.6 },
          { size: "520px", pos: { right: "-160px", top: "-100px" }, color: "#6ff0ea", opacity: 0.5, delay: 2 },
          { size: "480px", pos: { left: "40%", bottom: "-220px" }, color: "#c8b6ff", opacity: 0.4, delay: 4 },
        ]}
      />

      <section className="mx-auto grid min-h-[100svh] w-full max-w-6xl items-center gap-12 px-4 pb-16 pt-28 sm:gap-14 sm:px-6 sm:pb-20 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 lg:pt-32">
        {/* ============ LEFT: the welcoming glass auth card ============ */}
        <Rise y={24} className="w-full">
          {/* Global navbar provides branding — no page-level logo. */}
          <div className="ac-glass relative mx-auto w-full max-w-md p-6 sm:p-8">
            <span className="ac-chip inline-flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="ac-eyebrow">Free forever</span>
            </span>

            <h1 className="mt-5 text-balance font-display text-2xl font-extrabold leading-tight sm:text-3xl">
              Create your free{" "}
              <span style={BRAND_GRADIENT}>account</span>
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-foreground/70">
              A few details and you&apos;re into build season — every seat on
              the team, unlocked.
            </p>

            <hr className="ac-divider my-6" />

            <AuthForm mode="signup" next={safeNext} referrer={refValue} />
          </div>
        </Rise>

        {/* ===== RIGHT: signature — "your whole team, unlocked" ===== */}
        <div className="w-full">
          <RiseGroup>
            <RiseItem>
              <p className="ac-eyebrow">New to the pit? Start here</p>
            </RiseItem>
            <RiseItem>
              <h2 className="mt-3 max-w-xl text-balance font-display text-3xl font-bold leading-[1.05] sm:text-4xl lg:text-[2.75rem]">
                Go from rookie to{" "}
                <span style={BRAND_GRADIENT}>robot-ready</span>
              </h2>
            </RiseItem>
            <RiseItem>
              <p className="mt-4 max-w-lg text-lg leading-relaxed text-foreground/70">
                One account unlocks every department — drivetrain and code to
                scouting and the Impact Award. It&apos;s free, forever.
              </p>
            </RiseItem>
            <RiseItem>
              <ul className="mt-6 grid gap-2.5">
                {PERKS.map((perk) => (
                  <li
                    key={perk}
                    className="flex items-center gap-2.5 text-[15px] text-foreground/80"
                  >
                    <span
                      className="ac-badge flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                      style={{ "--a": "#2560e6" } as CSSProperties}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    {perk}
                  </li>
                ))}
              </ul>
            </RiseItem>
            <RiseItem>
              <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
                {STATS.map((s) => (
                  <div key={s.label}>
                    <dt className="font-display text-3xl font-extrabold leading-none text-foreground sm:text-4xl">
                      <AnimatedCounter value={s.value} suffix={s.suffix} />
                    </dt>
                    <dd className="mt-1 text-sm text-muted-foreground">
                      {s.label}
                    </dd>
                  </div>
                ))}
              </dl>
            </RiseItem>
          </RiseGroup>

          {/* SIGNATURE: department tile constellation you unlock */}
          <Reveal delay={0.15}>
            <div className="mt-9">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="ac-eyebrow">What you unlock</span>
                <Link
                  href="/guides"
                  className="group inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Preview guides
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </div>

              <RevealGroup className="grid grid-cols-3 gap-3 sm:grid-cols-4" stagger={0.05}>
                {DEPT_CATALOG.map((d) => {
                  const m = deptMeta(d.slug);
                  return (
                    <RevealItem key={d.slug}>
                      <Hover lift={-3} scale={1.03} className="h-full">
                        <div
                          className="ac-tile flex h-full flex-col items-center gap-2 rounded-2xl p-3 text-center"
                          style={{ "--a": m.color } as CSSProperties}
                          title={d.name}
                        >
                          <span
                            className="ac-badge flex h-10 w-10 items-center justify-center rounded-[14px]"
                            style={{ "--a": m.color } as CSSProperties}
                          >
                            <Icon name={m.icon} className="h-5 w-5" aria-hidden />
                          </span>
                          <span
                            className="line-clamp-2 text-[11px] font-semibold leading-tight"
                            style={{ color: inkFor(m.color) }}
                          >
                            {d.name}
                          </span>
                        </div>
                      </Hover>
                    </RevealItem>
                  );
                })}
                {/* trailing "all departments" tile */}
                <RevealItem>
                  <Hover lift={-3} scale={1.03} className="h-full">
                    <div
                      className="ac-tile flex h-full flex-col items-center justify-center gap-2 rounded-2xl p-3 text-center"
                      style={{ "--a": "#2560e6" } as CSSProperties}
                    >
                      <span
                        className="ac-badge flex h-10 w-10 items-center justify-center rounded-[14px]"
                        style={{ "--a": "#2560e6" } as CSSProperties}
                      >
                        <LayoutGrid className="h-5 w-5" aria-hidden />
                      </span>
                      <span
                        className="text-[11px] font-semibold leading-tight"
                        style={{ color: inkFor("#2560e6") }}
                      >
                        All 11
                      </span>
                    </div>
                  </Hover>
                </RevealItem>
              </RevealGroup>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="mt-7 text-sm text-muted-foreground">
              Trusted sources · Real part numbers &amp; code · Built for
              every seat on the team.
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
