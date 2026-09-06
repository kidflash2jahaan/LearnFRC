"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * A slip taped to the top of the page once, saying what changed. Dismissed, it
 * never comes back until the version below is bumped.
 *
 * HYDRATION CONTRACT, unchanged from the version this replaced and still the
 * reason the component is shaped this way: localStorage never influences SSR.
 * It renders `null` on the server AND on the first client render (`mounted`
 * starts false), so the two trees match exactly. Only after mount does an
 * effect read the dismissed flag and reveal the slip. There is no entrance
 * animation to reduce-motion around, because the binder has none.
 *
 * The dismissal key is VERSIONED: bump `WHATS_NEW_VERSION` to resurface the
 * slip for a future announcement without touching the storage key.
 */
const STORAGE_KEY = "lf_whatsnew";
const WHATS_NEW_VERSION = "2026-07-redesign";

export function WhatsNew({
  inviteHref,
  className,
}: {
  /** Where "Invite teammates" goes: "#invite-card" to scroll to the invite
   *  card below, or a route (e.g. "/settings") when there's no invite link yet. */
  inviteHref: string;
  className?: string;
}) {
  const [mounted, setMounted] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(STORAGE_KEY) === WHATS_NEW_VERSION) {
        setDismissed(true);
      }
    } catch {
      /* localStorage unavailable, show the slip */
    }
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, WHATS_NEW_VERSION);
    } catch {
      /* ignore */
    }
  };

  const isAnchor = inviteHref.startsWith("#");
  const onInviteClick = (e: React.MouseEvent) => {
    if (!isAnchor) return;
    const el = document.getElementById(inviteHref.slice(1));
    if (!el) return; // fall back to the native anchor jump
    e.preventDefault();
    el.scrollIntoView({ block: "start" });
  };

  if (!mounted || dismissed) return null;

  return (
    <section
      aria-labelledby="whats-new-heading"
      className={cn("nb-box nb-tilt-4 p-[clamp(1rem,2.2vw,1.5rem)]", className)}
    >
      <span className="nb-tape -top-3 left-[9%] rotate-[-3.6deg]" aria-hidden="true" />

      <p className="nb-marker">new in the pit</p>

      <h2 id="whats-new-heading" className="text-[clamp(1.15rem,1rem+0.7vw,1.5rem)]">
        You can hand your team the link now.
      </h2>

      <p className="mt-2 max-w-[54ch] text-[0.95rem] leading-snug text-graphite">
        The whole site was rebuilt, and invites came with it. Every teammate who
        signs up through your link is worth{" "}
        <b className="font-bold text-ink">25 XP</b> to you.
      </p>

      <div className="nb-hair mt-4 flex flex-wrap items-center gap-3 pt-4">
        {isAnchor ? (
          <a
            href={inviteHref}
            onClick={onInviteClick}
            className="nb-btn nb-btn-sm"
          >
            Invite teammates
          </a>
        ) : (
          <Link href={inviteHref} className="nb-btn nb-btn-sm">
            Invite teammates
          </Link>
        )}

        {/* A written "dismiss", not a floating x. The x needs a 44px target it
            has nowhere to put, and it reads as chrome; a word in the footer
            reads as one of the two things you can do with this slip. */}
        <button type="button" onClick={dismiss} className="nb-btn-ghost nb-btn-sm">
          Dismiss
        </button>
      </div>
    </section>
  );
}
