import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Trophy,
  Search,
  ShieldCheck,
  GitBranch,
  BookOpenCheck,
  Gauge,
  Wrench,
  Code2,
  Users,
  Megaphone,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DepartmentCard } from "@/components/department-card";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { NeonCounter, TypeLine } from "@/components/motion/terminal";
import { HeroVisual } from "@/components/landing/hero-visual";
import { Faq } from "@/components/landing/faq";
import { getDepartments, getOverviewStats } from "@/lib/queries";
import { DEPT_CATALOG } from "@/lib/dept-catalog";

const SOURCES = [
  "WPILib",
  "Onshape",
  "REV Robotics",
  "CTR Electronics",
  "Limelight",
  "PhotonVision",
  "FIRST Inspires",
  "Chief Delphi",
  "The Blue Alliance",
  "AndyMark",
  "Statbotics",
  "PathPlanner",
];

const FEATURES = [
  {
    icon: GitBranch,
    title: "Structured learning paths",
    body: "Every department is broken into modules and lessons that build from fundamentals to advanced — no more scattered tutorials.",
  },
  {
    icon: Gauge,
    title: "Progress tracking & XP",
    body: "Mark lessons complete, watch your mastery climb, earn XP, and pick up exactly where you left off.",
  },
  {
    icon: ShieldCheck,
    title: "Web-grounded & cited",
    body: "Researched and fact-checked against the official WPILib docs, FIRST, and vendor sources. Every lesson links its references.",
  },
  {
    icon: Trophy,
    title: "Achievements & leaderboard",
    body: "Unlock badges as you progress and climb the global leaderboard with learners from teams everywhere.",
  },
  {
    icon: Search,
    title: "Instant ⌘K search",
    body: "Jump to any department, module, or lesson in a keystroke with a full command palette.",
  },
  {
    icon: BookOpenCheck,
    title: "Built for every role",
    body: "Not just programmers and builders — business, media, scouting, drive team, safety and award strategy too.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Pick your department",
    body: "Choose from 11 tracks — whether you're wiring the robot, writing autonomous code, or chasing the Impact Award.",
  },
  {
    n: "02",
    title: "Work through the guides",
    body: "Follow clear, example-rich lessons with real part numbers, code, and diagrams. Learn at your own pace.",
  },
  {
    n: "03",
    title: "Track your mastery",
    body: "Complete lessons, earn XP and badges, and build a profile that proves what you've learned.",
  },
];

const ROLES = [
  { icon: Code2, label: "Programmers", color: "var(--primary)" },
  { icon: Wrench, label: "Builders", color: "var(--accent)" },
  { icon: Gauge, label: "Controls", color: "var(--primary)" },
  { icon: Users, label: "Drive Team", color: "var(--accent)" },
  { icon: Megaphone, label: "Outreach", color: "var(--primary)" },
  { icon: Trophy, label: "Award Teams", color: "var(--accent)" },
];

/** Mono terminal-style section label with a neon trace. */
function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.2em] text-accent">
      <span
        aria-hidden
        className="h-px w-6 bg-gradient-to-r from-accent to-transparent"
      />
      {children}
    </span>
  );
}

export default async function HomePage() {
  const [departmentsRaw, stats] = await Promise.all([
    getDepartments().catch(() => []),
    getOverviewStats().catch(() => ({
      deptCount: 11,
      moduleCount: 100,
      lessonCount: 393,
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
          estimated_hours: null,
          what_youll_learn: [],
          prerequisites: [],
          tools: [],
          sources: [],
          accent: "blue",
          icon: "BookOpen",
          sort_order: i,
          moduleCount: 0,
          lessonCount: 0,
        }));

  const heroStats = [
    { to: stats.deptCount, unit: "", label: "Departments" },
    { to: stats.moduleCount, unit: "", label: "Modules" },
    { to: stats.lessonCount, unit: "+", label: "Lessons" },
    { to: 100, unit: "%", label: "Free, forever" },
  ];

  return (
    <>
      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-12%] h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-40 blur-3xl aurora-bg animate-aurora" />
        </div>

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-28 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:pb-24 lg:pt-36">
          <div>
            <Reveal>
              <TypeLine
                prompt="~/learnfrc $"
                text="./start --free --department=any"
                className="text-xs text-muted-foreground"
              />
            </Reveal>
            <Reveal delay={0.04}>
              <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/[0.06] px-3 py-1 font-mono text-xs uppercase tracking-wider text-primary shadow-[var(--glow-primary)]">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--primary)] animate-glow-pulse" />
                The complete FRC playbook — {departments.length} departments
              </span>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-5 text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Master every part of{" "}
                <span className="text-gradient-animated">FIRST Robotics</span>.
              </h1>
            </Reveal>
            <Reveal delay={0.14}>
              <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
                From swerve drivetrains and WPILib to the Impact Award and
                scouting — LearnFRC is the structured, web-grounded guide that
                takes any student from rookie to robot-ready.
              </p>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild variant="brand" size="lg">
                  <Link href="/signup">
                    Start learning free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/guides">Browse all guides</Link>
                </Button>
              </div>
            </Reveal>
            <Reveal delay={0.26}>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> 100% free
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> No experience
                  needed
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />{" "}
                  {stats.lessonCount}+ lessons
                </span>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.15} className="lg:pl-6">
            <HeroVisual />
          </Reveal>
        </div>

        {/* marquee */}
        <div className="relative border-y border-border bg-card/30 py-7">
          <div className="mx-auto max-w-7xl px-4">
            <p className="mb-5 text-center font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Grounded in the sources real teams trust
            </p>
          </div>
          <div className="group relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
            {[0, 1].map((track) => (
              <div
                key={track}
                aria-hidden={track === 1}
                className="flex shrink-0 animate-marquee items-center gap-3.5 pr-3.5"
              >
                {[...SOURCES, ...SOURCES].map((s, i) => (
                  <span
                    key={`${track}-${s}-${i}`}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-border bg-card/40 px-3.5 py-2 font-mono text-sm text-muted-foreground"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
                    {s}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ STATS ============================ */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Reveal>
          <div className="overflow-hidden rounded-2xl border border-border bg-card/30 backdrop-blur">
            <Stagger className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
              {heroStats.map((s) => (
                <StaggerItem
                  key={s.label}
                  className="relative bg-background-2/40 p-7 sm:p-8"
                >
                  <div
                    className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-[2.7rem]"
                    style={{
                      textShadow:
                        "0 0 26px color-mix(in srgb, var(--primary) 25%, transparent)",
                    }}
                  >
                    <NeonCounter to={s.to} />
                    {s.unit && <span className="text-primary">{s.unit}</span>}
                  </div>
                  <div className="mt-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </div>
                  <span
                    aria-hidden
                    className="absolute bottom-5 left-7 h-0.5 w-6 bg-accent shadow-[0_0_10px_var(--accent)] sm:left-8"
                  />
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-5 text-center font-mono text-sm text-muted-foreground">
            <span className="text-primary">// no experience needed</span> — every
            path starts from zero and ends robot-ready
          </p>
        </Reveal>
      </section>

      {/* ========================= DEPARTMENTS ========================= */}
      <section
        id="departments"
        className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
      >
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>System map · all departments</SectionEyebrow>
          <h2 className="mt-4 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {departments.length} departments. One robot. Every skill covered.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Pick a department and follow it end to end. Each one is a complete
            curriculum, not a pile of links.
          </p>
        </Reveal>

        <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d, i) => (
            <StaggerItem key={d.slug} className="h-full">
              <DepartmentCard
                slug={d.slug}
                name={d.name}
                tagline={d.tagline}
                index={i + 1}
                moduleCount={"moduleCount" in d ? d.moduleCount : undefined}
                lessonCount={"lessonCount" in d ? d.lessonCount : undefined}
              />
            </StaggerItem>
          ))}
          <StaggerItem className="h-full">
            <Link
              href="/guides"
              className="group relative flex h-full flex-col justify-center overflow-hidden rounded-xl border border-dashed border-accent/30 bg-accent/[0.03] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent/60 hover:bg-accent/[0.06] hover:shadow-[var(--glow-accent)]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent transition-transform duration-300 group-hover:translate-x-1">
                <ArrowRight className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">
                Explore all modules
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Jump into the full catalog and build your own learning path.
              </p>
              <div className="mt-3 font-mono text-xs text-accent">
                ~/learnfrc $ open --catalog
                <span className="caret" aria-hidden />
              </div>
            </Link>
          </StaggerItem>
        </Stagger>
      </section>

      {/* ========================== FEATURES ========================== */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>Why LearnFRC</SectionEyebrow>
          <h2 className="mt-4 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
            A power tool for makers — not another scattered wiki.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Built like a product, not a wiki — so progress feels good and sticks.
          </p>
        </Reveal>
        <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <StaggerItem key={f.title} className="h-full">
              <div className="group relative h-full overflow-hidden rounded-xl border border-border bg-gradient-to-b from-white/[0.03] to-transparent p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-[var(--glow-accent)]">
                <span className="absolute right-5 top-5 font-mono text-xs text-muted-foreground/70">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-accent/25 bg-accent/[0.08] text-accent shadow-[var(--glow-accent)]">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ========================= HOW IT WORKS ======================= */}
      <section className="relative overflow-hidden border-y border-border bg-card/30 py-20">
        <div aria-hidden className="absolute inset-0 -z-10 bg-dots opacity-30" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>Run sequence · how it works</SectionEyebrow>
            <h2 className="mt-4 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
              From zero to robot-ready in three steps
            </h2>
          </Reveal>
          <Stagger className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <StaggerItem key={s.n} className="h-full">
                <div className="relative h-full overflow-hidden rounded-xl border border-border bg-card/60 p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--glow-primary)]">
                  <div className="font-display text-5xl font-bold text-primary/20">
                    {s.n}
                  </div>
                  <h3 className="mt-3 font-display text-lg font-semibold">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {s.body}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>

          <Reveal className="mt-12">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {ROLES.map((r) => (
                <span
                  key={r.label}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 font-mono text-sm transition-colors duration-200 hover:border-border/60"
                >
                  <r.icon className="h-4 w-4" style={{ color: r.color }} />
                  {r.label}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================= FAQ ============================ */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <SectionEyebrow>FAQ · ./help</SectionEyebrow>
          <h2 className="mt-4 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Questions, answered
          </h2>
        </Reveal>
        <Reveal>
          <Faq />
        </Reveal>
      </section>

      {/* ============================= CTA ============================ */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-border p-10 text-center sm:p-16">
            <div
              aria-hidden
              className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.07] to-accent/[0.04]"
            />
            <div
              aria-hidden
              className="absolute inset-0 -z-10 hud-grid opacity-20"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-44 bg-[radial-gradient(600px_200px_at_50%_-20%,color-mix(in_srgb,var(--primary)_18%,transparent),transparent)]"
            />
            <div className="font-mono text-sm text-accent">
              ~/learnfrc $ ./start.sh --free
              <span className="caret" aria-hidden />
            </div>
            <h2 className="mt-4 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Start your first lesson —{" "}
              <span className="text-gradient-animated">free</span>.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-muted-foreground">
              No experience needed. No credit card. Just pick a department, track
              your progress across all {departments.length} of them, and go.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild variant="brand" size="lg">
                <Link href="/signup">
                  Create your free account
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/guides">Explore guides</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
