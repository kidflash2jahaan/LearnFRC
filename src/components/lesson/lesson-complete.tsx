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
        className="relative mt-10 scroll-mt-24 overflow-hidden rounded-2xl border border-success/40 bg-gradient-to-b from-success/[0.12] to-success/[0.02] p-6 text-center shadow-[0_0_28px_-8px_var(--success)]"
      >
        <Confetti trigger={burst} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-success to-transparent"
        />
        <p className="mb-3 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-success/80">
          // build status: passing
        </p>
        <CheckCircle2 className="mx-auto h-10 w-10 text-success drop-shadow-[0_0_10px_var(--success)]" />
        <h2 className="mt-3 font-display text-xl font-bold">Lesson complete</h2>
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
        className="relative mt-10 scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur-md"
      >
        <Confetti trigger={burst} />
        <div className="terminal-titlebar flex items-center gap-2 px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </span>
          <span className="ml-1 font-mono text-xs text-muted-foreground">
            quiz.run — ~/team5835
          </span>
        </div>
        <div className="p-6">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold">Lesson quiz</h2>
          <span className="inline-flex items-center gap-1 rounded-full border border-magenta/40 bg-magenta/10 px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider text-magenta">
            <Lock className="h-3 w-3" /> Required
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono text-primary/80">$</span> Answer all {quiz.length} questions correctly to complete this lesson.
        </p>

        <div className="mt-6 space-y-6">
          {quiz.map((q, qi) => {
            const selected = answers[qi];
            return (
              <div key={qi}>
                <p className="font-medium">
                  <span className="mr-2 font-mono text-sm text-primary/80">
                    {String(qi + 1).padStart(2, "0")}.
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
                          "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all",
                          state === "idle" && "border-border hover:-translate-y-0.5 hover:border-accent/40 hover:bg-muted cursor-pointer",
                          state === "selected" && "border-primary/60 bg-primary/10 shadow-[var(--glow-primary)] cursor-pointer",
                          state === "correct" && "border-success/60 bg-success/10 shadow-[0_0_18px_-6px_var(--success)]",
                          state === "wrong" && "border-destructive/60 bg-destructive/10"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-semibold",
                            state === "correct" && "border-success bg-success text-[#04140a]",
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
      </div>
    );
  }

  // ---- Fallback: lesson has no quiz yet → allow direct completion ----
  return (
    <div className="relative mt-10 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-b from-primary/[0.06] to-transparent p-6 text-center transition-shadow hover:shadow-[var(--glow-primary)]">
      <Confetti trigger={burst} />
      <p className="mb-2 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-primary/70">
        // ready to commit
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
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Mark as complete
      </Button>
    </div>
  );
}
