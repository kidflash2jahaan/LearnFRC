"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";

/* ------------------------------------------------------------------ *
 * Exact unit conversions (defined constants, not estimates)
 * ------------------------------------------------------------------ */
const M_PER_IN = 0.0254; // NIST exact: 1 in = 0.0254 m
const IN_TO_MM = 25.4; // exact
const LBF_TO_N = 4.4482216; // NIST exact: 1 lbf = 4.4482216 N
const PA_PER_KSI = 6_894_757.293; // 1 ksi = 6894.757293 kPa (defined)

/* ------------------------------------------------------------------ *
 * VERIFIED MATERIAL DATA: Young's modulus E from primary datasheets.
 * These are physical constants and do not change season to season.
 *   6061-T6  E = 68.9 GPa (10,000 ksi)   MatWeb / ASM   [high]
 *   6061-T6  yield = 276 MPa (40 ksi)    MatWeb / ASM   [high]
 *   7075-T6  E = 71.7 GPa (10,400 ksi)   MatWeb / ASM   [high]
 *   Steel    E = 200 GPa (~29,000 ksi)   ASM 1018/4130  [high]
 *   Polycarb E = 2.3 GPa (~0.33 Msi)     MatWeb/Lexan   [medium, 2.0 to 2.4]
 * Yield strength is only in the verified dataset for 6061-T6. For every
 * other material yield is a USER-EDITABLE input, never a hardcoded
 * authoritative number.
 * ------------------------------------------------------------------ */
type Material = {
  key: string;
  label: string;
  eGPa: number; // Young's modulus, GPa (verified)
  eKsi: string; // display of the same value
  eSource: string;
  eConfidence: "high" | "medium";
  yieldMPa: number | null; // verified yield (6061-T6 only); null = not in dataset
  yieldNote: string; // guidance printed under the yield field
  note: string;
  custom?: boolean; // user enters E
};

const MATERIALS: Material[] = [
  {
    key: "6061",
    label: "6061-T6 aluminum",
    eGPa: 68.9,
    eKsi: "10,000 ksi",
    eSource: "MatWeb / ASM 6061-T6 datasheet",
    eConfidence: "high",
    yieldMPa: 276,
    yieldNote:
      "276 MPa (40 ksi), MatWeb and ASM. This one is verified, and still editable.",
    note: "The most common FRC structural aluminum, in tube and plate.",
  },
  {
    key: "7075",
    label: "7075-T6 aluminum",
    eGPa: 71.7,
    eKsi: "10,400 ksi",
    eSource: "MatWeb / ASM 7075-T6 datasheet",
    eConfidence: "high",
    yieldMPa: null,
    yieldNote:
      "Not in the verified dataset. Enter your datasheet yield to get a safety factor.",
    note: "Stronger and pricier aluminum. E is verified, the yield is yours to enter.",
  },
  {
    key: "steel",
    label: "Steel (mild 1018 or 4130)",
    eGPa: 200,
    eKsi: "about 29,000 ksi",
    eSource: "ASM material data (1018 about 200, 4130 about 205 GPa)",
    eConfidence: "high",
    yieldMPa: null,
    yieldNote:
      "Yield depends heavily on grade and heat treat. Enter the number for your grade.",
    note: "1018 sits near 200 GPa, 4130 near 205 GPa.",
  },
  {
    key: "polycarb",
    label: "Polycarbonate (Lexan)",
    eGPa: 2.3,
    eKsi: "about 0.33 Msi",
    eSource: "MatWeb Polycarbonate plus Lexan datasheets",
    eConfidence: "medium",
    yieldMPa: null,
    yieldNote:
      "Grade and temperature dependent. Enter your grade's yield if you know it.",
    note: "Varies from 2.0 to 2.4 GPa by grade, and it creeps under a sustained load.",
  },
  {
    key: "custom",
    label: "Custom, enter E and yield",
    eGPa: 68.9,
    eKsi: "your value",
    eSource: "user-entered",
    eConfidence: "high",
    yieldMPa: null,
    yieldNote: "Enter the yield strength for your material.",
    note: "Modulus and yield straight off your own material datasheet.",
    custom: true,
  },
];

/* ------------------------------------------------------------------ *
 * Cross-section presets. Default dimensions are FRC stock in INCHES
 * (1x1 and 2x1 in, 1/16 in wall; 1/8 and 3/16 in polycarbonate plate).
 * The area moment of inertia I is COMPUTED LIVE from the standard section
 * formula, so nothing is pre-baked and it stays exact for the geometry
 * you actually enter.
 * ------------------------------------------------------------------ */
type Shape = "tube" | "round" | "solid" | "customI";

type SectionPreset = {
  key: string;
  label: string;
  shape: Shape;
  bIn?: number; // outer width (in)
  hIn?: number; // outer height / thickness (in), the bending direction
  wallIn?: number; // wall thickness (in)
  dIn?: number; // outer diameter (in)
  iIn4?: number; // for customI: default I (in^4)
  note: string;
};

const SECTIONS: SectionPreset[] = [
  {
    key: "1x1",
    label: "1x1 tube",
    shape: "tube",
    bIn: 1,
    hIn: 1,
    wallIn: 0.0625,
    note: "1x1 in square tube with a 0.0625 in (1/16) wall. WCP MaxTube, TheThriftyBot, 80-20 stock.",
  },
  {
    key: "2x1-strong",
    label: "2x1 tube, standing tall",
    shape: "tube",
    bIn: 1,
    hIn: 2,
    wallIn: 0.0625,
    note: "2x1 in tube with the 2 in dimension in the bending direction, the stiff orientation, 1/16 in wall.",
  },
  {
    key: "2x1-weak",
    label: "2x1 tube, laid flat",
    shape: "tube",
    bIn: 2,
    hIn: 1,
    wallIn: 0.0625,
    note: "The same 2x1 tube laid flat, so only 1 in is in the bending direction. Much floppier for no weight saved.",
  },
  {
    key: "round",
    label: "Round tube",
    shape: "round",
    dIn: 1,
    wallIn: 0.0625,
    note: "Round tube. Enter your outer diameter and wall thickness, no stock size assumed.",
  },
  {
    key: "plate",
    label: "Solid bar or polycarb plate",
    shape: "solid",
    bIn: 2,
    hIn: 0.125,
    note: "Solid rectangle, width by thickness. Polycarb plate is usually 1/8 in (0.125) or 3/16 in (0.1875), and it bends about the thin dimension.",
  },
  {
    key: "customI",
    label: "Enter I directly",
    shape: "customI",
    iIn4: 0.05,
    hIn: 1,
    note: "For a section this tool does not draw: enter a known area moment of inertia and the section height, which sets c = height over 2.",
  },
];

/* ------------------------------------------------------------------ *
 * Support and load cases: exact Euler-Bernoulli beam formulas.
 *  cantilever + point (tip):   d = P L^3/(3EI)      M = P L
 *  cantilever + distributed:   d = W L^3/(8EI)      M = W L/2   (W = total)
 *  simply-supp + point (mid):  d = P L^3/(48EI)     M = P L/4
 *  simply-supp + distributed:  d = 5 W L^3/(384EI)  M = W L/8   (W = total)
 * Source: Roark's Formulas for Stress and Strain, Table 8.1; Hibbeler.
 * ------------------------------------------------------------------ */
type Support = "cantilever" | "simple";
type LoadType = "point" | "distributed";

function deflectionCoeff(support: Support, load: LoadType): number {
  if (support === "cantilever") return load === "point" ? 1 / 3 : 1 / 8;
  return load === "point" ? 1 / 48 : 5 / 384;
}
/** Max bending moment as M = k x Load x L. */
function momentCoeff(support: Support, load: LoadType): number {
  if (support === "cantilever") return load === "point" ? 1 : 1 / 2;
  return load === "point" ? 1 / 4 : 1 / 8;
}

const DELTA_FORMULA: Record<string, string> = {
  "cantilever-point": "d = P L^3 / (3 E I)",
  "cantilever-distributed": "d = W L^3 / (8 E I)",
  "simple-point": "d = P L^3 / (48 E I)",
  "simple-distributed": "d = 5 W L^3 / (384 E I)",
};

const MOMENT_FORMULA: Record<string, string> = {
  "cantilever-point": "M = P L",
  "cantilever-distributed": "M = W L / 2",
  "simple-point": "M = P L / 4",
  "simple-distributed": "M = W L / 8",
};

const SECTION_FORMULA: Record<Shape, string> = {
  tube: "I = (b h^3 - bi hi^3) / 12",
  round: "I = pi (D^4 - d^4) / 64",
  solid: "I = b h^3 / 12",
  customI: "I entered directly",
};

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
 * The member sheet.
 *
 * Someone opens this holding a length of tube and one worry: will it sag, and
 * will it stay bent. So the sheet answers both across an ink band first, then
 * shows its working: the member on one hand-ruled tag, the section drawn
 * beside its own dimensions, and every formula printed with the entered
 * numbers substituted in. No verdict is carried by a colour, because the
 * binder prints in one ink.
 */
export default function DeflectionCalculator({
  authed,
}: {
  authed: boolean;
}): React.JSX.Element {
  const [lengthUnit, setLengthUnit] = useState<"in" | "mm">("in");
  const [forceUnit, setForceUnit] = useState<"lb" | "N">("lb");

  const [materialKey, setMaterialKey] = useState("6061");
  const [customE, setCustomE] = useState("68.9"); // GPa, custom material only
  const [yieldMPa, setYieldMPa] = useState("276"); // editable; 276 verified for 6061

  const [support, setSupport] = useState<Support>("cantilever");
  const [loadType, setLoadType] = useState<LoadType>("point");
  const [length, setLength] = useState("20"); // in
  const [load, setLoad] = useState("15"); // lb

  const [sectionKey, setSectionKey] = useState("1x1");
  const [secB, setSecB] = useState("1"); // outer width
  const [secH, setSecH] = useState("1"); // outer height / thickness (bending dir)
  const [secWall, setSecWall] = useState("0.0625");
  const [secD, setSecD] = useState("1"); // outer diameter (round)
  const [secI, setSecI] = useState("0.05"); // custom I, in display-unit^4

  const [saved, setSaved] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const material = MATERIALS.find((m) => m.key === materialKey) ?? MATERIALS[0];
  const sectionPreset = SECTIONS.find((s) => s.key === sectionKey) ?? SECTIONS[0];
  const shape = sectionPreset.shape;
  const lu = lengthUnit;

  /** Print a length that is defined in inches, in the selected unit. */
  function fromIn(inches: number, digits: number): string {
    const v = lengthUnit === "in" ? inches : inches * IN_TO_MM;
    return String(Math.round(v * 10 ** digits) / 10 ** digits);
  }

  function selectMaterial(key: string): void {
    setMaterialKey(key);
    const m = MATERIALS.find((x) => x.key === key);
    if (m) setYieldMPa(m.yieldMPa != null ? String(m.yieldMPa) : "");
  }

  function selectSection(key: string): void {
    setSectionKey(key);
    const s = SECTIONS.find((x) => x.key === key);
    if (!s) return;
    if (s.bIn != null) setSecB(fromIn(s.bIn, 4));
    if (s.hIn != null) setSecH(fromIn(s.hIn, 4));
    if (s.wallIn != null) setSecWall(fromIn(s.wallIn, 4));
    if (s.dIn != null) setSecD(fromIn(s.dIn, 4));
    if (s.iIn4 != null) {
      // I converts with the 4th power of the length factor.
      const disp = lengthUnit === "in" ? s.iIn4 : s.iIn4 * IN_TO_MM ** 4;
      setSecI(String(Math.round(disp * 10000) / 10000));
    }
  }

  function switchLengthUnit(next: "in" | "mm"): void {
    if (next === lengthUnit) return;
    const f = next === "mm" ? IN_TO_MM : 1 / IN_TO_MM;
    const lin = (s: string): string =>
      String(Math.round(parseNum(s) * f * 10000) / 10000);
    setSecB(lin(secB));
    setSecH(lin(secH));
    setSecWall(lin(secWall));
    setSecD(lin(secD));
    setLength(String(Math.round(parseNum(length) * f * 100) / 100));
    setSecI(String(Math.round(parseNum(secI) * f ** 4 * 10000) / 10000));
    setLengthUnit(next);
  }

  function switchForceUnit(next: "lb" | "N"): void {
    if (next === forceUnit) return;
    const f = next === "N" ? LBF_TO_N : 1 / LBF_TO_N;
    setLoad(String(Math.round(parseNum(load) * f * 100) / 100));
    setForceUnit(next);
  }

  function resetAll(): void {
    setLengthUnit("in");
    setForceUnit("lb");
    setMaterialKey("6061");
    setCustomE("68.9");
    setYieldMPa("276");
    setSupport("cantilever");
    setLoadType("point");
    setLength("20");
    setLoad("15");
    setSectionKey("1x1");
    setSecB("1");
    setSecH("1");
    setSecWall("0.0625");
    setSecD("1");
    setSecI("0.05");
  }

  /* ------------------------------ maths ---------------------------- */
  const r = useMemo(() => {
    const toM = (v: number): number =>
      lengthUnit === "in" ? v * M_PER_IN : v / 1000;

    // Section geometry to I (m^4) and c (m), from the exact standard formulas.
    let I = NaN;
    let c = NaN;
    if (shape === "tube") {
      const b = toM(parseNum(secB));
      const h = toM(parseNum(secH));
      const t = toM(parseNum(secWall));
      const bi = b - 2 * t;
      const hi = h - 2 * t;
      if (b > 0 && h > 0 && t > 0 && bi > 0 && hi > 0) {
        I = (b * h ** 3 - bi * hi ** 3) / 12; // about the horizontal neutral axis
        c = h / 2;
      }
    } else if (shape === "round") {
      const D = toM(parseNum(secD));
      const t = toM(parseNum(secWall));
      const d = D - 2 * t;
      if (D > 0 && t > 0 && d > 0) {
        I = (Math.PI * (D ** 4 - d ** 4)) / 64;
        c = D / 2;
      }
    } else if (shape === "solid") {
      const b = toM(parseNum(secB));
      const h = toM(parseNum(secH));
      if (b > 0 && h > 0) {
        I = (b * h ** 3) / 12;
        c = h / 2;
      }
    } else {
      // customI: I entered in display-unit^4, height in display unit for c
      const iDisp = parseNum(secI);
      const h = toM(parseNum(secH));
      const factor = lengthUnit === "in" ? M_PER_IN ** 4 : (1 / 1000) ** 4;
      if (iDisp > 0 && h > 0) {
        I = iDisp * factor;
        c = h / 2;
      }
    }

    const eGPa = material.custom ? parseNum(customE) : material.eGPa;
    const E = eGPa * 1e9; // Pa
    const L = toM(parseNum(length));
    const loadN =
      forceUnit === "lb" ? parseNum(load) * LBF_TO_N : parseNum(load);
    const yldPa = parseNum(yieldMPa) > 0 ? parseNum(yieldMPa) * 1e6 : NaN;

    const valid =
      Number.isFinite(I) && I > 0 && Number.isFinite(c) && E > 0 && L > 0 && loadN > 0;

    const kDelta = deflectionCoeff(support, loadType);
    const kM = momentCoeff(support, loadType);

    const deltaM = valid ? (kDelta * loadN * L ** 3) / (E * I) : NaN; // m
    const momentNm = valid ? kM * loadN * L : NaN; // N*m
    const sigmaPa = valid ? (momentNm * c) / I : NaN; // Pa
    const sf = valid && Number.isFinite(yldPa) ? yldPa / sigmaPa : NaN;
    const ratio = valid && deltaM > 0 ? L / deltaM : NaN; // span over deflection

    return {
      valid,
      I_m4: I,
      I_in4: I / M_PER_IN ** 4,
      I_cm4: I * 1e8,
      c_m: c,
      c_in: c / M_PER_IN,
      L_m: L,
      L_in: L / M_PER_IN,
      loadN,
      momentNm,
      deltaIn: deltaM / M_PER_IN,
      deltaMm: deltaM * 1000,
      sigmaMPa: sigmaPa / 1e6,
      sigmaKsi: sigmaPa / PA_PER_KSI,
      sf,
      ratio,
      eGPa,
      hasYield: Number.isFinite(yldPa),
    };
  }, [
    shape,
    secB,
    secH,
    secWall,
    secD,
    secI,
    material,
    customE,
    length,
    load,
    yieldMPa,
    support,
    loadType,
    lengthUnit,
    forceUnit,
  ]);

  // Stiffness band from the span-over-deflection ratio. General structural
  // guidance, phrased as words rather than as a colour.
  const defBand = useMemo(() => {
    if (!r.valid) return "not enough numbers";
    if (r.ratio >= 360) return "very stiff";
    if (r.ratio >= 180) return "stiff";
    if (r.ratio >= 90) return "noticeable flex";
    return "excessive flex";
  }, [r.valid, r.ratio]);

  const caseKey = `${support}-${loadType}`;
  const loadPos = support === "cantilever" ? "at the free tip" : "at mid-span";
  const loadWord = loadType === "point" ? "Point load" : "Total distributed load";

  const verdictLine = !r.valid
    ? "Not enough numbers yet."
    : r.hasYield && r.sf < 1
      ? "This member is predicted to yield."
      : r.ratio < 90
        ? "It survives, but it flexes badly."
        : r.hasYield && r.sf < 2
          ? "It holds, with thinner margin than most teams want."
          : "Stiff enough, with margin left over.";

  const verdictBody = !r.valid
    ? "Enter a span, a load and a section with real wall thickness and the sheet fills in."
    : r.hasYield && r.sf < 1
      ? `Bending stress reaches ${fmt(r.sigmaMPa, 1)} MPa against a ${fmt(parseNum(yieldMPa), 0)} MPa yield, so the part takes a permanent set. Add height in the bending direction before you add wall.`
      : r.ratio < 90
        ? `${fmt(r.deltaIn, 3)} in of sag over ${fmt(r.L_in, 1)} in of span is L/${fmt(r.ratio, 0)}. Nothing breaks, but the mechanism at the end of it will not repeat.`
        : r.hasYield && r.sf < 2
          ? `Safety factor of ${fmt(r.sf, 2)} against yield. Two is the usual FRC target for a static load, and a drilled or notched member yields below the plain-section figure.`
          : r.hasYield
            ? `${fmt(r.deltaIn, 3)} in of sag and ${fmt(r.sf, 2)} times margin against yield, on an ideal beam with no joints in it.`
            : `${fmt(r.deltaIn, 3)} in of sag, which is L/${fmt(r.ratio, 0)}. Enter a yield strength to get a safety factor as well.`;

  return (
    <>
      {/* ---------------------------------------------------------------- *
       * 1. The question, then the shelf of stock sections
       *
       * A structures question starts from a piece of tube somebody already
       * owns, so the stock shelf is the first control on the page rather
       * than a courtesy buried in the form.
       * ---------------------------------------------------------------- */}
      <div className="nb-wrap py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="grid gap-x-[clamp(1.5rem,4vw,3rem)] gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="nb-marker">tools / frc-deflection-calculator</p>
            <h1 className="max-w-[19ch]">
              How far does it bend, and does it{" "}
              <span className="nb-mark">come back</span>?
            </h1>
            <p className="nb-lede mt-5">
              Deflection, bending stress and safety factor for an arm tube, an
              elevator rail or a plate. Pick a support, a load case, a material
              and a stock section, and every number recomputes as you type.
            </p>
            <p className="nb-slug mt-4 max-w-[62ch]">
              Moduli are physical constants from primary datasheets, so they do
              not change by season. This is an ideal single-piece beam: real
              parts with bolted joints deflect more.
            </p>
          </div>
          <p className="nb-pen max-w-[17ch] rotate-[1.5deg] lg:pb-2 lg:text-right">
            height in the bending direction is cubed
          </p>
        </div>

        <div className="nb-hair mt-[clamp(1.6rem,3.4vw,2.4rem)] pt-[clamp(1.1rem,2.2vw,1.5rem)]">
          <p className="nb-slug">off the shelf</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => selectSection(s.key)}
                aria-pressed={sectionKey === s.key}
                className="nb-tag min-h-[2.75rem] px-3.5 text-[0.78rem]"
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="mt-3 max-w-[70ch] text-[0.95rem] leading-relaxed text-graphite">
            {sectionPreset.note}
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
              verdict / {support === "cantilever" ? "cantilever" : "simply supported"},{" "}
              {loadType === "point" ? "point load" : "distributed load"}
            </p>
            <h2 className="mt-2 max-w-[16ch] text-[clamp(1.5rem,1.1rem+1.7vw,2.4rem)] text-card">
              {verdictLine}
            </h2>
            <p className="mt-3 max-w-[38ch] text-[0.95rem] text-[rgba(245,246,242,0.85)]">
              {verdictBody}
            </p>
          </div>

          <p className="nb-stamp">
            <b>{fmt(r.deltaIn, 3)}</b>
            <span>
              inches of sag, {fmt(r.deltaMm, 2)} mm
            </span>
          </p>
          <p className="nb-stamp">
            <b>{r.valid ? `L/${fmt(r.ratio, 0)}` : "n/a"}</b>
            <span>span over deflection, {defBand}</span>
          </p>
          <p className="nb-stamp">
            <b>{r.valid && r.hasYield ? `${fmt(r.sf, 2)}x` : "n/a"}</b>
            <span>
              {r.hasYield
                ? "margin against yield"
                : "enter a yield to get margin"}
            </span>
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * 3. The member, written on one tag
       *
       * Material, how it is held and what is pushing on it are one
       * description of one part, so they share a tag instead of being split
       * across a form column.
       * ---------------------------------------------------------------- */}
      <section className="py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div>
              <p className="nb-marker">the member / what it is and what pushes</p>
              <h2 className="max-w-[20ch] text-[clamp(1.5rem,1.1rem+1.6vw,2.4rem)]">
                Describe the part you are about to load.
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
                    onClick={() => switchLengthUnit(u)}
                  >
                    {u}
                  </button>
                ))}
              </div>
              <div
                className="flex items-center gap-4"
                role="group"
                aria-label="Force unit"
              >
                <p className="nb-slug !text-ink">force in</p>
                {(["lb", "N"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    className="nb-tab"
                    data-active={forceUnit === u ? "" : undefined}
                    aria-pressed={forceUnit === u}
                    onClick={() => switchForceUnit(u)}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="nb-box nb-tilt-3 relative mt-[clamp(1.4rem,3vw,2.2rem)] p-[clamp(1.2rem,2.6vw,2rem)]">
            <span
              className="nb-tape -top-3 left-[13%] rotate-[-3.1deg]"
              aria-hidden="true"
            />

            <div className="grid gap-[clamp(1rem,2.2vw,1.5rem)] sm:grid-cols-2 lg:grid-cols-3">
              <div className="nb-field">
                <label className="nb-label" htmlFor="df-material">
                  Material
                </label>
                <select
                  id="df-material"
                  className="nb-input nb-select"
                  value={materialKey}
                  onChange={(e) => selectMaterial(e.target.value)}
                >
                  {MATERIALS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <p className="nb-hint">
                  {material.custom
                    ? "Enter Young's modulus below."
                    : `E = ${fmt(material.eGPa, 1)} GPa (${material.eKsi}). ${material.note}`}
                </p>
              </div>

              {material.custom ? (
                <div className="nb-field">
                  <label className="nb-label" htmlFor="df-customE">
                    Young’s modulus E (GPa)
                  </label>
                  <input
                    id="df-customE"
                    className="nb-input"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={customE}
                    onChange={(e) => setCustomE(e.target.value)}
                  />
                  <p className="nb-hint">Straight off your material datasheet.</p>
                </div>
              ) : null}

              <div className="nb-field">
                <label className="nb-label" htmlFor="df-yield">
                  Yield strength (MPa)
                </label>
                <input
                  id="df-yield"
                  className="nb-input"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder="276"
                  value={yieldMPa}
                  onChange={(e) => setYieldMPa(e.target.value)}
                />
                <p className="nb-hint">{material.yieldNote}</p>
              </div>

              <div className="nb-field">
                <label className="nb-label" htmlFor="df-support">
                  How it is held
                </label>
                <select
                  id="df-support"
                  className="nb-input nb-select"
                  value={support}
                  onChange={(e) => setSupport(e.target.value as Support)}
                >
                  <option value="cantilever">Cantilever, fixed at one end</option>
                  <option value="simple">Simply supported at both ends</option>
                </select>
                <p className="nb-hint">
                  {support === "cantilever"
                    ? "An arm bolted to a gearbox plate at one end and free at the other."
                    : "A rail resting on a bearing block at each end."}
                </p>
              </div>

              <div className="nb-field">
                <label className="nb-label" htmlFor="df-loadtype">
                  How the load arrives
                </label>
                <select
                  id="df-loadtype"
                  className="nb-input nb-select"
                  value={loadType}
                  onChange={(e) => setLoadType(e.target.value as LoadType)}
                >
                  <option value="point">One point load {loadPos}</option>
                  <option value="distributed">Spread evenly along the span</option>
                </select>
                <p className="nb-hint">
                  {loadType === "point"
                    ? `A single force ${loadPos}.`
                    : "The TOTAL load spread along the beam, not a per-inch figure."}
                </p>
              </div>

              <div className="nb-field">
                <label className="nb-label" htmlFor="df-length">
                  Span ({lu})
                </label>
                <input
                  id="df-length"
                  className="nb-input"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                />
                <p className="nb-hint">
                  {support === "cantilever"
                    ? "Free length from the fixed end to the tip."
                    : "Clear span between the two supports."}
                </p>
              </div>

              <div className="nb-field">
                <label className="nb-label" htmlFor="df-load">
                  {loadWord} ({forceUnit})
                </label>
                <input
                  id="df-load"
                  className="nb-input"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={load}
                  onChange={(e) => setLoad(e.target.value)}
                />
                <p className="nb-hint">
                  Self weight is not added for you. Include it here if it matters.
                </p>
              </div>
            </div>

            {/* Tag footer: what the description above already fixes. */}
            <dl className="nb-hair mt-[clamp(1.2rem,2.6vw,1.8rem)] grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 pt-[clamp(1.1rem,2.2vw,1.5rem)]">
              <dt className="nb-slug">modulus</dt>
              <dd className="nb-slug !text-ink">
                E = {fmt(r.eGPa, 1)} GPa, from {material.eSource}, confidence{" "}
                {material.eConfidence}
              </dd>
              <dt className="nb-slug">load case</dt>
              <dd className="nb-slug !text-ink">{DELTA_FORMULA[caseKey]}</dd>
              <dt className="nb-slug">worst moment</dt>
              <dd className="nb-slug !text-ink">
                {MOMENT_FORMULA[caseKey]}, which is {fmt(r.momentNm, 2)} N·m here
              </dd>
              <dt className="nb-slug">bending stress</dt>
              <dd className="nb-slug !text-ink">
                {fmt(r.sigmaMPa, 1)} MPa, {fmt(r.sigmaKsi, 2)} ksi
              </dd>
            </dl>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * 4. The section, drawn beside its own dimensions
       *
       * A load case is a picture before it is an equation, so the schematic
       * gets its own taped card next to the numbers that define it rather
       * than sitting under a fold as decoration.
       * ---------------------------------------------------------------- */}
      <section className="nb-rule py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <p className="nb-marker">the section / drawn and measured</p>
          <h2 className="max-w-[22ch] text-[clamp(1.5rem,1.1rem+1.6vw,2.4rem)]">
            The shape doing the work, and the load bending it.
          </h2>

          <div className="mt-[clamp(1.4rem,3vw,2.2rem)] grid items-start gap-[clamp(1.2rem,2.8vw,2.2rem)] lg:grid-cols-2">
            {/* --- Card A: the dimensions --- */}
            <div className="nb-box nb-tilt-2 p-[clamp(1.1rem,2.4vw,1.7rem)]">
              <p className="nb-slug border-b border-dashed border-rule pb-2.5">
                dimensions / {sectionPreset.label}
              </p>

              <div className="mt-4 grid gap-[clamp(1rem,2.2vw,1.4rem)] sm:grid-cols-2">
                {shape === "tube" ? (
                  <>
                    <NumberField
                      id="df-b"
                      label={`Outer width b (${lu})`}
                      hint="The horizontal outer dimension."
                      value={secB}
                      onChange={setSecB}
                    />
                    <NumberField
                      id="df-h"
                      label={`Outer height h (${lu})`}
                      hint="The bending direction. This one is cubed, so it is the number that matters."
                      value={secH}
                      onChange={setSecH}
                    />
                    <NumberField
                      id="df-wall"
                      label={`Wall thickness (${lu})`}
                      hint="FRC stock is usually 1/16 in, which is 0.0625."
                      value={secWall}
                      onChange={setSecWall}
                    />
                  </>
                ) : null}

                {shape === "round" ? (
                  <>
                    <NumberField
                      id="df-d"
                      label={`Outer diameter D (${lu})`}
                      hint="Outside diameter of the round tube."
                      value={secD}
                      onChange={setSecD}
                    />
                    <NumberField
                      id="df-wall"
                      label={`Wall thickness (${lu})`}
                      hint="Tube wall thickness."
                      value={secWall}
                      onChange={setSecWall}
                    />
                  </>
                ) : null}

                {shape === "solid" ? (
                  <>
                    <NumberField
                      id="df-b"
                      label={`Width b (${lu})`}
                      hint="Width across the plate or bar."
                      value={secB}
                      onChange={setSecB}
                    />
                    <NumberField
                      id="df-h"
                      label={`Thickness h (${lu})`}
                      hint="The bending direction. On flat plate this is the thin dimension."
                      value={secH}
                      onChange={setSecH}
                    />
                  </>
                ) : null}

                {shape === "customI" ? (
                  <>
                    <NumberField
                      id="df-i"
                      label={`Area moment I (${lu} to the fourth)`}
                      hint="Bending area moment about the neutral axis."
                      value={secI}
                      onChange={setSecI}
                    />
                    <NumberField
                      id="df-h"
                      label={`Section height h (${lu})`}
                      hint="Full height, used for c = h over 2."
                      value={secH}
                      onChange={setSecH}
                    />
                  </>
                ) : null}
              </div>

              <dl className="nb-hair mt-[clamp(1.1rem,2.4vw,1.6rem)] grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 pt-[clamp(1rem,2.2vw,1.4rem)]">
                <dt className="nb-slug">formula</dt>
                <dd className="nb-slug !text-ink">{SECTION_FORMULA[shape]}</dd>
                <dt className="nb-slug">area moment</dt>
                <dd className="nb-slug !text-ink">
                  {fmt(r.I_in4, 4)} in⁴, {fmt(r.I_cm4, 3)} cm⁴
                </dd>
                <dt className="nb-slug">outer fibre</dt>
                <dd className="nb-slug !text-ink">c = {fmt(r.c_in, 3)} in</dd>
              </dl>

              <p className="nb-slug mt-4 max-w-[46ch]">
                Computed live from the dimensions above, never read out of a
                stored table.
              </p>
            </div>

            {/* --- Card B: the load case, drawn --- */}
            <div className="nb-box nb-tilt-3 relative p-[clamp(1.1rem,2.4vw,1.7rem)] lg:mt-8">
              <span
                className="nb-tape -top-3 right-[15%] rotate-[2.7deg]"
                aria-hidden="true"
              />
              <p className="nb-slug border-b border-dashed border-rule pb-2.5">
                load case / deflection drawn far larger than it is
              </p>

              <BeamDiagram support={support} loadType={loadType} />

              <p className="mt-3 max-w-[46ch] text-[0.95rem] leading-relaxed text-graphite">
                {support === "cantilever"
                  ? "Fixed at the left, free at the right. The tip carries the whole moment back to the mount, which is why an arm fails where it bolts on."
                  : "Pinned at both ends. The worst moment sits at mid-span, so that is where the holes hurt most."}
              </p>

              <button
                type="button"
                onClick={resetAll}
                className="nb-btn-ghost nb-btn-sm mt-[clamp(1.1rem,2.4vw,1.6rem)]"
              >
                Back to the 1x1 default
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * 5. The working, shown
       *
       * Nobody trusts a structures calculator that will not show its
       * working, so every formula is printed as a row with the entered
       * numbers substituted in. It scrolls inside itself rather than
       * widening the page.
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
                  title="Area moment of inertia"
                  formula={SECTION_FORMULA[shape]}
                  worked={`I = ${fmt(r.I_in4, 4)} in⁴ = ${r.I_m4.toExponential(3)} m⁴`}
                />
                <MathRow
                  title="Outer fibre distance"
                  formula="c = h / 2"
                  worked={`c = ${fmt(r.c_in, 3)} in = ${fmt(r.c_m * 1000, 2)} mm`}
                />
                <MathRow
                  title="Span and load, in SI"
                  formula="L in metres, P or W in newtons"
                  worked={`L = ${fmt(r.L_m, 4)} m, load = ${fmt(r.loadN, 2)} N`}
                />
                <MathRow
                  title="Max deflection"
                  formula={DELTA_FORMULA[caseKey]}
                  worked={`d = ${fmt(r.deltaIn, 4)} in = ${fmt(r.deltaMm, 3)} mm`}
                />
                <MathRow
                  title="Deflection against span"
                  formula="L / d"
                  worked={r.valid ? `L/${fmt(r.ratio, 0)}, ${defBand}` : "n/a"}
                />
                <MathRow
                  title="Max bending moment"
                  formula={MOMENT_FORMULA[caseKey]}
                  worked={`M = ${fmt(r.momentNm, 3)} N·m`}
                />
                <MathRow
                  title="Max bending stress"
                  formula="sigma = M c / I"
                  worked={`sigma = ${fmt(r.sigmaMPa, 2)} MPa = ${fmt(r.sigmaKsi, 3)} ksi`}
                />
                <MathRow
                  title="Safety factor"
                  formula="SF = yield / sigma"
                  worked={
                    r.valid && r.hasYield
                      ? `SF = ${fmt(parseNum(yieldMPa), 0)} / ${fmt(r.sigmaMPa, 2)} = ${fmt(r.sf, 2)}`
                      : "enter a yield strength above"
                  }
                />
              </tbody>
            </table>
          </div>

          <p className="nb-note mt-[clamp(1.4rem,3vw,2.2rem)] max-w-[64ch] text-[0.95rem] leading-relaxed text-graphite">
            <span className="nb-slug mb-1 block">
              what a safety factor of two does not cover
            </span>
            Two against yield is the usual FRC target for a static load. It says
            nothing about impact, vibration or fatigue, and a lightening hole or
            a notch concentrates stress well above the plain-section figure, so
            a drilled tube yields before this number says it should.
          </p>

          {!authed ? (
            <div className="nb-hair mt-[clamp(1.4rem,3vw,2rem)] flex flex-wrap items-center justify-between gap-4 pt-[clamp(1.1rem,2.2vw,1.5rem)]">
              <p className="max-w-[46ch] text-[0.95rem] text-graphite">
                An account saves named member presets so you can put two sections
                side by side. Reading and calculating never needs one.
              </p>
              <Link
                href="/signup?next=/tools/frc-deflection-calculator"
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
            aria-controls="df-notes"
          >
            <span>
              <span className="nb-marker">the back of the sheet</span>
              <span className="block text-[clamp(1.35rem,1.05rem+1.2vw,2rem)] font-extrabold tracking-[-0.025em]">
                Where every material number came from.
              </span>
            </span>
            <span className="nb-slug shrink-0 !text-ink" aria-hidden="true">
              {notesOpen ? "hide" : "show"}
            </span>
          </button>

          {notesOpen ? (
            <div
              id="df-notes"
              className="mt-[clamp(1.4rem,3vw,2.2rem)] grid gap-[clamp(1.4rem,3vw,2.6rem)] lg:grid-cols-3"
            >
              <div>
                <p className="nb-slug border-b-2 border-ink pb-2">formulas used</p>
                <ul className="nb-prose mt-4 !max-w-none text-[0.95rem]">
                  <li>Cantilever, point at the tip: d = P L³/(3EI), M = P L.</li>
                  <li>
                    Cantilever, distributed total W: d = W L³/(8EI), M = W L/2.
                  </li>
                  <li>
                    Simply supported, point at mid-span: d = P L³/(48EI), M = P L/4.
                  </li>
                  <li>
                    Simply supported, distributed total W: d = 5 W L³/(384EI),
                    M = W L/8.
                  </li>
                  <li>
                    Rectangular tube I = (b h³ - bi hi³)/12, round tube
                    I = pi(D⁴ - d⁴)/64, solid I = b h³/12.
                  </li>
                  <li>
                    Bending stress sigma = M c / I with c = h/2, and safety factor
                    = yield / sigma.
                  </li>
                  <li>
                    Source: Euler-Bernoulli beam theory. Hibbeler, Mechanics of
                    Materials, and Roark’s Formulas for Stress and Strain,
                    Table 8.1.
                  </li>
                </ul>
              </div>

              <div>
                <p className="nb-slug border-b-2 border-ink pb-2">
                  where it stops being true
                </p>
                <ul className="nb-prose mt-4 !max-w-none text-[0.95rem]">
                  <li>
                    This is an idealised straight, uniform, single-piece beam on
                    a perfect fixed or pinned support.
                  </li>
                  <li>
                    Real FRC structures deflect more than this predicts, because
                    bolted and riveted joints, gussets, bearing mounts and
                    gearbox plates all flex. Joint compliance often dominates the
                    real sag and none of it is modelled here.
                  </li>
                  <li>
                    Transverse shear deflection is ignored. That is minor for a
                    long slender beam and larger for a short stubby one.
                  </li>
                  <li>
                    Stress concentrations at lightening holes, bends and welds
                    are ignored, so drilled tube yields below the plain-section
                    safety factor shown.
                  </li>
                  <li>
                    Polycarbonate modulus varies by grade and temperature, and
                    the material creeps under a sustained load, so treat those
                    results as approximate and design conservatively.
                  </li>
                  <li>
                    Verify member dimensions and wall thickness against your
                    actual vendor stock. Nominal tube sizes vary by supplier.
                  </li>
                </ul>
              </div>

              <div>
                <p className="nb-slug border-b-2 border-ink pb-2">
                  sources for every default
                </p>
                <ul className="nb-prose mt-4 !max-w-none text-[0.95rem]">
                  <li>
                    6061-T6: E = 68.9 GPa (10,000 ksi), yield 276 MPa (40 ksi),
                    from the{" "}
                    <SourceLink href="https://asm.matweb.com/search/SpecificMaterial.asp?bassnum=ma6061t6">
                      MatWeb and ASM 6061-T6 datasheet
                    </SourceLink>
                    .
                  </li>
                  <li>
                    7075-T6: E = 71.7 GPa (10,400 ksi), MatWeb and ASM. Yield is
                    not in the verified set, so enter your own.
                  </li>
                  <li>
                    Steel, mild 1018 or 4130: E = 200 GPa, about 29,000 ksi, from
                    ASM material data. 4130 sits nearer 205 GPa.
                  </li>
                  <li>
                    Polycarbonate: E = 2.3 GPa, about 0.33 Msi, grade-dependent
                    across 2.0 to 2.4, from MatWeb plus the Lexan datasheets.
                  </li>
                  <li>
                    Stock sections: 1x1 and 2x1 in tube with a 1/16 in (0.0625)
                    wall, and 1/8 and 3/16 in polycarbonate plate, from{" "}
                    <SourceLink href="https://www.westcoastproducts.com/">
                      WestCoast Products
                    </SourceLink>
                    , TheThriftyBot and 80-20. I is computed from those
                    dimensions, never stored.
                  </li>
                  <li>
                    Unit constants: 1 in = 25.4 mm exactly, 1 lbf = 4.4482216 N,
                    1 ksi = 6.894757293 MPa. All defined, not measured.
                  </li>
                </ul>
                <p className="nb-slug mt-4">
                  For reference only. Not a substitute for physical load testing,
                  and not affiliated with or endorsed by FIRST.
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

/**
 * The load case, drawn in ink and ballpoint.
 *
 * Schematic only: the sag is drawn far larger than any real deflection, so it
 * reads as a diagram of what is happening rather than as a measurement.
 */
function BeamDiagram({
  support,
  loadType,
}: {
  support: Support;
  loadType: LoadType;
}): React.JSX.Element {
  const W = 320;
  const H = 132;
  const y0 = 56; // undeflected beam line
  const x1 = 42;
  const x2 = W - 24;
  const span = x2 - x1;
  const sag = 34; // visual amplitude, not to scale

  const path =
    support === "cantilever"
      ? `M ${x1} ${y0} Q ${x1 + span * 0.6} ${y0 + sag * 0.35} ${x2} ${y0 + sag}`
      : `M ${x1} ${y0} Q ${(x1 + x2) / 2} ${y0 + sag * 1.6} ${x2} ${y0}`;

  const arrows: number[] =
    loadType === "point"
      ? support === "cantilever"
        ? [x2]
        : [(x1 + x2) / 2]
      : [
          x1 + span * 0.15,
          x1 + span * 0.325,
          x1 + span * 0.5,
          x1 + span * 0.675,
          x1 + span * 0.85,
        ];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-4 h-auto w-full"
      role="img"
      aria-label={`${
        support === "cantilever" ? "Cantilever" : "Simply supported"
      } beam carrying ${
        loadType === "point" ? "a single point load" : "a distributed load"
      }, drawn with the deflection exaggerated.`}
    >
      <defs>
        <marker
          id="df-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="4"
          refY="7"
          orient="auto"
        >
          <path d="M0,0 L8,0 L4,7 Z" fill="var(--ink)" />
        </marker>
      </defs>

      {/* the load, in ink */}
      {arrows.map((ax, i) => (
        <line
          key={i}
          x1={ax}
          y1={y0 - 32}
          x2={ax}
          y2={y0 - 7}
          stroke="var(--ink)"
          strokeWidth={1.75}
          markerEnd="url(#df-arrow)"
        />
      ))}
      {loadType === "distributed" ? (
        <line
          x1={x1}
          y1={y0 - 32}
          x2={x2}
          y2={y0 - 32}
          stroke="var(--ink)"
          strokeWidth={1.5}
        />
      ) : null}

      {/* the beam at rest */}
      <line
        x1={x1}
        y1={y0}
        x2={x2}
        y2={y0}
        stroke="var(--ink)"
        strokeWidth={3}
      />

      {/* the beam under load, in ballpoint */}
      <path d={path} fill="none" stroke="var(--blue)" strokeWidth={2.25} />

      {/* the supports */}
      {support === "cantilever" ? (
        <>
          <line
            x1={x1}
            y1={y0 - 24}
            x2={x1}
            y2={y0 + 24}
            stroke="var(--ink)"
            strokeWidth={2.5}
          />
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1={x1}
              y1={y0 - 24 + i * 12}
              x2={x1 - 9}
              y2={y0 - 17 + i * 12}
              stroke="var(--ink)"
              strokeWidth={1.5}
            />
          ))}
        </>
      ) : (
        <>
          <path
            d={`M ${x1} ${y0} l -9 17 l 18 0 Z`}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={2}
          />
          <path
            d={`M ${x2} ${y0} l -9 17 l 18 0 Z`}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={2}
          />
        </>
      )}

      {/* the sag, called out */}
      {support === "cantilever" ? (
        <line
          x1={x2}
          y1={y0}
          x2={x2}
          y2={y0 + sag}
          stroke="var(--blue)"
          strokeWidth={1.25}
          strokeDasharray="3 3"
        />
      ) : (
        <line
          x1={(x1 + x2) / 2}
          y1={y0}
          x2={(x1 + x2) / 2}
          y2={y0 + sag * 1.6}
          stroke="var(--blue)"
          strokeWidth={1.25}
          strokeDasharray="3 3"
        />
      )}
      <text
        x={x2}
        y={H - 8}
        fontSize={11}
        textAnchor="end"
        fill="var(--graphite)"
        style={{ fontFamily: "var(--font-space-mono), monospace" }}
      >
        d = max deflection
      </text>
    </svg>
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
