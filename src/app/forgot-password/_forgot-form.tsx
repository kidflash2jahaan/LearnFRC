"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type ResetState } from "@/app/actions/auth";

/**
 * One field, one action, and then a receipt.
 *
 * The success branch replaces the slip in place rather than navigating, and it
 * deliberately says the same thing whether or not the address is registered.
 * That is not vagueness, it is the anti-enumeration rule the server action is
 * written around: telling a stranger "no account here" hands them a way to test
 * addresses one at a time. The copy is worded so the honest reading and the
 * defensive one are the same sentence.
 */
export function ForgotForm({ defaultEmail }: { defaultEmail?: string }) {
  const [state, formAction, isPending] = useActionState<ResetState, FormData>(
    requestPasswordReset,
    undefined
  );

  if (state?.success) {
    return (
      <div role="status">
        <p className="nb-slug border-b border-dashed border-rule pb-3">
          sent · check your inbox
        </p>

        <h2 className="mt-5 text-[clamp(1.3rem,1.1rem+0.8vw,1.7rem)]">
          If that address has an account, the link is on its way.
        </h2>

        <p className="mt-3 text-[0.98rem] leading-snug text-graphite">
          Open it on any device, phone included. It signs you in and drops you
          straight on the page where you pick a new password.
        </p>

        <div className="nb-note mt-5">
          <p className="nb-slug">expires in one hour</p>
          <p className="mt-1.5 text-[0.95rem] leading-snug">
            Single use, so an old link in your inbox will not work. Nothing seen
            after ten minutes usually means the spam folder.
          </p>
        </div>

        <p className="nb-hair mt-5 pt-4">
          <Link href="/login" className="nb-link">
            Back to the sign-in sheet
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state?.error && (
        <p className="nb-error" role="alert" aria-live="assertive">
          {state.error}
        </p>
      )}

      <div className="nb-field">
        <label htmlFor="email" className="nb-label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          defaultValue={defaultEmail}
          disabled={isPending}
          className="nb-input"
        />
        <p className="nb-hint">
          The address you signed up with. A username won&rsquo;t work here, the
          link has to have somewhere to go.
        </p>
      </div>

      <button
        type="submit"
        className="nb-btn w-full"
        disabled={isPending}
        aria-busy={isPending}
      >
        {isPending ? "Sending the link" : "Send me a reset link"}
      </button>

      <p className="nb-hair pt-4 text-[0.95rem] text-graphite">
        Remembered it?{" "}
        <Link href="/login" className="nb-link">
          Back to the sign-in sheet
        </Link>
      </p>
    </form>
  );
}
