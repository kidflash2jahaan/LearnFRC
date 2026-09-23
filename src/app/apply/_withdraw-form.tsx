"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  withdrawAdminApplication,
  type ApplyState,
} from "@/app/actions/admin-team";

/**
 * Pulling an open application back.
 *
 * TWO STEPS, BOTH ON THE PAGE. `window.confirm` would do the job in one line
 * and it is the wrong control here: it is the browser's chrome rather than the
 * binder's, it cannot be styled, it is read out by screen readers as a system
 * dialog with no relationship to the sentence that prompted it, and on a phone
 * it covers the page the person is trying to read. So the question is asked in
 * the page, in the same ink as everything around it.
 *
 * Focus follows the question both ways: onto the confirm button when the
 * question opens, back onto the withdraw button when it is dismissed, so a
 * keyboard reader is never left pointing at an element that no longer exists.
 * The confirm button describes itself with the question, so a screen reader
 * hears what it is confirming rather than a bare "Yes".
 *
 * No animation on the swap. The person pressed a button and the answer is a
 * question: a control that slides in slower than the press that asked for it
 * reads as lag, not as polish.
 *
 * On success the action revalidates /apply, so this island is replaced by the
 * server's own rendering of the new state. There is no success branch here
 * because there is nothing for one to say.
 */
export function WithdrawForm() {
  const [state, formAction, isPending] = useActionState<ApplyState, FormData>(
    withdrawAdminApplication,
    undefined
  );
  const [asking, setAsking] = React.useState(false);
  const uid = React.useId();
  const openRef = React.useRef<HTMLButtonElement>(null);
  const confirmRef = React.useRef<HTMLButtonElement>(null);
  // Which control to focus after the swap. Null on first render so the page
  // does not steal focus on arrival.
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
            Withdraw this application? It comes off the reviewer&rsquo;s desk
            straight away, and you can send a new one whenever you want.
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
