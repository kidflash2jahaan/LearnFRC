"use client";

import * as React from "react";
import { useActionState } from "react";
import { reportContent, type ReportState } from "@/app/actions/safety";

/**
 * One of REPORT_REASONS or CLASS_REPORT_REASONS (src/lib/report-reasons.ts),
 * which fileReport checks against: a class report may use the class-only
 * three, anything else the usual six.
 */
export type ReasonOption = { id: string; label: string };

/**
 * "Report", folded to one quiet button until somebody needs it, then a short
 * form in place: a reason, a line of detail, Send.
 *
 * In place rather than in a dialog, the way the review desk's two-click Reject
 * is: a browser dialog can't be drawn by hand, and a modal for three controls
 * is more chrome than the job. Everything about the report itself (the reasons
 * it accepts, the lengths, one open report per person per thing, the rate
 * limit, the email to the owner) is decided by fileReport on the server, and
 * the sentence shown afterwards is the server's.
 */
export function ReportControl({
  reasons,
  username,
  contentKind = "profile",
  contentId,
  surface,
  label,
  what,
  defaultOpen = false,
}: {
  /** REPORT_REASONS, or CLASS_REPORT_REASONS for a class report. */
  reasons: readonly ReasonOption[];
  /** The person reported (a profile or a class report). */
  username?: string;
  contentKind?: "profile" | "edit" | "submission" | "class";
  /** The edit's or proposal's id, or the class's. */
  contentId?: string;
  surface: "profile" | "contributions" | "team" | "leaderboard" | "class";
  /** The closed button's words, e.g. "Report @maya_254". */
  label: string;
  /** What is being reported, for the heading: "this profile", "this suggestion". */
  what: string;
  /** Start with the form open (the class report panel, once a person is picked). */
  defaultOpen?: boolean;
}) {
  const [state, action, pending] = useActionState<ReportState, FormData>(reportContent, undefined);
  const [open, setOpen] = React.useState(defaultOpen);
  // Controlled, so a refusal ("Tell us a little about what's wrong") never
  // wipes what was typed: React resets an uncontrolled form on every dispatch.
  const [reason, setReason] = React.useState("");
  const [details, setDetails] = React.useState("");

  const uid = React.useId();
  const reasonId = `${uid}-reason`;
  const detailsId = `${uid}-details`;
  const errorId = `${uid}-error`;
  const doneRef = React.useRef<HTMLDivElement>(null);
  const firstRef = React.useRef<HTMLSelectElement>(null);

  React.useEffect(() => {
    if (state?.success) doneRef.current?.focus();
  }, [state]);
  React.useEffect(() => {
    if (open) firstRef.current?.focus();
  }, [open]);

  if (state?.success) {
    return (
      <div ref={doneRef} tabIndex={-1} role="status" className="nb-note max-w-[52ch]">
        <p className="nb-slug">report / sent</p>
        <p className="mt-1.5 text-[0.95rem] leading-snug">{state.message}</p>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="nb-btn-ghost nb-btn-sm">
        {label}
      </button>
    );
  }

  return (
    <form action={action} className="nb-box w-full max-w-[34rem] p-[clamp(1rem,2.4vw,1.4rem)]">
      <p className="nb-slug">report / {what}</p>
      <input type="hidden" name="contentKind" value={contentKind} />
      <input type="hidden" name="surface" value={surface} />
      {username ? <input type="hidden" name="username" value={username} /> : null}
      {contentId ? <input type="hidden" name="contentId" value={contentId} /> : null}

      <div className="nb-field mt-3">
        <label htmlFor={reasonId} className="nb-label">
          What&rsquo;s wrong with it?
        </label>
        <select
          ref={firstRef}
          id={reasonId}
          name="reason"
          required
          disabled={pending}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={state?.field === "reason" || undefined}
          aria-describedby={state?.field === "reason" ? errorId : undefined}
          className="nb-input nb-select"
        >
          <option value="" disabled>
            Pick a reason
          </option>
          {reasons.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="nb-field mt-3">
        <label htmlFor={detailsId} className="nb-label">
          {reason === "other" ? "Tell us what's wrong" : "Anything to add, optional"}
        </label>
        <textarea
          id={detailsId}
          name="details"
          rows={3}
          maxLength={1000}
          disabled={pending}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          aria-invalid={state?.field === "details" || undefined}
          aria-describedby={state?.field === "details" ? errorId : undefined}
          className="nb-input min-h-[4.5rem]"
        />
        <p className="nb-hint">
          It goes to the LearnFRC team, who read every report within 24 hours. The
          person you report isn&rsquo;t told who sent it.
        </p>
      </div>

      <div aria-live="polite">
        {state?.error ? (
          <p id={errorId} className="nb-error mt-2">
            {state.error}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" className="nb-btn nb-btn-sm" disabled={pending} aria-busy={pending}>
          {pending ? "Sending" : "Send report"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="nb-btn-ghost nb-btn-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
