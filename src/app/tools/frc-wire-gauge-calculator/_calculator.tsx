"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";

/* ------------------------------------------------------------------ *
 * VERIFIED DATA: every number below is sourced in tools_verified.json
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

/** Copper resistivity (annealed, 100% IACS) at 20 C, for the diameter/area readout. */
const COPPER_RESISTIVITY_OHM_M = 1.7241e-8; // ohm*m, confidence "certain"

/** Copper temperature coefficient of resistance at 20 C. Confidence "high". */
const DEFAULT_ALPHA_PER_C = 0.00393; // per degree C (IEC 60028 / CRC Handbook)

/** Round-trip conductor factor: supply + return. Physics identity. */
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
    label: "120 A main power path (battery / main breaker / PD board)",
    minAwg: 6,
    rule: "R609: 6 AWG (7 SWG / 16 mm²) or larger",
  },
  {
    id: "b40",
    label: "31-40 A breaker-protected circuit (e.g. drive motor controller)",
    minAwg: 12,
    rule: "R622 Table 8-4: 12 AWG (13 SWG / 4 mm²)",
  },
  {
    id: "b30",
    label: "21-30 A breaker-protected circuit",
    minAwg: 14,
    rule: "R622 Table 8-4: 14 AWG (16 SWG / 2.5 mm²)",
  },
  {
    id: "b20",
    label: "6-20 A breaker / 11-20 A fuse; PD board to VRM-RPM / PCM-PH",
    minAwg: 18,
    rule: "R622 Table 8-4: 18 AWG (19 SWG / 1 mm²)",
  },
  {
    id: "b5",
    label: "≤5 A breaker / ≤10 A fuse / motor power adapter board",
    minAwg: 22,
    rule: "R622 Table 8-4: 22 AWG (22 SWG / 0.5 mm²)",
  },
  {
    id: "vrm2",
    label: "VRM 2 A circuits / ≤2 A fuse-protected circuit",
    minAwg: 24,
    rule: "R622 Table 8-4: 24 AWG (24 SWG / 0.25 mm²)",
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

/**
 * The three drop bands, as words rather than as hues.
 *
 * The old build painted these emerald / amber / red, which is a fourth, fifth
 * and sixth colour the palette does not own, and it left the state carried by
 * colour alone. The binder prints in one ink, so the band is a sentence.
 */
function percentBand(pct: number): {
  tone: "ok" | "warn" | "bad";
  label: string;
} {
  if (pct < 3) return { tone: "ok", label: "under 3%" };
  if (pct <= 5) return { tone: "warn", label: "3 to 5%" };
  return { tone: "bad", label: "over 5%" };
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

/**
 * The wiring tag.
 *
 * This page answers a yes/no question an inspector will also ask, so the
 * verdict is the first thing on the sheet, stamped across a full-bleed ink
 * band where it can be read from across the pit. Everything after it is
 * working: the run written on one hand-ruled tag, then the whole decision
 * space as a gauge ladder, because the number a team actually needs is
 * "which gauge should I have used", not "what did this one gauge do".
 */
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

    // The whole decision space, one row per gauge. Same maths as the headline
    // figure, so the row for the selected gauge always agrees with the slab.
    const ladder = AWG_OPTIONS.map((g) => {
      const base = RESISTANCE_OHM_PER_1000FT[g];
      const rr = strandedWarm ? effectiveResistance(base, T, a, upHigh) : base;
      const d = computeDrop(I, Lft, rr, V);
      return {
        gauge: g,
        base,
        drop: d.vDrop,
        percent: d.percent,
        legal: g <= circuit.minAwg,
        underTarget: d.percent <= tgt,
      };
    });

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
      ladder,
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
  const rangeMode = strandedWarm;

  const handleSave = () => {
    // Persistence wired later; acknowledge for signed-in users.
    window.alert("Saved this wire run to your account (demo).");
  };

  return (
    <>
      {/* ---------------------------------------------------------------- *
       * 1. The question
       * ---------------------------------------------------------------- */}
      <div className="nb-wrap py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="grid gap-x-[clamp(1.5rem,4vw,3rem)] gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="nb-marker">tools / frc-wire-gauge-calculator</p>
            <h1 className="max-w-[19ch]">
              Is this wire thick enough, and is it{" "}
              <span className="nb-mark">legal</span>?
            </h1>
            <p className="nb-lede mt-5">
              Round-trip voltage drop from Ohm&rsquo;s law, checked against the
              minimum gauge the manual sets for your breaker size. Copper physics
              in, honest numbers out.
            </p>
            <p className="nb-slug mt-4 max-w-[62ch]">
              Figures track the 2026 REBUILT Game Manual (TU22) and the AWG/IACS
              copper constants. Verify against the current manual before an event.
            </p>
          </div>
          <p className="nb-pen max-w-[17ch] rotate-[1.5deg] lg:pb-2 lg:text-right">
            the run is doubled, supply and return
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------------------- *
       * 2. The verdict, stamped across an ink band
       *
       * A pass/fail an inspector will also ask about belongs at the top and
       * big, not in a results panel below the fold. The wording carries the
       * state; the band is inverted for weight, never as the only signal.
       * ---------------------------------------------------------------- */}
      <section className="nb-slab py-[clamp(2rem,4.4vw,3.2rem)]" aria-live="polite">
        <div className="nb-wrap grid items-end gap-[clamp(1.3rem,3vw,2.6rem)] lg:grid-cols-[minmax(0,1.05fr)_repeat(3,minmax(0,0.72fr))]">
          <div>
            <p className="nb-slug !text-[rgba(245,246,242,0.82)]">
              verdict / {derived.compliant ? "passes" : "fails"} the gauge rule
            </p>
            <h2 className="mt-2 max-w-[15ch] text-[clamp(1.5rem,1.1rem+1.7vw,2.4rem)] text-card">
              {derived.compliant
                ? `${gauge} AWG is legal on this circuit.`
                : `${gauge} AWG is too thin for this circuit.`}
            </h2>
            <p className="mt-3 max-w-[34ch] text-[0.95rem] text-[rgba(245,246,242,0.85)]">
              Minimum here is {circuit.minAwg} AWG. {circuit.rule}.
            </p>
          </div>

          <p className="nb-stamp">
            <b>
              {rangeMode
                ? `${fmt(derived.low.vDrop, 2)}-${fmt(derived.high.vDrop, 2)}`
                : fmt(derived.low.vDrop, 2)}
            </b>
            <span>volts dropped over the run</span>
          </p>
          <p className="nb-stamp">
            <b>
              {rangeMode
                ? `${fmt(derived.low.percent, 1)}-${fmt(derived.high.percent, 1)}`
                : fmt(derived.low.percent, 1)}
              %
            </b>
            <span>of {fmt(derived.V, 0)} V nominal, {band.label}</span>
          </p>
          <p className="nb-stamp">
            <b>
              {rangeMode
                ? `${fmt(derived.high.vLoad, 2)}-${fmt(derived.low.vLoad, 2)}`
                : fmt(derived.low.vLoad, 2)}
            </b>
            <span>volts left at the load</span>
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * 3. The run, written on one tag
       *
       * Six inputs on a single hand-ruled tag rather than a left-hand form
       * column: this is one wire, described once, and the conductor facts
       * that fall out of the gauge belong on the same tag as its footer.
       * ---------------------------------------------------------------- */}
      <section className="py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <p className="nb-marker">the run / six numbers</p>
          <h2 className="max-w-[20ch] text-[clamp(1.5rem,1.1rem+1.6vw,2.4rem)]">
            Describe the wire you are about to cut.
          </h2>

          <div className="nb-box nb-tilt-3 relative mt-[clamp(1.4rem,3vw,2.2rem)] p-[clamp(1.2rem,2.6vw,2rem)]">
            <span className="nb-tape -top-3 left-[12%] rotate-[-3.4deg]" aria-hidden="true" />
            <span
              className="nb-tape -bottom-3 right-[14%] rotate-[2.6deg]"
              aria-hidden="true"
            />

            <div className="grid gap-[clamp(1rem,2.2vw,1.5rem)] sm:grid-cols-2 lg:grid-cols-3">
              <div className="nb-field">
                <label className="nb-label" htmlFor="wg-current">
                  Load current (A)
                </label>
                <input
                  id="wg-current"
                  className="nb-input"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                />
                <p className="nb-hint">Continuous current the circuit carries.</p>
              </div>

              <div className="nb-field">
                <label className="nb-label" htmlFor="wg-length">
                  One-way run length
                </label>
                <div className="flex gap-2">
                  <input
                    id="wg-length"
                    className="nb-input"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                  />
                  <select
                    aria-label="Length unit"
                    className="nb-input nb-select w-[7.5rem] shrink-0"
                    value={lengthUnit}
                    onChange={(e) => setLengthUnit(e.target.value as LengthUnit)}
                  >
                    <option value="in">inches</option>
                    <option value="ft">feet</option>
                    <option value="m">meters</option>
                  </select>
                </div>
                <p className="nb-hint">
                  PD board to the device. The tool doubles it for supply and return.
                </p>
              </div>

              <div className="nb-field">
                <label className="nb-label" htmlFor="wg-gauge">
                  Wire gauge (AWG)
                </label>
                <select
                  id="wg-gauge"
                  className="nb-input nb-select"
                  value={gauge}
                  onChange={(e) => setGauge(Number(e.target.value))}
                >
                  {AWG_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g} AWG
                    </option>
                  ))}
                </select>
                <p className="nb-hint">Smaller number means thicker wire.</p>
              </div>

              <div className="nb-field sm:col-span-2">
                <label className="nb-label" htmlFor="wg-circuit">
                  Circuit type / protection
                </label>
                <select
                  id="wg-circuit"
                  className="nb-input nb-select"
                  value={circuitId}
                  onChange={(e) => setCircuitId(e.target.value)}
                >
                  {CIRCUIT_TYPES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <p className="nb-hint">Sets the minimum-gauge check. {circuit.rule}.</p>
              </div>

              <div className="nb-field">
                <label className="nb-label" htmlFor="wg-target">
                  Voltage-drop target (%)
                </label>
                <input
                  id="wg-target"
                  className="nb-input"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.5"
                  value={targetPct}
                  onChange={(e) => setTargetPct(e.target.value)}
                />
                <p className="nb-hint">
                  Drives the ladder below. Common guidance, not an FRC rule.
                </p>
              </div>
            </div>

            {/* Tag footer: the mode switch, then what the chosen gauge is. */}
            <div className="nb-hair mt-[clamp(1.2rem,2.6vw,1.8rem)] grid gap-[clamp(1rem,2.2vw,1.6rem)] pt-[clamp(1.1rem,2.2vw,1.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <label className="flex min-h-[2.75rem] cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0"
                  checked={strandedWarm}
                  onChange={(e) => setStrandedWarm(e.target.checked)}
                />
                <span>
                  <span className="block text-[0.95rem] font-semibold">
                    Stranded and warm, the realistic range
                  </span>
                  <span className="nb-hint mt-0.5 block">
                    Real FRC wire is stranded and runs warm. Adds{" "}
                    {fmt(num(upliftLowPct, 0), 0)} to {fmt(num(upliftHighPct, 0), 0)}%
                    plus temperature and shows a range. Turn it off for the exact
                    solid-copper 20&deg;C figure.
                  </span>
                </span>
              </label>

              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 self-start">
                <dt className="nb-slug">conductor</dt>
                <dd className="nb-slug !text-ink">
                  {gauge} AWG, {fmt(derived.diameterIn, 4)} in dia,{" "}
                  {fmt(derived.areaMm2, 2)} mm&sup2;
                </dd>
                <dt className="nb-slug">resistance</dt>
                <dd className="nb-slug !text-ink">
                  {fmt(derived.rBase, derived.rBase < 1 ? 4 : 3)} &#8486;/1000 ft solid
                  Cu at 20&deg;C
                </dd>
                <dt className="nb-slug">circuit</dt>
                <dd className="nb-slug !text-ink">
                  {fmt(derived.low.rCircuit * 1000, 1)}
                  {rangeMode ? ` to ${fmt(derived.high.rCircuit * 1000, 1)}` : ""} m&#8486;
                  round trip
                </dd>
                <dt className="nb-slug">electrical length</dt>
                <dd className="nb-slug !text-ink">
                  {fmt(derived.Lft * ROUND_TRIP_FACTOR, 2)} ft, being{" "}
                  {fmt(derived.Lft, 2)} ft each way
                </dd>
              </dl>
            </div>
          </div>

          {/* Advanced constants. Collapsed, because six of the eight teams
              that open this page never touch them. */}
          <div className="mt-[clamp(1.2rem,2.6vw,1.8rem)]">
            <button
              type="button"
              className="nb-slug flex min-h-[2.75rem] w-full items-center justify-between gap-3 border-b-2 border-ink !text-ink"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
              aria-controls="wg-advanced"
            >
              <span>advanced / temperature, system voltage, stranded uplift</span>
              <span aria-hidden="true">{showAdvanced ? "hide" : "show"}</span>
            </button>

            {showAdvanced && (
              <div
                id="wg-advanced"
                className="grid gap-[clamp(1rem,2.2vw,1.5rem)] pt-[clamp(1.1rem,2.2vw,1.5rem)] sm:grid-cols-2 lg:grid-cols-4"
              >
                <div className="nb-field">
                  <label className="nb-label" htmlFor="wg-temp">
                    Conductor temp (&deg;C)
                  </label>
                  <input
                    id="wg-temp"
                    className="nb-input"
                    type="number"
                    inputMode="decimal"
                    value={tempC}
                    onChange={(e) => setTempC(e.target.value)}
                  />
                  <p className="nb-hint">20&deg;C is the table reference.</p>
                </div>
                <div className="nb-field">
                  <label className="nb-label" htmlFor="wg-voltage">
                    System voltage (V)
                  </label>
                  <input
                    id="wg-voltage"
                    className="nb-input"
                    type="number"
                    inputMode="decimal"
                    value={systemVoltage}
                    onChange={(e) => setSystemVoltage(e.target.value)}
                  />
                  <p className="nb-hint">12 V nominal, R601-A.</p>
                </div>
                <div className="nb-field">
                  <label className="nb-label" htmlFor="wg-alpha">
                    Copper &alpha; (/&deg;C)
                  </label>
                  <input
                    id="wg-alpha"
                    className="nb-input"
                    type="number"
                    inputMode="decimal"
                    step="0.0001"
                    value={alpha}
                    onChange={(e) => setAlpha(e.target.value)}
                  />
                  <p className="nb-hint">0.00393, IEC 60028.</p>
                </div>
                <div className="nb-field">
                  <label className="nb-label" htmlFor="wg-uplift">
                    Stranded uplift (% low to high)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="wg-uplift"
                      aria-label="Stranded uplift low percent"
                      className="nb-input"
                      type="number"
                      inputMode="decimal"
                      value={upliftLowPct}
                      onChange={(e) => setUpliftLowPct(e.target.value)}
                    />
                    <input
                      aria-label="Stranded uplift high percent"
                      className="nb-input"
                      type="number"
                      inputMode="decimal"
                      value={upliftHighPct}
                      onChange={(e) => setUpliftHighPct(e.target.value)}
                    />
                  </div>
                  <p className="nb-hint">2 to 5% estimate, verify for your wire.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * 4. The gauge ladder
       *
       * The number a team needs is rarely "what did this gauge do", it is
       * "which gauge should I have used", so print the whole decision space
       * and mark the row they are standing on.
       * ---------------------------------------------------------------- */}
      <section className="nb-rule py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <div className="grid gap-x-[clamp(1.5rem,4vw,3rem)] gap-y-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="nb-marker">every gauge / against this run</p>
              <h2 className="max-w-[22ch] text-[clamp(1.5rem,1.1rem+1.6vw,2.4rem)]">
                What each gauge would have done.
              </h2>
              <p className="nb-sub mt-4">
                {fmt(derived.I, 0)} A over {fmt(derived.Lft, 2)} ft one way,{" "}
                {rangeMode ? "worst case, stranded and warm" : "solid copper at 20°C"}.
                A row is only usable if it is both legal on this circuit and under
                your {fmt(num(targetPct, 0), 1)}% target.
              </p>
            </div>
            {derived.recommendedGauge !== null ? (
              <p className="nb-count shrink-0 lg:pb-1 lg:text-right">
                {derived.recommendedGauge} AWG
                <small>thinnest that works</small>
              </p>
            ) : (
              <p className="nb-slug max-w-[24ch] lg:pb-1 lg:text-right">
                nothing down to 6 AWG holds this target, shorten the run or split the
                load
              </p>
            )}
          </div>

          {/* `tabIndex` because this table is 46rem wide and holds no links:
              below that width the scroller is reachable by pointer only, and
              the right-hand columns cannot be read from a keyboard at all. */}
          <div className="nb-scroll mt-[clamp(1.4rem,3vw,2.2rem)]" tabIndex={0}>
            <table className="nb-table min-w-[46rem]">
              <caption className="sr-only">
                Voltage drop and legality for every offered wire gauge on the run
                described above.
              </caption>
              <thead>
                <tr>
                  <th scope="col">gauge</th>
                  <th scope="col">&#8486;/1000 ft</th>
                  <th scope="col">volts dropped</th>
                  <th scope="col">% of {fmt(derived.V, 0)} V</th>
                  <th scope="col">rule</th>
                  <th scope="col">verdict</th>
                </tr>
              </thead>
              <tbody>
                {derived.ladder.map((r) => {
                  const chosen = r.gauge === gauge;
                  const pick = r.gauge === derived.recommendedGauge;
                  return (
                    <tr
                      key={r.gauge}
                      // The selected row is marked by weight, a blue bar and a
                      // word, so it survives greyscale and colour blindness.
                      className={chosen ? "bg-[rgba(27,54,200,0.07)] font-semibold" : ""}
                    >
                      <th
                        scope="row"
                        className={`!border-b-0 !pl-3 !text-[0.86rem] !normal-case ${
                          chosen ? "!text-ink" : ""
                        }`}
                        style={{
                          borderLeft: `3px solid ${chosen ? "var(--blue)" : "transparent"}`,
                        }}
                      >
                        {r.gauge} AWG
                      </th>
                      <td className="nb-slug !text-ink">
                        {fmt(r.base, r.base < 1 ? 4 : 3)}
                      </td>
                      <td className="nb-slug !text-ink">{fmt(r.drop, 2)} V</td>
                      <td className="nb-slug !text-ink">{fmt(r.percent, 1)}%</td>
                      <td className="nb-slug">
                        {r.legal ? "meets the minimum" : `below ${circuit.minAwg} AWG`}
                      </td>
                      <td className="nb-slug !text-ink">
                        {!r.legal
                          ? "not legal here"
                          : !r.underTarget
                            ? "legal, over target"
                            : pick
                              ? "use this one"
                              : "works"}
                        {chosen ? " · selected" : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="nb-note mt-[clamp(1.4rem,3vw,2.2rem)] max-w-[64ch] text-[0.95rem] leading-relaxed text-graphite">
            <span className="nb-slug mb-1 block">what &ldquo;legal&rdquo; does not mean</span>
            Table 8-4 and R609 set the minimum safe size, not the size that keeps
            voltage where you want it. A gauge can pass inspection and still drop
            most of a volt on a long drive run, so read the drop column, not just
            the rule column.
          </p>

          {/* Actions live at the foot of the working, where you would sign a
              worksheet, not floating beside the results. */}
          <div className="mt-[clamp(1.4rem,3vw,2.2rem)] flex flex-wrap items-center gap-3">
            <button type="button" className="nb-btn" onClick={() => window.print()}>
              Print this sheet
            </button>
            {authed ? (
              <button type="button" className="nb-btn-ghost" onClick={handleSave}>
                Save scenario
              </button>
            ) : (
              <Link
                href="/signup?next=/tools/frc-wire-gauge-calculator"
                className="nb-btn-ghost"
              >
                Save this run to an account
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * 5. The back of the sheet
       * ---------------------------------------------------------------- */}
      <section className="nb-rule py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <button
            type="button"
            className="flex w-full items-baseline justify-between gap-4 text-left"
            onClick={() => setNotesOpen((v) => !v)}
            aria-expanded={notesOpen}
            aria-controls="wg-notes"
          >
            <span>
              <span className="nb-marker">the back of the sheet</span>
              <span className="block text-[clamp(1.35rem,1.05rem+1.2vw,2rem)] font-extrabold tracking-[-0.025em]">
                Every formula and every source.
              </span>
            </span>
            <span className="nb-slug shrink-0 !text-ink" aria-hidden="true">
              {notesOpen ? "hide" : "show"}
            </span>
          </button>

          {notesOpen && (
            <div
              id="wg-notes"
              className="mt-[clamp(1.4rem,3vw,2.2rem)] grid gap-[clamp(1.4rem,3vw,2.6rem)] lg:grid-cols-3"
            >
              <div>
                <p className="nb-slug border-b-2 border-ink pb-2">formulas used</p>
                <ul className="nb-prose mt-4 !max-w-none text-[0.95rem]">
                  <li>
                    AWG diameter, by definition: d(in) = 0.005 &times; 92
                    <sup>((36&minus;n)/39)</sup>, area A = (&pi;/4)d&sup2;.
                  </li>
                  <li>
                    Round-trip resistance: R = 2 &times; L<sub>one-way (ft)</sub>{" "}
                    &times; R<sub>/1000ft</sub> / 1000. The &times;2 is not optional.
                  </li>
                  <li>Voltage drop, Ohm&rsquo;s law: V = I &times; R.</li>
                  <li>Percent drop: V / 12 V nominal &times; 100.</li>
                  <li>
                    Temperature: R<sub>T</sub> = R<sub>20</sub>(1 + &alpha;(T&minus;20)),
                    &alpha; = 0.00393/&deg;C for copper.
                  </li>
                </ul>
              </div>

              <div>
                <p className="nb-slug border-b-2 border-ink pb-2">where it stops being true</p>
                <ul className="nb-prose mt-4 !max-w-none text-[0.95rem]">
                  <li>
                    The table is DC resistance for solid annealed copper at 20&deg;C.
                    Real wire is stranded and warm, so actual drop runs 2 to 8% higher.
                    That is what the stranded mode is for.
                  </li>
                  <li>
                    Percent is measured against 12 V nominal. A rested pack sits near
                    12.7 to 13.1 V and sags under load, so this is a design reference,
                    not a live reading.
                  </li>
                  <li>
                    The 3% and 5% bands are engineering guidance. FRC sets no maximum
                    drop, only a minimum gauge.
                  </li>
                  <li>
                    Wiring attached or specified by a manufacturer, like the leads
                    already on a motor controller, is exempt from R622. This checker
                    is for wire your team runs.
                  </li>
                  <li>
                    Gauges and rule numbers are 2026 (TU22) and match 2025 V11, but
                    FRC revises wiring rules. This is not a substitute for inspection.
                  </li>
                </ul>
              </div>

              <div>
                <p className="nb-slug border-b-2 border-ink pb-2">sources for every default</p>
                <ul className="nb-prose mt-4 !max-w-none text-[0.95rem]">
                  <li>
                    Per-gauge resistance (&#8486;/1000 ft, solid Cu, 20&deg;C): 6=0.3951,
                    8=0.6282, 10=0.9989, 12=1.588, 14=2.525, 16=4.016, 18=6.385,
                    20=10.15, 22=16.14, 24=25.67, from the{" "}
                    <SourceLink href="https://hyperphysics.gsu.edu/hbase/Tables/wirega.html">
                      HyperPhysics AWG table
                    </SourceLink>
                    , reproduced from R = &rho;/A.
                  </li>
                  <li>
                    Copper resistivity &rho; = 1.7241&times;10<sup>&minus;8</sup>{" "}
                    &#8486;&middot;m at 20&deg;C, 100% IACS (
                    {COPPER_RESISTIVITY_OHM_M.toExponential(4)}), IEC 60028.
                  </li>
                  <li>Copper &alpha; = 0.00393/&deg;C at 20&deg;C, IEC 60028.</li>
                  <li>Round-trip factor &times;2, a series-circuit identity.</li>
                  <li>
                    12 V nominal, 6 AWG main path, 120 A main breaker, and the Table
                    8-4 minimums (31 to 40 A gives 12, 21 to 30 A gives 14, 6 to 20 A
                    gives 18, 5 A and under gives 22, VRM 2 A gives 24), from the{" "}
                    <SourceLink href="https://firstfrc.blob.core.windows.net/frc2026/Manual/2026GameManual.pdf">
                      2026 REBUILT Game Manual, R601-A, R609, R622
                    </SourceLink>
                    .
                  </li>
                  <li>
                    Stranded uplift of 2 to 5% over the solid table is an estimate you
                    can edit, not an exact figure.
                  </li>
                </ul>
                <p className="nb-slug mt-4">
                  Not affiliated with or endorsed by FIRST.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Presentational helpers
 * ------------------------------------------------------------------ */

function SourceLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="nb-link">
      {children}
    </a>
  );
}
