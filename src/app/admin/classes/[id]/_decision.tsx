"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { decideClassAction, type ClassAdminState } from "@/app/actions/class-admin";

/**
 * Approve or reject (classes-design.md 7.6). `initial` comes from the email's
 * ?decide= link, which only picks the choice: nothing changes until the
 * confirm button here, because mail scanners follow links.
 */
export function DecisionForm({
  classId,
  initial,
  computed,
  withoutFlagged,
  excluded,
  maxMinutes,
}: {
  classId: string;
  initial: "approve" | "reject" | null;
  computed: number;
  withoutFlagged: number;
  /** "@sam, @lee": students the one-click exclusion leaves out. */
  excluded: string;
  maxMinutes: number;
}) {
  const [state, action, pending] = useActionState<ClassAdminState, FormData>(decideClassAction, undefined);
  const [decision, setDecision] = React.useState<"approve" | "reject" | null>(initial);
  const [note, setNote] = React.useState("");
  const [exclude, setExclude] = React.useState(false);
  const [minutes, setMinutes] = React.useState("");
  const uid = React.useId();

  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.message) toast.success(state.message);
  }, [state]);

  if (state?.message) return <p className="nb-note max-w-xl">{state.message}</p>;

  const credited = minutes !== "" ? minutes : String(exclude ? withoutFlagged : computed);
  return (
    <form action={action} className="max-w-2xl">
      <input type="hidden" name="classId" value={classId} />
      <fieldset>
        <legend className="nb-label">Your decision</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {(["approve", "reject"] as const).map((d) => (
            <label key={d} className="flex min-h-11 cursor-pointer items-center gap-2 text-[0.98rem]">
              <input
                type="radio"
                name="decision"
                value={d}
                checked={decision === d}
                onChange={() => setDecision(d)}
                disabled={pending}
                className="size-4"
              />
              {d === "approve" ? "Approve" : "Reject"}
            </label>
          ))}
        </div>
      </fieldset>

      {decision === "approve" ? (
        <div className="mt-3 grid gap-3">
          <p className="text-[0.95rem]">
            Credits <b>{credited}</b> {credited === "1" ? "minute" : "minutes"} to the teacher.
          </p>
          {excluded ? (
            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[0.95rem] leading-snug">
              <input
                type="checkbox"
                name="excludeFlagged"
                checked={exclude}
                onChange={(e) => setExclude(e.target.checked)}
                disabled={pending}
                className="mt-0.5 size-4 shrink-0"
              />
              <span>
                Don&rsquo;t count flagged students ({excluded}): {withoutFlagged} minutes instead of {computed}
              </span>
            </label>
          ) : null}
          <div className="nb-field">
            <label className="nb-label" htmlFor={`${uid}-minutes`}>
              Different minutes, optional
            </label>
            <input
              id={`${uid}-minutes`}
              name="minutes"
              type="number"
              inputMode="numeric"
              min={0}
              max={maxMinutes}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              disabled={pending}
              aria-invalid={state?.field === "minutes" || undefined}
              className="nb-input max-w-[10rem]"
            />
            <p className="nb-hint">A different number needs a note saying why.</p>
          </div>
        </div>
      ) : null}

      {decision === "reject" ? (
        <div className="mt-3 grid gap-1">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[0.95rem] leading-snug">
            <input type="checkbox" name="tellTeacher" disabled={pending} className="mt-0.5 size-4 shrink-0" />
            <span>Tell the teacher why (emails them the note)</span>
          </label>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[0.95rem] leading-snug">
            <input type="checkbox" name="forSafety" disabled={pending} className="mt-0.5 size-4 shrink-0" />
            <span>Reject for safety (keeps the evidence in a hold)</span>
          </label>
        </div>
      ) : null}

      {decision ? (
        <>
          <div className="nb-field mt-3">
            <label className="nb-label" htmlFor={`${uid}-note`}>
              {decision === "reject" ? "Why it's rejected" : "Note, optional"}
            </label>
            <textarea
              id={`${uid}-note`}
              name="note"
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={pending}
              aria-invalid={state?.field === "note" || undefined}
              className="nb-input min-h-[5rem]"
            />
          </div>
          <button type="submit" disabled={pending} aria-busy={pending} className="nb-btn mt-4">
            {pending ? "Saving" : decision === "approve" ? "Confirm: approve" : "Confirm: reject"}
          </button>
        </>
      ) : null}

      <div aria-live="polite">{state?.error ? <p className="nb-error mt-3">{state.error}</p> : null}</div>
    </form>
  );
}
