import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { getDepartments, getCompletedLessonIds } from "@/lib/queries";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DepartmentCard } from "@/components/department-card";
import { Icon } from "@/lib/icon-map";
import { deptMeta } from "@/lib/departments";
import { GraduationCap, Layers, BookOpen, ArrowRight, Compass } from "lucide-react";

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
    {
      label: "Departments",
      value: departments.length,
      icon: GraduationCap,
      accent: "#2560e6",
    },
    {
      label: "Modules",
      value: totalModules,
      icon: Layers,
      accent: "#1aa9d6",
    },
    {
      label: "Lessons",
      value: totalLessons,
      icon: BookOpen,
      accent: "#7c5cff",
    },
  ];

  return (
    <div className="relative overflow-hidden">
      {/* ambient glows */}
      <div aria-hidden className="aq-glow -z-10">
        <span
          className="h-[36rem] w-[36rem] opacity-70"
          style={{
            top: "-10rem",
            left: "-8rem",
            background:
              "radial-gradient(circle, rgba(37,96,230,0.28), transparent 70%)",
          }}
        />
        <span
          className="h-[30rem] w-[30rem] opacity-60"
          style={{
            top: "-6rem",
            right: "-6rem",
            background:
              "radial-gradient(circle, rgba(26,169,214,0.26), transparent 70%)",
          }}
        />
        <span
          className="h-[26rem] w-[26rem] opacity-50"
          style={{
            top: "22rem",
            left: "40%",
            background:
              "radial-gradient(circle, rgba(124,92,255,0.2), transparent 70%)",
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-28 pb-24 sm:px-6 lg:px-8">
        {/* hero — the department map */}
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-2xl">
            <p className="aq-eyebrow aq-rise aq-rise-1">
              <Compass className="h-4 w-4" />
              Pick your department
            </p>

            <h1 className="aq-rise aq-rise-2 mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Master FRC,{" "}
              <span style={HEADLINE_GRADIENT}>department by department</span>
            </h1>

            <p className="aq-rise aq-rise-3 mt-5 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
              The whole map of build season in one place. Every track is a
              complete curriculum — structured modules and example-rich lessons
              that carry you from your first day in the pit to robot-ready.
            </p>

            <div className="aq-rise aq-rise-4 mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/guides/getting-started"
                className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                Start with the basics
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/glossary"
                className="aq-ghost inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                Decode the acronyms
              </Link>
            </div>
          </div>

          {/* clean glass stat panel — no terminal frame */}
          <div className="aq-glass aq-rise aq-rise-4 relative rounded-3xl p-6 sm:p-8">
            <div className="flex items-center gap-2">
              <span
                className="aq-badge flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ "--a": "#2560e6" } as CSSProperties}
              >
                <Compass className="h-5 w-5" />
              </span>
              <div className="font-display text-lg font-semibold text-foreground">
                The department map
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
              {stats.map((s) => {
                const StatIcon = s.icon;
                return (
                  <div
                    key={s.label}
                    className="aq-tile rounded-2xl p-4 text-center"
                    style={{ "--a": s.accent } as CSSProperties}
                  >
                    <span
                      className="aq-badge mx-auto flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{ "--a": s.accent } as CSSProperties}
                    >
                      <StatIcon className="h-5 w-5" />
                    </span>
                    <div className="mt-3 font-display text-3xl font-bold text-foreground">
                      {s.value}
                    </div>
                    <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-foreground/70">
                      {s.label}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="aq-divider mt-6" />
            <p className="mt-4 text-sm leading-relaxed text-foreground/70">
              Every path starts from zero and ends robot-ready — and all of it
              is 100% free, in the spirit of gracious professionalism.
            </p>
          </div>
        </div>

        {/* departments grid */}
        <div className="mt-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="aq-eyebrow">
                <Layers className="h-4 w-4" />
                Every track, mapped
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Explore the {departments.length} departments
              </h2>
            </div>
            <span
              className="aq-chip"
              style={{ "--a": "#2560e6" } as CSSProperties}
            >
              <Icon name="Rocket" className="h-4 w-4 text-primary" />
              Fundamentals → advanced
            </span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((d, i) => (
              <div
                key={d.slug}
                className="aq-reveal h-full"
                style={
                  {
                    "--a": deptMeta(d.slug).color,
                    animationDelay: `${(i % 3) * 0.06}s`,
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
                  inStagger={false}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
