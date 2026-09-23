"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { setAdminRole, type ReviewState } from "@/app/actions/admin-team";

type Role = "admin" | "superadmin";

/** Matches the Reject control on an application. Same rule, same clock. */
const ARMED_MS = 5000;

/**
 * The controls on one row of the team: what they are, and the way out.
 *
 * TWO FORMS, ONE ACTION STATE. `setAdminRole` reads a single `role` field, so
 * the select and the Remove button cannot share a form: two inputs named
 * `role` would put two values in the FormData and `formData.get` returns the
 * first, which is always the select. Separate forms keep each submission
 * unambiguous. They share one `useActionState` on purpose: while either is in
 * flight the other is disabled, because both rewrite the same row.
 *
 * SAVE IS A BUTTON, NOT AN ONCHANGE. A select that fires the moment its value
 * changes gives a keyboard user no way to pass over an option on the way to the
 * one they want, and it leaves the pending state with nothing to hang off. The
 * button stays disabled while the value still matches the row, so it also
 * answers "is there anything to save here".
 *
 * REMOVE ARMS ITSELF rather than opening a browser dialog, the same two-click
 * control the Reject on an application uses. It is `type="button"` until it is
 * armed, so an unarmed click cannot submit even if state and DOM disagreed.
 *
 * Owners and your own row never render this: the action refuses both, and the
 * page decides that before it gets here.
 */
export function MemberControls({
  userId,
  role: current,
  handle,
}: {
  userId: string;
  role: Role;
  handle: string;
}) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(
    setAdminRole,
    undefined
  );
  const [role, setRole] = React.useState<Role>(current);
  const [armed, setArmed] = React.useState(false);
  // Which of the two forms is in flight, for the wording and the toast.
  const [intent, setIntent] = React.useState<"role" | "remove" | null>(null);

  const uid = React.useId();
  const roleId = `${uid}-role`;
  const armedId = `${uid}-armed`;

  // Hands the result to an external system and nothing else, which is what an
  // effect is for. It does not disarm on an error: a failed send is worth
  // retrying with the control still armed, and the timer below clears it
  // either way.
  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success) {
      toast.success(
        intent === "remove"
          ? "Off the team. /admin is shut to them now."
          : "Role saved."
      );
    }
  }, [state, intent]);

  React.useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), ARMED_MS);
    return () => window.clearTimeout(t);
  }, [armed]);

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
        <form action={action} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="userId" value={userId} />
          <div className="nb-field">
            {/* Every row on the team prints a control called "Role" and one
                called "Remove". Tabbing through by control, that is three
                identical names and no way to tell which row you are on, so
                the handle rides along where only a screen reader hears it. */}
            <label className="nb-label" htmlFor={roleId}>
              Role<span className="sr-only"> for {handle}</span>
            </label>
            <select
              id={roleId}
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              disabled={pending}
              className="nb-input nb-select w-auto min-w-[10rem]"
            >
              <option value="admin">admin</option>
              <option value="superadmin">super admin</option>
            </select>
          </div>
          <button
            type="submit"
            onClick={() => setIntent("role")}
            disabled={pending || role === current}
            aria-busy={pending && intent === "role"}
            className="nb-btn nb-btn-sm"
          >
            {pending && intent === "role" ? "Saving" : "Save role"}
            <span className="sr-only"> for {handle}</span>
          </button>
        </form>

        <form action={action}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="role" value="remove" />
          <button
            type={armed ? "submit" : "button"}
            onClick={() => {
              if (!armed) {
                setArmed(true);
                return;
              }
              setIntent("remove");
            }}
            disabled={pending}
            aria-busy={pending && intent === "remove"}
            aria-describedby={armed ? armedId : undefined}
            className="nb-btn-ghost nb-btn-sm"
          >
            {pending && intent === "remove"
              ? "Removing"
              : armed
                ? "Yes, remove"
                : "Remove"}
            <span className="sr-only"> {handle}</span>
          </button>
        </form>
      </div>

      {/* Always in the document, empty until it has something to say. A live
          region inserted at the same moment as its text is announced
          unreliably, and `empty:` takes the margin back when it is silent. */}
      <p id={armedId} role="status" className="nb-hint mt-2 max-w-[48ch] empty:mt-0">
        {armed
          ? `One more click takes ${handle} off the team. They keep their account and their progress, they just lose /admin.`
          : null}
      </p>

      {/* The toast is easy to miss if the drawer has scrolled, so a failure is
          also printed against the row that caused it. */}
      {state?.error ? (
        <p className="nb-error mt-2 max-w-[42ch]">{state.error}</p>
      ) : null}
    </div>
  );
}
