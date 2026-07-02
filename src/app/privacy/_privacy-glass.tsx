"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AnimatedCounter } from "@/components/animated-counter";

/**
 * Signature hero device: "Privacy at a glance" — a floating glass instrument
 * that turns the policy's headline facts (how little is personal, how it's
 * protected) into a single readable gauge instead of another wall of text.
 */
export function PrivacyGlass() {
  const reduce = useReducedMotion();
  const circumference = 213.6; // 2 * PI * r(34)
  const nonPersonalPct = 88;
  const ringOffset = circumference * (1 - nonPersonalPct / 100);

  return (
    <motion.aside
      className="ac-glass relative w-full max-w-sm p-6 sm:p-7 lg:justify-self-end"
      initial={{ opacity: 0, y: 26, rotate: 1.2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={
        reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 18, delay: 0.25 }
      }
      whileHover={reduce ? undefined : { y: -6 }}
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground/70">
        <motion.span
          className="h-2 w-2 rounded-full"
          style={{ background: "var(--success)" }}
          animate={reduce ? undefined : { scale: [1, 1.35, 1], opacity: [1, 0.6, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />
        Privacy at a glance
      </div>

      {/* data-minimization ring */}
      <div className="mt-5 flex items-center gap-4">
        <div className="relative h-[78px] w-[78px] shrink-0">
          <svg viewBox="0 0 82 82" className="h-[78px] w-[78px]" aria-hidden>
            <circle
              cx="41"
              cy="41"
              r="34"
              fill="none"
              stroke="rgba(120,145,190,.28)"
              strokeWidth="9"
            />
            <motion.circle
              cx="41"
              cy="41"
              r="34"
              fill="none"
              stroke="url(#privRing)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={circumference}
              transform="rotate(-90 41 41)"
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: ringOffset }}
              transition={
                reduce ? { duration: 0 } : { type: "spring", stiffness: 90, damping: 20, delay: 0.4 }
              }
            />
            <defs>
              <linearGradient id="privRing" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#2560e6" />
                <stop offset="1" stopColor="#1aa9d6" />
              </linearGradient>
            </defs>
          </svg>
          <span className="absolute inset-0 grid place-items-center font-display text-base font-bold text-foreground">
            <AnimatedCounter value={nonPersonalPct} suffix="%" />
          </span>
        </div>
        <p className="text-sm leading-snug text-foreground/70">
          of what we store is just your learning progress — not personal data.
        </p>
      </div>

      {/* stat count-ups */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="ac-card rounded-2xl p-3">
          <div className="font-display text-xl font-extrabold leading-none text-foreground">
            <AnimatedCounter value={1} />
          </div>
          <div className="mt-1 text-[12px] text-foreground/70">essential cookie</div>
        </div>
        <div className="ac-card rounded-2xl p-3">
          <div className="font-display text-xl font-extrabold leading-none text-foreground">
            <AnimatedCounter value={0} />
          </div>
          <div className="mt-1 text-[12px] text-foreground/70">trackers sold</div>
        </div>
      </div>

      {/* encryption bar */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[12px] text-foreground/70">
          <span>Encrypted in transit</span>
          <span className="font-semibold text-foreground">
            <AnimatedCounter value={100} suffix="%" />
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[rgba(120,145,190,0.18)]">
          <motion.div
            className="h-full origin-left rounded-full"
            style={{ background: "linear-gradient(90deg,#2560e6,#1aa9d6)" }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={
              reduce ? { duration: 0 } : { type: "spring", stiffness: 90, damping: 20, delay: 0.55 }
            }
          />
        </div>
      </div>
    </motion.aside>
  );
}
