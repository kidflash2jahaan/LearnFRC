"use client";

import * as React from "react";
import { useActionState } from "react";
import { subscribe } from "@/app/actions/subscribe";
import { cn } from "@/lib/utils";

/**
 * The mailing-list slip.
 *
 * The old version put the label in the placeholder and hung a submit button
 * inside the input's border, which is two of the things the system says not to
 * do: a placeholder is not a label, and a control's border says where the
 * control is. So it is an `.nb-field` now, label over input, button beside it,
 * the same stack every other form on the site uses.
 *
 * Same server action, same `useActionState` wiring, same `onSuccess` contract.
 */
export function NewsletterForm({
  className,
  compact = false,
  onSuccess,
}: {
  className?: string;
  /** Slim variant for tight rows (e.g. the post-lesson prompt). */
  compact?: boolean;
  /** Fired exactly once when a subscribe succeeds, letting callers persist a
   *  "don't nag again" flag without owning the form's action state. */
  onSuccess?: () => void;
}) {
  const [state, action, pending] = useActionState(subscribe, undefined);
  const uid = React.useId();
  const inputId = `${uid}-email`;
  const errorId = `${uid}-error`;

  const firedRef = React.useRef(false);
  React.useEffect(() => {
    if (state?.success && !firedRef.current) {
      firedRef.current = true;
      onSuccess?.();
    }
  }, [state?.success, onSuccess]);

  if (state?.success) {
    return (
      <p role="status" className={cn("nb-note", className)}>
        <span className="nb-slug block">subscribed</span>
        <span className="mt-1 block text-[0.95rem]">
          You&rsquo;re on the list. Check your inbox for the confirmation.
        </span>
      </p>
    );
  }

  return (
    <form
      action={action}
      className={cn(compact ? "w-full sm:max-w-md" : "w-full max-w-sm", className)}
    >
      <div className="nb-field">
        <label htmlFor={inputId} className="nb-label">
          Email address
        </label>
        <div className={cn("flex gap-2.5", compact && "flex-row")}>
          <input
            id={inputId}
            type="email"
            name="email"
            required
            placeholder="you@team.org"
            autoComplete="email"
            aria-invalid={state?.error ? true : undefined}
            aria-describedby={state?.error ? errorId : undefined}
            className="nb-input min-w-0 flex-1"
          />
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="nb-btn shrink-0"
          >
            {pending ? "Sending" : "Join"}
          </button>
        </div>
        {!compact && (
          <p className="nb-hint">
            One email when something worth reading goes up. No other mail, ever.
          </p>
        )}
      </div>

      {state?.error && (
        <p id={errorId} role="alert" className="nb-error mt-3">
          {state.error}
        </p>
      )}
    </form>
  );
}
