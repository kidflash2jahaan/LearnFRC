"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { useArmed } from "@/components/use-armed";
import { answerLetterAction, type LetterDeskState } from "./_actions";

type Action = "approve" | "decline" | "revoke";

/**
 * The answers under a letter. A request gets "Approve and sign" and
 * "Decline"; a signed letter gets "Withdraw". Signing and withdrawing arm
 * first: the first click says what's about to happen, the second does it,
 * and it stays armed until a click elsewhere, Escape or 10 seconds (useArmed).
 * Decline and withdraw need a reason, which the teacher reads in their
 * email. Every check is made again on the server (src/lib/classes/letters.ts);
 * the shape of these controls isn't authorisation.
 */
export function LetterControls({
  id,
  label,
  mode,
  canSign,
}: {
  id: string;
  /** "@maya's letter", for screen readers and the armed line. */
  label: string;
  mode: "request" | "issued";
  /** False when the desk already knows signing will be refused (drift, a blocked account). */
  canSign: boolean;
}) {
  const [state, dispatch, pending] = useActionState<LetterDeskState, FormData>(answerLetterAction, undefined);
  const [choice, setChoice] = React.useState<Action | null>(null);
  const [armed, setArmed, armScope] = useArmed<Action | null>(null);
  // Controlled, so a refusal doesn't wipe it.
  const [reason, setReason] = React.useState("");

  const uid = React.useId();
  const reasonId = `${uid}-reason`;
  const armedId = `${uid}-armed`;
  const errorId = `${uid}-error`;

  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.message) toast.success(state.message);
  }, [state]);

  if (state?.message) {
    return <p className="nb-slug mt-4 max-w-[60ch]">{state.message}</p>;
  }

  const arming = (a: Action) => (e: React.MouseEvent<HTMLButtonElement>) => {
    if (armed !== a) {
      e.preventDefault();
      setArmed(a);
      return;
    }
    setChoice(a);
  };

  const reasonError = state?.field === "reason";

  return (
    <form action={dispatch} className="mt-4 max-w-2xl">
      <input type="hidden" name="id" value={id} />

      <div className="nb-field">
        <label className="nb-label" htmlFor={reasonId}>
          {mode === "request" ? "Reason, if you decline" : "Reason, if you withdraw it"}
          <span className="sr-only"> for {label}</span>
        </label>
        <textarea
          id={reasonId}
          name="reason"
          rows={2}
          maxLength={500}
          disabled={pending}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={reasonError || undefined}
          aria-describedby={reasonError ? errorId : undefined}
          className="nb-input min-h-[4rem]"
        />
        <p className="nb-hint">The teacher reads this in their email. Keep it kind and specific.</p>
      </div>

      <div aria-live="polite">
        {state?.error ? (
          <p id={errorId} className="nb-error mt-2 max-w-[62ch]">
            {state.error}
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        {mode === "request" ? (
          <>
            <button
              type="submit"
              name="action"
              value="approve"
              onClick={arming("approve")}
              disabled={pending || !canSign}
              aria-busy={pending && choice === "approve"}
              aria-describedby={armed === "approve" ? armedId : undefined}
              className="nb-btn nb-btn-sm"
              {...armScope}
            >
              {pending && choice === "approve" ? "Signing" : armed === "approve" ? "Yes, sign it" : "Approve and sign"}
              <span className="sr-only"> {label}</span>
            </button>
            <button
              type="submit"
              name="action"
              value="decline"
              onClick={() => {
                setChoice("decline");
                setArmed(null);
              }}
              disabled={pending}
              aria-busy={pending && choice === "decline"}
              className="nb-btn-ghost nb-btn-sm"
            >
              {pending && choice === "decline" ? "Declining" : "Decline"}
              <span className="sr-only"> {label}</span>
            </button>
          </>
        ) : (
          <button
            type="submit"
            name="action"
            value="revoke"
            onClick={arming("revoke")}
            disabled={pending}
            aria-busy={pending && choice === "revoke"}
            aria-describedby={armed === "revoke" ? armedId : undefined}
            className="nb-btn-ghost nb-btn-sm"
            {...armScope}
          >
            {pending && choice === "revoke" ? "Withdrawing" : armed === "revoke" ? "Yes, withdraw it" : "Withdraw"}
            <span className="sr-only"> {label}</span>
          </button>
        )}
      </div>

      <p id={armedId} role="status" className="nb-hint mt-2 max-w-[52ch] empty:mt-0" {...armScope}>
        {armed === "approve"
          ? `One more click signs ${label} in your name and emails the teacher.`
          : armed === "revoke"
            ? `One more click withdraws ${label}. Its verify page will say so.`
            : null}
      </p>
    </form>
  );
}
