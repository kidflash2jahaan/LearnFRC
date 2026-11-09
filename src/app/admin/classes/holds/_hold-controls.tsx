"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import {
  extendHoldAction,
  holdRecordingLinksAction,
  releaseHoldAction,
  retryHoldCopyAction,
  saveHoldNote,
  type HoldFormState,
} from "./actions";

/**
 * The answers on one hold. Every check is made again on the server
 * (src/lib/classes/holds.ts); these controls are not authorisation.
 */

function useToasts(state: HoldFormState) {
  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.message) toast.success(state.message);
  }, [state]);
}

function Feedback({ state, id }: { state: HoldFormState; id: string }) {
  return (
    <div aria-live="polite">
      {state?.error ? (
        <p id={id} className="nb-error mt-2">
          {state.error}
        </p>
      ) : state?.message ? (
        <p className="nb-slug mt-2">{state.message}</p>
      ) : null}
    </div>
  );
}

/** A dated note, and the CyberTipline report number. */
export function HoldNoteForm({ holdId, ncmecReportId }: { holdId: string; ncmecReportId: string | null }) {
  const [state, dispatch, pending] = useActionState<HoldFormState, FormData>(saveHoldNote, undefined);
  // Controlled, so a refusal never wipes what was typed.
  const [note, setNote] = React.useState("");
  const [ncmec, setNcmec] = React.useState(ncmecReportId ?? "");
  const uid = React.useId();
  useToasts(state);
  // Clear the note once it's saved: adjust state while rendering, when the
  // action's answer changes (React's pattern; no effect needed).
  const [answered, setAnswered] = React.useState(state);
  if (state !== answered) {
    setAnswered(state);
    if (state?.message) setNote("");
  }

  return (
    <form action={dispatch} className="max-w-2xl">
      <input type="hidden" name="holdId" value={holdId} />
      <div className="nb-field">
        <label className="nb-label" htmlFor={`${uid}-note`}>
          What you did
        </label>
        <textarea
          id={`${uid}-note`}
          name="note"
          rows={3}
          maxLength={1000}
          disabled={pending}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-invalid={state?.field === "note" || undefined}
          aria-describedby={state?.field === "note" ? `${uid}-error` : undefined}
          className="nb-input min-h-[5rem]"
        />
        <p className="nb-hint">Dated and signed with your handle. Notes can&rsquo;t be edited later.</p>
      </div>
      <div className="nb-field mt-3">
        <label className="nb-label" htmlFor={`${uid}-ncmec`}>
          CyberTipline report number
        </label>
        <input
          id={`${uid}-ncmec`}
          name="ncmecReportId"
          inputMode="numeric"
          autoComplete="off"
          maxLength={40}
          disabled={pending}
          value={ncmec}
          onChange={(e) => setNcmec(e.target.value)}
          aria-invalid={state?.field === "ncmecReportId" || undefined}
          aria-describedby={state?.field === "ncmecReportId" ? `${uid}-error` : undefined}
          className="nb-input max-w-xs"
        />
      </div>
      <Feedback state={state} id={`${uid}-error`} />
      <button type="submit" disabled={pending} aria-busy={pending} className="nb-btn nb-btn-sm mt-3">
        {pending ? "Saving" : "Save to the hold"}
      </button>
    </form>
  );
}

/** Keep it a year from today, with the reason. */
export function ExtendHoldForm({ holdId }: { holdId: string }) {
  const [state, dispatch, pending] = useActionState<HoldFormState, FormData>(extendHoldAction, undefined);
  const [note, setNote] = React.useState("");
  const uid = React.useId();
  useToasts(state);
  return (
    <form action={dispatch} className="max-w-2xl">
      <input type="hidden" name="holdId" value={holdId} />
      <div className="nb-field">
        <label className="nb-label" htmlFor={`${uid}-why`}>
          Why keep it longer
        </label>
        <input
          id={`${uid}-why`}
          name="note"
          maxLength={1000}
          disabled={pending}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Law enforcement asked, or an NCMEC report was filed"
          aria-invalid={state?.field === "note" || undefined}
          aria-describedby={state?.field === "note" ? `${uid}-error` : undefined}
          className="nb-input"
        />
      </div>
      <Feedback state={state} id={`${uid}-error`} />
      <button type="submit" disabled={pending} aria-busy={pending} className="nb-btn-ghost nb-btn-sm mt-3">
        {pending ? "Extending" : "Keep it a year from today"}
      </button>
    </form>
  );
}

/** The safety lead releases a restricted hold to the super admins. Arms first. */
export function ReleaseHoldForm({ holdId }: { holdId: string }) {
  const [state, dispatch, pending] = useActionState<HoldFormState, FormData>(releaseHoldAction, undefined);
  const [armed, setArmed] = React.useState(false);
  const [note, setNote] = React.useState("");
  const uid = React.useId();
  useToasts(state);
  React.useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 5000);
    return () => window.clearTimeout(t);
  }, [armed]);
  if (state?.message) return <p className="nb-slug">{state.message}</p>;
  return (
    <form action={dispatch} className="max-w-2xl">
      <input type="hidden" name="holdId" value={holdId} />
      <div className="nb-field">
        <label className="nb-label" htmlFor={`${uid}-note`}>
          Note, optional
        </label>
        <input
          id={`${uid}-note`}
          name="note"
          maxLength={1000}
          disabled={pending}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="nb-input"
        />
      </div>
      <Feedback state={state} id={`${uid}-error`} />
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        aria-describedby={armed ? `${uid}-armed` : undefined}
        onClick={(e) => {
          if (!armed) {
            e.preventDefault();
            setArmed(true);
          }
        }}
        className="nb-btn-ghost nb-btn-sm mt-3"
      >
        {pending ? "Releasing" : armed ? "Release it" : "Release to reviewers"}
      </button>
      {armed ? (
        <p id={`${uid}-armed`} className="nb-hint mt-2">
          Super admins will see this hold&rsquo;s transcript, chat and recording. Press again to release.
        </p>
      ) : null}
    </form>
  );
}

export function RetryCopyForm({ holdId }: { holdId: string }) {
  const [state, dispatch, pending] = useActionState<HoldFormState, FormData>(retryHoldCopyAction, undefined);
  useToasts(state);
  return (
    <form action={dispatch}>
      <input type="hidden" name="holdId" value={holdId} />
      <button type="submit" disabled={pending} aria-busy={pending} className="nb-btn-ghost nb-btn-sm">
        {pending ? "Starting" : "Try the copy again"}
      </button>
      <Feedback state={state} id={`retry-${holdId}`} />
    </form>
  );
}

/**
 * The held recording, only when someone asks for it ("watch only as much as
 * you need"). The 15-minute links live in this component's memory: never in
 * the address bar, history or a download.
 */
export function HeldRecordingPlayer({ holdId }: { holdId: string }) {
  const [links, setLinks] = React.useState<{ sessionId: string; url: string }[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  return (
    <div>
      {links ? (
        <ul className="grid gap-4">
          {links.map((l, i) => (
            <li key={l.sessionId}>
              <p className="nb-slug">
                {links.length > 1 ? `part ${i + 1} of ${links.length} / ` : ""}link lasts 15 minutes
              </p>
              <video
                controls
                preload="metadata"
                controlsList="nodownload noremoteplayback"
                disablePictureInPicture
                onContextMenu={(e) => e.preventDefault()}
                src={l.url}
                className="mt-2 w-full max-w-3xl border-2 border-ink bg-ink"
              />
            </li>
          ))}
        </ul>
      ) : (
        <button
          type="button"
          disabled={pending}
          aria-busy={pending}
          className="nb-btn nb-btn-sm"
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const r = await holdRecordingLinksAction(holdId);
              if (r.error) setError(r.error);
              else setLinks(r.links ?? []);
            })
          }
        >
          {pending ? "Opening" : "Watch the kept recording"}
        </button>
      )}
      <div aria-live="polite">{error ? <p className="nb-error mt-2">{error}</p> : null}</div>
    </div>
  );
}
