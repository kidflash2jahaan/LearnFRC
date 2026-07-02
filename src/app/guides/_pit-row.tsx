"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Icon } from "@/lib/icon-map";

export type PitStop = {
  slug: string;
  name: string;
  icon: string;
  color: string;
  lessonCount: number;
};

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

/**
 * Signature hero device: "Pit Row" — a floating glass panel that reads like a
 * numbered pit-stall roster. A connecting walkway line grows down the left
 * edge on load, then each stall entry steps in behind it — the visual
 * metaphor for "walk the pit, department by department."
 */
export function PitRow({
  stops,
  totalCount,
}: {
  stops: PitStop[];
  totalCount: number;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="ac-glass relative w-full min-w-0 max-w-md p-6 sm:p-7 lg:justify-self-end"
      initial={{ opacity: 0, y: 26, rotate: 1.2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 18, delay: 0.25 }}
      whileHover={reduce ? undefined : { y: -6 }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-[17px] font-bold text-foreground">
          Today&rsquo;s walk
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-success">
          <motion.span
            className="h-2 w-2 rounded-full bg-[#12b565]"
            animate={reduce ? undefined : { scale: [1, 1.35, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />
          Open pit
        </span>
      </div>

      <div className="relative mt-5">
        <motion.span
          aria-hidden
          className="pointer-events-none absolute bottom-3 left-[23px] top-3 hidden w-px origin-top sm:block"
          style={{ background: "linear-gradient(180deg, var(--border), transparent)" }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={reduce ? { duration: 0 } : { duration: 0.9, delay: 0.4, ease: EASE }}
        />
        <ul className="space-y-1.5">
          {stops.map((s, i) => (
            <motion.li
              key={s.slug}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={reduce ? { duration: 0 } : { duration: 0.4, delay: 0.35 + i * 0.07, ease: EASE }}
            >
              <Link
                href={`/guides/${s.slug}`}
                className="group relative flex min-h-11 items-center gap-3 rounded-2xl px-2 py-1.5 transition-colors hover:bg-white/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/70 font-display text-[11px] font-bold tabular-nums text-foreground/45">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className="ac-badge flex h-9 w-9 shrink-0 items-center justify-center"
                  style={{ "--a": s.color } as CSSProperties}
                >
                  <Icon name={s.icon} className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {s.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {s.lessonCount} lessons
                  </span>
                </span>
                <ArrowUpRight
                  className="h-4 w-4 shrink-0 text-foreground/35 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
                  aria-hidden
                />
              </Link>
            </motion.li>
          ))}
        </ul>
      </div>

      <p className="mt-5 text-[13px] leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">{totalCount} stops</span>{" "}
        on the map — every one free to walk in, in the spirit of gracious
        professionalism.
      </p>
    </motion.div>
  );
}
