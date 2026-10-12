"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setEmailOptIn } from "@/app/actions/profile";
import { EMAIL_CHOICE_EVENT } from "@/components/settings/email-choice-prompt";

/**
 * The learning-reminder switch, drawn like the motion switch beside it so the
 * two read as one kind of control: the knob moves AND the mono label reads
 * `on` / `off`, so the state survives greyscale and doesn't depend on blue.
 *
 * Reminders are opt-in (owner, 2026-10-12): new accounts start off, and this
 * switch or the box at signup is the only way to turn them on. It saves the
 * moment it's flipped, with the knob moving first and snapping back if the save
 * fails, because a switch that waits on a round trip feels broken.
 */
export function EmailPrefsCard({ initialOn }: { initialOn: boolean }) {
  const [on, setOn] = React.useState(initialOn);
  const [isPending, startTransition] = React.useTransition();

  const flip = () => {
    const next = !on;
    setOn(next);
    startTransition(async () => {
      // A thrown server action (offline, a deploy mid-session) is caught here
      // so it snaps the switch back instead of reaching an error boundary.
      let res: { error?: string };
      try {
        res = await setEmailOptIn(next);
      } catch {
        res = { error: "Couldn't save that. Check your connection and try again." };
      }
      if (res.error) {
        setOn(!next);
        toast.error(res.error);
      } else {
        // Close the one-time reminder question if it's open in this tab.
        window.dispatchEvent(new Event(EMAIL_CHOICE_EVENT));
        toast.success(next ? "Reminder emails are on." : "Reminder emails are off.");
      }
    });
  };

  return (
    <section className="nb-box p-[var(--pad)]" aria-labelledby="email-h">
      <p className="nb-slug">settings / email</p>
      <h3 id="email-h" className="mt-2">
        Reminder emails
      </h3>
      <p className="nb-sub mt-2">
        Now and then we can email you a reminder: your next lesson, or a streak
        about to end. They&rsquo;re off unless you turn them on, and every one
        has a one-click unsubscribe. Account emails like verification and
        password resets still come either way.{" "}
        <Link href="/privacy" className="nb-link">
          Privacy policy
        </Link>
        .
      </p>

      <div className="nb-hair mt-5 flex flex-wrap items-center justify-between gap-4 pt-4">
        <span className="min-w-0">
          <span className="block font-semibold">Send me reminder emails</span>
          <span className="nb-hint mt-0.5 block">
            {on ? "On. You can turn it off any time." : "Off. Nothing but account emails."}
          </span>
        </span>

        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Send me reminder emails"
          aria-busy={isPending}
          disabled={isPending}
          onClick={flip}
          className="inline-flex min-h-[var(--tap)] shrink-0 cursor-pointer items-center gap-2.5 disabled:cursor-wait"
        >
          <span
            aria-hidden="true"
            className={cn(
              "nb-box-sm relative block h-8 w-[3.75rem]",
              "transition-[background-color] duration-[var(--nb-t-hover)] ease-[var(--nb-ease-out)]",
              on ? "bg-blue" : "bg-paper"
            )}
          >
            <span
              className={cn(
                "absolute left-1 top-1/2 block h-5 w-5 -translate-y-1/2 border-2 border-ink bg-card",
                "transition-[translate] duration-[var(--nb-t-hover)] ease-[var(--nb-ease-out)]",
                on ? "translate-x-[140%]" : "translate-x-0"
              )}
              style={{ borderRadius: "var(--hand-s)" }}
            />
          </span>
          <span className="nb-slug font-bold text-ink">{on ? "on" : "off"}</span>
        </button>
      </div>
    </section>
  );
}
