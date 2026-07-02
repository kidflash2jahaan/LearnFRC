"use client";

import * as React from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Share2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const SKIN: Record<"brand" | "outline" | "ghost", string> = {
  brand: "ac-btn",
  outline: "ac-btn-ghost",
  ghost: "ac-btn-ghost",
};

/**
 * Share/copy button: uses the native share sheet on mobile, falls back to
 * copying the message + link to the clipboard with "Copied!" feedback.
 * Same public API as before; Arena Clay 2 skin + a spring icon swap.
 */
export function ShareButton({
  text,
  url,
  label = "Share",
  variant = "outline",
}: {
  text: string;
  url: string;
  label?: string;
  variant?: "brand" | "outline" | "ghost";
}) {
  const [copied, setCopied] = React.useState(false);
  const reduce = useReducedMotion();

  const onClick = async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ text, url });
        return;
      } catch {
        /* cancelled or unsupported — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={cn(SKIN[variant] ?? SKIN.outline, "text-sm print:hidden")}
      whileHover={reduce ? undefined : { y: -2, scale: 1.02 }}
      // constant whileTap: framer adds tabindex="0" to tap-enabled elements at
      // SSR, so branching it on reduced-motion hydration-mismatches. Native
      // <button> is already focusable, so the attribute is redundant-but-harmless.
      whileTap={{ scale: 0.98 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 22 }}
      aria-live="polite"
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="copied"
            className="inline-flex items-center gap-2"
            initial={reduce ? undefined : { opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.7 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
          >
            <Check aria-hidden className="h-4 w-4" />
            Copied!
          </motion.span>
        ) : (
          <motion.span
            key="share"
            className="inline-flex items-center gap-2"
            initial={reduce ? undefined : { opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.7 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
          >
            <Share2 aria-hidden className="h-4 w-4" />
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
