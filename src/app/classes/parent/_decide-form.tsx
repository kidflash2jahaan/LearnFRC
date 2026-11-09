"use client";

import * as React from "react";
import { useActionState } from "react";
import { decideParentRequest, type ConsentFormState } from "@/app/actions/class-consent";

/**
 * The parent's answer on /classes/parent (classes-design.md section 5.1):
 * their name, then I agree or I don't agree. The token isn't in the form;
 * the action reads it from the lf_parent cookie the emailed link left.
 *
 * A name is needed to agree (it's the record that a parent or guardian
 * decided) and optional to decline. On either answer the action clears the
 * cookie and reloads the page at a plain URL that says what happened.
 */
export function DecideForm() {
  const [state, formAction, isPending] = useActionState<ConsentFormState, FormData>(
    decideParentRequest,
    undefined
  );
  const [name, setName] = React.useState("");
  const uid = React.useId();
  const nameId = `${uid}-name`;
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;

  return (
    <form action={formAction} noValidate className="mt-5 flex flex-col gap-5">
      <div className="nb-field">
        <label htmlFor={nameId} className="nb-label">
          Your name
        </label>
        <input
          id={nameId}
          name="parent_name"
          type="text"
          autoComplete="name"
          maxLength={80}
          disabled={isPending}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-describedby={`${hintId}${state?.error ? ` ${errorId}` : ""}`}
          aria-invalid={state?.field === "parent_name" || undefined}
          className="nb-input"
        />
        <p id={hintId} className="nb-hint">
          Kept with your answer as the record that a parent or guardian decided. Needed to agree.
        </p>
      </div>

      {state?.error && (
        <p id={errorId} className="nb-error" role="alert" aria-live="assertive">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          name="decision"
          value="agree"
          className="nb-btn"
          disabled={isPending}
          aria-busy={isPending}
        >
          I agree
        </button>
        <button type="submit" name="decision" value="decline" className="nb-btn-ghost" disabled={isPending}>
          I don&rsquo;t agree
        </button>
      </div>
    </form>
  );
}
