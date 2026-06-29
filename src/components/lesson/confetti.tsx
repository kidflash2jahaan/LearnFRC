"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

// Neon-terminal palette: lime / cyan / magenta + warm + green accents.
const COLORS = ["#c6ff3d", "#22d3ee", "#ff3dcb", "#ffd23d", "#5dff9b"];

/** A lightweight one-shot neon confetti burst. Re-fires whenever `trigger` changes. */
export function Confetti({
  trigger,
  count = 26,
}: {
  trigger: number;
  count?: number;
}) {
  const reduce = useReducedMotion();
  const [pieces, setPieces] = React.useState<
    { id: string; x: number; y: number; r: number; s: number; c: string; sq: boolean }[]
  >([]);

  React.useEffect(() => {
    if (trigger === 0 || reduce) return;
    const ps = Array.from({ length: count }, (_, i) => ({
      id: `${trigger}-${i}`,
      x: (Math.random() - 0.5) * 300,
      y: -(Math.random() * 220 + 70),
      r: Math.random() * 540,
      s: 0.7 + Math.random() * 0.9,
      c: COLORS[i % COLORS.length],
      sq: i % 2 === 0,
    }));
    setPieces(ps);
    const t = setTimeout(() => setPieces([]), 1100);
    return () => clearTimeout(t);
  }, [trigger, reduce, count]);

  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-20">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: p.s }}
          animate={{ opacity: 0, x: p.x, y: p.y, rotate: p.r, scale: p.s }}
          transition={{ duration: 1.1, ease: [0.2, 0.7, 0.2, 1] }}
          className={p.sq ? "absolute h-2 w-2 rounded-[2px]" : "absolute h-2 w-2 rounded-full"}
          style={{ background: p.c, boxShadow: `0 0 8px ${p.c}` }}
        />
      ))}
    </div>
  );
}
