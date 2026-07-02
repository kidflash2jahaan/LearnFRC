"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useStaticMotion } from "@/components/perf-mode";

// Arena Clay palette — known sources get a fixed hue; anything else cycles the palette.
const COLORS: Record<string, string> = {
  Google: "#2560e6",
  Reddit: "#f0932b",
  "Chief Delphi": "#7c5cff",
  Referral: "#1aa9d6",
  YouTube: "#e0447a",
  Instagram: "#c74bd6",
  Twitter: "#1aa9d6",
  X: "#182338",
  Discord: "#5865f2",
  Bing: "#12b981",
  "Unknown / Direct": "#8a97ad",
  Direct: "#8a97ad",
};
const PALETTE = [
  "#2560e6",
  "#1aa9d6",
  "#7c5cff",
  "#12b981",
  "#f0932b",
  "#e0447a",
  "#c74bd6",
  "#4d5b78",
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
              strokeLinecap="butt"
              strokeDashoffset={-s.offset * C}
              initial={{ strokeDasharray: `0 ${C}` }}
              animate={{ strokeDasharray: `${s.frac * C} ${C - s.frac * C}` }}
              transition={
                stat
                  ? { duration: 0 }
                  : { duration: 0.9, delay: 0.15 + i * 0.12, ease: "easeOut" }
              }
            />
          ))}
        </g>
        <text x="80" y="77" textAnchor="middle" className="fill-foreground font-display" fontSize="24" fontWeight="700">
          {total}
        </text>
        <text x="80" y="95" textAnchor="middle" className="fill-muted-foreground" fontSize="10">
          users
        </text>
      </svg>

      <ul className="w-full space-y-2">
        {segs.map((s) => (
          <li
            key={s.name}
            className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 text-sm transition-colors hover:bg-primary/[0.04]"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-sm ring-1 ring-black/5"
              style={{ background: s.color }}
            />
            <span className="flex-1 truncate text-foreground">{s.name}</span>
            <span className="text-xs text-muted-foreground">{s.count}</span>
            <span className="w-11 text-right font-mono font-semibold tabular-nums text-primary">
              {Math.round(s.frac * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
