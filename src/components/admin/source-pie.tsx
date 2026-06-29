"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useStaticMotion } from "@/components/perf-mode";

// Known-source neon colors; anything else falls back to the neon palette by index.
const COLORS: Record<string, string> = {
  Google: "#22d3ee",
  Reddit: "#ffd23d",
  "Chief Delphi": "#ff3dcb",
  Referral: "#5dff9b",
  YouTube: "#ff8af0",
  Instagram: "#ff3dcb",
  Twitter: "#22d3ee",
  X: "#22d3ee",
  Discord: "#c6ff3d",
  Bing: "#5dff9b",
  "Unknown / Direct": "#5e6b7e",
  Direct: "#5e6b7e",
};
const PALETTE = [
  "#c6ff3d",
  "#22d3ee",
  "#ff3dcb",
  "#ffd23d",
  "#5dff9b",
  "#ff8af0",
  "#7df0c0",
  "#9bf6ff",
];

export function SourcePie({
  data,
}: {
  data: { name: string; count: number }[];
}) {
  const stat = useStaticMotion();
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const r = 60;
  const C = 2 * Math.PI * r;
  const colorFor = (name: string, i: number) => COLORS[name] ?? PALETTE[i % PALETTE.length];

  let acc = 0;
  const segs = data.map((d, i) => {
    const frac = d.count / total;
    const seg = { ...d, frac, color: colorFor(d.name, i), offset: acc };
    acc += frac;
    return seg;
  });

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
      <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0">
        <g transform="rotate(-90 80 80)">
          <circle cx="80" cy="80" r={r} fill="none" stroke="var(--muted)" strokeWidth="20" />
          {segs.map((s, i) => (
            <motion.circle
              key={s.name}
              cx="80"
              cy="80"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="20"
              strokeDashoffset={-s.offset * C}
              style={{ filter: `drop-shadow(0 0 3px color-mix(in srgb, ${s.color} 60%, transparent))` }}
              initial={
                stat
                  ? { strokeDasharray: `${s.frac * C} ${C - s.frac * C}` }
                  : { strokeDasharray: `0 ${C}` }
              }
              animate={{ strokeDasharray: `${s.frac * C} ${C - s.frac * C}` }}
              transition={{ duration: 0.9, delay: 0.15 + i * 0.12, ease: "easeOut" }}
            />
          ))}
        </g>
        <text x="80" y="77" textAnchor="middle" className="fill-foreground font-display" fontSize="24" fontWeight="700">
          {total}
        </text>
        <text x="80" y="95" textAnchor="middle" className="fill-muted-foreground font-mono" fontSize="10">
          users
        </text>
      </svg>

      <ul className="w-full space-y-2">
        {segs.map((s) => (
          <li
            key={s.name}
            className="flex items-center gap-2.5 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-primary/[0.04]"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ background: s.color, boxShadow: `0 0 8px color-mix(in srgb, ${s.color} 70%, transparent)` }}
            />
            <span className="flex-1 truncate">{s.name}</span>
            <span className="font-mono text-xs text-muted-foreground">{s.count}</span>
            <span className="w-11 text-right font-mono font-semibold tabular-nums text-accent">
              {Math.round(s.frac * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
