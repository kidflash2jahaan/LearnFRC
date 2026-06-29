"use client";

import * as React from "react";

// Known-source brand colors; anything else falls back to the palette by index.
const COLORS: Record<string, string> = {
  Google: "#4285F4",
  Reddit: "#FF4500",
  "Chief Delphi": "#7c3aed",
  Referral: "#34d399",
  YouTube: "#ef4444",
  Instagram: "#e1306c",
  Twitter: "#1da1f2",
  X: "#1da1f2",
  Discord: "#5865f2",
  Bing: "#22d3ee",
  "Unknown / Direct": "#64748b",
  Direct: "#64748b",
};
const PALETTE = [
  "#2f5fff",
  "#f59e0b",
  "#a855f7",
  "#06b6d4",
  "#ec4899",
  "#10b981",
  "#f97316",
  "#8b5cf6",
];

export function SourcePie({
  data,
}: {
  data: { name: string; count: number }[];
}) {
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
          {segs.map((s) => (
            <circle
              key={s.name}
              cx="80"
              cy="80"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="20"
              strokeDasharray={`${s.frac * C} ${C - s.frac * C}`}
              strokeDashoffset={-s.offset * C}
            />
          ))}
        </g>
        <text x="80" y="77" textAnchor="middle" className="fill-foreground" fontSize="24" fontWeight="700">
          {total}
        </text>
        <text x="80" y="95" textAnchor="middle" className="fill-muted-foreground" fontSize="10">
          users
        </text>
      </svg>

      <ul className="w-full space-y-2">
        {segs.map((s) => (
          <li key={s.name} className="flex items-center gap-2.5 text-sm">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="flex-1 truncate">{s.name}</span>
            <span className="font-mono text-xs text-muted-foreground">{s.count}</span>
            <span className="w-11 text-right font-semibold tabular-nums">
              {Math.round(s.frac * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
