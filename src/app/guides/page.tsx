import type { Metadata } from "next";
import { BookOpen, Layers, GraduationCap, TerminalSquare } from "lucide-react";
import { getDepartments, getCompletedLessonIds } from "@/lib/queries";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DepartmentCard } from "@/components/department-card";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import {
  TerminalFrame,
  StatusPill,
  TypeLine,
  NeonCounter,
} from "@/components/motion/terminal";

export const metadata: Metadata = {
  title: "Guides",
  description:
    "Explore every FRC department — mechanical, CAD, programming, electrical, business, outreach, scouting, drive team and more. Structured guides from fundamentals to advanced.",
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

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-grid mask-b-faded opacity-60"
      />

      <div className="mx-auto max-w-7xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
        {/* hero */}
        <div className="mx-auto max-w-3xl text-center">
          <Reveal className="flex justify-center">
            <StatusPill tone="accent">
              system map · {departments.length} departments
            </StatusPill>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className="mt-5 text-balance font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Master FRC,{" "}
              <span className="text-gradient">department by department</span>
            </h1>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-foreground/80">
              Every track is a complete curriculum — structured modules and
              example-rich lessons that build from the fundamentals to advanced.
            </p>
          </Reveal>
        </div>

        {/* system terminal — animated stat scan */}
        <Reveal delay={0.15} className="mx-auto mt-10 max-w-3xl">
          <TerminalFrame
            title="system_map.sh — ~/learnfrc"
            glow
            right={<StatusPill tone="primary">live</StatusPill>}
          >
            <p className="font-mono text-sm text-foreground/80">
              <TypeLine prompt="~/learnfrc $" text="scan ./departments --recursive" />
            </p>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-primary/25 bg-primary/[0.05] p-4">
                <div className="flex items-center gap-2 text-primary">
                  <GraduationCap className="h-4 w-4" />
                  <NeonCounter
                    to={departments.length}
                    className="font-display text-2xl font-bold neon-text"
                  />
                </div>
                <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Departments
                </div>
              </div>

              <div className="rounded-lg border border-accent/25 bg-accent/[0.05] p-4">
                <div className="flex items-center gap-2 text-accent">
                  <Layers className="h-4 w-4" />
                  <NeonCounter
                    to={totalModules}
                    className="font-display text-2xl font-bold"
                  />
                </div>
                <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Modules
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background/40 p-4">
                <div className="flex items-center gap-2 text-foreground">
                  <BookOpen className="h-4 w-4 text-magenta" />
                  <NeonCounter
                    to={totalLessons}
                    className="font-display text-2xl font-bold"
                  />
                </div>
                <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Lessons
                </div>
              </div>
            </div>

            <p className="mt-4 font-mono text-xs text-muted-foreground">
              <span className="text-primary">{"// "}</span>
              every path starts from zero and ends robot-ready — 100% free.
            </p>
          </TerminalFrame>
        </Reveal>

        {/* departments grid */}
        <div className="mt-16">
          <Reveal className="mb-6 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <TerminalSquare className="h-4 w-4 text-primary" />
            <span className="text-primary">$</span> ls ./departments
          </Reveal>

          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((d) => (
              <StaggerItem key={d.slug}>
                <DepartmentCard
                  slug={d.slug}
                  name={d.name}
                  tagline={d.tagline}
                  moduleCount={d.moduleCount}
                  lessonCount={d.lessonCount}
                  progressPct={user ? progress[d.id] : undefined}
                />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </div>
  );
}
