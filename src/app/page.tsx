import type { CSSProperties } from "react";
import type { Metadata } from "next";
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
import { deptMeta, inkFor } from "@/lib/departments";
import { getDepartments, getOverviewStats } from "@/lib/queries";
import { DEPT_CATALOG } from "@/lib/dept-catalog";
import { AnimatedCounter } from "@/components/animated-counter";
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
import { HeroPanel, type HeroDept } from "./_hero-panel";

// Title/description/OG are inherited from the root layout defaults (which are
// written for the home page); we only pin the self-referential canonical.
export const metadata: Metadata = {
  // Tighter than the sitewide fallback so the home SERP snippet isn't truncated.
  description:
    "Free, structured guides to every department of the FIRST Robotics Competition — mechanical, CAD, programming, electrical, strategy, business and more.",
  alternates: { canonical: "/" },
};

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const STEPS = [
  {
    icon: BookOpen,
    title: "Read the guides",
    body: "Clear, complete lessons for every department — grounded in the real Game Manual and WPILib docs. No login needed to read.",
  },
  {
    icon: ClipboardCheck,
    title: "Pass the quizzes",
    body: "Every lesson ends in a quick quiz that checks what actually matters at competition — and earns you XP on the leaderboard.",
  },
  {
    icon: Award,
    title: "Earn certificates",
    body: "Finish a department and print a certificate — real proof you learned the whole role, from your first day in the pit.",
  },
];

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

  // Top departments by lesson count feed the hero telemetry meters.
  const heroDepts: HeroDept[] = [...departments]
    .sort((a, b) => (b.lessonCount ?? 0) - (a.lessonCount ?? 0))
    .slice(0, 4)
    .map((d) => ({
      slug: d.slug,
      name: d.name,
      color: deptMeta(d.slug).color,
      icon: deptMeta(d.slug).icon,
      lessons: d.lessonCount ?? 0,
    }));

  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "640px", pos: { left: "-170px", top: "-220px" }, color: "#8bbcff", opacity: 0.65 },
          { size: "580px", pos: { right: "-190px", top: "-120px" }, color: "#6ff0ea", opacity: 0.55, delay: 2 },
          { size: "540px", pos: { left: "30%", top: "520px" }, color: "#c8b6ff", opacity: 0.45, delay: 4 },
        ]}
      />

      {/* ============================ HERO ============================ */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-28 sm:px-6 lg:grid-cols-2 lg:gap-10 lg:pb-20 lg:pt-36 lg:px-8">
        <RiseGroup>
          <RiseItem>
            <span className="ac-chip inline-flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="ac-eyebrow">Free · no login to read a guide</span>
            </span>
          </RiseItem>
          <RiseItem>
            <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.02] sm:text-5xl lg:text-[3.4rem]">
              Every seat on the team,{" "}
              <span style={BRAND_GRADIENT}>mastered.</span>
            </h1>
          </RiseItem>
          <RiseItem>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
              An FRC team is eleven teams in one — build, code, CAD, wiring,
              scouting, business, drive team and more. LearnFRC teaches all of
              them with written guides, quizzes, and printable certificates.
              Built by students, free for everyone.
            </p>
          </RiseItem>
          <RiseItem>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="ac-btn text-sm">
                Start learning <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/guides" className="ac-btn-ghost text-sm">
                Browse the guides
              </Link>
            </div>
          </RiseItem>
          <RiseItem>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span>
                <b className="font-semibold text-foreground">
                  <AnimatedCounter value={stats.lessonCount} />
                </b>{" "}
                lessons
              </span>
              <span>
                <b className="font-semibold text-foreground">
                  <AnimatedCounter value={stats.deptCount} />
                </b>{" "}
                departments
              </span>
              <span>
                <b className="font-semibold text-foreground">$0</b> — always
              </span>
            </div>
          </RiseItem>
        </RiseGroup>

        <HeroPanel
          lessonCount={stats.lessonCount}
          deptCount={stats.deptCount}
          depts={heroDepts}
        />
      </section>

      {/* ======================= DEPARTMENT MAP ======================= */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <Reveal>
          <p className="ac-eyebrow">Pick your department</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <h2 className="max-w-xl text-balance font-display text-3xl font-bold sm:text-4xl">
              Every role on the team, one map
            </h2>
            <Link
              href="/guides"
              className="group inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary"
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
              All guides
              <ArrowUpRight
                className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </div>
        </Reveal>

        <RevealGroup className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {departments.map((d) => {
            const m = deptMeta(d.slug);
            return (
              <RevealItem key={d.slug}>
                <Hover className="h-full">
                  <Link
                    href={`/guides/${d.slug}`}
                    className="ac-tile relative block h-full p-[18px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    style={{ "--a": m.color } as CSSProperties}
                  >
                    <ArrowUpRight
                      className="absolute right-4 top-4 h-[18px] w-[18px] text-foreground/40"
                      aria-hidden
                    />
                    <span
                      className="ac-badge flex h-11 w-11 items-center justify-center"
                      style={{ "--a": m.color } as CSSProperties}
                    >
                      <Icon name={m.icon} className="h-[22px] w-[22px]" aria-hidden />
                    </span>
                    <h3 className="mt-3 font-display text-[16px] font-bold leading-tight text-foreground">
                      {d.name}
                    </h3>
                    {d.tagline && (
                      <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-foreground/65">
                        {d.tagline}
                      </p>
                    )}
                    <p
                      className="mt-3 text-xs font-bold uppercase tracking-wide"
                      style={{ color: inkFor(m.color) }}
                    >
                      {d.lessonCount ? `${d.lessonCount} lessons` : "Open the track"}
                    </p>
                  </Link>
                </Hover>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </section>

      {/* ========================= HOW IT WORKS ========================= */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <p className="ac-eyebrow">Read, quiz, certify</p>
          <h2 className="mx-auto mt-2 max-w-lg text-balance font-display text-3xl font-bold sm:text-4xl">
            From rookie to robot-ready
          </h2>
        </Reveal>
        <RevealGroup className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <RevealItem key={s.title}>
              <Hover className="h-full" lift={-5}>
                <div className="ac-card relative h-full p-6">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute right-5 top-4 font-display text-4xl font-extrabold text-foreground/10"
                  >
                    {i + 1}
                  </span>
                  <span
                    className="ac-badge flex h-12 w-12 items-center justify-center"
                    style={{ "--a": "#2560e6" } as CSSProperties}
                  >
                    <s.icon className="h-6 w-6" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                    {s.body}
                  </p>
                </div>
              </Hover>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* =========================== CTA BAND =========================== */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Reveal>
          <div className="ac-glass relative overflow-hidden p-8 text-center sm:p-12">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(26,169,214,0.25),transparent_70%)] blur-2xl"
            />
            <p className="ac-eyebrow">Kickoff is closer than you think</p>
            <h2 className="mx-auto mt-3 max-w-xl text-balance font-display text-3xl font-bold sm:text-4xl">
              Start your first lesson — <span style={BRAND_GRADIENT}>free.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              No experience needed. No credit card. Pick a department, track
              your progress across all 11, and go.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup" className="ac-btn text-sm">
                Create your free account <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/guides" className="ac-btn-ghost text-sm">
                Explore guides
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
