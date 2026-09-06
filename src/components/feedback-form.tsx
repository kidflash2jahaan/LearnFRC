"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { sendFeedback } from "@/app/actions/feedback";

/**
 * The suggestion slip: what should be in the binder that isn't.
 *
 * Both fields get a visible label rather than a placeholder standing in for
 * one, and the optional field says it is optional in its own label instead of
 * hiding that in grey placeholder text a screen reader announces last.
 *
 * The action wiring is unchanged: same server action, same error toast, same
 * success swap.
 */
export function FeedbackForm({ page = "/" }: { page?: string }) {
  const [state, action, pending] = useActionState(sendFeedback, undefined);
  const uid = React.useId();
  const messageId = `${uid}-message`;
  const emailId = `${uid}-email`;

  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  if (state?.success) {
    return (
      <div className="nb-note" role="status">
        <p className="nb-slug">sent</p>
        <p className="mt-1.5 text-[0.95rem]">
          Thanks. Every one of these gets read, and the ones that turn into
          lessons get read twice.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="page" value={page} />

      <div className="nb-field">
        <label htmlFor={messageId} className="nb-label">
          Your suggestion
        </label>
        <textarea
          id={messageId}
          name="message"
          required
          minLength={5}
          rows={5}
          disabled={pending}
          placeholder="A topic that isn't covered, a resource worth linking, or something that reads wrong."
          className="nb-input"
        />
        <p className="nb-hint">
          Be specific. &ldquo;Nothing on chain tensioning&rdquo; is more useful
          than &ldquo;more mechanical please&rdquo;.
        </p>
      </div>

      <div className="nb-field">
        <label htmlFor={emailId} className="nb-label">
          Email, optional
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          disabled={pending}
          placeholder="you@team.org"
          className="nb-input"
        />
        <p className="nb-hint">Only if you want an answer back.</p>
      </div>

      <div>
        <button type="submit" className="nb-btn" disabled={pending} aria-busy={pending}>
          {pending ? "Sending" : "Send suggestion"}
        </button>
      </div>
    </form>
  );
}
