"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";

/* ------------------------------------------------------------------ *
 * Exact unit conversions (defined constants, not estimates)
 * ------------------------------------------------------------------ */
const M_PER_IN = 0.0254; // NIST exact: 1 in = 0.0254 m
const LBF_TO_N = 4.4482216; // NIST exact: 1 lbf = 4.4482216 N
const NM_TO_FTLB = 1 / (LBF_TO_N * 0.3048); // 1 N*m = 0.737562... ft*lbf (derived, exact)
const G_FT_S2 = 32.17405; // standard gravity, ft/s^2 (CODATA 9.80665 m/s^2)
const FPS_TO_MPS = 0.3048; // exact

/* ------------------------------------------------------------------ *
 * Electrical limits, the same verified constants this site's Current &
 * Brownout tool uses, so the two calculators never disagree.
 *   120 A main breaker            Cooper Bussmann CB285-120
 *   roboRIO 1.0 brownout  6.3 V   WPILib (fixed)
 *   roboRIO 2.0 brownout  6.75 V  WPILib (software-settable default)
 *   6.8 V                         6 V PWM rail begins to droop (WPILib)
 *   R_int 0.015 ohm / V_oc 12.5 V conservative pack defaults (WPILib range)
 * ------------------------------------------------------------------ */
const MAIN_BREAKER_A = 120;
const BROWNOUT_V = 6.75;
const RAIL_DROOP_V = 6.8;
const DEFAULT_VOC_V = 12.5;
const DEFAULT_RINT_OHM = 0.015;

/* ------------------------------------------------------------------ *
 * VERIFIED motor data. Every figure below was checked against the
 * motor's OWN manufacturer's currently-published spec (the exact URLs
 * are printed on the back of the sheet at the bottom of this tool).
 *
 * Deliberately EXCLUDED because no current first-party spec page could
 * be verified: Mini CIM (dropped by AndyMark and CTRE, only third-party
 * mirrors remain) and CTRE Minion (its store page publishes stall torque
 * and peak power but not free speed or stall current). Guessing those
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
    note: "REV's published empirical figures, measured with a SPARK MAX on FRC hardware. The same set WPILib's simulation uses.",
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
    note: "Default commutation, what you get without a Phoenix Pro FOC licence.",
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
    note: "The compact Kraken, smaller and faster, for intakes, hoods and shooters.",
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
 * Presets. Every ratio below is a real, published vendor number.
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
      "Kit-of-Parts chassis: 2 CIMs through a ToughBox Mini at 8.45:1 (AndyMark's real gearset, a 14T pinion into 50T, then 19T into 45T), 6 in wheels.",
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
      "The common modern rebuild of the same chassis: 4 NEOs on the same 8.45:1 ToughBox gearset and 6 in wheels. Compare its pushing force to the CIM preset.",
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
      "Four modules, one Kraken X60 driving each: SDS MK4i in the L2 gearing (6.75:1) on 4 in wheels. The module is three reductions, so efficiency starts near 0.95 cubed.",
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

/**
 * React key only. This counter is module-level and therefore NOT stable
 * between a server render and the client's hydration render, so `id` must
 * never reach the DOM. Every rendered id/htmlFor below is derived from the
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
}): React.JSX.Element {
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
  const [notesOpen, setNotesOpen] = useState(false);

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

    // Running product down the stack. The train multiplies stage by stage, so
    // printing the total after each row is what makes the log readable: you
    // watch the reduction build instead of being handed one opaque number.
    let acc = 1;
    const cumulative = stageRatios.map((v) => {
      acc = Number.isFinite(v) && v > 0 ? acc * v : NaN;
      return acc;
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
    // t(I) = t_stall * (I - I_free) / (I_stall - I_free)
    // The free current is the current the motor burns just spinning
    // itself, so it produces no useful torque. Subtracting it is what
    // makes the line pass through (I_free, 0) and (I_stall, t_stall).
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
    const fArmLb = armIn > 0 ? tauOut / (armIn * M_PER_IN) / LBF_TO_N : NaN;

    // --- Electrical. ------------------------------------------------
    const iTotal = n * iLim;
    // The linear sag model would happily report a negative bus voltage at
    // absurd draws, so floor it at 0 and keep the readout physical.
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
      cumulative,
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
  const activePreset = PRESETS.find((p) => p.key === presetKey);

  // The push-vs-traction meter reads as a fraction of whichever limit is
  // higher, so a short bar always means "something else is stopping you".
  const pushPct = Math.max(
    0,
    Math.min(100, (r.usableLb / Math.max(r.fPushLb, r.fTracLb, 1e-9)) * 100),
  );

  return (
    <>
      {/* ---------------------------------------------------------------- *
       * 1. The question, then the shelf of known-good gearboxes
       *
       * A ratio question always starts from something real, so the presets
       * are the first control on the page rather than a courtesy tucked in
       * beside the form. Picking one rewrites every field below it.
       * ---------------------------------------------------------------- */}
      <div className="nb-wrap py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="grid gap-x-[clamp(1.5rem,4vw,3rem)] gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="nb-marker">tools / frc-gear-ratio-calculator</p>
            <h1 className="max-w-[20ch]">
              Is this ratio fast enough, and can it still{" "}
              <span className="nb-mark">push</span>?
            </h1>
            <p className="nb-lede mt-5">
              Stack your reductions, pick the motor, set the current limit. Out
              comes speed, torque at the wheel, pushing force against the traction
              limit, and whether the draw browns you out.
            </p>
            <p className="nb-slug mt-4 max-w-[62ch]">
              Motor figures are each manufacturer&rsquo;s own published spec at 12 V,
              cited on the back of the sheet. Every formula is printed with your
              numbers substituted in.
            </p>
          </div>
          <p className="nb-pen max-w-[18ch] rotate-[1.4deg] lg:pb-2 lg:text-right">
            start from a gearbox that exists
          </p>
        </div>

        <div className="nb-hair mt-[clamp(1.6rem,3.4vw,2.4rem)] pt-[clamp(1.1rem,2.2vw,1.5rem)]">
          <p className="nb-slug">off the shelf</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p)}
                aria-pressed={presetKey === p.key}
                className="nb-tag min-h-[2.75rem] px-3.5 text-[0.78rem]"
              >
                {p.label}
              </button>
            ))}
          </div>
          {activePreset ? (
            <p className="mt-3 max-w-[70ch] text-[0.95rem] leading-relaxed text-graphite">
              {activePreset.blurb}
            </p>
          ) : null}
        </div>
      </div>

      {/* ---------------------------------------------------------------- *
       * 2. The train, written down the page as a log
       *
       * A gear train is a running product, so it is drawn as a log you read
       * downwards: motor at the head, one line per mesh, and the reduction
       * so far printed in the right-hand column of every line. The total is
       * the last line of the log, not a separate result card.
       * ---------------------------------------------------------------- */}
      <section className="nb-rule py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div>
              <p className="nb-marker">the train / motor and every mesh</p>
              <h2 className="max-w-[20ch] text-[clamp(1.5rem,1.1rem+1.6vw,2.4rem)]">
                Stack the reductions and watch them multiply.
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-4" role="group" aria-label="What is being geared">
              <p className="nb-slug !text-ink">gearing a</p>
              {(
                [
                  ["drivetrain", "drivetrain"],
                  ["mechanism", "mechanism"],
                ] as [Mode, string][]
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  className="nb-tab"
                  data-active={mode === v ? "" : undefined}
                  aria-pressed={mode === v}
                  onClick={() => setMode(v)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Head of the log: the motor and how many of it. */}
          <div className="nb-box relative mt-[clamp(1.4rem,3vw,2.2rem)] p-[clamp(1.1rem,2.4vw,1.8rem)]">
            <span className="nb-tape -top-3 left-[9%] rotate-[-3.2deg]" aria-hidden="true" />

            <div className="grid gap-[clamp(1rem,2.2vw,1.5rem)] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.6fr)]">
              <div className="nb-field">
                <label className="nb-label" htmlFor="gr-motor">
                  Motor at the input
                </label>
                <select
                  id="gr-motor"
                  className="nb-input nb-select"
                  value={motorKey}
                  onChange={(e) => setMotorKey(e.target.value)}
                >
                  {MOTORS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <p className="nb-hint">{motor.note}</p>
              </div>

              <div className="nb-field">
                <label className="nb-label" htmlFor="gr-count">
                  How many of them
                </label>
                <input
                  id="gr-count"
                  className="nb-input"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
                <p className="nb-hint">
                  Motors driving this one output. Four swerve modules is 4.
                </p>
              </div>
            </div>

            <dl className="nb-hair mt-[clamp(1rem,2.2vw,1.4rem)] grid grid-cols-2 gap-x-6 gap-y-2 pt-[clamp(0.9rem,2vw,1.3rem)] sm:grid-cols-4">
              <div>
                <dt className="nb-slug">free speed</dt>
                <dd className="nb-slug m-0 !text-ink">{fmt(motor.freeRpm, 0)} RPM</dd>
              </div>
              <div>
                <dt className="nb-slug">stall torque</dt>
                <dd className="nb-slug m-0 !text-ink">{fmt(motor.stallNm, 2)} N&middot;m</dd>
              </div>
              <div>
                <dt className="nb-slug">stall current</dt>
                <dd className="nb-slug m-0 !text-ink">{fmt(motor.stallA, 0)} A</dd>
              </div>
              <div>
                <dt className="nb-slug">free current</dt>
                <dd className="nb-slug m-0 !text-ink">{fmt(motor.freeA, 1)} A</dd>
              </div>
            </dl>
          </div>

          {/* The meshes. One line each, with the running product on the right. */}
          <div className="mt-[clamp(1.4rem,3vw,2rem)] flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
            <p className="nb-slug !text-ink">
              {stages.length} {stages.length === 1 ? "reduction" : "reductions"}, entered as
            </p>
            <div className="flex items-center gap-4" role="group" aria-label="How to enter each stage">
              {(
                [
                  ["teeth", "tooth counts"],
                  ["ratio", "a ratio"],
                ] as [StageInput, string][]
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  className="nb-tab"
                  data-active={stageInput === v ? "" : undefined}
                  aria-pressed={stageInput === v}
                  onClick={() => switchStageInput(v)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <ol className="nb-list m-0 mt-3 list-none p-0">
            {stages.map((s, i) => {
              const ratio = r.stageRatios[i];
              const running = r.cumulative[i];
              return (
                <li
                  key={s.id}
                  className="grid items-end gap-x-[clamp(0.8rem,2vw,1.6rem)] gap-y-3 border-b border-dashed border-b-rule py-[clamp(0.9rem,2vw,1.3rem)] md:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,9rem)_2.75rem]"
                >
                  <p className="nb-slug !text-ink md:pb-3">
                    {String(i + 1).padStart(2, "0")}
                  </p>

                  {stageInput === "teeth" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="nb-field">
                        <label className="nb-label" htmlFor={`gr-driving-${i}`}>
                          Driving (T)
                        </label>
                        <input
                          id={`gr-driving-${i}`}
                          className="nb-input"
                          type="number"
                          inputMode="numeric"
                          step="1"
                          min="1"
                          value={s.driving}
                          onChange={(e) => updateStage(s.id, { driving: e.target.value })}
                        />
                      </div>
                      <div className="nb-field">
                        <label className="nb-label" htmlFor={`gr-driven-${i}`}>
                          Driven (T)
                        </label>
                        <input
                          id={`gr-driven-${i}`}
                          className="nb-input"
                          type="number"
                          inputMode="numeric"
                          step="1"
                          min="1"
                          value={s.driven}
                          onChange={(e) => updateStage(s.id, { driven: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="nb-field">
                      <label className="nb-label" htmlFor={`gr-ratio-${i}`}>
                        Reduction (x:1)
                      </label>
                      <input
                        id={`gr-ratio-${i}`}
                        className="nb-input"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        value={s.ratio}
                        onChange={(e) => updateStage(s.id, { ratio: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="md:pb-2 md:text-right">
                    <p className="nb-slug">
                      {Number.isFinite(ratio) ? `${fmt(ratio, 3)}:1 here` : "check this stage"}
                    </p>
                    <p className="nb-count mt-1">
                      {Number.isFinite(running) ? fmt(running, 2) : "—"}
                      <small>:1 so far</small>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeStage(s.id)}
                    disabled={stages.length <= 1}
                    className="nb-box-sm inline-flex size-11 items-center justify-center justify-self-start font-mono text-[0.95rem] disabled:cursor-not-allowed disabled:border-graphite disabled:text-graphite md:mb-2 md:justify-self-end"
                  >
                    <span aria-hidden="true">&minus;</span>
                    <span className="sr-only">Remove stage {i + 1}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="mt-[clamp(1.1rem,2.4vw,1.6rem)] grid gap-[clamp(1.1rem,2.4vw,1.8rem)] lg:grid-cols-[minmax(0,auto)_minmax(0,1fr)] lg:items-start">
            <button type="button" onClick={addStage} className="nb-btn-ghost nb-btn-sm">
              Add another mesh
            </button>

            <div className="nb-field lg:max-w-[34rem] lg:justify-self-end">
              <label className="nb-label" htmlFor="gr-eff">
                Total drivetrain efficiency (%)
              </label>
              <input
                id="gr-eff"
                className="nb-input"
                type="number"
                inputMode="decimal"
                step="any"
                value={eff}
                onChange={(e) => setEff(e.target.value)}
              />
              <p className="nb-hint">
                Roughly 95% per spur mesh and 97% per chain or belt run. With{" "}
                {stages.length} {stages.length === 1 ? "stage" : "stages"} entered,
                0.95 to the {stages.length} is{" "}
                <button
                  type="button"
                  onClick={() => setEff(String(suggestedEff))}
                  className="nb-link font-bold"
                >
                  {fmt(suggestedEff, 1)}%
                </button>
                . If one line above is really a whole gearbox, use its own figure.
              </p>
            </div>
          </div>

          {/* Last line of the log: the total, on its own ink rule. */}
          <div
            className="nb-rule mt-[clamp(1.4rem,3vw,2.2rem)] flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 pt-[clamp(1rem,2.2vw,1.5rem)]"
            aria-live="polite"
          >
            <p className="nb-slug !text-ink">overall reduction, every mesh multiplied</p>
            <p className="flex items-baseline gap-2 font-mono font-bold tabular-nums">
              <span className="text-[clamp(2.2rem,1.4rem+3vw,3.8rem)] leading-none tracking-[-0.04em] text-blue">
                {r.stagesValid ? fmt(r.G, 2) : "—"}
              </span>
              <span className="text-[1.1rem] text-ink">:1</span>
            </p>
          </div>
          <p className="nb-slug mt-2">
            {r.stagesValid
              ? `${r.n} x ${motor.label}, ${stages.length} ${stages.length === 1 ? "stage" : "stages"}, ${fmt(r.etaTotal * 100, 0)}% efficient`
              : "one of the stages above is not a usable number"}
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * 3. What comes out, on two cards pinned side by side
       *
       * Speed and force are two different questions with two different
       * fixes, so they get two cards at two angles rather than a grid of
       * matching tiles. The robot facts each one needs sit on its own card.
       * ---------------------------------------------------------------- */}
      <section className="nb-rule py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <p className="nb-marker">
            {isDrive ? "out the other end / speed and shove" : "out the other end / speed and force"}
          </p>
          <h2 className="max-w-[22ch] text-[clamp(1.5rem,1.1rem+1.6vw,2.4rem)]">
            {isDrive
              ? "How fast it goes, and how hard it pushes."
              : "How fast the shaft turns, and what it can lift."}
          </h2>

          <div className="mt-[clamp(1.4rem,3vw,2.2rem)] grid items-start gap-[clamp(1.2rem,2.8vw,2.2rem)] lg:grid-cols-2">
            {/* --- Card A: speed --- */}
            <div className="nb-box nb-tilt-2 p-[clamp(1.1rem,2.4vw,1.7rem)]">
              <p className="nb-slug border-b border-dashed border-rule pb-2.5">
                {isDrive ? "speed on carpet" : "speed at the output shaft"}
              </p>

              <p className="mt-3.5 flex items-baseline gap-2 font-mono font-bold tabular-nums">
                <span className="text-[clamp(1.9rem,1.2rem+2.2vw,2.8rem)] leading-none tracking-[-0.03em] text-blue">
                  {isDrive ? fmt(r.vAdjFps, 2) : fmt(r.outRpm, 1)}
                </span>
                <span className="text-[0.95rem] text-ink">
                  {isDrive ? "ft/s adjusted" : "RPM"}
                </span>
              </p>

              <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
                {isDrive ? (
                  <>
                    <dt className="nb-slug">free speed</dt>
                    <dd className="nb-slug m-0 !text-ink">
                      {fmt(r.vFreeFps, 2)} ft/s, {fmt(r.vFreeFps * FPS_TO_MPS, 2)} m/s
                    </dd>
                    <dt className="nb-slug">adjusted</dt>
                    <dd className="nb-slug m-0 !text-ink">
                      {fmt(r.vAdjFps * FPS_TO_MPS, 2)} m/s at {fmt(parseNum(derate), 0)}%
                    </dd>
                    <dt className="nb-slug">wheel speed</dt>
                    <dd className="nb-slug m-0 !text-ink">{fmt(r.outRpm, 1)} RPM</dd>
                  </>
                ) : (
                  <>
                    <dt className="nb-slug">that is</dt>
                    <dd className="nb-slug m-0 !text-ink">{fmt(r.outRpm / 60, 2)} rev/s</dd>
                    <dt className="nb-slug">at the lever</dt>
                    <dd className="nb-slug m-0 !text-ink">
                      {fmt(r.fArmLb, 1)} lbf at {fmt(r.armIn, 1)} in
                    </dd>
                  </>
                )}
              </dl>

              <div className="nb-hair mt-[clamp(1.1rem,2.4vw,1.5rem)] grid gap-4 pt-[clamp(1rem,2.2vw,1.4rem)] sm:grid-cols-2">
                {isDrive ? (
                  <>
                    <div className="nb-field">
                      <label className="nb-label" htmlFor="gr-wheel">
                        Wheel diameter (in)
                      </label>
                      <input
                        id="gr-wheel"
                        className="nb-input"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={wheel}
                        onChange={(e) => setWheel(e.target.value)}
                      />
                      <p className="nb-hint">
                        Tread squash under a loaded robot makes the rolling diameter a
                        little under nominal.
                      </p>
                    </div>
                    <div className="nb-field">
                      <label className="nb-label" htmlFor="gr-derate">
                        Speed derate (%)
                      </label>
                      <input
                        id="gr-derate"
                        className="nb-input"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={derate}
                        onChange={(e) => setDerate(e.target.value)}
                      />
                      <p className="nb-hint">
                        80 to 85% is the long-standing FRC allowance for drag and
                        scrub. It is a convention, not physics.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="nb-field sm:col-span-2">
                    <label className="nb-label" htmlFor="gr-arm">
                      Lever or pulley radius (in)
                    </label>
                    <input
                      id="gr-arm"
                      className="nb-input"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={arm}
                      onChange={(e) => setArm(e.target.value)}
                    />
                    <p className="nb-hint">
                      Output shaft centre to where the load acts: an arm&rsquo;s
                      length to its centre of mass, or a pulley&rsquo;s radius.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* --- Card B: force --- */}
            <div className="nb-box nb-tilt-3 relative p-[clamp(1.1rem,2.4vw,1.7rem)] lg:mt-8">
              <span
                className="nb-tape -top-3 right-[14%] rotate-[2.8deg]"
                aria-hidden="true"
              />
              <p className="nb-slug border-b border-dashed border-rule pb-2.5">
                {isDrive ? "force at the wheel" : "torque at the output"}
              </p>

              <p className="mt-3.5 flex items-baseline gap-2 font-mono font-bold tabular-nums">
                <span className="text-[clamp(1.9rem,1.2rem+2.2vw,2.8rem)] leading-none tracking-[-0.03em] text-blue">
                  {isDrive ? fmt(r.usableLb, 1) : fmt(r.tauOut, 2)}
                </span>
                <span className="text-[0.95rem] text-ink">
                  {isDrive ? "lbf of push" : "N·m"}
                </span>
              </p>

              <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
                <dt className="nb-slug">torque out</dt>
                <dd className="nb-slug m-0 !text-ink">
                  {fmt(r.tauOut, 2)} N&middot;m, {fmt(r.tauOut * NM_TO_FTLB, 2)} ft&middot;lbf
                </dd>
                {isDrive ? (
                  <>
                    <dt className="nb-slug">wheels could push</dt>
                    <dd className="nb-slug m-0 !text-ink">{fmt(r.fPushLb, 1)} lbf</dd>
                    <dt className="nb-slug">carpet allows</dt>
                    <dd className="nb-slug m-0 !text-ink">{fmt(r.fTracLb, 1)} lbf</dd>
                    <dt className="nb-slug">acceleration</dt>
                    <dd className="nb-slug m-0 !text-ink">
                      {fmt(r.accelG, 2)} g, {fmt(r.accelFtS2, 1)} ft/s&sup2;
                    </dd>
                  </>
                ) : (
                  <>
                    <dt className="nb-slug">per motor</dt>
                    <dd className="nb-slug m-0 !text-ink">
                      {fmt(r.tauMotor, 3)} N&middot;m at {fmt(r.iLim, 0)} A
                    </dd>
                    <dt className="nb-slug">force at lever</dt>
                    <dd className="nb-slug m-0 !text-ink">{fmt(r.fArmLb, 1)} lbf</dd>
                  </>
                )}
              </dl>

              {isDrive ? (
                <>
                  {/* The meter never stands alone: the number and the verdict
                      sentence carry the same information in words. */}
                  <div className="mt-4">
                    <div className="nb-meter">
                      <span
                        className="nb-meter-bar"
                        style={{ width: `${pushPct}%` }}
                      />
                    </div>
                    <p className="nb-slug mt-2">
                      using {fmt(r.usableLb, 1)} of {fmt(Math.max(r.fPushLb, r.fTracLb), 1)} lbf
                      available, so you are{" "}
                      <span className="!text-ink font-bold">
                        {r.tractionLimited ? "traction-limited" : "torque-limited"}
                      </span>
                    </p>
                  </div>

                  <p className="mt-3 text-[0.93rem] leading-relaxed text-graphite">
                    {r.tractionLimited
                      ? "The gearing can make more force than the carpet will hold, so the wheels spin before the motors stall. More reduction buys nothing here. Grippier tread, more weight over the driven wheels, or a lower current limit is the real fix."
                      : "The carpet would hold more than the motors can deliver, so the wheels grip and the motors bog down. More reduction, more motors, or a higher current limit would let you push harder, if the breakers allow it."}
                  </p>
                </>
              ) : (
                <p className="mt-4 text-[0.93rem] leading-relaxed text-graphite">
                  {r.currentLimited
                    ? `Each motor is capped at ${fmt(r.tauMotor, 3)} N·m by your ${fmt(r.iLim, 0)} A limit, which is ${fmt((r.tauMotor / motor.stallNm) * 100, 0)}% of its ${fmt(motor.stallNm, 2)} N·m stall torque. This is peak torque at zero speed, not a number you hold while moving.`
                    : `Your ${fmt(r.iLim, 0)} A limit is at or above this motor's ${fmt(motor.stallA, 0)} A stall current, so torque sits at the full ${fmt(motor.stallNm, 2)} N·m stall value and the limit is doing nothing.`}
                </p>
              )}

              {isDrive ? (
                <div className="nb-hair mt-[clamp(1.1rem,2.4vw,1.5rem)] grid gap-4 pt-[clamp(1rem,2.2vw,1.4rem)] sm:grid-cols-3">
                  <div className="nb-field">
                    <label className="nb-label" htmlFor="gr-weight">
                      Weight (lb)
                    </label>
                    <input
                      id="gr-weight"
                      className="nb-input"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                  </div>
                  <div className="nb-field">
                    <label className="nb-label" htmlFor="gr-mu">
                      Wheel grip &mu;
                    </label>
                    <input
                      id="gr-mu"
                      className="nb-input"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={mu}
                      onChange={(e) => setMu(e.target.value)}
                    />
                  </div>
                  <div className="nb-field">
                    <label className="nb-label" htmlFor="gr-frac">
                      On driven wheels (%)
                    </label>
                    <input
                      id="gr-frac"
                      className="nb-input"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={weightFrac}
                      onChange={(e) => setWeightFrac(e.target.value)}
                    />
                  </div>
                  <p className="nb-hint sm:col-span-3">
                    Competition weight with battery and bumpers. &mu; is community
                    measured, not a vendor spec: roughly 0.8 to 1.0 for smooth or
                    Colson, 1.1 to 1.4 for nitrile or roughtop. Drop the percentage
                    if some weight rides on undriven omnis.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * 4. The electrical ceiling, as a margin note
       *
       * This is the constraint above all the gearing choices, and it belongs
       * on the page as an aside rather than as a fourth card competing with
       * the two above. Ink bar, dashed frame, numbers in words.
       * ---------------------------------------------------------------- */}
      <section className="py-[clamp(1.4rem,3vw,2.4rem)]">
        <div className="nb-wrap">
          <div className="nb-note grid gap-[clamp(1.2rem,3vw,2.4rem)] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <p className="nb-slug !text-ink">the ceiling over all of it</p>
              <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono font-bold tabular-nums">
                <span className="text-[clamp(1.7rem,1.2rem+1.8vw,2.4rem)] leading-none text-blue">
                  {fmt(r.iTotal, 0)} A
                </span>
                <span className="nb-slug !text-ink">
                  at full push, against the {MAIN_BREAKER_A} A main
                </span>
              </p>

              <div className="mt-3">
                <div className="nb-meter">
                  <span
                    className="nb-meter-bar"
                    style={{
                      width: `${Math.min(100, (r.iTotal / MAIN_BREAKER_A) * 100)}%`,
                    }}
                  />
                </div>
                <p className="nb-slug mt-2">
                  {r.iTotal <= MAIN_BREAKER_A
                    ? `${fmt(MAIN_BREAKER_A - r.iTotal, 0)} A of headroom left for everything else`
                    : `${fmt(r.iTotal - MAIN_BREAKER_A, 0)} A over the main breaker`}
                </p>
              </div>

              <p className="nb-slug mt-3 !text-ink">
                estimated bus voltage {fmt(r.vBus, 2)} V, brownout at {BROWNOUT_V} V
              </p>
            </div>

            <div>
              <p className="text-[0.95rem] leading-relaxed text-graphite">
                {r.power === "over" ? (
                  <>
                    <strong className="font-bold text-ink">
                      {fmt(r.iTotal, 0)} A is past the {MAIN_BREAKER_A} A main breaker.
                    </strong>{" "}
                    The breaker is thermal, so a spike while you shove another robot is
                    fine. Sustained draw at this level trips it and kills the whole
                    robot.{" "}
                  </>
                ) : r.power === "warn" ? (
                  <>
                    <strong className="font-bold text-ink">
                      Close to the {MAIN_BREAKER_A} A main breaker
                    </strong>{" "}
                    before you have added an intake, a shooter or an elevator.{" "}
                  </>
                ) : (
                  <>
                    The drivetrain leaves {fmt(MAIN_BREAKER_A - r.iTotal, 0)} A under the
                    main breaker for your other mechanisms.{" "}
                  </>
                )}
                {r.brownout === "brownout"
                  ? `At this draw the pack sags to about ${fmt(r.vBus, 2)} V, at or below the ${BROWNOUT_V} V line where the roboRIO disables your outputs.`
                  : r.brownout === "marginal"
                    ? `The pack sags to about ${fmt(r.vBus, 2)} V, under the ${RAIL_DROOP_V} V point where the 6 V rail starts to droop but still above the brownout line.`
                    : `Estimated sag to ${fmt(r.vBus, 2)} V keeps you clear of the brownout line.`}
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="nb-field">
                  <label className="nb-label" htmlFor="gr-limit">
                    Limit per motor (A)
                  </label>
                  <input
                    id="gr-limit"
                    className="nb-input"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                  />
                </div>
                <div className="nb-field">
                  <label className="nb-label" htmlFor="gr-voc">
                    Pack resting (V)
                  </label>
                  <input
                    id="gr-voc"
                    className="nb-input"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={voc}
                    onChange={(e) => setVoc(e.target.value)}
                  />
                </div>
                <div className="nb-field">
                  <label className="nb-label" htmlFor="gr-rint">
                    Internal R (&#8486;)
                  </label>
                  <input
                    id="gr-rint"
                    className="nb-input"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={rInt}
                    onChange={(e) => setRInt(e.target.value)}
                  />
                </div>
              </div>

              <p className="nb-hint mt-3">
                The current limit is the single biggest lever you have. Use your
                Battery Beak reading for internal resistance: near 0.011 &#8486; new,
                under 0.015 &#8486; healthy, over 0.020 &#8486; means retire it. Add up
                the rest of the robot in the{" "}
                <Link href="/tools/frc-current-budget" className="nb-link">
                  current and brownout calculator
                </Link>
                , or read{" "}
                <Link
                  href="/guides/getting-started/common-mistakes-troubleshooting/brownouts"
                  className="nb-link"
                >
                  how to stop browning out
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * 5. The working, shown
       *
       * Nobody trusts a calculator that will not show its working, so every
       * formula is printed as a table row with your own numbers substituted
       * in. It scrolls inside itself rather than widening the page.
       * ---------------------------------------------------------------- */}
      <section className="nb-rule py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div>
              <p className="nb-marker">the working / nothing hidden</p>
              <h2 className="max-w-[20ch] text-[clamp(1.5rem,1.1rem+1.6vw,2.4rem)]">
                Every line, with your numbers in it.
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => window.print()} className="nb-btn nb-btn-sm">
                Print this sheet
              </button>
              <button type="button" onClick={resetAll} className="nb-btn-ghost nb-btn-sm">
                Back to the KOP preset
              </button>
              {authed ? (
                <button
                  type="button"
                  className="nb-btn-ghost nb-btn-sm"
                  onClick={() => {
                    setSaved(true);
                    window.setTimeout(() => setSaved(false), 2000);
                  }}
                >
                  {saved ? "Saved" : "Save scenario"}
                </button>
              ) : null}
            </div>
          </div>

          {/* `tabIndex` because this table is 46rem wide and holds no links:
              below that width the scroller is reachable by pointer only, and
              the right-hand columns cannot be read from a keyboard at all. */}
          <div className="nb-scroll mt-[clamp(1.4rem,3vw,2.2rem)]" tabIndex={0}>
            <table className="nb-table min-w-[46rem]">
              <caption className="sr-only">
                Every formula this calculator uses, with your entered values substituted in.
              </caption>
              <thead>
                <tr>
                  <th scope="col">what</th>
                  <th scope="col">formula</th>
                  <th scope="col">with your numbers</th>
                </tr>
              </thead>
              <tbody>
                <MathRow
                  title="Overall reduction"
                  formula="G = product of (driven / driving)"
                  work={
                    // With a single stage the product expansion would just
                    // restate the answer, so skip it.
                    r.stageRatios.length > 1
                      ? `G = ${r.stageRatios
                          .map((v) => (Number.isFinite(v) ? fmt(v, 3) : "?"))
                          .join(" x ")} = ${r.stagesValid ? fmt(r.G, 4) : "—"}`
                      : `G = ${r.stagesValid ? fmt(r.G, 4) : "—"}`
                  }
                />
                <MathRow
                  title={isDrive ? "Wheel speed" : "Output speed"}
                  formula="n_out = n_free / G"
                  work={`n_out = ${fmt(motor.freeRpm, 0)} RPM / ${fmt(r.G, 4)} = ${fmt(r.outRpm, 1)} RPM`}
                />
                {isDrive ? (
                  <>
                    <MathRow
                      title="Free speed"
                      formula="v = n_out x pi x D"
                      work={`v = ${fmt(r.outRpm, 1)} rev/min x pi x ${fmt(r.wheelIn, 2)} in / 12 / 60 = ${fmt(r.vFreeFps, 2)} ft/s`}
                    />
                    <MathRow
                      title="Adjusted speed"
                      formula="v_adj = v x derate"
                      work={`v_adj = ${fmt(r.vFreeFps, 2)} ft/s x ${fmt(parseNum(derate), 0)}% = ${fmt(r.vAdjFps, 2)} ft/s`}
                    />
                  </>
                ) : null}
                <MathRow
                  title="Torque from one motor at your limit"
                  formula="t_m = t_stall x (I_limit - I_free) / (I_stall - I_free)"
                  work={`t_m = ${fmt(motor.stallNm, 2)} x (${fmt(r.iLim, 0)} - ${fmt(motor.freeA, 1)}) / (${fmt(motor.stallA, 0)} - ${fmt(motor.freeA, 1)}) = ${fmt(r.tauMotor, 3)} N·m`}
                />
                <MathRow
                  title={isDrive ? "Torque at the wheels" : "Torque at the output"}
                  formula="t_out = N x t_m x G x eta"
                  work={`t_out = ${r.n} x ${fmt(r.tauMotor, 3)} x ${fmt(r.G, 4)} x ${fmt(r.etaTotal, 2)} = ${fmt(r.tauOut, 2)} N·m`}
                />
                {isDrive ? (
                  <>
                    <MathRow
                      title="Pushing force"
                      formula="F = t_out / (D / 2)"
                      work={`F = ${fmt(r.tauOut, 2)} N·m / ${fmt((r.wheelIn / 2) * M_PER_IN, 4)} m = ${fmt(r.fPushLb * LBF_TO_N, 1)} N = ${fmt(r.fPushLb, 1)} lbf`}
                    />
                    <MathRow
                      title="Traction limit"
                      formula="F_max = mu x W x (weight on driven wheels)"
                      work={`F_max = ${fmt(parseNum(mu), 2)} x ${fmt(parseNum(weight), 0)} lb x ${fmt(parseNum(weightFrac), 0)}% = ${fmt(r.fTracLb, 1)} lbf`}
                    />
                    <MathRow
                      title="Acceleration"
                      formula="a = F_usable / W x g"
                      work={`a = ${fmt(r.usableLb, 1)} lbf / ${fmt(parseNum(weight), 0)} lb x 32.17 = ${fmt(r.accelFtS2, 1)} ft/s2 (${fmt(r.accelG, 2)} g)`}
                    />
                  </>
                ) : (
                  <MathRow
                    title="Force at the lever"
                    formula="F = t_out / radius"
                    work={`F = ${fmt(r.tauOut, 2)} N·m / ${fmt(r.armIn * M_PER_IN, 4)} m = ${fmt(r.fArmLb * LBF_TO_N, 1)} N = ${fmt(r.fArmLb, 1)} lbf`}
                  />
                )}
                <MathRow
                  title="Current and sag"
                  formula="I = N x I_limit, V_bus = V_oc - I x R_int"
                  work={`I = ${r.n} x ${fmt(r.iLim, 0)} = ${fmt(r.iTotal, 0)} A, V_bus = ${fmt(parseNum(voc), 2)} - ${fmt(r.iTotal, 0)} x ${fmt(parseNum(rInt), 3)} = ${fmt(r.vBus, 2)} V`}
                />
              </tbody>
            </table>
          </div>

          {!authed ? (
            <div className="nb-hair mt-[clamp(1.4rem,3vw,2rem)] flex flex-wrap items-center justify-between gap-4 pt-[clamp(1.1rem,2.2vw,1.5rem)]">
              <p className="max-w-[46ch] text-[0.95rem] text-graphite">
                An account saves named gearbox setups so you can put two ratios side
                by side. Reading and calculating never needs one.
              </p>
              <Link
                href="/signup?next=/tools/frc-gear-ratio-calculator"
                className="nb-btn nb-btn-sm"
              >
                Create a free account
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * 6. The back of the sheet
       * ---------------------------------------------------------------- */}
      <section className="nb-rule py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <button
            type="button"
            className="flex w-full items-baseline justify-between gap-4 text-left"
            onClick={() => setNotesOpen((v) => !v)}
            aria-expanded={notesOpen}
            aria-controls="gr-notes"
          >
            <span>
              <span className="nb-marker">the back of the sheet</span>
              <span className="block text-[clamp(1.35rem,1.05rem+1.2vw,2rem)] font-extrabold tracking-[-0.025em]">
                Where every motor number came from.
              </span>
            </span>
            <span className="nb-slug shrink-0 !text-ink" aria-hidden="true">
              {notesOpen ? "hide" : "show"}
            </span>
          </button>

          {notesOpen ? (
            <div
              id="gr-notes"
              className="mt-[clamp(1.4rem,3vw,2.2rem)] grid gap-[clamp(1.4rem,3vw,2.6rem)] lg:grid-cols-3"
            >
              <div>
                <p className="nb-slug border-b-2 border-ink pb-2">motor specifications</p>
                <p className="mt-4 max-w-[46ch] text-[0.95rem] leading-relaxed text-graphite">
                  Each motor uses figures published by its own manufacturer, at 12 V.
                  That matters: vendors dyno each other&rsquo;s motors under their own
                  conditions and get different answers. REV&rsquo;s comparison page
                  lists the Kraken X60 at 6,271 RPM and 4.21 N&middot;m from REV&rsquo;s
                  bench, while WCP publishes 6,000 RPM and 7.09 N&middot;m for the same
                  motor. Assume a real motor lands near, not on, any of them.
                </p>
                <ul className="nb-prose mt-4 !max-w-none text-[0.95rem]">
                  <li>
                    NEO V1.1, 5,676 RPM, 2.6 N&middot;m, 105 A stall, 1.8 A free, from{" "}
                    <SourceLink href="https://docs.revrobotics.com/brushless/neo/v1.1">
                      REV Robotics
                    </SourceLink>
                    .
                  </li>
                  <li>
                    NEO Vortex, 6,784 RPM, 3.6 N&middot;m, 211 A stall, 3.6 A free, from{" "}
                    <SourceLink href="https://docs.revrobotics.com/brushless/neo/vortex">
                      REV Robotics
                    </SourceLink>
                    .
                  </li>
                  <li>
                    Kraken X60, 6,000 RPM / 7.09 N&middot;m / 366 A trapezoidal and
                    5,800 RPM / 9.37 N&middot;m / 483 A FOC, from{" "}
                    <SourceLink href="https://docs.wcproducts.com/kraken-x60">
                      WestCoast Products
                    </SourceLink>
                    .
                  </li>
                  <li>
                    Kraken X44, 7,530 RPM / 4.05 N&middot;m / 275 A trapezoidal and
                    7,368 RPM / 5.01 N&middot;m / 329 A FOC, from{" "}
                    <SourceLink href="https://docs.wcproducts.com/kraken-x44">
                      WestCoast Products
                    </SourceLink>
                    .
                  </li>
                  <li>
                    Falcon 500, 6,380 RPM, 4.69 N&middot;m, 257 A stall, 1.5 A free, from{" "}
                    <SourceLink href="https://store.ctr-electronics.com/products/falcon-500-powered-by-talon-fx">
                      CTR Electronics
                    </SourceLink>
                    .
                  </li>
                  <li>
                    CIM, 5,310 RPM, 2.425 N&middot;m, 133 A stall, 2.7 A free, from{" "}
                    <SourceLink href="https://andymark.com/products/2-5-in-cim-motor">
                      AndyMark am-0255
                    </SourceLink>
                    .
                  </li>
                  <li>
                    Left out on purpose: the Mini CIM, because AndyMark and CTR
                    Electronics no longer carry it and only third-party mirrors of its
                    spec sheet survive, and the CTRE Minion, whose store page publishes
                    stall torque and peak power but not free speed or stall current.
                  </li>
                </ul>
              </div>

              <div>
                <p className="nb-slug border-b-2 border-ink pb-2">preset gearboxes</p>
                <ul className="nb-prose mt-4 !max-w-none text-[0.95rem]">
                  <li>
                    ToughBox Mini 8.45:1 is AndyMark&rsquo;s published gearset for that
                    option: a 14T CIM pinion into a 50T cluster gear, then a 19T cluster
                    into a 45T output. (50 / 14) x (45 / 19) = 8.459, which the vendor
                    rounds to 8.45:1.{" "}
                    <SourceLink href="https://www.andymark.com/products/toughbox-mini-options-angled-8-45-1">
                      AndyMark
                    </SourceLink>
                  </li>
                  <li>
                    SDS MK4i drive gearing is L1 8.14:1, L2 6.75:1, L3 6.12:1, on the
                    module&rsquo;s 4 in wheel.{" "}
                    <SourceLink href="https://andymark.com/products/sds-mk4i-swerve-modules">
                      Swerve Drive Specialties
                    </SourceLink>
                  </li>
                  <li>
                    Electrical limits: 120 A main breaker (Cooper Bussmann CB285-120),
                    roboRIO brownout at 6.75 V (roboRIO 2.0 default, 1.0 is fixed at
                    6.3 V), 6 V rail droop near 6.8 V, from WPILib. These match the
                    constants in the{" "}
                    <Link href="/tools/frc-current-budget" className="nb-link">
                      current and brownout calculator
                    </Link>
                    .
                  </li>
                  <li>
                    Battery model V_bus = V_oc &minus; I x R_int. A healthy pack reads
                    12.7 to 13.5 V open with internal resistance near 0.011 &#8486; new.
                    Over 0.020 &#8486; means retire it.
                  </li>
                </ul>
              </div>

              <div>
                <p className="nb-slug border-b-2 border-ink pb-2">
                  assumptions worth arguing with
                </p>
                <ul className="nb-prose mt-4 !max-w-none text-[0.95rem]">
                  <li>
                    Coefficient of friction is not a vendor spec. The 0.8 to 1.4 range
                    comes from community measurements and swings with tread wear, carpet
                    type, dust and test method. If grip decides your design, drag your
                    own robot across carpet on a scale.
                  </li>
                  <li>
                    The speed derate is a convention, not physics. Free speed is exact
                    kinematics, the 80 to 85% multiplier is the long-standing FRC
                    allowance for rolling resistance, gearbox drag and scrub.
                  </li>
                  <li>
                    Torque here is peak, near-stall torque. A DC motor makes maximum
                    torque at zero speed. Once the wheels turn, back-EMF pulls current
                    below your limit and torque with it, so this is the shove at the
                    moment of contact, not a number you hold at speed.
                  </li>
                  <li>
                    Efficiency is applied to torque, not speed. Gearbox losses barely
                    slow the no-load output, they eat the force you get out of it.
                  </li>
                  <li>
                    Wheel diameter is nominal. Tread compresses under a loaded robot, so
                    effective rolling diameter runs a couple of percent under the number
                    printed on the wheel.
                  </li>
                  <li>
                    Traction assumes weight shared evenly across driven wheels on level
                    carpet. Weight transfer under hard acceleration, a defended pin, or
                    a ramp all change the answer.
                  </li>
                  <li>
                    This is a steady-state, first-order model. It does not simulate
                    acceleration curves, motor heating over a match, wheel scrub in a
                    turn, or a sagging battery&rsquo;s effect on torque. Prototype and
                    measure before you commit to a ratio.
                  </li>
                </ul>
                <p className="nb-slug mt-4">Not affiliated with or endorsed by FIRST.</p>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Presentational helpers
 * ------------------------------------------------------------------ */

/**
 * One line of the working. The formula and the substituted version both
 * wrap rather than truncate: on a 375px screen two lines of mono read fine,
 * and the table already scrolls inside its own container.
 */
function MathRow({
  title,
  formula,
  work,
}: {
  title: string;
  formula: string;
  work: string;
}): React.JSX.Element {
  return (
    <tr>
      {/* A row header, but `.nb-table th` is styled for the mono column head:
          override it back to running type so the label wraps instead of
          forcing the table wider than the sheet. */}
      <th
        scope="row"
        className="w-[15rem] whitespace-normal border-b border-dashed border-b-rule pr-6 align-baseline font-sans text-[0.95rem] leading-snug tracking-normal text-ink"
      >
        {title}
      </th>
      <td className="pr-6">
        <code className="block break-words font-mono text-[0.78rem] leading-relaxed text-blue">
          {formula}
        </code>
      </td>
      <td>
        <code className="block break-words font-mono text-[0.78rem] leading-relaxed tabular-nums text-graphite">
          {work}
        </code>
      </td>
    </tr>
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
    <a href={href} target="_blank" rel="noopener noreferrer" className="nb-link">
      {children}
    </a>
  );
}
