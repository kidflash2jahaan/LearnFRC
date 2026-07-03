"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Mail, X } from "lucide-react";
import { NewsletterForm } from "@/components/newsletter-form";

/**
 * Slim "new lessons in your inbox" prompt shown at the bottom of a completed
 * lesson. Reuses the existing NewsletterForm + subscribe action — no second
 * subscribe path.
 *
 * Don't-nag rules:
 *  - `alreadySubscribed` (server-checked from the subscribers table) hides it
 *    outright — stable prop, so it's the same on server and client.
 *  - After a successful subscribe we set `lf_nl_done`; a manual dismiss sets
 *    `lf_nl_hidden`. Either keeps it from reappearing on later lessons.
 *
 * Hydration-safety: localStorage never touches SSR. Renders `null` on the
 * server and on the first client render (mounted starts false); an effect then
 * reads the flags and reveals. Reduced motion changes `transition` only.
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
  const reduce = useReducedMotion();

  React.useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(DONE_KEY) || localStorage.getItem(HIDDEN_KEY)) {
        setHidden(true);
      }
    } catch {
      /* localStorage unavailable — show the prompt */
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="mt-6"
    >
      <div className="ac-card relative overflow-hidden bg-muted/40 p-4 text-left sm:p-5">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss newsletter prompt"
          className="absolute right-1.5 top-1.5 z-10 flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <div className="flex flex-col gap-3.5 pr-8 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="ac-badge flex h-10 w-10 shrink-0 items-center justify-center"
              style={{ "--a": "#1aa9d6" } as CSSProperties}
            >
              <Mail className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-foreground">
                New lessons in your inbox
              </p>
              <p className="text-sm leading-snug text-foreground/70">
                A quick heads-up when we ship new guides. No spam, unsubscribe anytime.
              </p>
            </div>
          </div>

          <NewsletterForm compact onSuccess={onSubscribed} className="shrink-0" />
        </div>
      </div>
    </motion.div>
  );
}
