"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AnimatedCounter } from "@/components/animated-counter";

/**
 * Signature hero device: "Mission progress" — a glass instrument with a
 * spring-drawn mastery ring in the department accent. The bright accent is
 * used for the ring fill only; every piece of text on top uses inkFor()
 * so it stays legible on the light glass.
 */
export function MasteryPanel({
  pct,
  doneCount,
  totalLessons,
  accent,
  ink,
  loggedIn,
}: {
  pct: number;
  doneCount: number;
  totalLessons: number;
  accent: string;
  ink: string;
  loggedIn: boolean;
}) {
  const reduce = useReducedMotion();
  const r = 66;
  const c = 2 * Math.PI * r;
  const offset = c - (c * Math.min(100, Math.max(0, pct))) / 100;
  const complete = loggedIn && totalLessons > 0 && doneCount === totalLessons;
  const started = loggedIn && doneCount > 0 && !complete;

  return (
    <motion.div
      className="ac-glass relative w-full max-w-sm overflow-hidden p-6 sm:p-7 lg:justify-self-end"
      style={{ "--a": accent } as CSSProperties}
      initial={{ opacity: 0, y: 26, rotate: -1.2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={
        reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 18, delay: 0.25 }
      }
      whileHover={reduce ? undefined : { y: -6 }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)`, opacity: 0.28 }}
      />

      <div className="relative flex items-center justify-between gap-3">
        <span className="ac-eyebrow inline-flex items-center gap-1.5">Mission progress</span>
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
        <div className="relative h-40 w-40">
          <svg viewBox="0 0 160 160" className="h-40 w-40 -rotate-90">
            <circle
              cx="80"
              cy="80"
              r={r}
              fill="none"
              stroke="rgba(120,145,190,0.22)"
              strokeWidth="14"
            />
            <motion.circle
              cx="80"
              cy="80"
              r={r}
              fill="none"
              stroke={accent}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={c}
              initial={{ strokeDashoffset: c }}
              animate={{ strokeDashoffset: offset }}
              transition={
                reduce ? { duration: 0 } : { type: "spring", stiffness: 55, damping: 18, delay: 0.4 }
              }
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-4xl font-extrabold leading-none" style={{ color: ink }}>
              <AnimatedCounter value={pct} suffix="%" />
            </span>
            <span className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              mastered
            </span>
          </div>
        </div>

        <p className="mt-5 text-sm font-semibold" style={{ color: ink }}>
          <AnimatedCounter value={doneCount} /> / <AnimatedCounter value={totalLessons} /> lessons
        </p>
      </div>

      {!loggedIn && (
        <p className="relative mt-5 text-center text-[13px] leading-relaxed text-muted-foreground">
          Reading is free — no login needed. Sign in to light up this ring as
          you master the department.
        </p>
      )}
      {complete && (
        <p className="relative mt-5 text-center text-sm font-semibold" style={{ color: ink }}>
          Department complete. Gracious professionalism, well earned.
        </p>
      )}
      {started && (
        <p className="relative mt-5 text-center text-[13px] leading-relaxed text-muted-foreground">
          {totalLessons - doneCount} lessons to the finish line — keep going.
        </p>
      )}
    </motion.div>
  );
}
