"use client";

import * as React from "react";
import { useActionState } from "react";
import { withdrawTeachApplication, type TeachFormState } from "@/app/actions/class-teachers";

/**
 * Pulling a pending teacher application back: two steps on the page, the
 * same as /apply's WithdrawForm, with focus following the question both
 * ways. On success the action revalidates /apply/teach, so the server's
 * rendering of the new state replaces this island.
 */
export function WithdrawTeachForm() {
  const [state, formAction, isPending] = useActionState<TeachFormState, FormData>(
    withdrawTeachApplication,
    undefined
  );
  const [asking, setAsking] = React.useState(false);
  const uid = React.useId();
  const openRef = React.useRef<HTMLButtonElement>(null);
  const confirmRef = React.useRef<HTMLButtonElement>(null);
  const moveTo = React.useRef<"open" | "confirm" | null>(null);

  React.useEffect(() => {
    if (moveTo.current === "confirm") confirmRef.current?.focus();
    if (moveTo.current === "open") openRef.current?.focus();
    moveTo.current = null;
  }, [asking]);

  const questionId = `${uid}-question`;

  return (
    <div className="mt-5">
      {state?.error && (
        <p className="nb-error mb-4" role="alert" aria-live="assertive">
          {state.error}
        </p>
      )}
      {asking ? (
        <form action={formAction}>
          <p id={questionId} className="max-w-[52ch] text-[0.95rem] leading-relaxed">
            Withdraw this application? It comes off the desk straight away, and you can send a new one
            whenever you want. We keep the stored copy for 180 days, then delete it.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              ref={confirmRef}
              type="submit"
              className="nb-btn nb-btn-sm"
              disabled={isPending}
              aria-busy={isPending}
              aria-describedby={questionId}
            >
              {isPending ? "Withdrawing" : "Yes, withdraw it"}
            </button>
            <button
              type="button"
              className="nb-btn-ghost nb-btn-sm"
              disabled={isPending}
              onClick={() => {
                moveTo.current = "open";
                setAsking(false);
              }}
            >
              Leave it in
            </button>
          </div>
        </form>
      ) : (
        <button
          ref={openRef}
          type="button"
          className="nb-btn-ghost nb-btn-sm"
          onClick={() => {
            moveTo.current = "confirm";
            setAsking(true);
          }}
        >
          Withdraw it
        </button>
      )}
    </div>
  );
}
