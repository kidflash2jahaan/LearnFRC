"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Clock, Layers, Library } from "lucide-react";
import { Icon } from "@/lib/icon-map";
import { deptMeta, inkFor } from "@/lib/departments";
import { AnimatedCounter } from "@/components/animated-counter";

export type ShelfRow = { slug: string; name: string; count: number };

/**
 * Signature hero device: "Your shelf" — a floating glass instrument that
 * renders one spring-drawn bar per department, width proportional to how
 * many lessons are saved there. Department icon/color are resolved from the
 * slug HERE (client-side), so the server only ever passes plain data in.
 */
export function ShelfPanel({
  shelves,
  deptCount,
  readMinutes,
  total,
}: {
  shelves: ShelfRow[];
  deptCount: number;
  readMinutes: number;
  total: number;
}) {
  const reduce = useReducedMotion();
  const top = shelves[0];
  const max = Math.max(1, ...shelves.map((s) => s.count));
  const empty = total === 0;

  return (
    <motion.div
      className="ac-glass relative w-full max-w-md overflow-hidden p-6 sm:p-7 lg:justify-self-end"
      initial={{ opacity: 0, y: 26, rotate: -1.2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={
        reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 18, delay: 0.25 }
      }
      whileHover={reduce ? undefined : { y: -6 }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[radial-gradient(circle,#1aa9d6,transparent_70%)] opacity-25 blur-3xl"
      />

      {/* header row */}
      <div className="relative flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 font-display text-[17px] font-bold text-foreground">
          <span
            className="ac-badge flex h-8 w-8 items-center justify-center"
            style={{ "--a": "#2560e6" } as CSSProperties}
          >
            <Library className="h-4 w-4" aria-hidden />
          </span>
          {empty ? "An empty shelf" : "Your shelf"}
        </span>
        {!empty && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-success">
            <motion.span
              className="h-2 w-2 rounded-full bg-[#12b565]"
              animate={reduce ? undefined : { scale: [1, 1.35, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden
            />
            Live
          </span>
        )}
      </div>

      {/* department spines */}
      {empty ? (
        <div className="relative mt-6 flex flex-col gap-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 opacity-60">
              <span className="h-9 w-9 shrink-0 rounded-xl border border-dashed border-border bg-background/40" />
              <div className="h-[7px] flex-1 rounded-md border border-dashed border-border" />
            </div>
          ))}
        </div>
      ) : (
        <div className="relative mt-6 flex flex-col gap-3">
          {shelves.map((s, i) => {
            const m = deptMeta(s.slug);
            const pct = Math.max((s.count / max) * 100, 10);
            return (
              <div key={s.slug} className="flex items-center gap-3">
                <span
                  className="ac-badge flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ "--a": m.color } as CSSProperties}
                >
                  <Icon name={m.icon} className="h-[17px] w-[17px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {s.name}
                    </span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                      {s.count}
                    </span>
                  </div>
                  <div className="mt-1.5 h-[7px] overflow-hidden rounded-full bg-[rgba(120,145,190,0.2)]">
                    <motion.div
                      className="h-full origin-left rounded-full"
                      style={{ background: `linear-gradient(90deg, ${m.color}, ${m.to})` }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: pct / 100 }}
                      transition={
                        reduce
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 90, damping: 20, delay: 0.45 + i * 0.1 }
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {empty ? (
        <p className="relative mt-5 text-center text-[13px] leading-relaxed text-muted-foreground">
          Bookmark a lesson and its spine appears here.
        </p>
      ) : (
        <>
          <hr className="ac-divider relative my-5" />
          <div className="relative grid grid-cols-2 gap-3">
            <div className="ac-card rounded-2xl px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                <Layers className="h-3.5 w-3.5" aria-hidden />
                Departments
              </div>
              <div className="mt-1 font-display text-2xl font-extrabold leading-none text-foreground">
                <AnimatedCounter value={deptCount} />
              </div>
            </div>
            <div className="ac-card rounded-2xl px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {readMinutes > 0 ? "Read time" : "Saved"}
              </div>
              <div className="mt-1 font-display text-2xl font-extrabold leading-none text-foreground">
                {readMinutes > 0 ? (
                  <>
                    <AnimatedCounter value={readMinutes} />
                    <span className="text-base font-bold text-muted-foreground"> min</span>
                  </>
                ) : (
                  <AnimatedCounter value={total} />
                )}
              </div>
            </div>
          </div>

          {top && (
            <p className="relative mt-4 text-center text-sm text-muted-foreground">
              Leaning hardest into{" "}
              <span className="font-semibold" style={{ color: inkFor(deptMeta(top.slug).color) }}>
                {top.name}
              </span>
              .
            </p>
          )}
        </>
      )}
    </motion.div>
  );
}
