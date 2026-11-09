"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import {
  classAdminTool,
  classSettingsAction,
  consentLookupAction,
  safetyLeadAction,
  type ClassAdminState,
} from "@/app/actions/class-admin";
import { useArmed } from "@/components/use-armed";

/**
 * The controls on /admin/classes and /admin/classes/[id]. Every check is made
 * again on the server (src/lib/app/admin-classes.ts); hiding a control here is
 * never the gate. Anything that changes a class for other people (End, Hold,
 * Revoke, Pause) arms on the first click and acts on the second, like the
 * reports desk, and stays armed until a click elsewhere, Escape or 10
 * seconds (useArmed, src/components/use-armed.ts).
 */

function useToast(state: ClassAdminState) {
  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.message) toast.success(state.message);
  }, [state]);
}

/** One button that posts `tool` (and `extra` fields) to classAdminTool. */
export function ToolButton({
  tool,
  classId,
  extra,
  label,
  pendingLabel,
  armedText,
  ghost = true,
}: {
  tool: "rerun" | "pull" | "release" | "end" | "revoke" | "visible";
  classId?: string;
  extra?: Record<string, string>;
  label: string;
  pendingLabel: string;
  /** When set, the first click arms and shows this; the second acts. */
  armedText?: string;
  ghost?: boolean;
}) {
  const [state, action, pending] = useActionState<ClassAdminState, FormData>(classAdminTool, undefined);
  const [armed, setArmed, armScope] = useArmed(false);
  const uid = React.useId();
  useToast(state);
  const needsArm = !!armedText;
  return (
    <form action={action} className="min-w-0">
      <input type="hidden" name="tool" value={tool} />
      {classId ? <input type="hidden" name="classId" value={classId} /> : null}
      {Object.entries(extra ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        type={needsArm && !armed ? "button" : "submit"}
        onClick={() => {
          if (needsArm && !armed) setArmed(true);
        }}
        disabled={pending}
        aria-busy={pending}
        aria-describedby={armed ? `${uid}-armed` : undefined}
        className={ghost ? "nb-btn-ghost nb-btn-sm" : "nb-btn nb-btn-sm"}
        {...armScope}
      >
        {pending ? pendingLabel : armed ? `Yes, ${label.toLowerCase()}` : label}
      </button>
      <p id={`${uid}-armed`} role="status" className="nb-hint mt-1.5 max-w-[46ch] empty:mt-0" {...armScope}>
        {armed ? armedText : null}
      </p>
      {state?.error ? <p className="nb-error mt-1.5 max-w-[46ch]">{state.error}</p> : null}
    </form>
  );
}

/** "Hold this class", with an optional note for the hold. */
export function HoldForm({ classId, held }: { classId: string; held: number }) {
  const [state, action, pending] = useActionState<ClassAdminState, FormData>(classAdminTool, undefined);
  const [armed, setArmed, armScope] = useArmed(false);
  const [note, setNote] = React.useState("");
  const uid = React.useId();
  useToast(state);
  return (
    <form action={action} className="max-w-xl">
      <input type="hidden" name="tool" value="hold" />
      <input type="hidden" name="classId" value={classId} />
      <div className="nb-field">
        <label className="nb-label" htmlFor={`${uid}-note`}>
          Note for the hold, optional
        </label>
        <input
          id={`${uid}-note`}
          name="note"
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={pending}
          className="nb-input"
        />
        <p className="nb-hint">
          {held > 0 ? `${held} ${held === 1 ? "hold already exists" : "holds already exist"} for this class.` : "Keeps the transcript, chat and recording for a year."}
        </p>
      </div>
      <button
        type={armed ? "submit" : "button"}
        onClick={() => {
          if (!armed) setArmed(true);
        }}
        disabled={pending}
        aria-busy={pending}
        className="nb-btn-ghost nb-btn-sm mt-2"
        {...armScope}
      >
        {pending ? "Holding" : armed ? "Yes, hold this class" : "Hold this class"}
      </button>
      <p role="status" className="nb-hint mt-1.5 empty:mt-0" {...armScope}>
        {armed ? "One more click keeps this class's evidence for a year." : null}
      </p>
      {state?.error ? <p className="nb-error mt-1.5">{state.error}</p> : null}
    </form>
  );
}

/** The emergency stop and its reason. Pausing ends every live class. */
export function PauseForm({ paused, reason }: { paused: boolean; reason: string | null }) {
  const [state, action, pending] = useActionState<ClassAdminState, FormData>(classAdminTool, undefined);
  const [armed, setArmed, armScope] = useArmed(false);
  const [why, setWhy] = React.useState("");
  const uid = React.useId();
  useToast(state);
  return (
    <form action={action} className="max-w-xl">
      <input type="hidden" name="tool" value="pause" />
      <input type="hidden" name="paused" value={paused ? "0" : "1"} />
      {!paused ? (
        <div className="nb-field">
          <label className="nb-label" htmlFor={`${uid}-reason`}>
            Why, for the log
          </label>
          <input
            id={`${uid}-reason`}
            name="reason"
            maxLength={200}
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            disabled={pending}
            aria-invalid={state?.field === "reason" || undefined}
            className="nb-input"
          />
        </div>
      ) : (
        <p className="nb-hint">Paused{reason ? `: ${reason}` : ""}.</p>
      )}
      <button
        type={!paused && !armed ? "button" : "submit"}
        onClick={() => {
          if (!paused && !armed) setArmed(true);
        }}
        disabled={pending}
        aria-busy={pending}
        className={paused ? "nb-btn nb-btn-sm mt-2" : "nb-btn-ghost nb-btn-sm mt-2"}
        {...armScope}
      >
        {pending ? "Saving" : paused ? "Open joins" : armed ? "Yes, pause and end live classes" : "Pause all classes"}
      </button>
      <p role="status" className="nb-hint mt-1.5 empty:mt-0" {...armScope}>
        {armed ? "One more click stops every join and ends every live class right now." : null}
      </p>
      {state?.error ? <p className="nb-error mt-1.5">{state.error}</p> : null}
    </form>
  );
}

/** Cap, live-class limit and minimum account age. Super admins only (checked on the server). */
export function SettingsForm({
  monthlyMinuteCap,
  maxLiveClasses,
  minStudentAccountDays,
}: {
  monthlyMinuteCap: number;
  maxLiveClasses: number;
  minStudentAccountDays: number;
}) {
  const [state, action, pending] = useActionState<ClassAdminState, FormData>(classSettingsAction, undefined);
  const uid = React.useId();
  useToast(state);
  const field = (name: string, label: string, value: number, hint: string) => (
    <div className="nb-field">
      <label className="nb-label" htmlFor={`${uid}-${name}`}>
        {label}
      </label>
      <input
        id={`${uid}-${name}`}
        name={name}
        type="number"
        inputMode="numeric"
        defaultValue={value}
        disabled={pending}
        aria-invalid={state?.field === name || undefined}
        className="nb-input max-w-[12rem]"
      />
      <p className="nb-hint">{hint}</p>
    </div>
  );
  return (
    <form action={action} className="grid max-w-xl gap-3">
      {field("monthlyMinuteCap", "Participant-minutes a month", monthlyMinuteCap, "Joins stop once the month reaches it. You get a warning at 75%.")}
      {field("maxLiveClasses", "Classes live at once", maxLiveClasses, "Scheduling refuses a class that would go over it.")}
      {field("minStudentAccountDays", "Minimum student account age, in days", minStudentAccountDays, "Newer students don't count toward a teacher's minutes.")}
      <div>
        <button type="submit" disabled={pending} aria-busy={pending} className="nb-btn nb-btn-sm">
          {pending ? "Saving" : "Save settings"}
        </button>
      </div>
      {state?.error ? <p className="nb-error">{state.error}</p> : null}
    </form>
  );
}

/** Who the safety lead is, by username. Empty clears it. */
export function SafetyLeadForm({ current }: { current: string | null }) {
  const [state, action, pending] = useActionState<ClassAdminState, FormData>(safetyLeadAction, undefined);
  const uid = React.useId();
  useToast(state);
  return (
    <form action={action} className="max-w-xl">
      <div className="nb-field">
        <label className="nb-label" htmlFor={`${uid}-handle`}>
          Safety lead&rsquo;s username
        </label>
        <input
          id={`${uid}-handle`}
          name="handle"
          defaultValue={current ?? ""}
          placeholder="@username"
          autoComplete="off"
          disabled={pending}
          aria-invalid={state?.field === "handle" || undefined}
          className="nb-input max-w-[20rem]"
        />
        <p className="nb-hint">
          They get the class pages, restricted reviews and every urgent email. Nothing else in /admin. They have to be an
          adult: before you set them, they sign in and answer the age question on /classes/ready as 18 or older.
        </p>
      </div>
      <button type="submit" disabled={pending} aria-busy={pending} className="nb-btn nb-btn-sm mt-2">
        {pending ? "Saving" : "Save"}
      </button>
      {state?.error ? <p className="nb-error mt-1.5">{state.error}</p> : null}
    </form>
  );
}

/** Parent OK lookup by @handle, with Revoke. */
export function ConsentLookup() {
  const [state, action, pending] = useActionState<ClassAdminState, FormData>(consentLookupAction, undefined);
  const uid = React.useId();
  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);
  return (
    <div className="max-w-3xl">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="nb-field min-w-0 flex-1">
          <label className="nb-label" htmlFor={`${uid}-handle`}>
            Student&rsquo;s username
          </label>
          <input
            id={`${uid}-handle`}
            name="handle"
            placeholder="@username"
            autoComplete="off"
            disabled={pending}
            className="nb-input max-w-[20rem]"
          />
        </div>
        <button type="submit" disabled={pending} aria-busy={pending} className="nb-btn nb-btn-sm">
          {pending ? "Looking" : "Look up"}
        </button>
      </form>
      <div aria-live="polite">
        {state?.message ? <p className="nb-hint mt-3">{state.message}</p> : null}
        {state?.rows?.length ? (
          <ul className="mt-4">
            {state.rows.map((c) => (
              <li key={c.id} className="nb-hair flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-bold">
                    @{c.studentHandle} <span className="nb-tag ml-1">{c.status}</span>
                    {c.sameNetwork ? <span className="nb-tag ml-1">same network</span> : null}
                  </p>
                  <p className="nb-slug mt-1 break-all">
                    {c.parentEmail}
                    {c.parentName ? ` / ${c.parentName}` : ""} / sent {c.sentAt.slice(0, 10)}
                    {c.decidedAt ? ` / decided ${c.decidedAt.slice(0, 10)}` : ""}
                  </p>
                </div>
                {c.status === "agreed" || c.status === "sent" ? (
                  <ToolButton
                    tool="revoke"
                    extra={{ consentId: c.id }}
                    label="Revoke"
                    pendingLabel="Revoking"
                    armedText={`One more click revokes @${c.studentHandle}'s parent OK. They can't join a class until a parent says OK again.`}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
