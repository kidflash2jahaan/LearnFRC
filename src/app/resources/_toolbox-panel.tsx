"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Icon } from "@/lib/icon-map";
import { AnimatedCounter } from "@/components/animated-counter";

export type ToolboxShelf = {
  id: string;
  label: string;
  count: number;
  icon: string;
  color: string;
};

/**
 * Signature hero device: "Shelf manifest" — a floating glass instrument that
 * mirrors the toolbox below. Each row is a shelf with a spring-loaded meter
 * bar sized to its link count, and doubles as a jump link to that shelf.
 */
export function ToolboxPanel({
  shelves,
  totalLinks,
  totalSources,
}: {
  shelves: ToolboxShelf[];
  totalLinks: number;
  totalSources: number;
}) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...shelves.map((s) => s.count));

  return (
    <motion.div
      className="ac-glass relative w-full max-w-md p-6 sm:p-7 lg:justify-self-end"
      initial={{ opacity: 0, y: 26, rotate: 1.2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 18, delay: 0.25 }}
      whileHover={reduce ? undefined : { y: -6 }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-[17px] font-bold text-foreground">
          Shelf manifest
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-success">
          <motion.span
            className="h-2 w-2 rounded-full bg-[#12b565]"
            animate={reduce ? undefined : { scale: [1, 1.35, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />
          Curated
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="ac-card rounded-2xl p-4">
          <div className="font-display text-3xl font-extrabold leading-none text-primary">
            <AnimatedCounter value={totalLinks} />
          </div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">links to keep</div>
        </div>
        <div className="ac-card rounded-2xl p-4">
          <div className="font-display text-3xl font-extrabold leading-none text-foreground">
            <AnimatedCounter value={totalSources} suffix="+" />
          </div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">guide sources</div>
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        {shelves.map((s, i) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="-mx-1 flex min-h-11 flex-col justify-center gap-1 rounded-xl px-1 py-1.5 transition-colors hover:bg-secondary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
                <span
                  className="ac-badge flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                  style={{ "--a": s.color } as React.CSSProperties}
                >
                  <Icon name={s.icon} className="h-3.5 w-3.5" />
                </span>
                <span className="truncate">{s.label}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                {s.count}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[rgba(120,145,190,0.18)]">
              <motion.div
                className="h-full origin-left rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${s.color}, #1aa9d6)`,
                  width: `${Math.round((s.count / max) * 100)}%`,
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
          </a>
        ))}
      </div>

      <p className="mt-5 text-[13px] leading-relaxed text-muted-foreground">
        Every link is free to use — sign in and suggest a resource to help keep
        these shelves current all season long.
      </p>
    </motion.div>
  );
}
