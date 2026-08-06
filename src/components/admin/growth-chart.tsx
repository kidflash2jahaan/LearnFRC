"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

/* ------------------------------------------------------------------ */
/*  GEOMETRY — read this before touching any number below.             */
/*                                                                    */
/*  The viewBox width is set to the MEASURED container width (`w`) so  */
/*  the SVG never letterboxes: screen-x then maps 1:1 to viewBox-x and */
/*  the hover indicator stays exactly under the cursor/finger at every */
/*  position, not just at the centre.                                  */
/*                                                                    */
/*  That invariant only holds while the RENDERED pixel height equals   */
/*  the viewBox height. So VB_H, the <svg height> attribute and the    */
/*  empty-state box height must ALWAYS move together — they all read   */
/*  from VB_H, do not hard-code any of them.                           */
/* ------------------------------------------------------------------ */

// Used before the container is measured (SSR / very first paint). The panel is
// now full page width (max-w-6xl minus page + card padding ≈ 950–1010px on a
// desktop), so a wide default keeps the pre-measure frame close to the truth.
// The layout-effect measure below corrects it before paint anyway.
const VB_W_DEFAULT = 960;
// Comfortable full-width drawing height. Rendered px height == viewBox height.
const VB_H = 220;
// PAD_T must clear the top gridline's value label, which is drawn ABOVE its
// line: at 10px type the glyph box rises ~10px over the baseline, so
// PAD_T - GRID_LABEL_DY must stay >= 10 or the top number clips out of the box.
const PAD_T = 16;
const GRID_LABEL_DY = 4; // value label sits this far above its gridline
const PAD_B = 24; // room for the x-axis label row
const PAD_L = 6;
const PAD_R = 6;
const PLOT_H = VB_H - PAD_T - PAD_B;
const REVEAL_W = 4000; // draw-in clip sweep, wider than any real container

// X-axis label density. `MIN_LABEL_PX` is the smallest centre-to-centre gap
// that keeps two "Sep 12"-sized labels (≈34px at 10px type) from touching;
// `MAX_LABELS` stops a very wide chart turning into a wall of dates.
const MIN_LABEL_PX = 62;
const MAX_LABELS = 10;
const LABEL_EDGE_PAD = 20; // keeps the first/last label inside the box

// Fixed tooltip width so it can be clamped in PIXELS (a % clamp lets it hang
// off the edge on a phone, where 12% of 270px is only 32px).
// KEEP IN SYNC with the tooltip's `w-[152px]` class — Tailwind can't read this
// constant, and if the two drift the edge clamp stops being exact.
const TIP_W = 152;

// useLayoutEffect on the client, useEffect on the server (avoids the SSR warn).
// Measuring in a layout effect means the first painted frame already uses the
// real width — no squashed-then-snap flash when the collapsed panel opens.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

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
  bare = false,
}: {
  daily: DailyPoint[];
  totals?: WindowTotals;
  /**
   * Presentation only — the data contract is unchanged.
   * `false` (default): renders its own Reveal + ac-card + "Growth" heading,
   *   i.e. exactly the standalone panel it has always been.
   * `true`: renders content only (no card, no padding, no Reveal, no heading)
   *   for when it is dropped inside a collapsible panel that already supplies
   *   card chrome and a title — avoids a card-inside-a-card double border.
   */
  bare?: boolean;
}) {
  const [metric, setMetric] = useState<Metric>("all");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Measure the container so the viewBox width == rendered width (no letterbox).
  const [w, setW] = useState(VB_W_DEFAULT);
  useIsoLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const cw = el.clientWidth;
      if (cw <= 0) return; // still display:none / collapsed — RO will fire later
      setW((prev) => (Math.abs(prev - cw) < 1 ? prev : Math.round(cw)));
    };
    // 1) synchronous measure — correct on a lazy mount inside an open panel.
    measure();
    // 2) one rAF later — catches a parent that is mid open-animation on mount.
    const raf = requestAnimationFrame(measure);
    // 3) ResizeObserver — catches display:none -> visible, and every resize.
    //    (RO fires on the transition out of display:none, so a panel that keeps
    //    its children mounted while closed still measures correctly on open.)
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);
  const PLOT_W = w - PAD_L - PAD_R;

  // Memoised so the `daily ?? []` fallback doesn't hand every downstream
  // useMemo a fresh array identity on each render.
  const points = useMemo(() => daily ?? [], [daily]);
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

  // Tap outside dismisses the touch tooltip (a finger has no "leave").
  // Registered once for the component's lifetime — mouse is left alone because
  // pointerleave already handles it.
  useEffect(() => {
    const onDocDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      if (!wrapRef.current?.contains(e.target as Node)) setHoverIdx(null);
    };
    document.addEventListener("pointerdown", onDocDown);
    return () => document.removeEventListener("pointerdown", onDocDown);
  }, []);

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

  // Gridlines: 4 horizontal bands with value labels (the taller full-width box
  // has room for one more band than the old compact version).
  const gridLines = useMemo(() => {
    const rows = 4;
    return Array.from({ length: rows + 1 }, (_, i) => {
      const frac = i / rows;
      const y = PAD_T + PLOT_H * frac;
      const value = Math.round(yMax * (1 - frac));
      return { y, value };
    });
  }, [yMax]);

  // X-axis labels: density derived from the MEASURED width, never a fixed count.
  // Walking backwards from the last index guarantees (a) the most recent day is
  // always labelled and (b) a perfectly even step, so nothing ever collides —
  // on a 375px phone this settles to 2–3 labels, on desktop up to MAX_LABELS.
  const xLabels = useMemo(() => {
    if (n === 0) return [] as { x: number; text: string }[];
    const fit = Math.max(2, Math.min(MAX_LABELS, Math.floor(PLOT_W / MIN_LABEL_PX)));
    const step = Math.max(1, Math.ceil((n - 1) / (fit - 1)));
    const out: { x: number; text: string }[] = [];
    for (let i = n - 1; i >= 0; i -= step) {
      out.unshift({ x: xAt(i), text: formatDay(points[i].day) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, n, w]);

  const seriesShown = (key: SeriesKey) =>
    metric === "all" || metric === key;
  const seriesDim = (key: SeriesKey) =>
    metric !== "all" && metric !== key;

  // Works for mouse, pen AND touch: pointerdown + pointermove cover a tap, a
  // scrub, and a hover with one code path. `touch-action: pan-y` on the <svg>
  // lets a vertical swipe scroll the page while a horizontal scrub reaches us.
  const handleMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (isEmpty || n === 0) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return;
    const relX = ((e.clientX - rect.left) / rect.width) * w;
    // Map pixel-x back to nearest index.
    const raw = n <= 1 ? 0 : ((relX - PAD_L) / PLOT_W) * (n - 1);
    const idx = Math.max(0, Math.min(n - 1, Math.round(raw)));
    setHoverIdx(idx);
  };

  // A finger generates pointerleave the instant it lifts, which would wipe the
  // tooltip before it could be read. Only mouse/pen clear on leave; touch keeps
  // the reading until the next tap (see the document listener above).
  const handleLeave = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "touch") return;
    setHoverIdx(null);
  };
  const clearHover = () => setHoverIdx(null);

  const active = hoverIdx != null ? points[hoverIdx] : null;
  const activeX = hoverIdx != null ? xAt(hoverIdx) : 0;
  // Tooltip placement, clamped in PIXELS against the measured width so it can
  // never be clipped at either edge on a narrow screen. If the container is
  // narrower than the tooltip itself, just centre it.
  const tipHalf = TIP_W / 2;
  const tipLeftPx =
    hoverIdx == null || w <= TIP_W + 8
      ? w / 2
      : Math.min(w - tipHalf - 4, Math.max(tipHalf + 4, activeX));

  const body = (
    <div className={cn(!bare && "ac-card p-4 sm:p-5")}>
      {/* Heading row + segmented toggle */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {!bare && (
          <h3 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
            <TrendingUp className="h-4 w-4 shrink-0 text-primary" />
            Growth
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Last 30d
            </span>
          </h3>
        )}

        <div
          className="ac-chip flex flex-wrap items-center gap-1 p-1"
          role="group"
          aria-label="Emphasize metric"
        >
          {TOGGLES.map((t) => {
            const activeToggle = metric === t.value;
            return (
              <button
                key={t.value}
                type="button"
                aria-pressed={activeToggle}
                onClick={() => setMetric(t.value)}
                className={cn(
                  // Slightly tighter type/padding on a phone so all four pills
                  // sit on ONE row inside a 275px container (measured: 269px)
                  // instead of wrapping to two. Height stays pinned at 36px.
                  "inline-flex min-h-9 items-center justify-center rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-3 sm:text-xs",
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

      {/* Metric summary chips (double as the series legend). Same trick as the
          pills: tighter type on a phone drops this row from three stacked chips
          to two (measured 124px -> 78px at a 375px viewport) without shrinking
          the 36px touch height. */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
        {SERIES.map((s) => (
          <div
            key={s.key}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1.5 transition-opacity motion-reduce:transition-none sm:px-3",
              seriesDim(s.key) && "opacity-45",
            )}
          >
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ background: s.color }}
              aria-hidden
            />
            <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs sm:tracking-wider">
              {s.label}
            </span>
            <AnimatedCounter
              value={chipTotals[s.key]}
              className="font-display text-[13px] font-semibold tabular-nums text-foreground sm:text-sm"
            />
          </div>
        ))}
      </div>

      {/* Chart. `min-w` is the last-resort floor before the scroll valve opens.
          Measured in Chromium with the app's real CSS, the narrowest container
          this can land in is 275px (375px viewport, chart card nested inside a
          panel card) and 220px at a 320px viewport — so the floor has to sit
          under 220 or a phone gets a horizontal scrollbar. It also must stay
          above ~160px so the fixed-width tooltip can still be clamped inside. */}
      <div className="relative w-full overflow-x-auto">
        <div ref={wrapRef} className="relative min-w-[200px]">
          {isEmpty ? (
            <div
              className="flex items-center justify-center px-4 text-center text-[11px] text-muted-foreground"
              style={{ height: VB_H }}
            >
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
              className="block touch-pan-y select-none"
              onPointerMove={handleMove}
              onPointerDown={handleMove}
              onPointerLeave={handleLeave}
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
                    y={g.y - GRID_LABEL_DY}
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
                {/* Visitors area */}
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
                  x={Math.max(
                    PAD_L + LABEL_EDGE_PAD,
                    Math.min(PAD_L + PLOT_W - LABEL_EDGE_PAD, l.x),
                  )}
                  y={VB_H - 7}
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

          {/* Tooltip — the w-[152px] below MUST equal TIP_W, which is what the
              px edge-clamp above is computed from. */}
          {active && hoverIdx != null && (
            <div
              className="pointer-events-none absolute top-1 z-10 w-[152px] -translate-x-1/2 rounded-lg border border-border bg-white/95 px-2 py-1 shadow-lg backdrop-blur"
              style={{ left: `${tipLeftPx}px` }}
            >
              <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {formatDay(active.day)}
              </div>
              <div className="space-y-0.5">
                {SERIES.map((s) => (
                  <div key={s.key} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex items-center gap-1 whitespace-nowrap text-muted-foreground">
                      <span
                        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
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
  );

  // In `bare` mode the surrounding panel owns the entrance animation.
  return bare ? body : <Reveal>{body}</Reveal>;
}
