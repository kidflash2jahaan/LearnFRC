import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
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
import { Badge } from "@/components/ui/badge";
import { DepartmentCard } from "@/components/department-card";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { AnimatedCounter } from "@/components/animated-counter";
import { HeroVisual } from "@/components/landing/hero-visual";
import { Faq } from "@/components/landing/faq";
import { getDepartments, getOverviewStats } from "@/lib/queries";
import { DEPT_CATALOG } from "@/lib/dept-catalog";
import { JsonLd } from "@/components/json-ld";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.systemerr.com";

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
  { icon: Code2, label: "Programmers", color: "#10b981" },
  { icon: Wrench, label: "Builders", color: "#f97316" },
  { icon: Gauge, label: "Controls", color: "#06b6d4" },
  { icon: Users, label: "Drive Team", color: "#ef4444" },
  { icon: Megaphone, label: "Outreach", color: "#ec4899" },
  { icon: Trophy, label: "Award Teams", color: "#eab308" },
];

export default async function HomePage() {
  const [departmentsRaw, stats] = await Promise.all([
    getDepartments().catch(() => []),
    getOverviewStats().catch(() => ({
      deptCount: 11,
      moduleCount: 59,
      lessonCount: 203,
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

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "LearnFRC",
              url: SITE,
              description:
                "Structured guides to mastering every department of the FIRST Robotics Competition.",
            },
            {
              "@type": "WebSite",
              name: "LearnFRC",
              url: SITE,
              potentialAction: {
                "@type": "SearchAction",
                target: `${SITE}/guides?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            },
          ],
        }}
      />
      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-grid mask-b-faded opacity-70" />
          <div className="absolute left-1/2 top-[-10%] h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-40 blur-3xl aurora-bg animate-aurora" />
        </div>

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-28 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:pb-24 lg:pt-36">
          <div>
            <Reveal>
              <Badge variant="primary" className="mb-5 px-3 py-1">
                <Sparkles className="h-3.5 w-3.5" />
                The complete FRC playbook — 11 departments
              </Badge>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Master every part of{" "}
                <span className="text-gradient">FIRST Robotics</span>
              </h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
                From swerve drivetrains and WPILib to the Impact Award and
                scouting — LearnFRC is the structured, web-grounded guide that
                takes any student from rookie to robot-ready.
              </p>
            </Reveal>
            <Reveal delay={0.18}>
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
            <Reveal delay={0.24}>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-success" /> 100% free
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-success" /> No experience needed
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-success" /> {stats.lessonCount}+ lessons
                </span>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.15} className="lg:pl-6">
            <HeroVisual />
          </Reveal>
        </div>

        {/* marquee */}
        <div className="relative border-y border-border bg-card/40 py-5">
          <div className="mx-auto max-w-7xl px-4">
            <p className="mb-4 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Grounded in the sources real teams trust
            </p>
          </div>
          <div className="group relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
            <div className="flex shrink-0 animate-marquee items-center gap-8 pr-8">
              {[...SOURCES, ...SOURCES].map((s, i) => (
                <span
                  key={i}
                  className="whitespace-nowrap font-mono text-sm font-medium text-muted-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
            <div
              aria-hidden
              className="flex shrink-0 animate-marquee items-center gap-8 pr-8"
            >
              {[...SOURCES, ...SOURCES].map((s, i) => (
                <span
                  key={i}
                  className="whitespace-nowrap font-mono text-sm font-medium text-muted-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================ STATS ============================ */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {[
            { value: stats.deptCount, suffix: "", label: "Departments" },
            { value: stats.moduleCount, suffix: "", label: "Modules" },
            { value: stats.lessonCount, suffix: "", label: "Lessons" },
            { value: 100, suffix: "%", label: "Free, forever" },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 0.06}>
              <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--shadow-sm)]">
                <div className="font-display text-4xl font-bold text-gradient">
                  <AnimatedCounter value={s.value} suffix={s.suffix} />
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {s.label}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ========================= DEPARTMENTS ========================= */}
      <section
        id="departments"
        className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
      >
        <Reveal className="mx-auto max-w-2xl text-center">
          <Badge variant="accent" className="mb-4">
            11 departments
          </Badge>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            A track for every seat on the team
          </h2>
          <p className="mt-3 text-muted-foreground">
            Pick a department and follow it end to end. Each one is a complete
            curriculum, not a pile of links.
          </p>
        </Reveal>

        <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => (
            <StaggerItem key={d.slug}>
              <DepartmentCard
                slug={d.slug}
                name={d.name}
                tagline={d.tagline}
                moduleCount={"moduleCount" in d ? d.moduleCount : undefined}
                lessonCount={"lessonCount" in d ? d.lessonCount : undefined}
              />
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ========================== FEATURES ========================== */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to actually learn it
          </h2>
          <p className="mt-3 text-muted-foreground">
            Built like a product, not a wiki — so progress feels good and sticks.
          </p>
        </Reveal>
        <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <StaggerItem key={f.title}>
              <div className="group h-full rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-md)]">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ========================= HOW IT WORKS ======================= */}
      <section className="relative overflow-hidden border-y border-border bg-card/40 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              From zero to robot-ready in three steps
            </h2>
          </Reveal>
          <Stagger className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <StaggerItem key={s.n}>
                <div className="relative h-full rounded-2xl border border-border bg-card p-7">
                  <div className="font-display text-5xl font-bold text-muted/70">
                    {s.n}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
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
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium"
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
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
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
            <div aria-hidden className="absolute inset-0 -z-10 bg-brand opacity-95" />
            <div aria-hidden className="absolute inset-0 -z-10 bg-grid opacity-20" />
            <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to master FRC?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-white/85">
              Join LearnFRC, track your progress across every department, and
              show up to build season ready to win.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                asChild
                size="lg"
                className="bg-white text-primary hover:bg-white/90"
              >
                <Link href="/signup">
                  Create your free account
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/40 bg-white/10 text-white hover:bg-white/20"
              >
                <Link href="/guides">Explore guides</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
