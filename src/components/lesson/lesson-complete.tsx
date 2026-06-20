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
} from "lucide-react";
import { toast } from "sonner";
import { setLessonComplete } from "@/app/actions/progress";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/lesson/confetti";
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
}: {
  lessonId: string;
  deptSlug: string;
  lessonPath: string;
  authed: boolean;
  initialCompleted: boolean;
  quiz: QuizQuestion[];
  nextHref?: string | null;
}) {
  const router = useRouter();
  const [completed, setCompleted] = React.useState(initialCompleted);
  const [pending, startTransition] = React.useTransition();
  const [burst, setBurst] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<number, number>>({});
  const [graded, setGraded] = React.useState(false);

  React.useEffect(() => setCompleted(initialCompleted), [initialCompleted]);

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
      <div className="relative mt-10 overflow-hidden rounded-2xl border border-success/30 bg-success/10 p-6 text-center">
        <Confetti trigger={burst} />
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
        <h2 className="mt-3 text-xl font-bold">Lesson complete</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nice work — your progress is saved.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {nextHref && (
            <Button asChild variant="brand">
              <Link href={nextHref}>
                Next lesson <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
          <Button variant="ghost" onClick={() => persist(false)} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Circle className="h-4 w-4" />}
            Mark as incomplete
          </Button>
        </div>
      </div>
    );
  }

  // ---- Quiz gate (mandatory): must pass to complete ----
  if (hasQuiz) {
    return (
      <div
        id="lesson-quiz"
        className="relative mt-10 scroll-mt-24 rounded-2xl border border-border bg-card p-6"
      >
        <Confetti trigger={burst} />
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Lesson quiz</h2>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            <Lock className="h-3 w-3" /> Required
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
                <p className="font-medium">
                  <span className="mr-2 font-mono text-sm text-muted-foreground">
                    {qi + 1}.
                  </span>
                  {q.question}
                </p>
                <div className="mt-3 grid gap-2" role="radiogroup" aria-label={q.question}>
                  {q.options.map((opt, oi) => {
                    const isSelected = selected === oi;
                    const isCorrect = oi === q.answer;
                    let state = "idle";
                    if (graded) {
                      if (isCorrect) state = "correct";
                      else if (isSelected) state = "wrong";
                    } else if (isSelected) state = "selected";
                    return (
                      <button
                        key={oi}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={
                          graded
                            ? `${opt}${state === "correct" ? " — correct answer" : state === "wrong" ? " — incorrect" : ""}`
                            : opt
                        }
                        disabled={graded}
                        onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                          state === "idle" && "border-border hover:bg-muted cursor-pointer",
                          state === "selected" && "border-primary bg-primary/10 cursor-pointer",
                          state === "correct" && "border-success/50 bg-success/10",
                          state === "wrong" && "border-destructive/50 bg-destructive/10"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                            state === "correct" && "border-success bg-success text-white",
                            state === "wrong" && "border-destructive bg-destructive text-white",
                            (state === "selected" || state === "idle") && "border-current"
                          )}
                        >
                          {state === "correct" ? "✓" : state === "wrong" ? "✕" : String.fromCharCode(65 + oi)}
                        </span>
                        <span className="flex-1">{opt}</span>
                      </button>
                    );
                  })}
                </div>
                {graded && selected !== q.answer && q.explanation && (
                  <p className="mt-2 text-sm text-muted-foreground">{q.explanation}</p>
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
                You got {correctCount}/{quiz.length}. Review the highlights and try again.
              </span>
              <Button variant="brand" onClick={retry}>
                <RotateCcw className="h-4 w-4" /> Try again
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
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Submit &amp; complete
              </Button>
              {!allAnswered && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Answer every question to submit.
                </p>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  // ---- Fallback: lesson has no quiz yet → allow direct completion ----
  return (
    <div className="relative mt-10 rounded-2xl border border-border bg-card p-6 text-center">
      <Confetti trigger={burst} />
      <h2 className="text-lg font-semibold">Finished this lesson?</h2>
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
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Mark as complete
      </Button>
    </div>
  );
}
