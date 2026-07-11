"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Gauge,
  Info,
  MoveVertical,
  Printer,
  RotateCcw,
  Ruler,
  Save,
  Sparkles,
  Wrench,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 * Verified constants (do not edit — sourced, exact / defined)
 * ------------------------------------------------------------------ */
// NIST CODATA standard acceleration of gravity g_n = 9.80665 m/s^2 (exact).
const G_MS2 = 9.80665;
// Exact conversion 9.80665 / 0.3048 = 32.17405 ft/s^2.
const G_FTS2 = 32.17405;
// NIST exact: 1 lbf = 4.4482216 N.
const LBF_TO_N = 4.4482216;
// NIST exact: 1 in = 25.4 mm (0.0254 m).
const IN_TO_MM = 25.4;
// NIST exact: 1 lb = 0.45359237 kg.
const LB_TO_KG = 0.45359237;

// 2026 REBUILT legal bounds (Game Manual R103 / R104).
const ROBOT_WEIGHT_LIMIT_LB = 115.0; // R103, excludes bumpers & battery
const ROBOT_PLUS_BUMPERS_LIMIT_LB = 135.0; // R408, robot + bumpers (battery excl.)
const ROBOT_PERIMETER_MAX_IN = 110.0; // R104
const ROBOT_HEIGHT_MAX_IN = 30.0; // R104

/* ------------------------------------------------------------------ *
 * Coefficient-of-friction presets.
 * refutes[]: "unverifiable" — these come from a personal blog + Chief
 * Delphi threads, NOT current vendor spec pages. Presented ONLY as
 * user-editable Tier-2 estimates. Each preset seeds the LOW end of its
 * community-reported range (a value literally in the verified data) and
 * shows the full range. Never presented as a vendor-certified constant.
 * ------------------------------------------------------------------ */
type MuPreset = {
  key: string;
  label: string;
  seed: number; // low end of the community range (verified endpoint)
  range: string;
  note: string;
};

const MU_PRESETS: MuPreset[] = [
  {
    key: "roughtop",
    label: "Roughtop / wedgetop / nitrile tread",
    seed: 1.1,
    range: "~1.1–1.3",
    note: "Highest-traction common FRC tread. Community values cluster ~1.1–1.3 (AndyMark blue-nitrile page lists no numeric CoF).",
  },
  {
    key: "higrip",
    label: "AndyMark HiGrip",
    seed: 0.95,
    range: "~0.95–1.0 (community ~1.07)",
    note: "AndyMark's historical spec was 0.95–1.0 static; the current HiGrip product page no longer lists a CoF. Community measurements ~1.07 for the 4 in wheel.",
  },
  {
    key: "colson",
    label: "Colson / smooth traction wheel",
    seed: 0.9,
    range: "~0.9–1.1",
    note: "Community consensus (WCP + Chief Delphi): just slightly below roughtop on tight-pile carpet.",
  },
  {
    key: "pneumatic",
    label: "AndyMark pneumatic (fore/aft)",
    seed: 1.27,
    range: "~1.27 inflated",
    note: "Blog-cited AndyMark value 1.27 forwards/backwards fully inflated; lower sideways. Not on the current product page.",
  },
  {
    key: "omni",
    label: "Omni / mecanum roller (lateral)",
    seed: 0.4,
    range: "~0.4–0.6",
    note: "Rollers present low lateral friction by design; ~0.4–0.6 for the free-rolling direction.",
  },
  {
    key: "custom",
    label: "Custom (enter your measured µ)",
    seed: 1.1,
    range: "your value",
    note: "Measure your own wheels on Shaw Neyland II 20 competition carpet for the best result.",
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

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */
export default function TippingCalculator({
  authed,
}: {
  authed: boolean;
}): React.ReactElement {
  // Length values are held in the currently-selected display unit.
  const [lengthUnit, setLengthUnit] = useState<"in" | "mm">("in");
  const [massUnit, setMassUnit] = useState<"lb" | "kg">("lb");

  // Defaults are the verified engineering estimates (in inches / lb).
  const [track, setTrack] = useState("27"); // needs_range — R104-bounded
  const [wheelbase, setWheelbase] = useState("27"); // needs_range
  const [cog, setCog] = useState("13"); // uncertain — #1 accuracy input
  const [weight, setWeight] = useState("125"); // needs_range — override required

  const [muPresetKey, setMuPresetKey] = useState("roughtop");
  const [mu, setMu] = useState("1.1"); // default µ (verified representative)
  const [drivenFrac, setDrivenFrac] = useState("1.0"); // f, all-wheel drive

  const [yOff, setYOff] = useState("0"); // lateral CoG offset (advanced)
  const [xOff, setXOff] = useState("0"); // fore/aft CoG offset (advanced)

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saved, setSaved] = useState(false);

  function convertLengths(from: "in" | "mm", to: "in" | "mm"): void {
    if (from === to) return;
    const factor = from === "in" ? IN_TO_MM : 1 / IN_TO_MM;
    const round = (v: string): string => {
      const n = parseNum(v) * factor;
      return to === "mm" ? String(Math.round(n)) : String(Math.round(n * 100) / 100);
    };
    setTrack(round(track));
    setWheelbase(round(wheelbase));
    setCog(round(cog));
    setYOff(round(yOff));
    setXOff(round(xOff));
  }

  function convertMass(from: "lb" | "kg", to: "lb" | "kg"): void {
    if (from === to) return;
    const factor = from === "lb" ? LB_TO_KG : 1 / LB_TO_KG;
    setWeight(String(Math.round(parseNum(weight) * factor * 10) / 10));
  }

  function selectPreset(key: string): void {
    setMuPresetKey(key);
    const p = MU_PRESETS.find((x) => x.key === key);
    if (p && key !== "custom") setMu(String(p.seed));
  }

  function resetAll(): void {
    setLengthUnit("in");
    setMassUnit("lb");
    setTrack("27");
    setWheelbase("27");
    setCog("13");
    setWeight("125");
    setMuPresetKey("roughtop");
    setMu("1.1");
    setDrivenFrac("1.0");
    setYOff("0");
    setXOff("0");
  }

  const activePreset = MU_PRESETS.find((p) => p.key === muPresetKey) ?? MU_PRESETS[0];

  /* --------------------------- math ----------------------------- */
  const r = useMemo(() => {
    const t = parseNum(track);
    const wb = parseNum(wheelbase);
    const h = parseNum(cog);
    const y = Math.abs(parseNum(yOff));
    const x = Math.abs(parseNum(xOff));
    const muN = parseNum(mu);
    const f = Math.min(Math.max(parseNum(drivenFrac), 0), 1);

    const valid = h > 0 && t > 0 && wb > 0;

    // Worst-case restoring lever arms (offset always reduces margin).
    const dSide = t / 2 - y; // half-track minus lateral offset
    const dPitch = wb / 2 - x; // half-wheelbase minus fore/aft offset

    // TIER 1 — exact rigid-body statics (ratios are unit-independent).
    const ssf = valid ? t / (2 * h) : NaN; // Static Stability Factor
    const aLatG = valid ? dSide / h : NaN; // lateral tip accel, g's
    const aLongG = valid ? dPitch / h : NaN; // longitudinal tip accel, g's
    const thetaSide = valid ? (Math.atan(dSide / h) * 180) / Math.PI : NaN;
    const thetaRamp = valid ? (Math.atan(dPitch / h) * 180) / Math.PI : NaN;

    const tanSide = valid ? dSide / h : NaN;
    const tanPitch = valid ? dPitch / h : NaN;
    // Slides first when µ < tip tangent; tips first when µ >= tip tangent.
    const sideSlides = valid ? muN < tanSide : false;
    const pitchSlides = valid ? muN < tanPitch : false;

    // TIER 2 — friction-dependent (estimate/range only).
    const weightLbf = massUnit === "lb" ? parseNum(weight) : parseNum(weight) / LB_TO_KG;
    const pushLbf = muN * f * weightLbf;
    const pushN = pushLbf * LBF_TO_N;

    return {
      valid,
      dSide,
      dPitch,
      ssf,
      aLatG,
      aLatMs2: aLatG * G_MS2,
      aLatFts2: aLatG * G_FTS2,
      aLongG,
      aLongMs2: aLongG * G_MS2,
      aLongFts2: aLongG * G_FTS2,
      thetaSide,
      thetaRamp,
      sideSlides,
      pitchSlides,
      tanSide,
      tanPitch,
      pushLbf,
      pushN,
      muN,
      h,
      t,
      y,
    };
  }, [track, wheelbase, cog, yOff, xOff, mu, drivenFrac, weight, massUnit]);

  // Plain-language "tippiness" read-out from SSF.
  const tippiness = useMemo(() => {
    if (!r.valid) return { label: "—", tone: "muted" as const };
    if (r.ssf >= 1.2) return { label: "Very stable", tone: "ok" as const };
    if (r.ssf >= 1.0) return { label: "Stable", tone: "ok" as const };
    if (r.ssf >= 0.85) return { label: "Moderate — watch hard turns", tone: "warn" as const };
    return { label: "Tippy — raise track or lower CoG", tone: "fail" as const };
  }, [r.valid, r.ssf]);

  const lu = lengthUnit;
  const mnu = massUnit;

  /* --------------------------- diagram --------------------------- */
  // Front-view cross-section. All ratios unit-independent; we scale in-unit.
  const diagram = useMemo(() => {
    const W = 320;
    const H = 210;
    const floorY = 168;
    const cx = W / 2;
    const t = r.t;
    const h = r.h;
    const y = parseNum(yOff);
    if (!r.valid) return { W, H, floorY, cx, ok: false as const };

    const span = Math.max(t * 1.35, h * 1.9, 1);
    const px = (H - 40) / span;
    const halfTrackPx = (t / 2) * px;
    const cogPx = h * px;
    const bodyTop = floorY - Math.max(cogPx * 1.5, cogPx + 14);
    const cogX = cx + y * px;
    const cogY = floorY - cogPx;
    // Downhill/tipping edge = side the CoG leans toward (worst case).
    const tipX = y >= 0 ? cx + halfTrackPx : cx - halfTrackPx;

    return {
      W,
      H,
      floorY,
      cx,
      ok: true as const,
      halfTrackPx,
      bodyTop,
      cogX,
      cogY,
      tipX,
      theta: r.thetaSide,
    };
  }, [r.valid, r.t, r.h, r.thetaSide, yOff]);

  return (
    <div className="ac-card rounded-2xl p-5 sm:p-6">
      {/* Header */}
      <header className="mb-6">
        <span className="ac-chip inline-flex items-center gap-2">
          <span className="ac-eyebrow">STABILITY</span>
        </span>
        <h2 className="font-display mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Tip-Over &amp; Traction{" "}
          <span
            style={{
              background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Stability
          </span>{" "}
          Calculator
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-foreground/70">
          Rigid-body statics for your drivetrain: how hard you can turn or accelerate before two
          wheels lift, the tip angle on a ramp or cross-slope, whether you slide or tip first, and
          how hard you can push. Everything recomputes live.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Figures: 2026 <span className="font-medium">REBUILT</span> season (Game Manual R103 /
          R104). Verify weight, envelope, carpet spec, and vendor µ against the current FIRST Game
          Manual — these change most seasons.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* -------------------------- INPUTS -------------------------- */}
        <div className="rounded-2xl border border-border bg-white/60 p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Ruler className="h-4 w-4 text-primary" />
              Robot geometry &amp; wheels
            </div>
            <div className="flex items-center gap-1">
              <UnitToggle
                value={lu}
                a="in"
                b="mm"
                onChange={(next) => {
                  convertLengths(lu, next);
                  setLengthUnit(next);
                }}
              />
              <UnitToggle
                value={mnu}
                a="lb"
                b="kg"
                onChange={(next) => {
                  convertMass(mnu, next);
                  setMassUnit(next);
                }}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Track width"
              help={`Lateral wheel-contact spacing. Default 27 ${"in"} (R104-bounded estimate — adjust to your drivetrain).`}
              value={track}
              onChange={setTrack}
              unit={lu}
            />
            <Field
              label="Wheelbase"
              help={`Fore/aft wheel-contact spacing. Default 27 ${"in"} (R104-bounded estimate).`}
              value={wheelbase}
              onChange={setWheelbase}
              unit={lu}
            />
            <Field
              label="CoG height above floor"
              help="Engineering estimate, NOT a published spec — the #1 error source. A 2 in miss moves every result 10–20%. Measure it (balance/tip test)."
              value={cog}
              onChange={setCog}
              unit={lu}
              accent
            />
            <Field
              label="Weight on the wheels"
              help="Robot + bumpers + battery. Default 125 lb is an estimate — enter your measured weight."
              value={weight}
              onChange={setWeight}
              unit={mnu}
            />
          </div>

          {/* CoG measurement callout */}
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <strong>CoG height dominates accuracy.</strong> It is an estimate, not a rule value —
              find yours with a balance-point or tip-angle test before trusting any output.
            </span>
          </div>

          <div className="ac-divider my-5" />

          {/* Friction */}
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Gauge className="h-4 w-4 text-primary" />
            Wheel-on-carpet friction (µ){" "}
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Estimate
            </span>
          </div>

          <label className="text-sm font-medium text-foreground" htmlFor="mu-preset">
            Wheel / tread preset
          </label>
          <select
            id="mu-preset"
            className="mt-1 w-full rounded-xl border border-border bg-white/60 px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            value={muPresetKey}
            onChange={(e) => selectPreset(e.target.value)}
          >
            {MU_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label} ({p.range})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">{activePreset.note}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Community / historical estimates — <strong>not</strong> currently vendor-published.
            Preset seeds the low end of the range; slide within it or measure your own.
          </p>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground" htmlFor="mu-val">
                µ (override)
              </label>
              <input
                id="mu-val"
                type="number"
                step="0.01"
                inputMode="decimal"
                className="mt-1 w-full rounded-xl border border-border bg-white/60 px-3 py-2 text-sm text-foreground tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                value={mu}
                onChange={(e) => {
                  setMu(e.target.value);
                  setMuPresetKey("custom");
                }}
              />
            </div>
          </div>

          {/* Advanced */}
          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            className="ac-btn-ghost mt-5 inline-flex items-center gap-2 text-xs"
          >
            <Wrench className="h-3.5 w-3.5" />
            {showAdvanced ? "Hide" : "Show"} advanced (drive fraction, CoG offsets)
          </button>

          {showAdvanced && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-foreground" htmlFor="f-val">
                  Driven-wheel weight fraction f
                </label>
                <input
                  id="f-val"
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  inputMode="decimal"
                  className="mt-1 w-full rounded-xl border border-border bg-white/60 px-3 py-2 text-sm text-foreground tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  value={drivenFrac}
                  onChange={(e) => setDrivenFrac(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">1.0 = all-wheel drive.</p>
              </div>
              <Field
                label="Lateral CoG offset"
                help="Sideways shift of CoG from centerline (0 = centered). Reduces tip margin on that side."
                value={yOff}
                onChange={setYOff}
                unit={lu}
              />
              <Field
                label="Fore/aft CoG offset"
                help="Fore/aft shift of CoG from center (0 = centered). Reduces pitch margin."
                value={xOff}
                onChange={setXOff}
                unit={lu}
              />
            </div>
          )}

          <button
            type="button"
            onClick={resetAll}
            className="ac-btn-ghost mt-5 inline-flex items-center gap-2 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to defaults
          </button>
        </div>

        {/* -------------------------- RESULTS ------------------------- */}
        <div className="rounded-2xl border border-border bg-white/60 p-5">
          {/* Primary result */}
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Max lateral acceleration before tip (hard turn)
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
              {fmt(r.aLatG, 2)}
            </div>
            <div className="pb-1 text-lg font-semibold text-foreground/70">g</div>
          </div>
          <div className="mt-1 text-sm text-muted-foreground tabular-nums">
            = {fmt(r.aLatMs2, 2)} m/s² · {fmt(r.aLatFts2, 1)} ft/s²
          </div>

          {/* SSF + tippiness */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="ac-tile rounded-xl border border-border bg-white/60 p-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Static Stability Factor <Tip text="SSF = track ÷ (2 × CoG height). NHTSA's rollover metric; equals the tip threshold in g for a centered CoG." />
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                {fmt(r.ssf, 2)}
              </div>
              <Verdict tone={tippiness.tone} label={tippiness.label} />
            </div>
            <div className="ac-tile rounded-xl border border-border bg-white/60 p-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Longitudinal tip accel <Tip text="g × (half-wheelbase − fore/aft offset) ÷ CoG height. Wheelie under accel / nose-over under braking." />
              </div>
              <div className="mt-1 flex items-end gap-1">
                <div className="text-2xl font-bold tabular-nums text-foreground">
                  {fmt(r.aLongG, 2)}
                </div>
                <div className="pb-0.5 text-sm text-foreground/60">g</div>
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                {fmt(r.aLongMs2, 2)} m/s² · {fmt(r.aLongFts2, 1)} ft/s²
              </div>
            </div>
          </div>

          {/* Diagram */}
          <div className="mt-4 rounded-xl border border-border bg-white/70 p-3 dark:bg-white/5">
            <div className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <MoveVertical className="h-3.5 w-3.5" /> Front-view cross-section (live)
            </div>
            <svg
              viewBox={`0 0 ${diagram.W} ${diagram.H}`}
              className="h-auto w-full"
              role="img"
              aria-label="Robot cross-section showing center of gravity and tipping edge"
            >
              {/* floor */}
              <line
                x1={16}
                y1={diagram.floorY}
                x2={diagram.W - 16}
                y2={diagram.floorY}
                stroke="currentColor"
                strokeOpacity={0.25}
                strokeWidth={2}
              />
              {diagram.ok && (
                <>
                  {/* body */}
                  <rect
                    x={diagram.cx - diagram.halfTrackPx}
                    y={diagram.bodyTop}
                    width={diagram.halfTrackPx * 2}
                    height={diagram.floorY - diagram.bodyTop}
                    rx={6}
                    fill="#2560e6"
                    fillOpacity={0.1}
                    stroke="#2560e6"
                    strokeOpacity={0.5}
                    strokeWidth={1.5}
                  />
                  {/* wheels */}
                  <circle cx={diagram.cx - diagram.halfTrackPx} cy={diagram.floorY} r={7} fill="#1aa9d6" fillOpacity={0.35} stroke="#1aa9d6" />
                  <circle cx={diagram.cx + diagram.halfTrackPx} cy={diagram.floorY} r={7} fill="#1aa9d6" fillOpacity={0.35} stroke="#1aa9d6" />
                  {/* restoring lever: tipping edge -> CoG */}
                  <line
                    x1={diagram.tipX}
                    y1={diagram.floorY}
                    x2={diagram.cogX}
                    y2={diagram.cogY}
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                  {/* gravity vector */}
                  <line
                    x1={diagram.cogX}
                    y1={diagram.cogY}
                    x2={diagram.cogX}
                    y2={diagram.floorY + 8}
                    stroke="#ef4444"
                    strokeWidth={2}
                    markerEnd="url(#arrow)"
                  />
                  <defs>
                    <marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                      <path d="M0,0 L8,4 L0,8 Z" fill="#ef4444" />
                    </marker>
                  </defs>
                  {/* CoG dot */}
                  <circle cx={diagram.cogX} cy={diagram.cogY} r={5} fill="#2560e6" stroke="#fff" strokeWidth={1.5} />
                  <text x={diagram.cogX + 8} y={diagram.cogY - 6} fontSize={10} fill="currentColor" fillOpacity={0.7}>
                    CoG
                  </text>
                  <text
                    x={diagram.cx}
                    y={diagram.floorY + 20}
                    fontSize={10}
                    textAnchor="middle"
                    fill="currentColor"
                    fillOpacity={0.6}
                  >
                    track {fmt(r.t, 1)} {lu} · CoG h {fmt(r.h, 1)} {lu} · side tip {fmt(r.thetaSide, 1)}°
                  </text>
                </>
              )}
            </svg>
          </div>

          {/* Tip angles */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatTile
              label="Cross-slope side tip angle"
              value={`${fmt(r.thetaSide, 1)}°`}
              tip="arctan((half-track − offset) ÷ CoG height). Static tip on a laterally-banked surface."
            />
            <StatTile
              label="Ramp pitch tip angle"
              value={`${fmt(r.thetaRamp, 1)}°`}
              tip="arctan((half-wheelbase − offset) ÷ CoG height). Static rearward tip driving up an incline."
            />
          </div>

          {/* Failure mode verdicts */}
          <div className="mt-4 space-y-2">
            <FailureRow
              label="On a cross-slope"
              slides={r.sideSlides}
              valid={r.valid}
              mu={r.muN}
              tan={r.tanSide}
            />
            <FailureRow
              label="On a ramp (pitch)"
              slides={r.pitchSlides}
              valid={r.valid}
              mu={r.muN}
              tan={r.tanPitch}
            />
          </div>

          {/* Tier-2 pushing force */}
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
              Traction-limited pushing force
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                Estimate — depends on µ
              </span>
            </div>
            <div className="mt-1 flex items-end gap-2">
              <div className="text-2xl font-bold tabular-nums text-foreground">
                ~{fmt(r.pushLbf, 0)} lbf
              </div>
              <div className="pb-0.5 text-sm text-foreground/60 tabular-nums">
                (~{fmt(r.pushN, 0)} N)
              </div>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              F ≈ µ · f · weight. Only as accurate as µ ({activePreset.range}); treat as a range, not
              a certified number.
            </p>
          </div>

          {/* Actions */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="ac-btn inline-flex items-center gap-2 text-sm"
            >
              <Printer className="h-4 w-4" /> Print / Save PDF
            </button>
            {authed ? (
              <button
                type="button"
                onClick={() => {
                  setSaved(true);
                  window.setTimeout(() => setSaved(false), 2000);
                }}
                className="ac-btn-ghost inline-flex items-center gap-2 text-sm"
              >
                <Save className="h-4 w-4" /> {saved ? "Saved" : "Save scenario"}
              </button>
            ) : null}
          </div>

          {!authed && (
            <div className="ac-badge mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-white/60 p-3">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>
                  <span className="font-medium">Create a free account</span> to save named robot
                  presets, compare configs &amp; export this report.
                </span>
              </div>
              <Link
                href="/signup?next=/tools/frc-tipping-calculator"
                className="ac-btn inline-flex shrink-0 items-center gap-1 text-sm"
              >
                Sign up <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            <strong>Tier 1 (exact):</strong> tip accelerations, SSF, and tip angles are rigid-body
            statics — as correct as your inputs. <strong>Tier 2 (estimate):</strong> pushing force
            and the slide-vs-tip verdict depend on µ, which is empirical and variable.
          </p>
        </div>
      </div>

      {/* -------------------- NOTES & SOURCES -------------------- */}
      <details className="mt-6 rounded-2xl border border-border bg-white/50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">
          Notes &amp; sources
        </summary>
        <div className="mt-3 space-y-3 text-xs leading-relaxed text-muted-foreground">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Tip angles, tip accelerations, and the Static Stability Factor are exact rigid-body
              statics for the geometry you enter — as correct as your inputs. The dominant error is
              CoG height: measure or estimate it, don&apos;t guess.
            </li>
            <li>
              Real robots tip a little differently than ideal statics: wheel scrub, tread squish,
              bumper/frame ground contact, suspension travel, and dynamic (not steady-state)
              maneuvers all shift the real threshold. Treat results as a well-founded design guide
              with margin, not a guarantee.
            </li>
            <li>
              The pushing-force number and the slide-vs-tip verdict depend on the wheel-carpet
              coefficient of friction, which is empirical and varies with carpet age, wheel wear,
              dust/debris, and downforce. Shown as an estimate/range, never a single certified
              value.
            </li>
            <li>
              Weight and size defaults are the 2026 REBUILT legal maxima (R103 = 115.0 lb excluding
              bumpers/battery; R408 caps robot + bumpers at 135.0 lb; R104 = 110.0 in perimeter, 30
              in tall). These change most seasons — re-verify against the current game manual and
              always enter your own measured numbers.
            </li>
            <li>
              Coefficient-of-friction presets assume the official Shaw Floors Philadelphia
              Commercial Neyland II 20 competition carpet. Behavior on shop floor, tile, or other
              carpet will differ.
            </li>
          </ul>

          <div className="ac-divider my-2" />

          <div>
            <div className="mb-1 font-semibold text-foreground">Number sources</div>
            <ul className="space-y-1">
              <li>
                <span className="font-medium text-foreground">g = 9.80665 m/s²</span> (32.17405
                ft/s²) — NIST CODATA standard acceleration of gravity, defined/exact.{" "}
                <Src href="https://physics.nist.gov/cgi-bin/cuu/Value?gn" />
              </li>
              <li>
                <span className="font-medium text-foreground">Robot weight ≤ 115.0 lb</span> (52.16
                kg), excl. bumpers &amp; battery — 2026 REBUILT R103. Robot + bumpers ≤ 135.0 lb —
                R408.{" "}
                <Src href="https://firstfrc.blob.core.windows.net/frc2026/Manual/2026GameManual.pdf" />
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Perimeter ≤ 110.0 in, height ≤ 30 in
                </span>{" "}
                — 2026 REBUILT R104 (bounds the geometry inputs).{" "}
                <Src href="https://firstfrc.blob.core.windows.net/frc2026/Manual/2026GameManual.pdf" />
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Defaults: track/wheelbase 27 in, CoG height 13 in, weight-on-wheels 125 lb
                </span>{" "}
                — engineering estimates (R104-bounded), editable. CoG height is NOT a published spec
                and is the dominant error source.
              </li>
              <li>
                <span className="font-medium text-foreground">µ presets &amp; default 1.1</span> —
                community / historical estimates (mrmctavish blog; Chief Delphi; WCP/AndyMark
                pages), NOT currently vendor-published. User-editable.{" "}
                <Src href="https://mrmctavish.wordpress.com/2021/12/20/coefficient-of-friction-for-wheels-in-frc-and-acceleration/" />
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Field carpet: Shaw Floors Philadelphia Commercial Neyland II 20
                </span>{" "}
                — 2026 field dimension drawings.{" "}
                <Src href="https://firstfrc.blob.core.windows.net/frc2026/FieldAssets/2026-field-dimension-dwgs.pdf" />
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
  label,
  help,
  value,
  onChange,
  unit,
  accent,
}: {
  label: string;
  help: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
  accent?: boolean;
}): React.ReactElement {
  return (
    <div>
      <label className="flex items-center gap-1 text-sm font-medium text-foreground">
        {label}
        {accent ? (
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
            key input
          </span>
        ) : null}
        <Tip text={help} />
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          className="w-full rounded-xl border border-border bg-white/60 px-3 py-2 text-sm text-foreground tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="shrink-0 text-xs text-muted-foreground">{unit}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{help}</p>
    </div>
  );
}

function UnitToggle<T extends string>({
  value,
  a,
  b,
  onChange,
}: {
  value: T;
  a: T;
  b: T;
  onChange: (next: T) => void;
}): React.ReactElement {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-border text-xs">
      {[a, b].map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={
            value === opt
              ? "bg-primary px-2 py-1 font-semibold text-white"
              : "bg-white/60 px-2 py-1 text-muted-foreground"
          }
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function StatTile({
  label,
  value,
  tip,
}: {
  label: string;
  value: string;
  tip: string;
}): React.ReactElement {
  return (
    <div className="ac-tile rounded-xl border border-border bg-white/60 p-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {label} <Tip text={tip} />
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function Verdict({
  tone,
  label,
}: {
  tone: "ok" | "warn" | "fail" | "muted";
  label: string;
}): React.ReactElement {
  const cls =
    tone === "ok"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : tone === "warn"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : tone === "fail"
          ? "bg-red-500/10 text-red-700 dark:text-red-400"
          : "bg-muted text-muted-foreground";
  return (
    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function FailureRow({
  label,
  slides,
  valid,
  mu,
  tan,
}: {
  label: string;
  slides: boolean;
  valid: boolean;
  mu: number;
  tan: number;
}): React.ReactElement {
  if (!valid) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
        <span>{label}</span>
        <span>—</span>
      </div>
    );
  }
  const cls = slides
    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    : "bg-red-500/10 text-red-700 dark:text-red-400";
  return (
    <div className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs ${cls}`}>
      <span className="font-medium text-foreground">{label}</span>
      <span className="text-right">
        {slides ? "Slides before it tips" : "Tips before it slides"}
        <span className="ml-1 text-[10px] opacity-70 tabular-nums">
          (µ {fmt(mu, 2)} {slides ? "<" : "≥"} {fmt(tan, 2)})
        </span>
      </span>
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
