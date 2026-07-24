"use client";

import * as React from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Reveal } from "@/components/motion/primitives";
import { LessonActions } from "@/components/lesson/lesson-actions";
import { LessonComplete } from "@/components/lesson/lesson-complete";
import { SuggestEdit } from "@/components/lesson/suggest-edit";
import { useMyProgress } from "@/components/progress/my-progress";
import type { TocHeading } from "@/components/markdown";
import type { QuizQuestion } from "@/lib/types";
import { ReadingRail } from "./_reading-rail";

/**
 * Client islands for the (now static/ISR) lesson page. The article body and
 * chrome are server-rendered for crawlers; these read the signed-in user's
 * progress from the shared store (hydrated after mount via /api/me/progress)
 * and render the exact per-user UI the server used to render from the session.
 * Before hydration / logged-out, the store is empty so the output matches
 * today's logged-out server render. Completion toggles push back into the store
 * so the chip, reading rail, contents list, and mobile card stay in lockstep —
 * the same end state a router.refresh() produced before.
 */
function useDeptCounts(lessonIds: string[]) {
  const { authed, completed } = useMyProgress();
  const total = lessonIds.length;
  let done = 0;
  for (const id of lessonIds) if (completed.has(id)) done++;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { authed, done, total, pct };
}

/** "Completed" / "In progress" status chip in the lesson hero. */
export function LessonStatusChip({
  lessonId,
  ink,
  accentColor,
}: {
  lessonId: string;
  ink: string;
  accentColor: string;
}) {
  const { completed } = useMyProgress();
  const isCompleted = completed.has(lessonId);
  return (
    <span
      className="ac-chip inline-flex items-center gap-1.5 text-xs font-semibold"
      style={{ color: isCompleted ? "var(--success)" : ink }}
    >
      {isCompleted ? (
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <span
          className="inline-block h-2 w-2 animate-pulse rounded-full"
          style={{ background: accentColor }}
          aria-hidden
        />
      )}
      {isCompleted ? "Completed" : "In progress"}
    </span>
  );
}

/** Mark-complete + bookmark buttons, wired to the client progress store. */
export function LessonActionsIsland({
  lessonId,
  deptSlug,
  lessonPath,
  quizRequired,
}: {
  lessonId: string;
  deptSlug: string;
  lessonPath: string;
  quizRequired: boolean;
}) {
  const { loaded, authed, completed, bookmarked, setCompleted, setBookmarked } = useMyProgress();
  return (
    <LessonActions
      lessonId={lessonId}
      deptSlug={deptSlug}
      lessonPath={lessonPath}
      authed={authed}
      initialCompleted={completed.has(lessonId)}
      initialBookmarked={bookmarked.has(lessonId)}
      quizRequired={quizRequired}
      ready={loaded}
      onCompletedChange={(done) => setCompleted(lessonId, done)}
      onBookmarkedChange={(saved) => setBookmarked(lessonId, saved)}
    />
  );
}

/** The "create a free account to track progress" note — shown when logged out. */
export function SignupPrompt({ lessonPath, children }: { lessonPath: string; children: React.ReactNode }) {
  const { authed } = useMyProgress();
  if (authed) return null;
  return <>{children}</>;
  // `lessonPath` is embedded in `children` by the server so the link is present
  // in static HTML; this island only decides whether to keep it after hydration.
}

/** Sticky live contents + department mastery rail (desktop). */
export function ReadingRailIsland({
  deptName,
  deptIcon,
  accent,
  headings,
  lessonIds,
  lessonPath,
}: {
  deptName: string;
  deptIcon: string;
  accent: string;
  headings: TocHeading[];
  lessonIds: string[];
  lessonPath: string;
}) {
  const { authed, done, total, pct } = useDeptCounts(lessonIds);
  return (
    <ReadingRail
      deptName={deptName}
      deptIcon={deptIcon}
      accent={accent}
      headings={headings}
      authed={authed}
      pct={pct}
      doneInDept={done}
      totalInDept={total}
      lessonPath={lessonPath}
    />
  );
}

/** Completion card + mandatory quiz gate, wired to the client progress store. */
export function LessonCompleteIsland({
  lessonId,
  deptSlug,
  lessonPath,
  quiz,
  nextHref,
}: {
  lessonId: string;
  deptSlug: string;
  lessonPath: string;
  quiz: QuizQuestion[];
  nextHref?: string | null;
}) {
  const { loaded, authed, completed, username, subscribed, setCompleted } = useMyProgress();
  return (
    <LessonComplete
      lessonId={lessonId}
      deptSlug={deptSlug}
      lessonPath={lessonPath}
      authed={authed}
      initialCompleted={completed.has(lessonId)}
      quiz={quiz}
      nextHref={nextHref}
      referrerUsername={username}
      alreadySubscribed={subscribed}
      ready={loaded}
      onCompletedChange={(done) => setCompleted(lessonId, done)}
    />
  );
}

/** Mobile-only department progress card — shown to signed-in readers. */
export function MobileProgressCard({
  deptName,
  deptGradient,
  lessonIds,
}: {
  deptName: string;
  deptGradient: string;
  lessonIds: string[];
}) {
  const { authed, done, total, pct } = useDeptCounts(lessonIds);
  if (!authed) return null;
  return (
    <Reveal>
      <div className="mt-10 lg:hidden">
        <div className="ac-card p-5">
          <div className="ac-eyebrow">Your progress</div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold tabular-nums text-foreground">{pct}%</span>
            <span className="text-sm text-muted-foreground">through {deptName}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, backgroundImage: deptGradient }}
            />
          </div>
          <div className="mt-2 text-xs tabular-nums text-muted-foreground">
            {done} / {total} lessons complete
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/** Completion dot (check / circle) for a lesson row in the "all lessons" list. */
export function LessonStatusDot({ lessonId }: { lessonId: string }) {
  const { completed } = useMyProgress();
  const done = completed.has(lessonId);
  return (
    <>
      {done ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <span className="sr-only">{done ? "Completed:" : "Not started:"}</span>
    </>
  );
}

/** "Suggest an edit" affordance — gates on the client-fetched auth state. */
export function SuggestEditIsland(
  props: Omit<React.ComponentProps<typeof SuggestEdit>, "isLoggedIn">
) {
  const { authed } = useMyProgress();
  return <SuggestEdit {...props} isLoggedIn={authed} />;
}
