import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  BookOpen,
  ClipboardCheck,
  Award,
  LayoutGrid,
} from "lucide-react";
import { Icon } from "@/lib/icon-map";
import { deptMeta } from "@/lib/departments";
import { getDepartments, getOverviewStats } from "@/lib/queries";
import { DEPT_CATALOG } from "@/lib/dept-catalog";
import { AnimatedCounter } from "@/components/animated-counter";

const FEATURES = [
  {
    icon: BookOpen,
    title: "Written guides",
    body: "Clear, complete lessons for every department — grounded in the real Game Manual and WPILib docs.",
  },
  {
    icon: ClipboardCheck,
    title: "Quizzes",
    body: "Check yourself after each module with quick quizzes that reinforce what actually matters at competition.",
  },
  {
    icon: Award,
    title: "Certificates",
    body: "Finish a department and earn a printable certificate — proof you learned the whole role, start to finish.",
  },
];

/** Illustrative readiness percentages for the sample mastery panel. */
const SAMPLE_PCT = [100, 72, 54];

export default async function HomePage() {
  const [departmentsRaw, stats] = await Promise.all([
    getDepartments().catch(() => []),
    getOverviewStats().catch(() => ({
      deptCount: 11,
      moduleCount: 101,
      lessonCount: 394,
      learners: 0,
    })),
  ]);

  const departments =
    departmentsRaw.length > 0
      ? departmentsRaw
      : DEPT_CATALOG.map((c, i) => ({
          ...c,
          id: c.slug,
          description: null,
          tagline: c.tagline,
          moduleCount: 0,
          lessonCount: 0,
          sort_order: i,
        }));

  const sample = departments.slice(0, 3).map((d, i) => ({
    slug: d.slug,
    name: d.name,
    pct: SAMPLE_PCT[i] ?? 50,
    color: deptMeta(d.slug).color,
    icon: deptMeta(d.slug).icon,
  }));

  const heroStats = [
    { n: stats.deptCount, suffix: "", l: "departments" },
    { n: stats.lessonCount, suffix: "+", l: "guides & lessons" },
    { n: 100, suffix: "%", l: "free, no login to read" },
    { n: null as number | null, display: "$0", l: "forever" },
  ];

  return (
    <div
      data-theme="arena"
      className="aq-root relative isolate overflow-x-clip text-foreground"
    >
      {/* ambient light the glass refracts */}
      <div className="aq-glow" aria-hidden>
        <span
          className="h-[660px] w-[660px] opacity-70"
          style={{
            left: "-160px",
            top: "-220px",
            background: "radial-gradient(circle, #8bbcff, transparent 70%)",
          }}
        />
        <span
          className="h-[600px] w-[600px] opacity-60"
          style={{
            right: "-180px",
            top: "-140px",
            background: "radial-gradient(circle, #6ff0ea, transparent 70%)",
          }}
        />
        <span
          className="h-[560px] w-[560px] opacity-50"
          style={{
            left: "32%",
            top: "480px",
            background: "radial-gradient(circle, #c8b6ff, transparent 70%)",
          }}
        />
      </div>

      {/* ============================ HERO ============================ */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-20 sm:px-6 sm:pt-28 lg:grid-cols-2 lg:gap-10 lg:pb-20 lg:pt-36">
        <div>
          <span className="aq-chip aq-eyebrow aq-rise aq-rise-1 inline-flex flex-wrap items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Free · no login
            to read a guide
          </span>
          <h1 className="aq-display aq-rise aq-rise-2 mt-4 text-balance text-4xl font-extrabold leading-[1.02] sm:text-5xl lg:text-[3.4rem]">
            Master every part of{" "}
            <span
              className="aq-grad-anim"
              style={{
                background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              FIRST Robotics.
            </span>
          </h1>
          <p className="aq-rise aq-rise-3 mt-4 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
            Your whole team is eleven teams in one — build, code, CAD, wiring,
            scouting, business, drive team and more. LearnFRC teaches all of
            them, with written guides, quizzes, and printable certificates. Built
            by students, free for everyone.
          </p>
          <div className="aq-rise aq-rise-4 mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              Start learning <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/guides"
              className="aq-ghost inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              See how it works
            </Link>
          </div>
          <div className="aq-rise aq-rise-5 mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span>
              <b className="font-semibold text-foreground">
                <AnimatedCounter value={stats.deptCount} />
              </b>{" "}
              departments
            </span>
            <span>
              <b className="font-semibold text-foreground">
                <AnimatedCounter value={stats.lessonCount} suffix="+" />
              </b>{" "}
              guides &amp; lessons
            </span>
            <span>
              <b className="font-semibold text-foreground">$0</b> — always free
            </span>
          </div>
        </div>

        {/* glass mastery panel (sample) */}
        <div className="aq-glass aq-float aq-sheen aq-rise aq-rise-3 rounded-3xl p-6 lg:justify-self-end">
          <div className="mb-4 flex items-center gap-2">
            <span className="aq-display text-[17px] font-bold text-foreground">
              Build season ready
            </span>
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[#0a7a43]">
              <span className="aq-pulse h-2 w-2 rounded-full bg-[#12b565]" />
              SAMPLE
            </span>
          </div>
          <div className="mb-4 flex items-center gap-4">
            <svg width="82" height="82" viewBox="0 0 82 82" aria-hidden>
              <circle
                cx="41"
                cy="41"
                r="34"
                fill="none"
                stroke="rgba(120,145,190,.28)"
                strokeWidth="10"
              />
              <circle
                className="aq-ring-anim"
                cx="41"
                cy="41"
                r="34"
                fill="none"
                stroke="url(#aqring)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray="213.6"
                strokeDashoffset="47"
                transform="rotate(-90 41 41)"
              />
              <defs>
                <linearGradient id="aqring" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#2560e6" />
                  <stop offset="1" stopColor="#1aa9d6" />
                </linearGradient>
              </defs>
            </svg>
            <div>
              <div className="aq-display text-2xl font-extrabold leading-none text-foreground">
                <AnimatedCounter value={78} suffix="%" />
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                across your departments
              </div>
            </div>
          </div>
          {sample.map((s, i) => (
            <div
              key={s.slug}
              className="aq-reveal flex items-center gap-3 py-2"
              style={{ animationDelay: `${0.15 + i * 0.12}s` }}
            >
              <span
                className="aq-badge aq-badge-bob flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ "--a": s.color } as CSSProperties}
              >
                <Icon name={s.icon} className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">
                  {s.name}
                </div>
                <div className="mt-1.5 h-[7px] overflow-hidden rounded-md bg-[rgba(120,145,190,.24)]">
                  <span
                    className="aq-bar-anim block h-full rounded-md"
                    style={{
                      width: `${s.pct}%`,
                      animationDelay: `${0.3 + i * 0.15}s`,
                      background: `color-mix(in srgb, ${s.color} 78%, #000 4%)`,
                    }}
                  />
                </div>
              </div>
              <span className="tabular-nums text-xs font-semibold text-foreground/70">
                <AnimatedCounter value={s.pct} suffix="%" />
              </span>
            </div>
          ))}
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Sample progress — track your own once you sign up (free).
          </p>
        </div>
      </section>

      {/* ========================= DEPARTMENTS ======================== */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <span className="aq-eyebrow aq-reveal">
          Pick your department
        </span>
        <h2 className="aq-reveal aq-display mt-2 text-3xl font-bold text-foreground">
          Every role on your robotics team
        </h2>
        <p className="aq-reveal mt-1 max-w-xl text-base text-foreground/70">
          A full FRC team is a small company. Tap into any department below —
          each has its own guides, quizzes, and a completion certificate.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {departments.map((d, i) => {
            const m = deptMeta(d.slug);
            return (
              <Link
                key={d.slug}
                href={`/guides/${d.slug}`}
                className="aq-tile aq-reveal group relative block rounded-[20px] p-[18px]"
                style={
                  {
                    "--a": m.color,
                    animationDelay: `${(i % 4) * 0.08}s`,
                  } as CSSProperties
                }
              >
                <ArrowUpRight
                  className="absolute right-4 top-4 h-[18px] w-[18px] text-muted-foreground/70"
                  aria-hidden="true"
                />
                <span
                  className="aq-badge aq-badge-bob flex h-11 w-11 items-center justify-center rounded-[14px]"
                  style={{ "--a": m.color } as CSSProperties}
                >
                  <Icon name={m.icon} className="h-[22px] w-[22px]" aria-hidden="true" />
                </span>
                <h3 className="aq-display mt-3 text-[16px] font-bold leading-tight text-foreground">
                  {d.name}
                </h3>
                {d.tagline && (
                  <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                    {d.tagline}
                  </p>
                )}
              </Link>
            );
          })}
          <Link
            href="/guides"
            className="aq-tile aq-reveal group relative block rounded-[20px] p-[18px]"
            style={
              {
                "--a": "#8493ad",
                animationDelay: `${(departments.length % 4) * 0.08}s`,
              } as CSSProperties
            }
          >
            <ArrowUpRight
              className="absolute right-4 top-4 h-[18px] w-[18px] text-muted-foreground/70"
              aria-hidden="true"
            />
            <span
              className="aq-badge aq-badge-bob flex h-11 w-11 items-center justify-center rounded-[14px]"
              style={{ "--a": "#8493ad" } as CSSProperties}
            >
              <LayoutGrid className="h-[22px] w-[22px]" aria-hidden="true" />
            </span>
            <h3 className="aq-display mt-3 text-[16px] font-bold leading-tight text-foreground">
              See all {stats.deptCount}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              the whole team, one place
            </p>
          </Link>
        </div>
      </section>

      {/* ========================== FEATURES ========================== */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <span className="aq-eyebrow aq-reveal">
          What you get
        </span>
        <h2 className="aq-reveal aq-display mt-2 text-3xl font-bold text-foreground">
          Read, quiz, certify, repeat
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="aq-glass aq-card-hover aq-reveal rounded-3xl p-5"
              style={{ animationDelay: `${i * 0.12}s` }}
            >
              <span className="aq-badge-bob flex h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-primary/10 text-primary">
                <f.icon className="h-[23px] w-[23px]" aria-hidden="true" />
              </span>
              <h3 className="aq-display mt-3 text-[17px] font-bold text-foreground">
                {f.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-foreground/70">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* =========================== STATS ============================ */}
      <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {heroStats.map((s, i) => (
            <div
              key={s.l}
              className="aq-glass aq-card-hover aq-reveal rounded-2xl p-5 text-center"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="aq-display text-3xl font-extrabold leading-none text-foreground">
                {s.n === null ? (
                  s.display
                ) : (
                  <AnimatedCounter value={s.n} suffix={s.suffix} />
                )}
              </div>
              <div className="mt-1.5 text-[13px] text-muted-foreground">
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================= CTA ============================ */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="aq-glass aq-sheen aq-reveal rounded-[28px] px-8 py-12 text-center sm:px-16">
          <h2 className="aq-display text-balance text-3xl font-bold text-foreground sm:text-4xl">
            Start your first lesson —{" "}
            <span
              className="aq-grad-anim"
              style={{
                background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              free
            </span>
            .
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-base text-foreground/70">
            No experience needed. No credit card. Pick a department, track your
            progress across all {stats.deptCount} of them, and go.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              Create your free account{" "}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/guides"
              className="aq-ghost inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              Explore guides
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
