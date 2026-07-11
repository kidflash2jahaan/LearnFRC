"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Cable,
  Zap,
  Info,
  Printer,
  Save,
  TriangleAlert,
  CircleCheck,
  ChevronDown,
  Ruler,
  Thermometer,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 * VERIFIED DATA — every number below is sourced in tools_verified.json
 * (FRC Wire Gauge & Voltage-Drop / Breaker Calculator).
 * ------------------------------------------------------------------ */

/**
 * DC resistance of solid annealed copper (100% IACS) at 20 C, ohm / 1000 ft.
 * Confidence "certain": HyperPhysics (GSU) AWG table, independently reproduced
 * from R = rho/A with rho = 1.7241e-8 ohm*m and the AWG diameter definition.
 * https://hyperphysics.gsu.edu/hbase/Tables/wirega.html
 */
const RESISTANCE_OHM_PER_1000FT: Readonly<Record<number, number>> = {
  6: 0.3951,
  8: 0.6282,
  10: 0.9989,
  12: 1.588,
  14: 2.525,
  16: 4.016,
  18: 6.385,
  20: 10.15,
  22: 16.14,
  24: 25.67,
};

/** AWG gauges offered, thick -> thin. */
const AWG_OPTIONS: readonly number[] = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24];

/** Copper resistivity (annealed, 100% IACS) at 20 C — for the diameter/area readout. */
const COPPER_RESISTIVITY_OHM_M = 1.7241e-8; // ohm*m, confidence "certain"

/** Copper temperature coefficient of resistance at 20 C. Confidence "high". */
const DEFAULT_ALPHA_PER_C = 0.00393; // per degree C (IEC 60028 / CRC Handbook)

/** Round-trip conductor factor — supply + return. Physics identity. */
const ROUND_TRIP_FACTOR = 2;

/** Nominal FRC battery / system voltage. R601-A, confidence "high" (editable). */
const DEFAULT_SYSTEM_VOLTAGE = 12; // V nominal

/** Stranded-wire resistance uplift over the solid 20 C table. needs_range. */
const STRANDED_UPLIFT_LOW = 0.02; // +2%
const STRANDED_UPLIFT_HIGH = 0.05; // +5%

/**
 * FRC minimum legal wire gauge per circuit. Numerically SMALLER AWG = thicker.
 * Main path = R609 (6 AWG); branch rows = R622 Table 8-4 (2026 TU22, == 2025 V11).
 */
interface CircuitType {
  id: string;
  label: string;
  minAwg: number;
  rule: string;
}

const CIRCUIT_TYPES: readonly CircuitType[] = [
  {
    id: "main",
    label: "120 A main power path (battery ↔ main breaker ↔ PD board)",
    minAwg: 6,
    rule: "R609 — 6 AWG (7 SWG / 16 mm²) or larger",
  },
  {
    id: "b40",
    label: "31–40 A breaker-protected circuit (e.g. drive motor controller)",
    minAwg: 12,
    rule: "R622 Table 8-4 — 12 AWG (13 SWG / 4 mm²)",
  },
  {
    id: "b30",
    label: "21–30 A breaker-protected circuit",
    minAwg: 14,
    rule: "R622 Table 8-4 — 14 AWG (16 SWG / 2.5 mm²)",
  },
  {
    id: "b20",
    label: "6–20 A breaker / 11–20 A fuse; PD board → VRM-RPM / PCM-PH",
    minAwg: 18,
    rule: "R622 Table 8-4 — 18 AWG (19 SWG / 1 mm²)",
  },
  {
    id: "b5",
    label: "≤5 A breaker / ≤10 A fuse / motor power adapter board",
    minAwg: 22,
    rule: "R622 Table 8-4 — 22 AWG (22 SWG / 0.5 mm²)",
  },
  {
    id: "vrm2",
    label: "VRM 2 A circuits / ≤2 A fuse-protected circuit",
    minAwg: 24,
    rule: "R622 Table 8-4 — 24 AWG (24 SWG / 0.25 mm²)",
  },
];

/** One-way length units -> feet. Standard exact conversions (1 in = 1/12 ft, 1 ft = 0.3048 m). */
type LengthUnit = "in" | "ft" | "m";
const LENGTH_TO_FEET: Readonly<Record<LengthUnit, number>> = {
  in: 1 / 12,
  ft: 1,
  m: 1 / 0.3048,
};

/* ------------------------------------------------------------------ *
 * Small pure helpers
 * ------------------------------------------------------------------ */

/** AWG diameter definition d(in) = 0.005 * 92^((36-n)/39). Exact. */
function awgDiameterInch(n: number): number {
  return 0.005 * Math.pow(92, (36 - n) / 39);
}

/** Conductor cross-sectional area in mm^2 from the AWG diameter. */
function awgAreaMm2(n: number): number {
  const dMm = awgDiameterInch(n) * 25.4;
  return (Math.PI / 4) * dMm * dMm;
}

const num = (v: string, fallback: number): number => {
  const p = parseFloat(v);
  return Number.isFinite(p) ? p : fallback;
};

const fmt = (v: number, digits: number): string =>
  v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

interface DropResult {
  rCircuit: number; // ohms, round-trip
  vDrop: number;
  percent: number;
  vLoad: number;
}

/**
 * Voltage drop for a single gauge at a given resistance-per-1000ft.
 * V_drop = I * (2 * L_oneway_ft * R_per_1000ft / 1000).
 */
function computeDrop(
  current: number,
  lengthFt: number,
  rPer1000: number,
  systemVoltage: number
): DropResult {
  const rCircuit = (ROUND_TRIP_FACTOR * lengthFt * rPer1000) / 1000;
  const vDrop = current * rCircuit;
  return {
    rCircuit,
    vDrop,
    percent: systemVoltage > 0 ? (vDrop / systemVoltage) * 100 : 0,
    vLoad: systemVoltage - vDrop,
  };
}

/** Effective ohm/1000ft after temperature + optional stranded uplift. */
function effectiveResistance(
  base20C: number,
  tempC: number,
  alpha: number,
  uplift: number
): number {
  const tempFactor = 1 + alpha * (tempC - 20);
  return base20C * tempFactor * (1 + uplift);
}

function percentBand(pct: number): {
  tone: "ok" | "warn" | "bad";
  label: string;
} {
  if (pct < 3) return { tone: "ok", label: "Under 3%" };
  if (pct <= 5) return { tone: "warn", label: "3–5%" };
  return { tone: "bad", label: "Over 5%" };
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

export default function WireGaugeCalculator({
  authed,
}: {
  authed: boolean;
}): React.JSX.Element {
  // Core inputs
  const [current, setCurrent] = useState("40");
  const [length, setLength] = useState("10");
  const [lengthUnit, setLengthUnit] = useState<LengthUnit>("ft");
  const [gauge, setGauge] = useState(12);
  const [circuitId, setCircuitId] = useState<string>("b40");
  const [strandedWarm, setStrandedWarm] = useState(true);
  const [targetPct, setTargetPct] = useState("5");

  // Advanced (sourced defaults, editable)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tempC, setTempC] = useState("20");
  const [systemVoltage, setSystemVoltage] = useState(String(DEFAULT_SYSTEM_VOLTAGE));
  const [alpha, setAlpha] = useState(String(DEFAULT_ALPHA_PER_C));
  const [upliftLowPct, setUpliftLowPct] = useState(String(STRANDED_UPLIFT_LOW * 100));
  const [upliftHighPct, setUpliftHighPct] = useState(String(STRANDED_UPLIFT_HIGH * 100));

  const [notesOpen, setNotesOpen] = useState(false);

  const circuit = useMemo(
    () => CIRCUIT_TYPES.find((c) => c.id === circuitId) ?? CIRCUIT_TYPES[0],
    [circuitId]
  );

  const derived = useMemo(() => {
    const I = num(current, 0);
    const Lft = num(length, 0) * LENGTH_TO_FEET[lengthUnit];
    const V = num(systemVoltage, DEFAULT_SYSTEM_VOLTAGE);
    const T = num(tempC, 20);
    const a = num(alpha, DEFAULT_ALPHA_PER_C);
    const upLow = strandedWarm ? num(upliftLowPct, 0) / 100 : 0;
    const upHigh = strandedWarm ? num(upliftHighPct, 0) / 100 : 0;

    const rBase = RESISTANCE_OHM_PER_1000FT[gauge];

    // Low bound = solid @ 20 C (the exact table anchor).
    // High bound = warm + stranded (only when strandedWarm mode is on).
    const rLow = rBase;
    const rHigh = strandedWarm ? effectiveResistance(rBase, T, a, upHigh) : rBase;
    const rTypical = strandedWarm ? effectiveResistance(rBase, T, a, upLow) : rBase;

    const low = computeDrop(I, Lft, rLow, V);
    const typical = computeDrop(I, Lft, rTypical, V);
    const high = computeDrop(I, Lft, rHigh, V);

    // FRC compliance: smaller AWG number = thicker = compliant.
    const compliant = gauge <= circuit.minAwg;

    // Thinnest FRC-legal gauge that also keeps the (worst-case) drop under target.
    const tgt = num(targetPct, 0);
    let recommendedGauge: number | null = null;
    for (const g of AWG_OPTIONS) {
      if (g < circuit.minAwg) continue; // must be at least the legal minimum thickness
      const rr = strandedWarm
        ? effectiveResistance(RESISTANCE_OHM_PER_1000FT[g], T, a, upHigh)
        : RESISTANCE_OHM_PER_1000FT[g];
      const d = computeDrop(I, Lft, rr, V);
      if (d.percent <= tgt) recommendedGauge = g; // keep the thinnest that passes
    }

    return {
      I,
      Lft,
      V,
      rBase,
      rHighPer1000: rHigh,
      low,
      typical,
      high,
      compliant,
      recommendedGauge,
      diameterIn: awgDiameterInch(gauge),
      areaMm2: awgAreaMm2(gauge),
    };
  }, [
    current,
    length,
    lengthUnit,
    gauge,
    circuit,
    strandedWarm,
    targetPct,
    tempC,
    systemVoltage,
    alpha,
    upliftLowPct,
    upliftHighPct,
  ]);

  const band = percentBand(derived.high.percent);
  const bandClasses =
    band.tone === "ok"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : band.tone === "warn"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "bg-red-500/10 text-red-700 dark:text-red-300";

  const inputCls =
    "w-full rounded-xl border border-border bg-white/60 px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  const labelCls = "text-sm font-medium text-foreground";
  const helpCls = "text-xs text-muted-foreground";

  const handleSave = () => {
    // Persistence wired later; acknowledge for signed-in users.
    window.alert("Saved this wire run to your account (demo).");
  };

  const rangeMode = strandedWarm;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-3">
        <span className="ac-chip inline-flex items-center gap-2">
          <Cable className="h-3.5 w-3.5" aria-hidden />
          <span className="ac-eyebrow">FRC ELECTRICAL</span>
        </span>
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Wire Gauge &amp; Voltage-Drop{" "}
          <span
            style={{
              background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Calculator
          </span>
        </h2>
        <p className="max-w-2xl text-sm text-foreground/70">
          Size a wire run, see the round-trip voltage drop, and check it against the
          FRC-mandated minimum gauge (R609 / R622 Table 8-4). Provable copper physics
          in, honest numbers out.
        </p>
        <p className={helpCls}>
          Figures: 2026 REBUILT Game Manual (Version TU22) &amp; AWG/IACS copper
          constants. Verify against the current official Game Manual before your event.
        </p>
      </header>

      {/* Body grid */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* LEFT — inputs */}
        <section className="ac-card rounded-2xl p-5">
          <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
            <Zap className="h-4 w-4 text-primary" aria-hidden />
            The wire run
          </h3>

          <div className="space-y-4">
            {/* current */}
            <div className="space-y-1">
              <label className={labelCls} htmlFor="wg-current">
                Load current (A)
              </label>
              <input
                id="wg-current"
                className={inputCls}
                type="number"
                inputMode="decimal"
                min={0}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
              <p className={helpCls}>Continuous current the circuit carries.</p>
            </div>

            {/* length + unit */}
            <div className="space-y-1">
              <label className={labelCls} htmlFor="wg-length">
                One-way run length
              </label>
              <div className="flex gap-2">
                <input
                  id="wg-length"
                  className={inputCls}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                />
                <select
                  aria-label="Length unit"
                  className={`${inputCls} w-28`}
                  value={lengthUnit}
                  onChange={(e) => setLengthUnit(e.target.value as LengthUnit)}
                >
                  <option value="in">inches</option>
                  <option value="ft">feet</option>
                  <option value="m">meters</option>
                </select>
              </div>
              <p className={helpCls}>
                Distance from the PD board to the device. The tool doubles it internally
                (supply + return &mdash; the &times;2 factor).
              </p>
            </div>

            {/* gauge */}
            <div className="space-y-1">
              <label className={labelCls} htmlFor="wg-gauge">
                Wire gauge (AWG)
              </label>
              <select
                id="wg-gauge"
                className={inputCls}
                value={gauge}
                onChange={(e) => setGauge(Number(e.target.value))}
              >
                {AWG_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g} AWG
                  </option>
                ))}
              </select>
              <p className={helpCls}>
                {gauge} AWG &asymp; {fmt(derived.diameterIn, 4)} in dia /{" "}
                {fmt(derived.areaMm2, 2)} mm&sup2; &middot;{" "}
                {fmt(RESISTANCE_OHM_PER_1000FT[gauge], RESISTANCE_OHM_PER_1000FT[gauge] < 1 ? 4 : 3)}{" "}
                &#8486;/1000 ft (solid Cu, 20&deg;C). Smaller number = thicker.
              </p>
            </div>

            {/* circuit type */}
            <div className="space-y-1">
              <label className={labelCls} htmlFor="wg-circuit">
                Circuit type / protection
              </label>
              <select
                id="wg-circuit"
                className={inputCls}
                value={circuitId}
                onChange={(e) => setCircuitId(e.target.value)}
              >
                {CIRCUIT_TYPES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p className={helpCls}>
                Sets the FRC minimum-gauge check. {circuit.rule}.
              </p>
            </div>

            {/* stranded/warm */}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-white/60 p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[#2560e6]"
                checked={strandedWarm}
                onChange={(e) => setStrandedWarm(e.target.checked)}
              />
              <span className="text-sm">
                <span className="font-medium text-foreground">
                  Stranded &amp; warm (realistic range)
                </span>
                <span className={`block ${helpCls}`}>
                  Real FRC wire is stranded and runs warm. Adds a{" "}
                  {fmt(num(upliftLowPct, 0), 0)}&ndash;{fmt(num(upliftHighPct, 0), 0)}%
                  uplift plus temperature, and shows the drop as a range. Turn off for
                  the exact solid-copper 20&deg;C figure.
                </span>
              </span>
            </label>

            {/* target */}
            <div className="space-y-1">
              <label className={labelCls} htmlFor="wg-target">
                Voltage-drop target (%)
              </label>
              <input
                id="wg-target"
                className={inputCls}
                type="number"
                inputMode="decimal"
                min={0}
                step="0.5"
                value={targetPct}
                onChange={(e) => setTargetPct(e.target.value)}
              />
              <p className={helpCls}>
                Used only for the gauge recommendation. 3% / 5% are common engineering
                guidance &mdash; not an FRC rule (FRC sets no max drop).
              </p>
            </div>

            {/* advanced */}
            <div className="ac-divider" />
            <button
              type="button"
              className="flex w-full items-center justify-between text-sm font-medium text-foreground"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
            >
              <span className="inline-flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-primary" aria-hidden />
                Advanced (temperature, voltage, uplift)
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-white/40 p-3">
                <div className="space-y-1">
                  <label className={labelCls} htmlFor="wg-temp">
                    Conductor temp (&deg;C)
                  </label>
                  <input
                    id="wg-temp"
                    className={inputCls}
                    type="number"
                    inputMode="decimal"
                    value={tempC}
                    onChange={(e) => setTempC(e.target.value)}
                  />
                  <p className={helpCls}>Default 20&deg;C table reference.</p>
                </div>
                <div className="space-y-1">
                  <label className={labelCls} htmlFor="wg-voltage">
                    System voltage (V)
                  </label>
                  <input
                    id="wg-voltage"
                    className={inputCls}
                    type="number"
                    inputMode="decimal"
                    value={systemVoltage}
                    onChange={(e) => setSystemVoltage(e.target.value)}
                  />
                  <p className={helpCls}>
                    Nominal 12&nbsp;V &mdash; FRC R601-A. Editable.
                  </p>
                </div>
                <div className="space-y-1">
                  <label className={labelCls} htmlFor="wg-alpha">
                    Cu &alpha; (/&deg;C)
                  </label>
                  <input
                    id="wg-alpha"
                    className={inputCls}
                    type="number"
                    inputMode="decimal"
                    step="0.0001"
                    value={alpha}
                    onChange={(e) => setAlpha(e.target.value)}
                  />
                  <p className={helpCls}>0.00393 &mdash; IEC 60028.</p>
                </div>
                <div className="space-y-1">
                  <label className={labelCls} htmlFor="wg-uplift">
                    Stranded uplift (% low&ndash;high)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="wg-uplift"
                      aria-label="Stranded uplift low percent"
                      className={inputCls}
                      type="number"
                      inputMode="decimal"
                      value={upliftLowPct}
                      onChange={(e) => setUpliftLowPct(e.target.value)}
                    />
                    <input
                      aria-label="Stranded uplift high percent"
                      className={inputCls}
                      type="number"
                      inputMode="decimal"
                      value={upliftHighPct}
                      onChange={(e) => setUpliftHighPct(e.target.value)}
                    />
                  </div>
                  <p className={helpCls}>2&ndash;5% estimate &mdash; verify for your wire.</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT — live results */}
        <section className="ac-card rounded-2xl p-5">
          {/* Primary result */}
          <div className="ac-tile rounded-2xl p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Voltage drop {rangeMode ? "(range)" : ""}
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className="font-display text-4xl font-bold tabular-nums sm:text-5xl"
                style={{
                  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                {rangeMode
                  ? `${fmt(derived.low.vDrop, 2)}–${fmt(derived.high.vDrop, 2)}`
                  : fmt(derived.low.vDrop, 2)}
              </span>
              <span className="text-lg font-semibold text-foreground/70">V</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${bandClasses}`}
              >
                {rangeMode
                  ? `${fmt(derived.low.percent, 1)}–${fmt(derived.high.percent, 1)}%`
                  : `${fmt(derived.low.percent, 1)}%`}{" "}
                of {fmt(derived.V, 0)} V &middot; {band.label}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {rangeMode
                ? "Low = solid copper @ 20°C (exact table). High = stranded + warm."
                : "Solid copper @ 20°C — exact AWG table value."}
            </p>
          </div>

          {/* Secondary outputs */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Metric
              label="Voltage at the load"
              value={
                rangeMode
                  ? `${fmt(derived.high.vLoad, 2)}–${fmt(derived.low.vLoad, 2)} V`
                  : `${fmt(derived.low.vLoad, 2)} V`
              }
              hint={`${fmt(derived.V, 0)} V nominal − drop`}
            />
            <Metric
              label="Round-trip resistance"
              value={
                rangeMode
                  ? `${fmt(derived.low.rCircuit * 1000, 1)}–${fmt(derived.high.rCircuit * 1000, 1)} mΩ`
                  : `${fmt(derived.low.rCircuit * 1000, 1)} mΩ`
              }
              hint={`×2 × ${fmt(derived.Lft, 2)} ft × ${fmt(
                derived.rBase,
                derived.rBase < 1 ? 4 : 3
              )} Ω/1000ft`}
            />
            <Metric
              label="Current"
              value={`${fmt(derived.I, 0)} A`}
              hint="Load current entered"
            />
            <Metric
              label="Electrical length"
              value={`${fmt(derived.Lft * ROUND_TRIP_FACTOR, 2)} ft`}
              hint={`${fmt(derived.Lft, 2)} ft one-way × 2`}
            />
          </div>

          {/* Compliance verdict */}
          <div className="mt-4 space-y-3">
            <div
              className={`flex items-start gap-3 rounded-xl p-3 ${
                derived.compliant
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-500/10 text-red-700 dark:text-red-300"
              }`}
            >
              {derived.compliant ? (
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              ) : (
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              )}
              <div className="text-sm">
                <p className="font-semibold">
                  {derived.compliant
                    ? `FRC-legal — ${gauge} AWG meets the minimum for this circuit`
                    : `TOO THIN — ${gauge} AWG is below the FRC minimum`}
                </p>
                <p className="mt-0.5 opacity-90">
                  Minimum for this circuit: {circuit.minAwg} AWG. {circuit.rule}.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border bg-white/60 p-3">
              <Ruler className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              <div className="text-sm text-foreground">
                <p className="font-semibold">Gauge recommendation</p>
                <p className="mt-0.5 text-foreground/80">
                  {derived.recommendedGauge !== null ? (
                    <>
                      Thinnest FRC-legal gauge that also holds the worst-case drop under{" "}
                      {fmt(num(targetPct, 0), 1)}%:{" "}
                      <span className="font-semibold text-primary">
                        {derived.recommendedGauge} AWG
                      </span>
                      . (Legal floor here is {circuit.minAwg} AWG.)
                    </>
                  ) : (
                    <>
                      No offered gauge (down to 6 AWG) keeps the worst-case drop under{" "}
                      {fmt(num(targetPct, 0), 1)}% at {fmt(derived.I, 0)} A over this run
                      &mdash; shorten the run, split the load, or raise the target.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="ac-divider my-4" />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="ac-btn inline-flex items-center gap-2"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" aria-hidden />
              Print / Save PDF
            </button>
            {authed ? (
              <button
                type="button"
                className="ac-btn-ghost inline-flex items-center gap-2"
                onClick={handleSave}
              >
                <Save className="h-4 w-4" aria-hidden />
                Save scenario
              </button>
            ) : null}
          </div>

          {!authed && (
            <Link
              href="/signup?next=/tools/frc-wire-gauge-calculator"
              className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-white/60 p-3 text-sm transition hover:border-primary/40"
            >
              <Save className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="text-foreground/80">
                <span className="font-medium text-foreground">
                  Create a free account
                </span>{" "}
                to save this wire run, build a full electrical BOM, and export it for the
                pit or inspection binder.
              </span>
            </Link>
          )}
        </section>
      </div>

      {/* Notes & sources */}
      <section className="ac-glass rounded-2xl p-5">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          onClick={() => setNotesOpen((v) => !v)}
          aria-expanded={notesOpen}
        >
          <span className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
            <Info className="h-4 w-4 text-primary" aria-hidden />
            Notes &amp; sources
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${notesOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        {notesOpen && (
          <div className="mt-4 space-y-4 text-sm text-foreground/80">
            <div>
              <p className="mb-1 font-semibold text-foreground">Formulas used</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  AWG diameter (definition): d(in) = 0.005 &times;
                  92<sup>((36&minus;n)/39)</sup>; area A = (&pi;/4)d&sup2;.
                </li>
                <li>
                  Round-trip resistance: R = 2 &times; L<sub>one-way(ft)</sub> &times;
                  R<sub>/1000ft</sub> / 1000. The &times;2 is mandatory (supply + return).
                </li>
                <li>Voltage drop (Ohm&rsquo;s law): V = I &times; R.</li>
                <li>Percent drop: V / 12 V nominal &times; 100.</li>
                <li>
                  Temperature: R<sub>T</sub> = R<sub>20</sub>(1 + &alpha;(T&minus;20)),
                  &alpha; = 0.00393/&deg;C copper.
                </li>
              </ul>
            </div>

            <div>
              <p className="mb-1 font-semibold text-foreground">Disclaimers</p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  Resistance values are DC resistance for solid annealed copper at 20&deg;C
                  (100% IACS). Real FRC wire is stranded and runs warm, so actual drop is
                  typically 2&ndash;8% higher &mdash; the stranded/warm mode accounts for
                  this.
                </li>
                <li>
                  FRC Table 8-4 / R609 gauges are the minimum legal (fire-safety) sizes,
                  NOT the size that minimizes voltage drop. A gauge can be fully legal and
                  still drop significant voltage on a long run &mdash; use the drop number,
                  not just the PASS flag, for drive circuits.
                </li>
                <li>
                  Percent drop is computed against 12&nbsp;V nominal (R601-A). A resting
                  pack is ~12.7&ndash;13.1&nbsp;V and sags under load, so live voltage will
                  differ &mdash; the % is a consistent design reference, not a live
                  measurement.
                </li>
                <li>
                  The 3% / 5% color bands are common engineering guidance, not FRC rules.
                  FRC sets no maximum voltage-drop limit; only the minimum wire gauge is
                  mandated.
                </li>
                <li>
                  Manufacturer-attached or manufacturer-recommended wiring (e.g. leads
                  pre-attached to a motor controller) is exempt from R622 per the rule&rsquo;s
                  own note &mdash; the checker applies to team-run wiring.
                </li>
                <li>
                  Gauges and rule numbers are from the 2026 (TU22) manual and match 2025
                  V11, but FRC can revise wiring rules each season. Always verify against
                  the current official Game Manual before an event; this tool is not a
                  substitute for official inspection.
                </li>
              </ul>
            </div>

            <div>
              <p className="mb-1 font-semibold text-foreground">Sources for every default</p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  Per-gauge resistance (&#8486;/1000&nbsp;ft, solid Cu, 20&deg;C): 6=0.3951,
                  8=0.6282, 10=0.9989, 12=1.588, 14=2.525, 16=4.016, 18=6.385, 20=10.15,
                  22=16.14, 24=25.67 &mdash;{" "}
                  <SourceLink href="https://hyperphysics.gsu.edu/hbase/Tables/wirega.html">
                    HyperPhysics AWG table
                  </SourceLink>
                  , reproduced from R = &rho;/A.
                </li>
                <li>
                  Copper resistivity &rho; = 1.7241&times;10<sup>&minus;8</sup>&nbsp;&#8486;&middot;m
                  (100% IACS, 20&deg;C){" "}
                  <span className="text-xs text-muted-foreground">
                    (= {COPPER_RESISTIVITY_OHM_M.toExponential(4)})
                  </span>{" "}
                  &mdash; IEC 60028 / IACS standard.
                </li>
                <li>
                  Copper &alpha; = 0.00393/&deg;C at 20&deg;C &mdash; IEC 60028 / CRC
                  Handbook.
                </li>
                <li>
                  Round-trip factor &times;2 &mdash; series-circuit topology identity.
                </li>
                <li>
                  Nominal system voltage 12&nbsp;V; main power path 6 AWG; 120&nbsp;A main
                  breaker; Table 8-4 minimums (31&ndash;40A&rarr;12, 21&ndash;30A&rarr;14,
                  6&ndash;20A/11&ndash;20A&nbsp;fuse&rarr;18, &le;5A/&le;10A&nbsp;fuse&rarr;22,
                  VRM&nbsp;2A/&le;2A&nbsp;fuse&rarr;24 AWG) &mdash;{" "}
                  <SourceLink href="https://firstfrc.blob.core.windows.net/frc2026/Manual/2026GameManual.pdf">
                    2026 REBUILT Game Manual (R601-A, R609, R622 Table 8-4)
                  </SourceLink>
                  .
                </li>
                <li>
                  Stranded uplift 2&ndash;5% over the solid table &mdash; needs-range
                  estimate (editable above), not an exact figure.
                </li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">
              This tool estimates wiring only; it is not affiliated with or endorsed by
              FIRST. Not a substitute for official robot inspection.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Presentational helpers
 * ------------------------------------------------------------------ */

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}): React.JSX.Element {
  return (
    <div className="ac-tile rounded-xl p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function SourceLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
    >
      {children}
    </a>
  );
}
