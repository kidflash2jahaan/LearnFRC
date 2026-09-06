"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setLessonComplete, toggleBookmark } from "@/app/actions/progress";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/lesson/confetti";
import { scrollToElement } from "@/components/perf-mode";

/**
 * The two controls in the lesson header: finish the lesson, and keep it.
 *
 * Both used to be icon-only or icon-led, which put the meaning of the control
 * in a glyph. The binder writes on its controls: a drawn button says "Save",
 * and it says "Saved" once it is, so the state survives a greyscale photocopy
 * and a screen reader reads the same thing the eye does. `aria-pressed` on the
 * toggle carries it for assistive tech.
 *
 * Every branch below is the behaviour that was already here: the quiz gate
 * runs before the auth gate, an unresolved store no-ops rather than
 * misrouting a click, and a failed write rolls the optimistic state back.
 */
export function LessonActions({
  lessonId,
  deptSlug,
  lessonPath,
  authed,
  initialCompleted,
  initialBookmarked,
  quizRequired = false,
  ready = true,
  onCompletedChange,
  onBookmarkedChange,
}: {
  lessonId: string;
  deptSlug: string;
  lessonPath: string;
  authed: boolean;
  initialCompleted: boolean;
  initialBookmarked: boolean;
  quizRequired?: boolean;
  // False until the client progress store has loaded (/api/me/progress). While
  // false the true auth state is unknown, so the controls are disabled and the
  // handlers no-op, a click must NOT prematurely fire requireAuth (which would
  // wrongly prompt a signed-in user to sign up).
  ready?: boolean;
  // Optional hooks so the (client-fetched) progress store on the static lesson
  // page can stay in lockstep with completions/bookmarks made here, replacing
  // what a server round-trip used to keep in sync.
  onCompletedChange?: (completed: boolean) => void;
  onBookmarkedChange?: (bookmarked: boolean) => void;
}) {
  const router = useRouter();
  const [completed, setCompleted] = React.useState(initialCompleted);
  const [bookmarked, setBookmarked] = React.useState(initialBookmarked);
  const [pending, startTransition] = React.useTransition();
  const [burst, setBurst] = React.useState(0);

  React.useEffect(() => setCompleted(initialCompleted), [initialCompleted]);
  // Sync bookmark state once progress hydrates client-side on the static page.
  React.useEffect(() => setBookmarked(initialBookmarked), [initialBookmarked]);

  const requireAuth = (verb: string) => {
    // First-time FRC readers dominate this path, send them to signup (which
    // has a "log in" link for the rare returning user), not the returning-user
    // login screen. Routing account-creation moments to /login was silently
    // bleeding signups.
    toast(`Create a free account to ${verb}`, {
      action: {
        label: "Sign up free",
        onClick: () =>
          router.push(`/signup?next=${encodeURIComponent(lessonPath)}`),
      },
    });
  };

  const onComplete = () => {
    // Auth state not yet known, ignore the click rather than misroute it.
    if (!ready) return;
    // A required quiz can't be bypassed, send them to it. This runs BEFORE the
    // auth gate on purpose: guest completion is fully supported (localStorage +
    // a verified server row, migrated at signup), but this button used to hit
    // `requireAuth` first, so a logged-out reader who pressed the only action in
    // the lesson header got a "create an account" toast instead of the quiz.
    // That is the first viewport of every SEO landing, and it contradicted the
    // page's own "free, no login to read a guide" promise.
    if (quizRequired && !completed) {
      scrollToElement(document.getElementById("lesson-quiz"));
      return;
    }
    if (!authed) return requireAuth("track your progress");
    const next = !completed;
    setCompleted(next);
    onCompletedChange?.(next);
    if (next) setBurst((b) => b + 1);
    startTransition(async () => {
      const r = await setLessonComplete(lessonId, deptSlug, next);
      if (r?.error) {
        setCompleted(!next);
        onCompletedChange?.(!next);
        toast.error(r.error);
      } else {
        if (next) toast.success("Lesson complete! +10 XP");
      }
    });
  };

  const onBookmark = () => {
    // Auth state not yet known, ignore the click rather than misroute it.
    if (!ready) return;
    if (!authed) return requireAuth("save lessons");
    const next = !bookmarked;
    setBookmarked(next);
    onBookmarkedChange?.(next);
    startTransition(async () => {
      const r = await toggleBookmark(lessonId, next);
      if (r?.error) {
        setBookmarked(!next);
        onBookmarkedChange?.(!next);
        toast.error(r.error);
      } else {
        toast(next ? "Saved to bookmarks" : "Removed from bookmarks");
      }
    });
  };

  const primaryLabel = completed
    ? "Completed"
    : quizRequired
      ? "Take the quiz"
      : "Mark complete";

  return (
    <div className="relative flex flex-wrap items-center gap-3">
      <Confetti trigger={burst} />
      <span role="status" aria-live="polite" className="sr-only">
        {pending ? "Saving" : ""}
      </span>

      <Button
        onClick={onComplete}
        disabled={pending || !ready}
        aria-busy={pending}
        variant={completed ? "ghost" : "brand"}
      >
        {/* The word carries the pending state. A spinner would be a seventh
            thing on a page whose whole visual argument is ink on paper. */}
        {pending ? "Saving…" : primaryLabel}
      </Button>

      <Button
        onClick={onBookmark}
        disabled={pending || !ready}
        aria-busy={pending}
        aria-pressed={bookmarked}
        variant="ghost"
        className={bookmarked ? "border-blue text-blue" : undefined}
      >
        {bookmarked ? "Saved" : "Save"}
      </Button>
    </div>
  );
}
