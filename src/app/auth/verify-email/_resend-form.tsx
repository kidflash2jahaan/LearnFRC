"use client";

import * as React from "react";
import { resendConfirmationEmail } from "./_resend-action";

/** How long the button rests after a send. Supabase refuses a second link to
 *  the same address inside about a minute anyway, so this just says so first. */
const COOLDOWN_S = 60;

/**
 * Send the confirmation link again.
 *
 * Drawn rather than filled, because on this page the thing you are meant to do
 * is open your inbox, not press this. It is the fallback, so it reads as the
 * second action.
 *
 * With the address in the URL (the normal arrival, straight from sign-up) it is
 * one button, because the address is already printed on the slab above. Without
 * it (a bookmark, the app, a link someone pasted) the page used to offer no way
 * to resend at all, so it asks for the address instead.
 *
 * After a send the button rests for a minute with the countdown as its label,
 * then comes back. The label is the state: there is no spinner in this system.
 */
export function ResendConfirmation({ email }: { email?: string }) {
  const [address, setAddress] = React.useState(email ?? "");
  const [pending, start] = React.useTransition();
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [wait, setWait] = React.useState(0);

  // One tick a second while resting. Each tick schedules the next, so the
  // timer stops on its own at zero and never outlives the component.
  React.useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending || wait > 0) return;
    setError(null);
    start(async () => {
      const r = await resendConfirmationEmail(address);
      if (r.ok) {
        setSent(true);
        setWait(COOLDOWN_S);
      } else {
        setError(r.error);
        if (r.retryAfter) setWait(r.retryAfter);
      }
    });
  };

  const label = pending
    ? "Sending"
    : wait > 0
      ? `Send again in ${wait}s`
      : sent
        ? "Send it once more"
        : "Send the link again";

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col items-start" noValidate>
      {!email && (
        <div className="nb-field mb-3 w-full">
          <label htmlFor="resend-email" className="nb-label">
            Your email
          </label>
          <input
            id="resend-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={pending}
            className="nb-input"
          />
          <p className="nb-hint">The address you signed up with.</p>
        </div>
      )}

      <button
        type="submit"
        className="nb-btn-ghost"
        disabled={pending || wait > 0}
        aria-busy={pending}
      >
        {label}
      </button>

      {/* Always in the DOM, never display:none, so a screen reader hears the
          result when it lands. Empty, it takes no room. */}
      <p role="status" aria-live="polite" className="nb-hint mt-3 empty:mt-0">
        {sent && !error
          ? "Sent. If that address has an unconfirmed account, a new link is on its way."
          : null}
      </p>
      {error && (
        <p className="nb-error mt-3" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
