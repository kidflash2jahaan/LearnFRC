"use client";

import * as React from "react";
import { useActionState } from "react";
import { updatePassword, type AuthState } from "@/app/actions/auth";

/**
 * Two lines on a recovery slip: the new password, and it again.
 *
 * The form sits directly on the paper rather than inside a card. Every other
 * form in this half of the site is on a taped sheet because you chose to go
 * there; this one is the tail end of a journey that started in an inbox, and a
 * second sheet in front of somebody who is already two clicks deep reads as
 * another step rather than the last one.
 *
 * The show/hide control is a real button in the label row, matching the sign-in
 * sheet: inside the field it was 44px of the input, sat on top of the text it
 * reveals, and carried `tabIndex={-1}`, so a keyboard user could not reach the
 * one control that tells them whether they typed what they think they typed.
 * It toggles BOTH fields, because checking one and not the other is how a
 * mismatch survives to the submit.
 *
 * Behaviour is untouched: same `updatePassword` action, same `useActionState`,
 * same `password` / `confirm` field names, same 8-character floor. The action
 * redirects on success, so there is no success branch to draw here.
 */
export function PasswordForm() {
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    updatePassword,
    undefined
  );
  const [show, setShow] = React.useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state?.error && (
        <p className="nb-error" role="alert" aria-live="assertive">
          {state.error}
        </p>
      )}

      <div className="nb-field">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="password" className="nb-label">
            New password
          </label>
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            disabled={isPending}
            aria-pressed={show}
            aria-controls="password confirm"
            className="nb-navlink"
          >
            {show ? "hide both" : "show both"}
          </button>
        </div>
        <input
          id="password"
          name="password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={8}
          disabled={isPending}
          className="nb-input"
        />
        <p className="nb-hint">
          Eight characters at the very least. A phrase you can type fast beats a
          clever one you will be resetting again next month.
        </p>
      </div>

      <div className="nb-field">
        <label htmlFor="confirm" className="nb-label">
          Write it again
        </label>
        <input
          id="confirm"
          name="confirm"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={8}
          disabled={isPending}
          className="nb-input"
        />
        <p className="nb-hint">
          Both lines have to match. Nothing is saved until they do.
        </p>
      </div>

      <button
        type="submit"
        className="nb-btn mt-1 w-full"
        disabled={isPending}
        aria-busy={isPending}
      >
        {isPending ? "Saving it" : "Save it and sign me in"}
      </button>
    </form>
  );
}
