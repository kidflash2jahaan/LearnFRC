"use client";

import * as React from "react";
import { toast } from "sonner";
import { blockAccount, unblockAccount } from "@/app/actions/safety";

/** How long an armed Block stays armed (the review desk's rule). */
const ARMED_MS = 5000;

/**
 * Block, as a two-click control: the first click says what is about to
 * happen, the second does it. Not a `confirm()`, for the reason the review
 * desk gives: a browser dialog is the one piece of chrome on the site that
 * can't be drawn by hand. The block itself (no blocking yourself, the cap, the
 * rate limit) is blockUser on the server; the page refreshes from it.
 */
export function BlockButton({ username }: { username: string }) {
  const [armed, setArmed] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const uid = React.useId();
  const armedId = `${uid}-armed`;

  React.useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), ARMED_MS);
    return () => window.clearTimeout(t);
  }, [armed]);

  const click = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    startTransition(async () => {
      let res: { error?: string };
      try {
        res = await blockAccount(username);
      } catch {
        res = { error: "Couldn't save that. Check your connection and try again." };
      }
      setArmed(false);
      if (res.error) toast.error(res.error);
      else toast.success(`You blocked @${username}.`);
    });
  };

  return (
    <span className="inline-flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={click}
        disabled={pending}
        aria-busy={pending}
        aria-describedby={armed ? armedId : undefined}
        className="nb-btn-ghost nb-btn-sm"
      >
        {pending ? "Blocking" : armed ? `Yes, block @${username}` : `Block @${username}`}
      </button>
      <span id={armedId} role="status" className="nb-hint max-w-[44ch] empty:hidden">
        {armed
          ? `You won't see their profile, their rows on the leaderboards or their row on your team sheet. They aren't told. You can undo it in Settings.`
          : null}
      </span>
    </span>
  );
}

/** Undo a block: one click, because it takes nothing away from anyone. */
export function UnblockButton({
  username,
  className = "nb-btn-ghost nb-btn-sm",
}: {
  username: string;
  className?: string;
}) {
  const [pending, startTransition] = React.useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending}
      className={className}
      onClick={() =>
        startTransition(async () => {
          let res: { error?: string };
          try {
            res = await unblockAccount(username);
          } catch {
            res = { error: "Couldn't save that. Check your connection and try again." };
          }
          if (res.error) toast.error(res.error);
          else toast.success(`You unblocked @${username}.`);
        })
      }
    >
      {pending ? "Unblocking" : `Unblock @${username}`}
    </button>
  );
}
