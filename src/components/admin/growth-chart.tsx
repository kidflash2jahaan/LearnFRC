"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { Reveal } from "@/components/motion/primitives";
import { AnimatedCounter } from "@/components/animated-counter";
import { cn } from "@/lib/utils";

type DailyPoint = { day: string; signups: number; completions: number; views: number; visitors: number };
type Metric = "all" | "visitors" | "signups" | "completions";
type SeriesKey = "visitors" | "signups" | "completions";

const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: "visitors", label: "Visitors", color: "#2560e6" },
  { key: "signups", label: "Signups", color: "#7c5cff" },
  { key: "completions", label: "Completions", color: "#12a150" },
];

const TOGGLES: { value: Metric; label: string }[] = [
  { value: "all", label: "All" },
  { value: "visitors", label: "Visitors" },
  { value: "signups", label: "Signups" },
  { value: "completions", label: "Completions" },
];

// The viewBox width is set to the MEASURED container width (see `w` below) so the
// SVG never letterboxes — screen-x then maps 1:1 to viewBox-x and the hover
// indicator stays exactly under the cursor at every position, not just center.
// The default is sized for the half-width admin column so the pre-measure frame
// is already close to the real width (the ResizeObserver corrects it either way).
const VB_W_DEFAULT = 720; // used before the container is measured (SSR/first paint)
const VB_H = 200; // compact: rendered px height == viewBox height (no letterbox)
const PAD_T = 10;
const PAD_B = 18;
const PAD_L = 6;
const PAD_R = 6;
const PLOT_H = VB_H - PAD_T - PAD_B;
const REVEAL_W = 4000; // draw-in clip sweep, wider than any real container

function formatDay(raw: string): string {
  // Accepts ISO-ish "YYYY-MM-DD" (or anything Date can parse); falls back to raw.
  const d = new Date(raw.length <= 10 ? `${raw}T00:00:00` : raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * True 30-day-window totals for the summary chips. These are computed
 * server-side as count(distinct visitor) / count(*) OVER the window — NOT by
 * summing the per-day series. Summing per-day distinct-visitor counts
 * double-counts anyone who returns on multiple days (it yields "visitor-days",
 * which can exceed the all-time unique total), so the headline "Visitors" chip
 * must never be a sum of the daily line. The daily line itself still plots
 * per-day distinct visitors — that's a legitimate daily series.
 */
type WindowTotals = { visitors: number; signups: number; completions: number };

export function GrowthChart({
  daily,
  totals,
}: {
  daily: DailyPoint[];
  totals?: WindowTotals;
}) {
  const [metric, setMetric] = useState<Metric>("all");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Measure the container so the viewBox width == rendered width (no letterbox).
  const [w, setW] = useState(VB_W_DEFAULT);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const cw = el.clientWidth;
      if (cw > 0) setW(Math.round(cw));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const PLOT_W = w - PAD_L - PAD_R;

  const points = daily ?? [];
  const n = points.length;

  const maxVal = useMemo(() => {
    let m = 0;
    for (const p of points) {
      m = Math.max(m, p.visitors || 0, p.signups || 0, p.completions || 0);
    }
    return m;
  }, [points]);

  // Fallback only: a naive sum of the per-day series. Used just for the signups
  // and completions chips (both additive, so a sum IS the window total) and as a
  // safety net when no server-computed `totals` prop is supplied. The Visitors
  // chip must NOT use this sum (per-day distinct counts double-count returning
  // visitors) — it always prefers the true distinct-over-window value.
  const summed = useMemo(() => {
    return points.reduce(
      (acc, p) => {
        acc.visitors += p.visitors || 0;
        acc.signups += p.signups || 0;
        acc.completions += p.completions || 0;
        return acc;
      },
      { visitors: 0, signups: 0, completions: 0 },
    );
  }, [points]);

  // Chip values: true 30-day-window totals when provided (visitors =
  // count(distinct) over the window, reconciling with the Traffic panel &
  // KPI hero), else the additive fallback.
  const chipTotals: WindowTotals = totals ?? summed;

  const isEmpty = n === 0 || maxVal === 0;

  // X position for a given index. Single point sits at the left edge.
  const xAt = (i: number) => (n <= 1 ? PAD_L : PAD_L + (PLOT_W * i) / (n - 1));
  // Y position for a value, scaled to a padded max so the top line isn't clipped.
  const yMax = maxVal === 0 ? 1 : maxVal;
  const yAt = (v: number) => PAD_T + PLOT_H - (PLOT_H * (v || 0)) / yMax;

  const linePath = (key: SeriesKey) => {
    if (n === 0) return "";
    if (n === 1) {
      const x = xAt(0);
      const y = yAt(points[0][key]);
      return `M ${x} ${y} L ${PAD_L + PLOT_W} ${y}`;
    }
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(2)} ${yAt(p[key]).toFixed(2)}`)
      .join(" ");
  };

  const areaPath = useMemo(() => {
    if (n === 0) return "";
    const top =
      n === 1
        ? `M ${PAD_L} ${yAt(points[0].visitors)} L ${PAD_L + PLOT_W} ${yAt(points[0].visitors)}`
        : points
            .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(2)} ${yAt(p.visitors).toFixed(2)}`)
            .join(" ");
    const baseY = PAD_T + PLOT_H;
    const rightX = n === 1 ? PAD_L + PLOT_W : xAt(n - 1);
    return `${top} L ${rightX.toFixed(2)} ${baseY} L ${PAD_L} ${baseY} Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, n, yMax, w]);

  // Gridlines: 3 horizontal bands with value labels (compact height).
  const gridLines = useMemo(() => {
    const rows = 3;
    return Array.from({ length: rows + 1 }, (_, i) => {
      const frac = i / rows;
      const y = PAD_T + PLOT_H * frac;
      const value = Math.round(yMax * (1 - frac));
      return { y, value };
    });
  }, [yMax]);

  // X-axis labels: sparse (the panel is a narrow column), always including the last.
  const xLabels = useMemo(() => {
    if (n === 0) return [] as { x: number; text: string }[];
    const step = Math.max(1, Math.round(n / 4));
    const out: { x: number; text: string }[] = [];
    for (let i = 0; i < n; i += step) out.push({ x: xAt(i), text: formatDay(points[i].day) });
    const lastX = xAt(n - 1);
    if (!out.length || out[out.length - 1].x !== lastX) {
      out.push({ x: lastX, text: formatDay(points[n - 1].day) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, n, w]);

  const seriesShown = (key: SeriesKey) =>
    metric === "all" || metric === key;
  const seriesDim = (key: SeriesKey) =>
    metric !== "all" && metric !== key;

  const handleMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (isEmpty || n === 0) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * w;
    // Map pixel-x back to nearest index.
    const raw = n <= 1 ? 0 : ((relX - PAD_L) / PLOT_W) * (n - 1);
    const idx = Math.max(0, Math.min(n - 1, Math.round(raw)));
    setHoverIdx(idx);
  };

  const clearHover = () => setHoverIdx(null);

  const active = hoverIdx != null ? points[hoverIdx] : null;
  const activeX = hoverIdx != null ? xAt(hoverIdx) : 0;
  // Tooltip horizontal placement (percentage of width), clamped away from edges
  // (tighter than before: the panel now sits in a ~550px half-width column).
  const tipLeftPct = hoverIdx != null ? Math.min(88, Math.max(12, (activeX / w) * 100)) : 50;

  return (
    <Reveal>
      <div className="ac-card p-5">
        {/* Heading row + segmented toggle */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
            <TrendingUp className="h-4 w-4 shrink-0 text-primary" />
            Growth
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Last 30d
            </span>
          </h3>

          <div className="ac-chip flex flex-wrap gap-0.5 p-0.5" role="group" aria-label="Emphasize metric">
            {TOGGLES.map((t) => {
              const activeToggle = metric === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={activeToggle}
                  onClick={() => setMetric(t.value)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    activeToggle
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Metric summary pills (double as the series legend) */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {SERIES.map((s) => (
            <div
              key={s.key}
              className={cn(
                "flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 transition-opacity",
                seriesDim(s.key) && "opacity-45",
              )}
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: s.color }}
                aria-hidden
              />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {s.label}
              </span>
              <AnimatedCounter
                value={chipTotals[s.key]}
                className="font-display text-sm font-semibold tabular-nums text-foreground"
              />
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="relative w-full overflow-x-auto">
          <div ref={wrapRef} className="relative min-w-[320px]">
            {isEmpty ? (
              <div className="flex h-[200px] items-center justify-center px-4 text-center text-[11px] text-muted-foreground">
                No activity yet — data will appear as people visit.
              </div>
            ) : (
              <svg
                ref={svgRef}
                viewBox={`0 0 ${w} ${VB_H}`}
                width="100%"
                height={VB_H}
                role="img"
                aria-label="Growth over the last 30 days"
                className="block touch-none select-none"
                onPointerMove={handleMove}
                onPointerDown={handleMove}
                onPointerLeave={clearHover}
                onPointerCancel={clearHover}
              >
                <defs>
                  <linearGradient id="gc-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2560e6" stopOpacity="0.28" />
                    <stop offset="60%" stopColor="#1aa9d6" stopOpacity="0.14" />
                    <stop offset="100%" stopColor="#1aa9d6" stopOpacity="0" />
                  </linearGradient>
                  <clipPath id="gc-reveal">
                    <motion.rect
                      x={0}
                      y={0}
                      height={VB_H}
                      initial={{ width: 0 }}
                      animate={{ width: REVEAL_W }}
                      transition={{ duration: 1, ease: "easeInOut" }}
                    />
                  </clipPath>
                </defs>

                {/* Gridlines + value labels */}
                {gridLines.map((g, i) => (
                  <g key={i}>
                    <line
                      x1={PAD_L}
                      x2={PAD_L + PLOT_W}
                      y1={g.y}
                      y2={g.y}
                      stroke="#182338"
                      strokeOpacity={i === 0 ? 0.14 : 0.07}
                      strokeWidth={1}
                    />
                    <text
                      x={PAD_L + PLOT_W}
                      y={g.y - 2.5}
                      textAnchor="end"
                      className="tabular-nums"
                      fontSize={9}
                      fill="#4d5b78"
                    >
                      {g.value}
                    </text>
                  </g>
                ))}

                {/* Everything that draws in, under the reveal clip */}
                <g clipPath="url(#gc-reveal)">
                  {/* Views area */}
                  {seriesShown("visitors") && (
                    <motion.path
                      d={areaPath}
                      fill="url(#gc-area)"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: metric === "all" || metric === "visitors" ? 1 : 0.25 }}
                      transition={{ duration: 0.4 }}
                    />
                  )}

                  {/* Series lines */}
                  {SERIES.map((s) => (
                    <motion.path
                      key={s.key}
                      d={linePath(s.key)}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={s.key === "visitors" ? 2 : 1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ opacity: 0 }}
                      animate={{
                        opacity: seriesShown(s.key) ? (seriesDim(s.key) ? 0.18 : 1) : 0.12,
                      }}
                      transition={{ duration: 0.4 }}
                      style={{ display: seriesShown(s.key) ? "block" : "none" }}
                    />
                  ))}
                </g>

                {/* X-axis labels */}
                {xLabels.map((l, i) => (
                  <text
                    key={i}
                    x={Math.max(PAD_L + 16, Math.min(PAD_L + PLOT_W - 16, l.x))}
                    y={VB_H - 5}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#4d5b78"
                  >
                    {l.text}
                  </text>
                ))}

                {/* Hover indicator */}
                {active && hoverIdx != null && (
                  <g>
                    <line
                      x1={activeX}
                      x2={activeX}
                      y1={PAD_T}
                      y2={PAD_T + PLOT_H}
                      stroke="#2560e6"
                      strokeOpacity={0.35}
                      strokeWidth={1}
                      strokeDasharray="3 3"
                    />
                    {SERIES.filter((s) => seriesShown(s.key)).map((s) => (
                      <circle
                        key={s.key}
                        cx={activeX}
                        cy={yAt(active[s.key])}
                        r={3}
                        fill="#ffffff"
                        stroke={s.color}
                        strokeWidth={2}
                      />
                    ))}
                  </g>
                )}
              </svg>
            )}

            {/* Tooltip */}
            {active && hoverIdx != null && (
              <div
                className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg border border-border bg-white/95 px-2 py-1 shadow-lg backdrop-blur"
                style={{ left: `${tipLeftPct}%` }}
              >
                <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {formatDay(active.day)}
                </div>
                <div className="space-y-0.5">
                  {SERIES.map((s) => (
                    <div key={s.key} className="flex items-center justify-between gap-3 text-[11px]">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ background: s.color }}
                          aria-hidden
                        />
                        {s.label}
                      </span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {active[s.key]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Reveal>
  );
}
