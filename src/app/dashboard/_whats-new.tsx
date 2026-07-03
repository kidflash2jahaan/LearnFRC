"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, UserPlus, X } from "lucide-react";

/**
 * Dismissible "What's new" announcement, shown near the top of the dashboard.
 *
 * Hydration-safety contract: localStorage never influences SSR. The component
 * renders `null` on the server AND on the first client render (mounted starts
 * false), so the trees match exactly. Only after mount does an effect read the
 * dismissed flag and reveal the card with a gentle entrance. Reduced motion
 * changes `transition` timing only — never the rendered tree, text, or props.
 *
 * The dismissal key is VERSIONED: bump `WHATS_NEW_VERSION` to resurface the
 * card for a future announcement without touching the storage key.
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
  const reduce = useReducedMotion();

  React.useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(STORAGE_KEY) === WHATS_NEW_VERSION) {
        setDismissed(true);
      }
    } catch {
      /* localStorage unavailable — show the card */
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
    if (!el) return; // fall back to native anchor jump
    e.preventDefault();
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  if (!mounted || dismissed) return null;

  const cta = (
    <>
      <UserPlus className="h-4 w-4" aria-hidden />
      Invite teammates
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 26 }
      }
      className={className}
    >
      <div className="ac-card relative overflow-hidden p-4 sm:p-5">
        {/* soft corner glow — constant, aria-hidden, SSR-stable */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full opacity-50 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(124,92,255,0.26), transparent 70%)",
          }}
        />

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss what's new"
          className="absolute right-1.5 top-1.5 z-10 flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <div className="relative flex flex-col gap-4 pr-8 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="ac-badge flex h-11 w-11 shrink-0 items-center justify-center"
              style={{ "--a": "#7c5cff" } as CSSProperties}
            >
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="ac-eyebrow">New in the pit</p>
              <p className="mt-1 text-[15px] leading-relaxed text-foreground/80">
                LearnFRC just got a full redesign — and you can now{" "}
                <span className="font-semibold text-foreground">
                  invite your teammates
                </span>
                . Rack up{" "}
                <span className="font-semibold text-foreground">+25 XP</span> for
                every one who joins.
              </p>
            </div>
          </div>

          {isAnchor ? (
            <a
              href={inviteHref}
              onClick={onInviteClick}
              className="ac-btn shrink-0 self-start text-sm sm:self-center"
            >
              {cta}
            </a>
          ) : (
            <Link
              href={inviteHref}
              className="ac-btn shrink-0 self-start text-sm sm:self-center"
            >
              {cta}
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}
