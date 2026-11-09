"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { answerReport, type DeskState } from "@/app/actions/safety";
import { useArmed } from "@/components/use-armed";

type Action = "resolve" | "remove" | "ban";

/**
 * The three answers under a report, with the note that rides along into the
 * log. Close is one click, because it changes nothing anyone can see. Remove
 * and Ban arm first, like the review desk's Reject: the first click says what
 * is about to happen, the second does it, and the warning stays until a click
 * elsewhere, Escape or 10 seconds (useArmed). Ban only appears for a super admin,
 * and only while the account still exists. Every check is made again on the
 * server (src/lib/app/admin-reports.ts); these controls are not authorisation.
 */
export function ReportControls({
  id,
  handle,
  isProfile,
  canBan,
  accountExists,
  suggestReplace,
  classRole = null,
}: {
  id: string;
  /** "@maya_254", or "this account". */
  handle: string;
  isProfile: boolean;
  canBan: boolean;
  accountExists: boolean;
  /** Tick "replace the username" to start with (an offensive handle or an impersonation). */
  suggestReplace: boolean;
  /**
   * For a live-class report, the reported person's place in the class
   * ("teacher", "student" or "staff"). Remove is then the class action: a
   * student is taken out of the class, and a teacher's teaching is suspended.
   */
  classRole?: string | null;
}) {
  const [state, dispatch, pending] = useActionState<DeskState, FormData>(answerReport, undefined);
  const [choice, setChoice] = React.useState<Action | null>(null);
  const [armed, setArmed, armScope] = useArmed<Action | null>(null);
  // Controlled, so a refusal never wipes it (see the review desk's note).
  const [note, setNote] = React.useState("");
  const [replace, setReplace] = React.useState(suggestReplace);

  const uid = React.useId();
  const noteId = `${uid}-note`;
  const replaceId = `${uid}-replace`;
  const armedId = `${uid}-armed`;
  const errorId = `${uid}-error`;

  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.message) toast.success(state.message);
  }, [state]);

  if (state?.message) {
    return <p className="nb-slug mt-4">{state.message}</p>;
  }

  const arming = (a: Action) => (e: React.MouseEvent<HTMLButtonElement>) => {
    if (armed !== a) {
      e.preventDefault();
      setArmed(a);
      return;
    }
    setChoice(a);
  };

  return (
    <form action={dispatch} className="mt-4 max-w-2xl">
      <input type="hidden" name="id" value={id} />

      <div className="nb-field">
        <label className="nb-label" htmlFor={noteId}>
          Note for the log, optional
          <span className="sr-only"> about the report on {handle}</span>
        </label>
        <textarea
          id={noteId}
          name="note"
          rows={2}
          maxLength={1000}
          disabled={pending}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-invalid={state?.field === "note" || undefined}
          aria-describedby={state?.field === "note" ? errorId : undefined}
          className="nb-input min-h-[4rem]"
        />
        <p className="nb-hint">Nobody but the admin team reads it. Nothing is emailed.</p>
      </div>

      {isProfile && accountExists ? (
        <label
          htmlFor={replaceId}
          className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 text-[0.95rem] leading-snug"
        >
          <input
            id={replaceId}
            type="checkbox"
            name="replaceUsername"
            checked={replace}
            onChange={(e) => setReplace(e.target.checked)}
            disabled={pending}
            className="mt-0.5 size-4 shrink-0"
          />
          <span>When removing, also replace the username with a member number</span>
        </label>
      ) : null}

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
          name="action"
          value="resolve"
          onClick={() => {
            setChoice("resolve");
            setArmed(null);
          }}
          disabled={pending}
          aria-busy={pending && choice === "resolve"}
          className="nb-btn-ghost nb-btn-sm"
        >
          {pending && choice === "resolve" ? "Closing" : "Close, nothing to remove"}
          <span className="sr-only"> for {handle}</span>
        </button>

        {accountExists || !isProfile ? (
          <button
            type="submit"
            name="action"
            value="remove"
            onClick={arming("remove")}
            disabled={pending}
            aria-busy={pending && choice === "remove"}
            aria-describedby={armed === "remove" ? armedId : undefined}
            className="nb-btn nb-btn-sm"
            {...armScope}
          >
            {pending && choice === "remove"
              ? "Removing"
              : armed === "remove"
                ? "Yes, do it"
                : classRole === "teacher"
                  ? "Suspend their teaching"
                  : classRole
                    ? "Remove from the class"
                    : "Remove the content"}
            <span className="sr-only"> for {handle}</span>
          </button>
        ) : null}

        {canBan && accountExists ? (
          <button
            type="submit"
            name="action"
            value="ban"
            onClick={arming("ban")}
            disabled={pending}
            aria-busy={pending && choice === "ban"}
            aria-describedby={armed === "ban" ? armedId : undefined}
            className="nb-btn-ghost nb-btn-sm"
            {...armScope}
          >
            {pending && choice === "ban"
              ? "Banning"
              : armed === "ban"
                ? `Yes, ban ${handle}`
                : `Ban ${handle}`}
          </button>
        ) : null}
      </div>

      <p id={armedId} role="status" className="nb-hint mt-2 max-w-[52ch] empty:mt-0" {...armScope}>
        {armed === "remove"
          ? classRole === "teacher"
            ? `One more click suspends ${handle}'s teaching, cancels their upcoming classes, ends this class if it's still on, and closes every open report about them in it.`
            : classRole
              ? `One more click takes ${handle} out of the class for good and closes every open report about them in it.`
              : isProfile
                ? `One more click clears ${handle}'s bio and picture${replace ? " and replaces the username" : ""}, and closes every open report about it.`
                : "One more click clears their words from the change log, turns it down if it's still waiting, and closes every open report about it."
          : armed === "ban"
            ? `One more click bans ${handle}'s email, deletes the account and everything in it, and closes every report about them. It can't be undone.`
            : null}
      </p>
    </form>
  );
}
