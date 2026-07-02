"use client";

import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Mail, CheckCircle2 } from "lucide-react";

/**
 * Signature element for the verify-email interstitial: a glossy mail badge
 * "broadcasting" the confirmation signal outward in soft pulsing rings, with
 * a reassuring checkmark chip that springs in once the signal lands. Purely
 * decorative — the tree is identical regardless of motion preference; only
 * `animate`/`transition` change, per the primitives' reduced-motion contract.
 */
export function SignalBeacon() {
  const reduce = useReducedMotion();

  return (
    <div className="relative mx-auto flex h-28 w-28 items-center justify-center" aria-hidden>
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          className="absolute inset-0 rounded-full border-2"
          style={{ borderColor: "color-mix(in srgb, var(--primary) 45%, transparent)" }}
          animate={reduce ? undefined : { scale: [1, 1.65, 1.65], opacity: [0.55, 0, 0] }}
          transition={
            reduce
              ? { duration: 0 }
              : { duration: 2.4, repeat: Infinity, ease: "easeOut", delay: i * 1.2 }
          }
        />
      ))}

      <motion.span
        className="ac-badge relative flex h-16 w-16 items-center justify-center"
        style={{ "--a": "#2560e6" } as CSSProperties}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={
          reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 18, delay: 0.15 }
        }
      >
        <Mail className="h-7 w-7" />
      </motion.span>

      <motion.span
        className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-success shadow-md ring-1 ring-white"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={
          reduce ? { duration: 0 } : { type: "spring", stiffness: 280, damping: 16, delay: 0.9 }
        }
      >
        <CheckCircle2 className="h-5 w-5" />
      </motion.span>
    </div>
  );
}
