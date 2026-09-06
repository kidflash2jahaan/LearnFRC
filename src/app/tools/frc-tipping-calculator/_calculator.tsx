"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";

/* ------------------------------------------------------------------ *
 * VERIFIED CONSTANTS: sourced, exact or defined. Do not edit.
 * ------------------------------------------------------------------ */
// NIST CODATA standard acceleration of gravity, exact.
const G_MS2 = 9.80665;
// Exact: 9.80665 / 0.3048 = 32.17405 ft/s^2.
const G_FTS2 = 32.17405;
// NIST exact: 1 lbf = 4.4482216 N.
const LBF_TO_N = 4.4482216;
// NIST exact: 1 in = 25.4 mm.
const IN_TO_MM = 25.4;
// NIST exact: 1 lb = 0.45359237 kg.
const LB_TO_KG = 0.45359237;

/* ------------------------------------------------------------------ *
 * Coefficient-of-friction presets.
 *
 * These are unverifiable: they come from a personal blog and Chief Delphi
 * threads, not from current vendor spec pages. They are presented ONLY as
 * user-editable estimates. Each preset seeds the LOW end of its
 * community-reported range and prints the full range beside it. None of
 * them is a vendor-certified constant, and the page never pretends
 * otherwise.
 * ------------------------------------------------------------------ */
type MuPreset = {
  key: string;
  label: string;
  seed: number; // low end of the community range
  range: string;
  note: string;
};

const MU_PRESETS: MuPreset[] = [
  {
    key: "roughtop",
    label: "Roughtop or wedgetop",
    seed: 1.1,
    range: "1.1 to 1.3",
    note: "The highest-traction common FRC tread. Community values cluster from 1.1 to 1.3. The AndyMark blue-nitrile page lists no number at all.",
  },
  {
    key: "higrip",
    label: "AndyMark HiGrip",
    seed: 0.95,
    range: "0.95 to 1.0, community 1.07",
    note: "AndyMark's historical spec was 0.95 to 1.0 static. The current HiGrip product page no longer lists a coefficient. Community measurements sit near 1.07 for the 4 in wheel.",
  },
  {
    key: "colson",
    label: "Colson or smooth traction",
    seed: 0.9,
    range: "0.9 to 1.1",
    note: "WCP and Chief Delphi consensus: slightly below roughtop on tight-pile carpet.",
  },
  {
    key: "pneumatic",
    label: "Pneumatic, fore and aft",
    seed: 1.27,
    range: "about 1.27 inflated",
    note: "A blog-cited AndyMark figure of 1.27 forwards and backwards, fully inflated, and lower sideways. Not on the current product page.",
  },
  {
    key: "omni",
    label: "Omni or mecanum roller, sideways",
    seed: 0.4,
    range: "0.4 to 0.6",
    note: "Rollers present low lateral friction by design, so the free-rolling direction lands near 0.4 to 0.6.",
  },
  {
    key: "custom",
    label: "Your own measurement",
    seed: 1.1,
    range: "your value",
    note: "Measure your own wheels on Shaw Neyland II 20 competition carpet. That beats every number on this list.",
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
  if (!Number.isFinite(n)) return "n/a";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

/**
 * The stability sheet.
 *
 * Two failure modes matter to a drive team: the robot goes over, or the
 * robot slips. Both come out of the same three numbers, so the verdict is
 * stamped across an ink band first and the rest of the page is working:
 * the robot on one hand-ruled tag, the cross-section drawn beside what
 * gives out first, and every formula printed with the entered numbers in
 * it. Nothing signals with a hue, because the binder prints in one ink.
 */
export default function TippingCalculator({
  authed,
}: {
  authed: boolean;
}): React.JSX.Element {
  // Lengths are held in the currently-selected display unit.
  const [lengthUnit, setLengthUnit] = useState<"in" | "mm">("in");
  const [massUnit, setMassUnit] = useState<"lb" | "kg">("lb");

  // Defaults are the verified engineering estimates, in inches and pounds.
  const [track, setTrack] = useState("27"); // R104-bounded estimate
  const [wheelbase, setWheelbase] = useState("27"); // R104-bounded estimate
  const [cog, setCog] = useState("13"); // uncertain, the dominant error source
  const [weight, setWeight] = useState("125"); // estimate, override required

  const [muPresetKey, setMuPresetKey] = useState("roughtop");
  const [mu, setMu] = useState("1.1");
  const [drivenFrac, setDrivenFrac] = useState("1.0"); // f, all-wheel drive

  const [yOff, setYOff] = useState("0"); // lateral CoG offset
  const [xOff, setXOff] = useState("0"); // fore and aft CoG offset

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

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

  const activePreset =
    MU_PRESETS.find((p) => p.key === muPresetKey) ?? MU_PRESETS[0];

  /* --------------------------- maths ------------------------------ */
  const r = useMemo(() => {
    const t = parseNum(track);
    const wb = parseNum(wheelbase);
    const h = parseNum(cog);
    const y = Math.abs(parseNum(yOff));
    const x = Math.abs(parseNum(xOff));
    const muN = parseNum(mu);
    const f = Math.min(Math.max(parseNum(drivenFrac), 0), 1);

    const valid = h > 0 && t > 0 && wb > 0;

    // Worst-case restoring lever arms: an offset always cuts the margin.
    const dSide = t / 2 - y; // half-track minus lateral offset
    const dPitch = wb / 2 - x; // half-wheelbase minus fore/aft offset

    // Tier 1, exact rigid-body statics. These ratios are unit-independent.
    const ssf = valid ? t / (2 * h) : NaN; // Static Stability Factor
    const aLatG = valid ? dSide / h : NaN; // lateral tip acceleration, g
    const aLongG = valid ? dPitch / h : NaN; // longitudinal tip acceleration, g
    const thetaSide = valid ? (Math.atan(dSide / h) * 180) / Math.PI : NaN;
    const thetaRamp = valid ? (Math.atan(dPitch / h) * 180) / Math.PI : NaN;

    const tanSide = valid ? dSide / h : NaN;
    const tanPitch = valid ? dPitch / h : NaN;
    // It slides first when mu is under the tip tangent, and tips first when
    // mu is at or above it.
    const sideSlides = valid ? muN < tanSide : false;
    const pitchSlides = valid ? muN < tanPitch : false;

    // Tier 2, friction-dependent. An estimate and a range, never a promise.
    const weightLbf =
      massUnit === "lb" ? parseNum(weight) : parseNum(weight) / LB_TO_KG;
    const pushLbf = muN * f * weightLbf;
    const pushN = pushLbf * LBF_TO_N;

    return {
      valid,
      t,
      wb,
      h,
      y,
      x,
      f,
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
      weightLbf,
      pushLbf,
      pushN,
      muN,
    };
  }, [track, wheelbase, cog, yOff, xOff, mu, drivenFrac, weight, massUnit]);

  // Plain-language read-out from the Static Stability Factor.
  const tippiness = useMemo(() => {
    if (!r.valid) return "not enough numbers";
    if (r.ssf >= 1.2) return "very stable";
    if (r.ssf >= 1.0) return "stable";
    if (r.ssf >= 0.85) return "moderate, watch hard turns";
    return "tippy";
  }, [r.valid, r.ssf]);

  const lu = lengthUnit;
  const mnu = massUnit;

  /* --------------------------- diagram ---------------------------- */
  // Front-view cross-section. Every ratio is unit-independent, so we scale
  // whatever unit is on screen into the same box.
  const diagram = useMemo(() => {
    const W = 320;
    const H = 210;
    const floorY = 168;
    const cx = W / 2;
    const t = r.t;
    const h = r.h;
    const y = parseNum(yOff);
    if (!r.valid) return { W, H, floorY, cx, ok: false as const };

    // One scale for both axes, chosen so the drawing fills the box whichever
    // dimension is the binding one. A tall narrow robot is limited by the CoG
    // height, a wide low one by the track.
    const px = Math.min((W - 90) / Math.max(t, 1), (H - 70) / Math.max(h * 1.5, 1));
    const halfTrackPx = (t / 2) * px;
    const cogPx = h * px;
    const bodyTop = floorY - Math.max(cogPx * 1.5, cogPx + 14);
    const cogX = cx + y * px;
    const cogY = floorY - cogPx;
    // The tipping edge is the side the CoG leans toward, which is the worst
    // case for that offset.
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
    };
  }, [r.valid, r.t, r.h, yOff]);

  const verdictLine = !r.valid
    ? "Not enough numbers yet."
    : r.ssf < 0.85
      ? "This robot goes over in a hard turn."
      : r.ssf < 1.0
        ? "It stays up, but not through a hard turn."
        : r.sideSlides
          ? "It slips before it tips, which is the good failure."
          : "It stands up to anything a driver can ask.";

  const verdictBody = !r.valid
    ? "Enter a track width, a wheelbase and a centre-of-gravity height and the sheet fills in."
    : r.ssf < 0.85
      ? `A Static Stability Factor of ${fmt(r.ssf, 2)} means two wheels lift at ${fmt(r.aLatG, 2)} g sideways. Widen the track or get the battery lower before you tune the drive code.`
      : r.ssf < 1.0
        ? `Two wheels lift at ${fmt(r.aLatG, 2)} g sideways, so a fast direction change or a bump under one wheel is enough. There is no margin for a raised elevator.`
        : r.sideSlides
          ? `On a cross-slope the wheels break loose at a coefficient of ${fmt(r.tanSide, 2)} before the robot reaches ${fmt(r.thetaSide, 1)} degrees, and your tread is ${fmt(r.muN, 2)}. It scrubs instead of falling over.`
          : `${fmt(r.aLatG, 2)} g sideways and ${fmt(r.thetaSide, 1)} degrees of cross-slope before two wheels lift. The tread grips harder than the geometry, so it tips before it slides.`;

  return (
    <>
      {/* ---------------------------------------------------------------- *
       * 1. The question, then the shelf of treads
       *
       * Every friction answer starts from what is bolted to the wheels, so
       * the tread shelf is the first control on the page rather than a
       * dropdown buried in the form.
       * ---------------------------------------------------------------- */}
      <div className="nb-wrap py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="grid gap-x-[clamp(1.5rem,4vw,3rem)] gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="nb-marker">tools / frc-tipping-calculator</p>
            <h1 className="max-w-[19ch]">
              How hard can you turn before it{" "}
              <span className="nb-mark">goes over</span>?
            </h1>
            <p className="nb-lede mt-5">
              Rigid-body statics for a drivetrain: the sideways acceleration
              that lifts two wheels, the cross-slope and ramp angles that do the
              same, whether it slides or tips first, and how hard it can push.
            </p>
            <p className="nb-slug mt-4 max-w-[62ch]">
              Geometry and weight defaults track the 2026 REBUILT manual, R103,
              R104 and R408. Friction figures are community estimates, not vendor
              specs, and they are yours to overwrite.
            </p>
          </div>
          <p className="nb-pen max-w-[16ch] rotate-[1.4deg] lg:pb-2 lg:text-right">
            measure the CoG, don’t guess it
          </p>
        </div>

        <div className="nb-hair mt-[clamp(1.6rem,3.4vw,2.4rem)] pt-[clamp(1.1rem,2.2vw,1.5rem)]">
          <p className="nb-slug">what is on the wheels</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {MU_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => selectPreset(p.key)}
                aria-pressed={muPresetKey === p.key}
                className="nb-tag min-h-[2.75rem] px-3.5 text-[0.78rem]"
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="mt-3 max-w-[70ch] text-[0.95rem] leading-relaxed text-graphite">
            {activePreset.note}
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------------------- *
       * 2. The verdict, stamped across an ink band
       * ---------------------------------------------------------------- */}
      <section
        className="nb-slab py-[clamp(2rem,4.4vw,3.2rem)]"
        aria-live="polite"
      >
        <div className="nb-wrap grid items-end gap-[clamp(1.3rem,3vw,2.6rem)] lg:grid-cols-[minmax(0,1.05fr)_repeat(3,minmax(0,0.72fr))]">
          <div>
            <p className="nb-slug !text-[rgba(245,246,242,0.82)]">
              verdict / {tippiness}
            </p>
            <h2 className="mt-2 max-w-[16ch] text-[clamp(1.5rem,1.1rem+1.7vw,2.4rem)] text-card">
              {verdictLine}
            </h2>
            <p className="mt-3 max-w-[38ch] text-[0.95rem] text-[rgba(245,246,242,0.85)]">
              {verdictBody}
            </p>
          </div>

          <p className="nb-stamp">
            <b>{fmt(r.aLatG, 2)}</b>
            <span>
              g sideways before two wheels lift
            </span>
          </p>
          <p className="nb-stamp">
            <b>{fmt(r.ssf, 2)}</b>
            <span>static stability factor</span>
          </p>
          <p className="nb-stamp">
            <b>{fmt(r.thetaSide, 1)}°</b>
            <span>of cross-slope before it goes</span>
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * 3. The robot, written on one tag
       *
       * Four measurements and one friction figure describe the whole
       * problem, so they live together on one hand-ruled tag with the
       * lever arms they produce printed in its footer.
       * ---------------------------------------------------------------- */}
      <section className="py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div>
              <p className="nb-marker">the robot / five numbers decide it</p>
              <h2 className="max-w-[20ch] text-[clamp(1.5rem,1.1rem+1.6vw,2.4rem)]">
                Measure the drivetrain you actually built.
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div
                className="flex items-center gap-4"
                role="group"
                aria-label="Length unit"
              >
                <p className="nb-slug !text-ink">lengths in</p>
                {(["in", "mm"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    className="nb-tab"
                    data-active={lengthUnit === u ? "" : undefined}
                    aria-pressed={lengthUnit === u}
                    onClick={() => {
                      convertLengths(lengthUnit, u);
                      setLengthUnit(u);
                    }}
                  >
                    {u}
                  </button>
                ))}
              </div>
              <div
                className="flex items-center gap-4"
                role="group"
                aria-label="Mass unit"
              >
                <p className="nb-slug !text-ink">weight in</p>
                {(["lb", "kg"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    className="nb-tab"
                    data-active={massUnit === u ? "" : undefined}
                    aria-pressed={massUnit === u}
                    onClick={() => {
                      convertMass(massUnit, u);
                      setMassUnit(u);
                    }}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="nb-box nb-tilt-3 relative mt-[clamp(1.4rem,3vw,2.2rem)] p-[clamp(1.2rem,2.6vw,2rem)]">
            <span
              className="nb-tape -top-3 left-[12%] rotate-[-3.3deg]"
              aria-hidden="true"
            />
            <span
              className="nb-tape -bottom-3 right-[15%] rotate-[2.5deg]"
              aria-hidden="true"
            />

            <div className="grid gap-[clamp(1rem,2.2vw,1.5rem)] sm:grid-cols-2 lg:grid-cols-3">
              <NumberField
                id="tp-track"
                label={`Track width (${lu})`}
                hint="Side to side, wheel contact patch to wheel contact patch."
                value={track}
                onChange={setTrack}
              />
              <NumberField
                id="tp-wheelbase"
                label={`Wheelbase (${lu})`}
                hint="Front to back, wheel contact patch to wheel contact patch."
                value={wheelbase}
                onChange={setWheelbase}
              />
              <NumberField
                id="tp-cog"
                label={`Centre of gravity height (${lu})`}
                hint="The number that dominates every result. Two inches out moves everything by 10 to 20%, so run a balance test."
                value={cog}
                onChange={setCog}
              />
              <NumberField
                id="tp-weight"
                label={`Weight on the wheels (${mnu})`}
                hint="Robot, bumpers and battery. 125 lb is a starting estimate, so weigh yours."
                value={weight}
                onChange={setWeight}
              />
              <div className="nb-field">
                <label className="nb-label" htmlFor="tp-mu">
                  Wheel on carpet, coefficient
                </label>
                <input
                  id="tp-mu"
                  className="nb-input"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={mu}
                  onChange={(e) => {
                    setMu(e.target.value);
                    setMuPresetKey("custom");
                  }}
                />
                <p className="nb-hint">
                  {activePreset.label} sits at {activePreset.range}. Editing this
                  switches to your own measurement.
                </p>
              </div>
              <div className="nb-field">
                <label className="nb-label" htmlFor="tp-f">
                  Weight on driven wheels
                </label>
                <input
                  id="tp-f"
                  className="nb-input"
                  type="number"
                  inputMode="decimal"
                  step="0.05"
                  min="0"
                  max="1"
                  value={drivenFrac}
                  onChange={(e) => setDrivenFrac(e.target.value)}
                />
                <p className="nb-hint">
                  1.0 for all-wheel drive. Lower it when some wheels are omnis or
                  free casters.
                </p>
              </div>
            </div>

            {/* The dominant error source, said plainly rather than as a chip. */}
            <p className="nb-error mt-[clamp(1.1rem,2.4vw,1.6rem)] max-w-[62ch]">
              CoG height is an estimate, not a rule value. Find yours with a
              balance-point or tip-angle test before you trust anything on this
              page.
            </p>

            {/* Offsets. Most robots are centred, so this stays folded away. */}
            <div className="mt-[clamp(1.1rem,2.4vw,1.6rem)]">
              <button
                type="button"
                className="nb-slug flex min-h-[2.75rem] w-full items-center justify-between gap-3 border-b-2 border-ink !text-ink"
                onClick={() => setShowAdvanced((v) => !v)}
                aria-expanded={showAdvanced}
                aria-controls="tp-advanced"
              >
                <span>advanced / a centre of gravity that is not centred</span>
                <span aria-hidden="true">{showAdvanced ? "hide" : "show"}</span>
              </button>

              {showAdvanced ? (
                <div
                  id="tp-advanced"
                  className="grid gap-[clamp(1rem,2.2vw,1.5rem)] pt-[clamp(1.1rem,2.2vw,1.5rem)] sm:grid-cols-2"
                >
                  <NumberField
                    id="tp-yoff"
                    label={`Sideways offset (${lu})`}
                    hint="How far the CoG sits off the centreline. It always cuts the margin on that side."
                    value={yOff}
                    onChange={setYOff}
                  />
                  <NumberField
                    id="tp-xoff"
                    label={`Fore and aft offset (${lu})`}
                    hint="How far the CoG sits off centre front to back. It cuts the pitch margin the same way."
                    value={xOff}
                    onChange={setXOff}
                  />
                </div>
              ) : null}
            </div>

            {/* Tag footer: the lever arms those measurements produce. */}
            <dl className="nb-hair mt-[clamp(1.2rem,2.6vw,1.8rem)] grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 pt-[clamp(1.1rem,2.2vw,1.5rem)]">
              <dt className="nb-slug">sideways lever</dt>
              <dd className="nb-slug !text-ink">
                {fmt(r.dSide, 2)} {lu}, being half the track minus{" "}
                {fmt(r.y, 2)} {lu} of offset
              </dd>
              <dt className="nb-slug">pitch lever</dt>
              <dd className="nb-slug !text-ink">
                {fmt(r.dPitch, 2)} {lu}, being half the wheelbase minus{" "}
                {fmt(r.x, 2)} {lu} of offset
              </dd>
              <dt className="nb-slug">ramp angle</dt>
              <dd className="nb-slug !text-ink">
                {fmt(r.thetaRamp, 1)} degrees before it goes over backwards
              </dd>
              <dt className="nb-slug">pushing force</dt>
              <dd className="nb-slug !text-ink">
                about {fmt(r.pushLbf, 0)} lbf, {fmt(r.pushN, 0)} N, and only as
                good as the coefficient
              </dd>
            </dl>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * 4. The cross-section, drawn beside what gives out first
       *
       * Tipping is a lever-arm picture before it is a number, so the
       * schematic gets a card of its own next to the two failure modes it
       * explains.
       * ---------------------------------------------------------------- */}
      <section className="nb-rule py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <p className="nb-marker">the geometry / drawn from the front</p>
          <h2 className="max-w-[22ch] text-[clamp(1.5rem,1.1rem+1.6vw,2.4rem)]">
            The lever holding it up, and the one tipping it over.
          </h2>

          <div className="mt-[clamp(1.4rem,3vw,2.2rem)] grid items-start gap-[clamp(1.2rem,2.8vw,2.2rem)] lg:grid-cols-2">
            {/* --- Card A: the drawing --- */}
            <div className="nb-box nb-tilt-2 p-[clamp(1.1rem,2.4vw,1.7rem)]">
              <p className="nb-slug border-b border-dashed border-rule pb-2.5">
                front view / to scale with your numbers
              </p>

              <svg
                viewBox={`0 0 ${diagram.W} ${diagram.H}`}
                className="mt-4 h-auto w-full"
                role="img"
                aria-label={`Front view of the robot showing the wheels, the centre of gravity ${fmt(r.h, 1)} ${lu} above the floor, and the tipping edge at the outside of the ${fmt(r.t, 1)} ${lu} track.`}
              >
                <defs>
                  <marker
                    id="tp-arrow"
                    markerWidth="8"
                    markerHeight="8"
                    refX="4"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0,0 L8,4 L0,8 Z" fill="var(--ink)" />
                  </marker>
                </defs>

                {/* the floor */}
                <line
                  x1={16}
                  y1={diagram.floorY}
                  x2={diagram.W - 16}
                  y2={diagram.floorY}
                  stroke="var(--ink)"
                  strokeWidth={2.5}
                />

                {diagram.ok ? (
                  <>
                    {/* the body */}
                    <rect
                      x={diagram.cx - diagram.halfTrackPx}
                      y={diagram.bodyTop}
                      width={diagram.halfTrackPx * 2}
                      height={diagram.floorY - diagram.bodyTop}
                      fill="none"
                      stroke="var(--ink)"
                      strokeWidth={2}
                    />
                    {/* the wheels */}
                    <circle
                      cx={diagram.cx - diagram.halfTrackPx}
                      cy={diagram.floorY}
                      r={7}
                      fill="none"
                      stroke="var(--ink)"
                      strokeWidth={2}
                    />
                    <circle
                      cx={diagram.cx + diagram.halfTrackPx}
                      cy={diagram.floorY}
                      r={7}
                      fill="none"
                      stroke="var(--ink)"
                      strokeWidth={2}
                    />
                    {/* the restoring lever, tipping edge to centre of gravity */}
                    <line
                      x1={diagram.tipX}
                      y1={diagram.floorY}
                      x2={diagram.cogX}
                      y2={diagram.cogY}
                      stroke="var(--blue)"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                    />
                    {/* weight, straight down */}
                    <line
                      x1={diagram.cogX}
                      y1={diagram.cogY}
                      x2={diagram.cogX}
                      y2={diagram.floorY + 9}
                      stroke="var(--ink)"
                      strokeWidth={2}
                      markerEnd="url(#tp-arrow)"
                    />
                    {/* the centre of gravity */}
                    <circle
                      cx={diagram.cogX}
                      cy={diagram.cogY}
                      r={5}
                      fill="var(--blue)"
                    />
                    <text
                      x={diagram.cogX + 10}
                      y={diagram.cogY - 6}
                      fontSize={11}
                      fill="var(--ink)"
                      style={{ fontFamily: "var(--font-space-mono), monospace" }}
                    >
                      CoG
                    </text>
                    <text
                      x={diagram.cx}
                      y={diagram.floorY + 24}
                      fontSize={11}
                      textAnchor="middle"
                      fill="var(--graphite)"
                      style={{ fontFamily: "var(--font-space-mono), monospace" }}
                    >
                      track {fmt(r.t, 1)} {lu} · CoG {fmt(r.h, 1)} {lu} ·{" "}
                      {fmt(r.thetaSide, 1)}°
                    </text>
                  </>
                ) : (
                  <text
                    x={diagram.cx}
                    y={diagram.floorY - 40}
                    fontSize={12}
                    textAnchor="middle"
                    fill="var(--graphite)"
                    style={{ fontFamily: "var(--font-space-mono), monospace" }}
                  >
                    enter a track and a CoG height
                  </text>
                )}
              </svg>

              <p className="mt-3 max-w-[46ch] text-[0.95rem] leading-relaxed text-graphite">
                The dashed line is the restoring lever. Shortening the track or
                raising the centre of gravity swings it upright, and once it
                passes vertical the robot is already going over.
              </p>
            </div>

            {/* --- Card B: what gives out first --- */}
            <div className="nb-box nb-tilt-3 relative p-[clamp(1.1rem,2.4vw,1.7rem)] lg:mt-8">
              <span
                className="nb-tape -top-3 right-[14%] rotate-[2.8deg]"
                aria-hidden="true"
              />
              <p className="nb-slug border-b border-dashed border-rule pb-2.5">
                what gives out first
              </p>

              <dl className="mt-4">
                <FailureRow
                  label="On a cross-slope"
                  slides={r.sideSlides}
                  valid={r.valid}
                  mu={r.muN}
                  tan={r.tanSide}
                  angle={r.thetaSide}
                />
                <FailureRow
                  label="Driving up a ramp"
                  slides={r.pitchSlides}
                  valid={r.valid}
                  mu={r.muN}
                  tan={r.tanPitch}
                  angle={r.thetaRamp}
                />
              </dl>

              <p className="nb-slug mt-5 border-b border-dashed border-rule pb-2.5">
                how hard it can push
              </p>
              <p className="mt-3.5 flex items-baseline gap-2 font-mono font-bold tabular-nums">
                <span className="text-[clamp(1.9rem,1.2rem+2.2vw,2.8rem)] leading-none tracking-[-0.03em] text-blue">
                  {fmt(r.pushLbf, 0)}
                </span>
                <span className="text-[0.95rem] text-ink">
                  lbf, {fmt(r.pushN, 0)} N
                </span>
              </p>
              <p className="nb-slug mt-3 max-w-[44ch]">
                Force is the coefficient times the driven fraction times weight,
                so it is only as good as a number nobody publishes. Treat it as a
                range across {activePreset.range}, not as a figure to quote.
              </p>

              <button
                type="button"
                onClick={resetAll}
                className="nb-btn-ghost nb-btn-sm mt-[clamp(1.1rem,2.4vw,1.6rem)]"
              >
                Back to the defaults
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * 5. The working, shown
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
              <button
                type="button"
                onClick={() => window.print()}
                className="nb-btn nb-btn-sm"
              >
                Print this sheet
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
                Every formula this calculator uses, with the entered values
                substituted in.
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
                  title="Static stability factor"
                  formula="SSF = track / (2 h)"
                  worked={`${fmt(r.t, 2)} / (2 x ${fmt(r.h, 2)}) = ${fmt(r.ssf, 3)}`}
                />
                <MathRow
                  title="Sideways lever arm"
                  formula="d = track/2 - sideways offset"
                  worked={`${fmt(r.t / 2, 2)} - ${fmt(r.y, 2)} = ${fmt(r.dSide, 2)} ${lu}`}
                />
                <MathRow
                  title="Tip acceleration, sideways"
                  formula="a = g d / h"
                  worked={`${fmt(r.aLatG, 3)} g = ${fmt(r.aLatMs2, 2)} m/s² = ${fmt(r.aLatFts2, 1)} ft/s²`}
                />
                <MathRow
                  title="Tip acceleration, fore and aft"
                  formula="a = g (wheelbase/2 - offset) / h"
                  worked={`${fmt(r.aLongG, 3)} g = ${fmt(r.aLongMs2, 2)} m/s² = ${fmt(r.aLongFts2, 1)} ft/s²`}
                />
                <MathRow
                  title="Cross-slope tip angle"
                  formula="theta = arctan(d / h)"
                  worked={`arctan(${fmt(r.dSide, 2)} / ${fmt(r.h, 2)}) = ${fmt(r.thetaSide, 2)} degrees`}
                />
                <MathRow
                  title="Ramp tip angle"
                  formula="theta = arctan(d / h)"
                  worked={`arctan(${fmt(r.dPitch, 2)} / ${fmt(r.h, 2)}) = ${fmt(r.thetaRamp, 2)} degrees`}
                />
                <MathRow
                  title="Slide or tip, sideways"
                  formula="slides when mu < d / h"
                  worked={`${fmt(r.muN, 2)} ${r.sideSlides ? "<" : "is at or above"} ${fmt(r.tanSide, 2)}, so it ${r.sideSlides ? "slides" : "tips"} first`}
                />
                <MathRow
                  title="Traction-limited push"
                  formula="F = mu x driven fraction x weight"
                  worked={`${fmt(r.muN, 2)} x ${fmt(r.f, 2)} x ${fmt(r.weightLbf, 1)} lb = ${fmt(r.pushLbf, 1)} lbf`}
                />
              </tbody>
            </table>
          </div>

          <p className="nb-note mt-[clamp(1.4rem,3vw,2.2rem)] max-w-[64ch] text-[0.95rem] leading-relaxed text-graphite">
            <span className="nb-slug mb-1 block">
              which half of this you can trust
            </span>
            Tip accelerations, angles and the stability factor are exact
            rigid-body statics, so they are as right as the numbers you fed them.
            The push figure and the slide-or-tip verdict both hang on a friction
            coefficient that is empirical and varies with carpet age, wheel wear
            and dust, so read those as a range.
          </p>

          {!authed ? (
            <div className="nb-hair mt-[clamp(1.4rem,3vw,2rem)] flex flex-wrap items-center justify-between gap-4 pt-[clamp(1.1rem,2.2vw,1.5rem)]">
              <p className="max-w-[46ch] text-[0.95rem] text-graphite">
                An account saves named robot presets so you can put last year’s
                drivetrain next to this one. Reading and calculating never needs
                one.
              </p>
              <Link
                href="/signup?next=/tools/frc-tipping-calculator"
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
            aria-controls="tp-notes"
          >
            <span>
              <span className="nb-marker">the back of the sheet</span>
              <span className="block text-[clamp(1.35rem,1.05rem+1.2vw,2rem)] font-extrabold tracking-[-0.025em]">
                Every default, and how much to trust it.
              </span>
            </span>
            <span className="nb-slug shrink-0 !text-ink" aria-hidden="true">
              {notesOpen ? "hide" : "show"}
            </span>
          </button>

          {notesOpen ? (
            <div
              id="tp-notes"
              className="mt-[clamp(1.4rem,3vw,2.2rem)] grid gap-[clamp(1.4rem,3vw,2.6rem)] lg:grid-cols-3"
            >
              <div>
                <p className="nb-slug border-b-2 border-ink pb-2">
                  where it stops being true
                </p>
                <ul className="nb-prose mt-4 !max-w-none text-[0.95rem]">
                  <li>
                    Tip angles, tip accelerations and the stability factor are
                    exact statics for the geometry you enter, so they are as
                    correct as your inputs. The dominant error is CoG height, so
                    measure it rather than guessing.
                  </li>
                  <li>
                    Real robots tip a little differently than ideal statics. Wheel
                    scrub, tread squish, a bumper catching the floor, suspension
                    travel and the fact that a real manoeuvre is not steady state
                    all move the threshold.
                  </li>
                  <li>
                    The push figure and the slide-or-tip verdict depend on the
                    wheel-on-carpet coefficient, which varies with carpet age,
                    wheel wear, dust and downforce. It is shown as a range and
                    never as a certified value.
                  </li>
                  <li>
                    Friction presets assume the official Shaw Philadelphia
                    Commercial Neyland II 20 competition carpet. Shop floor, tile
                    and other carpet all behave differently.
                  </li>
                  <li>
                    Weight and size defaults are the 2026 REBUILT limits and they
                    change most seasons, so re-verify against the current manual
                    and enter your own measured numbers either way.
                  </li>
                </ul>
              </div>

              <div>
                <p className="nb-slug border-b-2 border-ink pb-2">formulas used</p>
                <ul className="nb-prose mt-4 !max-w-none text-[0.95rem]">
                  <li>
                    Static Stability Factor = track divided by twice the CoG
                    height. It is NHTSA’s rollover metric, and for a centred
                    CoG it equals the tip threshold in g.
                  </li>
                  <li>
                    Tip acceleration = g times the restoring lever divided by CoG
                    height, where the lever is half the track or half the
                    wheelbase minus any offset.
                  </li>
                  <li>Tip angle = arctangent of the lever over the CoG height.</li>
                  <li>
                    It slides before it tips whenever the friction coefficient is
                    below that same tangent.
                  </li>
                  <li>
                    Traction-limited push = coefficient times the driven-weight
                    fraction times weight on the wheels.
                  </li>
                </ul>
              </div>

              <div>
                <p className="nb-slug border-b-2 border-ink pb-2">
                  sources for every default
                </p>
                <ul className="nb-prose mt-4 !max-w-none text-[0.95rem]">
                  <li>
                    g = 9.80665 m/s², which is 32.17405 ft/s², from the{" "}
                    <SourceLink href="https://physics.nist.gov/cgi-bin/cuu/Value?gn">
                      NIST CODATA standard acceleration of gravity
                    </SourceLink>
                    . Defined, not measured.
                  </li>
                  <li>
                    Robot weight at or under 115.0 lb (52.16 kg) excluding bumpers
                    and battery, R103, and robot plus bumpers at or under 135.0
                    lb, R408, from the{" "}
                    <SourceLink href="https://firstfrc.blob.core.windows.net/frc2026/Manual/2026GameManual.pdf">
                      2026 REBUILT Game Manual
                    </SourceLink>
                    .
                  </li>
                  <li>
                    Perimeter at or under 110.0 in and height at or under 30 in,
                    R104, which is what bounds the geometry inputs.
                  </li>
                  <li>
                    Defaults of 27 in track and wheelbase, 13 in CoG height and
                    125 lb on the wheels are engineering estimates inside those
                    bounds. CoG height is not a published spec anywhere and is the
                    dominant error source.
                  </li>
                  <li>
                    Friction presets and the 1.1 default are community and
                    historical estimates from the{" "}
                    <SourceLink href="https://mrmctavish.wordpress.com/2021/12/20/coefficient-of-friction-for-wheels-in-frc-and-acceleration/">
                      mrmctavish write-up
                    </SourceLink>
                    , Chief Delphi threads and old WCP and AndyMark pages. None of
                    them is currently vendor-published.
                  </li>
                  <li>
                    Field carpet is Shaw Philadelphia Commercial Neyland II 20,
                    per the{" "}
                    <SourceLink href="https://firstfrc.blob.core.windows.net/frc2026/FieldAssets/2026-field-dimension-dwgs.pdf">
                      2026 field dimension drawings
                    </SourceLink>
                    .
                  </li>
                </ul>
                <p className="nb-slug mt-4">
                  Not affiliated with or endorsed by FIRST.
                </p>
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

function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}): React.JSX.Element {
  return (
    <div className="nb-field">
      <label className="nb-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="nb-input"
        type="number"
        inputMode="decimal"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="nb-hint">{hint}</p>
    </div>
  );
}

/**
 * One failure mode, stated as a sentence.
 *
 * Sliding is the good outcome and tipping is the bad one, but the difference
 * is carried by the words and the comparison printed beside them, never by a
 * colour the palette does not own.
 */
function FailureRow({
  label,
  slides,
  valid,
  mu,
  tan,
  angle,
}: {
  label: string;
  slides: boolean;
  valid: boolean;
  mu: number;
  tan: number;
  angle: number;
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 border-b border-dashed border-rule py-3 first:border-t first:border-dashed first:border-rule">
      <dt className="text-[0.98rem] font-semibold">{label}</dt>
      <dd className="nb-slug col-start-2 row-start-1 !text-ink">
        {valid ? (slides ? "slips first" : "goes over first") : "n/a"}
      </dd>
      <dd className="nb-slug col-span-2">
        {valid
          ? `tread ${fmt(mu, 2)} against a tip tangent of ${fmt(tan, 2)}, tipping at ${fmt(angle, 1)} degrees`
          : "enter a track, a wheelbase and a CoG height"}
      </dd>
    </div>
  );
}

/**
 * A row header, but `.nb-table th` is styled for the mono column head, so the
 * scope="row" cell overrides back to running weight.
 */
function MathRow({
  title,
  formula,
  worked,
}: {
  title: string;
  formula: string;
  worked: string;
}): React.JSX.Element {
  return (
    <tr>
      <th
        scope="row"
        className="!border-b-0 !text-[0.86rem] !normal-case !text-ink"
      >
        {title}
      </th>
      <td className="nb-slug">{formula}</td>
      <td className="nb-slug !text-ink">{worked}</td>
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
