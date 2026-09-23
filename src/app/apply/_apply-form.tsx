"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  submitAdminApplication,
  type ApplyState,
} from "@/app/actions/admin-team";

/**
 * The three questions, ruled onto the page.
 *
 * Built on `.nb-field` / `.nb-label` / `.nb-input` / `.nb-hint` / `.nb-error`
 * directly, the same way ReportForm and SettingsForm are, so this form is drawn
 * by the binder's rules rather than by whatever a wrapper decides a "variant"
 * means. It behaves like ReportForm too: on success the form is replaced by a
 * taped receipt, and focus moves onto that receipt so a keyboard reader is not
 * dropped back at the top of the document.
 *
 * NOTHING ANIMATES HERE, on purpose. The only state change worth motion is the
 * receipt arriving, and the system's arrival classes are scroll-driven
 * (`animation-range: entry …`), so a card inserted into a viewport it is
 * already inside would render at its end state anyway. See ReportForm, which
 * made the same call for the same reason.
 *
 * The limits below are the server's, restated so the field can say what is
 * wrong before a round trip. `submitAdminApplication` re-checks every one of
 * them: this is a courtesy, not the gate.
 *
 * EVERY FIELD HERE IS CONTROLLED, and that is not a style choice. React calls
 * `requestFormReset` on every `<form action={fn}>` dispatch and commits it
 * whichever way the action answers, so an uncontrolled input is emptied by a
 * refusal. The minimum-length refusal is easy to reach, because the inline
 * correction only appears once a field has been left, so anyone who types into
 * one box and clicks straight through goes to the server.
 */

const MIN = 40;
const MAX = 3000;
const AVAIL_MAX = 200;

/**
 * One long answer: label, live count, textarea, hint, and an inline correction
 * under the field once it has been left and is still too short.
 *
 * It holds its own value so the count and the check are local, which also means
 * a rejected submit keeps every word the person typed. The count flips from
 * "how much more is needed" to "how much room is left" at the minimum, because
 * those are two different questions and only one of them matters at a time.
 */
function LongAnswer({
  id,
  name,
  label,
  hint,
  placeholder,
  rows,
  disabled,
}: {
  id: string;
  name: string;
  label: string;
  hint: string;
  placeholder: string;
  rows: number;
  disabled: boolean;
}) {
  const [value, setValue] = React.useState("");
  const [left, setLeft] = React.useState(false);

  const trimmed = value.trim().length;
  const short = trimmed < MIN;
  const showError = left && short;

  const countId = `${id}-count`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const missing = MIN - trimmed;

  return (
    <div className="nb-field">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label htmlFor={id} className="nb-label">
          {label}
        </label>
        <span id={countId} className="nb-slug tabular-nums">
          {short ? `${trimmed} / ${MIN} minimum` : `${value.length} / ${MAX}`}
        </span>
      </div>
      <textarea
        id={id}
        name={name}
        rows={rows}
        maxLength={MAX}
        disabled={disabled}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => setLeft(true)}
        placeholder={placeholder}
        aria-describedby={`${hintId} ${countId}${showError ? ` ${errorId}` : ""}`}
        aria-invalid={showError || undefined}
        className="nb-input"
      />
      <p id={hintId} className="nb-hint">
        {hint}
      </p>
      {showError && (
        <p id={errorId} className="nb-error">
          Say a bit more, at least {missing} more{" "}
          {missing === 1 ? "character" : "characters"}.
        </p>
      )}
    </div>
  );
}

export function ApplyForm({
  username,
  teamNumber,
  teamRole,
  /** True when this account has applied before and is trying again. */
  again = false,
}: {
  /** Always set. The page renders its own state when there is no handle yet,
      because an application without one arrives at the desk with nothing on
      it to identify anybody. */
  username: string;
  teamNumber: number | null;
  /** The applicant's role on their FRC team, already turned into a word by the
      page. The action files it with the application, so the strip below has to
      print it or the strip is lying about being the whole record. */
  teamRole: string | null;
  again?: boolean;
}) {
  const [state, formAction, isPending] = useActionState<ApplyState, FormData>(
    submitAdminApplication,
    undefined
  );
  const [availability, setAvailability] = React.useState("");
  const sentRef = React.useRef<HTMLDivElement>(null);
  const uid = React.useId();

  // The form is replaced by the receipt, so keyboard focus would otherwise land
  // back at the top of the document. Moving it onto the panel also guarantees
  // the confirmation is announced, which a freshly-inserted live region does
  // not always do on its own.
  React.useEffect(() => {
    if (state?.success) sentRef.current?.focus();
  }, [state?.success]);

  if (state?.success) {
    return (
      <div
        ref={sentRef}
        tabIndex={-1}
        role="status"
        className="nb-box nb-tilt-4 p-[clamp(1.1rem,2.4vw,1.6rem)]"
      >
        <span
          className="nb-tape -top-3 left-[26%] rotate-[-3.4deg]"
          aria-hidden="true"
        />
        <p className="nb-slug">sent / waiting on a decision</p>
        <p className="mt-2 font-semibold">Thank you. It&rsquo;s in.</p>
        <p className="mt-2 max-w-[54ch] text-[0.95rem] leading-relaxed text-graphite">
          Nothing else is needed from you. You&rsquo;ll get an email either way,
          and until then this page says where it stands. If you change your mind
          before it&rsquo;s decided, you can withdraw it from here.
        </p>
      </div>
    );
  }

  const availId = `${uid}-availability`;
  const availHintId = `${uid}-availability-hint`;

  // Everything about the person that travels with the application, written the
  // way the binder writes a record: mono, slash-separated, no hue.
  const record = [
    teamNumber ? `team ${teamNumber}` : "team not set",
    teamRole || null,
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <>
      {/* ---- what the reviewer actually gets ----------------------------
          A record strip, not a callout: this is data furniture, so it is a
          dashed rule and a mono slug rather than a second framed aside. */}
      <div className="nb-hair pt-4">
        <p className="nb-slug">what the reviewer sees</p>
        <p className="mt-1.5 text-[1.02rem] font-bold">
          @{username}
          <span className="nb-slug ml-2 font-normal">{record}</span>
        </p>
        <p className="mt-2 max-w-[56ch] text-[0.93rem] leading-relaxed text-graphite">
          That line and your three answers are the whole application. Your real
          name and your email address are not on that screen.
        </p>
      </div>

      <form action={formAction} className="mt-6 flex flex-col gap-5" noValidate>
        <LongAnswer
          id={`${uid}-experience`}
          name="experience"
          label="Your FRC experience"
          rows={5}
          disabled={isPending}
          placeholder="Team number, the seasons you were around for, and what you actually worked on."
          hint="If you were on more than one team, say so. If you have been away from it for a few years, say that too."
        />

        <LongAnswer
          id={`${uid}-why`}
          name="why"
          label="Why you want to help"
          rows={4}
          disabled={isPending}
          placeholder="What you'd want to pick up first, and why this rather than something else."
          hint="A paragraph is plenty. If there's a department you'd want to keep an eye on in particular, name it."
        />

        <div className="nb-field">
          <label htmlFor={availId} className="nb-label">
            Rough availability, optional
          </label>
          <input
            id={availId}
            name="availability"
            type="text"
            maxLength={AVAIL_MAX}
            disabled={isPending}
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            placeholder="a couple of evenings a month"
            aria-describedby={availHintId}
            className="nb-input"
          />
          <p id={availHintId} className="nb-hint">
            A rough shape is fine. Nobody is counting hours, and this one can be
            left blank.
          </p>
        </div>

        {/* Server-side refusal. A stamped correction rather than a coloured
            panel: this palette has no red, and the heavy ink bar survives a
            photocopy. Announced assertively because the person just pressed
            send and is waiting on the answer. */}
        {state?.error && (
          <p className="nb-error" role="alert" aria-live="assertive">
            {state.error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="submit"
            className="nb-btn"
            disabled={isPending}
            aria-busy={isPending}
          >
            {isPending
              ? "Sending"
              : again
                ? "Send it again"
                : "Send the application"}
          </button>
          <span className="nb-hint">
            It goes to one person. You&rsquo;ll get an email when it&rsquo;s
            decided.
          </span>
        </div>
      </form>
    </>
  );
}
