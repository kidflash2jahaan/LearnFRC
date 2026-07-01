"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Animated circular XP ring. Shows the current level in the center and fills a
 * soft arc toward the next level (XP % 100), in the Arena Clay blue/cyan accent.
 */
export function LevelRing({
  level,
  progressPct,
  size = 92,
  stroke = 7,
}: {
  level: number;
  progressPct: number; // 0..100 toward next level
  size?: number;
  stroke?: number;
}) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, progressPct));
  const offset = c - (pct / 100) * c;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Level ${level}, ${Math.round(pct)}% to next level`}
    >
      <svg width={size} height={size} className="relative -rotate-90">
        {/* track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={1}
          strokeDasharray="1 7"
          className="stroke-border"
          opacity={0.7}
        />
        <defs>
          <linearGradient id="level-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-accent)" />
            <stop offset="100%" stopColor="var(--color-primary)" />
          </linearGradient>
        </defs>
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#level-ring-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? offset : c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: [0.21, 0.47, 0.32, 0.98], delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[9px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          lvl
        </span>
        <span className="font-display text-2xl font-bold leading-none text-primary">
          {level}
        </span>
      </div>
    </div>
  );
}
