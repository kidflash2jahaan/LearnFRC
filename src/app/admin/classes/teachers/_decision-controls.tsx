"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { decideTeacherApplicationAction, type TeachFormState } from "@/app/actions/class-teachers";

/** How long the armed Reject stays armed, as on /admin/team. */
const ARMED_MS = 5000;

/**
 * Accept or reject one teacher application, with a note that rides along in
 * the email. The same two-click Reject as /admin/team's ReviewControls: it is
 * `type="button"` until armed. Accepting copies the name to the locked letter
 * name. decideTeacherApplication re-checks the role and the status.
 */
export function DecisionControls({ id, handle, legalName }: { id: string; handle: string; legalName: string }) {
  const [state, action, pending] = useActionState<TeachFormState, FormData>(
    decideTeacherApplicationAction,
    undefined
  );
  const [choice, setChoice] = React.useState<"accept" | "reject" | null>(null);
  const [armed, setArmed] = React.useState(false);
  const [note, setNote] = React.useState("");
  const decided = state?.success ? choice : null;
  const uid = React.useId();
  const noteError = state?.field === "note";

  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success)
      toast.success(choice === "reject" ? "Turned down. The email is on its way." : "Accepted. The email is on its way.");
  }, [state, choice]);

  React.useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), ARMED_MS);
    return () => window.clearTimeout(t);
  }, [armed]);

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
          Accepting locks &ldquo;{legalName}&rdquo; as the name on their hours letters. Only a super admin can
          change it after, with a note.
        </p>
      </div>
      <div aria-live="polite">{state?.error ? <p className="nb-error mt-2">{state.error}</p> : null}</div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
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
        >
          {pending && choice === "reject" ? "Rejecting" : armed ? "Yes, reject" : "Reject"}
          <span className="sr-only"> {handle}</span>
        </button>
      </div>
      <p id={`${uid}-armed`} role="status" className="nb-hint mt-2 max-w-[48ch] empty:mt-0">
        {armed ? `One more click turns down ${handle}. You can’t take it back here.` : null}
      </p>
    </form>
  );
}
