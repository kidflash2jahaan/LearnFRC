"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { reviewAdminApplication, type ReviewState } from "@/app/actions/admin-team";

type Decision = "accept" | "reject";

/**
 * How long the armed Reject stays armed. Long enough to read the line under it
 * and click again, short enough that a control left armed and forgotten is back
 * to being safe before anyone comes back to the tab.
 */
const ARMED_MS = 5000;

/**
 * The two answers at the bottom of an application, plus the note that rides
 * along in the email.
 *
 * THE REJECT IS A TWO-CLICK CONTROL, not a `confirm()`. A browser dialog is a
 * different visual language, it cannot be styled, and on this page it would be
 * the only chrome on the site that is not drawn by hand. So the button arms
 * itself instead: the first click changes the word and prints what is about to
 * happen and to whom, the second sends it. It is literally `type="button"`
 * until it is armed, so an unarmed click cannot submit the form even if the
 * state and the DOM ever disagreed.
 *
 * Accept is the filled button and Reject is the ghost, which is the kit's rule
 * about one primary action per view rather than a judgement about which answer
 * is correct. The decision itself is re-checked server-side in
 * `reviewAdminApplication`; the shape of these controls is not authorisation.
 */
export function ReviewControls({ id, handle }: { id: string; handle: string }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(
    reviewAdminApplication,
    undefined
  );
  // Which button is in flight. The action takes the decision out of the
  // submitter's name/value, so this is only ever used for the wording.
  const [choice, setChoice] = React.useState<Decision | null>(null);
  const [armed, setArmed] = React.useState(false);
  // CONTROLLED, and that is load-bearing. React calls `requestFormReset` on
  // every `<form action={fn}>` dispatch, before the action runs, and commits it
  // whichever way the action answers. An uncontrolled textarea would therefore
  // be wiped by a refusal, so somebody who wrote four paragraphs of rejection
  // and got "Keep the note under 1000 characters" back would have nothing left
  // to shorten. The two long answers on /apply are controlled for this reason.
  const [note, setNote] = React.useState("");

  // Derived, not stored: the answer is whatever the button that just succeeded
  // was asking for. A second piece of state set from an effect would be the
  // same fact written down twice and a cascading render to keep them in step.
  const decided: Decision | null = state?.success ? choice : null;

  const uid = React.useId();
  const noteId = `${uid}-note`;
  const armedId = `${uid}-armed`;
  const errorId = `${uid}-error`;

  // Only errors ABOUT the note mark the note. Four of the five refusals this
  // action can give ("that one has already been decided", a lapsed session)
  // have nothing to do with what is in the box, and putting the invalid border
  // round a perfectly good paragraph tells a screen reader the same untruth.
  // The action says which field it means rather than the UI matching strings.
  const noteError = state?.field === "note";

  // The only thing this effect does is hand the result to an external system,
  // which is what an effect is for. It deliberately does NOT disarm on an
  // error: most of the failures here are fixable in place ("keep the note
  // under 1000 characters"), and making someone re-arm a control they already
  // armed to retry the same send is a punishment for the server's mistake.
  // The timer below disarms it either way.
  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success) {
      toast.success(
        choice === "reject"
          ? "Turned down. The email is on its way."
          : "Accepted. They can open /admin now."
      );
    }
  }, [state, choice]);

  React.useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), ARMED_MS);
    return () => window.clearTimeout(t);
  }, [armed]);

  // The server revalidates this route on success, so the whole entry is about
  // to disappear from the waiting list. This is the bridge until it does: the
  // controls must not still be sitting there offering a second answer. No
  // `role="status"` on it, because the toast above already announced this and
  // saying it twice is worse than saying it once.
  if (decided) {
    return (
      <p className="nb-slug mt-4">
        <b className="text-ink">{decided === "reject" ? "turned down" : "accepted"}</b>
        , the email is on its way
      </p>
    );
  }

  return (
    <form action={action} className="mt-4 max-w-2xl">
      <input type="hidden" name="id" value={id} />

      <div className="nb-field">
        {/* Every waiting application prints a field called "Note" and buttons
            called "Accept" and "Reject". Tabbing through by control, that is
            three identical names and no way to tell which application you are
            on, so the handle rides along where only a screen reader hears it. */}
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
        <p className="nb-hint">
          They see this whichever way you answer. Leave it blank and the email
          still goes.
        </p>
      </div>

      {/* The toast is easy to miss if the drawer has scrolled, so a failure is
          also printed against the control that caused it. Always in the
          document and empty until it has something to say, which is what
          ReportForm does: a live region inserted at the same moment as its text
          is announced unreliably. */}
      <div aria-live="polite">
        {state?.error ? (
          <p id={errorId} className="nb-error mt-2">
            {state.error}
          </p>
        ) : null}
      </div>

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
          aria-describedby={armed ? armedId : undefined}
          className="nb-btn-ghost nb-btn-sm"
        >
          {pending && choice === "reject"
            ? "Rejecting"
            : armed
              ? "Yes, reject"
              : "Reject"}
          <span className="sr-only"> {handle}</span>
        </button>
      </div>

      {/* Always in the document, empty until it has something to say. A live
          region that is inserted at the same moment as its text is announced
          unreliably, and `empty:` takes the margin back when it is silent. */}
      <p id={armedId} role="status" className="nb-hint mt-2 max-w-[48ch] empty:mt-0">
        {armed
          ? `One more click turns down ${handle}. You can’t take it back here.`
          : null}
      </p>
    </form>
  );
}
