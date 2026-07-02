import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { getDepartments, getCompletedLessonIds } from "@/lib/queries";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DepartmentCard } from "@/components/department-card";
import { AnimatedCounter } from "@/components/animated-counter";
import { Icon } from "@/lib/icon-map";
import { deptMeta, inkFor } from "@/lib/departments";
import {
  Compass,
  Layers,
  BookOpen,
  GraduationCap,
  ArrowRight,
  ArrowUpRight,
  MapPin,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Guides",
  description:
    "Explore every FRC department — mechanical, CAD, programming, electrical, business, outreach, scouting, drive team and more. Structured guides from fundamentals to advanced.",
};

const HEADLINE_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

export default async function GuidesPage() {
  const [departments, { user }] = await Promise.all([
    getDepartments(),
    getSession(),
  ]);

  const progress: Record<string, number> = {};
  if (user) {
    const supabase = await createClient();
    const [{ data: lessons }, completed] = await Promise.all([
      supabase.from("lessons").select("id, modules(department_id)"),
      getCompletedLessonIds(user.id),
    ]);
    const totals: Record<string, number> = {};
    const done: Record<string, number> = {};
    for (const l of lessons ?? []) {
      const dep = (l.modules as { department_id?: string } | null)?.department_id;
      if (!dep) continue;
      totals[dep] = (totals[dep] ?? 0) + 1;
      if (completed.has(l.id as string)) done[dep] = (done[dep] ?? 0) + 1;
    }
    for (const d of departments)
      progress[d.id] = totals[d.id]
        ? Math.round(((done[d.id] ?? 0) / totals[d.id]) * 100)
        : 0;
  }

  const totalModules = departments.reduce((s, d) => s + d.moduleCount, 0);
  const totalLessons = departments.reduce((s, d) => s + d.lessonCount, 0);

  const stats = [
    { label: "departments", value: departments.length, icon: GraduationCap },
    { label: "modules", value: totalModules, icon: Layers },
    { label: "lessons", value: totalLessons, icon: BookOpen },
  ];

  // The hero "pit map" preview — a compact mosaic of the first departments.
  const mapPreview = departments.slice(0, 6);

  return (
    <div className="relative overflow-hidden">
      {/* ambient glows the glass refracts */}
      <div aria-hidden className="aq-glow -z-10">
        <span
          className="aq-float h-[36rem] w-[36rem] opacity-70"
          style={{
            top: "-10rem",
            left: "-8rem",
            background:
              "radial-gradient(circle, rgba(37,96,230,0.28), transparent 70%)",
          }}
        />
        <span
          className="aq-float h-[30rem] w-[30rem] opacity-60"
          style={{
            top: "-6rem",
            right: "-6rem",
            animationDelay: "1.4s",
            background:
              "radial-gradient(circle, rgba(26,169,214,0.26), transparent 70%)",
          }}
        />
        <span
          className="h-[26rem] w-[26rem] opacity-50"
          style={{
            top: "24rem",
            left: "38%",
            background:
              "radial-gradient(circle, rgba(200,182,255,0.24), transparent 70%)",
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-28 pb-24 sm:px-6 lg:px-8">
        {/* ============================ HERO — the pit map ============================ */}
        <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10">
          <div className="max-w-2xl">
            <span className="aq-chip aq-eyebrow aq-rise aq-rise-1 inline-flex items-center gap-2">
              <Compass className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
              Pick your department
            </span>

            <h1 className="aq-display aq-rise aq-rise-2 mt-4 text-balance text-4xl font-extrabold leading-[1.03] tracking-tight sm:text-5xl lg:text-6xl">
              Walk the pit,{" "}
              <span className="aq-grad-anim" style={HEADLINE_GRADIENT}>
                department by department
              </span>
            </h1>

            <p className="aq-rise aq-rise-3 mt-5 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
              A full FRC team is eleven teams in one. This is the whole map of
              build season — every track a complete curriculum of structured
              modules and example-rich lessons that carry you from your first day
              in the pit to robot-ready.
            </p>

            <div className="aq-rise aq-rise-4 mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/guides/getting-started"
                className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                Start with the basics
                <ArrowRight className="h-4 w-4" aria-hidden="true" focusable="false" />
              </Link>
              <Link
                href="/glossary"
                className="aq-ghost inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                Decode the acronyms
              </Link>
            </div>

            {/* inline stat rail */}
            <dl className="aq-rise aq-rise-5 mt-8 flex flex-wrap gap-x-8 gap-y-3">
              {stats.map((s) => (
                <div key={s.label} className="flex items-baseline gap-2">
                  <dd className="aq-display text-2xl font-extrabold leading-none text-foreground">
                    <AnimatedCounter value={s.value} />
                  </dd>
                  <dt className="text-sm text-muted-foreground">{s.label}</dt>
                </div>
              ))}
            </dl>
          </div>

          {/* SIGNATURE: the department map — a tactile mosaic of glass tiles */}
          <div className="aq-glass aq-sheen aq-float aq-rise aq-rise-4 relative rounded-[28px] p-5 sm:p-6 lg:justify-self-end">
            <div className="mb-4 flex items-center gap-2">
              <span
                className="aq-badge aq-badge-bob flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ "--a": "#2560e6" } as CSSProperties}
              >
                <MapPin className="h-[18px] w-[18px]" aria-hidden="true" focusable="false" />
              </span>
              <span className="aq-display text-[17px] font-bold text-foreground">
                The department map
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-primary">
                <span className="aq-pulse h-2 w-2 rounded-full bg-primary" />
                Live
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {mapPreview.map((d, i) => {
                const m = deptMeta(d.slug);
                return (
                  <Link
                    key={d.slug}
                    href={`/guides/${d.slug}`}
                    className="aq-tile aq-reveal group relative flex flex-col items-start gap-2 rounded-2xl p-3"
                    style={
                      {
                        "--a": m.color,
                        animationDelay: `${0.18 + i * 0.07}s`,
                      } as CSSProperties
                    }
                  >
                    <span
                      className="aq-badge aq-badge-bob flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ "--a": m.color } as CSSProperties}
                    >
                      <Icon name={m.icon} className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-foreground">
                      {d.name}
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="aq-divider mt-5" />
            <p className="mt-4 flex items-center gap-2 text-sm leading-relaxed text-muted-foreground">
              <span
                className="font-semibold"
                style={{ color: inkFor("#2560e6") }}
              >
                {departments.length} stops
              </span>
              on the map — every one free, in the spirit of gracious
              professionalism.
            </p>
          </div>
        </div>

        {/* ============================ THE FULL WALK ============================ */}
        <div className="mt-24">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="aq-reveal">
              <span className="aq-eyebrow inline-flex items-center gap-2">
                <Layers className="h-4 w-4" aria-hidden="true" focusable="false" />
                Every track, mapped
              </span>
              <h2 className="aq-display mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Explore all{" "}
                <AnimatedCounter value={departments.length} /> departments
              </h2>
            </div>
            <span
              className="aq-chip aq-reveal inline-flex items-center gap-2"
              style={
                { "--a": "#2560e6", animationDelay: "0.12s" } as CSSProperties
              }
            >
              <Icon name="Rocket" className="h-4 w-4 text-primary" />
              Fundamentals → advanced
            </span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((d, i) => (
              <div
                key={d.slug}
                className="aq-reveal aq-card-hover h-full"
                style={
                  {
                    "--a": deptMeta(d.slug).color,
                    animationDelay: `${Math.min(i * 0.05, 0.5)}s`,
                  } as CSSProperties
                }
              >
                <DepartmentCard
                  slug={d.slug}
                  name={d.name}
                  tagline={d.tagline}
                  moduleCount={d.moduleCount}
                  lessonCount={d.lessonCount}
                  progressPct={user ? progress[d.id] : undefined}
                  index={i + 1}
                  inStagger={false}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ============================ CLOSING CTA ============================ */}
        <div className="mt-24">
          <div className="aq-glass aq-sheen aq-reveal relative overflow-hidden rounded-[28px] px-8 py-12 text-center sm:px-16">
            <h2 className="aq-display text-balance text-3xl font-bold text-foreground sm:text-4xl">
              Not sure where to stand?{" "}
              <span className="aq-grad-anim" style={HEADLINE_GRADIENT}>
                Start at the beginning.
              </span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-base leading-relaxed text-foreground/70">
              Getting Started walks you through the whole map — what each
              department does and where a rookie fits. Every path begins at zero
              and ends robot-ready.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/guides/getting-started"
                className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                Take the intro track
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" focusable="false" />
              </Link>
              <Link
                href="/glossary"
                className="aq-ghost inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                Browse the glossary
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
