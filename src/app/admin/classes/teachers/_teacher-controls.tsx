"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import {
  changeLetterNameAction,
  suspendTeacherAction,
  unsuspendTeacherAction,
  type TeachFormState,
} from "@/app/actions/class-teachers";

const ARMED_MS = 5000;

/**
 * Suspend (with a staff-only reason, two clicks) or unsuspend one teacher.
 * Super admins and the safety lead. Suspending cancels their upcoming
 * classes, and students are told only that the teacher can't teach it.
 */
export function SuspendControls({
  userId,
  handle,
  suspended,
}: {
  userId: string;
  handle: string;
  suspended: boolean;
}) {
  // Two forms with their own action state: after a revalidation the row
  // flips, and each form keeps its own result.
  return suspended ? (
    <UnsuspendForm userId={userId} handle={handle} />
  ) : (
    <SuspendForm userId={userId} handle={handle} />
  );
}

function UnsuspendForm({ userId, handle }: { userId: string; handle: string }) {
  const [state, action, pending] = useActionState<TeachFormState, FormData>(unsuspendTeacherAction, undefined);
  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success) toast.success("Teaching is back on. They've been emailed.");
  }, [state]);
  return (
    <form action={action} className="min-w-0">
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" disabled={pending} aria-busy={pending} className="nb-btn-ghost nb-btn-sm">
        {pending ? "Turning it back on" : "Unsuspend"}
        <span className="sr-only"> {handle}</span>
      </button>
      {state?.error ? <p className="nb-error mt-2 max-w-[42ch]">{state.error}</p> : null}
    </form>
  );
}

function SuspendForm({ userId, handle }: { userId: string; handle: string }) {
  const [state, action, pending] = useActionState<TeachFormState, FormData>(suspendTeacherAction, undefined);
  const [armed, setArmed] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const uid = React.useId();

  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success) toast.success("Suspended. Their upcoming classes are canceled.");
  }, [state]);

  React.useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), ARMED_MS);
    return () => window.clearTimeout(t);
  }, [armed]);

  return (
    <form action={action} className="min-w-0 max-w-md">
      <input type="hidden" name="userId" value={userId} />
      <div className="nb-field">
        <label className="nb-label" htmlFor={`${uid}-reason`}>
          Why, for staff only
          <span className="sr-only"> ({handle})</span>
        </label>
        <input
          id={`${uid}-reason`}
          name="reason"
          type="text"
          maxLength={500}
          disabled={pending}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={state?.field === "reason" || undefined}
          className="nb-input"
        />
      </div>
      <button
        type={armed ? "submit" : "button"}
        onClick={() => {
          if (!armed) setArmed(true);
        }}
        disabled={pending}
        aria-busy={pending}
        aria-describedby={armed ? `${uid}-armed` : undefined}
        className="nb-btn-ghost nb-btn-sm mt-2"
      >
        {pending ? "Suspending" : armed ? "Yes, suspend" : "Suspend"}
        <span className="sr-only"> {handle}</span>
      </button>
      <p id={`${uid}-armed`} role="status" className="nb-hint mt-2 max-w-[48ch] empty:mt-0">
        {armed
          ? `One more click stops ${handle} teaching and cancels their upcoming classes. Students are emailed; the reason isn’t shared.`
          : null}
      </p>
      {state?.error ? <p className="nb-error mt-2 max-w-[42ch]">{state.error}</p> : null}
    </form>
  );
}

/**
 * Changing the locked name on a teacher's hours letters: super admins only,
 * with a note that stays on their record. Folded away by default, since it's
 * a correction, not routine work.
 */
export function LetterNameControls({ userId, handle, current }: { userId: string; handle: string; current: string }) {
  const [state, action, pending] = useActionState<TeachFormState, FormData>(changeLetterNameAction, undefined);
  const [name, setName] = React.useState(current);
  const [note, setNote] = React.useState("");
  const uid = React.useId();

  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success) toast.success("Name changed. They've been emailed.");
  }, [state]);

  return (
    <details className="mt-3 max-w-md">
      <summary className="nb-slug cursor-pointer">
        change letter name<span className="sr-only"> for {handle}</span>
      </summary>
      <form action={action} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="userId" value={userId} />
        <div className="nb-field">
          <label className="nb-label" htmlFor={`${uid}-name`}>
            Name on their letters
          </label>
          <input
            id={`${uid}-name`}
            name="letterName"
            type="text"
            maxLength={80}
            disabled={pending}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={state?.field === "letterName" || undefined}
            className="nb-input"
          />
        </div>
        <div className="nb-field">
          <label className="nb-label" htmlFor={`${uid}-note`}>
            Why it changed, required
          </label>
          <input
            id={`${uid}-note`}
            name="note"
            type="text"
            maxLength={1000}
            disabled={pending}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-invalid={state?.field === "note" || undefined}
            className="nb-input"
          />
          <p className="nb-hint">The note stays on their record. They get an email with the new name.</p>
        </div>
        {state?.error ? <p className="nb-error">{state.error}</p> : null}
        <button type="submit" disabled={pending} aria-busy={pending} className="nb-btn nb-btn-sm self-start">
          {pending ? "Saving" : "Change the name"}
        </button>
      </form>
    </details>
  );
}
