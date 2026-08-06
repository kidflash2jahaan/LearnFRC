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

/** Legend rows shown before collapsing the tail into a "+N more" line. */
const MAX_ROWS = 10;

/** Locale-independent thousands separators (locale APIs can desync SSR/CSR). */
function fmt(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Keep the centre total inside the donut hole at every diameter. */
function totalFontSize(text: string) {
  if (text.length <= 3) return 30;
  if (text.length <= 5) return 26;
  if (text.length <= 7) return 21;
  return 17;
}

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

  const visible = segs.slice(0, MAX_ROWS);
  const hidden = segs.slice(MAX_ROWS);
  const hiddenCount = hidden.reduce((s, d) => s + d.count, 0);

  const totalText = fmt(total);

  return (
    <div className="flex min-w-0 flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <svg
        viewBox="0 0 160 160"
        role="img"
        aria-label={`Donut chart: ${totalText} total across ${data.length} ${
          data.length === 1 ? "source" : "sources"
        }`}
        className="h-32 w-32 shrink-0 sm:h-40 sm:w-40"
      >
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
        <text
          x="80"
          y="80"
          textAnchor="middle"
          className="fill-foreground font-display"
          fontSize={totalFontSize(totalText)}
          fontWeight="700"
        >
          {totalText}
        </text>
        <text
          x="80"
          y="99"
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="11"
          letterSpacing="0.06em"
        >
          total
        </text>
      </svg>

      <div className="w-full min-w-0 flex-1">
        <ul className="min-w-0">
          {visible.map((s) => (
            <li
              key={s.name}
              className="flex min-h-8 min-w-0 items-center gap-2 rounded-md px-1.5 py-1 transition-colors duration-200 ease-out motion-reduce:transition-none hover:bg-primary/[0.05]"
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-[3px] ring-1 ring-black/5"
                style={{ background: s.color }}
              />
              <span
                title={s.name}
                className="min-w-0 flex-1 truncate text-[13px] text-foreground"
              >
                {s.name}
              </span>
              <span className="shrink-0 text-right text-[12px] tabular-nums text-muted-foreground">
                {fmt(s.count)}
              </span>
              <span className="w-11 shrink-0 text-right font-mono text-[12px] font-semibold tabular-nums text-primary">
                {Math.round(s.frac * 100)}%
              </span>
            </li>
          ))}
        </ul>
        {hidden.length > 0 && (
          <p className="px-1.5 pt-1.5 text-[12px] tabular-nums text-muted-foreground">
            +{hidden.length} more · {fmt(hiddenCount)}
          </p>
        )}
      </div>
    </div>
  );
}
