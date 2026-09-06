"use client";

import * as React from "react";
import Link from "next/link";
import { DepartmentModules } from "@/components/guides/department-modules";
import { SuggestNewContent } from "@/components/guides/suggest-new-content";
import { useMyProgress } from "@/components/progress/my-progress";
import { NextUnlock } from "@/components/progress/next-unlock";
import { ResumeCard } from "@/components/progress/resume-card";
import { WeekGoalCard } from "@/components/progress/week-goal-card";
import { MasteryPanel } from "./_mastery-panel";

/**
 * Client islands for the (static/ISR) department page. Each one reads the
 * reader's progress from the shared store, hydrated after mount from
 * /api/me/progress, and renders what the server used to render from the
 * session. Before hydration, and for a visitor with nothing tracked, the store
 * is empty, so these match the static HTML exactly.
 */
export type NavLesson = {
  id: string;
  moduleSlug: string;
  slug: string;
  /** Lesson + module titles, so a resume affordance can name its destination. */
  title: string;
  moduleTitle: string;
};

/**
 * Ballpoint blue, for the three progress components this page borrows from the
 * shared set. They still take a colour, and departments do not have one: in
 * this system a department is identified by its name and its mono slug, and
 * blue is the site's only accent. Passing it explicitly keeps their own
 * defaults, which predate the notebook, off this page.
 */
const BLUE = "#1B36C8";

function useDeptProgress(lessons: NavLesson[]) {
  // For a reader without an account `completed` holds this browser's guest
  // completions, so the meter, the percentage and the Continue target are as
  // real for them as for a signed-in user. `tracked` is "there is progress to
  // show", regardless of which of the two it came from.
  const { authed, guest, completed } = useMyProgress();
  const total = lessons.length;
  let done = 0;
  for (const l of lessons) if (completed.has(l.id)) done++;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const nextLesson = lessons.find((l) => !completed.has(l.id)) ?? lessons[0];
  return { authed, guest, tracked: authed || guest, total, done, pct, nextLesson };
}

/**
 * THE RETENTION BLOCK: the five-lessons-a-week card, the resume affordance and
 * the nearest badge, stacked above the module list.
 *
 * WHY HERE, AND NOT THE DASHBOARD. A department page is the only surface other
 * than /dashboard whose entire job is "where am I in this", and unlike the
 * dashboard it is where a returning learner actually arrives: 63% of first
 * sessions are a single pageview, the median visitor sees one page, and people
 * come back through search, a bookmark or /guides, not through a logged-in home
 * screen. Putting the week goal only on /dashboard puts it behind a navigation
 * step the measured behaviour says most people never take.
 *
 * WHY ABOVE THE MODULE LIST. The stack answers, in order: where am I this week,
 * what do I press now, what is next to earn. The module log below is a chooser,
 * and a learner who came back to continue should not have to shop first.
 *
 * HYDRATION. `rhythm` is null on the server render (this page is static/ISR, so
 * the same HTML goes to every visitor and every crawler) and null on the first
 * client render, because that is the store's initial state. It only becomes an
 * object after /api/me/progress resolves inside an effect, so the first paint is
 * identical on both sides by construction. Nothing in this subtree reads a
 * clock: every day key, weekday label and `isToday` flag was decided by the
 * SERVER's Date.now() inside the route handler.
 *
 * SIGNED OUT / GUEST. `rhythm` stays null and this renders nothing at all. A
 * reader with no account is not shown an empty slot where their week would go.
 */
export function DeptWeekGoal({
  deptSlug,
  deptName,
  lessons,
}: {
  deptSlug: string;
  deptName: string;
  lessons: NavLesson[];
}) {
  const { rhythm, nextUnlock } = useMyProgress();
  const { total, done, nextLesson } = useDeptProgress(lessons);

  // Signed out, guest, or the fetch has not landed yet.
  if (!rhythm) return null;

  const complete = total > 0 && done >= total;
  const href = nextLesson
    ? `/guides/${deptSlug}/${nextLesson.moduleSlug}/${nextLesson.slug}`
    : `/guides/${deptSlug}`;

  return (
    <div className="mb-[clamp(2rem,4vw,2.8rem)] flex flex-col gap-4">
      <WeekGoalCard rhythm={rhythm} accent={BLUE} ink={BLUE} />

      {/* Hidden once the department is finished: "pick up where you left off"
          pointing back at lesson one would be a lie, and the closing band
          already offers the certificate. */}
      {!complete && nextLesson && (
        <ResumeCard
          href={href}
          lessonTitle={nextLesson.title}
          deptName={deptName}
          deptSlug={deptSlug}
          moduleTitle={nextLesson.moduleTitle}
          fresh={done === 0}
        />
      )}

      {nextUnlock && (
        <NextUnlock
          name={nextUnlock.name}
          description={nextUnlock.description}
          icon={nextUnlock.icon}
          progress={nextUnlock.progress}
          href={complete ? undefined : href}
          accent={BLUE}
        />
      )}
    </div>
  );
}

/**
 * The fourth cell of the title block: how far into this department the reader
 * is. The three cells beside it are catalogue facts and stay on the server;
 * only this one has to know who is reading.
 */
export function DeptMastery({ lessons }: { lessons: NavLesson[] }) {
  const { tracked, total, done, pct } = useDeptProgress(lessons);
  return (
    <MasteryPanel
      pct={pct}
      doneCount={done}
      totalLessons={total}
      tracked={tracked}
    />
  );
}

function ctaFor(deptSlug: string, done: number, total: number, nextLesson: NavLesson | undefined) {
  const label = done === 0 ? "Start learning" : done === total ? "Review" : "Continue";
  const href = nextLesson
    ? `/guides/${deptSlug}/${nextLesson.moduleSlug}/${nextLesson.slug}`
    : `/guides/${deptSlug}`;
  return { label, href };
}

/**
 * The masthead and closing action rows. The label and the destination both
 * track the reader's progress, so the button never says "Start learning" to
 * someone who is forty lessons in.
 *
 * `variant` decides the second link only. Beside the masthead there is nowhere
 * else worth sending someone; at the foot of the page there is.
 */
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
  const { label, href } = ctaFor(deptSlug, done, total, nextLesson);
  const complete = total > 0 && pct === 100;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link href={href} className="nb-btn">
        {label}
      </Link>
      {complete ? (
        <Link href={`/certificate/${deptSlug}`} className="nb-btn-ghost">
          Get the certificate
        </Link>
      ) : variant === "footer" ? (
        <Link href="/guides" className="nb-btn-ghost">
          Back to all departments
        </Link>
      ) : null}
    </div>
  );
}

/** The closing heading, which shifts with progress: start, resume, or finished. */
export function DeptFooterHeading({
  deptName,
  lessons,
}: {
  deptName: string;
  lessons: NavLesson[];
}) {
  const { total, done, pct } = useDeptProgress(lessons);
  return (
    <h2 className="max-w-[20ch] text-[clamp(1.6rem,1.1rem+1.6vw,2.4rem)]">
      {total > 0 && pct === 100
        ? "You have finished this department."
        : done > 0
          ? "Pick up where you left off."
          : `Ready to take on ${deptName}?`}
    </h2>
  );
}

/** The module log. Its ticks come from the client progress set. */
export function DeptModules({
  departmentSlug,
  modules,
}: {
  departmentSlug: string;
  modules: React.ComponentProps<typeof DepartmentModules>["modules"];
}) {
  const { completed } = useMyProgress();
  const completedIds = React.useMemo(() => [...completed], [completed]);
  return (
    <DepartmentModules
      departmentSlug={departmentSlug}
      modules={modules}
      completedIds={completedIds}
    />
  );
}

/** The authoring prompt, gated on the client-fetched auth state. */
export function DeptSuggest(
  props: Omit<React.ComponentProps<typeof SuggestNewContent>, "isLoggedIn">
) {
  const { authed } = useMyProgress();
  return <SuggestNewContent {...props} isLoggedIn={authed} />;
}
