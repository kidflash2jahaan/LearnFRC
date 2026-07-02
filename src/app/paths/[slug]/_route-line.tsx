"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Signature decorative spine for the route: a vertical line that grows
 * downward as the journey section scrolls into view, tying the start
 * marker, every stop, and the destination marker into one continuous path.
 * Purely decorative (aria-hidden) — the real order lives in the <ol> below.
 */
export function RouteLine({ color }: { color: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute bottom-6 left-[27px] top-2 hidden w-px origin-top sm:block"
      style={{
        background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 30%, #1aa9d6))`,
      }}
      initial={{ scaleY: 0 }}
      whileInView={{ scaleY: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={reduce ? { duration: 0 } : { duration: 1.1, ease: [0.21, 0.47, 0.32, 0.98] }}
    />
  );
}
