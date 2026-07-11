"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Info,
  Printer,
  RotateCcw,
  Ruler,
  Save,
  Sparkles,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 * Exact unit conversions (defined constants, not estimates)
 * ------------------------------------------------------------------ */
const M_PER_IN = 0.0254; // NIST exact: 1 in = 0.0254 m
const IN_TO_MM = 25.4; // exact
const LBF_TO_N = 4.4482216; // NIST exact: 1 lbf = 4.4482216 N
const PA_PER_KSI = 6_894_757.293; // 1 ksi = 6894.757293 kPa (from lbf & inch, defined)

/* ------------------------------------------------------------------ *
 * VERIFIED material data — Young's modulus E from primary datasheets.
 * These are physical constants (do not change year to year).
 *   6061-T6  E = 68.9 GPa (10,000 ksi)   — MatWeb / ASM  [high]
 *   6061-T6  yield = 276 MPa (40 ksi)    — MatWeb / ASM  [high]
 *   7075-T6  E = 71.7 GPa (10,400 ksi)   — MatWeb / ASM  [high]
 *   Steel    E = 200 GPa (~29,000 ksi)   — ASM 1018/4130 [high]
 *   Polycarb E = 2.3 GPa (~0.33 Msi)     — MatWeb/Lexan  [medium, grade 2.0–2.4]
 * Yield strength is only in our verified dataset for 6061-T6. For every
 * other material yield is a USER-EDITABLE input (enter your datasheet
 * value) — never a hardcoded authoritative number.
 * ------------------------------------------------------------------ */
type Material = {
  key: string;
  label: string;
  eGPa: number; // Young's modulus, GPa (verified)
  eKsi: string; // display of the same value
  eSource: string;
  eConfidence: "high" | "medium";
  yieldMPa: number | null; // verified yield (only 6061-T6); null = not in dataset
  yieldNote: string; // guidance shown next to the yield field
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
    yieldNote: "276 MPa (40 ksi) — MatWeb / ASM 6061-T6. Verified; editable.",
    note: "The most common FRC structural aluminum (tube & plate).",
  },
  {
    key: "7075",
    label: "7075-T6 aluminum",
    eGPa: 71.7,
    eKsi: "10,400 ksi",
    eSource: "MatWeb / ASM 7075-T6 datasheet",
    eConfidence: "high",
    yieldMPa: null,
    yieldNote: "Not in our verified dataset — enter your datasheet yield to get a safety factor.",
    note: "Stronger, pricier aluminum. E is verified; enter its yield yourself.",
  },
  {
    key: "steel",
    label: "Steel (mild 1018 / 4130)",
    eGPa: 200,
    eKsi: "≈29,000 ksi",
    eSource: "ASM material data (1018 ~200, 4130 ~205 GPa)",
    eConfidence: "high",
    yieldMPa: null,
    yieldNote: "Highly grade/heat-treat dependent — enter your grade's yield.",
    note: "1018 ~200 GPa, 4130 ~205 GPa. E is verified; enter your grade's yield.",
  },
  {
    key: "polycarb",
    label: "Polycarbonate (Lexan)",
    eGPa: 2.3,
    eKsi: "≈0.33 Msi",
    eSource: "MatWeb Polycarbonate + Lexan datasheets",
    eConfidence: "medium",
    yieldMPa: null,
    yieldNote: "Grade/temperature dependent — enter your grade's yield if known.",
    note: "Grade/temperature dependent (2.0–2.4 GPa) and it creeps under sustained load — treat results as approximate.",
  },
  {
    key: "custom",
    label: "Custom (enter E + yield)",
    eGPa: 68.9,
    eKsi: "your value",
    eSource: "user-entered",
    eConfidence: "high",
    yieldMPa: null,
    yieldNote: "Enter the yield strength for your material.",
    note: "Enter Young's modulus and yield strength from your own material datasheet.",
    custom: true,
  },
];

/* ------------------------------------------------------------------ *
 * Cross-section presets. Default dims are FRC stock in INCHES (verified:
 * 1×1 & 2×1 in, 1/16 in wall; 1/8 & 3/16 in polycarbonate plate). The
 * area moment of inertia I is COMPUTED LIVE from the standard section
 * formula — no pre-computed I is hardcoded, so it stays exact for the
 * geometry you enter.
 * ------------------------------------------------------------------ */
type Shape = "tube" | "round" | "solid" | "customI";

type SectionPreset = {
  key: string;
  label: string;
  shape: Shape;
  bIn?: number; // outer width (in)
  hIn?: number; // outer height / thickness (in) — the bending direction
  wallIn?: number; // wall thickness (in)
  dIn?: number; // outer diameter (in)
  iIn4?: number; // for customI: default I (in^4)
  note: string;
};

const SECTIONS: SectionPreset[] = [
  {
    key: "1x1",
    label: "1×1 in tube, 1/16 wall",
    shape: "tube",
    bIn: 1,
    hIn: 1,
    wallIn: 0.0625,
    note: "1×1 in square tube, 0.0625 in (1/16) wall — WCP MaxTube / TheThriftyBot / 80-20 stock.",
  },
  {
    key: "2x1-strong",
    label: "2×1 in tube — strong axis (2 in tall)",
    shape: "tube",
    bIn: 1,
    hIn: 2,
    wallIn: 0.0625,
    note: "2×1 in tube standing tall — 2 in in the bending direction (stiff orientation), 1/16 in wall.",
  },
  {
    key: "2x1-weak",
    label: "2×1 in tube — weak axis (laid flat)",
    shape: "tube",
    bIn: 2,
    hIn: 1,
    wallIn: 0.0625,
    note: "Same 2×1 tube laid flat — only 1 in in the bending direction (much floppier), 1/16 in wall.",
  },
  {
    key: "round",
    label: "Round tube — enter OD & wall",
    shape: "round",
    dIn: 1,
    wallIn: 0.0625,
    note: "Round tube: enter your outer diameter and wall thickness (no specific stock size assumed).",
  },
  {
    key: "plate",
    label: "Solid bar / polycarb plate",
    shape: "solid",
    bIn: 2,
    hIn: 0.125,
    note: "Solid rectangle: enter width × thickness. Polycarb plate is commonly 1/8 in (0.125) or 3/16 in (0.1875) thick; it bends about the thin dimension.",
  },
  {
    key: "customI",
    label: "Custom — enter I directly",
    shape: "customI",
    iIn4: 0.05,
    hIn: 1,
    note: "Enter a known area moment of inertia I and the section height (for bending-stress c = height ÷ 2).",
  },
];

/* ------------------------------------------------------------------ *
 * Support / load cases — exact Euler-Bernoulli beam formulas.
 *  cantilever + point (tip):   δ = P·L³/(3EI)      M = P·L
 *  cantilever + distributed:   δ = W·L³/(8EI)      M = W·L/2   (W = total load)
 *  simply-supp + point (mid):  δ = P·L³/(48EI)     M = P·L/4
 *  simply-supp + distributed:  δ = 5·W·L³/(384EI)  M = W·L/8   (W = total load)
 * Source: Roark's Formulas for Stress & Strain, Table 8.1; Hibbeler.
 * ------------------------------------------------------------------ */
type Support = "cantilever" | "simple";
type LoadType = "point" | "distributed";

function deflectionCoeff(support: Support, load: LoadType): number {
  if (support === "cantilever") return load === "point" ? 1 / 3 : 1 / 8;
  return load === "point" ? 1 / 48 : 5 / 384;
}
// Max bending moment expressed as M = k · Load · L
function momentCoeff(support: Support, load: LoadType): number {
  if (support === "cantilever") return load === "point" ? 1 : 1 / 2;
  return load === "point" ? 1 / 4 : 1 / 8;
}

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
export default function DeflectionCalculator({
  authed,
}: {
  authed: boolean;
}): React.ReactElement {
  const [lengthUnit, setLengthUnit] = useState<"in" | "mm">("in");
  const [forceUnit, setForceUnit] = useState<"lb" | "N">("lb");

  const [materialKey, setMaterialKey] = useState("6061");
  const [customE, setCustomE] = useState("68.9"); // GPa, only for custom material
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

  const material = MATERIALS.find((m) => m.key === materialKey) ?? MATERIALS[0];
  const sectionPreset = SECTIONS.find((s) => s.key === sectionKey) ?? SECTIONS[0];
  const shape = sectionPreset.shape;
  const lu = lengthUnit;

  // Display a length that is defined in inches, in the currently-selected unit.
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
    const lin = (s: string): string => String(Math.round(parseNum(s) * f * 10000) / 10000);
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

  /* ------------------------------ math ------------------------------ */
  const r = useMemo(() => {
    const toM = (v: number): number => (lengthUnit === "in" ? v * M_PER_IN : v / 1000);

    // Section geometry -> I (m^4) and c (m), from the exact standard formulas.
    let I = NaN;
    let c = NaN;
    if (shape === "tube") {
      const b = toM(parseNum(secB));
      const h = toM(parseNum(secH));
      const t = toM(parseNum(secWall));
      const bi = b - 2 * t;
      const hi = h - 2 * t;
      if (b > 0 && h > 0 && t > 0 && bi > 0 && hi > 0) {
        I = (b * h ** 3 - bi * hi ** 3) / 12; // bending about horizontal neutral axis
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
    const loadN = forceUnit === "lb" ? parseNum(load) * LBF_TO_N : parseNum(load);
    const yldPa = parseNum(yieldMPa) > 0 ? parseNum(yieldMPa) * 1e6 : NaN;

    const valid =
      Number.isFinite(I) && I > 0 && Number.isFinite(c) && E > 0 && L > 0 && loadN > 0;

    const kDelta = deflectionCoeff(support, loadType);
    const kM = momentCoeff(support, loadType);

    const deltaM = valid ? (kDelta * loadN * L ** 3) / (E * I) : NaN; // m
    const momentNm = valid ? kM * loadN * L : NaN; // N·m
    const sigmaPa = valid ? (momentNm * c) / I : NaN; // Pa
    const sf = valid && Number.isFinite(yldPa) ? yldPa / sigmaPa : NaN;
    const ratio = valid && deltaM > 0 ? L / deltaM : NaN; // span / deflection

    return {
      valid,
      I_in4: I / M_PER_IN ** 4,
      I_cm4: I * 1e8,
      c_in: c / M_PER_IN,
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

  // Deflection band from span/deflection ratio (general structural guidance).
  const defBand = useMemo(() => {
    if (!r.valid) return { label: "—", tone: "muted" as const };
    if (r.ratio >= 360) return { label: "Very stiff", tone: "ok" as const };
    if (r.ratio >= 180) return { label: "Stiff", tone: "ok" as const };
    if (r.ratio >= 90) return { label: "Noticeable flex", tone: "warn" as const };
    return { label: "Excessive — very flexible", tone: "fail" as const };
  }, [r.valid, r.ratio]);

  // Safety-factor verdict (2× is a common FRC design target — guidance, not a rule).
  const sfVerdict = useMemo(() => {
    if (!r.valid || !r.hasYield) return { label: "Enter yield strength", tone: "muted" as const };
    if (r.sf >= 2) return { label: "Comfortable margin", tone: "ok" as const };
    if (r.sf >= 1) return { label: "Marginal — below 2× target", tone: "warn" as const };
    return { label: "Predicted to YIELD", tone: "fail" as const };
  }, [r.valid, r.hasYield, r.sf]);

  const forceLabel = forceUnit;
  const loadWord = loadType === "point" ? "Point load" : "Total distributed load";
  const loadPos = support === "cantilever" ? "at the free tip" : "at mid-span";

  return (
    <div className="ac-card rounded-2xl p-5 sm:p-6">
      {/* Header */}
      <header className="mb-6">
        <span className="ac-chip inline-flex items-center gap-2">
          <span className="ac-eyebrow">STRUCTURES</span>
        </span>
        <h2 className="font-display mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Structural{" "}
          <span
            style={{
              background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Deflection
          </span>{" "}
          Calculator
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-foreground/70">
          How far will your aluminum (or steel / polycarb) arm tube, rail, or plate bend under load —
          and will it yield? Pick a support, load case, material and FRC-stock section; deflection,
          bending stress and safety factor recompute live.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Material moduli are physical constants from primary datasheets (do not change by season).
          A first-order, ideal-beam estimate — verify your own geometry &amp; wall thickness against
          your vendor stock.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* ------------------------------ INPUTS ------------------------------ */}
        <div className="rounded-2xl border border-border bg-white/60 p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Ruler className="h-4 w-4 text-primary" />
              Beam, load &amp; section
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1">
              <UnitToggle value={lu} a="in" b="mm" onChange={switchLengthUnit} />
              <UnitToggle value={forceUnit} a="lb" b="N" onChange={switchForceUnit} />
            </div>
          </div>

          {/* Material */}
          <label className="text-sm font-medium text-foreground" htmlFor="material">
            Material
          </label>
          <select
            id="material"
            className="mt-1 w-full rounded-xl border border-border bg-white/60 px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            value={materialKey}
            onChange={(e) => selectMaterial(e.target.value)}
          >
            {MATERIALS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            {material.custom ? (
              <>Enter Young&apos;s modulus for your material.</>
            ) : (
              <>
                E = {fmt(material.eGPa, 1)} GPa ({material.eKsi}){" "}
                <Tip text={`${material.eSource} — confidence: ${material.eConfidence}`} /> ·{" "}
                {material.note}
              </>
            )}
          </p>

          {material.custom && (
            <div className="mt-3">
              <label className="text-sm font-medium text-foreground" htmlFor="customE">
                Young&apos;s modulus E (GPa)
              </label>
              <input
                id="customE"
                type="number"
                inputMode="decimal"
                step="any"
                className="mt-1 w-full rounded-xl border border-border bg-white/60 px-3 py-2 text-sm text-foreground tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                value={customE}
                onChange={(e) => setCustomE(e.target.value)}
              />
            </div>
          )}

          <div className="mt-3">
            <label className="flex items-center gap-1 text-sm font-medium text-foreground" htmlFor="yield">
              Yield strength (MPa)
              {material.key === "6061" ? (
                <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400">
                  verified
                </span>
              ) : (
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-400">
                  enter yours
                </span>
              )}
            </label>
            <input
              id="yield"
              type="number"
              inputMode="decimal"
              step="any"
              placeholder="e.g. 276"
              className="mt-1 w-full rounded-xl border border-border bg-white/60 px-3 py-2 text-sm text-foreground tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              value={yieldMPa}
              onChange={(e) => setYieldMPa(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">{material.yieldNote}</p>
          </div>

          <div className="ac-divider my-5" />

          {/* Support + load case */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground" htmlFor="support">
                Support condition
              </label>
              <select
                id="support"
                className="mt-1 w-full rounded-xl border border-border bg-white/60 px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                value={support}
                onChange={(e) => setSupport(e.target.value as Support)}
              >
                <option value="cantilever">Cantilever (fixed one end)</option>
                <option value="simple">Simply supported (both ends)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground" htmlFor="loadType">
                Load type
              </label>
              <select
                id="loadType"
                className="mt-1 w-full rounded-xl border border-border bg-white/60 px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                value={loadType}
                onChange={(e) => setLoadType(e.target.value as LoadType)}
              >
                <option value="point">Point load ({loadPos})</option>
                <option value="distributed">Uniformly distributed</option>
              </select>
            </div>
            <Field
              label="Beam length / span"
              help={
                support === "cantilever"
                  ? "Free length from the fixed end to the tip."
                  : "Clear span between the two supports."
              }
              value={length}
              onChange={setLength}
              unit={lu}
            />
            <Field
              label={`${loadWord} (${forceLabel})`}
              help={
                loadType === "point"
                  ? `Single force applied ${loadPos}.`
                  : "TOTAL load spread evenly along the beam (not per-length). Self-weight is not auto-added — include it here if it matters."
              }
              value={load}
              onChange={setLoad}
              unit={forceLabel}
              accent
            />
          </div>

          <div className="ac-divider my-5" />

          {/* Cross-section */}
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Boxes className="h-4 w-4 text-primary" />
            Cross-section
          </div>
          <label className="sr-only" htmlFor="section">
            Cross-section preset
          </label>
          <select
            id="section"
            className="w-full rounded-xl border border-border bg-white/60 px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            value={sectionKey}
            onChange={(e) => selectSection(e.target.value)}
          >
            {SECTIONS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">{sectionPreset.note}</p>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {shape === "tube" && (
              <>
                <Field label="Outer width b" help="Horizontal outer dimension." value={secB} onChange={setSecB} unit={lu} />
                <Field
                  label="Outer height h"
                  help="Vertical outer dimension — the bending direction. Bigger h = much stiffer (h³)."
                  value={secH}
                  onChange={setSecH}
                  unit={lu}
                  accent
                />
                <Field label="Wall thickness" help="Tube wall. FRC stock is often 1/16 in (0.0625)." value={secWall} onChange={setSecWall} unit={lu} />
              </>
            )}
            {shape === "round" && (
              <>
                <Field label="Outer diameter D" help="Outside diameter of the round tube." value={secD} onChange={setSecD} unit={lu} accent />
                <Field label="Wall thickness" help="Tube wall thickness." value={secWall} onChange={setSecWall} unit={lu} />
              </>
            )}
            {shape === "solid" && (
              <>
                <Field label="Width b" help="Width across the plate/bar." value={secB} onChange={setSecB} unit={lu} />
                <Field
                  label="Height / thickness h"
                  help="Dimension in the bending direction. For a flat plate this is the thin thickness (1/8 or 3/16 in polycarb)."
                  value={secH}
                  onChange={setSecH}
                  unit={lu}
                  accent
                />
              </>
            )}
            {shape === "customI" && (
              <>
                <Field
                  label={`Area moment I (${lu}⁴)`}
                  help="Bending area moment of inertia of your section about the neutral axis."
                  value={secI}
                  onChange={setSecI}
                  unit={`${lu}⁴`}
                  accent
                />
                <Field label="Section height h" help="Full height, used for bending stress c = h ÷ 2." value={secH} onChange={setSecH} unit={lu} />
              </>
            )}
          </div>

          <div className="mt-3 rounded-xl border border-border bg-white/70 px-3 py-2 text-xs text-muted-foreground dark:bg-white/5">
            Computed section: I = <span className="font-medium text-foreground tabular-nums">{fmt(r.I_in4, 4)}</span> in⁴
            {" "}(<span className="tabular-nums">{fmt(r.I_cm4, 3)}</span> cm⁴), c ={" "}
            <span className="tabular-nums">{fmt(r.c_in, 3)}</span> in — from the exact section formula, not a stored value.
          </div>

          <button
            type="button"
            onClick={resetAll}
            className="ac-btn-ghost mt-5 inline-flex items-center gap-2 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to defaults
          </button>
        </div>

        {/* ------------------------------ RESULTS ------------------------------ */}
        <div className="rounded-2xl border border-border bg-white/60 p-5">
          {/* Primary result */}
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {support === "cantilever" ? "Max tip deflection" : "Max center deflection"}
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
              {fmt(r.deltaIn, 3)}
            </div>
            <div className="pb-1 text-lg font-semibold text-foreground/70">in</div>
          </div>
          <div className="mt-1 text-sm text-muted-foreground tabular-nums">
            = {fmt(r.deltaMm, 2)} mm
          </div>

          {/* Deflection ratio + stiffness band */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="ac-tile rounded-xl border border-border bg-white/60 p-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Deflection vs span{" "}
                <Tip text="span ÷ deflection. Structural convention (L/360 stiff … L/180 flexible); general guidance, not an FRC rule." />
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                {r.valid ? `L/${fmt(r.ratio, 0)}` : "—"}
              </div>
              <Verdict tone={defBand.tone} label={defBand.label} />
            </div>
            <div className="ac-tile rounded-xl border border-border bg-white/60 p-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Max bending stress{" "}
                <Tip text="σ = M·c / I (flexure formula). M is the max bending moment for this load case." />
              </div>
              <div className="mt-1 flex items-end gap-1">
                <div className="text-2xl font-bold tabular-nums text-foreground">{fmt(r.sigmaMPa, 1)}</div>
                <div className="pb-0.5 text-sm text-foreground/60">MPa</div>
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">{fmt(r.sigmaKsi, 2)} ksi</div>
            </div>
          </div>

          {/* Safety factor verdict */}
          <div
            className={
              "mt-4 rounded-xl border p-4 " +
              (sfVerdict.tone === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10"
                : sfVerdict.tone === "warn"
                  ? "border-amber-500/30 bg-amber-500/10"
                  : sfVerdict.tone === "fail"
                    ? "border-red-500/30 bg-red-500/10"
                    : "border-border bg-muted")
            }
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Safety factor vs yield
                </div>
                <div className="mt-0.5 flex items-end gap-2">
                  <div className="text-3xl font-bold tabular-nums text-foreground">
                    {r.valid && r.hasYield ? fmt(r.sf, 2) : "—"}
                    {r.valid && r.hasYield ? <span className="text-lg font-semibold text-foreground/60">×</span> : null}
                  </div>
                </div>
              </div>
              <Verdict tone={sfVerdict.tone} label={sfVerdict.label} />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              SF = yield ÷ max bending stress. 2× is a common FRC design target for static loads — your
              team may require more. Impact, vibration, fatigue and hole stress-concentration are{" "}
              <strong>not</strong> included, so a drilled/notched member yields below this.
            </p>
          </div>

          {/* Load-case diagram */}
          <BeamDiagram support={support} loadType={loadType} />

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
                  <span className="font-medium">Create a free account</span> to save named member
                  presets, compare sections &amp; export this report.
                </span>
              </div>
              <Link
                href="/signup?next=/tools/frc-deflection-calculator"
                className="ac-btn inline-flex shrink-0 items-center gap-1 text-sm"
              >
                Sign up <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <strong>For reference only — verify your own geometry.</strong> Real FRC parts deflect
              MORE than this ideal beam predicts because bolted joints, gussets, and mounts flex.
              Not a substitute for physical load testing.
            </span>
          </div>
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
              First-order estimate using idealized Euler-Bernoulli beam theory. It assumes a straight,
              uniform, single-piece beam with an ideal fixed or pinned support.
            </li>
            <li>
              Real FRC structures usually deflect <strong>more</strong> than this predicts, because
              bolted/riveted joints, gussets, bearing mounts, and gearbox plates flex — joint/mount
              compliance often dominates real-world sag and is not modeled here.
            </li>
            <li>
              Ignores transverse shear deflection (minor for long slender beams, larger for short
              stubby ones) and stress concentrations at lightening holes, bends, and welds — drilled
              tube yields below the plain-section safety factor shown.
            </li>
            <li>
              Polycarbonate modulus varies by grade/temperature and the material creeps (keeps
              deflecting) under sustained load, so treat polycarbonate results as approximate and
              design conservatively.
            </li>
            <li>
              The yield-based safety factor is for static loads only; impact, vibration, and fatigue
              from a competition robot are not captured. Not a substitute for physical load testing.
            </li>
            <li>
              Verify member dimensions and wall thickness against your actual vendor stock; nominal
              tube sizes vary slightly by supplier.
            </li>
          </ul>

          <div className="ac-divider my-2" />

          <div>
            <div className="mb-1 font-semibold text-foreground">Formulas</div>
            <ul className="space-y-1">
              <li>Cantilever, point at tip: δ = P·L³/(3EI); M = P·L</li>
              <li>Cantilever, distributed (total W): δ = W·L³/(8EI); M = W·L/2</li>
              <li>Simply supported, center point: δ = P·L³/(48EI); M = P·L/4</li>
              <li>Simply supported, distributed (total W): δ = 5·W·L³/(384EI); M = W·L/8</li>
              <li>Rectangular tube: I = (b·h³ − bᵢ·hᵢ³)/12 · Round tube: I = π(D⁴ − d⁴)/64 · Solid: I = b·h³/12</li>
              <li>Bending stress σ = M·c/I (c = h/2) · Safety factor = σ_yield / σ_max</li>
              <li className="text-foreground/70">
                Source: Euler-Bernoulli beam theory — Hibbeler, <em>Mechanics of Materials</em>;
                Roark&apos;s <em>Formulas for Stress and Strain</em>, Table 8.1.
              </li>
            </ul>
          </div>

          <div>
            <div className="mb-1 font-semibold text-foreground">Number sources</div>
            <ul className="space-y-1">
              <li>
                <span className="font-medium text-foreground">6061-T6: E = 68.9 GPa (10,000 ksi), yield 276 MPa (40 ksi)</span>{" "}
                — MatWeb / ASM 6061-T6 datasheet. <Src href="https://asm.matweb.com/search/SpecificMaterial.asp?bassnum=ma6061t6" />
              </li>
              <li>
                <span className="font-medium text-foreground">7075-T6: E = 71.7 GPa (10,400 ksi)</span>{" "}
                — MatWeb / ASM 7075-T6 datasheet (yield not in our verified set; enter your own).
              </li>
              <li>
                <span className="font-medium text-foreground">Steel (mild 1018 / 4130): E = 200 GPa (≈29,000 ksi)</span>{" "}
                — ASM material data (1018 ~200, 4130 ~205 GPa).
              </li>
              <li>
                <span className="font-medium text-foreground">Polycarbonate: E = 2.3 GPa (≈0.33 Msi), grade-dependent 2.0–2.4</span>{" "}
                — MatWeb Polycarbonate overview + Lexan datasheets.
              </li>
              <li>
                <span className="font-medium text-foreground">Section stock: 1×1 &amp; 2×1 in, 1/16 in (0.0625) wall; 1/8 &amp; 3/16 in polycarb plate</span>{" "}
                — WestCoast Products / TheThriftyBot / 80-20 stock. I is computed live from these dimensions, never stored.{" "}
                <Src href="https://www.westcoastproducts.com/" />
              </li>
              <li>
                Unit constants: 1 in = 25.4 mm (0.0254 m), 1 lbf = 4.4482216 N, 1 ksi = 6.894757293 MPa — defined/exact.
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
            key
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

/**
 * Schematic load-case diagram (deflection exaggerated, not to scale).
 */
function BeamDiagram({
  support,
  loadType,
}: {
  support: Support;
  loadType: LoadType;
}): React.ReactElement {
  const W = 320;
  const H = 130;
  const y0 = 54; // undeflected beam line
  const x1 = 40;
  const x2 = W - 24;
  const span = x2 - x1;
  const sag = 34; // visual deflection amplitude

  // Deflected shape as an SVG path.
  let path: string;
  if (support === "cantilever") {
    // fixed at x1, tip droops down
    path = `M ${x1} ${y0} Q ${x1 + span * 0.6} ${y0 + sag * 0.35} ${x2} ${y0 + sag}`;
  } else {
    // pinned both ends, sags in the middle
    path = `M ${x1} ${y0} Q ${(x1 + x2) / 2} ${y0 + sag * 1.6} ${x2} ${y0}`;
  }

  const arrows: number[] =
    loadType === "point"
      ? support === "cantilever"
        ? [x2]
        : [(x1 + x2) / 2]
      : [x1 + span * 0.15, x1 + span * 0.325, x1 + span * 0.5, x1 + span * 0.675, x1 + span * 0.85];

  return (
    <div className="mt-4 rounded-xl border border-border bg-white/70 p-3 dark:bg-white/5">
      <div className="mb-1 text-xs font-medium text-muted-foreground">
        Load case (schematic — deflection exaggerated)
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${support === "cantilever" ? "Cantilever" : "Simply supported"} beam with ${
          loadType === "point" ? "a point load" : "a distributed load"
        }`}
      >
        <defs>
          <marker id="ld" markerWidth="8" markerHeight="8" refX="4" refY="7" orient="auto">
            <path d="M0,0 L8,0 L4,7 Z" fill="#ef4444" />
          </marker>
        </defs>

        {/* load arrows */}
        {arrows.map((ax, i) => (
          <line
            key={i}
            x1={ax}
            y1={y0 - 30}
            x2={ax}
            y2={y0 - 6}
            stroke="#ef4444"
            strokeWidth={1.75}
            markerEnd="url(#ld)"
          />
        ))}
        {loadType === "distributed" && (
          <line x1={x1} y1={y0 - 30} x2={x2} y2={y0 - 30} stroke="#ef4444" strokeWidth={1.25} strokeOpacity={0.7} />
        )}

        {/* undeflected reference beam */}
        <line x1={x1} y1={y0} x2={x2} y2={y0} stroke="#2560e6" strokeWidth={3} strokeOpacity={0.85} />

        {/* deflected shape */}
        <path d={path} fill="none" stroke="#1aa9d6" strokeWidth={2} strokeDasharray="5 3" />

        {/* supports */}
        {support === "cantilever" ? (
          <>
            <rect x={x1 - 10} y={y0 - 22} width={10} height={44} fill="#2560e6" fillOpacity={0.2} stroke="#2560e6" strokeWidth={1.5} />
            {[0, 1, 2, 3, 4].map((i) => (
              <line key={i} x1={x1 - 10} y1={y0 - 22 + i * 11} x2={x1 - 16} y2={y0 - 16 + i * 11} stroke="#2560e6" strokeWidth={1.25} />
            ))}
          </>
        ) : (
          <>
            <path d={`M ${x1} ${y0} l -9 16 l 18 0 Z`} fill="#2560e6" fillOpacity={0.2} stroke="#2560e6" strokeWidth={1.5} />
            <path d={`M ${x2} ${y0} l -9 16 l 18 0 Z`} fill="#2560e6" fillOpacity={0.2} stroke="#2560e6" strokeWidth={1.5} />
          </>
        )}

        {/* deflection callout at max point */}
        {support === "cantilever" ? (
          <line x1={x2} y1={y0} x2={x2} y2={y0 + sag} stroke="currentColor" strokeOpacity={0.4} strokeWidth={1} strokeDasharray="2 2" />
        ) : (
          <line x1={(x1 + x2) / 2} y1={y0} x2={(x1 + x2) / 2} y2={y0 + sag * 1.6} stroke="currentColor" strokeOpacity={0.4} strokeWidth={1} strokeDasharray="2 2" />
        )}
        <text x={x2 - 4} y={H - 6} fontSize={10} textAnchor="end" fill="currentColor" fillOpacity={0.55}>
          δ = max deflection
        </text>
      </svg>
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
    <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
      {host}
    </a>
  );
}
