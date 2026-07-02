"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, UserPlus, CheckCircle2, Users } from "lucide-react";
import { AnimatedCounter } from "@/components/animated-counter";

// Icons resolved here by NAME — component functions can't cross the
// server -> client boundary.
const VITAL_ICONS = { userPlus: UserPlus, checkCircle: CheckCircle2, users: Users } as const;

export type RailVital = {
  icon: keyof typeof VITAL_ICONS;
  label: string;
  value: number;
  hint: string;
};

/**
 * Signature hero device: "Live vitals" — a floating glass command rail with
 * an animated online-now ring plus a stack of ticking platform vitals.
 */
export function MissionRail({
  onlineNow,
  vitals,
}: {
  onlineNow: number;
  vitals: RailVital[];
}) {
  const reduce = useReducedMotion();
  const r = 34;
  const C = 2 * Math.PI * r;
  // Purely decorative fill — not tied to a real ratio, just a lively readout.
  const fillFrac = 0.78;

  return (
    <motion.aside
      className="ac-glass relative w-full max-w-md p-6 sm:p-7 lg:justify-self-end"
      initial={{ opacity: 0, y: 26, rotate: 1.2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={
        reduce
          ? { duration: 0 }
          : { type: "spring", stiffness: 140, damping: 18, delay: 0.25 }
      }
      whileHover={reduce ? undefined : { y: -6 }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-[17px] font-bold text-foreground">
          Live vitals
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-success">
          <motion.span
            className="h-2 w-2 rounded-full bg-[#12b565]"
            animate={
              reduce ? undefined : { scale: [1, 1.35, 1], opacity: [1, 0.6, 1] }
            }
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />
          Online
        </span>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <svg width="82" height="82" viewBox="0 0 82 82" aria-hidden="true">
          <circle
            cx="41"
            cy="41"
            r={r}
            fill="none"
            stroke="rgba(120,145,190,.28)"
            strokeWidth="10"
          />
          <motion.circle
            cx="41"
            cy="41"
            r={r}
            fill="none"
            stroke="url(#mission-rail-ring)"
            strokeWidth="10"
            strokeLinecap="round"
            transform="rotate(-90 41 41)"
            initial={{ strokeDasharray: `0 ${C}` }}
            animate={{ strokeDasharray: `${fillFrac * C} ${C}` }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: 1.1, delay: 0.4, ease: "easeOut" }
            }
          />
          <defs>
            <linearGradient id="mission-rail-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#2560e6" />
              <stop offset="1" stopColor="#1aa9d6" />
            </linearGradient>
          </defs>
          <foreignObject x="21" y="30" width="40" height="24">
            <div className="flex h-6 items-center justify-center text-foreground/60">
              <Activity className="h-5 w-5" aria-hidden="true" />
            </div>
          </foreignObject>
        </svg>
        <div>
          <div className="font-display text-3xl font-extrabold leading-none text-foreground">
            <AnimatedCounter value={onlineNow} />
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            signed in &middot; last 5 min
          </div>
        </div>
      </div>

      <div className="ac-divider my-5" />

      <div className="space-y-3">
        {vitals.map((v, i) => (
          <motion.div
            key={v.label}
            className="flex items-center gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: 0.4, delay: 0.5 + i * 0.1, ease: "easeOut" }
            }
          >
            <span
              className="ac-badge flex h-9 w-9 shrink-0 items-center justify-center"
              style={{ "--a": "var(--primary)" } as CSSProperties}
            >
              {React.createElement(VITAL_ICONS[v.icon], { className: "h-[18px] w-[18px]", "aria-hidden": true })}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">
                {v.label}
              </div>
              <div className="text-xs text-muted-foreground">{v.hint}</div>
            </div>
            <span className="shrink-0 font-display text-xl font-extrabold tabular-nums text-primary">
              <AnimatedCounter value={v.value} />
            </span>
          </motion.div>
        ))}
      </div>
    </motion.aside>
  );
}
