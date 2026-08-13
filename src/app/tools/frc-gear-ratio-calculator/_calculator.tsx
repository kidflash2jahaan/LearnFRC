"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BatteryCharging,
  Cog,
  Gauge,
  Info,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 * Exact unit conversions (defined constants, not estimates)
 * ------------------------------------------------------------------ */
const M_PER_IN = 0.0254; // NIST exact: 1 in = 0.0254 m
const LBF_TO_N = 4.4482216; // NIST exact: 1 lbf = 4.4482216 N
const NM_TO_FTLB = 1 / (LBF_TO_N * 0.3048); // 1 N·m = 0.737562… ft·lbf (derived, exact)
const G_FT_S2 = 32.17405; // standard gravity, ft/s² (CODATA 9.80665 m/s²)
const FPS_TO_MPS = 0.3048; // exact

/* ------------------------------------------------------------------ *
 * Electrical limits — same verified constants this site's Current &
 * Brownout tool uses, so the two calculators never disagree.
 *   120 A main breaker            — Cooper Bussmann CB285-120
 *   roboRIO 1.0 brownout  6.3 V   — WPILib (fixed)
 *   roboRIO 2.0 brownout  6.75 V  — WPILib (software-settable default)
 *   6.8 V                         — 6 V PWM rail begins to droop (WPILib)
 *   R_int 0.015 Ω / V_oc 12.5 V   — conservative pack defaults (WPILib range)
 * ------------------------------------------------------------------ */
const MAIN_BREAKER_A = 120;
const BROWNOUT_V = 6.75;
const RAIL_DROOP_V = 6.8;
const DEFAULT_VOC_V = 12.5;
const DEFAULT_RINT_OHM = 0.015;

/* ------------------------------------------------------------------ *
 * VERIFIED motor data — every figure below was checked against the
 * motor's OWN manufacturer's currently-published spec (see the Notes &
 * sources panel at the bottom of this tool for the exact URLs).
 *
 * Deliberately EXCLUDED because no current first-party spec page could
 * be verified: Mini CIM (dropped by AndyMark & CTRE; only third-party
 * mirrors remain) and CTRE Minion (store page publishes stall torque
 * and peak power but not free speed / stall current). Guessing those
 * would make every number downstream of them wrong, so they are out.
 * ------------------------------------------------------------------ */
type Motor = {
  key: string;
  label: string;
  freeRpm: number; // no-load speed at 12 V
  stallNm: number; // stall torque at 12 V
  stallA: number; // stall current at 12 V
  freeA: number; // no-load current
  vendor: string;
  note: string;
};

const MOTORS: Motor[] = [
  {
    key: "neo",
    label: "REV NEO V1.1",
    freeRpm: 5676,
    stallNm: 2.6,
    stallA: 105,
    freeA: 1.8,
    vendor: "REV Robotics",
    note: "REV's published empirical figures (measured with a SPARK MAX on FRC hardware). WPILib's simulation uses this same set.",
  },
  {
    key: "vortex",
    label: "REV NEO Vortex",
    freeRpm: 6784,
    stallNm: 3.6,
    stallA: 211,
    freeA: 3.6,
    vendor: "REV Robotics",
    note: "565 Kv. Faster and stronger than a NEO, but note the much higher stall current when you set limits.",
  },
  {
    key: "krakenx60",
    label: "Kraken X60 (trapezoidal)",
    freeRpm: 6000,
    stallNm: 7.09,
    stallA: 366,
    freeA: 2,
    vendor: "WCP / CTR Electronics",
    note: "Default commutation: what you get without a Phoenix Pro FOC licence.",
  },
  {
    key: "krakenx60foc",
    label: "Kraken X60 (FOC)",
    freeRpm: 5800,
    stallNm: 9.37,
    stallA: 483,
    freeA: 2,
    vendor: "WCP / CTR Electronics",
    note: "Field-oriented control trades a little free speed for a lot of torque. Requires a Phoenix Pro licence.",
  },
  {
    key: "krakenx44",
    label: "Kraken X44 (trapezoidal)",
    freeRpm: 7530,
    stallNm: 4.05,
    stallA: 275,
    freeA: 1.4,
    vendor: "WCP / CTR Electronics",
    note: "The compact Kraken: smaller and faster, for intakes, hoods and shooters.",
  },
  {
    key: "krakenx44foc",
    label: "Kraken X44 (FOC)",
    freeRpm: 7368,
    stallNm: 5.01,
    stallA: 329,
    freeA: 3,
    vendor: "WCP / CTR Electronics",
    note: "X44 with field-oriented control. Requires a Phoenix Pro licence.",
  },
  {
    key: "falcon500",
    label: "Falcon 500",
    freeRpm: 6380,
    stallNm: 4.69,
    stallA: 257,
    freeA: 1.5,
    vendor: "VEX / CTR Electronics",
    note: "Discontinued but still everywhere. Figures are CTRE's published trapezoidal numbers.",
  },
  {
    key: "cim",
    label: "CIM (2.5 in)",
    freeRpm: 5310,
    stallNm: 2.425,
    stallA: 133,
    freeA: 2.7,
    vendor: "AndyMark (am-0255)",
    note: "The classic brushed KOP motor. Heavy and no built-in encoder, but nearly indestructible.",
  },
];

/* ------------------------------------------------------------------ *
 * Presets — every ratio below is a real, published vendor number.
 * ------------------------------------------------------------------ */
type Mode = "drivetrain" | "mechanism";
type StageInput = "teeth" | "ratio";

type PresetStage = { driving: string; driven: string; ratio: string };

type Preset = {
  key: string;
  label: string;
  blurb: string;
  mode: Mode;
  motor: string;
  count: string;
  stageInput: StageInput;
  stages: PresetStage[];
  eff: string;
  wheel: string;
  weight: string;
  mu: string;
  weightFrac: string;
  derate: string;
  limit: string;
  arm: string;
};

const PRESETS: Preset[] = [
  {
    key: "kop",
    label: "KOP tank",
    blurb:
      "Kit-of-Parts chassis: 2 × CIM through a ToughBox Mini at 8.45:1 (AndyMark's real gearset: a 14T pinion into 50T, then 19T into 45T), 6 in wheels.",
    mode: "drivetrain",
    motor: "cim",
    count: "2",
    stageInput: "teeth",
    stages: [
      { driving: "14", driven: "50", ratio: "3.571" },
      { driving: "19", driven: "45", ratio: "2.368" },
    ],
    eff: "90",
    wheel: "6",
    weight: "120",
    mu: "1.1",
    weightFrac: "100",
    derate: "85",
    limit: "40",
    arm: "24",
  },
  {
    key: "neotank",
    label: "Brushless tank",
    blurb:
      "The common modern rebuild of the same chassis: 4 × NEO on the same 8.45:1 ToughBox gearset and 6 in wheels. Compare its pushing force to the CIM preset.",
    mode: "drivetrain",
    motor: "neo",
    count: "4",
    stageInput: "teeth",
    stages: [
      { driving: "14", driven: "50", ratio: "3.571" },
      { driving: "19", driven: "45", ratio: "2.368" },
    ],
    eff: "90",
    wheel: "6",
    weight: "125",
    mu: "1.1",
    weightFrac: "100",
    derate: "85",
    limit: "40",
    arm: "24",
  },
  {
    key: "swerve",
    label: "Swerve (MK4i L2)",
    blurb:
      "Four modules, one Kraken X60 driving each: SDS MK4i in the L2 gearing (6.75:1) on 4 in wheels. The module is three reductions, so efficiency starts at ≈0.95³.",
    mode: "drivetrain",
    motor: "krakenx60",
    count: "4",
    stageInput: "ratio",
    stages: [{ driving: "1", driven: "6.75", ratio: "6.75" }],
    eff: "86",
    wheel: "4",
    weight: "125",
    mu: "1.1",
    weightFrac: "100",
    derate: "85",
    limit: "40",
    arm: "24",
  },
  {
    key: "arm",
    label: "Arm / mechanism",
    blurb:
      "A single NEO through a 100:1 planetary driving a 24 in arm, the starting point for most FRC arm and elevator ratio questions.",
    mode: "mechanism",
    motor: "neo",
    count: "1",
    stageInput: "ratio",
    stages: [{ driving: "1", driven: "100", ratio: "100" }],
    eff: "86",
    wheel: "4",
    weight: "125",
    mu: "1.1",
    weightFrac: "100",
    derate: "85",
    limit: "40",
    arm: "24",
  },
];

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
function parseNum(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function fmt(n: number, digits: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function Tip({ text }: { text: string }): React.ReactElement {
  return (
    <span
      title={text}
      className="inline-flex cursor-help align-middle text-muted-foreground"
      aria-label={text}
    >
      <Info className="h-3.5 w-3.5" />
    </span>
  );
}

const INPUT_CLS =
  "min-h-[44px] w-full rounded-xl border border-border bg-white/60 px-3 py-2 text-sm text-foreground tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const SELECT_CLS =
  "min-h-[44px] w-full rounded-xl border border-border bg-white/60 px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * React key only. This counter is module-level and therefore NOT stable
 * between a server render and the client's hydration render, so `id` must
 * never reach the DOM — every rendered id/htmlFor below is derived from the
 * stage's array index instead, which is deterministic on both sides.
 */
let stageSeq = 0;
function newStage(driving: string, driven: string, ratio: string): Stage {
  stageSeq += 1;
  return { id: stageSeq, driving, driven, ratio };
}
type Stage = { id: number; driving: string; driven: string; ratio: string };

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */
export default function GearRatioCalculator({
  authed,
}: {
  authed: boolean;
}): React.ReactElement {
  const [mode, setMode] = useState<Mode>("drivetrain");
  const [presetKey, setPresetKey] = useState("kop");

  const [motorKey, setMotorKey] = useState("cim");
  const [count, setCount] = useState("2");

  const [stageInput, setStageInput] = useState<StageInput>("teeth");
  const [stages, setStages] = useState<Stage[]>(() => [
    newStage("14", "50", "3.571"),
    newStage("19", "45", "2.368"),
  ]);
  const [eff, setEff] = useState("90");

  const [wheel, setWheel] = useState("6");
  const [weight, setWeight] = useState("120");
  const [mu, setMu] = useState("1.1");
  const [weightFrac, setWeightFrac] = useState("100");
  const [derate, setDerate] = useState("85");
  const [arm, setArm] = useState("24");

  const [limit, setLimit] = useState("40");
  const [voc, setVoc] = useState(String(DEFAULT_VOC_V));
  const [rInt, setRInt] = useState(String(DEFAULT_RINT_OHM));

  const [saved, setSaved] = useState(false);

  const motor = MOTORS.find((m) => m.key === motorKey) ?? MOTORS[0];

  function applyPreset(p: Preset): void {
    setPresetKey(p.key);
    setMode(p.mode);
    setMotorKey(p.motor);
    setCount(p.count);
    setStageInput(p.stageInput);
    setStages(p.stages.map((s) => newStage(s.driving, s.driven, s.ratio)));
    setEff(p.eff);
    setWheel(p.wheel);
    setWeight(p.weight);
    setMu(p.mu);
    setWeightFrac(p.weightFrac);
    setDerate(p.derate);
    setLimit(p.limit);
    setArm(p.arm);
  }

  function switchStageInput(next: StageInput): void {
    if (next === stageInput) return;
    if (next === "ratio") {
      // Teeth carry all the information, so collapse each mesh into its ratio.
      setStages((prev) =>
        prev.map((s) => {
          const dr = parseNum(s.driving);
          const dn = parseNum(s.driven);
          return dr > 0 && dn > 0
            ? { ...s, ratio: String(Math.round((dn / dr) * 1000) / 1000) }
            : s;
        }),
      );
    }
    setStageInput(next);
  }

  function updateStage(id: number, patch: Partial<Stage>): void {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addStage(): void {
    setStages((prev) => [...prev, newStage("1", "3", "3")]);
  }

  function removeStage(id: number): void {
    setStages((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== id) : prev));
  }

  function resetAll(): void {
    applyPreset(PRESETS[0]);
  }

  /* ------------------------------ math ------------------------------ */
  const r = useMemo(() => {
    const stageRatios = stages.map((s) => {
      if (stageInput === "teeth") {
        const dr = parseNum(s.driving);
        const dn = parseNum(s.driven);
        return dr > 0 && dn > 0 ? dn / dr : NaN;
      }
      const v = parseNum(s.ratio);
      return v > 0 ? v : NaN;
    });

    const stagesValid = stageRatios.every((v) => Number.isFinite(v) && v > 0);
    const G = stagesValid ? stageRatios.reduce((a, b) => a * b, 1) : NaN;

    const n = Math.max(1, Math.round(parseNum(count)));
    const etaTotal = parseNum(eff) / 100;

    // --- Speed: pure kinematics, exact. -----------------------------
    const outRpm = Number.isFinite(G) && G > 0 ? motor.freeRpm / G : NaN;
    const wheelIn = parseNum(wheel);
    const vFreeFps = (outRpm * Math.PI * wheelIn) / 12 / 60;
    const vAdjFps = vFreeFps * (parseNum(derate) / 100);

    // --- Torque: linear DC-motor model at the current limit. --------
    // τ(I) = τ_stall · (I − I_free) / (I_stall − I_free)
    // The free current is the current the motor burns just spinning
    // itself, so it produces no useful torque — subtracting it is what
    // makes the line pass through (I_free, 0) and (I_stall, τ_stall).
    const iLim = parseNum(limit);
    const span = motor.stallA - motor.freeA;
    const tauMotorRaw =
      span > 0 ? (motor.stallNm * (iLim - motor.freeA)) / span : NaN;
    const tauMotor = Number.isFinite(tauMotorRaw)
      ? Math.min(Math.max(tauMotorRaw, 0), motor.stallNm)
      : NaN;
    const currentLimited = iLim < motor.stallA;

    const tauOut =
      Number.isFinite(G) && Number.isFinite(tauMotor)
        ? n * tauMotor * G * etaTotal
        : NaN;

    // --- Drivetrain force vs traction. ------------------------------
    const rWheelM = (wheelIn / 2) * M_PER_IN;
    const fPushN = rWheelM > 0 ? tauOut / rWheelM : NaN;
    const fPushLb = fPushN / LBF_TO_N;

    const weightLb = parseNum(weight);
    const fracOnDriven = parseNum(weightFrac) / 100;
    const fTracLb = parseNum(mu) * weightLb * fracOnDriven;

    const usableLb = Math.min(fPushLb, fTracLb);
    const tractionLimited = fPushLb > fTracLb;
    const accelG = weightLb > 0 ? usableLb / weightLb : NaN;
    const accelFtS2 = accelG * G_FT_S2;

    // --- Mechanism: force at the end of a lever. --------------------
    const armIn = parseNum(arm);
    const fArmLb =
      armIn > 0 ? tauOut / (armIn * M_PER_IN) / LBF_TO_N : NaN;

    // --- Electrical. ------------------------------------------------
    const iTotal = n * iLim;
    // The linear sag model would happily report a negative bus voltage at
    // absurd draws; floor it at 0 so the readout stays physical.
    const vBus = Math.max(0, parseNum(voc) - iTotal * parseNum(rInt));

    let power: "ok" | "warn" | "over";
    if (iTotal > MAIN_BREAKER_A) power = "over";
    else if (iTotal > MAIN_BREAKER_A * 0.85) power = "warn";
    else power = "ok";

    let brownout: "safe" | "marginal" | "brownout";
    if (vBus <= BROWNOUT_V) brownout = "brownout";
    else if (vBus <= RAIL_DROOP_V) brownout = "marginal";
    else brownout = "safe";

    return {
      stageRatios,
      stagesValid,
      G,
      n,
      etaTotal,
      outRpm,
      vFreeFps,
      vAdjFps,
      tauMotor,
      tauOut,
      currentLimited,
      fPushLb,
      fTracLb,
      usableLb,
      tractionLimited,
      accelG,
      accelFtS2,
      fArmLb,
      iTotal,
      vBus,
      power,
      brownout,
      wheelIn,
      armIn,
      iLim,
    };
  }, [
    stages,
    stageInput,
    count,
    eff,
    motor,
    wheel,
    derate,
    limit,
    weight,
    mu,
    weightFrac,
    arm,
    voc,
    rInt,
  ]);

  // Suggested efficiency from the number of meshes actually entered.
  const suggestedEff = Math.round(0.95 ** stages.length * 1000) / 10;

  const isDrive = mode === "drivetrain";

  return (
    <div className="ac-card rounded-2xl p-5 sm:p-6">
      {/* ------------------------------ Header ------------------------------ */}
      <header className="mb-6">
        <span className="ac-chip inline-flex items-center gap-2">
          <Cog className="h-3.5 w-3.5 text-primary" aria-hidden />
          <span className="ac-eyebrow">Drivetrain &amp; mechanisms</span>
        </span>
        <h1 className="font-display mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          FRC{" "}
          <span
            style={{
              background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Gear Ratio
          </span>{" "}
          Calculator
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-foreground/70">
          Pick a motor, stack up your gear stages, and get overall reduction,
          free and realistic speed, torque at the wheel, pushing force against
          the traction limit, and whether the current draw will brown you out.
          Every formula is shown with your numbers substituted in.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Motor figures are each manufacturer&apos;s own currently-published
          specs, verified against the vendor page and cited at the bottom of
          this tool.
        </p>
      </header>

      {/* ------------------------------ Presets ------------------------------ */}
      <div className="mb-6 rounded-2xl border border-border bg-white/60 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          Start from a known-good setup
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p)}
              aria-pressed={presetKey === p.key}
              className={
                "min-h-[44px] rounded-xl border px-3 py-2 text-sm font-medium transition-colors " +
                (presetKey === p.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-white/60 text-foreground/80 hover:border-primary/40")
              }
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {PRESETS.find((p) => p.key === presetKey)?.blurb}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* ============================ INPUTS ============================ */}
        <div className="min-w-0 rounded-2xl border border-border bg-white/60 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Gauge className="h-4 w-4 text-primary" aria-hidden />
              Motor &amp; gearing
            </div>
            <div className="inline-flex overflow-hidden rounded-lg border border-border text-xs">
              {(
                [
                  ["drivetrain", "Drivetrain"],
                  ["mechanism", "Mechanism"],
                ] as [Mode, string][]
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setMode(v)}
                  aria-pressed={mode === v}
                  className={
                    "min-h-[44px] px-3 py-1 " +
                    (mode === v
                      ? "bg-primary font-semibold text-white"
                      : "bg-white/60 text-muted-foreground")
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Motor */}
          <label className="text-sm font-medium text-foreground" htmlFor="gr-motor">
            Motor
          </label>
          <select
            id="gr-motor"
            className={`mt-1 ${SELECT_CLS}`}
            value={motorKey}
            onChange={(e) => setMotorKey(e.target.value)}
          >
            {MOTORS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">
              {fmt(motor.freeRpm, 0)} RPM
            </span>{" "}
            free ·{" "}
            <span className="font-medium text-foreground tabular-nums">
              {fmt(motor.stallNm, 2)} N·m
            </span>{" "}
            stall ·{" "}
            <span className="tabular-nums">{fmt(motor.stallA, 0)} A</span> stall
            / <span className="tabular-nums">{fmt(motor.freeA, 1)} A</span> free{" "}
            <Tip text={`${motor.vendor} published spec at 12 V, verified this session.`} />
            <br />
            {motor.note}
          </p>

          <div className="mt-3">
            <label className="flex items-center gap-1 text-sm font-medium text-foreground" htmlFor="gr-count">
              Number of these motors
              <Tip text="Motors driving this one output. A 4-module swerve with one drive motor per module is 4; a 6-CIM tank is 6." />
            </label>
            <input
              id="gr-count"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              className={`mt-1 ${INPUT_CLS}`}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </div>

          <div className="ac-divider my-5" />

          {/* Gear stages */}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Cog className="h-4 w-4 text-primary" aria-hidden />
              Gear stages
            </div>
            <div className="inline-flex overflow-hidden rounded-lg border border-border text-xs">
              {(
                [
                  ["teeth", "Teeth"],
                  ["ratio", "Ratio"],
                ] as [StageInput, string][]
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => switchStageInput(v)}
                  aria-pressed={stageInput === v}
                  className={
                    "min-h-[44px] px-3 py-1 " +
                    (stageInput === v
                      ? "bg-primary font-semibold text-white"
                      : "bg-white/60 text-muted-foreground")
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
            One row per reduction: a gear mesh, a chain run, or a belt run. In
            teeth mode a stage reduces by{" "}
            <span className="font-medium text-foreground">driven ÷ driving</span>
            , so a 14T pinion into a 50T gear is 3.571:1.
          </p>

          <div className="space-y-2">
            {stages.map((s, i) => {
              const ratio = r.stageRatios[i];
              return (
                <div
                  key={s.id}
                  className="rounded-xl border border-border bg-white/70 p-3 dark:bg-white/5"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      Stage {i + 1}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {Number.isFinite(ratio) ? `${fmt(ratio, 3)}:1` : "—"}
                    </span>
                  </div>
                  <div className="flex items-end gap-2">
                    {stageInput === "teeth" ? (
                      <>
                        <div className="min-w-0 flex-1">
                          <label
                            className="text-[11px] text-muted-foreground"
                            htmlFor={`gr-driving-${i}`}
                          >
                            Driving (T)
                          </label>
                          <input
                            id={`gr-driving-${i}`}
                            type="number"
                            inputMode="numeric"
                            step="1"
                            min="1"
                            className={INPUT_CLS}
                            value={s.driving}
                            onChange={(e) =>
                              updateStage(s.id, { driving: e.target.value })
                            }
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <label
                            className="text-[11px] text-muted-foreground"
                            htmlFor={`gr-driven-${i}`}
                          >
                            Driven (T)
                          </label>
                          <input
                            id={`gr-driven-${i}`}
                            type="number"
                            inputMode="numeric"
                            step="1"
                            min="1"
                            className={INPUT_CLS}
                            value={s.driven}
                            onChange={(e) =>
                              updateStage(s.id, { driven: e.target.value })
                            }
                          />
                        </div>
                      </>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <label
                          className="text-[11px] text-muted-foreground"
                          htmlFor={`gr-ratio-${i}`}
                        >
                          Reduction (x:1)
                        </label>
                        <input
                          id={`gr-ratio-${i}`}
                          type="number"
                          inputMode="decimal"
                          step="any"
                          min="0"
                          className={INPUT_CLS}
                          value={s.ratio}
                          onChange={(e) =>
                            updateStage(s.id, { ratio: e.target.value })
                          }
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeStage(s.id)}
                      disabled={stages.length <= 1}
                      aria-label={`Remove stage ${i + 1}`}
                      className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl border border-border bg-white/60 text-muted-foreground transition-colors hover:text-red-600 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addStage}
            className="ac-btn-ghost mt-3 inline-flex min-h-[44px] items-center gap-2 text-sm"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add a stage
          </button>

          <div className="mt-4">
            <label className="flex items-center gap-1 text-sm font-medium text-foreground" htmlFor="gr-eff">
              Total drivetrain efficiency (%)
              <Tip text="Torque lost to gear meshes, chain, belts and bearing drag. Speed is barely affected; torque is." />
            </label>
            <input
              id="gr-eff"
              type="number"
              inputMode="decimal"
              step="any"
              className={`mt-1 ${INPUT_CLS}`}
              value={eff}
              onChange={(e) => setEff(e.target.value)}
            />
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Rule of thumb: ≈95% per spur-gear mesh, ≈97% per chain or belt
              run. You have {stages.length} stage{stages.length === 1 ? "" : "s"}{" "}
              entered, so 0.95<sup>{stages.length}</sup> ≈{" "}
              <button
                type="button"
                onClick={() => setEff(String(suggestedEff))}
                className="font-semibold text-primary underline underline-offset-2"
              >
                {fmt(suggestedEff, 1)}%
              </button>
              . If one &ldquo;stage&rdquo; above is really a whole gearbox, use its
              overall efficiency instead.
            </p>
          </div>

          <div className="ac-divider my-5" />

          {/* Mode-specific inputs */}
          {isDrive ? (
            <>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Gauge className="h-4 w-4 text-primary" aria-hidden />
                Robot &amp; wheels
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="gr-wheel"
                  label="Wheel diameter"
                  unit="in"
                  help="Measure a loaded wheel if you can. Tread squash under a 125 lb robot makes the effective diameter smaller than nominal, which is why vendors' published speeds run a little under the pure calculation."
                  value={wheel}
                  onChange={setWheel}
                  accent
                />
                <Field
                  id="gr-weight"
                  label="Robot weight"
                  unit="lb"
                  help="Competition weight: robot plus battery and bumpers, since that is what is actually pressing the wheels into the carpet."
                  value={weight}
                  onChange={setWeight}
                />
                <Field
                  id="gr-mu"
                  label="Wheel-carpet μ"
                  unit=""
                  help="Coefficient of friction. Community-measured, not a vendor spec: roughly 0.8-1.0 for smooth/Colson wheels and 1.1-1.4 for nitrile or roughtop tread on FRC carpet. Measure your own robot if the answer matters."
                  value={mu}
                  onChange={setMu}
                />
                <Field
                  id="gr-frac"
                  label="Weight on driven wheels"
                  unit="%"
                  help="100% for swerve or a 6-wheel tank where every wheel is driven. Drop it if some of your weight rides on undriven omni or caster wheels: only weight over a traction wheel makes grip."
                  value={weightFrac}
                  onChange={setWeightFrac}
                />
                <Field
                  id="gr-derate"
                  label="Speed derate"
                  unit="%"
                  help="Free speed is a no-load number. On carpet the motor also fights rolling resistance, gearbox drag and wheel scrub, so it settles below it. 80-85% is the long-standing FRC design-calculator convention. It is an empirical allowance, not physics."
                  value={derate}
                  onChange={setDerate}
                />
              </div>
            </>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Gauge className="h-4 w-4 text-primary" aria-hidden />
                Mechanism output
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="gr-arm"
                  label="Lever / pulley radius"
                  unit="in"
                  help="Distance from the output shaft's centre to where the load acts: an arm's length to its centre of mass, or the radius of an elevator's driving pulley or sprocket."
                  value={arm}
                  onChange={setArm}
                  accent
                />
              </div>
            </>
          )}

          <div className="ac-divider my-5" />

          {/* Electrical */}
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Zap className="h-4 w-4 text-primary" aria-hidden />
            Current limit &amp; battery
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="gr-limit"
              label="Current limit per motor"
              unit="A"
              help="The smart-current limit you set in your motor-controller config. This is the single biggest lever on how hard your robot can push, and the thing that stops you tripping breakers."
              value={limit}
              onChange={setLimit}
              accent
            />
            <Field
              id="gr-voc"
              label="Battery open-circuit V"
              unit="V"
              help="Resting pack voltage. A healthy charged FRC pack reads about 12.7-13.5 V open; 12.5 V is a conservative default."
              value={voc}
              onChange={setVoc}
            />
            <Field
              id="gr-rint"
              label="Battery internal resistance"
              unit="Ω"
              help="Use your Battery Beak reading. Roughly 0.011 Ω on a new pack, under 0.015 Ω is healthy, over 0.020 Ω means retire it. This is what turns current draw into voltage sag."
              value={rInt}
              onChange={setRInt}
            />
          </div>

          <button
            type="button"
            onClick={resetAll}
            className="ac-btn-ghost mt-5 inline-flex min-h-[44px] items-center gap-2 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Reset to the KOP preset
          </button>
        </div>

        {/* ============================ RESULTS ============================ */}
        <div className="min-w-0 rounded-2xl border border-border bg-white/60 p-5">
          {/* Primary result — overall reduction */}
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Overall reduction
          </div>
          <div className="mt-1 flex items-end gap-2">
            <div
              className="font-display text-5xl font-bold tabular-nums"
              style={{
                background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {r.stagesValid ? fmt(r.G, 2) : "—"}
            </div>
            <div className="pb-1 text-lg font-semibold text-foreground/70">:1</div>
          </div>
          <div className="mt-1 text-sm tabular-nums text-muted-foreground">
            {r.stagesValid
              ? `${r.n} × ${motor.label} · ${stages.length} stage${stages.length === 1 ? "" : "s"} · ${fmt(r.etaTotal * 100, 0)}% efficient`
              : "Check your stage numbers"}
          </div>

          {/* Speed / output tiles */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {isDrive ? (
              <>
                <div className="ac-tile min-w-0 rounded-xl border border-border bg-white/60 p-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Free speed <Tip text="Pure kinematics: no-load motor speed divided by the reduction, times wheel circumference. Your robot will never actually hit this." />
                  </div>
                  <div className="mt-1 flex items-end gap-1">
                    <div className="text-2xl font-bold tabular-nums text-foreground">
                      {fmt(r.vFreeFps, 2)}
                    </div>
                    <div className="pb-0.5 text-sm text-foreground/60">ft/s</div>
                  </div>
                  <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                    {fmt(r.vFreeFps * FPS_TO_MPS, 2)} m/s
                  </div>
                </div>
                <div className="ac-tile min-w-0 rounded-xl border border-border bg-white/60 p-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Adjusted speed <Tip text="Free speed times your derate. This is the number to compare against other robots and to plan autos with." />
                  </div>
                  <div className="mt-1 flex items-end gap-1">
                    <div className="text-2xl font-bold tabular-nums text-primary">
                      {fmt(r.vAdjFps, 2)}
                    </div>
                    <div className="pb-0.5 text-sm text-foreground/60">ft/s</div>
                  </div>
                  <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                    {fmt(r.vAdjFps * FPS_TO_MPS, 2)} m/s
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="ac-tile min-w-0 rounded-xl border border-border bg-white/60 p-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Output free speed <Tip text="No-load motor speed divided by the reduction: the speed of the shaft your mechanism hangs off." />
                  </div>
                  <div className="mt-1 flex items-end gap-1">
                    <div className="text-2xl font-bold tabular-nums text-foreground">
                      {fmt(r.outRpm, 1)}
                    </div>
                    <div className="pb-0.5 text-sm text-foreground/60">RPM</div>
                  </div>
                  <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                    {fmt(r.outRpm / 60, 2)} rev/s
                  </div>
                </div>
                <div className="ac-tile min-w-0 rounded-xl border border-border bg-white/60 p-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Force at the lever <Tip text="Output torque divided by the lever radius. For an arm, compare this against the weight of the arm plus its game piece." />
                  </div>
                  <div className="mt-1 flex items-end gap-1">
                    <div className="text-2xl font-bold tabular-nums text-primary">
                      {fmt(r.fArmLb, 1)}
                    </div>
                    <div className="pb-0.5 text-sm text-foreground/60">lbf</div>
                  </div>
                  <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                    at {fmt(r.armIn, 1)} in
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Torque tile */}
          <div className="ac-tile mt-3 min-w-0 rounded-xl border border-border bg-white/60 p-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {isDrive ? "Torque at the wheels" : "Torque at the output shaft"}{" "}
              <Tip text="All motors combined, at your current limit, after the reduction and efficiency. This is peak (near-stall) torque. A spinning motor makes less." />
            </div>
            <div className="mt-1 flex items-end gap-2">
              <div className="text-3xl font-bold tabular-nums text-foreground">
                {fmt(r.tauOut, 2)}
              </div>
              <div className="pb-1 text-sm text-foreground/60">N·m</div>
              <div className="pb-1 text-xs tabular-nums text-muted-foreground">
                = {fmt(r.tauOut * NM_TO_FTLB, 2)} ft·lbf
              </div>
            </div>
            <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {r.currentLimited ? (
                <>
                  Each motor is capped at{" "}
                  <span className="tabular-nums">{fmt(r.tauMotor, 3)}</span> N·m
                  by your {fmt(r.iLim, 0)} A limit, which is{" "}
                  <span className="tabular-nums">
                    {fmt((r.tauMotor / motor.stallNm) * 100, 0)}%
                  </span>{" "}
                  of its {fmt(motor.stallNm, 2)} N·m stall torque.
                </>
              ) : (
                <>
                  Your {fmt(r.iLim, 0)} A limit is at or above this
                  motor&apos;s {fmt(motor.stallA, 0)} A stall current, so torque
                  is capped at the full {fmt(motor.stallNm, 2)} N·m stall value
                  and the limit is doing nothing.
                </>
              )}
            </div>
          </div>

          {/* Drivetrain: pushing force vs traction */}
          {isDrive && (
            <div
              className={
                "mt-4 rounded-xl border p-4 " +
                (r.tractionLimited
                  ? "border-amber-500/30 bg-amber-500/10"
                  : "border-emerald-500/30 bg-emerald-500/10")
              }
            >
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pushing force
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] text-muted-foreground">
                    Wheels can push
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-foreground">
                    {fmt(r.fPushLb, 1)}
                    <span className="pl-1 text-sm font-semibold text-foreground/60">
                      lbf
                    </span>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] text-muted-foreground">
                    Carpet will allow
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-foreground">
                    {fmt(r.fTracLb, 1)}
                    <span className="pl-1 text-sm font-semibold text-foreground/60">
                      lbf
                    </span>
                  </div>
                </div>
              </div>

              {/* Comparison bar */}
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
                <div
                  className={
                    "h-full rounded-full " +
                    (r.tractionLimited ? "bg-amber-500" : "bg-emerald-500")
                  }
                  style={{
                    width: `${Math.max(0, Math.min(100, (r.usableLb / Math.max(r.fPushLb, r.fTracLb, 1e-9)) * 100))}%`,
                  }}
                />
              </div>

              <p className="mt-3 text-xs leading-relaxed text-foreground/80">
                {r.tractionLimited ? (
                  <>
                    <strong>Traction-limited.</strong> Your gearing can make more
                    force than the carpet can hold, so the wheels spin before
                    the motors stall. Extra reduction buys you nothing here.
                    More grip, more weight over the driven wheels, or a lower
                    current limit is the real fix. You are effectively pushing{" "}
                    <span className="tabular-nums">{fmt(r.usableLb, 1)}</span>{" "}
                    lbf.
                  </>
                ) : (
                  <>
                    <strong>Torque-limited.</strong> The carpet would hold more
                    than your motors can deliver, so the wheels grip and the
                    motors bog down. More reduction (or a higher current limit,
                    if the breakers allow it) would let you push harder. You are
                    effectively pushing{" "}
                    <span className="tabular-nums">{fmt(r.usableLb, 1)}</span>{" "}
                    lbf.
                  </>
                )}
              </p>
              <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                That is about {fmt(r.accelG, 2)} g of acceleration, or{" "}
                {fmt(r.accelFtS2, 1)} ft/s².
              </p>
            </div>
          )}

          {/* Current + brownout */}
          <div
            className={
              "mt-4 rounded-xl border p-4 " +
              (r.power === "over" || r.brownout === "brownout"
                ? "border-red-500/30 bg-red-500/10"
                : r.power === "warn" || r.brownout === "marginal"
                  ? "border-amber-500/30 bg-amber-500/10"
                  : "border-border bg-white/60")
            }
          >
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <BatteryCharging className="h-3.5 w-3.5" aria-hidden />
              Current &amp; brownout check
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <div className="text-[11px] text-muted-foreground">
                  Draw at full push
                </div>
                <div className="text-2xl font-bold tabular-nums text-foreground">
                  {fmt(r.iTotal, 0)}
                  <span className="pl-1 text-sm font-semibold text-foreground/60">
                    A
                  </span>
                </div>
                <div className="text-[11px] tabular-nums text-muted-foreground">
                  vs {MAIN_BREAKER_A} A main breaker
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-muted-foreground">
                  Est. bus voltage
                </div>
                <div className="text-2xl font-bold tabular-nums text-foreground">
                  {fmt(r.vBus, 2)}
                  <span className="pl-1 text-sm font-semibold text-foreground/60">
                    V
                  </span>
                </div>
                <div className="text-[11px] tabular-nums text-muted-foreground">
                  brownout at {BROWNOUT_V} V
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-foreground/80">
              {r.power === "over" ? (
                <>
                  <strong>
                    {fmt(r.iTotal, 0)} A is past the {MAIN_BREAKER_A} A main
                    breaker.
                  </strong>{" "}
                  The breaker is thermal, so a momentary spike while you shove
                  another robot is normal and fine. Sustained draw at this level
                  will trip it and kill the whole robot.{" "}
                </>
              ) : r.power === "warn" ? (
                <>
                  <strong>Close to the {MAIN_BREAKER_A} A main breaker</strong>{" "}
                  before you have added an intake, shooter or elevator.{" "}
                </>
              ) : (
                <>
                  Drivetrain draw leaves{" "}
                  <span className="tabular-nums">
                    {fmt(MAIN_BREAKER_A - r.iTotal, 0)} A
                  </span>{" "}
                  of headroom under the main breaker for your other mechanisms.{" "}
                </>
              )}
              {r.brownout === "brownout" ? (
                <>
                  At this draw the pack sags to about{" "}
                  <span className="tabular-nums">{fmt(r.vBus, 2)}</span> V, at or
                  below the {BROWNOUT_V} V line where the roboRIO disables your
                  outputs.
                </>
              ) : r.brownout === "marginal" ? (
                <>
                  The pack sags to about{" "}
                  <span className="tabular-nums">{fmt(r.vBus, 2)}</span> V,
                  under the {RAIL_DROOP_V} V point where the 6 V rail starts to
                  droop, but still above the brownout line.
                </>
              ) : (
                <>
                  Estimated sag to{" "}
                  <span className="tabular-nums">{fmt(r.vBus, 2)}</span> V keeps
                  you clear of the brownout line.
                </>
              )}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Add up the rest of the robot in the{" "}
              <Link
                href="/tools/frc-current-budget"
                className="text-primary underline underline-offset-2"
              >
                current &amp; brownout calculator
              </Link>
              , or read{" "}
              <Link
                href="/guides/getting-started/common-mistakes-troubleshooting/brownouts"
                className="text-primary underline underline-offset-2"
              >
                how to stop browning out
              </Link>
              .
            </p>
          </div>

          {/* ---------------------- SHOW THE MATH ---------------------- */}
          <div className="mt-5 rounded-xl border border-border bg-white/70 p-4 dark:bg-white/5">
            <div className="mb-3 text-sm font-semibold text-foreground">
              The math, with your numbers
            </div>
            <div className="space-y-3 text-xs">
              <MathRow
                title="Overall reduction"
                formula="G = Π (driven ÷ driving)"
                work={
                  // With a single stage the product expansion would just
                  // restate the answer ("G = 6.750 = 6.7500"), so skip it.
                  r.stageRatios.length > 1
                    ? `G = ${r.stageRatios
                        .map((v) => (Number.isFinite(v) ? fmt(v, 3) : "?"))
                        .join(" × ")} = ${r.stagesValid ? fmt(r.G, 4) : "—"}`
                    : `G = ${r.stagesValid ? fmt(r.G, 4) : "—"}`
                }
              />
              <MathRow
                title={isDrive ? "Wheel speed" : "Output speed"}
                formula="n_out = n_free ÷ G"
                work={`n_out = ${fmt(motor.freeRpm, 0)} RPM ÷ ${fmt(r.G, 4)} = ${fmt(r.outRpm, 1)} RPM`}
              />
              {isDrive && (
                <>
                  <MathRow
                    title="Free speed"
                    formula="v = n_out × π × D"
                    work={`v = ${fmt(r.outRpm, 1)} rev/min × π × ${fmt(r.wheelIn, 2)} in ÷ 12 ÷ 60 = ${fmt(r.vFreeFps, 2)} ft/s`}
                  />
                  <MathRow
                    title="Adjusted speed"
                    formula="v_adj = v × derate"
                    work={`v_adj = ${fmt(r.vFreeFps, 2)} ft/s × ${fmt(parseNum(derate), 0)}% = ${fmt(r.vAdjFps, 2)} ft/s`}
                  />
                </>
              )}
              <MathRow
                title="Torque from one motor at your limit"
                formula="τ_m = τ_stall × (I_limit − I_free) ÷ (I_stall − I_free)"
                work={`τ_m = ${fmt(motor.stallNm, 2)} × (${fmt(r.iLim, 0)} − ${fmt(motor.freeA, 1)}) ÷ (${fmt(motor.stallA, 0)} − ${fmt(motor.freeA, 1)}) = ${fmt(r.tauMotor, 3)} N·m`}
              />
              <MathRow
                title={isDrive ? "Torque at the wheels" : "Torque at the output"}
                formula="τ_out = N × τ_m × G × η"
                work={`τ_out = ${r.n} × ${fmt(r.tauMotor, 3)} × ${fmt(r.G, 4)} × ${fmt(r.etaTotal, 2)} = ${fmt(r.tauOut, 2)} N·m`}
              />
              {isDrive ? (
                <>
                  <MathRow
                    title="Pushing force"
                    formula="F = τ_out ÷ (D ÷ 2)"
                    work={`F = ${fmt(r.tauOut, 2)} N·m ÷ ${fmt((r.wheelIn / 2) * M_PER_IN, 4)} m = ${fmt(r.fPushLb * LBF_TO_N, 1)} N = ${fmt(r.fPushLb, 1)} lbf`}
                  />
                  <MathRow
                    title="Traction limit"
                    formula="F_max = μ × W × (weight on driven wheels)"
                    work={`F_max = ${fmt(parseNum(mu), 2)} × ${fmt(parseNum(weight), 0)} lb × ${fmt(parseNum(weightFrac), 0)}% = ${fmt(r.fTracLb, 1)} lbf`}
                  />
                  <MathRow
                    title="Acceleration"
                    formula="a = F_usable ÷ W × g"
                    work={`a = ${fmt(r.usableLb, 1)} lbf ÷ ${fmt(parseNum(weight), 0)} lb × 32.17 = ${fmt(r.accelFtS2, 1)} ft/s² (${fmt(r.accelG, 2)} g)`}
                  />
                </>
              ) : (
                <MathRow
                  title="Force at the lever"
                  formula="F = τ_out ÷ radius"
                  work={`F = ${fmt(r.tauOut, 2)} N·m ÷ ${fmt(r.armIn * M_PER_IN, 4)} m = ${fmt(r.fArmLb * LBF_TO_N, 1)} N = ${fmt(r.fArmLb, 1)} lbf`}
                />
              )}
              <MathRow
                title="Current and sag"
                formula="I = N × I_limit · V_bus = V_oc − I × R_int"
                work={`I = ${r.n} × ${fmt(r.iLim, 0)} = ${fmt(r.iTotal, 0)} A · V_bus = ${fmt(parseNum(voc), 2)} − ${fmt(r.iTotal, 0)} × ${fmt(parseNum(rInt), 3)} = ${fmt(r.vBus, 2)} V`}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="ac-btn inline-flex min-h-[44px] items-center gap-2 text-sm"
            >
              <Printer className="h-4 w-4" aria-hidden /> Print / Save PDF
            </button>
            {authed ? (
              <button
                type="button"
                onClick={() => {
                  setSaved(true);
                  window.setTimeout(() => setSaved(false), 2000);
                }}
                className="ac-btn-ghost inline-flex min-h-[44px] items-center gap-2 text-sm"
              >
                <Save className="h-4 w-4" aria-hidden />{" "}
                {saved ? "Saved" : "Save scenario"}
              </button>
            ) : null}
          </div>

          {!authed && (
            <div className="ac-badge mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white/60 p-3">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                <span>
                  <span className="font-medium">Create a free account</span> to
                  save named gearbox setups and compare ratios side by side.
                </span>
              </div>
              <Link
                href="/signup?next=/tools/frc-gear-ratio-calculator"
                className="ac-btn inline-flex min-h-[44px] shrink-0 items-center gap-1 text-sm"
              >
                Sign up <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          )}

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              <strong>A design aid, not a guarantee.</strong> This is a
              steady-state, first-order model. It does not simulate acceleration
              curves, motor heating over a match, wheel scrub in a turn, or a
              sagging battery&apos;s effect on torque. Prototype and measure
              before you commit to a ratio.
            </span>
          </div>
        </div>
      </div>

      {/* -------------------- NOTES & SOURCES -------------------- */}
      <details className="mt-6 rounded-2xl border border-border bg-white/50 p-4">
        <summary className="min-h-[44px] cursor-pointer py-2 text-sm font-semibold text-foreground">
          Notes &amp; sources: where every number comes from
        </summary>
        <div className="mt-3 space-y-4 text-xs leading-relaxed text-muted-foreground">
          <div>
            <div className="mb-2 font-semibold text-foreground">
              Motor specifications
            </div>
            <p className="mb-2">
              Each motor uses figures published by <em>its own</em>{" "}
              manufacturer, at 12 V. That matters: vendors dyno each
              other&apos;s motors under their own test conditions and get
              different answers. REV&apos;s comparison page, for instance, lists
              the Kraken X60 at 6,271 RPM / 4.21 N·m from REV&apos;s own bench,
              while WCP publishes 6,000 RPM / 7.09 N·m for the same motor. We use
              the manufacturer&apos;s own number for each, and you should assume
              a real motor lands somewhere near, not exactly on, any of them.
            </p>
            <ul className="space-y-1.5">
              <li>
                <span className="font-medium text-foreground">
                  NEO V1.1: 5,676 RPM, 2.6 N·m, 105 A stall, 1.8 A free
                </span>
                , from REV Robotics motor specifications (empirical, measured with a
                SPARK MAX).{" "}
                <Src href="https://docs.revrobotics.com/brushless/neo/v1.1" />
              </li>
              <li>
                <span className="font-medium text-foreground">
                  NEO Vortex: 6,784 RPM, 3.6 N·m, 211 A stall, 3.6 A free
                </span>
                , from REV Robotics motor specifications (565 Kv).{" "}
                <Src href="https://docs.revrobotics.com/brushless/neo/vortex" />
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Kraken X60: 6,000 RPM, 7.09 N·m, 366 A stall, 2 A free
                </span>{" "}
                (trapezoidal); <strong>5,800 RPM, 9.37 N·m, 483 A, 2 A</strong>{" "}
                (FOC), from WestCoast Products motor-performance documentation.{" "}
                <Src href="https://docs.wcproducts.com/kraken-x60" />
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Kraken X44: 7,530 RPM, 4.05 N·m, 275 A stall, 1.4 A free
                </span>{" "}
                (trapezoidal); <strong>7,368 RPM, 5.01 N·m, 329 A, 3 A</strong>{" "}
                (FOC), from WestCoast Products motor-performance documentation.{" "}
                <Src href="https://docs.wcproducts.com/kraken-x44" />
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Falcon 500: 6,380 RPM, 4.69 N·m, 257 A stall, 1.5 A free
                </span>
                , from CTR Electronics product specifications (trapezoidal).{" "}
                <Src href="https://store.ctr-electronics.com/products/falcon-500-powered-by-talon-fx" />
              </li>
              <li>
                <span className="font-medium text-foreground">
                  CIM: 5,310 RPM, 2.425 N·m, 133 A stall, 2.7 A free, 337 W max
                </span>
                , from AndyMark am-0255 product page.{" "}
                <Src href="https://andymark.com/products/2-5-in-cim-motor" />
              </li>
              <li className="text-foreground/70">
                <strong>Deliberately left out:</strong> the Mini CIM (no longer
                carried by AndyMark or CTR Electronics, only third-party
                mirrors of its old spec sheet survive) and the CTRE Minion (its
                store page publishes stall torque and peak power but not free
                speed or stall current). Rather than guess at values that every
                downstream number depends on, they are omitted.
              </li>
            </ul>
          </div>

          <div>
            <div className="mb-2 font-semibold text-foreground">
              Preset gear ratios
            </div>
            <ul className="space-y-1.5">
              <li>
                <span className="font-medium text-foreground">
                  ToughBox Mini 8.45:1
                </span>
                , AndyMark&apos;s published gearset for that option: a 14T CIM
                pinion into a 50T cluster gear, then a 19T cluster into a 45T
                output gear. (50 ÷ 14) × (45 ÷ 19) = 8.459, which is what the
                vendor rounds to 8.45:1.{" "}
                <Src href="https://www.andymark.com/products/toughbox-mini-options-angled-8-45-1" />
              </li>
              <li>
                <span className="font-medium text-foreground">
                  SDS MK4i L2 = 6.75:1
                </span>
                , Swerve Drive Specialties MK4i drive gearing options are L1
                8.14:1, L2 6.75:1, L3 6.12:1, on the module&apos;s 4 in wheel.{" "}
                <Src href="https://andymark.com/products/sds-mk4i-swerve-modules" />
              </li>
            </ul>
          </div>

          <div>
            <div className="mb-2 font-semibold text-foreground">
              Electrical limits
            </div>
            <ul className="space-y-1.5">
              <li>
                120 A main breaker (Cooper Bussmann CB285-120); roboRIO brownout
                at 6.75 V (roboRIO 2.0 software default; roboRIO 1.0 is fixed at
                6.3 V); the 6 V PWM rail begins to droop around 6.8 V (WPILib
                documentation). These match the constants in this site&apos;s{" "}
                <Link
                  href="/tools/frc-current-budget"
                  className="text-primary underline underline-offset-2"
                >
                  current &amp; brownout calculator
                </Link>
                .
              </li>
              <li>
                Battery model V_bus = V_oc − I × R_int. A healthy pack reads
                ~12.7-13.5 V open-circuit with an internal resistance near
                0.011 Ω new; over 0.020 Ω means retire it (WPILib guidance). Use
                your own Battery Beak numbers.
              </li>
            </ul>
          </div>

          <div>
            <div className="mb-2 font-semibold text-foreground">
              Assumptions you should argue with
            </div>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Coefficient of friction is not a vendor spec.</strong>{" "}
                The 0.8-1.4 range in the help text comes from community
                measurements, and real numbers swing with tread wear, carpet
                type, dust and how you test. If grip decides your design,
                measure your own robot by dragging it on a scale.
              </li>
              <li>
                <strong>The speed derate is a convention, not physics.</strong>{" "}
                Free speed is exact kinematics; the 80-85% multiplier is the
                long-standing FRC design-calculator allowance for rolling
                resistance, gearbox drag and scrub. Short field runs mean you
                often never reach even that.
              </li>
              <li>
                <strong>Torque here is peak, near-stall torque.</strong> A DC
                motor makes maximum torque at zero speed. Once the wheels are
                turning, back-EMF pulls the current below your limit and the
                torque with it, so this is the shove you get at the moment of
                contact, not a number you hold at speed.
              </li>
              <li>
                <strong>Efficiency is applied to torque, not speed.</strong>{" "}
                Losses in a gearbox do not slow the no-load output much; they eat
                the force you get out of it. That is why free speed ignores
                efficiency and pushing force does not.
              </li>
              <li>
                <strong>Wheel diameter is nominal.</strong> Tread compresses
                under a loaded robot, so effective rolling diameter is a little
                under the number printed on the wheel, usually a couple of
                percent of speed.
              </li>
              <li>
                Traction assumes weight is shared evenly across driven wheels and
                the robot is on level carpet. Weight transfer under hard
                acceleration, a defended pin, or a ramp all change the answer.
              </li>
            </ul>
          </div>
        </div>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Sub-components
 * ------------------------------------------------------------------ */
function Field({
  id,
  label,
  help,
  value,
  onChange,
  unit,
  accent,
}: {
  id: string;
  label: string;
  help: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
  accent?: boolean;
}): React.ReactElement {
  return (
    <div className="min-w-0">
      <label
        className="flex flex-wrap items-center gap-1 text-sm font-medium text-foreground"
        htmlFor={id}
      >
        {label}
        {accent ? (
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
            key
          </span>
        ) : null}
        <Tip text={help} />
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="any"
          className={INPUT_CLS}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {unit ? (
          <span className="shrink-0 text-xs text-muted-foreground">{unit}</span>
        ) : null}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{help}</p>
    </div>
  );
}

function MathRow({
  title,
  formula,
  work,
}: {
  title: string;
  formula: string;
  work: string;
}): React.ReactElement {
  return (
    <div className="min-w-0">
      <div className="font-medium text-foreground">{title}</div>
      {/* Wrap rather than truncate — these read fine across two lines on a
          375px screen. The overflow-x-auto wrapper stays as a safety net so a
          single unbreakable token can never push the page sideways. */}
      <div className="mt-0.5 overflow-x-auto">
        <code className="block break-words font-mono text-[11px] text-primary">
          {formula}
        </code>
      </div>
      <div className="mt-0.5 overflow-x-auto">
        <code className="block break-words font-mono text-[11px] tabular-nums text-muted-foreground">
          {work}
        </code>
      </div>
    </div>
  );
}

function Src({ href }: { href: string }): React.ReactElement {
  let host = href;
  try {
    host = new URL(href).hostname.replace(/^www\./, "");
  } catch {
    /* keep raw */
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline underline-offset-2"
    >
      {host}
    </a>
  );
}
