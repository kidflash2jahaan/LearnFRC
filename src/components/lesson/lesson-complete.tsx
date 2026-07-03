"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { toast } from "sonner";
import { setLessonComplete } from "@/app/actions/progress";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/lesson/confetti";
import { TeamChallenge } from "@/components/team-challenge";
import { cn } from "@/lib/utils";
import type { QuizQuestion } from "@/lib/types";

export function LessonComplete({
  lessonId,
  deptSlug,
  lessonPath,
  authed,
  initialCompleted,
  quiz,
  nextHref,
  referrerUsername,
}: {
  lessonId: string;
  deptSlug: string;
  lessonPath: string;
  authed: boolean;
  initialCompleted: boolean;
  quiz: QuizQuestion[];
  nextHref?: string | null;
  referrerUsername?: string | null;
}) {
  const router = useRouter();
  const [completed, setCompleted] = React.useState(initialCompleted);
  const [pending, startTransition] = React.useTransition();
  const [burst, setBurst] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<number, number>>({});
  const [graded, setGraded] = React.useState(false);
  const completedRef = React.useRef<HTMLDivElement>(null);
  const prevCompleted = React.useRef(initialCompleted);

  React.useEffect(() => setCompleted(initialCompleted), [initialCompleted]);

  // When a quiz is passed the tall quiz collapses into a short panel, which
  // makes the browser clamp the scroll position and jump. Instead, gently bring
  // the result into view so completion lands somewhere predictable on mobile.
  React.useEffect(() => {
    if (completed && !prevCompleted.current && quiz && quiz.length > 0) {
      completedRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    prevCompleted.current = completed;
  }, [completed, quiz]);

  const hasQuiz = quiz && quiz.length > 0;
  const allAnswered = hasQuiz && quiz.every((_, i) => answers[i] !== undefined);
  const correctCount = hasQuiz
    ? quiz.filter((q, i) => answers[i] === q.answer).length
    : 0;
  const passed = hasQuiz && correctCount === quiz.length;

  const requireAuth = () => {
    toast("Sign in to track your progress", {
      action: {
        label: "Sign in",
        onClick: () => router.push(`/login?next=${encodeURIComponent(lessonPath)}`),
      },
    });
  };

  const persist = (value: boolean) => {
    if (!authed) return requireAuth();
    setCompleted(value);
    if (value) setBurst((b) => b + 1);
    startTransition(async () => {
      const r = await setLessonComplete(lessonId, deptSlug, value);
      if (r?.error) {
        setCompleted(!value);
        toast.error(r.error);
      } else {
        if (value) toast.success("Lesson complete!  +10 XP");
        router.refresh();
      }
    });
  };

  const onSubmitQuiz = () => {
    setGraded(true);
    if (correctCount === quiz.length) {
      if (!authed) return requireAuth();
      persist(true);
    }
  };

  const retry = () => {
    setGraded(false);
    setAnswers({});
  };

  // ---- Completed ----
  if (completed) {
    return (
      <div
        ref={completedRef}
        className="ac-card relative mt-10 scroll-mt-24 overflow-hidden border-success/40 p-6 text-center"
      >
        <Confetti trigger={burst} />
        <p className="ac-eyebrow mb-3 text-success">
          Complete
        </p>
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden />
        <h2 className="mt-3 font-display text-xl font-bold">Lesson complete</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nice work — your progress is saved.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {nextHref && (
            <Button asChild variant="brand">
              <Link href={nextHref}>
                Next lesson <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          )}
          <Button variant="ghost" onClick={() => persist(false)} disabled={pending}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Circle className="h-4 w-4" aria-hidden />
            )}
            Mark as incomplete
          </Button>
        </div>

        {referrerUsername && (
          <div className="mt-6">
            <hr className="ac-divider mb-5" />
            <TeamChallenge username={referrerUsername} />
          </div>
        )}
      </div>
    );
  }

  // ---- Quiz gate (mandatory): must pass to complete ----
  if (hasQuiz) {
    return (
      <div
        id="lesson-quiz"
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
          Answer all {quiz.length} questions correctly to complete this lesson.
        </p>

        <div className="mt-6 space-y-6">
          {quiz.map((q, qi) => {
            const selected = answers[qi];
            return (
              <div key={qi}>
                <p id={`quiz-q-${qi}`} className="flex flex-wrap items-center gap-2 font-medium">
                  <span className="mr-0.5 text-sm font-semibold tabular-nums text-foreground">
                    {String(qi + 1).padStart(2, "0")}.
                  </span>
                  <span className="min-w-0 flex-1">{q.question}</span>
                  {/* After grading, flag the QUESTION result only — the correct
                      option is never revealed so retries stay a real test. */}
                  {graded && selected !== q.answer && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                      <XCircle className="h-3.5 w-3.5" aria-hidden /> Wrong
                    </span>
                  )}
                  {graded && selected === q.answer && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#12b565]/30 bg-[#12b565]/10 px-2 py-0.5 text-xs font-semibold text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Correct
                    </span>
                  )}
                </p>
                <div className="mt-3 grid gap-2" role="radiogroup" aria-labelledby={`quiz-q-${qi}`}>
                  {q.options.map((opt, oi) => {
                    const isSelected = selected === oi;
                    // Grade only the learner's OWN pick. Unselected options stay
                    // neutral — including the correct one (never revealed).
                    let state = "idle";
                    if (graded) {
                      if (isSelected) state = oi === q.answer ? "correct" : "wrong";
                    } else if (isSelected) state = "selected";
                    return (
                      <button
                        key={oi}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={
                          graded && isSelected
                            ? `${opt} — your answer, ${state === "correct" ? "correct" : "incorrect"}`
                            : opt
                        }
                        disabled={graded}
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
                You got {correctCount}/{quiz.length}. Review the highlights and try again.
              </span>
              <Button variant="brand" onClick={retry}>
                <RotateCcw className="h-4 w-4" aria-hidden /> Try again
              </Button>
            </motion.div>
          ) : !graded ? (
            <motion.div key="submit" className="mt-6">
              <Button
                variant="brand"
                size="lg"
                disabled={!allAnswered || pending}
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
    );
  }

  // ---- Fallback: lesson has no quiz yet → allow direct completion ----
  return (
    <div className="ac-card relative mt-10 overflow-hidden p-6 text-center">
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
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <CheckCircle2 className="h-4 w-4" aria-hidden />
        )}
        Mark as complete
      </Button>
    </div>
  );
}
