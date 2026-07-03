"use client";

import * as React from "react";
import { useActionState } from "react";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { subscribe } from "@/app/actions/subscribe";
import { cn } from "@/lib/utils";

export function NewsletterForm({
  className,
  compact = false,
  onSuccess,
}: {
  className?: string;
  /** Slim variant for tight rows (e.g. the post-lesson prompt). */
  compact?: boolean;
  /** Fired exactly once when a subscribe succeeds — lets callers persist a
   *  "don't nag again" flag without owning the form's action state. */
  onSuccess?: () => void;
}) {
  const [state, action, pending] = useActionState(subscribe, undefined);

  const firedRef = React.useRef(false);
  React.useEffect(() => {
    if (state?.success && !firedRef.current) {
      firedRef.current = true;
      onSuccess?.();
    }
  }, [state?.success, onSuccess]);

  if (state?.success) {
    return (
      <p
        role="status"
        aria-live="polite"
        className={cn(
          "ac-chip inline-flex items-center gap-2 text-sm font-medium text-success",
          className
        )}
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> You&apos;re on the list — check your inbox.
      </p>
    );
  }

  return (
    <form
      action={action}
      className={cn(compact ? "w-full sm:w-auto" : "w-full max-w-sm", className)}
    >
      <div
        className={cn(
          "ac-input group flex items-center gap-2 !p-1.5 transition-shadow focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(37,96,230,0.18)]",
          compact && "sm:min-w-[264px]"
        )}
      >
        <input
          type="email"
          name="email"
          required
          placeholder="you@team.org"
          aria-label="Email address"
          className="h-11 flex-1 bg-transparent px-2.5 text-base outline-none placeholder:text-muted-foreground sm:text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="ac-btn shrink-0 !px-3.5 text-sm disabled:opacity-60"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span className="sr-only">Submitting</span>
            </>
          ) : (
            <>
              Join{" "}
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </>
          )}
        </button>
      </div>
      {state?.error && (
        <p className="mt-1.5 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
