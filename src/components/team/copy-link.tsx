"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy } from "lucide-react";

/**
 * The invite link, shown and copyable — the smallest possible client boundary
 * on an otherwise server-rendered invite panel.
 *
 * Same control shape as the leaderboard/dashboard InviteCard so the site has
 * one copy affordance, not two that behave differently.
 *
 * Hydration-safe: `copied` starts false on both server and client, so the
 * rendered tree and text are identical at hydration, and reduced motion only
 * ever changes `transition` — never what is rendered.
 */
export function CopyLink({
  url,
  label = "Invite link",
}: {
  url: string;
  label?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const reduce = useReducedMotion();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the link is visible and selectable either way */
    }
  };

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-border bg-white/60 py-1.5 pl-4 pr-1.5">
      <span
        className="min-w-0 flex-1 truncate text-sm text-foreground/80"
        aria-label={label}
      >
        {url}
      </span>
      <motion.button
        type="button"
        onClick={copy}
        aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
        aria-live="polite"
        className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        whileHover={reduce ? undefined : { y: -1 }}
        whileTap={{ scale: 0.96 }}
        transition={
          reduce ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 22 }
        }
      >
        {copied ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : (
          <Copy className="h-4 w-4" aria-hidden />
        )}
        {copied ? "Copied!" : "Copy"}
      </motion.button>
    </div>
  );
}
