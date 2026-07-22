"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { Reveal } from "@/components/motion/primitives";
import { AnimatedCounter } from "@/components/animated-counter";
import { cn } from "@/lib/utils";

type DailyPoint = { day: string; signups: number; completions: number; views: number };
type Metric = "all" | "views" | "signups" | "completions";

const SERIES: { key: "views" | "signups" | "completions"; label: string; color: string }[] = [
  { key: "views", label: "Views", color: "#2560e6" },
  { key: "signups", label: "Signups", color: "#1aa9d6" },
  { key: "completions", label: "Completions", color: "#7c5cff" },
];

const TOGGLES: { value: Metric; label: string }[] = [
  { value: "all", label: "All" },
  { value: "views", label: "Views" },
  { value: "signups", label: "Signups" },
  { value: "completions", label: "Completions" },
];

// The viewBox width is set to the MEASURED container width (see `w` below) so the
// SVG never letterboxes — screen-x then maps 1:1 to viewBox-x and the hover
// indicator stays exactly under the cursor at every position, not just center.
const VB_W_DEFAULT = 720; // used before the container is measured (SSR/first paint)
const VB_H = 220;
const PAD_T = 16;
const PAD_B = 28;
const PAD_L = 8;
const PAD_R = 8;
const PLOT_H = VB_H - PAD_T - PAD_B;
const REVEAL_W = 4000; // draw-in clip sweep, wider than any real container

function formatDay(raw: string): string {
  // Accepts ISO-ish "YYYY-MM-DD" (or anything Date can parse); falls back to raw.
  const d = new Date(raw.length <= 10 ? `${raw}T00:00:00` : raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function GrowthChart({ daily }: { daily: DailyPoint[] }) {
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
      m = Math.max(m, p.views || 0, p.signups || 0, p.completions || 0);
    }
    return m;
  }, [points]);

  const totals = useMemo(() => {
    return points.reduce(
      (acc, p) => {
        acc.views += p.views || 0;
        acc.signups += p.signups || 0;
        acc.completions += p.completions || 0;
        return acc;
      },
      { views: 0, signups: 0, completions: 0 },
    );
  }, [points]);

  const isEmpty = n === 0 || maxVal === 0;

  // X position for a given index. Single point sits at the left edge.
  const xAt = (i: number) => (n <= 1 ? PAD_L : PAD_L + (PLOT_W * i) / (n - 1));
  // Y position for a value, scaled to a padded max so the top line isn't clipped.
  const yMax = maxVal === 0 ? 1 : maxVal;
  const yAt = (v: number) => PAD_T + PLOT_H - (PLOT_H * (v || 0)) / yMax;

  const linePath = (key: "views" | "signups" | "completions") => {
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
        ? `M ${PAD_L} ${yAt(points[0].views)} L ${PAD_L + PLOT_W} ${yAt(points[0].views)}`
        : points
            .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(2)} ${yAt(p.views).toFixed(2)}`)
            .join(" ");
    const baseY = PAD_T + PLOT_H;
    const rightX = n === 1 ? PAD_L + PLOT_W : xAt(n - 1);
    return `${top} L ${rightX.toFixed(2)} ${baseY} L ${PAD_L} ${baseY} Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, n, yMax, w]);

  // Gridlines: 4 horizontal bands with value labels.
  const gridLines = useMemo(() => {
    const rows = 4;
    return Array.from({ length: rows + 1 }, (_, i) => {
      const frac = i / rows;
      const y = PAD_T + PLOT_H * frac;
      const value = Math.round(yMax * (1 - frac));
      return { y, value };
    });
  }, [yMax]);

  // X-axis labels: roughly every 6th day, always including the last.
  const xLabels = useMemo(() => {
    if (n === 0) return [] as { x: number; text: string }[];
    const step = Math.max(1, Math.round(n / 5));
    const out: { x: number; text: string }[] = [];
    for (let i = 0; i < n; i += step) out.push({ x: xAt(i), text: formatDay(points[i].day) });
    const lastX = xAt(n - 1);
    if (!out.length || out[out.length - 1].x !== lastX) {
      out.push({ x: lastX, text: formatDay(points[n - 1].day) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, n, w]);

  const seriesShown = (key: "views" | "signups" | "completions") =>
    metric === "all" || metric === key;
  const seriesDim = (key: "views" | "signups" | "completions") =>
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
  // Tooltip horizontal placement (percentage of width), clamped away from edges.
  const tipLeftPct = hoverIdx != null ? Math.min(88, Math.max(12, (activeX / w) * 100)) : 50;

  return (
    <Reveal>
      <div className="ac-card p-5 sm:p-6">
        {/* Heading row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="ac-badge flex h-10 w-10 items-center justify-center"
              style={{ "--a": "#2560e6" } as CSSProperties}
            >
              <TrendingUp className="h-5 w-5" />
            </span>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Last 30 days
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground">Growth</h3>
            </div>
          </div>

          {/* Segmented toggle */}
          <div className="ac-chip flex flex-wrap gap-1 p-1" role="group" aria-label="Emphasize metric">
            {TOGGLES.map((t) => {
              const activeToggle = metric === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={activeToggle}
                  onClick={() => setMetric(t.value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
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

        {/* Metric summary chips */}
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          {SERIES.map((s) => (
            <div
              key={s.key}
              className={cn(
                "rounded-xl border border-border bg-muted/40 px-3 py-2 transition-opacity",
                seriesDim(s.key) && "opacity-45",
              )}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: s.color }}
                  aria-hidden
                />
                <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </span>
              </div>
              <div className="mt-0.5 font-display text-xl font-semibold tabular-nums text-foreground">
                <AnimatedCounter value={totals[s.key]} />
              </div>
            </div>
          ))}
        </div>

        <div className="ac-divider my-4" />

        {/* Chart */}
        <div className="relative w-full overflow-x-auto">
          <div ref={wrapRef} className="relative min-w-[320px]">
            {isEmpty ? (
              <div className="flex h-[220px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
                No activity yet — data will appear as people visit.
              </div>
            ) : (
              <svg
                ref={svgRef}
                viewBox={`0 0 ${w} ${VB_H}`}
                width="100%"
                height={220}
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
                      y={g.y - 3}
                      textAnchor="end"
                      className="tabular-nums"
                      fontSize={10}
                      fill="#4d5b78"
                    >
                      {g.value}
                    </text>
                  </g>
                ))}

                {/* Everything that draws in, under the reveal clip */}
                <g clipPath="url(#gc-reveal)">
                  {/* Views area */}
                  {seriesShown("views") && (
                    <motion.path
                      d={areaPath}
                      fill="url(#gc-area)"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: metric === "all" || metric === "views" ? 1 : 0.25 }}
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
                      strokeWidth={s.key === "views" ? 2.5 : 2}
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
                    x={Math.max(PAD_L + 14, Math.min(PAD_L + PLOT_W - 14, l.x))}
                    y={VB_H - 8}
                    textAnchor="middle"
                    fontSize={10}
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
                        r={3.5}
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
                className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-xl border border-border bg-white/95 px-3 py-2 shadow-lg backdrop-blur"
                style={{ left: `${tipLeftPct}%` }}
              >
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {formatDay(active.day)}
                </div>
                <div className="space-y-0.5">
                  {SERIES.map((s) => (
                    <div key={s.key} className="flex items-center justify-between gap-4 text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
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
