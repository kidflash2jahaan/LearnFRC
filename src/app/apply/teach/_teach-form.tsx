"use client";

import * as React from "react";
import { useActionState } from "react";
import { applyToTeach, type TeachFormState } from "@/app/actions/class-teachers";
import { TEACHER_CODE } from "@/lib/classes/notice";
import { TEACHER_APPLY_LIMITS } from "@/lib/classes/teacher-rules";

/**
 * The teacher application, ruled onto the page like /apply's form (the same
 * `.nb-field` pieces, a taped receipt on success, focus moved onto it).
 *
 * EVERY FIELD IS CONTROLLED, for the reason /apply's form gives: React resets
 * a `<form action={fn}>` on every dispatch, whichever way the action answers,
 * so an uncontrolled field would be emptied by a refusal. The limits are the
 * server's (TEACHER_APPLY_LIMITS, shared); submitTeacherApplication checks
 * every one again.
 */

const L = TEACHER_APPLY_LIMITS;

export type TopicGroup = {
  id: string;
  name: string;
  modules: { id: string; title: string }[];
};

function useField(initial = "") {
  const [value, setValue] = React.useState(initial);
  const [left, setLeft] = React.useState(false);
  return { value, setValue, left, setLeft };
}

function LongAnswer({
  id,
  name,
  label,
  hint,
  placeholder,
  rows,
  disabled,
  serverError,
}: {
  id: string;
  name: string;
  label: string;
  hint: string;
  placeholder: string;
  rows: number;
  disabled: boolean;
  serverError: boolean;
}) {
  const f = useField();
  const trimmed = f.value.trim().length;
  const short = trimmed < L.longMin;
  const showError = f.left && short;
  const missing = L.longMin - trimmed;
  return (
    <div className="nb-field">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label htmlFor={id} className="nb-label">
          {label}
        </label>
        <span id={`${id}-count`} className="nb-slug tabular-nums">
          {short ? `${trimmed} / ${L.longMin} minimum` : `${f.value.length} / ${L.longMax}`}
        </span>
      </div>
      <textarea
        id={id}
        name={name}
        rows={rows}
        maxLength={L.longMax}
        disabled={disabled}
        value={f.value}
        onChange={(e) => f.setValue(e.target.value)}
        onBlur={() => f.setLeft(true)}
        placeholder={placeholder}
        aria-describedby={`${id}-hint ${id}-count${showError ? ` ${id}-error` : ""}`}
        aria-invalid={showError || serverError || undefined}
        className="nb-input"
      />
      <p id={`${id}-hint`} className="nb-hint">
        {hint}
      </p>
      {showError && (
        <p id={`${id}-error`} className="nb-error">
          Say a bit more, at least {missing} more {missing === 1 ? "character" : "characters"}.
        </p>
      )}
    </div>
  );
}

function ShortField({
  id,
  name,
  label,
  hint,
  placeholder,
  maxLength,
  disabled,
  serverError,
  type = "text",
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  placeholder?: string;
  maxLength: number;
  disabled: boolean;
  serverError: boolean;
  type?: "text" | "email";
  autoComplete?: string;
}) {
  const f = useField();
  return (
    <div className="nb-field">
      <label htmlFor={id} className="nb-label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        maxLength={maxLength}
        disabled={disabled}
        value={f.value}
        onChange={(e) => f.setValue(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-describedby={hint ? `${id}-hint` : undefined}
        aria-invalid={serverError || undefined}
        className="nb-input"
      />
      {hint ? (
        <p id={`${id}-hint`} className="nb-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Up to five modules from the catalog, one folded drawer per department.
 * Folded drawers still submit their boxes; once five are ticked the rest
 * are disabled, and the count says why.
 */
function TopicPicker({
  groups,
  disabled,
  serverError,
}: {
  groups: TopicGroup[];
  disabled: boolean;
  serverError: boolean;
}) {
  const [picked, setPicked] = React.useState<string[]>([]);
  const full = picked.length >= L.maxTopicIds;
  const uid = React.useId();
  const toggle = (id: string, on: boolean) =>
    setPicked((p) => (on ? (p.includes(id) ? p : [...p, id]) : p.filter((x) => x !== id)));
  return (
    <fieldset className="nb-field" aria-describedby={`${uid}-count`} aria-invalid={serverError || undefined}>
      <legend className="nb-label">Pick up to {L.maxTopicIds} modules you could teach, optional</legend>
      <p id={`${uid}-count`} className="nb-slug" aria-live="polite">
        {picked.length} of {L.maxTopicIds} picked{full ? ", untick one to pick another" : ""}
      </p>
      <div className="mt-1">
        {groups.map((g) => {
          const inGroup = g.modules.filter((m) => picked.includes(m.id)).length;
          return (
            <details key={g.id} className="border-t border-dashed border-rule py-1.5">
              <summary className="cursor-pointer py-1 text-[0.95rem] font-semibold">
                {g.name}
                {inGroup ? <span className="nb-slug ml-2">{inGroup} picked</span> : null}
              </summary>
              <ul className="mt-1 grid gap-x-6 sm:grid-cols-2">
                {g.modules.map((m) => {
                  const on = picked.includes(m.id);
                  return (
                    <li key={m.id} className="min-w-0">
                      <label className="flex min-h-[2.5rem] cursor-pointer items-center gap-3 text-[0.93rem] leading-snug">
                        <input
                          type="checkbox"
                          name="topicIds"
                          value={m.id}
                          className="size-4 shrink-0"
                          checked={on}
                          disabled={disabled || (!on && full)}
                          onChange={(e) => toggle(m.id, e.target.checked)}
                        />
                        <span className="min-w-0">{m.title}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>
    </fieldset>
  );
}

export function TeachForm({
  username,
  teamNumber,
  teamRole,
  again,
  groups,
  codeVersion,
}: {
  username: string;
  teamNumber: number | null;
  teamRole: string | null;
  again: boolean;
  groups: TopicGroup[];
  codeVersion: string;
}) {
  const [state, formAction, isPending] = useActionState<TeachFormState, FormData>(applyToTeach, undefined);
  const [agreed, setAgreed] = React.useState(false);
  const sentRef = React.useRef<HTMLDivElement>(null);
  const uid = React.useId();
  const bad = (f: string) => state?.field === f;

  React.useEffect(() => {
    if (state?.success) sentRef.current?.focus();
  }, [state?.success]);

  if (state?.success) {
    return (
      <div ref={sentRef} tabIndex={-1} role="status" className="nb-box nb-tilt-4 p-[clamp(1.1rem,2.4vw,1.6rem)]">
        <span className="nb-tape -top-3 left-[26%] rotate-[-3.4deg]" aria-hidden="true" />
        <p className="nb-slug">sent / waiting on a decision</p>
        <p className="mt-2 font-semibold">Thank you. It&rsquo;s in.</p>
        <p className="mt-2 max-w-[54ch] text-[0.95rem] leading-relaxed text-graphite">
          A person reads every application, and you&rsquo;ll get an email either way. Until then this page
          says where it stands, and you can withdraw it from here.
        </p>
      </div>
    );
  }

  const record = [teamNumber ? `team ${teamNumber}` : "team not set", teamRole || null].filter(Boolean).join(" / ");

  return (
    <>
      <div className="nb-hair pt-4">
        <p className="nb-slug">what the reviewer sees</p>
        <p className="mt-1.5 text-[1.02rem] font-bold">
          @{username}
          <span className="nb-slug ml-2 font-normal">{record}</span>
        </p>
        <p className="mt-2 max-w-[56ch] text-[0.93rem] leading-relaxed text-graphite">
          That line, your answers below and your age group. Your name and your reference are seen only by
          LearnFRC&rsquo;s reviewers, never by students.
        </p>
      </div>

      <form action={formAction} className="mt-6 flex flex-col gap-5" noValidate>
        <ShortField
          id={`${uid}-legal`}
          name="legalName"
          label="Name as your school knows it"
          hint="This goes on your hours letters and can’t be changed later. Students never see it; they see your username."
          maxLength={L.legalNameMax}
          disabled={isPending}
          serverError={bad("legalName")}
          autoComplete="name"
        />

        <ShortField
          id={`${uid}-topics`}
          name="topics"
          label="Topics you’d teach"
          hint="In your own words: a lesson, a module or a skill."
          placeholder="CAN wiring, swerve basics, intro to command-based"
          maxLength={L.topicsMax}
          disabled={isPending}
          serverError={bad("topics")}
        />

        <TopicPicker groups={groups} disabled={isPending} serverError={bad("topicIds")} />

        <LongAnswer
          id={`${uid}-experience`}
          name="experience"
          label="Your FRC experience"
          rows={5}
          disabled={isPending}
          serverError={bad("experience")}
          placeholder="Your team, what you do on it, and anything you've taught before."
          hint="Seasons, subteams, rookies you've trained. If you were on more than one team, say so."
        />

        <LongAnswer
          id={`${uid}-plan`}
          name="samplePlan"
          label="How you’d teach one lesson in 30 to 60 minutes"
          rows={5}
          disabled={isPending}
          serverError={bad("samplePlan")}
          placeholder="Pick a LearnFRC lesson and walk through the class: how you'd start, what you'd show, how you'd check they got it."
          hint="A rough outline is plenty."
        />

        <ShortField
          id={`${uid}-availability`}
          name="availability"
          label="Rough availability, optional"
          placeholder="weekday evenings, Pacific time"
          maxLength={L.availabilityMax}
          disabled={isPending}
          serverError={bad("availability")}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <ShortField
            id={`${uid}-refname`}
            name="referenceName"
            label="An adult on your team, optional"
            hint="A mentor or coach who knows you."
            maxLength={L.referenceNameMax}
            disabled={isPending}
            serverError={bad("referenceName")}
          />
          <ShortField
            id={`${uid}-refemail`}
            name="referenceEmail"
            type="email"
            label="Their email, optional"
            hint="Seen only by LearnFRC’s reviewers."
            maxLength={L.referenceEmailMax}
            disabled={isPending}
            serverError={bad("referenceEmail")}
          />
        </div>

        <div className="nb-note">
          <p className="nb-slug">the teacher code</p>
          <div className="nb-prose mt-2.5">
            <ul>
              {TEACHER_CODE.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
          <label className="mt-3 flex min-h-[2.75rem] cursor-pointer items-center gap-3 text-[0.97rem] font-semibold">
            <input
              type="checkbox"
              name="code"
              value={codeVersion}
              className="size-4 shrink-0"
              checked={agreed}
              disabled={isPending}
              onChange={(e) => setAgreed(e.target.checked)}
              aria-invalid={bad("code") || undefined}
            />
            I agree to the teacher code.
          </label>
        </div>

        {state?.error && (
          <p className="nb-error" role="alert" aria-live="assertive">
            {state.error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="submit" className="nb-btn" disabled={isPending} aria-busy={isPending}>
            {isPending ? "Sending" : again ? "Send it again" : "Send the application"}
          </button>
          <span className="nb-hint">You&rsquo;ll get an email when it&rsquo;s decided.</span>
        </div>
      </form>
    </>
  );
}
