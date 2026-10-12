"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { setEmailOptIn } from "@/app/actions/profile";

/** "Ask me later" lasts until this tab is closed (sessionStorage is per tab). */
const LATER_KEY = "lf_email_prompt_later";

/** Fired by anything that records an answer, so an open card can close itself. */
export const EMAIL_CHOICE_EVENT = "lf:email-choice";

/** Pages where the card would sit on top of the very thing it asks about. */
const HIDDEN_ON = ["/settings", "/unsubscribe", "/login", "/signup", "/auth"];

/**
 * The one-time question about reminder emails (owner, 2026-10-12).
 *
 * Reminders became opt-in that day, and every account that had been enrolled
 * by default was switched off until its owner answers this. So it asks once,
 * the next time a signed-in member is on the site, and never again after a yes
 * or a no (the answer is recorded as email_choice_at; /api/me stops sending
 * `emailPrompt`).
 *
 * A card in the corner, not a modal: reading a lesson is never blocked to ask
 * about email. It sits at z-50, above the lesson page's z-40 sticky bar, which
 * would otherwise cover its buttons. Its title is a paragraph, not a heading,
 * because it renders before <main> and would otherwise be every page's first
 * heading, ahead of the page's own h1.
 */
export function EmailChoicePrompt({ show }: { show: boolean }) {
  const pathname = usePathname();
  const [hidden, setHidden] = React.useState(false);
  // Read once, lazily. Safe for hydration: the server always renders nothing,
  // because `show` comes from the navbar's client-side /api/me fetch.
  const [later, setLater] = React.useState(() => {
    try {
      return typeof window !== "undefined" && sessionStorage.getItem(LATER_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [isPending, startTransition] = React.useTransition();
  const cardRef = React.useRef<HTMLElement>(null);

  // Answered in Settings during this visit: the navbar's /api/me answer is
  // from page load, so close on the event rather than ask again.
  React.useEffect(() => {
    const onChoice = () => setHidden(true);
    window.addEventListener(EMAIL_CHOICE_EVENT, onChoice);
    return () => window.removeEventListener(EMAIL_CHOICE_EVENT, onChoice);
  }, []);

  if (!show || hidden || later) return null;
  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;

  // The card is about to unmount with focus inside it; hand focus to the page
  // so keyboard and screen-reader users aren't dropped back at <body>.
  const releaseFocus = () => {
    if (!cardRef.current?.contains(document.activeElement)) return;
    const main = document.getElementById("main-content");
    if (main) {
      main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: true });
    }
  };

  const answer = (optIn: boolean) =>
    startTransition(async () => {
      // A thrown server action (offline, a deploy mid-session) must not reach
      // the root error boundary: this card renders from the layout's navbar.
      let res: { error?: string };
      try {
        res = await setEmailOptIn(optIn);
      } catch {
        res = { error: "Couldn't save that. Check your connection and try again." };
      }
      if (res.error) {
        toast.error(res.error);
        return;
      }
      releaseFocus();
      setHidden(true);
      toast.success(
        optIn
          ? "Reminder emails are on. You can turn them off in Settings."
          : "No reminder emails. You can turn them on in Settings."
      );
    });

  const askLater = () => {
    try {
      sessionStorage.setItem(LATER_KEY, "1");
    } catch {
      /* private mode: it just hides for this page view */
    }
    releaseFocus();
    setLater(true);
  };

  return (
    <aside
      ref={cardRef}
      aria-labelledby="email-choice-title"
      className="nb-box fixed inset-x-4 bottom-4 z-50 bg-[var(--card)] p-[clamp(1rem,2.4vw,1.4rem)] print:hidden sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[24rem]"
    >
      <p className="nb-slug">email / your call</p>
      <p
        id="email-choice-title"
        className="mt-1.5 text-[1.2rem] font-extrabold leading-tight tracking-[-0.02em]"
      >
        Want reminder emails?
      </p>
      <p className="mt-2 text-[0.95rem] leading-snug text-graphite">
        Reminders are now off unless you turn them on. Say yes and we&rsquo;ll
        email you now and then about your next lesson or a streak about to end.
        You can change it any time in{" "}
        <Link href="/settings#email" className="nb-link">
          Settings
        </Link>
        .
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          className="nb-btn nb-btn-sm"
          disabled={isPending}
          onClick={() => answer(true)}
        >
          Yes, email me
        </button>
        <button
          type="button"
          className="nb-btn-ghost nb-btn-sm"
          disabled={isPending}
          onClick={() => answer(false)}
        >
          No thanks
        </button>
        <button
          type="button"
          className="nb-navlink ml-auto text-[0.9rem]"
          disabled={isPending}
          onClick={askLater}
        >
          Ask me later
        </button>
      </div>
    </aside>
  );
}
