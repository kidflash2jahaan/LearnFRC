"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const SKIN: Record<"brand" | "outline" | "ghost", string> = {
  brand: "nb-btn",
  outline: "nb-btn-ghost",
  ghost: "nb-btn-ghost",
};

/**
 * Share, or copy to the clipboard when there is no share sheet.
 *
 * The behaviour is unchanged: native share where it exists, clipboard where it
 * doesn't, and the label reports back for 1.8s either way.
 *
 * What went is the motion. This used to be a `motion.button` wrapping an
 * `AnimatePresence` that cross-faded and scaled the label on every state
 * change, plus a hover spring, plus a tap spring. A button that reports what it
 * just did should report it instantly: the word changes, the width does not
 * (the label is `.nb-slug` mono with a min-width, so "Copied" and "Share" hold
 * the same box and the row never jumps), and the press is the ink drop the
 * whole system already presses buttons into.
 *
 * The label is a live region, so the swap is announced rather than only seen.
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

  // A pending timeout has to be cleared, or a click right before unmount sets
  // state on a component that is gone.
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

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
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(SKIN[variant] ?? SKIN.outline, "print:hidden")}
    >
      <span aria-live="polite" className="min-w-[6ch] text-center">
        {copied ? "Copied" : label}
      </span>
    </button>
  );
}
