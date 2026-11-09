"use client";

import * as React from "react";
import { useActionState } from "react";
import { sendParentRequest, type ConsentFormState } from "@/app/actions/class-consent";

/**
 * Step two (classes-design.md section 5.1): the parent or guardian's email.
 * One email goes to it, with one button. The server checks the address, that
 * it isn't the student's own, the 24-hour wait for the same address and the
 * daily caps; this form only collects it.
 *
 * Controlled, so a refusal (a typo, the student's own address) keeps what
 * was typed. `again` is the waiting step's version: the last address filled
 * in, ready to resend or change.
 */
export function ParentForm({ again = false, initialEmail = "" }: { again?: boolean; initialEmail?: string }) {
  const [state, formAction, isPending] = useActionState<ConsentFormState, FormData>(
    sendParentRequest,
    undefined
  );
  const [email, setEmail] = React.useState(initialEmail);
  const uid = React.useId();
  const inputId = `${uid}-parent-email`;
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;
  const invalid = !!state?.error && (state.field === "parent_email" || !state.field);

  return (
    <form action={formAction} noValidate className="mt-5 flex flex-col gap-5">
      <div className="nb-field">
        <label htmlFor={inputId} className="nb-label">
          {again ? "Send it again, or to a different address" : "Your parent or guardian’s email"}
        </label>
        <input
          id={inputId}
          name="parent_email"
          type="email"
          inputMode="email"
          autoComplete="off"
          spellCheck={false}
          maxLength={254}
          disabled={isPending}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby={`${hintId}${state?.error ? ` ${errorId}` : ""}`}
          aria-invalid={invalid || undefined}
          className="nb-input"
        />
        <p id={hintId} className="nb-hint">
          We&rsquo;ll send them one email about classes. Classes open for you when they say OK.
        </p>
      </div>

      {state?.error && (
        <p id={errorId} className="nb-error" role="alert" aria-live="assertive">
          {state.error}
        </p>
      )}
      {!state?.error && state?.message && (
        <p className="nb-hint" role="status">
          {state.message}
        </p>
      )}

      <div>
        <button type="submit" className="nb-btn" disabled={isPending} aria-busy={isPending}>
          {isPending ? "Sending" : again ? "Send it again" : "Send the email"}
        </button>
      </div>
    </form>
  );
}
