"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { removeMarketer, type ReviewState } from "@/app/actions/admin-team";

/** Matches the Reject on an application and the Remove on the admin team. */
const ARMED_MS = 5000;

/**
 * Taking the marketing tag off one marketer.
 *
 * The same two-click control as the admin team's Remove, for the same reason:
 * a browser dialog is the only chrome on the site that would not be drawn by
 * hand. It is `type="button"` until it is armed, so an unarmed click cannot
 * submit even if state and DOM disagreed. The action re-checks the role
 * (removeMarketerFor in src/lib/app/admin-apply-marketing.ts); hiding this
 * from anyone else is not the gate.
 */
export function MarketerControls({ userId, handle }: { userId: string; handle: string }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(
    removeMarketer,
    undefined
  );
  const [armed, setArmed] = React.useState(false);
  const uid = React.useId();
  const armedId = `${uid}-armed`;

  // Hands the result to an external system and nothing else. It does not
  // disarm on an error: a failed send is worth retrying with the control
  // still armed, and the timer below clears it either way.
  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success) toast.success("Tag removed. Their account and progress stay.");
  }, [state]);

  React.useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), ARMED_MS);
    return () => window.clearTimeout(t);
  }, [armed]);

  return (
    <div className="min-w-0">
      <form action={action}>
        <input type="hidden" name="userId" value={userId} />
        <button
          type={armed ? "submit" : "button"}
          onClick={() => {
            if (!armed) setArmed(true);
          }}
          disabled={pending}
          aria-busy={pending}
          aria-describedby={armed ? armedId : undefined}
          className="nb-btn-ghost nb-btn-sm"
        >
          {pending ? "Removing" : armed ? "Yes, remove" : "Remove"}
          <span className="sr-only"> {handle}</span>
        </button>
      </form>

      {/* Always in the document, empty until it has something to say. A live
          region inserted at the same moment as its text is announced
          unreliably, and `empty:` takes the margin back when it is silent. */}
      <p id={armedId} role="status" className="nb-hint mt-2 max-w-[48ch] empty:mt-0">
        {armed
          ? `One more click takes the marketing tag off ${handle}. They keep their account, their progress and the signups already counted.`
          : null}
      </p>

      {state?.error ? (
        <p className="nb-error mt-2 max-w-[42ch]">{state.error}</p>
      ) : null}
    </div>
  );
}
