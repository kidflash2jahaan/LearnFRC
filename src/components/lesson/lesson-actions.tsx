"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, Bookmark, BookmarkCheck, Loader2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { setLessonComplete, toggleBookmark } from "@/app/actions/progress";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/lesson/confetti";
import { cn } from "@/lib/utils";

export function LessonActions({
  lessonId,
  deptSlug,
  lessonPath,
  authed,
  initialCompleted,
  initialBookmarked,
  quizRequired = false,
}: {
  lessonId: string;
  deptSlug: string;
  lessonPath: string;
  authed: boolean;
  initialCompleted: boolean;
  initialBookmarked: boolean;
  quizRequired?: boolean;
}) {
  const router = useRouter();
  const [completed, setCompleted] = React.useState(initialCompleted);
  const [bookmarked, setBookmarked] = React.useState(initialBookmarked);
  const [pending, startTransition] = React.useTransition();
  const [burst, setBurst] = React.useState(0);

  React.useEffect(() => setCompleted(initialCompleted), [initialCompleted]);

  const requireAuth = (verb: string) => {
    toast(`Sign in to ${verb}`, {
      action: {
        label: "Sign in",
        onClick: () =>
          router.push(`/login?next=${encodeURIComponent(lessonPath)}`),
      },
    });
  };

  const onComplete = () => {
    if (!authed) return requireAuth("track your progress");
    // A required quiz can't be bypassed — send them to it.
    if (quizRequired && !completed) {
      document
        .getElementById("lesson-quiz")
        ?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    const next = !completed;
    setCompleted(next);
    if (next) setBurst((b) => b + 1);
    startTransition(async () => {
      const r = await setLessonComplete(lessonId, deptSlug, next);
      if (r?.error) {
        setCompleted(!next);
        toast.error(r.error);
      } else {
        if (next) toast.success("Lesson complete! +10 XP");
        router.refresh();
      }
    });
  };

  const onBookmark = () => {
    if (!authed) return requireAuth("save lessons");
    const next = !bookmarked;
    setBookmarked(next);
    startTransition(async () => {
      const r = await toggleBookmark(lessonId, next);
      if (r?.error) {
        setBookmarked(!next);
        toast.error(r.error);
      } else {
        toast(next ? "Saved to bookmarks" : "Removed from bookmarks");
        router.refresh();
      }
    });
  };

  return (
    <div className="relative flex flex-wrap items-center gap-3">
      <Confetti trigger={burst} />
      <span role="status" aria-live="polite" className="sr-only">
        {pending ? "Saving…" : ""}
      </span>
      <Button
        onClick={onComplete}
        disabled={pending}
        aria-busy={pending}
        variant={completed ? "secondary" : quizRequired ? "outline" : "brand"}
        size="lg"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : completed ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : quizRequired ? (
          <ListChecks className="h-4 w-4" aria-hidden />
        ) : (
          <Circle className="h-4 w-4" aria-hidden />
        )}
        {completed ? "Completed" : quizRequired ? "Take the quiz" : "Mark complete"}
      </Button>
      <button
        onClick={onBookmark}
        disabled={pending}
        aria-busy={pending}
        aria-label={bookmarked ? "Remove bookmark" : "Bookmark lesson"}
        className={cn(
          "inline-flex h-12 w-12 items-center justify-center rounded-2xl border bg-card transition-all cursor-pointer hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-55",
          bookmarked
            ? "border-primary/40 bg-primary/10 text-primary shadow-[0_6px_16px_rgba(60,95,160,0.12)]"
            : "border-border text-muted-foreground hover:border-[#0e7490]/40 hover:text-[#0e7490] hover:shadow-[0_6px_16px_rgba(60,95,160,0.10)]"
        )}
      >
        {bookmarked ? (
          <BookmarkCheck className="h-5 w-5" aria-hidden />
        ) : (
          <Bookmark className="h-5 w-5" aria-hidden />
        )}
      </button>
    </div>
  );
}
