"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Icon } from "@/lib/icon-map";
import { AnimatedCounter } from "@/components/animated-counter";

export type HeroDept = {
  slug: string;
  name: string;
  color: string;
  icon: string;
  lessons: number;
};

/**
 * Signature hero device: "Season telemetry" — a floating glass instrument
 * showing the platform live: total lessons ticking up, and the biggest
 * departments as spring-loaded meter bars that sweep in on load.
 */
export function HeroPanel({
  lessonCount,
  deptCount,
  depts,
}: {
  lessonCount: number;
  deptCount: number;
  depts: HeroDept[];
}) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...depts.map((d) => d.lessons));

  return (
    <motion.div
      className="ac-glass relative w-full max-w-md p-6 sm:p-7 lg:justify-self-end"
      initial={{ opacity: 0, y: 26, rotate: -1.2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 18, delay: 0.25 }}
      whileHover={reduce ? undefined : { y: -6 }}
    >
      {/* header row */}
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-[17px] font-bold text-foreground">
          Season telemetry
        </span>
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

      {/* headline numbers */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="ac-card rounded-2xl p-4">
          <div className="font-display text-3xl font-extrabold leading-none text-primary">
            <AnimatedCounter value={lessonCount} />
          </div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">lessons to master</div>
        </div>
        <div className="ac-card rounded-2xl p-4">
          <div className="font-display text-3xl font-extrabold leading-none text-foreground">
            <AnimatedCounter value={deptCount} />
          </div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">departments</div>
        </div>
      </div>

      {/* department meters */}
      <div className="mt-5 space-y-3">
        {depts.map((d, i) => (
          <div key={d.slug}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
                <span
                  className="ac-badge flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                  style={{ "--a": d.color } as React.CSSProperties}
                >
                  <Icon name={d.icon} className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="truncate">{d.name}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                {d.lessons} lessons
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[rgba(120,145,190,0.18)]">
              <motion.div
                className="h-full origin-left rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${d.color}, #1aa9d6)`,
                  width: `${Math.round((d.lessons / max) * 100)}%`,
                }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 90, damping: 20, delay: 0.5 + i * 0.12 }
                }
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 text-[13px] leading-relaxed text-muted-foreground">
        Reading is free, no login needed. Sign up to track your mastery across
        every department, all season long.
      </p>
    </motion.div>
  );
}
