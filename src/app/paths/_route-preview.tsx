"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, MapPin, Flag } from "lucide-react";
import { Icon } from "@/lib/icon-map";
import { AnimatedCounter } from "@/components/animated-counter";

export type RouteStation = {
  deptSlug: string;
  label: string;
  color: string;
  icon: string;
  ink: string;
};

/**
 * Signature hero device: "the route" — a floating glass instrument that
 * plots the featured learning path as a mapped journey: a draw-in spine
 * connecting a start flag, every department stop, and a season-ready
 * finish. Mirrors the homepage's telemetry-panel feel without repeating it.
 */
export function RoutePreview({
  title,
  description,
  slug,
  color,
  icon,
  stations,
  outcomeCount,
}: {
  title: string;
  description: string;
  slug: string;
  color: string;
  icon: string;
  stations: RouteStation[];
  outcomeCount: number;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="ac-glass relative w-full max-w-md p-6 sm:p-7 lg:justify-self-end"
      initial={{ opacity: 0, y: 26, rotate: -1.2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={
        reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 18, delay: 0.25 }
      }
      whileHover={reduce ? undefined : { y: -6 }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="ac-badge flex h-11 w-11 flex-none items-center justify-center"
          style={{ "--a": color } as CSSProperties}
        >
          <Icon name={icon} className="h-[22px] w-[22px]" />
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
            Featured route
          </span>
          <span className="block truncate font-display text-[17px] font-bold text-foreground">
            {title}
          </span>
        </span>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-foreground/70">{description}</p>

      {/* the route: draw-in spine + stations */}
      <div className="relative mt-6">
        <motion.span
          aria-hidden
          className="absolute left-[15px] top-2 w-0.5 origin-top rounded-full"
          style={{
            height: "calc(100% - 16px)",
            background: "linear-gradient(to bottom, #2560e6, #1aa9d6)",
          }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={
            reduce ? { duration: 0 } : { duration: 1, ease: [0.21, 0.47, 0.32, 0.98], delay: 0.4 }
          }
        />
        <ol className="relative space-y-3">
          <li className="flex items-center gap-3">
            <span className="relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/20">
              <MapPin className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Start
            </span>
          </li>
          {stations.map((s, i) => (
            <motion.li
              key={s.deptSlug + i}
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 260, damping: 26, delay: 0.55 + i * 0.08 }
              }
            >
              <span
                className="relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-lg ring-1 ring-white/70"
                style={
                  {
                    background: `color-mix(in srgb, ${s.color} 20%, #fff)`,
                    color: s.ink,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85)",
                  } as CSSProperties
                }
              >
                <Icon name={s.icon} className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {s.label}
              </span>
              <span
                aria-hidden
                className="flex-none text-xs font-semibold tabular-nums text-muted-foreground"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
            </motion.li>
          ))}
          <li className="flex items-center gap-3">
            <span className="relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/20">
              <Flag className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Season-ready
            </span>
          </li>
        </ol>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
        <span className="text-xs text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">
            <AnimatedCounter value={stations.length} />
          </span>{" "}
          stops ·{" "}
          <span className="font-semibold tabular-nums text-foreground">
            <AnimatedCounter value={outcomeCount} />
          </span>{" "}
          outcomes
        </span>
        <Link href={`/paths/${slug}`} className="ac-btn text-xs">
          Start route <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </motion.div>
  );
}
