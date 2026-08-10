"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Loader2,
  ListChecks,
  ArrowRight,
  RotateCcw,
  Lock,
  XCircle,
  Lightbulb,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { setLessonComplete } from "@/app/actions/progress";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/lesson/confetti";
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

// ---- Guest (no-account) progress lives in src/lib/guest-progress.ts:
// localStorage for the instant local copy, plus a server row keyed to the
// anonymous visitor id (lf_vid) which is the copy that migrates into a real
// account at signup. Writes that don't reach the server are queued and retried
// there, so "sign up and keep your progress" stays true. ----

/**
 * The measured activation threshold.
 *
 * Retention against "lessons completed in the first 7 days" is a step function,
 * not a slope: 0 lessons -> 6% still active at d21, 1 -> 4%, 2 -> 8%, 3-4 -> 5%,
 * then 5-9 -> 35%. Completing one to four lessons is worth nothing over
 * completing none; everything happens at five. Five is also already a real
 * reward in this product — the `five-lessons` / "Warmed Up" achievement — so the
 * completion panel counts toward it out loud, instead of celebrating a first
 * lesson that on its own predicts nothing.
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
  // no-ops — critical so a signed-in user's completion is never written to the
  // guest bucket (localStorage / /api/guest-progress) during the fetch window.
  ready?: boolean;
  // Keeps the static lesson page's client progress store in sync with an
  // authed completion made here (chip, rail, contents list, mobile card).
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
  // True only for a pass that happened in THIS session — gates the recap so
  // revisiting an already-finished lesson never shows it.
  const [justPassed, setJustPassed] = React.useState(false);
  // The completion block itself. Doubles as the scroll target and as the element
  // <LessonStickyCta/> watches to know when it would be redundant.
  const panelRef = React.useRef<HTMLDivElement>(null);
  const prevCompleted = React.useRef(initialCompleted);

  // Referral ask, spent only on a one-time milestone (first lesson ever, or
  // reaching 10 lifetime lessons) — see lesson-milestone-share.tsx for why it
  // is NOT shown on every completion. Null except in the render immediately
  // following a completion the reader just made in this session, so revisiting
  // an already-complete lesson never shows it.
  const resolveMilestone = useLessonMilestone(lessonId);
  const [milestone, setMilestone] = React.useState<LessonMilestone | null>(null);

  React.useEffect(() => setCompleted(initialCompleted), [initialCompleted]);

  // When a quiz is passed the tall quiz collapses into a short panel, which
  // makes the browser clamp the scroll position and jump. Instead, gently bring
  // the result into view so completion lands somewhere predictable on mobile.
  React.useEffect(() => {
    if (completed && !prevCompleted.current && quiz && quiz.length > 0) {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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

  // Guests: reflect what this browser has already finished, and keep the
  // running total live so the completed card can say what is at stake. Read in
  // an effect, never during render — localStorage during render would break
  // hydration. `guestDone` stays 0 for signed-in readers.
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
    // Auth state not yet known (store still loading) — no-op so a signed-in
    // user's completion is never misrouted into the guest bucket below.
    if (!ready) return;
    // Guests learn without an account: saved in this browser + recorded against
    // the anonymous visitor id server-side, which is the copy that migrates
    // into a real account at signup. No sign-up required to earn it.
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
          // derive ANY of their steps — without these two calls the anonymous
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
            ? "Lesson complete — saved in this browser."
            : "Lesson complete — saved in this browser. We'll finish syncing it next time you're online."
        );
      });
      return;
    }

    // Resolved BEFORE the store is told about this completion (the resolver
    // counts accordingly) and set in the same batch as `completed`, so the
    // milestone card is present in the very first render of the completion
    // panel rather than popping in and pushing the buttons down.
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
        // The completion didn't stick, so don't spend the milestone on it.
        setMilestone(null);
        toast.error(r.error);
      } else {
        if (value) {
          // Shown once, ever: spend the rung as soon as the completion is real,
          // whether or not they act on it. It cannot return on reload.
          if (earned) rememberMilestone(earned.key);
          toast.success("Lesson complete!  +10 XP");
        }
      }
    });
  };

  const onSubmitQuiz = () => {
    // Auth state not yet known — ignore the submit until the store loads.
    if (!ready) return;

    // Funnel: `quiz_attempted`. Recorded on the ATTEMPT, before grading, because
    // the question the funnel has to answer is how many readers reach the gate
    // at all — not how many clear it. Quiz grading is pure client state, so this
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
   * left `graded` true with every answer correct — a state in which neither the
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

  // Fixed-position, so where the lesson page chooses to mount this component in
  // the DOM cannot bury the only control that records a completion.
  const stickyCta = (
    <LessonStickyCta
      mode={completed ? "next" : "quiz"}
      quizCount={hasQuiz ? quiz.length : 0}
      nextHref={nextHref}
      anchorRef={panelRef}
    />
  );

  // ---- Completed ----
  if (completed) {
    // The momentum meter is honest or absent: it needs a real signed-in count,
    // and it retires the moment the reader is past the threshold it tracks.
    const showMomentum =
      authed && ready && completedCount >= 1 && completedCount <= MOMENTUM_TARGET;
    const toGo = MOMENTUM_TARGET - completedCount;

    return (
      <>
      {/* `id="lesson-quiz"` is the stable anchor for this lesson's completion
          block in BOTH states — this card and the quiz card below. Exactly one
          of the two is ever mounted, so the id is never duplicated, and every
          link that points a reader at "the finish" keeps working afterwards. */}
      <div
        id="lesson-quiz"
        ref={panelRef}
        className="ac-card relative mt-10 scroll-mt-24 overflow-hidden border-success/40 p-6 text-center"
      >
        <Confetti trigger={burst} />
        <p className="ac-eyebrow mb-3 text-success">
          Complete
        </p>
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden />
        <h2 className="mt-3 font-display text-xl font-bold">Lesson complete</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {authed
            ? "Nice work — your progress is saved."
            : guestDone > 1
              ? `Nice work — that's ${guestDone} lessons finished in this browser.`
              : "Nice work — saved in this browser. No account needed."}
        </p>

        {/* Momentum toward the number that actually predicts retention. The
            product already celebrated lesson 1, which the data says is worth
            nothing on its own — the cliff is between four lessons and five. This
            names the target, shows how close it is, and points at a badge that
            genuinely exists. */}
        {showMomentum && (
          <div className="mx-auto mt-5 max-w-md rounded-2xl border border-border bg-muted/40 p-4">
            <div className="flex items-center justify-center gap-1.5" aria-hidden>
              {Array.from({ length: MOMENTUM_TARGET }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-2.5 rounded-full transition-all",
                    i < completedCount
                      ? "w-8 bg-success"
                      : "w-5 bg-[rgba(120,145,190,0.25)]"
                  )}
                />
              ))}
            </div>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-foreground">
              <Trophy className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              {toGo > 0 ? (
                <span>
                  <strong className="tabular-nums">
                    {completedCount} of {MOMENTUM_TARGET}
                  </strong>{" "}
                  — {toGo} more unlocks the Warmed Up badge.
                </span>
              ) : (
                <span>Warmed Up unlocked — that&apos;s five lessons down.</span>
              )}
            </p>
          </div>
        )}

        {/* The ask is sized to what they've actually built. One lesson gets a
            single quiet line; from the second onward it names the number and
            the XP, because by then there is something concrete to lose. It is
            never shown on arrival — reaching this card means the quiz is
            passed. */}
        {!authed &&
          (guestDone > 1 ? (
            <div className="mx-auto mt-4 max-w-md rounded-xl border border-primary/25 bg-primary/[0.06] p-3.5 text-left text-sm">
              {/* Framed around what an account GAINS, not what the reader
                  stands to lose. The storage fact stays — it is the one thing
                  someone needs in order to judge the offer, and removing it
                  would make the ask less honest, not kinder. What went is the
                  threat built on top of it ("clear your history and they're
                  gone") and the CTA verb "Keep", which presupposes the loss.
                  The sibling ask in lesson-signup-hook.tsx renders lower on
                  this same page and was rewritten the same way — keep the two
                  in step or a reader meets both framings within one screen. */}
              <p className="leading-relaxed text-foreground">
                <strong>
                  {guestDone} lessons done, saved in this browser.
                </strong>{" "}
                A free account gives them a permanent home — at least +
                {guestDone * 10} XP, with the dates you actually earned them —
                and your progress follows you onto any device from then on.
              </p>
              <Button asChild variant="brand" size="sm" className="mt-3">
                <Link href={`/signup?next=${encodeURIComponent(lessonPath)}&ref=lesson-complete`}>
                  Claim my {guestDone} lessons{" "}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Keep going — nothing to sign up for.{" "}
              <Link
                href={`/signup?next=${encodeURIComponent(lessonPath)}&ref=lesson-complete`}
                className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Or make it permanent
              </Link>
              .
            </p>
          ))}
        {/* ONE unmissable next action. Continuing used to share a wrapping flex
            row with "Mark as incomplete", which gave a destructive control the
            same visual weight as the only step that leads to lesson two. Undo is
            now a quiet link underneath the primary. */}
        {nextHref && (
          <Button asChild variant="brand" size="lg" className="mt-5 w-full">
            <Link href={nextHref}>
              Next lesson <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        )}
        <div className="mt-2">
          <button
            type="button"
            onClick={markIncomplete}
            disabled={pending || !ready}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-55"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Circle className="h-3.5 w-3.5" aria-hidden />
            )}
            Mark as incomplete
          </button>
        </div>

        {/* The referral ask. Was a standing <TeamChallenge/> on EVERY completed
            lesson — at 135–226 completions a day that asked a build-season
            evening's worth of lessons over and over, which is how a suggestion
            turns into spam. It now appears only on a one-time milestone, sits
            below the primary actions so it never blocks the next lesson, and
            is dismissible. `referrerUsername` is re-checked because a referral
            link is meaningless without a username. */}
        {milestone && referrerUsername && (
          <div className="mt-6">
            <hr className="ac-divider mb-5" />
            <LessonMilestoneShare
              username={referrerUsername}
              milestone={milestone}
              onDismiss={() => setMilestone(null)}
            />
          </div>
        )}

        {/* The reward for passing: the reasoning behind every question. Written
            for all 1,225 questions in the catalogue and never rendered anywhere
            until now. Collapsed, and below the primary action, so it informs
            without standing between the reader and lesson two. */}
        {justPassed && hasQuiz && (
          <details className="mt-6 text-left">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <Lightbulb className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              Why those answers were right
            </summary>
            <ul className="mt-3 space-y-3">
              {quiz.map((q, qi) =>
                q.explanation ? (
                  <li key={qi} className="text-sm leading-relaxed">
                    <p className="font-medium text-foreground">{q.question}</p>
                    <p className="mt-1 text-muted-foreground">{q.explanation}</p>
                  </li>
                ) : null
              )}
            </ul>
          </details>
        )}

        {/* Quietest ask, below the primary actions + team challenge. */}
        <LessonNewsletter alreadySubscribed={alreadySubscribed} />
      </div>
      {stickyCta}
      </>
    );
  }

  // ---- Quiz gate (mandatory): must pass to complete ----
  if (hasQuiz) {
    return (
      <>
      <div
        id="lesson-quiz"
        ref={panelRef}
        className="ac-card relative mt-10 scroll-mt-24 overflow-hidden"
      >
        <Confetti trigger={burst} />
        <div className="p-6">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-foreground" aria-hidden />
          <h2 className="font-display text-xl font-bold">Lesson quiz</h2>
          <span className="ac-badge inline-flex items-center gap-1 rounded-full text-xs" style={{ "--a": "#d64b8a" } as React.CSSProperties}>
            <Lock className="h-3 w-3" aria-hidden /> Required
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          All {quiz.length} right completes the lesson. Miss one and only that
          question comes back — anything you already answered correctly stays
          banked.
        </p>

        {/* Finishability: how much of the gate is already behind you. */}
        <div className="mt-4">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-[rgba(120,145,190,0.18)]"
            role="progressbar"
            aria-label="Quiz progress"
            aria-valuemin={0}
            aria-valuemax={quiz.length}
            aria-valuenow={attempts > 0 ? lockedCount : answeredCount}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-[#1aa9d6] transition-[width] duration-300"
              style={{
                width: `${
                  ((attempts > 0 ? lockedCount : answeredCount) / quiz.length) * 100
                }%`,
              }}
            />
          </div>
          <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
            {attempts > 0
              ? `${lockedCount} of ${quiz.length} locked in`
              : `${answeredCount} of ${quiz.length} answered`}
          </p>
        </div>

        <div className="mt-6 space-y-6">
          {quiz.map((q, qi) => {
            const selected = answers[qi];
            const isLocked = !!locked[qi];
            const wasWrong = graded && !isLocked;
            // Stuck, not tested — hand over the reasoning. It stays visible
            // through the retry so it can actually be used, and it never says
            // which option is the right one.
            const showExplain =
              !isLocked &&
              (misses[qi] ?? 0) >= EXPLAIN_AFTER_MISSES &&
              !!q.explanation;
            return (
              <div key={qi}>
                <p id={`quiz-q-${qi}`} className="flex flex-wrap items-center gap-2 font-medium">
                  <span className="mr-0.5 text-sm font-semibold tabular-nums text-foreground">
                    {String(qi + 1).padStart(2, "0")}.
                  </span>
                  <span className="min-w-0 flex-1">{q.question}</span>
                  {/* Flag the QUESTION result only — the correct option is
                      never revealed so retries stay a real test. A banked
                      question keeps its badge across every retry. */}
                  {isLocked && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#12b565]/30 bg-[#12b565]/10 px-2 py-0.5 text-xs font-semibold text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Locked in
                    </span>
                  )}
                  {wasWrong && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                      <XCircle className="h-3.5 w-3.5" aria-hidden /> Take this one again
                    </span>
                  )}
                </p>
                <div className="mt-3 grid gap-2" role="radiogroup" aria-labelledby={`quiz-q-${qi}`}>
                  {q.options.map((opt, oi) => {
                    const isSelected = selected === oi;
                    // Grade only the learner's OWN pick. Unselected options stay
                    // neutral — including the correct one (never revealed).
                    let state = "idle";
                    if (isLocked) {
                      // Banked, and stays visibly banked through every retry.
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
                            ? `${opt} — your answer, ${state === "correct" ? "correct" : "incorrect"}`
                            : opt
                        }
                        disabled={graded || isLocked}
                        onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                        className={cn(
                          "flex min-h-[44px] items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                          state === "idle" && "border-border bg-card hover:-translate-y-0.5 hover:border-accent/40 hover:bg-muted cursor-pointer",
                          state === "selected" && "border-primary/60 bg-primary/10 cursor-pointer",
                          state === "correct" && "border-success/60 bg-success/10",
                          state === "wrong" && "border-destructive/60 bg-destructive/10"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                            state === "correct" && "border-success bg-success text-white",
                            state === "wrong" && "border-destructive bg-destructive text-white",
                            state === "selected" && "border-primary text-primary",
                            state === "idle" && "border-current text-muted-foreground"
                          )}
                        >
                          {state === "correct" ? "✓" : state === "wrong" ? "✕" : String.fromCharCode(65 + oi)}
                        </span>
                        <span className="flex-1">{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {showExplain && (
                  <p className="mt-2.5 flex gap-2 rounded-xl border border-warning/25 bg-warning/[0.07] p-3 text-sm leading-relaxed text-foreground/80">
                    <Lightbulb
                      className="mt-0.5 h-4 w-4 shrink-0 text-warning"
                      aria-hidden
                    />
                    <span>
                      <strong className="font-semibold text-foreground">
                        Here&apos;s the idea:
                      </strong>{" "}
                      {q.explanation}
                    </span>
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {graded && !passed ? (
            <motion.div
              key="fail"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm text-muted-foreground" role="status" aria-live="polite">
                {lockedCount > 0 ? (
                  <>
                    <strong className="text-foreground">
                      {lockedCount} of {quiz.length} locked in.
                    </strong>{" "}
                    Just {remaining} to go — the rest stay saved.
                  </>
                ) : (
                  <>
                    Not this time. Nothing is lost — take another run at{" "}
                    {quiz.length === 1 ? "it" : "them"}.
                  </>
                )}
              </span>
              <Button variant="brand" onClick={retry}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                {remaining === quiz.length
                  ? "Try again"
                  : remaining === 1
                    ? "Retry that one"
                    : `Retry those ${remaining}`}
              </Button>
            </motion.div>
          ) : !graded ? (
            <motion.div key="submit" className="mt-6">
              <Button
                variant="brand"
                size="lg"
                disabled={!allAnswered || pending || !ready}
                onClick={onSubmitQuiz}
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                )}
                Submit &amp; complete
              </Button>
              {!allAnswered && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Answer every question to submit.
                </p>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
        </div>
      </div>
      {stickyCta}
      </>
    );
  }

  // ---- Fallback: lesson has no quiz yet → allow direct completion ----
  return (
    <>
    <div
      id="lesson-quiz"
      ref={panelRef}
      className="ac-card relative mt-10 scroll-mt-24 overflow-hidden p-6 text-center"
    >
      <Confetti trigger={burst} />
      <p className="ac-eyebrow mb-2">
        Ready to finish
      </p>
      <h2 className="font-display text-lg font-semibold">Finished this lesson?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Mark it complete to earn XP and track your progress.
      </p>
      <Button
        className="mt-4"
        variant="brand"
        size="lg"
        onClick={() => persist(true)}
        disabled={pending || !ready}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <CheckCircle2 className="h-4 w-4" aria-hidden />
        )}
        Mark as complete
      </Button>
    </div>
    {stickyCta}
    </>
  );
}
