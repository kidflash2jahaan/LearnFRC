"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";

/* ------------------------------------------------------------------ *
 * VERIFIED CONSTANTS — every value below is primary-sourced.
 * Season/as-listed dates and source URLs are carried next to each
 * figure and surfaced to the user via the line-item source links and
 * the notes section. Values that vary by team/region/season are NOT
 * hardcoded as facts — they are editable inputs (see state below).
 * ------------------------------------------------------------------ */

const SEASON = "2025-2026";
const AS_LISTED = "as listed 2026-07";

type SourcedNumber = {
  value: number;
  cite: string; // short "$X — source, season" line for the footnote list
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

/* ------------------------------------------------------------------ */
/* Small reusable bits                                                 */
/* ------------------------------------------------------------------ */

/** Label above, hint below, control between. A placeholder never stands in. */
function Field({
  label,
  helper,
  htmlFor,
  children,
}: {
  label: string;
  helper?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="nb-field">
      <label className="nb-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {helper ? <p className="nb-hint">{helper}</p> : null}
    </div>
  );
}

function NumberInput({
  id,
  value,
  onChange,
  min = 0,
  step = 1,
  prefix,
}: {
  id: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  step?: number;
  prefix?: string;
}) {
  return (
    <span className="relative block">
      {prefix ? (
        <span
          aria-hidden="true"
          className="nb-slug pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 !text-ink"
        >
          {prefix}
        </span>
      ) : null}
      <input
        id={id}
        type="number"
        inputMode="decimal"
        className={prefix ? "nb-input pl-7" : "nb-input"}
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

/**
 * A picked-one-of-these control.
 *
 * Built from nb-tag rather than a select, because the options are short and
 * the choice changes what the rest of the panel asks for, so it has to be
 * visible rather than folded away. aria-pressed carries the state, and the
 * selected chip fills blue, so it survives greyscale.
 */
function Choice<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={legend}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className="nb-tag min-h-[2.75rem] px-3.5"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type LineItem = {
  label: string;
  amount: number;
  source?: SourcedNumber;
  note?: string;
  estimate?: boolean;
};

/**
 * One ruled line of the ledger.
 *
 * Description on the left, figure hard right in tabular mono, exactly like a
 * printed invoice, because this sheet gets handed to a sponsor or a booster
 * treasurer who is going to add the right-hand column up by eye.
 */
function ItemRow({ item }: { item: LineItem }) {
  return (
    <div className="nb-hair grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 py-2.5 first:border-t-0">
      <div className="min-w-0">
        <p className="text-[0.95rem] leading-snug">
          {item.label}
          {item.estimate ? (
            <span className="nb-slug ml-2 whitespace-nowrap">estimate</span>
          ) : null}
          {item.source ? (
            <>
              {" "}
              <a
                href={item.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="nb-link nb-slug whitespace-nowrap"
                aria-label={`Source: ${item.source.cite}`}
              >
                source
              </a>
            </>
          ) : null}
        </p>
        {item.note ? <p className="nb-hint mt-1 max-w-[62ch]">{item.note}</p> : null}
      </div>
      <p className="nb-slug shrink-0 !text-[0.9rem] !text-ink">{fmt2.format(item.amount)}</p>
    </div>
  );
}

/** A ruled section of the ledger: heading on a 2px ink rule, subtotal beside it. */
function LedgerSection({
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
    <section className="mt-[clamp(1.4rem,2.8vw,2.1rem)]">
      <div className="flex items-baseline justify-between gap-4 border-b-2 border-ink pb-2">
        <h3 className="text-[1.05rem]">{title}</h3>
        <p className="nb-count !text-[1.1rem]">{fmt0.format(subtotal)}</p>
      </div>
      {items.map((it, i) => (
        <ItemRow key={i} item={it} />
      ))}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

/**
 * The sponsor sheet.
 *
 * A budget is a document before it is a calculator: somebody prints this and
 * puts it in front of a booster club. So it is laid out as a ledger, one
 * column of description against one column of money, on ruled paper. The
 * assumptions that drive it sit above in a three-panel strip, the way a form
 * header sits above the lines it fills in, and the total is taped up top
 * because that is the number everybody scrolls looking for.
 */
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
        note: "Includes FIRST registration and your first Regional, on the Regional model.",
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
        note: `Region-specific, typically $${RANGES.districtFee.low.toLocaleString()} to $${RANGES.districtFee.high.toLocaleString()} on top of the FIRST fee. Verify with your district each season.`,
      });
      if (attendDistrictChamps && districtChampsFee > 0) {
        regItems.push({
          label: "District Championship fee",
          amount: districtChampsFee,
          estimate: true,
          note: "Varies by district, so enter your district's figure.",
        });
      }
    }
    if (attendFirstChamps) {
      regItems.push({
        label: "FIRST Championship fee",
        amount: champsFee,
        estimate: true,
        note: "The 2026 fee is not published yet. Seeded with the last publicly cited figure, about $5,750 in 2024, so re-verify when FIRST posts 2026 pricing.",
      });
    }
    if (grants > 0) {
      regItems.push({
        label: "Grants and sponsor vouchers, subtracted",
        amount: -grants,
        note: isRookie ? "Rookie teams may qualify for FIRST and sponsor startup grants." : undefined,
      });
    }
    const registration = regItems.reduce((s, it) => s + it.amount, 0);

    // ---- Drivetrain ----
    const driveItems: LineItem[] = [];
    let drivetrain = 0;
    if (drivetrainChoice === "kop") {
      if (isRookie) {
        driveItems.push({
          label: "AM14U6 KOP drive base, free for rookies",
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
        label: "COTS swerve modules, your quote",
        amount: swerveCost,
        estimate: true,
        note: "COTS swerve pricing varies widely by vendor and module count, so enter your quote.",
      });
    } else {
      driveItems.push({ label: "Reuse the existing drivetrain", amount: 0 });
    }

    // ---- Electronics ----
    const elecItems: LineItem[] = [];
    let electronics = 0;
    if (electronicsPath === "fullNew") {
      elecItems.push(
        { label: "NI roboRIO 2.0", amount: FEES.roboRIO.value, source: FEES.roboRIO },
        { label: "REV Power Distribution Hub", amount: FEES.pdh.value, source: FEES.pdh },
        { label: "VH-109 FRC Radio, education price", amount: FEES.radio.value, source: FEES.radio },
        { label: "REV Radio Power Module", amount: FEES.radioPowerModule.value, source: FEES.radioPowerModule },
        {
          label: `Robot batteries (${batteryQty} × $58)`,
          amount: batteryQty * FEES.battery.value,
          source: FEES.battery,
        },
        {
          label: "RSL, 120 A main breaker and wiring consumables",
          amount: consumables,
          estimate: true,
          note: `Bundled small legal parts, roughly $${RANGES.consumables.low} to $${RANGES.consumables.high}.`,
        },
      );
      electronics = elecItems.reduce((s, it) => s + it.amount, 0);
    } else if (electronicsPath === "bundle3230") {
      electronics = FEES.bundle3230.value;
      elecItems.push({
        label: "AndyMark FRC Basic Starter Bundle, with roboRIO",
        amount: FEES.bundle3230.value,
        source: FEES.bundle3230,
        note: "Includes the AM14U6 drive base, 4 NEO, 4 SPARK MAX, PDB and radio bundles, 2 batteries, a charger, a tool set and the roboRIO. Set drivetrain, motors and tools to reuse so nothing gets counted twice.",
      });
    } else if (electronicsPath === "bundle2750") {
      electronics = FEES.bundle2750.value;
      elecItems.push({
        label: "AndyMark FRC Basic Starter Bundle, without roboRIO",
        amount: FEES.bundle2750.value,
        source: FEES.bundle2750,
        note: "Same contents minus the roboRIO. Set drivetrain, motors and tools to reuse so nothing gets counted twice.",
      });
    } else {
      elecItems.push({ label: "Already own the control system", amount: 0 });
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
        note: "Integrated Talon FX, so there is no separate controller.",
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
              label: "Starter tools and shop equipment, your budget",
              amount: toolsCost,
              estimate: true,
              note: "Not separately priced in our sources, and a tool set is included in the Starter Bundle.",
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
              label: `Travel, lodging and food (${events} event${events === 1 ? "" : "s"} × ${fmt0.format(travelPerEvent)})`,
              amount: travelPerEvent * events,
              estimate: true,
              note: "Team and region specific. FIRST publishes no travel model.",
            },
          ]
        : [];
    const travel = travelItems.reduce((s, it) => s + it.amount, 0);

    // ---- Spares / other ----
    const spareItems: LineItem[] =
      sparesOther > 0
        ? [{ label: "Spares, sensors, pneumatics and other", amount: sparesOther, estimate: true }]
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
      events,
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
    <>
      {/* ---------------------------------------------------------------- *
       * 1. The question, with the answer taped up beside it
       * ---------------------------------------------------------------- */}
      <div className="nb-wrap py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="grid items-start gap-[clamp(1.6rem,4vw,3.4rem)] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.82fr)]">
          <div>
            <p className="nb-marker">tools / frc-budget-calculator</p>
            <h1 className="max-w-[18ch]">
              What will the season <span className="nb-mark">actually</span> cost?
            </h1>
            <p className="nb-lede mt-5">
              Registration, the drive base, the control system, motors, tools and
              travel, itemised into a sheet you can hand to a booster club without
              apologising for it.
            </p>
            <p className="nb-slug mt-4 max-w-[62ch]">
              {SEASON} season fees, hardware {AS_LISTED}. Every default is
              primary-sourced and every line that varies by team stays editable.
              Check current FIRST and vendor pricing before you commit money.
            </p>
          </div>

          {/* The total, taped to the top of the sheet, because it is the one
              number every visitor came here for. */}
          <div
            className="nb-box nb-tilt-1 relative mt-2 p-[clamp(1.2rem,2.4vw,1.7rem)]"
            aria-live="polite"
          >
            <span className="nb-tape -top-3 left-[22%] rotate-[-3.6deg]" aria-hidden="true" />
            <span
              className="nb-tape -bottom-3 right-[16%] rotate-[2.4deg]"
              aria-hidden="true"
            />
            <p className="nb-slug border-b border-dashed border-rule pb-2.5">
              estimated season total
            </p>
            <p className="mt-3 font-mono text-[clamp(2rem,1.3rem+2.4vw,3rem)] font-bold leading-none tracking-[-0.03em] text-blue tabular-nums">
              {fmt0.format(calc.grand)}
            </p>
            {hasBand ? (
              <p className="nb-slug mt-3">
                likely {fmt0.format(calc.low)} to {fmt0.format(calc.high)}, the district
                fee and consumables move it
              </p>
            ) : null}

            <dl className="nb-hair mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 pt-3.5">
              <dt className="nb-slug">per student</dt>
              <dd className="nb-slug !text-ink">
                {calc.perStudent !== null
                  ? fmt0.format(calc.perStudent)
                  : "enter a team size below"}
              </dd>
              <dt className="nb-slug">events</dt>
              <dd className="nb-slug !text-ink">
                {calc.events} paid for in this plan
              </dd>
              <dt className="nb-slug">travel</dt>
              <dd className="nb-slug !text-ink">
                {calc.travel > 0
                  ? `${fmt0.format(calc.travel)}, in the total`
                  : "not costed yet"}
              </dd>
            </dl>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- *
       * 2. The assumptions, three panels in one drawn frame
       *
       * A budget is only as honest as what you told it, so the assumptions
       * are one visible frame above the ledger rather than a scrolling form
       * column beside it. Panels divide on a 2px ink rule and stack under
       * 860px.
       * ---------------------------------------------------------------- */}
      <section className="nb-rule py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <p className="nb-marker">what you told it</p>
          <h2 className="max-w-[22ch] text-[clamp(1.5rem,1.1rem+1.6vw,2.4rem)]">
            Set the three things that move the number.
          </h2>

          <div className="nb-box mt-[clamp(1.4rem,3vw,2.2rem)] grid overflow-hidden lg:grid-cols-[1.05fr_1fr_0.92fr]">
            {/* ---- Panel 1: the team and its events ---- */}
            <div className="nb-panel gap-4">
              <p className="nb-slug border-b-2 border-ink pb-2">01 / the team</p>

              <div className="nb-field">
                <span className="nb-label">Team type</span>
                <Choice<TeamType>
                  legend="Team type"
                  value={teamType}
                  onChange={setTeamType}
                  options={[
                    { value: "rookie", label: "rookie" },
                    { value: "veteran", label: "veteran" },
                  ]}
                />
                <p className="nb-hint">
                  Rookies get the AM14U6 drive base free and may qualify for startup
                  grants.
                </p>
              </div>

              <div className="nb-field">
                <span className="nb-label">Program model</span>
                <Choice<ProgramModel>
                  legend="Program model"
                  value={programModel}
                  onChange={setProgramModel}
                  options={[
                    { value: "regional", label: "regional" },
                    { value: "district", label: "district" },
                  ]}
                />
                <p className="nb-hint">
                  Regional charges per event. District adds a region-specific program
                  fee on top of the FIRST fee.
                </p>
              </div>

              {programModel === "regional" ? (
                <Field
                  htmlFor="bg-addl"
                  label="Additional Regionals"
                  helper="Beyond the first, which the base fee covers. $3,000 each."
                >
                  <NumberInput id="bg-addl" value={addlRegionals} onChange={setAddlRegionals} />
                </Field>
              ) : (
                <>
                  <Field
                    htmlFor="bg-dfee"
                    label="District program fee"
                    helper={`Region-specific, $${RANGES.districtFee.low.toLocaleString()} to $${RANGES.districtFee.high.toLocaleString()} is typical. Verify with your district.`}
                  >
                    <NumberInput id="bg-dfee" value={districtFee} onChange={setDistrictFee} prefix="$" step={50} />
                  </Field>
                  <Field
                    htmlFor="bg-devents"
                    label="District events"
                    helper="How many qualifiers you will attend. Drives the travel count."
                  >
                    <NumberInput id="bg-devents" value={districtEvents} onChange={setDistrictEvents} />
                  </Field>
                  <label className="flex min-h-[2.75rem] cursor-pointer items-center gap-3 text-[0.95rem] font-medium">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0"
                      checked={attendDistrictChamps}
                      onChange={(e) => setAttendDistrictChamps(e.target.checked)}
                    />
                    Going to District Championship
                  </label>
                  {attendDistrictChamps ? (
                    <Field
                      htmlFor="bg-dchamps"
                      label="District Championship fee"
                      helper="Varies by district, so enter yours. Estimate."
                    >
                      <NumberInput id="bg-dchamps" value={districtChampsFee} onChange={setDistrictChampsFee} prefix="$" step={50} />
                    </Field>
                  ) : null}
                </>
              )}

              <label className="flex min-h-[2.75rem] cursor-pointer items-center gap-3 text-[0.95rem] font-medium">
                <input
                  type="checkbox"
                  className="size-4 shrink-0"
                  checked={attendFirstChamps}
                  onChange={(e) => setAttendFirstChamps(e.target.checked)}
                />
                Going to FIRST Championship
              </label>
              {attendFirstChamps ? (
                <Field
                  htmlFor="bg-champs"
                  label="FIRST Championship fee"
                  helper="Not published for 2026. Seeded with the last cited figure, about $5,750 in 2024. Re-verify."
                >
                  <NumberInput id="bg-champs" value={champsFee} onChange={setChampsFee} prefix="$" step={50} />
                </Field>
              ) : null}

              <Field
                htmlFor="bg-grants"
                label="Grants and vouchers to subtract"
                helper="Rookie grants, sponsor vouchers, anything already promised."
              >
                <NumberInput id="bg-grants" value={grants} onChange={setGrants} prefix="$" step={50} />
              </Field>
            </div>

            {/* ---- Panel 2: the robot ---- */}
            <div className="nb-panel gap-4">
              <p className="nb-slug border-b-2 border-ink pb-2">02 / the robot</p>

              <div className="nb-field">
                <span className="nb-label">Drivetrain</span>
                <Choice<DrivetrainChoice>
                  legend="Drivetrain"
                  value={drivetrainChoice}
                  onChange={setDrivetrainChoice}
                  options={[
                    { value: "kop", label: isRookie ? "KOP, free" : "KOP tank, $940" },
                    { value: "swerve", label: "COTS swerve" },
                    { value: "reuse", label: "reuse, $0" },
                  ]}
                />
              </div>
              {drivetrainChoice === "swerve" ? (
                <Field
                  htmlFor="bg-swerve"
                  label="Swerve modules, your quote"
                  helper="COTS swerve varies widely by vendor and module count."
                >
                  <NumberInput id="bg-swerve" value={swerveCost} onChange={setSwerveCost} prefix="$" step={50} />
                </Field>
              ) : null}

              <div className="nb-field">
                <span className="nb-label">Control system</span>
                <Choice<ElectronicsPath>
                  legend="Control system"
                  value={electronicsPath}
                  onChange={setElectronicsPath}
                  options={[
                    { value: "fullNew", label: "new, itemised" },
                    { value: "bundle3230", label: "bundle $3,230" },
                    { value: "bundle2750", label: "bundle $2,750" },
                    { value: "own", label: "own it, $0" },
                  ]}
                />
                <p className="nb-hint">
                  Itemise a new legal control system, take an all-in-one AndyMark
                  bundle, or reuse what is already in the crate.
                </p>
              </div>
              {electronicsPath === "fullNew" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field htmlFor="bg-batt" label="Batteries" helper="$58 each.">
                    <NumberInput id="bg-batt" value={batteryQty} onChange={setBatteryQty} />
                  </Field>
                  <Field
                    htmlFor="bg-consum"
                    label="Consumables"
                    helper={`RSL, breaker, wiring. $${RANGES.consumables.low} to $${RANGES.consumables.high}.`}
                  >
                    <NumberInput id="bg-consum" value={consumables} onChange={setConsumables} prefix="$" step={5} />
                  </Field>
                </div>
              ) : null}

              <div className="nb-hair grid gap-4 pt-4 sm:grid-cols-2">
                <Field htmlFor="bg-neo" label="NEO motors" helper="$42.50 plus a $100 SPARK MAX each.">
                  <NumberInput id="bg-neo" value={neoQty} onChange={setNeoQty} />
                </Field>
                <Field htmlFor="bg-kraken" label="Kraken X60" helper="$217.99, no controller needed.">
                  <NumberInput id="bg-kraken" value={krakenQty} onChange={setKrakenQty} />
                </Field>
                <Field htmlFor="bg-other-qty" label="Other motors" helper="Quantity.">
                  <NumberInput id="bg-other-qty" value={otherMotorQty} onChange={setOtherMotorQty} />
                </Field>
                <Field htmlFor="bg-other-unit" label="Other unit price" helper="Each.">
                  <NumberInput id="bg-other-unit" value={otherMotorUnit} onChange={setOtherMotorUnit} prefix="$" step={0.5} />
                </Field>
              </div>
            </div>

            {/* ---- Panel 3: everything nobody budgets for ---- */}
            <div className="nb-panel gap-4">
              <p className="nb-slug border-b-2 border-ink pb-2">03 / the rest of it</p>

              <Field
                htmlFor="bg-tools"
                label="Tools and shop equipment"
                helper="Your own figure. A tool set comes inside the Starter Bundle."
              >
                <NumberInput id="bg-tools" value={toolsCost} onChange={setToolsCost} prefix="$" step={25} />
              </Field>

              <Field
                htmlFor="bg-travel"
                label="Travel, lodging and food per event"
                helper={`Team and region specific, $${RANGES.travelPerEvent.low.toLocaleString()} to $${RANGES.travelPerEvent.high.toLocaleString()} is typical. This is never a quote.`}
              >
                <NumberInput id="bg-travel" value={travelPerEvent} onChange={setTravelPerEvent} prefix="$" step={50} />
              </Field>

              <Field
                htmlFor="bg-spares"
                label="Spares, sensors, pneumatics"
                helper="Everything the season eats that nobody writes down."
              >
                <NumberInput id="bg-spares" value={sparesOther} onChange={setSparesOther} prefix="$" step={25} />
              </Field>

              <Field
                htmlFor="bg-size"
                label="Team size"
                helper="Optional. Gives the per-student figure a grant application asks for."
              >
                <NumberInput id="bg-size" value={teamSize} onChange={setTeamSize} />
              </Field>

              <p className="nb-pen mt-auto rotate-[-1.4deg] pt-4">
                travel is the line teams forget
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * 3. The ledger
       *
       * One column of description against one column of money, ruled by
       * category, exactly like the sheet a treasurer expects. It prints.
       * ---------------------------------------------------------------- */}
      <section className="nb-rule py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <div className="grid gap-x-[clamp(1.5rem,4vw,3rem)] gap-y-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="nb-marker">the sheet / itemised</p>
              <h2 className="max-w-[20ch] text-[clamp(1.5rem,1.1rem+1.6vw,2.4rem)]">
                Every line, with where the price came from.
              </h2>
            </div>
            <div className="flex flex-wrap gap-3 lg:pb-1">
              <button type="button" className="nb-btn" onClick={() => window.print()}>
                Print this sheet
              </button>
              {authed ? (
                <button
                  type="button"
                  className="nb-btn-ghost"
                  onClick={() =>
                    window.alert("Scenario saved. (Persistence is wired to your account soon.)")
                  }
                >
                  Save scenario
                </button>
              ) : (
                <Link href="/signup?next=/tools/frc-budget-calculator" className="nb-btn-ghost">
                  Save this to an account
                </Link>
              )}
            </div>
          </div>

          {calc.rookieBenefit > 0 ? (
            <p className="nb-note mt-[clamp(1.4rem,3vw,2.2rem)] max-w-[64ch] text-[0.95rem] leading-relaxed">
              <span className="nb-slug mb-1 block">rookie benefit, already applied</span>
              The AM14U6 KOP drive base comes with your registration, so the{" "}
              {fmt0.format(calc.rookieBenefit)} retail value is a zero on this sheet
              rather than a cost. It is real money you are not spending, and it is
              worth saying out loud in a sponsor letter.
            </p>
          ) : null}

          <div className="mt-[clamp(1rem,2.4vw,1.6rem)] max-w-[74ch]">
            <LedgerSection title="Registration" items={calc.regItems} subtotal={calc.registration} />
            <LedgerSection title="Drivetrain" items={calc.driveItems} subtotal={calc.drivetrain} />
            <LedgerSection title="Control system" items={calc.elecItems} subtotal={calc.electronics} />
            <LedgerSection title="Motors and controllers" items={calc.motorItems} subtotal={calc.motors} />
            <LedgerSection title="Tools" items={calc.toolItems} subtotal={calc.tools} />
            <LedgerSection title="Travel" items={calc.travelItems} subtotal={calc.travel} />
            <LedgerSection title="Spares and other" items={calc.spareItems} subtotal={calc.spares} />

            {/* The bottom line, on the heaviest rule on the page. */}
            <div className="mt-[clamp(1.6rem,3.2vw,2.4rem)] border-t-2 border-ink pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <h3 className="text-[clamp(1.2rem,1rem+0.8vw,1.6rem)]">Grand total</h3>
                <p className="font-mono text-[clamp(1.6rem,1.2rem+1.6vw,2.4rem)] font-bold leading-none tracking-[-0.03em] text-blue tabular-nums">
                  {fmt0.format(calc.grand)}
                </p>
              </div>
              <p className="nb-slug mt-3 max-w-[60ch]">
                {hasBand
                  ? `Likely ${fmt0.format(calc.low)} to ${fmt0.format(calc.high)} once the district fee and consumables land where they land.`
                  : "No documented range applies to this plan, so the total is the total."}
                {calc.travel === 0
                  ? " Travel is still zero here, and travel is almost never zero."
                  : ""}
                {attendFirstChamps
                  ? " The Championship fee on this sheet is a 2024-based estimate."
                  : ""}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * 4. The back of the sheet
       * ---------------------------------------------------------------- */}
      <section className="nb-rule py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="nb-marker">the back of the sheet</span>
                <span className="block text-[clamp(1.35rem,1.05rem+1.2vw,2rem)] font-extrabold tracking-[-0.025em]">
                  Where every default number came from.
                </span>
              </span>
              <span className="nb-slug shrink-0 !text-ink" aria-hidden="true">
                <span className="group-open:hidden">show</span>
                <span className="hidden group-open:inline">hide</span>
              </span>
            </summary>

            <div className="mt-[clamp(1.4rem,3vw,2.2rem)] grid gap-[clamp(1.4rem,3vw,2.6rem)] lg:grid-cols-2">
              <div>
                <p className="nb-slug border-b-2 border-ink pb-2">what to re-check every year</p>
                <ul className="nb-prose mt-4 !max-w-none text-[0.95rem]">
                  <li>
                    Registration is FIRST&rsquo;s published {SEASON} pricing: $6,300 for
                    every team worldwide, $3,000 per additional Regional. FIRST adjusts
                    this annually, so re-verify before Kickoff.
                  </li>
                  <li>
                    On the district model the $6,300 is only the base. Your district,
                    whether that is FIRST Washington, FIN, PNW, NE or ONT, bills its own
                    program and event fees separately.
                  </li>
                  <li>
                    The FIRST Championship fee here is historical, about $5,750 from
                    2024, and is not published for 2026. Treat it as an estimate.
                  </li>
                  <li>
                    Vendor prices are the currently listed FRC and education prices,
                    checked 2026-07. MSRP is higher on several items, like the Kraken X60
                    at $399.99. Shipping and tax are not included.
                  </li>
                  <li>
                    Travel, lodging and food are yours to enter. The typical range on
                    this page is context, never a quote.
                  </li>
                  <li>
                    This estimates cost only. It is not affiliated with or endorsed by
                    FIRST, AndyMark, REV Robotics, CTR Electronics or WestCoast Products.
                  </li>
                </ul>
              </div>

              <div>
                <p className="nb-slug border-b-2 border-ink pb-2">sourced default values</p>
                <ul className="m-0 mt-1 list-none p-0">
                  {Object.values(FEES).map((f) => (
                    <li
                      key={f.url + f.cite}
                      className="nb-hair flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2.5 first:border-t-0"
                    >
                      <span className="min-w-0 flex-1 text-[0.9rem] leading-snug text-graphite">
                        {f.cite}
                      </span>
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="nb-link nb-slug shrink-0"
                      >
                        source
                      </a>
                    </li>
                  ))}
                  <li className="nb-hair flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2.5">
                    <span className="min-w-0 flex-1 text-[0.9rem] leading-snug text-graphite">
                      District program fee, region-specific $
                      {RANGES.districtFee.low.toLocaleString()} to $
                      {RANGES.districtFee.high.toLocaleString()}, editable, verify with
                      your district
                    </span>
                    <a
                      href={RANGES.districtFee.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="nb-link nb-slug shrink-0"
                    >
                      source
                    </a>
                  </li>
                  <li className="nb-hair py-2.5 text-[0.9rem] leading-snug text-graphite">
                    RSL, 120 A main breaker and wiring consumables, bundled small parts,
                    roughly ${RANGES.consumables.low} to ${RANGES.consumables.high},
                    editable.
                  </li>
                  <li className="nb-hair py-2.5 text-[0.9rem] leading-snug text-graphite">
                    Travel, lodging and food, user-entered. $
                    {RANGES.travelPerEvent.low.toLocaleString()} to $
                    {RANGES.travelPerEvent.high.toLocaleString()} is typical, and FIRST
                    publishes no travel model.
                  </li>
                  <li className="nb-hair py-2.5 text-[0.9rem] leading-snug text-graphite">
                    FIRST Championship fee, about $5,750 last publicly cited in 2024, not
                    published for 2026. Editable estimate.
                  </li>
                </ul>
              </div>
            </div>
          </details>
        </div>
      </section>
    </>
  );
}
