"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { UserPlus, Copy, Check, Trophy } from "lucide-react";
import { ShareButton } from "@/components/share-button";

/**
 * "Invite your pit crew" — the user-facing referral surface. Shows the member's
 * personal signup link, a copy-to-clipboard control with "Copied!" feedback,
 * a native-share button, and how many teammates have joined through them.
 *
 * Arena Clay 2 skin (ac-card + ac-badge + ac-chip). Hydration-safe: `copied`
 * starts false on both server and client, so the rendered tree/text is
 * identical at hydration; reduced motion only ever changes `transition`.
 */
export function InviteCard({
  username,
  count,
}: {
  username: string;
  count: number;
}) {
  const link = `https://learnfrc.systemerr.com/signup?ref=${username}`;
  const [copied, setCopied] = React.useState(false);
  const reduce = useReducedMotion();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="ac-card relative overflow-hidden p-5 sm:p-6">
      {/* soft corner glow — constant, aria-hidden, SSR-stable */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(37,96,230,0.28), transparent 70%)" }}
      />

      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="ac-badge flex h-11 w-11 shrink-0 items-center justify-center"
            style={{ "--a": "#2560e6" } as CSSProperties}
          >
            <UserPlus className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="ac-eyebrow">Your referral link</p>
            <h2 className="font-display text-lg font-bold leading-tight text-foreground">
              Invite your pit crew
            </h2>
          </div>
        </div>
        {count > 0 && (
          <span className="ac-chip inline-flex items-center gap-1.5 text-sm font-semibold">
            <Trophy className="h-3.5 w-3.5 text-accent" aria-hidden />
            {count} joined
          </span>
        )}
      </div>

      <p className="relative mt-3 text-[15px] leading-relaxed text-foreground/70">
        Your whole team learns free — you get the bragging rights.{" "}
        {count > 0 ? (
          <>
            <span className="font-semibold text-foreground">
              {count} {count === 1 ? "teammate has" : "teammates have"}
            </span>{" "}
            joined through you.{" "}
          </>
        ) : (
          "Be the reason your team levels up. "
        )}
        You earn <span className="font-semibold text-foreground">+25 XP</span> for
        everyone who signs up with your link.
      </p>

      <div className="relative mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-border bg-white/60 py-1.5 pl-4 pr-1.5">
          <span className="min-w-0 flex-1 truncate text-sm text-foreground/80">
            {link}
          </span>
          <motion.button
            type="button"
            onClick={copy}
            aria-label={copied ? "Referral link copied" : "Copy referral link"}
            aria-live="polite"
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            whileHover={reduce ? undefined : { y: -1 }}
            whileTap={{ scale: 0.96 }}
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 22 }}
          >
            {copied ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
            {copied ? "Copied!" : "Copy"}
          </motion.button>
        </div>
        <ShareButton
          variant="brand"
          label="Share invite"
          text="Learn every part of FRC, free — join me on LearnFRC:"
          url={link}
        />
      </div>
    </div>
  );
}
