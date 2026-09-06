"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

type DailyPoint = { day: string; signups: number; completions: number; views: number; visitors: number };
type Metric = "all" | "visitors" | "signups" | "completions";
type SeriesKey = "visitors" | "signups" | "completions";

/**
 * THREE LINES, ONE ACCENT.
 *
 * The old chart gave each series its own hue (blue, violet, green). This system
 * has one accent and no second visual language, so the series are told apart by
 * PEN, the way you would draw them on graph paper: visitors in solid ballpoint,
 * signups in a long ink dash, completions in an ink dot. The legend under the
 * toggles draws the same stroke beside the label, so the reader never has to
 * infer which line is which from a colour they cannot see.
 *
 * That is also why visitors is the blue one: it is the line the area sits under
 * and the one this panel exists to show. Rank has to be carried by something,
 * and here it is weight and ink, not a palette.
 */
const SERIES: {
  key: SeriesKey;
  label: string;
  stroke: string;
  width: number;
  dash?: string;
}[] = [
  { key: "visitors", label: "Visitors", stroke: "var(--blue)", width: 2.4 },
  { key: "signups", label: "Signups", stroke: "var(--ink)", width: 1.6, dash: "7 4" },
  { key: "completions", label: "Completions", stroke: "var(--ink)", width: 1.6, dash: "1.5 4" },
];

const TOGGLES: { value: Metric; label: string }[] = [
  { value: "all", label: "All three" },
  { value: "visitors", label: "Visitors" },
  { value: "signups", label: "Signups" },
  { value: "completions", label: "Completions" },
];

/* ------------------------------------------------------------------ */
/*  GEOMETRY, read this before touching any number below.              */
/*                                                                    */
/*  The viewBox width is set to the MEASURED container width (`w`) so  */
/*  the SVG never letterboxes: screen-x then maps 1:1 to viewBox-x and */
/*  the hover indicator stays exactly under the cursor or finger at    */
/*  every position, not just at the centre.                            */
/*                                                                    */
/*  That invariant only holds while the RENDERED pixel height equals   */
/*  the viewBox height. So VB_H, the <svg height> attribute and the    */
/*  empty-state box height must ALWAYS move together: they all read    */
/*  from VB_H, do not hard-code any of them.                           */
/* ------------------------------------------------------------------ */

// Used before the container is measured (SSR, and the very first paint). The
// drawer is full page width, so a wide default keeps the pre-measure frame
// close to the truth. The layout effect corrects it before paint anyway.
const VB_W_DEFAULT = 960;
// Comfortable full-width drawing height. Rendered px height == viewBox height.
const VB_H = 220;
// PAD_T must clear the top gridline's value label, which is drawn ABOVE its
// line: at 10px type the glyph box rises about 10px over the baseline, so
// PAD_T - GRID_LABEL_DY must stay >= 10 or the top number clips out of the box.
const PAD_T = 16;
const GRID_LABEL_DY = 4; // value label sits this far above its gridline
const PAD_B = 24; // room for the x-axis label row
const PAD_L = 6;
const PAD_R = 6;
const PLOT_H = VB_H - PAD_T - PAD_B;

// X-axis label density. `MIN_LABEL_PX` is the smallest centre-to-centre gap
// that keeps two "Sep 12"-sized labels (about 40px in Space Mono at 10px) from
// touching; `MAX_LABELS` stops a very wide chart turning into a wall of dates.
const MIN_LABEL_PX = 68;
const MAX_LABELS = 10;
const LABEL_EDGE_PAD = 22; // keeps the first and last label inside the box

// Fixed tooltip width so it can be clamped in PIXELS (a percentage clamp lets
// it hang off the edge on a phone, where 12% of 270px is only 32px).
// KEEP IN SYNC with the tooltip's `w-[164px]` class: Tailwind cannot read this
// constant, and if the two drift the edge clamp stops being exact.
const TIP_W = 164;

// useLayoutEffect on the client, useEffect on the server (avoids the SSR warn).
// Measuring in a layout effect means the first painted frame already uses the
// real width, so there is no squashed-then-snap flash when the drawer opens.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Locale-independent thousands separators: this is a client tree, and a
    disagreement between the Node ICU build and the browser's would be a
    hydration mismatch on a figure. */
function fmt(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-07-22` to `Jul 22`. Table-driven for the same reason as the formatter
    above: `toLocaleDateString` returns different strings on different ICU
    builds, and this string is rendered on both sides of hydration. */
function formatDay(raw: string): string {
  const d = new Date(raw.length <= 10 ? `${raw}T00:00:00` : raw);
  if (Number.isNaN(d.getTime())) return raw;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/**
 * True 30-day-window totals for the legend figures. These are computed
 * server-side as count(distinct visitor) or count(*) OVER the window, NOT by
 * summing the per-day series. Summing per-day distinct-visitor counts
 * double-counts anyone who returns on multiple days (it yields "visitor-days",
 * which can exceed the all-time unique total), so the Visitors figure must
 * never be a sum of the daily line. The daily line itself still plots per-day
 * distinct visitors, which is a legitimate daily series.
 */
type WindowTotals = { visitors: number; signups: number; completions: number };

/** The stroke sample drawn beside a legend label, and inside the tooltip. */
function StrokeSwatch({ series }: { series: (typeof SERIES)[number] }) {
  return (
    <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden="true" focusable="false" className="shrink-0">
      <path
        d="M0 4 H22"
        stroke={series.stroke}
        strokeWidth={series.width}
        strokeDasharray={series.dash}
        strokeLinecap={series.dash ? "round" : "butt"}
        fill="none"
      />
    </svg>
  );
}

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
  useIsoLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const cw = el.clientWidth;
      if (cw <= 0) return; // still collapsed; the ResizeObserver will fire later
      setW((prev) => (Math.abs(prev - cw) < 1 ? prev : Math.round(cw)));
    };
    // 1) synchronous measure, correct on a lazy mount inside an open drawer.
    measure();
    // 2) one rAF later, catches a parent that is mid open-animation on mount.
    const raf = requestAnimationFrame(measure);
    // 3) ResizeObserver, catches display:none to visible and every resize.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);
  const PLOT_W = w - PAD_L - PAD_R;

  // Memoised so the `daily ?? []` fallback does not hand every downstream
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

  // Fallback only: a naive sum of the per-day series. Used for the signups and
  // completions figures (both additive, so a sum IS the window total) and as a
  // safety net when no server-computed `totals` prop is supplied. The Visitors
  // figure must NOT use this sum, per the note on WindowTotals above.
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

  const chipTotals: WindowTotals = totals ?? summed;

  const isEmpty = n === 0 || maxVal === 0;

  // Tap outside dismisses the touch tooltip (a finger has no "leave").
  // Registered once for the component's lifetime. Mouse is left alone because
  // pointerleave already handles it.
  useEffect(() => {
    const onDocDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      if (!wrapRef.current?.contains(e.target as Node)) setHoverIdx(null);
    };
    document.addEventListener("pointerdown", onDocDown);
    return () => document.removeEventListener("pointerdown", onDocDown);
  }, []);

  // X position for a given index. A single point sits at the left edge.
  const xAt = (i: number) => (n <= 1 ? PAD_L : PAD_L + (PLOT_W * i) / (n - 1));
  // Y position for a value, scaled so the top line is not clipped.
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

  // Four bands with value labels. The bottom one is the baseline and is drawn
  // solid; the rest are the faint ruling of the paper the chart sits on.
  const gridLines = useMemo(() => {
    const rows = 4;
    return Array.from({ length: rows + 1 }, (_, i) => {
      const frac = i / rows;
      const y = PAD_T + PLOT_H * frac;
      const value = Math.round(yMax * (1 - frac));
      return { y, value, baseline: i === rows };
    });
  }, [yMax]);

  // X-axis labels: density derived from the MEASURED width, never a fixed
  // count. Walking backwards from the last index guarantees (a) the most recent
  // day is always labelled and (b) a perfectly even step, so nothing ever
  // collides: on a 375px phone this settles to 2 or 3 labels, on desktop up to
  // MAX_LABELS.
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

  const seriesShown = (key: SeriesKey) => metric === "all" || metric === key;

  // Works for mouse, pen AND touch: pointerdown plus pointermove cover a tap, a
  // scrub and a hover with one code path. `touch-action: pan-y` on the <svg>
  // lets a vertical swipe scroll the page while a horizontal scrub reaches us.
  const handleMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (isEmpty || n === 0) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return;
    const relX = ((e.clientX - rect.left) / rect.width) * w;
    const raw = n <= 1 ? 0 : ((relX - PAD_L) / PLOT_W) * (n - 1);
    const idx = Math.max(0, Math.min(n - 1, Math.round(raw)));
    setHoverIdx(idx);
  };

  // A finger generates pointerleave the instant it lifts, which would wipe the
  // tooltip before it could be read. Only mouse and pen clear on leave; touch
  // keeps the reading until the next tap (see the document listener above).
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

  return (
    <div className="min-w-0">
      {/* Which lines to draw. A dashed hairline under the strip, solid blue
          under the selected one. */}
      <div
        className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-dashed border-rule"
        role="group"
        aria-label="Lines to draw"
      >
        {TOGGLES.map((t) => (
          <button
            key={t.value}
            type="button"
            aria-pressed={metric === t.value}
            data-active={metric === t.value || undefined}
            onClick={() => setMetric(t.value)}
            className="nb-tab"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Legend and the window totals in one row: the stroke sample is the key,
          the figure is the reading. A line that is currently switched off says
          so in words rather than by fading out. */}
      <ul className="mt-4 flex flex-wrap gap-2.5">
        {SERIES.map((s) => {
          const off = !seriesShown(s.key);
          return (
            <li
              key={s.key}
              className="nb-box-sm flex items-center gap-2 px-3 py-1.5"
            >
              <StrokeSwatch series={s} />
              <span className="nb-slug">{s.label}</span>
              <span className="font-mono text-[0.95rem] font-bold tabular-nums text-blue">
                {fmt(chipTotals[s.key])}
              </span>
              {off ? <span className="nb-slug">not drawn</span> : null}
            </li>
          );
        })}
      </ul>

      {/* `min-w` is the last-resort floor before the scroll valve opens. The
          narrowest container this can land in is about 275px at a 375px
          viewport, so the floor has to sit under that or a phone gets a
          horizontal scrollbar. It also has to stay above roughly 160px so the
          fixed-width tooltip can still be clamped inside. */}
      <div className="nb-scroll relative mt-4 w-full">
        <div ref={wrapRef} className="relative min-w-[200px]">
          {isEmpty ? (
            <div
              className="nb-slug flex items-center justify-center px-4 text-center"
              style={{ height: VB_H }}
            >
              Nothing plotted yet. The lines start the first day the beacon records anything.
            </div>
          ) : (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${w} ${VB_H}`}
              width="100%"
              height={VB_H}
              role="img"
              aria-label="Visitors, signups and completions per day over the last 30 days"
              className="block touch-pan-y select-none"
              onPointerMove={handleMove}
              onPointerDown={handleMove}
              onPointerLeave={handleLeave}
              onPointerCancel={clearHover}
            >
              {/* Ruling and value labels */}
              {gridLines.map((g, i) => (
                <g key={i}>
                  <line
                    x1={PAD_L}
                    x2={PAD_L + PLOT_W}
                    y1={g.y}
                    y2={g.y}
                    stroke="var(--ink)"
                    strokeOpacity={g.baseline ? 0.55 : 0.18}
                    strokeWidth={g.baseline ? 1.5 : 1}
                    strokeDasharray={g.baseline ? undefined : "2 4"}
                  />
                  <text
                    x={PAD_L + PLOT_W}
                    y={g.y - GRID_LABEL_DY}
                    textAnchor="end"
                    className="font-mono tabular-nums"
                    fontSize={10}
                    fill="var(--graphite)"
                  >
                    {g.value}
                  </text>
                </g>
              ))}

              {/* The visitors area: a flat wash of the one accent, no gradient. */}
              {seriesShown("visitors") && (
                <path d={areaPath} fill="rgba(27,54,200,0.10)" />
              )}

              {SERIES.filter((s) => seriesShown(s.key)).map((s) => (
                <path
                  key={s.key}
                  d={linePath(s.key)}
                  fill="none"
                  stroke={s.stroke}
                  strokeWidth={s.width}
                  strokeDasharray={s.dash}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

              {xLabels.map((l, i) => (
                <text
                  key={i}
                  x={Math.max(
                    PAD_L + LABEL_EDGE_PAD,
                    Math.min(PAD_L + PLOT_W - LABEL_EDGE_PAD, l.x),
                  )}
                  y={VB_H - 7}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={10}
                  fill="var(--graphite)"
                >
                  {l.text}
                </text>
              ))}

              {/* The reading you are taking */}
              {active && hoverIdx != null && (
                <g>
                  <line
                    x1={activeX}
                    x2={activeX}
                    y1={PAD_T}
                    y2={PAD_T + PLOT_H}
                    stroke="var(--blue)"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                  />
                  {SERIES.filter((s) => seriesShown(s.key)).map((s) => (
                    <circle
                      key={s.key}
                      cx={activeX}
                      cy={yAt(active[s.key])}
                      r={3.5}
                      fill="var(--card)"
                      stroke={s.stroke}
                      strokeWidth={2}
                    />
                  ))}
                </g>
              )}
            </svg>
          )}

          {/* The w-[164px] below MUST equal TIP_W, which is what the pixel edge
              clamp above is computed from. */}
          {active && hoverIdx != null && (
            <div
              className="nb-surface pointer-events-none absolute top-1 z-10 w-[164px] -translate-x-1/2 px-2.5 py-2"
              style={{ left: `${tipLeftPx}px` }}
            >
              <p className="nb-slug border-b border-dashed border-rule pb-1.5">
                {formatDay(active.day)}
              </p>
              <dl className="mt-1.5">
                {SERIES.map((s) => (
                  <div key={s.key} className="flex items-center justify-between gap-2 py-[1px]">
                    <dt className="flex items-center gap-1.5">
                      <StrokeSwatch series={s} />
                      <span className="nb-slug">{s.label}</span>
                    </dt>
                    <dd className="font-mono text-[0.8rem] font-bold tabular-nums">
                      {fmt(active[s.key])}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
