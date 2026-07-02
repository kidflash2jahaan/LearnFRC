"use client";

import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Trophy } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { AnimatedCounter } from "@/components/animated-counter";

/**
 * Signature hero device: the "trophy panel" — a glass instrument with the
 * level ring wrapping the learner's avatar (spring-drawn on load), the tier
 * name glowing beneath it, and an XP rail counting down to the next level.
 * This is the ONE shareable, screenshot-worthy element on the page.
 */
export function TrophyPanel({
  level,
  levelFraction,
  xpToNext,
  tierName,
  tierColor,
  avatarName,
  avatarSrc,
  avatarSeed,
}: {
  level: number;
  levelFraction: number;
  xpToNext: number;
  tierName: string;
  tierColor: string;
  avatarName: string;
  avatarSrc: string | null;
  avatarSeed: string;
}) {
  const reduce = useReducedMotion();
  const r = 72;
  const c = 2 * Math.PI * r;
  const offset = c - c * Math.min(1, Math.max(0, levelFraction));

  return (
    <motion.div
      className="ac-glass relative w-full max-w-sm overflow-hidden p-6 sm:p-7 lg:justify-self-end"
      style={{ "--a": tierColor } as CSSProperties}
      initial={{ opacity: 0, y: 26, rotate: 1.2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={
        reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 18, delay: 0.25 }
      }
      whileHover={reduce ? undefined : { y: -6 }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${tierColor}, transparent 70%)`, opacity: 0.3 }}
      />

      <div className="relative flex items-center justify-between gap-3">
        <span className="ac-eyebrow">Trophy card</span>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-success">
          <motion.span
            className="h-2 w-2 rounded-full bg-[#12b565]"
            animate={reduce ? undefined : { scale: [1, 1.35, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />
          Live
        </span>
      </div>

      <div className="relative mt-6 flex flex-col items-center">
        <div className="relative h-44 w-44">
          <svg viewBox="0 0 176 176" className="h-44 w-44 -rotate-90">
            <circle
              cx="88"
              cy="88"
              r={r}
              fill="none"
              stroke="rgba(120,145,190,0.22)"
              strokeWidth="12"
            />
            <motion.circle
              cx="88"
              cy="88"
              r={r}
              fill="none"
              stroke={tierColor}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={c}
              initial={{ strokeDashoffset: c }}
              animate={{ strokeDashoffset: offset }}
              transition={
                reduce ? { duration: 0 } : { type: "spring", stiffness: 55, damping: 18, delay: 0.4 }
              }
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Avatar
              name={avatarName}
              src={avatarSrc}
              seed={avatarSeed}
              className="h-24 w-24 text-2xl shadow-[0_12px_30px_rgba(40,80,150,0.22)] ring-4 ring-white/85"
            />
          </div>
          <span
            className="ac-badge absolute -bottom-1 left-1/2 flex h-9 min-w-9 -translate-x-1/2 items-center justify-center rounded-full px-2 text-xs font-extrabold"
            style={{ "--a": tierColor } as CSSProperties}
          >
            <AnimatedCounter value={level} />
          </span>
        </div>

        <span
          className="ac-badge mt-5 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.1em]"
          style={{ "--a": tierColor } as CSSProperties}
        >
          <Trophy aria-hidden className="h-3.5 w-3.5" />
          {tierName}
        </span>
      </div>

      <div className="relative mt-6">
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
          <span className="font-semibold text-foreground">Level {level}</span>
          <span className="tabular-nums text-muted-foreground">
            <AnimatedCounter value={xpToNext} /> XP to level {level + 1}
          </span>
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-[rgba(120,145,190,.24)]"
          role="progressbar"
          aria-valuenow={Math.round(levelFraction * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${Math.round(levelFraction * 100)}% of the way to level ${level + 1}`}
        >
          <motion.div
            className="h-full origin-left rounded-full"
            style={{ background: `linear-gradient(90deg, ${tierColor}, #1aa9d6)` }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: Math.max(levelFraction, 0.03) }}
            transition={
              reduce ? { duration: 0 } : { type: "spring", stiffness: 90, damping: 20, delay: 0.55 }
            }
          />
        </div>
      </div>
    </motion.div>
  );
}
