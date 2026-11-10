"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { decideTeacherApplicationAction, type TeachFormState } from "@/app/actions/class-teachers";
import { useArmed } from "@/components/use-armed";

/**
 * Accept or reject one teacher application, with a note that rides along in
 * the email. The same two-click Reject as /admin/team's ReviewControls: it is
 * `type="button"` until armed, and stays armed until a click elsewhere,
 * Escape or 10 seconds (useArmed). Accepting copies the name to the locked letter
 * name, and needs the "I checked their seasons" tick (sent as
 * `seasonsChecked=yes`). A first-form application (`canAccept` false) can
 * only be turned down. decideTeacherApplication re-checks the role, the
 * status, the form version and the tick.
 */
export function DecisionControls({
  id,
  handle,
  legalName,
  canAccept,
}: {
  id: string;
  handle: string;
  legalName: string;
  canAccept: boolean;
}) {
  const [state, action, pending] = useActionState<TeachFormState, FormData>(
    decideTeacherApplicationAction,
    undefined
  );
  const [choice, setChoice] = React.useState<"accept" | "reject" | null>(null);
  const [armed, setArmed, armScope] = useArmed(false);
  const [note, setNote] = React.useState("");
  const [checked, setChecked] = React.useState(false);
  const decided = state?.success ? choice : null;
  const uid = React.useId();
  const noteError = state?.field === "note";
  const checkedError = state?.field === "seasonsChecked";

  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success)
      toast.success(choice === "reject" ? "Turned down. The email is on its way." : "Accepted. The email is on its way.");
  }, [state, choice]);

  if (decided) {
    return (
      <p className="nb-slug mt-4">
        <b className="text-ink">{decided === "reject" ? "turned down" : "accepted"}</b>, the email is on its way
      </p>
    );
  }

  return (
    <form action={action} className="mt-4 max-w-2xl">
      <input type="hidden" name="id" value={id} />
      <div className="nb-field">
        <label className="nb-label" htmlFor={`${uid}-note`}>
          Note to them, optional; it goes in the email
          <span className="sr-only"> to {handle}</span>
        </label>
        <textarea
          id={`${uid}-note`}
          name="note"
          rows={2}
          maxLength={1000}
          disabled={pending}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-invalid={noteError || undefined}
          className="nb-input min-h-[4.5rem]"
        />
        <p className="nb-hint">
          {canAccept ? (
            <>
              Accepting locks &ldquo;{legalName}&rdquo; as the name on their hours letters. Only a super admin can
              change it after, with a note.
            </>
          ) : (
            "This came in on the first form, which didn’t ask about FRC seasons. Turn it down with a note asking them to apply again."
          )}
        </p>
      </div>
      {canAccept ? (
        <label className="mt-3 flex min-h-[2.75rem] cursor-pointer items-center gap-3 text-[0.95rem] font-semibold">
          <input
            type="checkbox"
            name="seasonsChecked"
            value="yes"
            className="size-4 shrink-0"
            checked={checked}
            disabled={pending}
            onChange={(e) => setChecked(e.target.checked)}
            aria-invalid={checkedError || undefined}
          />
          <span>
            I checked their seasons (The Blue Alliance, FRC Events or their reference).
            <span className="sr-only"> {handle}</span>
          </span>
        </label>
      ) : null}
      <div aria-live="polite">{state?.error ? <p className="nb-error mt-2">{state.error}</p> : null}</div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        {canAccept ? (
          <button
            type="submit"
            name="decision"
            value="accept"
            onClick={() => {
              setChoice("accept");
              setArmed(false);
            }}
            disabled={pending}
            aria-busy={pending && choice === "accept"}
            className="nb-btn nb-btn-sm"
          >
            {pending && choice === "accept" ? "Accepting" : "Accept"}
            <span className="sr-only"> {handle}</span>
          </button>
        ) : null}
        <button
          type={armed ? "submit" : "button"}
          name="decision"
          value="reject"
          onClick={() => {
            if (!armed) {
              setArmed(true);
              return;
            }
            setChoice("reject");
          }}
          disabled={pending}
          aria-busy={pending && choice === "reject"}
          aria-describedby={armed ? `${uid}-armed` : undefined}
          className="nb-btn-ghost nb-btn-sm"
          {...armScope}
        >
          {pending && choice === "reject" ? "Rejecting" : armed ? "Yes, reject" : "Reject"}
          <span className="sr-only"> {handle}</span>
        </button>
      </div>
      <p id={`${uid}-armed`} role="status" className="nb-hint mt-2 max-w-[48ch] empty:mt-0" {...armScope}>
        {armed ? `One more click turns down ${handle}. You can’t take it back here.` : null}
      </p>
    </form>
  );
}
