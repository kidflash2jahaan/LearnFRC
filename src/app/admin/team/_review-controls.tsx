"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { reviewAdminApplication, type ReviewState } from "@/app/actions/admin-team";

/**
 * How long the armed Reject stays armed. Long enough to read the line under it
 * and click again, short enough that a control left armed and forgotten is back
 * to being safe before anyone comes back to the tab.
 */
const ARMED_MS = 5000;

/**
 * The one answer an old application can get, plus the note that rides along
 * in the email. Applying on /apply closed on 2026-11-09, so there is no
 * Accept: the server refuses one anyway.
 *
 * THE REJECT IS A TWO-CLICK CONTROL, not a `confirm()`. A browser dialog is a
 * different visual language, it cannot be styled, and on this page it would be
 * the only chrome on the site that is not drawn by hand. So the button arms
 * itself instead: the first click changes the word and prints what is about to
 * happen and to whom, the second sends it. It is literally `type="button"`
 * until it is armed, so an unarmed click cannot submit the form even if the
 * state and the DOM ever disagreed. The decision is re-checked server-side in
 * `reviewAdminApplication`; the shape of this control is not authorisation.
 */
export function ReviewControls({ id, handle }: { id: string; handle: string }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(
    reviewAdminApplication,
    undefined
  );
  const [armed, setArmed] = React.useState(false);
  // CONTROLLED, and that is load-bearing. React calls `requestFormReset` on
  // every `<form action={fn}>` dispatch, before the action runs, and commits it
  // whichever way the action answers. An uncontrolled textarea would therefore
  // be wiped by a refusal, so somebody who wrote a long note and got "Keep the
  // note under 1000 characters" back would have nothing left to shorten.
  const [note, setNote] = React.useState("");

  const uid = React.useId();
  const noteId = `${uid}-note`;
  const armedId = `${uid}-armed`;
  const errorId = `${uid}-error`;

  // Only errors ABOUT the note mark the note. Most refusals here ("that one
  // has already been decided", a lapsed session) have nothing to do with what
  // is in the box.
  const noteError = state?.field === "note";

  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success) toast.success("Turned down. They’ll get an email.");
  }, [state]);

  React.useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), ARMED_MS);
    return () => window.clearTimeout(t);
  }, [armed]);

  // The server revalidates this route on success, so the whole entry is about
  // to disappear from the list. This is the bridge until it does. No
  // `role="status"`, because the toast above already announced it.
  if (state?.success) {
    return (
      <p className="nb-slug mt-4">
        <b className="text-ink">turned down</b>, the email is on its way
      </p>
    );
  }

  return (
    <form action={action} className="mt-4 max-w-2xl">
      <input type="hidden" name="id" value={id} />

      <div className="nb-field">
        {/* The handle rides along where only a screen reader hears it, so
            tabbing through several entries says which one you are on. */}
        <label className="nb-label" htmlFor={noteId}>
          Note to them, optional; it goes in the email
          <span className="sr-only"> to {handle}</span>
        </label>
        <textarea
          id={noteId}
          name="note"
          rows={2}
          maxLength={1000}
          disabled={pending}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-invalid={noteError || undefined}
          aria-describedby={noteError ? errorId : undefined}
          className="nb-input min-h-[4.5rem]"
        />
        <p className="nb-hint">Leave it blank and the email still goes.</p>
      </div>

      {/* Always in the document and empty until it has something to say: a
          live region inserted at the same moment as its text is announced
          unreliably. */}
      <div aria-live="polite">
        {state?.error ? (
          <p id={errorId} className="nb-error mt-2">
            {state.error}
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type={armed ? "submit" : "button"}
          name="decision"
          value="reject"
          onClick={() => {
            if (!armed) setArmed(true);
          }}
          disabled={pending}
          aria-busy={pending}
          aria-describedby={armed ? armedId : undefined}
          className="nb-btn-ghost nb-btn-sm"
        >
          {pending ? "Rejecting" : armed ? "Yes, reject" : "Reject"}
          <span className="sr-only"> {handle}</span>
        </button>
      </div>

      <p id={armedId} role="status" className="nb-hint mt-2 max-w-[48ch] empty:mt-0">
        {armed ? `One more click turns down ${handle}. You can’t take it back here.` : null}
      </p>
    </form>
  );
}
