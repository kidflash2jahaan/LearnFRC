"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Icon } from "@/lib/icon-map";
import { AnimatedCounter } from "@/components/animated-counter";

export type DeskCount = {
  label: string;
  color: string;
  icon: string;
  count: number;
};

/**
 * Signature hero device: "The desk index" — a floating glass card catalog
 * showing the reader how the library is filed, with spring-loaded bars per
 * editorial desk that sweep in on load. Mirrors the homepage's telemetry
 * panel language but for the article library.
 */
export function DeskIndex({
  guideCount,
  totalMins,
  deskCount,
  desks,
}: {
  guideCount: number;
  totalMins: number;
  deskCount: number;
  desks: DeskCount[];
}) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...desks.map((d) => d.count));

  return (
    <motion.div
      className="ac-glass relative w-full max-w-md p-6 sm:p-7 lg:justify-self-end"
      initial={{ opacity: 0, y: 26, rotate: 1.2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 18, delay: 0.25 }}
      whileHover={reduce ? undefined : { y: -6 }}
    >
      {/* header row */}
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-[17px] font-bold text-foreground">
          The desk index
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-success">
          <motion.span
            className="h-2 w-2 rounded-full bg-[#12b565]"
            animate={reduce ? undefined : { scale: [1, 1.35, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />
          In print
        </span>
      </div>

      {/* headline numbers */}
      <div className="mt-5 grid grid-cols-3 gap-2.5">
        <div className="ac-card rounded-2xl p-3.5">
          <div className="font-display text-2xl font-extrabold leading-none text-primary">
            <AnimatedCounter value={guideCount} />
          </div>
          <div className="mt-1 text-[11px] font-medium leading-tight text-muted-foreground">
            articles
          </div>
        </div>
        <div className="ac-card rounded-2xl p-3.5">
          <div className="font-display text-2xl font-extrabold leading-none text-foreground">
            <AnimatedCounter value={totalMins} />
          </div>
          <div className="mt-1 text-[11px] font-medium leading-tight text-muted-foreground">
            min reading
          </div>
        </div>
        <div className="ac-card rounded-2xl p-3.5">
          <div className="font-display text-2xl font-extrabold leading-none text-foreground">
            <AnimatedCounter value={deskCount} />
          </div>
          <div className="mt-1 text-[11px] font-medium leading-tight text-muted-foreground">
            desks
          </div>
        </div>
      </div>

      {/* desk breakdown meters */}
      <div className="mt-5 space-y-3">
        {desks.map((d, i) => (
          <div key={d.label}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
                <span
                  className="ac-badge flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                  style={{ "--a": d.color } as React.CSSProperties}
                >
                  <Icon name={d.icon} className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="truncate">{d.label}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                {d.count}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[rgba(120,145,190,0.18)]">
              <motion.div
                className="h-full origin-left rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${d.color}, #1aa9d6)`,
                  width: `${Math.round((d.count / max) * 100)}%`,
                }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 90, damping: 20, delay: 0.5 + i * 0.1 }
                }
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 text-[13px] leading-relaxed text-muted-foreground">
        Every article is free to read, no login needed. Join the list below and
        new filings land in your inbox.
      </p>
    </motion.div>
  );
}
