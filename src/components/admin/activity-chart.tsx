"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useStaticMotion } from "@/components/perf-mode";

type DailyPoint = {
  day: string;
  signups: number;
  verified: number;
  completions: number;
};

const W = 720;
const H = 240;
const PAD = { t: 16, r: 16, b: 28, l: 28 };

function fmtDay(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ActivityChart({ data }: { data: DailyPoint[] }) {
  const reduce = useStaticMotion();
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [hover, setHover] = React.useState<number | null>(null);

  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const n = Math.max(data.length, 1);
  const max = Math.max(
    1,
    ...data.map((d) => Math.max(d.signups, d.completions))
  );

  const x = (i: number) => PAD.l + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.t + innerH - (v / max) * innerH;

  const line = (key: "signups" | "completions") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d[key])}`).join(" ");
  const area = (key: "signups" | "completions") =>
    `${line(key)} L ${x(n - 1)} ${PAD.t + innerH} L ${x(0)} ${PAD.t + innerH} Z`;

  const SERIES = [
    { key: "completions" as const, color: "var(--accent)", label: "Completions" },
    { key: "signups" as const, color: "var(--primary)", label: "Signups" },
  ];

  const gridY = [0, 0.5, 1];

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    const i =
      n === 1 ? 0 : Math.round(((vx - PAD.l) / innerW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const hp = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <div className="mb-3 flex items-center gap-4 text-sm">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: s.color }}
            />
            <span className="text-muted-foreground">{s.label}</span>
          </span>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          Last {data.length} days
        </span>
      </div>

      <div className="relative">
        {/* Hover tooltip */}
        {hp && hover !== null && (
          <div
            className="aq-card pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap px-3 py-2 text-xs"
            style={{
              left: `clamp(70px, ${(x(hover) / W) * 100}%, calc(100% - 70px))`,
              top: 0,
            }}
          >
            <div className="font-semibold">{fmtDay(hp.day)}</div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--primary)" }} />
              Signups: <span className="font-medium tabular-nums">{hp.signups}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} />
              Completions: <span className="font-medium tabular-nums">{hp.completions}</span>
            </div>
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Activity over the last ${data.length} days`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* gridlines */}
          {gridY.map((g, i) => (
            <line
              key={i}
              x1={PAD.l}
              x2={W - PAD.r}
              y1={PAD.t + innerH - g * innerH}
              y2={PAD.t + innerH - g * innerH}
              stroke={i === 0 ? "color-mix(in srgb, var(--primary) 28%, var(--border))" : "var(--border)"}
              strokeWidth={1}
              strokeDasharray={i === 0 ? "0" : "3 4"}
            />
          ))}

          {SERIES.map((s) => (
            <g key={s.key}>
              <defs>
                <linearGradient id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <motion.path
                d={area(s.key)}
                fill={`url(#fill-${s.key})`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              />
              <motion.path
                d={line(s.key)}
                fill="none"
                stroke={s.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.1, ease: "easeOut" }}
              />
            </g>
          ))}

          {/* hover guide + points */}
          {hover !== null && (
            <g>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={PAD.t}
                y2={PAD.t + innerH}
                stroke="var(--border)"
                strokeWidth={1}
              />
              {SERIES.map((s) => (
                <circle
                  key={s.key}
                  cx={x(hover)}
                  cy={y(data[hover][s.key])}
                  r={4}
                  fill={s.color}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              ))}
            </g>
          )}

          {/* x labels (sparse) */}
          {data.map((d, i) =>
            i % 3 === 0 || i === data.length - 1 ? (
              <text
                key={d.day}
                x={x(i)}
                y={H - 8}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {d.day.slice(5)}
              </text>
            ) : null
          )}
        </svg>
      </div>
    </div>
  );
}
