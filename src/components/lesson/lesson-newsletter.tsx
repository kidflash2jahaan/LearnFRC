"use client";

import * as React from "react";
import { NewsletterForm } from "@/components/newsletter-form";

/**
 * The mailing-list slip at the bottom of a finished lesson.
 *
 * It sits inside the completion card, so it draws no box of its own: a second
 * ruled frame inside a ruled frame is just noise. A dashed hairline and a mono
 * caption are enough to say "different thing, same sheet".
 *
 * Don't-nag rules, unchanged:
 *  - `alreadySubscribed` (server-checked from the subscribers table) hides it
 *    outright, stable prop, so it's the same on server and client.
 *  - After a successful subscribe we set `lf_nl_done`; a manual dismiss sets
 *    `lf_nl_hidden`. Either keeps it from reappearing on later lessons.
 *
 * Hydration-safety: localStorage never touches SSR. Renders `null` on the
 * server and on the first client render (mounted starts false); an effect then
 * reads the flags and reveals. Nothing here animates, so there is no motion
 * branch to keep in step either.
 */
const DONE_KEY = "lf_nl_done";
const HIDDEN_KEY = "lf_nl_hidden";

export function LessonNewsletter({
  alreadySubscribed,
}: {
  alreadySubscribed: boolean;
}) {
  const [mounted, setMounted] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(DONE_KEY) || localStorage.getItem(HIDDEN_KEY)) {
        setHidden(true);
      }
    } catch {
      /* localStorage unavailable, show the prompt */
    }
  }, []);

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(HIDDEN_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const onSubscribed = React.useCallback(() => {
    try {
      localStorage.setItem(DONE_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  if (alreadySubscribed) return null;
  if (!mounted || hidden) return null;

  return (
    <div className="nb-hair mt-8 pt-5 text-left">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="nb-slug">new lessons, by email</p>
        <button
          type="button"
          onClick={dismiss}
          className="nb-slug inline-flex min-h-11 items-center text-ink underline decoration-rule underline-offset-4 hover:decoration-blue"
        >
          Not now
        </button>
      </div>
      <p className="mt-1.5 max-w-[46ch] text-[0.95rem] leading-snug text-graphite">
        A short note when new guides ship. Nothing else, and you can leave any
        time.
      </p>
      <NewsletterForm compact onSuccess={onSubscribed} className="mt-3.5" />
    </div>
  );
}
