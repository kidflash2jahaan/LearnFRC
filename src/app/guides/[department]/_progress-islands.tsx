"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Award, Layers, BookOpen, Clock, GraduationCap } from "lucide-react";
import { AnimatedCounter } from "@/components/animated-counter";
import { RevealGroup, RevealItem, Hover } from "@/components/motion/primitives";
import { DepartmentModules } from "@/components/guides/department-modules";
import { SuggestNewContent } from "@/components/guides/suggest-new-content";
import { useMyProgress } from "@/components/progress/my-progress";
import { MasteryPanel } from "./_mastery-panel";

/**
 * Client islands for the (now static/ISR) department page. Each reads the
 * signed-in user's progress from the shared store (hydrated after mount via
 * /api/me/progress) and renders the exact same UI the server used to render
 * from the session. Before hydration / for logged-out visitors the store is
 * empty, so these match today's logged-out server output.
 */
export type NavLesson = { id: string; moduleSlug: string; slug: string };

function useDeptProgress(lessons: NavLesson[]) {
  const { authed, completed } = useMyProgress();
  const total = lessons.length;
  let done = 0;
  for (const l of lessons) if (completed.has(l.id)) done++;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const nextLesson = lessons.find((l) => !completed.has(l.id)) ?? lessons[0];
  return { authed, total, done, pct, nextLesson };
}

/** Signature hero mastery ring — same MasteryPanel, fed from client progress. */
export function DeptMastery({
  lessons,
  accent,
  ink,
}: {
  lessons: NavLesson[];
  accent: string;
  ink: string;
}) {
  const { authed, total, done, pct } = useDeptProgress(lessons);
  return (
    <MasteryPanel
      pct={pct}
      doneCount={done}
      totalLessons={total}
      accent={accent}
      ink={ink}
      loggedIn={authed}
    />
  );
}

/** The journey stat strip — first three stats are static; the last is mastery. */
export function DeptStatStrip({
  lessons,
  totalModules,
  totalLessons,
  totalHours,
  accent,
  ink,
}: {
  lessons: NavLesson[];
  totalModules: number;
  totalLessons: number;
  totalHours: number;
  accent: string;
  ink: string;
}) {
  const { authed, pct } = useDeptProgress(lessons);
  const stats: {
    icon: typeof Layers;
    value: number;
    suffix?: string;
    label: string;
  }[] = [
    { icon: Layers, value: totalModules, label: totalModules === 1 ? "module" : "modules" },
    { icon: BookOpen, value: totalLessons, label: "lessons" },
    { icon: Clock, value: totalHours, suffix: "h", label: "of reading" },
    { icon: GraduationCap, value: pct, suffix: "%", label: authed ? "mastered" : "start free" },
  ];
  return (
    <RevealGroup className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {stats.map((s) => (
        <RevealItem key={s.label}>
          <Hover lift={-3} className="h-full">
            <div className="ac-card flex h-full items-center gap-3 p-4">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                  color: ink,
                }}
              >
                <s.icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="font-display text-2xl font-extrabold leading-none" style={{ color: ink }}>
                  <AnimatedCounter value={s.value} suffix={s.suffix} />
                </div>
                <div className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
                  {s.label}
                </div>
              </div>
            </div>
          </Hover>
        </RevealItem>
      ))}
    </RevealGroup>
  );
}

function ctaFor(deptSlug: string, lessons: NavLesson[], done: number, total: number, nextLesson: NavLesson | undefined) {
  const label = done === 0 ? "Start learning" : done === total ? "Review" : "Continue";
  const href = nextLesson
    ? `/guides/${deptSlug}/${nextLesson.moduleSlug}/${nextLesson.slug}`
    : `/guides/${deptSlug}`;
  return { label, href };
}

/** Hero / footer CTA row — label + destination track the reader's progress. */
export function DeptCtaRow({
  variant,
  deptSlug,
  lessons,
}: {
  variant: "hero" | "footer";
  deptSlug: string;
  lessons: NavLesson[];
}) {
  const { total, done, pct, nextLesson } = useDeptProgress(lessons);
  const { label, href } = ctaFor(deptSlug, lessons, done, total, nextLesson);
  const complete = total > 0 && pct === 100;
  return (
    <div
      className={
        variant === "hero"
          ? "mt-7 flex flex-wrap items-center gap-3"
          : "relative mt-7 flex flex-wrap items-center justify-center gap-3"
      }
    >
      <Link href={href} className="ac-btn text-sm">
        {label}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
      {complete ? (
        <Link href={`/certificate/${deptSlug}`} className="ac-btn-ghost text-sm">
          <Award className="h-4 w-4" aria-hidden /> Get certificate
        </Link>
      ) : variant === "footer" ? (
        <Link href="/guides" className="ac-btn-ghost text-sm">
          Explore other departments
        </Link>
      ) : null}
    </div>
  );
}

/** Footer heading copy shifts with progress (start / continue / mastered). */
export function DeptFooterHeading({
  deptName,
  lessons,
}: {
  deptName: string;
  lessons: NavLesson[];
}) {
  const { total, done, pct } = useDeptProgress(lessons);
  return (
    <h2 className="relative text-balance font-display text-3xl font-bold sm:text-4xl">
      {total > 0 && pct === 100
        ? "You've mastered this department."
        : done > 0
          ? "Pick up where you left off."
          : `Ready to own ${deptName}?`}
    </h2>
  );
}

/** Module accordion — checkmarks driven by the client progress set. */
export function DeptModules({
  departmentSlug,
  modules,
  accent,
}: {
  departmentSlug: string;
  modules: React.ComponentProps<typeof DepartmentModules>["modules"];
  accent: string;
}) {
  const { completed } = useMyProgress();
  const completedIds = React.useMemo(() => [...completed], [completed]);
  return (
    <DepartmentModules
      departmentSlug={departmentSlug}
      modules={modules}
      completedIds={completedIds}
      accent={accent}
    />
  );
}

/** Community authoring prompt — gates on the client-fetched auth state. */
export function DeptSuggest(
  props: Omit<React.ComponentProps<typeof SuggestNewContent>, "isLoggedIn">
) {
  const { authed } = useMyProgress();
  return <SuggestNewContent {...props} isLoggedIn={authed} />;
}
