"use client";

import * as React from "react";
import {
  motion,
  useReducedMotion,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import { Flame, Target, Zap } from "lucide-react";

/**
 * Signature hero device: "Progress at a glance" — a glass instrument panel
 * with three telemetry gauges (streak / level / XP-to-next) that spring-fill
 * on load, like a robot dashboard reading out the learner's season.
 */

type GaugeProps = {
  /** 0–100 fill percentage of the arc */
  pct: number;
  /** the big number shown in the gauge center */
  value: number;
  /** tiny label above the number */
  label: string;
  /** small caption under the number */
  caption: string;
  suffix?: string;
  /** arc gradient stops */
  from: string;
  to: string;
  glyph: "level" | "streak" | "xp";
  size: number;
  stroke: number;
  /** stagger delay in seconds */
  delay: number;
};

const GLYPHS = { level: Target, streak: Flame, xp: Zap } as const;

function Gauge({
  pct,
  value,
  label,
  caption,
  suffix = "",
  from,
  to,
  glyph,
  size,
  stroke,
  delay,
}: GaugeProps) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // three-quarter dial, gap sits at the bottom once rotated
  const sweep = 0.75;
  const arcLen = c * sweep;
  const target = Math.max(0, Math.min(100, pct)) / 100;

  const progress = useMotionValue(reduce ? target : 0);
  const dashOffset = useTransform(progress, (p) => arcLen - arcLen * p);
  const [num, setNum] = React.useState(reduce ? value : 0);
  const uid = React.useId();

  React.useEffect(() => {
    if (reduce) {
      progress.set(target);
      setNum(value);
      return;
    }
    const arc = animate(progress, target, {
      duration: 1.1,
      delay,
      ease: [0.34, 1.2, 0.64, 1],
    });
    const count = animate(0, value, {
      duration: 1.1,
      delay,
      ease: [0.33, 1, 0.68, 1],
      onUpdate: (v) => setNum(Math.round(v)),
    });
    return () => {
      arc.stop();
      count.stop();
    };
  }, [progress, target, value, delay, reduce]);

  const Glyph = GLYPHS[glyph];

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }} aria-hidden>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: "rotate(135deg)" }}
        >
          <defs>
            <linearGradient id={`gauge-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={from} />
              <stop offset="1" stopColor={to} />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(120,145,190,0.24)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arcLen} ${c}`}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#gauge-${uid})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arcLen} ${c}`}
            style={{ strokeDashoffset: dashOffset }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <Glyph aria-hidden className="mb-0.5 h-4 w-4" style={{ color: from }} />
          <span className="font-display text-2xl font-extrabold leading-none tabular-nums text-foreground sm:text-3xl">
            {num.toLocaleString()}
            {suffix}
          </span>
        </div>
      </div>
      <div className="mt-1.5 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          {label}
        </p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{caption}</p>
      </div>
    </div>
  );
}

export function InstrumentPanel({
  level,
  levelPct,
  xpToNext,
  xp,
  xpIntoLevel,
  streak,
  xpMultiplier,
  nextLevel,
}: {
  level: number;
  levelPct: number;
  xpToNext: number;
  xp: number;
  xpIntoLevel: number;
  streak: number;
  xpMultiplier: string;
  nextLevel: number;
}) {
  const reduce = useReducedMotion();
  // streak arc saturates at a 7-day week for a satisfying full loop
  const streakPct = Math.min(100, (streak / 7) * 100);
  const xpArcPct = (xpIntoLevel / (xpIntoLevel + xpToNext || 1)) * 100;

  return (
    <motion.div
      className="ac-glass relative w-full p-6 sm:p-7"
      initial={{ opacity: 0, y: 26, rotate: 1.1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={
        reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 18, delay: 0.2 }
      }
      whileHover={reduce ? undefined : { y: -6 }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-[17px] font-bold text-foreground">
          Progress at a glance
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-success">
          <motion.span
            className="h-2 w-2 rounded-full bg-[#12b565]"
            animate={reduce ? undefined : { scale: [1, 1.35, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />
          Live
        </span>
      </div>

      <div className="mt-5 grid grid-cols-3 items-start gap-2 sm:gap-4">
        <Gauge
          glyph="streak"
          label="Streak"
          value={streak}
          caption={streak > 0 ? `${xpMultiplier}× XP` : "start today"}
          pct={streakPct}
          from="#ff8a3d"
          to="#f5a623"
          size={92}
          stroke={9}
          delay={0.38}
        />
        <Gauge
          glyph="level"
          label="Level"
          value={level}
          caption={`${levelPct}% to L${nextLevel}`}
          pct={levelPct}
          from="#2560e6"
          to="#1aa9d6"
          size={132}
          stroke={12}
          delay={0.2}
        />
        <Gauge
          glyph="xp"
          label="To next"
          value={xpToNext}
          caption={`${xp.toLocaleString()} XP total`}
          pct={xpArcPct}
          from="#7c5cff"
          to="#b16bff"
          size={92}
          stroke={9}
          delay={0.5}
        />
      </div>

      <p className="mt-5 text-[13px] leading-relaxed text-muted-foreground">
        Every lesson banks XP — streaks multiply it. Keep the ring moving.
      </p>
    </motion.div>
  );
}
