"use client";

import * as React from "react";
import { LessonActions } from "@/components/lesson/lesson-actions";
import { LessonComplete } from "@/components/lesson/lesson-complete";
import { SuggestEdit } from "@/components/lesson/suggest-edit";
import { useMyProgress } from "@/components/progress/my-progress";
import { sendFunnelEvent } from "@/lib/funnel-client";
import { setLessonVerified } from "@/app/actions/verify-lesson";
import type { TocHeading } from "@/components/markdown";
import type { QuizQuestion } from "@/lib/types";
import { ReadingRail } from "./_reading-rail";

/**
 * Client islands for the (static/ISR) lesson page.
 *
 * The article body and all the page chrome are server-rendered for crawlers;
 * everything in here reads the signed-in reader's progress from the shared
 * store (hydrated after mount via /api/me/progress) and renders the per-user UI
 * the server used to render from the session. Before hydration, and for a
 * logged-out reader, the store is empty, so the output matches the logged-out
 * server render exactly and there is no mismatch to reconcile. Completion
 * toggles push back into the store, so the state chip, the margin rail, the
 * contents list and the mobile strip stay in lockstep, which is the end state a
 * router.refresh() used to produce.
 *
 * These wrappers hold no markup they do not have to. Anything with a shape
 * belongs to the component being wrapped.
 */
function useDeptCounts(lessonIds: string[]) {
  // `completed` already merges guest completions for a reader without an
  // account, so every surface below counts real work whether or not it has been
  // claimed yet. `guest` exists only to keep the copy honest about WHERE that
  // progress currently lives: this browser, not an account.
  const { authed, guest, completed } = useMyProgress();
  const total = lessonIds.length;
  let done = 0;
  for (const id of lessonIds) if (completed.has(id)) done++;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { authed, guest, done, total, pct };
}

/**
 * Records the `lesson_opened` funnel milestone.
 *
 * This is the step nothing in the database has ever been able to answer:
 * pageview data carries no user id, in the retired page_views table or in
 * Vercel, so "did this account ever open a lesson?" was
 * unanswerable and the funnel had to assume everyone who OPENED one also
 * finished it. That assumption is what hid the 45% who never complete anything.
 *
 * Fires immediately on mount, with no dwell threshold on purpose.
 * Non-activators leave a lesson page in a median of 11 seconds; gating the
 * event on, say, 15s of reading would quietly reclassify precisely those
 * readers as never having opened a lesson, and the drop we are hunting would
 * move into a step where it cannot be seen. "Opened" means opened.
 *
 * Renders nothing, so it is layout-neutral and safe anywhere in the tree, and
 * it branches no rendered output on anything client-only.
 */
export function LessonOpenBeacon() {
  React.useEffect(() => {
    sendFunnelEvent("lesson_opened");
  }, []);
  return null;
}

/**
 * The "state" value in the lesson's fact row: has this reader read it.
 *
 * A chip rather than another figure, because it is the one entry in that row
 * that is about the reader instead of about the lesson. It fills in ballpoint
 * when the lesson is done, and the WORD changes with it, so the state is never
 * carried by colour alone.
 */
export function LessonStatusChip({ lessonId }: { lessonId: string }) {
  const { completed } = useMyProgress();
  const done = completed.has(lessonId);
  return (
    <span className="nb-tag" {...(done ? { "data-on": "" } : {})}>
      {done ? "read" : "not yet"}
    </span>
  );
}

/** Finish-the-lesson + keep-it controls, wired to the client progress store. */
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
  const { loaded, authed, completed, bookmarked, setCompleted, setBookmarked } =
    useMyProgress();
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

/** The writing down the sheet's left margin: contents, department, the week. */
export function ReadingRailIsland({
  deptName,
  deptSlug,
  headings,
  lessonIds,
  lessonPath,
}: {
  deptName: string;
  deptSlug: string;
  headings: TocHeading[];
  lessonIds: string[];
  lessonPath: string;
}) {
  const { authed, guest, done, total, pct } = useDeptCounts(lessonIds);
  // Server-computed (see /api/me/progress), the rail never derives a day
  // boundary itself, it just draws the object it was handed.
  const { rhythm } = useMyProgress();
  return (
    <ReadingRail
      deptName={deptName}
      deptSlug={deptSlug}
      headings={headings}
      authed={authed}
      guest={guest}
      pct={pct}
      doneInDept={done}
      totalInDept={total}
      lessonPath={lessonPath}
      rhythm={rhythm}
    />
  );
}

/** The answer sheet: quiz gate, and the sign-off once it is cleared. */
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
  const { loaded, authed, completed, username, subscribed, setCompleted } =
    useMyProgress();
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
      // Lifetime completions, so the sign-off can count toward the five-lesson
      // threshold that actually predicts retention. It already includes this
      // lesson by the time the completed panel renders: persist() pushes the
      // completion into this store in the same batch that flips `completed`.
      completedCount={completed.size}
      ready={loaded}
      onCompletedChange={(done) => setCompleted(lessonId, done)}
    />
  );
}

/**
 * What the margin carries, for a screen with no margin.
 *
 * Under 1024px the rail is gone, so its two figures are re-set as a ruled strip
 * at the foot of the article: an opening ink rule, the mono caption, the
 * percentage as a stamped figure, the meter, and the count printed beside it.
 * Deliberately NOT a card. The completion panel above it is the only card in
 * this part of the page, and a second one here would compete with the one
 * control that records that the lesson was read.
 *
 * Shown to signed-in readers, and to guests who have finished something: a
 * reader who has done four lessons without an account should be able to SEE the
 * four, otherwise the ask to sign up is asking them to protect a number they
 * have never been shown.
 */
export function MobileProgressCard({
  deptName,
  lessonIds,
}: {
  deptName: string;
  lessonIds: string[];
}) {
  const { authed, guest, done, total, pct } = useDeptCounts(lessonIds);
  if (!authed && !(guest && done > 0)) return null;
  return (
    <section
      aria-label={`Your progress through ${deptName}`}
      className="nb-rule mt-[clamp(2rem,4vw,3rem)] pt-4 lg:hidden"
    >
      <p className="nb-slug">
        {authed ? "your progress" : "your progress / this browser"}
      </p>
      <div className="mt-2 flex items-baseline gap-2.5">
        <span className="nb-count text-[2rem]">{pct}%</span>
        <span className="min-w-0 text-[0.95rem] font-bold leading-tight">
          through {deptName}
        </span>
      </div>
      <div className="nb-meter mt-3">
        <span className="nb-meter-bar" style={{ width: `${pct}%` }} />
      </div>
      <p className="nb-slug mt-2">
        {done} of {total} lessons read
      </p>
    </section>
  );
}

/**
 * The mark beside a lesson in the folded-away contents list.
 *
 * A filled ballpoint square when it is read, a drawn empty one when it is not.
 * The difference is shape and fill, not hue, so it survives a greyscale
 * photocopy; the sr-only label carries it for a screen reader.
 */
export function LessonStatusDot({ lessonId }: { lessonId: string }) {
  const { completed } = useMyProgress();
  const done = completed.has(lessonId);
  return (
    <>
      <span
        aria-hidden="true"
        className={
          done
            ? "size-2.5 shrink-0 border-2 border-blue bg-blue"
            : "size-2.5 shrink-0 border border-dashed border-graphite"
        }
      />
      <span className="sr-only">{done ? "Read:" : "Not read yet:"}</span>
    </>
  );
}

/**
 * The admin-only verify control, in the same place the verified mark goes.
 *
 * Lives HERE rather than in its own file for a reason found the hard way: a
 * standalone "use client" component imported straight into this page renders on
 * the server and then never hydrates, so its effect never runs and the button
 * never appears. The islands in this file do hydrate, so the control is one of
 * them.
 *
 * The verified MARK itself stays server-rendered on the page, so a reader and a
 * crawler get it in the HTML. Only the button is client-side, and only an admin
 * ever sees it.
 */
export function VerifyLessonIsland({
  lessonId,
  initialVerifiedAt,
}: {
  lessonId: string;
  initialVerifiedAt: string | null;
}) {
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [verifiedAt, setVerifiedAt] = React.useState(initialVerifiedAt);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    let live = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live && d?.isAdmin) setIsAdmin(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!isAdmin) return null;
  const verified = Boolean(verifiedAt);

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={pending}
        aria-pressed={verified}
        className={verified ? "nb-btn-ghost" : "nb-btn"}
        onClick={() => {
          setError(null);
          const next = !verified;
          startTransition(async () => {
            const res = await setLessonVerified(lessonId, next);
            if (!res.ok) setError(res.error);
            else setVerifiedAt(res.verifiedAt);
          });
        }}
      >
        {pending
          ? "Saving"
          : verified
            ? "Remove verified mark"
            : "Mark this lesson verified"}
      </button>
      {/* Said next to the button, because the mark is a public claim and the
          person clicking it should be reminded that it is one. */}
      <p className="nb-slug mt-2 text-graphite">
        {verified
          ? "readers see a verified mark on this lesson"
          : "admin only, this puts a public verified mark on the lesson"}
      </p>
      {error ? (
        <p role="alert" className="mt-1 text-[0.9rem] text-blue">
          Could not save: {error}
        </p>
      ) : null}
    </div>
  );
}

/** "Suggest an edit", gates on the client-fetched auth state. */
export function SuggestEditIsland(
  props: Omit<React.ComponentProps<typeof SuggestEdit>, "isLoggedIn">
) {
  const { authed } = useMyProgress();
  return <SuggestEdit {...props} isLoggedIn={authed} />;
}
