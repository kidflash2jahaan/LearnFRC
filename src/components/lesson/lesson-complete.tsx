"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { setLessonComplete } from "@/app/actions/progress";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/lesson/confetti";
import { scrollToElement } from "@/components/perf-mode";
import {
  LessonMilestoneShare,
  rememberMilestone,
  useLessonMilestone,
  type LessonMilestone,
} from "@/components/lesson/lesson-milestone-share";
import { LessonNewsletter } from "@/components/lesson/lesson-newsletter";
import { LessonStickyCta } from "@/components/lesson/lesson-sticky-cta";
import {
  readGuestLessons,
  saveGuestLesson,
  subscribeGuestProgress,
} from "@/lib/guest-progress";
import { sendFunnelEvent } from "@/lib/funnel-client";
import { cn } from "@/lib/utils";
import type { QuizQuestion } from "@/lib/types";

/**
 * The answer sheet stapled to the back of the lesson, and the sign-off it turns
 * into once it is cleared.
 *
 * HOW IT IS DRAWN. This is the one card in the running text, because it is the
 * one thing on the page you are meant to work on rather than read. The two
 * states are told apart by the top of the card and not by a colour swap: unmarked
 * it opens on a mono heading on card stock, signed off it opens on a solid
 * ballpoint band, the way a marked worksheet comes back with a stamp across the
 * top of it. Every answer state is carried by two signals at once, a fill and a
 * word, so a right answer, a banked answer and a wrong one are still three
 * different things on a greyscale photocopy.
 *
 * Guest (no-account) progress lives in src/lib/guest-progress.ts: localStorage
 * for the instant local copy, plus a server row keyed to the anonymous visitor
 * id (lf_vid), which is the copy that migrates into a real account at signup.
 * Writes that do not reach the server are queued and retried there, so "sign up
 * and keep your progress" stays true.
 */

/**
 * The measured activation threshold.
 *
 * Retention against "lessons completed in the first 7 days" is a step function,
 * not a slope: 0 lessons -> 6% still active at d21, 1 -> 4%, 2 -> 8%, 3-4 -> 5%,
 * then 5-9 -> 35%. Completing one to four lessons is worth nothing over
 * completing none; everything happens at five. Five is also already a real
 * reward in this product (the `five-lessons` / "Warmed Up" achievement), so the
 * sign-off counts toward it out loud instead of celebrating a first lesson that
 * on its own predicts nothing.
 */
const MOMENTUM_TARGET = 5;

/**
 * A learner who has missed the SAME question twice is stuck, not being tested.
 * From the second miss onward that question's explanation is shown so the retry
 * can teach instead of punish. Every one of the 1,225 questions in the catalogue
 * ships with an `explanation` and, before this, not one was ever rendered
 * anywhere in the product.
 *
 * Note what this still does NOT do: it never marks which OPTION is correct. The
 * first retry is unaided and every retry is still a real answer, so the quality
 * bar the gate exists to enforce is intact.
 */
const EXPLAIN_AFTER_MISSES = 2;

export function LessonComplete({
  lessonId,
  deptSlug,
  lessonPath,
  authed,
  initialCompleted,
  quiz,
  nextHref,
  referrerUsername,
  alreadySubscribed = false,
  completedCount = 0,
  ready = true,
  onCompletedChange,
}: {
  lessonId: string;
  deptSlug: string;
  lessonPath: string;
  authed: boolean;
  initialCompleted: boolean;
  quiz: QuizQuestion[];
  nextHref?: string | null;
  referrerUsername?: string | null;
  alreadySubscribed?: boolean;
  /** Lifetime lessons this signed-in reader has completed, including this one
      once it lands. Drives the "get to five" meter; ignored for guests. */
  completedCount?: number;
  // False until the client progress store has loaded (/api/me/progress). While
  // false the true auth state is unknown, so completion is disabled and persist
  // no-ops, critical, so a signed-in user's completion is never written to the
  // guest bucket (localStorage / /api/guest-progress) during the fetch window.
  ready?: boolean;
  // Keeps the static lesson page's client progress store in sync with an authed
  // completion made here (chip, rail, contents list, mobile strip).
  onCompletedChange?: (completed: boolean) => void;
}) {
  const [completed, setCompleted] = React.useState(initialCompleted);
  const [pending, startTransition] = React.useTransition();
  const [burst, setBurst] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<number, number>>({});
  const [graded, setGraded] = React.useState(false);
  // Questions already answered correctly in an earlier graded attempt. They are
  // banked: a retry never asks them again and never clears them.
  const [locked, setLocked] = React.useState<Record<number, boolean>>({});
  // How many times each question has been answered wrongly, so a reader who is
  // genuinely stuck gets the explanation instead of another blind guess.
  const [misses, setMisses] = React.useState<Record<number, number>>({});
  const [attempts, setAttempts] = React.useState(0);
  // True only for a pass that happened in THIS session, which gates the recap so
  // revisiting an already-finished lesson never shows it.
  const [justPassed, setJustPassed] = React.useState(false);
  // The block itself. Doubles as the scroll target and as the element
  // <LessonStickyCta/> watches to know when it would be redundant.
  const panelRef = React.useRef<HTMLDivElement>(null);
  const prevCompleted = React.useRef(initialCompleted);

  // Referral ask, spent only on a one-time milestone (first lesson ever, or
  // reaching 10 lifetime lessons), see lesson-milestone-share.tsx for why it is
  // NOT shown on every completion. Null except in the render immediately
  // following a completion the reader just made in this session, so revisiting
  // an already-complete lesson never shows it.
  const resolveMilestone = useLessonMilestone(lessonId);
  const [milestone, setMilestone] = React.useState<LessonMilestone | null>(null);

  React.useEffect(() => setCompleted(initialCompleted), [initialCompleted]);

  // When a quiz is passed the tall answer sheet collapses into a short panel,
  // which makes the browser clamp the scroll position and jump. Instead, gently
  // bring the result into view so completion lands somewhere predictable.
  React.useEffect(() => {
    if (completed && !prevCompleted.current && quiz && quiz.length > 0) {
      scrollToElement(panelRef.current, { block: "nearest" });
    }
    prevCompleted.current = completed;
  }, [completed, quiz]);

  const hasQuiz = quiz && quiz.length > 0;
  const allAnswered = hasQuiz && quiz.every((_, i) => answers[i] !== undefined);
  const correctCount = hasQuiz
    ? quiz.filter((q, i) => answers[i] === q.answer).length
    : 0;
  const passed = hasQuiz && correctCount === quiz.length;
  const answeredCount = hasQuiz
    ? quiz.filter((_, i) => answers[i] !== undefined).length
    : 0;
  const lockedCount = hasQuiz ? quiz.filter((_, i) => locked[i]).length : 0;
  const remaining = hasQuiz ? quiz.length - lockedCount : 0;

  // Guests: reflect what this browser has already finished, and keep the running
  // total live so the sign-off can say what is at stake. Read in an effect, never
  // during render, localStorage during render would break hydration.
  // `guestDone` stays 0 for signed-in readers.
  const [guestDone, setGuestDone] = React.useState(0);
  React.useEffect(() => {
    if (!ready || authed) return;
    const read = () => {
      const set = readGuestLessons();
      setGuestDone(set.size);
      if (set.has(lessonId)) setCompleted(true);
    };
    read();
    return subscribeGuestProgress(read);
  }, [ready, authed, lessonId]);

  const persist = (value: boolean) => {
    // Auth state not yet known (store still loading), no-op, so a signed-in
    // user's completion is never misrouted into the guest bucket below.
    if (!ready) return;
    // Guests learn without an account: saved in this browser and recorded
    // against the anonymous visitor id server-side, which is the copy that
    // migrates into a real account at signup. No sign-up required to earn it.
    if (!authed) {
      setCompleted(value);
      if (value) setBurst((b) => b + 1);
      // The quiz answers travel with the write: /api/guest-progress re-grades
      // them server-side, exactly as setLessonComplete does for signed-in
      // readers. Guests clear the same bar, so their migrated progress is real.
      const answerArr = value && hasQuiz ? quiz.map((_, i) => answers[i]) : undefined;
      void saveGuestLesson(lessonId, value, answerArr).then((saved) => {
        if (!value) return;
        if (saved) {
          // Funnel: the guest half of activation. A logged-out reader has no
          // profiles row and no lesson_progress row, so funnel_summary() cannot
          // derive ANY of their steps, without these two calls the anonymous
          // column shows lesson opens and quiz attempts that never once become a
          // completion, which is not what happens. Gated on `saved` so the
          // milestone follows the server-verified write (the same quiz gate
          // setLessonComplete enforces), never an optimistic local one.
          sendFunnelEvent("lesson_completed");
          // Read AFTER the save: saveGuestLesson writes localStorage
          // synchronously before it posts, so this set already contains the
          // lesson that just landed.
          if (readGuestLessons().size >= 2)
            sendFunnelEvent("second_lesson_completed");
        }
        toast.success(
          saved
            ? "Lesson complete, saved in this browser."
            : "Lesson complete, saved in this browser. We'll finish syncing it next time you're online."
        );
      });
      return;
    }

    // Resolved BEFORE the store is told about this completion (the resolver
    // counts accordingly) and set in the same batch as `completed`, so the
    // milestone card is present in the very first render of the sign-off rather
    // than popping in and pushing the buttons down.
    const earned = value ? resolveMilestone() : null;
    setMilestone(earned);
    setCompleted(value);
    onCompletedChange?.(value);
    if (value) setBurst((b) => b + 1);
    // Send the quiz answers so the server can verify the pass (the gate is
    // enforced server-side, not just here).
    const answerArr =
      value && hasQuiz ? quiz.map((_, i) => answers[i]) : undefined;
    startTransition(async () => {
      const r = await setLessonComplete(lessonId, deptSlug, value, answerArr);
      if (r?.error) {
        setCompleted(!value);
        onCompletedChange?.(!value);
        // The completion did not stick, so do not spend the milestone on it.
        setMilestone(null);
        toast.error(r.error);
      } else {
        if (value) {
          // Shown once, ever: spend the rung as soon as the completion is real,
          // whether or not they act on it. It cannot return on reload.
          if (earned) rememberMilestone(earned.key);
          toast.success("Lesson complete. +10 XP");
        }
      }
    });
  };

  const onSubmitQuiz = () => {
    // Auth state not yet known, ignore the submit until the store loads.
    if (!ready) return;

    // Funnel: `quiz_attempted`. Recorded on the ATTEMPT, before grading, because
    // the question the funnel has to answer is how many readers reach the gate
    // at all, not how many clear it. Quiz grading is pure client state, so this
    // call site is the only place in the product where the step is observable;
    // without it the panel infers quiz attempts from completions and therefore
    // reports that 100% of the people who try a quiz pass it. Fire-and-forget:
    // it cannot throw, and nothing below waits on it.
    sendFunnelEvent("quiz_attempted");

    // Bank every question that is right and count a miss against the rest, so
    // the retry can be narrowed to what the reader actually got wrong.
    const nextLocked = { ...locked };
    const nextMisses = { ...misses };
    quiz.forEach((q, i) => {
      if (answers[i] === q.answer) nextLocked[i] = true;
      else nextMisses[i] = (nextMisses[i] ?? 0) + 1;
    });
    setLocked(nextLocked);
    setMisses(nextMisses);
    setAttempts((n) => n + 1);
    setGraded(true);
    if (correctCount === quiz.length) {
      setJustPassed(true);
      persist(true);
    }
  };

  /**
   * Retry WITHOUT losing ground. This used to be `setAnswers({})`, which wiped
   * every answer including the ones already correct: a reader who scored 2/3 had
   * to re-answer all three, blind, and a second slip cost them the two they had
   * right. Now only the outstanding questions are cleared, so failing costs
   * exactly the questions you failed and nothing else.
   */
  const retry = () => {
    setGraded(false);
    setAnswers((prev) => {
      const kept: Record<number, number> = {};
      for (const [key, value] of Object.entries(prev)) {
        if (locked[Number(key)]) kept[Number(key)] = value;
      }
      return kept;
    });
  };

  /**
   * Marking a lesson incomplete has to hand back a usable quiz. It previously
   * left `graded` true with every answer correct, a state in which neither the
   * submit button (needs !graded) nor the retry button (needs a failed grade)
   * renders, stranding the reader with no way to complete the lesson again.
   */
  const markIncomplete = () => {
    setGraded(false);
    setAnswers({});
    setLocked({});
    setMisses({});
    setAttempts(0);
    setJustPassed(false);
    persist(false);
  };

  // Fixed-position, so where the lesson page mounts this component in the DOM
  // cannot bury the only control that records a completion.
  const stickyCta = (
    <LessonStickyCta
      mode={completed ? "next" : "quiz"}
      quizCount={hasQuiz ? quiz.length : 0}
      nextHref={nextHref}
      anchorRef={panelRef}
    />
  );

  // ---- Signed off ----
  if (completed) {
    // The momentum meter is honest or absent: it needs a real signed-in count,
    // and it retires the moment the reader is past the threshold it tracks.
    const showMomentum =
      authed && ready && completedCount >= 1 && completedCount <= MOMENTUM_TARGET;
    const toGo = MOMENTUM_TARGET - completedCount;

    return (
      <>
        {/* `id="lesson-quiz"` is the stable anchor for this lesson's completion
            block in BOTH states, this card and the answer sheet below. Exactly
            one of the two is ever mounted, so the id is never duplicated, and
            every link that points a reader at "the finish" keeps working. */}
        <div
          id="lesson-quiz"
          ref={panelRef}
          className="nb-box relative mt-[clamp(2rem,4vw,3rem)] scroll-mt-24 overflow-hidden"
        >
          <Confetti trigger={burst} />

          {/* The stamp across the top of a marked worksheet. It is the only
              inverted strip in the article column, and nothing interactive
              lives on it, so no control ever has to fight the blue. */}
          <p className="nb-slab border-t-0 px-[clamp(1rem,2.4vw,1.6rem)] py-3 font-mono text-[0.8rem] font-bold tracking-[0.06em]">
            lesson signed off
          </p>

          <div className="p-[clamp(1.1rem,2.6vw,1.9rem)]">
            <h2 className="text-[clamp(1.3rem,1.1rem+0.8vw,1.75rem)]">
              That one is done
            </h2>
            <p className="mt-2 max-w-[52ch] text-[0.98rem] leading-relaxed text-graphite">
              {authed
                ? "Your progress is saved to your account."
                : guestDone > 1
                  ? `That's ${guestDone} lessons finished in this browser.`
                  : "Saved in this browser. No account needed."}
            </p>

            {/* Momentum toward the number that actually predicts retention. The
                product used to celebrate lesson 1, which the data says is worth
                nothing on its own: the cliff is between four lessons and five.
                This names the target, shows how close it is, and points at a
                badge that genuinely exists. */}
            {showMomentum && (
              <div className="nb-hair mt-5 pt-4">
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  {Array.from({ length: MOMENTUM_TARGET }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-2.5",
                        i < completedCount
                          ? "w-9 border-2 border-blue bg-blue"
                          : "w-6 border border-dashed border-rule"
                      )}
                    />
                  ))}
                </div>
                <p className="mt-2.5 text-[0.95rem] leading-snug">
                  <strong className="font-mono tabular-nums">
                    {completedCount} of {MOMENTUM_TARGET}
                  </strong>{" "}
                  {toGo > 0 ? (
                    <span className="text-graphite">
                      lessons. {toGo} more and the Warmed Up badge is yours.
                    </span>
                  ) : (
                    <span className="text-graphite">
                      lessons. Warmed Up unlocked.
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* The ask is sized to what they have actually built. One lesson
                gets a single quiet line; from the second onward it names the
                number and the XP, because by then there is something concrete on
                the table. It is never shown on arrival: reaching this card means
                the quiz is passed. */}
            {!authed &&
              (guestDone > 1 ? (
                <div className="nb-note mt-5">
                  {/* Framed around what an account GAINS, not what the reader
                      stands to lose. The storage fact stays, it is the one thing
                      someone needs in order to judge the offer; what went is the
                      threat built on top of it ("clear your history and they're
                      gone") and the verb "Keep", which presupposes the loss. The
                      sibling ask in lesson-signup-hook.tsx renders lower on this
                      same page and was rewritten the same way, so keep the two
                      in step or a reader meets both framings within one screen. */}
                  <p className="nb-slug">saved in this browser</p>
                  <p className="mt-1.5 text-[0.95rem] leading-relaxed">
                    <strong>{guestDone} lessons done.</strong> A free account
                    gives them a permanent home, worth at least +{guestDone * 10}{" "}
                    XP with the dates you actually earned them, and your progress
                    follows you onto any device from then on.
                  </p>
                  <Button asChild variant="brand" size="sm" className="mt-3.5">
                    <Link
                      href={`/signup?next=${encodeURIComponent(lessonPath)}&ref=lesson-complete`}
                    >
                      Claim my {guestDone} lessons
                    </Link>
                  </Button>
                </div>
              ) : (
                <p className="mt-3 text-[0.95rem] leading-relaxed text-graphite">
                  Keep going, there is nothing to sign up for.{" "}
                  <Link
                    href={`/signup?next=${encodeURIComponent(lessonPath)}&ref=lesson-complete`}
                    className="nb-link"
                  >
                    Or make it permanent
                  </Link>
                  .
                </p>
              ))}

            {/* ONE unmissable next action. Continuing used to share a wrapping
                flex row with "Mark as incomplete", which gave a destructive
                control the same weight as the only step that leads to lesson
                two. Undo is now a quiet line underneath the primary. */}
            {nextHref && (
              <Button asChild variant="brand" size="lg" className="mt-5 w-full">
                <Link href={nextHref}>Next lesson</Link>
              </Button>
            )}
            <div className="mt-2.5">
              <button
                type="button"
                onClick={markIncomplete}
                disabled={pending || !ready}
                aria-busy={pending}
                className="nb-slug inline-flex min-h-11 cursor-pointer items-center text-ink underline decoration-rule decoration-2 underline-offset-4 hover:decoration-blue disabled:cursor-not-allowed disabled:text-graphite disabled:no-underline"
              >
                {pending ? "Saving…" : "Mark it unread again"}
              </button>
            </div>

            {/* The referral ask. It was a standing panel on EVERY completed
                lesson: at 135 to 226 completions a day that asked a build-season
                evening's worth of lessons over and over, which is how a
                suggestion turns into spam. It now appears only on a one-time
                milestone, sits below the primary actions so it never blocks the
                next lesson, and is dismissible. `referrerUsername` is re-checked
                because a referral link is meaningless without a username. */}
            {milestone && referrerUsername && (
              <div className="nb-hair mt-6 pt-5">
                <LessonMilestoneShare
                  username={referrerUsername}
                  milestone={milestone}
                  onDismiss={() => setMilestone(null)}
                />
              </div>
            )}

            {/* The reward for passing: the reasoning behind every question,
                written for all 1,225 questions in the catalogue and never
                rendered anywhere until now. Folded away, and below the primary
                action, so it informs without standing between the reader and
                lesson two. */}
            {justPassed && hasQuiz && (
              <details className="nb-hair mt-6 pt-5">
                <summary className="nb-slug flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-bold text-ink">
                  <span>Why those answers were right</span>
                  <span className="shrink-0 text-blue">
                    <span className="[details[open]_&]:hidden">open</span>
                    <span className="hidden [details[open]_&]:inline">close</span>
                  </span>
                </summary>
                <ul className="mt-3 grid gap-3.5">
                  {quiz.map((q, qi) =>
                    q.explanation ? (
                      <li key={qi} className="text-[0.95rem] leading-relaxed">
                        <p className="font-bold">{q.question}</p>
                        <p className="mt-1 text-graphite">{q.explanation}</p>
                      </li>
                    ) : null
                  )}
                </ul>
              </details>
            )}

            {/* Quietest ask, below everything that matters more. */}
            <LessonNewsletter alreadySubscribed={alreadySubscribed} />
          </div>
        </div>
        {stickyCta}
      </>
    );
  }

  // ---- The gate: every question right, or the lesson is not marked ----
  if (hasQuiz) {
    return (
      <>
        <div
          id="lesson-quiz"
          ref={panelRef}
          className="nb-box relative mt-[clamp(2rem,4vw,3rem)] scroll-mt-24 p-[clamp(1.1rem,2.6vw,1.9rem)]"
        >
          <Confetti trigger={burst} />

          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <div>
              <p className="nb-slug">answer sheet</p>
              <h2 className="mt-1.5 text-[clamp(1.3rem,1.1rem+0.8vw,1.75rem)]">
                Lesson quiz
              </h2>
            </div>
            <span className="nb-tag">required</span>
          </div>

          <p className="mt-2.5 max-w-[58ch] text-[0.98rem] leading-relaxed text-graphite">
            All {quiz.length} right completes the lesson. Miss one and only that
            question comes back, anything you already answered correctly stays
            banked.
          </p>

          {/* Finishability: how much of the gate is already behind you. The
              meter never travels alone, the figure under it is what actually
              reads and what survives print. */}
          <div className="mt-5">
            <div
              className="nb-meter"
              role="progressbar"
              aria-label="Quiz progress"
              aria-valuemin={0}
              aria-valuemax={quiz.length}
              aria-valuenow={attempts > 0 ? lockedCount : answeredCount}
            >
              <span
                className="nb-meter-bar"
                style={{
                  width: `${
                    ((attempts > 0 ? lockedCount : answeredCount) / quiz.length) *
                    100
                  }%`,
                }}
              />
            </div>
            <p className="nb-slug mt-2">
              {attempts > 0
                ? `${lockedCount} of ${quiz.length} banked`
                : `${answeredCount} of ${quiz.length} answered`}
            </p>
          </div>

          <ol className="mt-[clamp(1.4rem,3vw,2rem)] grid gap-[clamp(1.4rem,3vw,2rem)]">
            {quiz.map((q, qi) => {
              const selected = answers[qi];
              const isLocked = !!locked[qi];
              const wasWrong = graded && !isLocked;
              // Stuck, not tested: hand over the reasoning. It stays visible
              // through the retry so it can actually be used, and it never says
              // which option is the right one.
              const showExplain =
                !isLocked &&
                (misses[qi] ?? 0) >= EXPLAIN_AFTER_MISSES &&
                !!q.explanation;
              return (
                <li key={qi} className="nb-hair pt-4 first:border-t-0 first:pt-0">
                  <p
                    id={`quiz-q-${qi}`}
                    className="flex flex-wrap items-baseline gap-x-2.5 gap-y-2 font-bold leading-snug"
                  >
                    <span className="font-mono text-[0.82rem] tabular-nums text-graphite">
                      {String(qi + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">{q.question}</span>
                    {/* Flag the QUESTION result only. The correct option is
                        never revealed, so retries stay a real test. A banked
                        question keeps its mark across every retry. */}
                    {isLocked && (
                      <span className="nb-tag shrink-0" data-on="">
                        banked
                      </span>
                    )}
                    {wasWrong && (
                      <span className="nb-tag shrink-0 border-[3px]">
                        take it again
                      </span>
                    )}
                  </p>

                  <div
                    className="mt-3 grid gap-2"
                    role="radiogroup"
                    aria-labelledby={`quiz-q-${qi}`}
                  >
                    {q.options.map((opt, oi) => {
                      const isSelected = selected === oi;
                      // Grade only the learner's OWN pick. Unselected options
                      // stay neutral, including the correct one, which is never
                      // revealed.
                      let state = "idle";
                      if (isLocked) {
                        // Banked, and visibly banked through every retry.
                        if (isSelected) state = "correct";
                      } else if (graded) {
                        if (isSelected) state = "wrong";
                      } else if (isSelected) state = "selected";
                      return (
                        <button
                          key={oi}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          aria-label={
                            isSelected && (isLocked || graded)
                              ? `${opt}, your answer, ${state === "correct" ? "correct" : "incorrect"}`
                              : opt
                          }
                          disabled={graded || isLocked}
                          onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                          className={cn(
                            "flex min-h-11 w-full items-center gap-3 border-2 px-3.5 py-2.5 text-left text-[0.95rem] leading-snug",
                            "rounded-[var(--hand-s)] transition-[transform,background-color] duration-100 [transition-timing-function:steps(2,end)]",
                            state === "idle" &&
                              "cursor-pointer border-ink bg-card hover:translate-x-1 hover:bg-[rgba(27,54,200,0.06)]",
                            state === "selected" &&
                              "cursor-pointer border-blue bg-[rgba(27,54,200,0.08)]",
                            state === "correct" && "border-blue bg-[rgba(27,54,200,0.08)]",
                            // A wrong answer is a stamped correction: a heavier
                            // ink edge and a line struck through the option, so
                            // it is not a red pill doing the work.
                            state === "wrong" && "border-[3px] border-ink"
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "grid size-6 shrink-0 place-items-center rounded-[var(--hand-s)] border-2 font-mono text-[0.78rem] font-bold",
                              state === "correct" && "border-blue bg-blue text-card",
                              state === "wrong" && "border-ink bg-ink text-card",
                              state === "selected" && "border-blue text-blue",
                              state === "idle" && "border-rule text-graphite"
                            )}
                          >
                            {state === "correct"
                              ? "✓"
                              : state === "wrong"
                                ? "✕"
                                : String.fromCharCode(65 + oi)}
                          </span>
                          <span
                            className={cn(
                              "flex-1",
                              state === "wrong" &&
                                "line-through decoration-ink decoration-2"
                            )}
                          >
                            {opt}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {showExplain && (
                    <p className="nb-note mt-3 text-[0.92rem] leading-relaxed">
                      <span className="nb-slug block">here is the idea</span>
                      <span className="mt-1 block">{q.explanation}</span>
                    </p>
                  )}
                </li>
              );
            })}
          </ol>

          {graded && !passed ? (
            <div className="nb-rule mt-[clamp(1.4rem,3vw,2rem)] flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <span
                className="max-w-[46ch] text-[0.95rem] leading-snug text-graphite"
                role="status"
                aria-live="polite"
              >
                {lockedCount > 0 ? (
                  <>
                    <strong className="text-ink">
                      {lockedCount} of {quiz.length} banked.
                    </strong>{" "}
                    Just {remaining} to go, the rest stay saved.
                  </>
                ) : (
                  <>
                    Not this time. Nothing is lost, take another run at{" "}
                    {quiz.length === 1 ? "it" : "them"}.
                  </>
                )}
              </span>
              <Button variant="brand" onClick={retry}>
                {remaining === quiz.length
                  ? "Try again"
                  : remaining === 1
                    ? "Retry that one"
                    : `Retry those ${remaining}`}
              </Button>
            </div>
          ) : !graded ? (
            <div className="nb-rule mt-[clamp(1.4rem,3vw,2rem)] pt-4">
              <Button
                variant="brand"
                size="lg"
                disabled={!allAnswered || pending || !ready}
                aria-busy={pending}
                onClick={onSubmitQuiz}
              >
                {pending ? "Saving…" : "Submit and complete"}
              </Button>
              {!allAnswered && (
                <p className="nb-slug mt-2.5">
                  Answer every question to submit.
                </p>
              )}
            </div>
          ) : null}
        </div>
        {stickyCta}
      </>
    );
  }

  // ---- No quiz written for this lesson yet: allow direct completion ----
  // Ruled, not boxed. There is nothing here to work on, so a card would promise
  // a task that does not exist.
  return (
    <>
      <div
        id="lesson-quiz"
        ref={panelRef}
        className="nb-rule relative mt-[clamp(2rem,4vw,3rem)] scroll-mt-24 pt-4"
      >
        <Confetti trigger={burst} />
        <p className="nb-slug">nothing to answer on this one</p>
        <h2 className="mt-1.5 text-[clamp(1.2rem,1.05rem+0.7vw,1.55rem)]">
          Read it all?
        </h2>
        <p className="mt-2 max-w-[52ch] text-[0.98rem] leading-relaxed text-graphite">
          Mark it complete and it counts toward the department, signed in or not.
        </p>
        <Button
          className="mt-4"
          variant="brand"
          size="lg"
          onClick={() => persist(true)}
          disabled={pending || !ready}
          aria-busy={pending}
        >
          {pending ? "Saving…" : "Mark complete"}
        </Button>
      </div>
      {stickyCta}
    </>
  );
}
