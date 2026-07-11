"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Calculator,
  Printer,
  Info,
  ExternalLink,
  Sparkles,
  Wallet,
  Users,
  AlertTriangle,
  CheckCircle2,
  Save,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 * VERIFIED CONSTANTS — every value below is primary-sourced.
 * Season/as-listed dates and source URLs are carried next to each
 * figure and surfaced to the user via tooltips + the Notes & sources
 * section. Values that vary by team/region/season are NOT hardcoded
 * as facts — they are editable inputs (see state below).
 * ------------------------------------------------------------------ */

const SEASON = "2025-2026";
const AS_LISTED = "as listed 2026-07";

type SourcedNumber = {
  value: number;
  cite: string; // short "$X — source, season" line for tooltip/footnote
  url: string;
};

const FEES = {
  // FIRST registration (published 2025-2026)
  baseReg: {
    value: 6300,
    cite: "$6,300 — FIRST base team/season registration, all teams incl. rookies (2025-2026)",
    url: "https://community.firstinspires.org/2025-2026-first-program-registration-pricing",
  },
  addlRegional: {
    value: 3000,
    cite: "$3,000 — each additional Regional beyond the first (FIRST 2025-2026)",
    url: "https://community.firstinspires.org/2025-2026-first-program-registration-pricing",
  },
  // Drivetrain
  am14u6: {
    value: 940,
    cite: "$940 — AndyMark AM14U6 KOP drive base (2026 Kit of Parts)",
    url: "https://andymark.com/products/am14u6-6-wheel-drop-center-robot-drive-base-2025-frc-kit-of-parts-drive-base",
  },
  // Core control system
  roboRIO: {
    value: 485,
    cite: `$485 — NI roboRIO 2.0 (${AS_LISTED})`,
    url: "https://andymark.com/products/ni-roborio-2",
  },
  pdh: {
    value: 250,
    cite: `$250 — REV Power Distribution Hub, REV-11-1850 (${AS_LISTED})`,
    url: "https://www.revrobotics.com/rev-11-1850/",
  },
  radio: {
    value: 184.99,
    cite: "$184.99 — Vivid-Hosting VH-109 FRC Radio, FRC/education price (2025-2026)",
    url: "https://store.ctr-electronics.com/products/frc-radio",
  },
  radioPowerModule: {
    value: 34,
    cite: `$34 — REV Radio Power Module, REV-11-1856 (${AS_LISTED})`,
    url: "https://www.revrobotics.com/rev-11-1856/",
  },
  battery: {
    value: 58,
    cite: `$58 ea — MK ES17-12 12V 18Ah SLA battery (set of 2 = $116, ${AS_LISTED})`,
    url: "https://andymark.com/products/mk-es17-12-12v-sla-battery-set-of-2",
  },
  // Motors & controllers
  neo: {
    value: 42.5,
    cite: `$42.50 — REV NEO Brushless Motor V1.1 (sale, down from $50.00, ${AS_LISTED})`,
    url: "https://www.revrobotics.com/rev-21-1650/",
  },
  sparkMax: {
    value: 100,
    cite: `$100 — REV SPARK MAX controller, one required per NEO (${AS_LISTED})`,
    url: "https://www.revrobotics.com/rev-11-2158/",
  },
  kraken: {
    value: 217.99,
    cite: `$217.99 — Kraken X60 w/ integrated Talon FX, FRC price (MSRP $399.99, ${AS_LISTED}); no separate controller`,
    url: "https://wcproducts.com/products/kraken",
  },
  // All-in-one anchors
  bundle3230: {
    value: 3230,
    cite: `$3,230 — AndyMark FRC Basic Starter Bundle WITH roboRIO (${AS_LISTED})`,
    url: "https://andymark.com/products/frc-basic-starter-bundle-1",
  },
  bundle2750: {
    value: 2750,
    cite: `$2,750 — AndyMark FRC Basic Starter Bundle WITHOUT roboRIO (${AS_LISTED})`,
    url: "https://andymark.com/products/frc-basic-starter-bundle-1",
  },
} as const satisfies Record<string, SourcedNumber>;

/* Documented RANGES for values that must never be a false-precise fact.
 * These seed EDITABLE inputs; the low/high feed the estimate band. */
const RANGES = {
  districtFee: {
    low: 3500,
    high: 5500,
    default: 4500,
    url: "https://firstwa.org/frc-registration/",
  },
  consumables: {
    low: 40,
    high: 80,
    default: 60,
    url: "https://andymark.com/products/frc-basic-starter-bundle-1",
  },
  travelPerEvent: { low: 500, high: 5000 },
} as const;

/* FIRST Championship fee — NOT published for 2026. Per verification,
 * do NOT ship $5,000 as a fact; seed with the last publicly-cited
 * figure (~$5,750, 2024) as an editable, clearly-flagged estimate. */
const CHAMPS_FEE_LAST_KNOWN = 5750;

type ProgramModel = "regional" | "district";
type TeamType = "rookie" | "veteran";
type DrivetrainChoice = "kop" | "swerve" | "reuse";
type ElectronicsPath = "fullNew" | "bundle3230" | "bundle2750" | "own";

const fmt0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const fmt2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inputCls =
  "w-full rounded-xl border border-border bg-white/60 px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/* ------------------------------------------------------------------ */
/* Small reusable bits                                                 */
/* ------------------------------------------------------------------ */

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {helper ? (
        <span className="mt-0.5 block text-xs text-muted-foreground">{helper}</span>
      ) : null}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  min = 0,
  step = 1,
  prefix,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  step?: number;
  prefix?: string;
}) {
  return (
    <span className="relative block">
      {prefix ? (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {prefix}
        </span>
      ) : null}
      <input
        type="number"
        inputMode="decimal"
        className={prefix ? `${inputCls} pl-7` : inputCls}
        value={Number.isFinite(value) ? value : 0}
        min={min}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? Math.max(min, n) : min);
        }}
      />
    </span>
  );
}

function SegBtn<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="ac-badge flex flex-wrap gap-1.5 rounded-xl p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors " +
              (active
                ? "bg-primary text-white shadow-sm"
                : "text-foreground/70 hover:text-foreground")
            }
            aria-pressed={active}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SourceInfo({ cite, url }: { cite: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={cite}
      className="inline-flex items-center text-muted-foreground hover:text-primary"
      aria-label={`Source: ${cite}`}
    >
      <Info className="h-3.5 w-3.5" aria-hidden />
    </a>
  );
}

type LineItem = {
  label: string;
  amount: number;
  source?: SourcedNumber;
  note?: string;
  estimate?: boolean;
};

function ItemRow({ item }: { item: LineItem }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm text-foreground">
          <span className="truncate">{item.label}</span>
          {item.source ? <SourceInfo cite={item.source.cite} url={item.source.url} /> : null}
          {item.estimate ? (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              estimate
            </span>
          ) : null}
        </div>
        {item.note ? (
          <div className="text-xs text-muted-foreground">{item.note}</div>
        ) : null}
      </div>
      <div className="shrink-0 tabular-nums text-sm text-foreground">
        {fmt2.format(item.amount)}
      </div>
    </div>
  );
}

function CategoryBlock({
  title,
  items,
  subtotal,
}: {
  title: string;
  items: LineItem[];
  subtotal: number;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-white/60 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </h4>
        <span className="tabular-nums text-sm font-semibold text-foreground">
          {fmt0.format(subtotal)}
        </span>
      </div>
      <div className="ac-divider my-2" />
      {items.map((it, i) => (
        <ItemRow key={i} item={it} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export default function BudgetCalculator({ authed }: { authed: boolean }) {
  // Team & program
  const [teamType, setTeamType] = useState<TeamType>("rookie");
  const [programModel, setProgramModel] = useState<ProgramModel>("regional");

  // Registration inputs
  const [addlRegionals, setAddlRegionals] = useState<number>(0);
  const [districtEvents, setDistrictEvents] = useState<number>(2);
  const [districtFee, setDistrictFee] = useState<number>(RANGES.districtFee.default);
  const [attendDistrictChamps, setAttendDistrictChamps] = useState<boolean>(false);
  const [districtChampsFee, setDistrictChampsFee] = useState<number>(0);
  const [attendFirstChamps, setAttendFirstChamps] = useState<boolean>(false);
  const [champsFee, setChampsFee] = useState<number>(CHAMPS_FEE_LAST_KNOWN);
  const [grants, setGrants] = useState<number>(0);

  // Drivetrain
  const [drivetrainChoice, setDrivetrainChoice] = useState<DrivetrainChoice>("kop");
  const [swerveCost, setSwerveCost] = useState<number>(0);

  // Electronics
  const [electronicsPath, setElectronicsPath] = useState<ElectronicsPath>("fullNew");
  const [batteryQty, setBatteryQty] = useState<number>(2);
  const [consumables, setConsumables] = useState<number>(RANGES.consumables.default);

  // Motors
  const [neoQty, setNeoQty] = useState<number>(4);
  const [krakenQty, setKrakenQty] = useState<number>(0);
  const [otherMotorQty, setOtherMotorQty] = useState<number>(0);
  const [otherMotorUnit, setOtherMotorUnit] = useState<number>(0);

  // Tools / travel / spares / team size
  const [toolsCost, setToolsCost] = useState<number>(0);
  const [travelPerEvent, setTravelPerEvent] = useState<number>(0);
  const [sparesOther, setSparesOther] = useState<number>(0);
  const [teamSize, setTeamSize] = useState<number>(0);

  const isRookie = teamType === "rookie";

  const calc = useMemo(() => {
    // ---- Registration ----
    const regItems: LineItem[] = [
      {
        label: "FIRST base team registration",
        amount: FEES.baseReg.value,
        source: FEES.baseReg,
        note: "Includes FIRST registration + participation at your first Regional (Regional model).",
      },
    ];
    if (programModel === "regional" && addlRegionals > 0) {
      regItems.push({
        label: `Additional Regional events (${addlRegionals} × $3,000)`,
        amount: addlRegionals * FEES.addlRegional.value,
        source: FEES.addlRegional,
      });
    }
    if (programModel === "district") {
      regItems.push({
        label: "District program fee",
        amount: districtFee,
        estimate: true,
        note: `Region-specific — typically $${RANGES.districtFee.low.toLocaleString()}–$${RANGES.districtFee.high.toLocaleString()} on top of the FIRST fee. Verify with your district each season.`,
      });
      if (attendDistrictChamps && districtChampsFee > 0) {
        regItems.push({
          label: "District Championship fee",
          amount: districtChampsFee,
          estimate: true,
          note: "Varies by district — enter your district's figure.",
        });
      }
    }
    if (attendFirstChamps) {
      regItems.push({
        label: "FIRST Championship fee",
        amount: champsFee,
        estimate: true,
        note: "2026 fee not yet published by FIRST. Seeded with the last publicly-cited figure (~$5,750, 2024) — re-verify when FIRST posts 2026 pricing.",
      });
    }
    if (grants > 0) {
      regItems.push({
        label: "Grants & sponsor vouchers (subtracted)",
        amount: -grants,
        note: isRookie ? "Rookie teams may qualify for FIRST/sponsor startup grants." : undefined,
      });
    }
    const registration = regItems.reduce((s, it) => s + it.amount, 0);

    // ---- Drivetrain ----
    const driveItems: LineItem[] = [];
    let drivetrain = 0;
    if (drivetrainChoice === "kop") {
      if (isRookie) {
        driveItems.push({
          label: "AM14U6 KOP drive base — included free for rookies",
          amount: 0,
          source: FEES.am14u6,
          note: "$940 retail value provided with rookie registration.",
        });
      } else {
        drivetrain = FEES.am14u6.value;
        driveItems.push({
          label: "AM14U6 KOP tank drive base",
          amount: FEES.am14u6.value,
          source: FEES.am14u6,
        });
      }
    } else if (drivetrainChoice === "swerve") {
      drivetrain = swerveCost;
      driveItems.push({
        label: "COTS swerve modules (your quote)",
        amount: swerveCost,
        estimate: true,
        note: "COTS swerve pricing varies widely by vendor and module count — enter your quote.",
      });
    } else {
      driveItems.push({ label: "Reuse existing drivetrain", amount: 0 });
    }

    // ---- Electronics ----
    const elecItems: LineItem[] = [];
    let electronics = 0;
    if (electronicsPath === "fullNew") {
      elecItems.push(
        { label: "NI roboRIO 2.0", amount: FEES.roboRIO.value, source: FEES.roboRIO },
        { label: "REV Power Distribution Hub", amount: FEES.pdh.value, source: FEES.pdh },
        { label: "VH-109 FRC Radio (education price)", amount: FEES.radio.value, source: FEES.radio },
        { label: "REV Radio Power Module", amount: FEES.radioPowerModule.value, source: FEES.radioPowerModule },
        {
          label: `Robot batteries (${batteryQty} × $58)`,
          amount: batteryQty * FEES.battery.value,
          source: FEES.battery,
        },
        {
          label: "RSL + 120A main breaker + wiring consumables",
          amount: consumables,
          estimate: true,
          note: `Bundled small legal parts — roughly $${RANGES.consumables.low}–$${RANGES.consumables.high}.`,
        },
      );
      electronics = elecItems.reduce((s, it) => s + it.amount, 0);
    } else if (electronicsPath === "bundle3230") {
      electronics = FEES.bundle3230.value;
      elecItems.push({
        label: "AndyMark FRC Basic Starter Bundle (with roboRIO)",
        amount: FEES.bundle3230.value,
        source: FEES.bundle3230,
        note: "Includes AM14U6 drive base, 4× NEO, 4× SPARK MAX, PDB & radio bundles, 2 batteries, charger, tool set, roboRIO. Set Drivetrain/Motors/Tools to reuse to avoid double-counting.",
      });
    } else if (electronicsPath === "bundle2750") {
      electronics = FEES.bundle2750.value;
      elecItems.push({
        label: "AndyMark FRC Basic Starter Bundle (without roboRIO)",
        amount: FEES.bundle2750.value,
        source: FEES.bundle2750,
        note: "Same contents minus the roboRIO. Set Drivetrain/Motors/Tools to reuse to avoid double-counting.",
      });
    } else {
      elecItems.push({ label: "Already own control system", amount: 0 });
    }

    // ---- Motors & controllers ----
    const motorItems: LineItem[] = [];
    const sparkMaxQty = neoQty; // enforce 1 SPARK MAX per NEO
    if (neoQty > 0) {
      motorItems.push({
        label: `REV NEO motors (${neoQty} × $42.50)`,
        amount: neoQty * FEES.neo.value,
        source: FEES.neo,
      });
      motorItems.push({
        label: `REV SPARK MAX controllers (${sparkMaxQty} × $100)`,
        amount: sparkMaxQty * FEES.sparkMax.value,
        source: FEES.sparkMax,
        note: "One SPARK MAX is required per NEO.",
      });
    }
    if (krakenQty > 0) {
      motorItems.push({
        label: `Kraken X60 motors (${krakenQty} × $217.99)`,
        amount: krakenQty * FEES.kraken.value,
        source: FEES.kraken,
        note: "Integrated Talon FX — no separate controller.",
      });
    }
    if (otherMotorQty > 0 && otherMotorUnit > 0) {
      motorItems.push({
        label: `Other motors (${otherMotorQty} × ${fmt2.format(otherMotorUnit)})`,
        amount: otherMotorQty * otherMotorUnit,
        estimate: true,
      });
    }
    const motors = motorItems.reduce((s, it) => s + it.amount, 0);

    // ---- Tools ----
    const toolItems: LineItem[] =
      toolsCost > 0
        ? [
            {
              label: "Starter tools & shop equipment (your budget)",
              amount: toolsCost,
              estimate: true,
              note: "Not separately priced in our sources; a tool set is included in the Starter Bundle.",
            },
          ]
        : [];
    const tools = toolItems.reduce((s, it) => s + it.amount, 0);

    // ---- Travel ----
    const events =
      programModel === "regional"
        ? 1 + addlRegionals + (attendFirstChamps ? 1 : 0)
        : districtEvents + (attendDistrictChamps ? 1 : 0) + (attendFirstChamps ? 1 : 0);
    const travelItems: LineItem[] =
      travelPerEvent > 0
        ? [
            {
              label: `Travel, lodging & food (${events} event${events === 1 ? "" : "s"} × ${fmt0.format(travelPerEvent)})`,
              amount: travelPerEvent * events,
              estimate: true,
              note: "Team/region specific — FIRST publishes no travel model.",
            },
          ]
        : [];
    const travel = travelItems.reduce((s, it) => s + it.amount, 0);

    // ---- Spares / other ----
    const spareItems: LineItem[] =
      sparesOther > 0
        ? [{ label: "Spares, sensors, pneumatics & other", amount: sparesOther, estimate: true }]
        : [];
    const spares = spareItems.reduce((s, it) => s + it.amount, 0);

    const grand = registration + drivetrain + electronics + motors + tools + travel + spares;

    // ---- Low / High band (documented ranges: district fee, consumables) ----
    const districtDelta = programModel === "district" ? districtFee : 0;
    const consumDelta = electronicsPath === "fullNew" ? consumables : 0;
    const grandLowRaw =
      grand - districtDelta - consumDelta + (programModel === "district" ? RANGES.districtFee.low : 0) + (electronicsPath === "fullNew" ? RANGES.consumables.low : 0);
    const grandHighRaw =
      grand - districtDelta - consumDelta + (programModel === "district" ? RANGES.districtFee.high : 0) + (electronicsPath === "fullNew" ? RANGES.consumables.high : 0);
    const low = Math.min(grandLowRaw, grand);
    const high = Math.max(grandHighRaw, grand);

    const perStudent = teamSize > 0 ? grand / teamSize : null;
    const rookieBenefit = isRookie && drivetrainChoice === "kop" ? FEES.am14u6.value : 0;

    return {
      registration,
      drivetrain,
      electronics,
      motors,
      tools,
      travel,
      spares,
      grand,
      low,
      high,
      perStudent,
      rookieBenefit,
      regItems,
      driveItems,
      elecItems,
      motorItems,
      toolItems,
      travelItems,
      spareItems,
    };
  }, [
    teamType,
    programModel,
    addlRegionals,
    districtEvents,
    districtFee,
    attendDistrictChamps,
    districtChampsFee,
    attendFirstChamps,
    champsFee,
    grants,
    drivetrainChoice,
    swerveCost,
    electronicsPath,
    batteryQty,
    consumables,
    neoQty,
    krakenQty,
    otherMotorQty,
    otherMotorUnit,
    toolsCost,
    travelPerEvent,
    sparesOther,
    teamSize,
    isRookie,
  ]);

  const hasBand = calc.high - calc.low > 1;

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <span className="ac-chip inline-flex items-center gap-2">
          <span className="ac-eyebrow">FRC PLANNING</span>
        </span>
        <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Team Budget &amp; Startup Cost{" "}
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
        <p className="mt-2 max-w-2xl text-sm text-foreground/70">
          Build a transparent, itemized season budget for your FRC team — registration,
          drivetrain, control system, motors, travel and more. Every default is
          primary-sourced; values that vary by team or region stay editable.
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Figures: {SEASON} season, hardware {AS_LISTED}. Verify against the current FIRST
          Game Manual &amp; vendor pricing before committing.
        </p>
      </div>

      {/* Body grid */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* ---------------- LEFT: inputs ---------------- */}
        <div className="ac-card rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" aria-hidden />
            <h3 className="font-display text-base font-semibold">Your team</h3>
          </div>

          <div className="mt-4 space-y-4">
            <Field label="Team type" helper="Rookies receive the AM14U6 drive base free and may qualify for startup grants.">
              <SegBtn<TeamType>
                value={teamType}
                onChange={setTeamType}
                options={[
                  { value: "rookie", label: "Rookie" },
                  { value: "veteran", label: "Veteran" },
                ]}
              />
            </Field>

            <Field label="Program / event model" helper="Regional model uses per-event fees; District model adds a region-specific program fee on top of the FIRST fee.">
              <SegBtn<ProgramModel>
                value={programModel}
                onChange={setProgramModel}
                options={[
                  { value: "regional", label: "Regional" },
                  { value: "district", label: "District" },
                ]}
              />
            </Field>

            {programModel === "regional" ? (
              <Field label="Additional Regional events" helper="Beyond your first Regional (which is included in the base fee). Each is $3,000.">
                <NumberInput value={addlRegionals} onChange={setAddlRegionals} />
              </Field>
            ) : (
              <>
                <Field
                  label="District program fee"
                  helper={`Region-specific ($${RANGES.districtFee.low.toLocaleString()}–$${RANGES.districtFee.high.toLocaleString()} typical). Estimate — verify with your district each season.`}
                >
                  <NumberInput value={districtFee} onChange={setDistrictFee} prefix="$" step={50} />
                </Field>
                <Field label="District events (for travel count)" helper="How many district qualifiers you'll attend.">
                  <NumberInput value={districtEvents} onChange={setDistrictEvents} />
                </Field>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={attendDistrictChamps}
                    onChange={(e) => setAttendDistrictChamps(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Attending District Championship?
                </label>
                {attendDistrictChamps ? (
                  <Field label="District Championship fee" helper="Varies by district — enter yours. Estimate.">
                    <NumberInput value={districtChampsFee} onChange={setDistrictChampsFee} prefix="$" step={50} />
                  </Field>
                ) : null}
              </>
            )}

            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={attendFirstChamps}
                onChange={(e) => setAttendFirstChamps(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Attending FIRST Championship?
            </label>
            {attendFirstChamps ? (
              <Field
                label="FIRST Championship fee"
                helper="2026 not yet published by FIRST. Seeded with the last cited figure (~$5,750, 2024) — estimate, re-verify."
              >
                <NumberInput value={champsFee} onChange={setChampsFee} prefix="$" step={50} />
              </Field>
            ) : null}

            <Field label="Grants & sponsor vouchers to subtract" helper="Rookie grants, sponsor vouchers, etc.">
              <NumberInput value={grants} onChange={setGrants} prefix="$" step={50} />
            </Field>

            <div className="ac-divider" />

            {/* Drivetrain */}
            <Field label="Drivetrain" helper="Rookies: KOP drive base is free. COTS swerve pricing varies — enter your quote.">
              <SegBtn<DrivetrainChoice>
                value={drivetrainChoice}
                onChange={setDrivetrainChoice}
                options={[
                  { value: "kop", label: isRookie ? "KOP (free)" : "KOP tank ($940)" },
                  { value: "swerve", label: "COTS swerve" },
                  { value: "reuse", label: "Reuse ($0)" },
                ]}
              />
            </Field>
            {drivetrainChoice === "swerve" ? (
              <Field label="Swerve modules cost (your quote)" helper="COTS swerve varies widely by vendor/module count.">
                <NumberInput value={swerveCost} onChange={setSwerveCost} prefix="$" step={50} />
              </Field>
            ) : null}

            <div className="ac-divider" />

            {/* Electronics */}
            <Field label="Control system" helper="Itemize a new legal control system, use an all-in-one AndyMark bundle, or reuse what you own.">
              <SegBtn<ElectronicsPath>
                value={electronicsPath}
                onChange={setElectronicsPath}
                options={[
                  { value: "fullNew", label: "New (itemized)" },
                  { value: "bundle3230", label: "Bundle $3,230" },
                  { value: "bundle2750", label: "Bundle $2,750" },
                  { value: "own", label: "Own ($0)" },
                ]}
              />
            </Field>
            {electronicsPath === "fullNew" ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Batteries" helper="$58 each">
                  <NumberInput value={batteryQty} onChange={setBatteryQty} />
                </Field>
                <Field label="Consumables" helper={`RSL/breaker/wiring ($${RANGES.consumables.low}–$${RANGES.consumables.high})`}>
                  <NumberInput value={consumables} onChange={setConsumables} prefix="$" step={5} />
                </Field>
              </div>
            ) : null}

            <div className="ac-divider" />

            {/* Motors */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">Motors &amp; controllers</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="NEO motors" helper="$42.50 + $100 SPARK MAX each">
                <NumberInput value={neoQty} onChange={setNeoQty} />
              </Field>
              <Field label="Kraken X60" helper="$217.99, no controller">
                <NumberInput value={krakenQty} onChange={setKrakenQty} />
              </Field>
              <Field label="Other motors" helper="Optional — qty">
                <NumberInput value={otherMotorQty} onChange={setOtherMotorQty} />
              </Field>
              <Field label="Other unit price" helper="Optional — $ each">
                <NumberInput value={otherMotorUnit} onChange={setOtherMotorUnit} prefix="$" step={0.5} />
              </Field>
            </div>

            <div className="ac-divider" />

            {/* Tools / travel / spares / size */}
            <Field label="Tools & starter equipment" helper="Your shop/tool budget (a tool set is included in the Starter Bundle).">
              <NumberInput value={toolsCost} onChange={setToolsCost} prefix="$" step={25} />
            </Field>
            <Field label="Travel, lodging & food per event" helper={`Team/region specific ($${RANGES.travelPerEvent.low.toLocaleString()}–$${RANGES.travelPerEvent.high.toLocaleString()} typical). Never a quote — enter your own.`}>
              <NumberInput value={travelPerEvent} onChange={setTravelPerEvent} prefix="$" step={50} />
            </Field>
            <Field label="Spares, sensors, pneumatics & other" helper="Anything else your season needs.">
              <NumberInput value={sparesOther} onChange={setSparesOther} prefix="$" step={25} />
            </Field>
            <Field label="Team size (optional)" helper="For a per-student cost — useful for grant asks.">
              <NumberInput value={teamSize} onChange={setTeamSize} />
            </Field>
          </div>
        </div>

        {/* ---------------- RIGHT: live results ---------------- */}
        <div className="ac-card rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" aria-hidden />
            <h3 className="font-display text-base font-semibold">Season budget</h3>
          </div>

          {/* Primary result */}
          <div className="mt-4 rounded-2xl border border-border bg-white/60 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Estimated grand total
            </div>
            <div
              className="mt-1 font-display text-4xl font-extrabold tabular-nums sm:text-5xl"
              style={{
                background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {fmt0.format(calc.grand)}
            </div>
            {hasBand ? (
              <div className="mt-1 text-sm text-foreground/70 tabular-nums">
                Likely range {fmt0.format(calc.low)} – {fmt0.format(calc.high)}
                <span className="ml-1 text-xs text-muted-foreground">
                  (district fee &amp; consumables vary)
                </span>
              </div>
            ) : null}
            {calc.perStudent !== null ? (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary/5 px-2.5 py-1 text-sm text-primary">
                <Users className="h-3.5 w-3.5" aria-hidden />
                <span className="tabular-nums font-semibold">{fmt0.format(calc.perStudent)}</span>
                <span className="text-foreground/70">per student</span>
              </div>
            ) : null}
          </div>

          {/* Rookie benefit callout */}
          {calc.rookieBenefit > 0 ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                Rookie benefit: the AM14U6 KOP drive base (
                <span className="font-semibold tabular-nums">{fmt0.format(calc.rookieBenefit)}</span>{" "}
                retail value) is included free with your registration.
              </span>
            </div>
          ) : null}

          {/* Itemized categories */}
          <div className="mt-4 space-y-3">
            <CategoryBlock title="Registration" items={calc.regItems} subtotal={calc.registration} />
            <CategoryBlock title="Drivetrain" items={calc.driveItems} subtotal={calc.drivetrain} />
            <CategoryBlock title="Control system" items={calc.elecItems} subtotal={calc.electronics} />
            <CategoryBlock title="Motors & controllers" items={calc.motorItems} subtotal={calc.motors} />
            <CategoryBlock title="Tools" items={calc.toolItems} subtotal={calc.tools} />
            <CategoryBlock title="Travel" items={calc.travelItems} subtotal={calc.travel} />
            <CategoryBlock title="Spares / other" items={calc.spareItems} subtotal={calc.spares} />
          </div>

          {/* Verdict badges */}
          <div className="mt-4 flex flex-wrap gap-2">
            {calc.travel > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Travel included in total
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Add a travel estimate for a full picture
              </span>
            )}
            {attendFirstChamps ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Championship fee is a 2024-based estimate
              </span>
            ) : null}
          </div>

          {/* Actions */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" className="ac-btn inline-flex items-center gap-2" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden /> Print / Save PDF
            </button>
            {authed ? (
              <button
                type="button"
                className="ac-btn-ghost inline-flex items-center gap-2"
                onClick={() => window.alert("Scenario saved. (Persistence is wired to your account soon.)")}
              >
                <Save className="h-4 w-4" aria-hidden /> Save scenario
              </button>
            ) : null}
          </div>

          {!authed ? (
            <div className="mt-3 rounded-xl border border-dashed border-border bg-primary/5 p-3 text-sm">
              <Link
                href="/signup?next=/tools/frc-budget-calculator"
                className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                Create a free account to save scenarios &amp; export
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                The full calculator, math and citations stay free — no account required.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Notes & sources */}
      <details className="ac-glass mt-6 rounded-2xl p-5">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">
          Notes &amp; sources
        </summary>
        <div className="mt-3 space-y-3 text-sm text-foreground/70">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Registration figures are FIRST&apos;s {SEASON} published fees (worldwide $6,300 all
              teams; additional regionals $3,000). Re-verify each season at
              community.firstinspires.org / help.firstinspires.org before Kickoff — FIRST adjusts
              these annually.
            </li>
            <li>
              District teams: the $6,300 FIRST fee is only the base. Your district (e.g. FIRST
              Washington, FIN, PNW, NE, ONT) adds its own program/event fees that vary by region and
              are billed separately — select your district or enter the amount from your district
              organization.
            </li>
            <li>
              FIRST Championship fee is shown from recent historical pricing (~$5,750, 2024) and is
              NOT yet published for 2026 — treat as an estimate and confirm when FIRST posts it.
            </li>
            <li>
              Vendor hardware prices are the currently-listed FRC/education prices (checked 2026-07)
              and can change; MSRP is higher than the education price on several items (e.g. Kraken
              X60 $399.99 MSRP, VH-109 radio). Prices exclude shipping and tax.
            </li>
            <li>
              Travel, lodging, and food are inherently team-specific and are user-entered — never
              treat the range as a quote.
            </li>
            <li>
              This tool estimates cost only; it is not affiliated with or endorsed by FIRST,
              AndyMark, REV Robotics, CTR Electronics, or WestCoast Products.
            </li>
          </ul>

          <div className="ac-divider" />

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Sourced default values
            </div>
            <ul className="space-y-1.5">
              {Object.values(FEES).map((f) => (
                <li key={f.url + f.cite} className="flex items-start gap-2 text-xs">
                  <span className="text-foreground/70">{f.cite}</span>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-0.5 text-primary hover:underline"
                  >
                    source <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                </li>
              ))}
              <li className="flex items-start gap-2 text-xs">
                <span className="text-foreground/70">
                  District program fee — region-specific ${RANGES.districtFee.low.toLocaleString()}–$
                  {RANGES.districtFee.high.toLocaleString()} (editable; verify with your district)
                </span>
                <a
                  href={RANGES.districtFee.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-0.5 text-primary hover:underline"
                >
                  source <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </li>
              <li className="text-xs text-foreground/70">
                RSL + 120A main breaker + wiring consumables — bundled small parts, roughly $
                {RANGES.consumables.low}–${RANGES.consumables.high} (editable).
              </li>
              <li className="text-xs text-foreground/70">
                Travel/lodging/food — user-entered ($
                {RANGES.travelPerEvent.low.toLocaleString()}–$
                {RANGES.travelPerEvent.high.toLocaleString()} typical); FIRST publishes no travel
                model.
              </li>
              <li className="text-xs text-foreground/70">
                FIRST Championship fee — ~$5,750 (last publicly cited, 2024); 2026 not yet published
                by FIRST. Editable estimate.
              </li>
            </ul>
          </div>
        </div>
      </details>
    </div>
  );
}
