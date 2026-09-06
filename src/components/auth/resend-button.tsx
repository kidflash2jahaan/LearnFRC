"use client";

import * as React from "react";
import { toast } from "sonner";
import { resendConfirmation } from "@/app/actions/auth";

/**
 * Send the confirmation email again.
 *
 * Drawn rather than filled, because on the verify-email page the thing you are
 * meant to do is open your inbox, not press this. It is the fallback, so it
 * reads as the second action.
 *
 * Once sent it stays disabled with the label changed. The label is the state:
 * there is no spinner in this system, and a button that says "sent" and cannot
 * be pressed again says everything a spinner would.
 */
export function ResendButton({ email }: { email: string }) {
  const [pending, start] = React.useTransition();
  const [sent, setSent] = React.useState(false);

  const onClick = () => {
    start(async () => {
      const r = await resendConfirmation(email);
      if (r?.error) toast.error(r.error);
      else {
        setSent(true);
        toast.success("Verification email sent again.");
      }
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending || sent}
      aria-busy={pending}
      className="nb-btn-ghost"
    >
      {pending ? "Sending" : sent ? "Sent again" : "Send it again"}
    </button>
  );
}
