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

  // optional self-check state
  const [answers, setAnswers] = React.useState<Record<number, number>>({});
  const [graded, setGraded] = React.useState(false);

  React.useEffect(() => setCompleted(initialCompleted), [initialCompleted]);

  const hasQuiz = quiz && quiz.length > 0;
  const allAnswered = hasQuiz && quiz.every((_, i) => answers[i] !== undefined);
  const correctCount = hasQuiz
    ? quiz.filter((q, i) => answers[i] === q.answer).length
    : 0;

  const persist = (value: boolean) => {
    if (!authed) {
      toast("Sign in to track your progress", {
        action: {
          label: "Sign in",
          onClick: () => router.push(`/login?next=${encodeURIComponent(lessonPath)}`),
        },
      });
      return;
    }
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

  return (
    <div className="mt-10 space-y-5">
      {/* Optional self-check — never blocks completion */}
      {hasQuiz && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Check your understanding</h2>
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              Optional
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            A quick, optional self-check — it doesn&apos;t affect completing the lesson.
          </p>

          <div className="mt-5 space-y-6">
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
                  <div className="mt-3 grid gap-2">
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
                  {graded && q.explanation && (
                    <p className="mt-2 text-sm text-muted-foreground">{q.explanation}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5">
            {!graded ? (
              <Button variant="outline" disabled={!allAnswered} onClick={() => setGraded(true)}>
                Check answers
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  You got {correctCount}/{quiz.length} 🎉
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setGraded(false);
                    setAnswers({});
                  }}
                >
                  <RotateCcw className="h-4 w-4" /> Retry
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Completion — always available */}
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
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
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Mark as complete
        </Button>
      </div>
    </div>
  );
}
