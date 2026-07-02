"use client";

import * as React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

/**
 * ARENA CLAY 2 motion primitives.
 *
 * Hydration-safety contract (do not break):
 *  - The rendered TREE and TEXT are identical on server and client. Reduced
 *    motion only ever changes `transition` timing (duration 0), never what
 *    gets rendered.
 *  - Springs for interactive feel, 150–400ms for micro-moves, stagger
 *    30–90ms, transform/opacity only.
 */

const SPRING = { type: "spring", stiffness: 260, damping: 26 } as const;
const EASE = [0.21, 0.47, 0.32, 0.98] as const;

function useT(base: object) {
  const reduce = useReducedMotion();
  return reduce ? { duration: 0 } : base;
}

/* ---------------- On-load hero entrance ---------------- */

export function Rise({
  children,
  delay = 0,
  y = 18,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "span" | "header";
}) {
  const t = useT({ ...SPRING, delay });
  const M = motion[as] as typeof motion.div;
  return (
    <M className={className} initial={{ opacity: 0, y }} animate={{ opacity: 1, y: 0 }} transition={t}>
      {children}
    </M>
  );
}

const groupVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};
const itemVariantsStill: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0 } },
};

export function RiseGroup({
  children,
  className,
  stagger = 0.08,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : stagger } } }}
    >
      {children}
    </motion.div>
  );
}

export function RiseItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} variants={reduce ? itemVariantsStill : itemVariants}>
      {children}
    </motion.div>
  );
}

/* ---------------- Scroll reveals (framer whileInView) ---------------- */

export function Reveal({
  children,
  className,
  delay = 0,
  y = 22,
  once = true,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  once?: boolean;
  as?: "div" | "section" | "li" | "span" | "article";
}) {
  const t = useT({ duration: 0.55, delay, ease: EASE });
  const M = motion[as] as typeof motion.div;
  return (
    <M
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-60px" }}
      transition={t}
    >
      {children}
    </M>
  );
}

export function RevealGroup({
  children,
  className,
  stagger = 0.07,
  once = true,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  once?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: "-60px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : stagger } } }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "li" | "article" | "span";
}) {
  const reduce = useReducedMotion();
  const M = motion[as] as typeof motion.div;
  return (
    <M className={className} variants={reduce ? itemVariantsStill : itemVariants}>
      {children}
    </M>
  );
}

/* ---------------- Hover micro-interaction ---------------- */

export function Hover({
  children,
  className,
  lift = -4,
  scale = 1.02,
}: {
  children: React.ReactNode;
  className?: string;
  lift?: number;
  scale?: number;
}) {
  const reduce = useReducedMotion();
  // NOTE: no whileTap here — framer adds tabindex="0" to tap-enabled elements,
  // which (a) hydration-mismatches when reduced-motion clients skip it and
  // (b) creates phantom tab stops. The inner link/button is the focus target.
  return (
    <motion.div
      className={className}
      whileHover={reduce ? undefined : { y: lift, scale }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
    >
      {children}
    </motion.div>
  );
}

/* ---------------- Ambient drifting glow blobs ---------------- */

export type GlowBlob = {
  /** CSS size, e.g. "560px" */
  size: string;
  /** Absolute position styles, e.g. { left: "-160px", top: "-200px" } */
  pos: React.CSSProperties;
  /** Blob color (soft pastels: #8bbcff, #6ff0ea, #c8b6ff, or a dept accent) */
  color: string;
  /** Drift phase offset in seconds */
  delay?: number;
  /** 0–1 opacity, default 0.55 */
  opacity?: number;
};

/**
 * Full-bleed ambient light. MUST live inside the page's full-width
 * `relative overflow-x-clip` wrapper (never inside a max-width container),
 * so blobs fade at the viewport edge with no mid-page seam.
 */
export function Glow({ blobs }: { blobs: GlowBlob[] }) {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-x-clip">
      {blobs.map((b, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full blur-3xl"
          style={{
            width: b.size,
            height: b.size,
            opacity: b.opacity ?? 0.55,
            background: `radial-gradient(circle, ${b.color}, transparent 70%)`,
            ...b.pos,
          }}
          animate={reduce ? undefined : { x: [0, 34, 0], y: [0, 22, 0], scale: [1, 1.07, 1] }}
          transition={
            reduce
              ? { duration: 0 }
              : { duration: 17 + i * 4, repeat: Infinity, ease: "easeInOut", delay: b.delay ?? 0 }
          }
        />
      ))}
    </div>
  );
}
