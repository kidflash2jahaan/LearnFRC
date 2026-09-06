"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";

/* ------------------------------------------------------------------ *
 * VERIFIED CONSTANTS: every number below is sourced in tools_verified
 * and printed with its citation on the back of the sheet.
 * ------------------------------------------------------------------ */

const MAIN_BREAKER_A = 120; // Cooper Bussmann CB285-120
const BRANCH_RATINGS = [40, 30, 20, 10] as const; // Snap-Action MX5/VB3
const RORIO1_BROWNOUT_V = 6.3; // roboRIO 1.0, fixed (WPILib)
const RORIO2_BROWNOUT_DEFAULT_V = 6.75; // roboRIO 2.0 default, software-settable
const STAGE1_RAIL_V = 6.8; // 6V PWM rail begins to droop (WPILib)
const BLACKOUT_V = 4.5; // possible device blackout (WPILib)
const RECOVERY_V = 7.5; // brownout recovery (WPILib)
const BATTERY_BRIEF_MAX_A = 180; // battery can briefly supply >180 A (WPILib)

// Battery sag-model defaults (needs_range, user-adjustable).
const DEFAULT_VOC_V = 12.5; // conservative resting default
const DEFAULT_RINT_OHM = 0.015; // ideal ceiling; 0.011 mfr to 0.020 retire
const RINT_MIN_OHM = 0.011;
const RINT_MAX_OHM = 0.02;

type Motor = {
  key: string;
  name: string;
  freeRpm: number;
  stallA: number;
  freeA: number;
  stallNm: number;
  legacy?: boolean;
  note?: string;
  source: string;
};

// Motor library: FIRST 2017 Motor Information sheet plus vendor spec pages.
const MOTORS: Motor[] = [
  {
    key: "kraken-trap",
    name: "Kraken X60 (Trapezoidal)",
    freeRpm: 6000,
    stallA: 366,
    freeA: 2,
    stallNm: 7.09,
    note: "WCP Trapezoidal at 12 V",
    source: "WCP Kraken X60 motor-performance (Trap)",
  },
  {
    key: "kraken-foc",
    name: "Kraken X60 (FOC)",
    freeRpm: 5800,
    stallA: 483,
    freeA: 2,
    stallNm: 9.37,
    note: "WCP Field-Oriented Control at 12 V, higher stall than Trap mode",
    source: "WCP Kraken X60 motor-performance (FOC)",
  },
  {
    key: "falcon500",
    name: "Falcon 500",
    freeRpm: 6380,
    stallA: 257,
    freeA: 1.5,
    stallNm: 4.69,
    legacy: true,
    note: "Discontinued but still legal and common",
    source: "CTRE Falcon 500 (Talon FX) User Guide",
  },
  {
    key: "neo",
    name: "REV NEO (V1.1)",
    freeRpm: 5676,
    stallA: 105,
    freeA: 1.8,
    stallNm: 2.6,
    source: "REV-21-1650 data sheet",
  },
  {
    key: "neo-vortex",
    name: "REV NEO Vortex",
    freeRpm: 6784,
    stallA: 211,
    freeA: 3.6,
    stallNm: 3.6,
    source: "REV NEO Vortex specs",
  },
  {
    key: "neo550",
    name: "REV NEO 550",
    freeRpm: 11000,
    stallA: 100,
    freeA: 1.4,
    stallNm: 0.97,
    source: "REV NEO 550 specs",
  },
  {
    key: "cim",
    name: "CIM",
    freeRpm: 5310,
    stallA: 133,
    freeA: 2.7,
    stallNm: 2.43,
    note: "FIRST 2017 sheet: 5310 rpm and 133 A. VEX/AndyMark sheets list 5330 rpm and 131 A.",
    source: "FIRST 2017 Motor Information",
  },
  {
    key: "minicim",
    name: "MiniCIM",
    freeRpm: 6200,
    stallA: 86,
    freeA: 1.5,
    stallNm: 1.4,
    source: "FIRST 2017 Motor Information",
  },
  {
    key: "bag",
    name: "BAG",
    freeRpm: 14000,
    stallA: 41,
    freeA: 1.8,
    stallNm: 0.4,
    source: "FIRST 2017 Motor Information",
  },
  {
    key: "775pro",
    name: "775pro",
    freeRpm: 18700,
    stallA: 134,
    freeA: 0.7,
    stallNm: 0.71,
    source: "FIRST 2017 Motor Information",
  },
];

const MOTOR_BY_KEY: Record<string, Motor> = MOTORS.reduce<Record<string, Motor>>(
  (acc, m) => {
    acc[m.key] = m;
    return acc;
  },
  {},
);

type CurrentMode = "limit" | "running" | "worst";

type MechMotor = {
  id: number;
  motorKey: string;
  mode: CurrentMode;
  limit: string; // amps as free text, only used in "limit" mode
  branch: number; // branch breaker rating, one breaker PER motor controller
};

type Mechanism = {
  id: number;
  name: string;
  running: boolean; // counted in the simultaneous total?
  motors: MechMotor[];
};

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function toNum(s: string, fallback: number): number {
  const v = Number.parseFloat(s);
  return Number.isFinite(v) ? v : fallback;
}

function fmt(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "n/a";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Current a single motor contributes in the selected mode. */
function motorCurrent(mm: MechMotor): number {
  const motor = MOTOR_BY_KEY[mm.motorKey];
  if (!motor) return 0;
  if (mm.mode === "worst") return motor.stallA;
  if (mm.mode === "running") return motor.freeA;
  const lim = toNum(mm.limit, 0);
  return lim > 0 ? lim : 0;
}

const MODE_WORD: Record<CurrentMode, string> = {
  limit: "smart limit",
  running: "free running",
  worst: "stalled",
};

// Seeded high so post-mount additions never collide with the deterministic
// initial-preset ids (1..N) below. nextId() is only ever called from client
// event handlers, so mutating this module counter is SSR-safe.
let idSeed = 1000;
function nextId(): number {
  idSeed += 1;
  return idSeed;
}

function makeMotor(
  id: number,
  motorKey: string,
  mode: CurrentMode,
  limit: string,
  branch: number,
): MechMotor {
  return { id, motorKey, mode, limit, branch };
}

// The initial preset renders during SSR, so its ids MUST be deterministic: a
// module-level counter diverges between the server and client render and trips
// a hydration mismatch. This local counter yields the same 1..N every call.
function typicalDrive(): Mechanism[] {
  let s = 0;
  const id = () => (s += 1);
  // Each motor controller sits on its OWN branch breaker, so a four-motor
  // drivetrain is four 40 A breakers, never one.
  return [
    {
      id: id(),
      name: "Drivetrain",
      running: true,
      motors: [
        makeMotor(id(), "kraken-trap", "limit", "40", 40),
        makeMotor(id(), "kraken-trap", "limit", "40", 40),
        makeMotor(id(), "kraken-trap", "limit", "40", 40),
        makeMotor(id(), "kraken-trap", "limit", "40", 40),
      ],
    },
    {
      id: id(),
      name: "Intake",
      running: false,
      motors: [makeMotor(id(), "neo", "limit", "30", 30)],
    },
    {
      id: id(),
      name: "Elevator",
      running: false,
      motors: [
        makeMotor(id(), "falcon500", "limit", "40", 40),
        makeMotor(id(), "falcon500", "limit", "40", 40),
      ],
    },
  ];
}

function fullSend(): Mechanism[] {
  return typicalDrive().map((m) => ({
    ...m,
    running: true,
    motors: m.motors.map((mm) => ({
      ...mm,
      id: nextId(),
      mode: "worst" as CurrentMode,
    })),
  }));
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

/**
 * The load sheet.
 *
 * A team opens this page holding one question that a match will answer for
 * them anyway: does the robot keep running when everything moves at once. So
 * the verdict is stamped across an ink band at the top, and everything under
 * it is the working: the pack written on one tag, the load list as a stack of
 * index cards, then every motor checked against its own breaker in a single
 * ruled table. Status is carried by sentences, never by a hue, because the
 * binder prints in one ink.
 */
export default function CurrentBudgetCalculator({
  authed,
}: {
  authed: boolean;
}): React.JSX.Element {
  const [rorio, setRorio] = useState<"1.0" | "2.0">("2.0");
  const [brownout2, setBrownout2] = useState<string>(
    String(RORIO2_BROWNOUT_DEFAULT_V),
  );
  const [vOc, setVOc] = useState<string>(String(DEFAULT_VOC_V));
  const [rInt, setRInt] = useState<number>(DEFAULT_RINT_OHM);
  const [mechanisms, setMechanisms] = useState<Mechanism[]>(() => typicalDrive());
  const [notesOpen, setNotesOpen] = useState(false);

  const brownoutThreshold =
    rorio === "1.0"
      ? RORIO1_BROWNOUT_V
      : toNum(brownout2, RORIO2_BROWNOUT_DEFAULT_V);

  /* ---- live computation ------------------------------------------ */
  const computed = useMemo(() => {
    const perMech = mechanisms.map((m) => {
      // Each motor is protected by its OWN branch breaker, so the branch check
      // is per motor, never the summed multi-motor mechanism total.
      const motors = m.motors.map((mm) => {
        const current = motorCurrent(mm);
        const status: "ok" | "warn" | "over" =
          current > mm.branch
            ? "over"
            : current > mm.branch * 0.85
              ? "warn"
              : "ok";
        return { mm, current, status };
      });
      // The mechanism total still feeds the 120 A main and the battery sag.
      const current = motors.reduce((sum, x) => sum + x.current, 0);
      const branchStatus: "ok" | "warn" | "over" = motors.some(
        (x) => x.status === "over",
      )
        ? "over"
        : motors.some((x) => x.status === "warn")
          ? "warn"
          : "ok";
      return { mech: m, motors, current, branchStatus };
    });

    const iTotal = perMech
      .filter((p) => p.mech.running)
      .reduce((sum, p) => sum + p.current, 0);

    const vOcNum = toNum(vOc, DEFAULT_VOC_V);
    const vBus = vOcNum - iTotal * rInt;

    const mainStatus: "ok" | "warn" | "over" =
      iTotal > MAIN_BREAKER_A
        ? "over"
        : iTotal > MAIN_BREAKER_A * 0.85
          ? "warn"
          : "ok";

    let brownoutVerdict: "safe" | "marginal" | "brownout";
    if (vBus <= brownoutThreshold) brownoutVerdict = "brownout";
    else if (vBus <= STAGE1_RAIL_V) brownoutVerdict = "marginal";
    else brownoutVerdict = "safe";

    // Plain-language callouts. Branch breakers are per motor controller, so we
    // describe individual motors against their own breaker and never claim one
    // breaker carries a whole mechanism's summed current.
    const callouts: string[] = [];
    for (const p of perMech) {
      const over = p.motors.filter((x) => x.status === "over");
      const warn = p.motors.filter((x) => x.status === "warn");
      if (over.length === 1) {
        const x = over[0];
        callouts.push(
          `A ${p.mech.name} motor pulls ${fmt(x.current, 0)} A through a ${x.mm.branch} A branch breaker. It trips on a sustained pull.`,
        );
      } else if (over.length > 1) {
        const maxA = Math.max(...over.map((x) => x.current));
        const sameBranch = over.every((x) => x.mm.branch === over[0].mm.branch);
        callouts.push(
          sameBranch
            ? `${p.mech.name}: ${over.length} motors each exceed their ${over[0].mm.branch} A branch breaker, up to ${fmt(maxA, 0)} A. Each one trips on a sustained pull.`
            : `${p.mech.name}: ${over.length} motors exceed their own branch breakers, up to ${fmt(maxA, 0)} A. Each one trips on a sustained pull.`,
        );
      }
      if (warn.length === 1) {
        const x = warn[0];
        callouts.push(
          `A ${p.mech.name} motor at ${fmt(x.current, 0)} A sits within 15% of its ${x.mm.branch} A branch breaker. There is almost no headroom left.`,
        );
      } else if (warn.length > 1) {
        const avgA = warn.reduce((s, x) => s + x.current, 0) / warn.length;
        const sameBranch = warn.every((x) => x.mm.branch === warn[0].mm.branch);
        callouts.push(
          sameBranch
            ? `${p.mech.name}: each of the ${warn.length} motors sits near ${fmt(avgA, 0)} A against a ${warn[0].mm.branch} A branch breaker. There is almost no headroom left.`
            : `${p.mech.name}: ${warn.length} motors sit within 15% of their own branch breakers. There is almost no headroom left.`,
        );
      }
    }
    if (mainStatus === "over") {
      callouts.push(
        `Simultaneous draw of about ${fmt(iTotal, 0)} A is past the 120 A main breaker. A sustained overage trips it, and the pack can only source over ${BATTERY_BRIEF_MAX_A} A for an instant.`,
      );
    } else if (mainStatus === "warn") {
      callouts.push(
        `Simultaneous draw of about ${fmt(iTotal, 0)} A is close to the 120 A main breaker.`,
      );
    }
    if (brownoutVerdict === "brownout") {
      callouts.push(
        `Estimated bus voltage of ${fmt(vBus, 2)} V is at or below the ${fmt(brownoutThreshold, 2)} V brownout line, so the roboRIO would disable outputs.`,
      );
    } else if (brownoutVerdict === "marginal") {
      callouts.push(
        `Estimated bus voltage of ${fmt(vBus, 2)} V is under the ${STAGE1_RAIL_V} V rail-droop point but still above the ${fmt(brownoutThreshold, 2)} V brownout line.`,
      );
    }

    // One flat row per motor, so the whole robot can be read as one ruled
    // table rather than as a pile of nested cards.
    const rows = perMech.flatMap((p) =>
      p.motors.map((x) => ({
        key: `${p.mech.id}-${x.mm.id}`,
        mechName: p.mech.name,
        running: p.mech.running,
        motorName: MOTOR_BY_KEY[x.mm.motorKey]?.name ?? "Motor",
        mode: x.mm.mode,
        branch: x.mm.branch,
        current: x.current,
        status: x.status,
      })),
    );

    return {
      perMech,
      rows,
      iTotal,
      vBus,
      mainStatus,
      brownoutVerdict,
      callouts,
    };
  }, [mechanisms, vOc, rInt, brownoutThreshold]);

  /* ---- mechanism editing ------------------------------------------ */
  function updateMech(id: number, patch: Partial<Mechanism>) {
    setMechanisms((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }
  function updateMotor(mechId: number, motorId: number, patch: Partial<MechMotor>) {
    setMechanisms((prev) =>
      prev.map((m) =>
        m.id === mechId
          ? {
              ...m,
              motors: m.motors.map((mm) =>
                mm.id === motorId ? { ...mm, ...patch } : mm,
              ),
            }
          : m,
      ),
    );
  }
  function addMotor(mechId: number) {
    setMechanisms((prev) =>
      prev.map((m) =>
        m.id === mechId
          ? {
              ...m,
              motors: [...m.motors, makeMotor(nextId(), "neo", "limit", "40", 40)],
            }
          : m,
      ),
    );
  }
  function removeMotor(mechId: number, motorId: number) {
    setMechanisms((prev) =>
      prev.map((m) =>
        m.id === mechId
          ? { ...m, motors: m.motors.filter((mm) => mm.id !== motorId) }
          : m,
      ),
    );
  }
  function addMechanism() {
    setMechanisms((prev) => [
      ...prev,
      {
        id: nextId(),
        name: `Mechanism ${prev.length + 1}`,
        running: true,
        motors: [makeMotor(nextId(), "neo", "limit", "40", 40)],
      },
    ]);
  }
  function removeMechanism(id: number) {
    setMechanisms((prev) => prev.filter((m) => m.id !== id));
  }

  const headroomA = MAIN_BREAKER_A - computed.iTotal;
  const marginV = computed.vBus - brownoutThreshold;

  // Below the blackout floor the linear sag model has nothing left to say, and
  // it will happily print a negative voltage. The maths is untouched, it still
  // drives the verdict and the working, but the headline says what actually
  // happens instead of quoting a figure that cannot exist.
  const offScale = computed.vBus < BLACKOUT_V;

  const verdictLine =
    computed.brownoutVerdict === "brownout"
      ? "The pack sags past the brownout line."
      : computed.brownoutVerdict === "marginal"
        ? "The pack sags into the rail-droop band."
        : computed.mainStatus === "over"
          ? "Voltage holds, but the main breaker does not."
          : "Everything here can run at once.";

  const verdictBody =
    computed.brownoutVerdict === "brownout"
      ? offScale
        ? `About ${fmt(computed.iTotal, 0)} A drags the pack under the ${BLACKOUT_V} V blackout floor, off the bottom of the sag model. This is not a brownout you drive through, it is the robot switching off.`
        : `At ${fmt(computed.vBus, 2)} V the roboRIO sheds load: PWM outputs cut and the robot stops answering.`
      : computed.brownoutVerdict === "marginal"
        ? `At ${fmt(computed.vBus, 2)} V the 6 V rail starts to droop before the ${fmt(brownoutThreshold, 2)} V brownout line. Servos and sensors on that rail go first.`
        : computed.mainStatus === "over"
          ? `About ${fmt(computed.iTotal, 0)} A is past the 120 A main breaker, so a sustained pull kills robot power outright.`
          : `${fmt(computed.vBus, 2)} V at the board, ${fmt(marginV, 2)} V clear of the ${fmt(brownoutThreshold, 2)} V brownout line.`;

  const runningCount = mechanisms.filter((m) => m.running).length;

  return (
    <>
      {/* ---------------------------------------------------------------- *
       * 1. The question, then the two scenarios worth starting from
       * ---------------------------------------------------------------- */}
      <div className="nb-wrap py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="grid gap-x-[clamp(1.5rem,4vw,3rem)] gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="nb-marker">tools / frc-current-budget</p>
            <h1 className="max-w-[19ch]">
              Can it all run at once, or does the robot{" "}
              <span className="nb-mark">go dark</span>?
            </h1>
            <p className="nb-lede mt-5">
              List every motor, set the smart-current limits you actually
              configured, and see the total against the 120 A main breaker and
              the roboRIO brownout line before a match finds it for you.
            </p>
            <p className="nb-slug mt-4 max-w-[62ch]">
              Motor figures come from the FIRST 2017 motor sheet and vendor spec
              pages. Breaker and brownout figures come from WPILib. Bus-voltage
              sag is a first-order estimate, not a promise.
            </p>
          </div>
          <p className="nb-pen max-w-[16ch] rotate-[1.6deg] lg:pb-2 lg:text-right">
            the breaker doesn’t care what you meant
          </p>
        </div>

        <div className="nb-hair mt-[clamp(1.6rem,3.4vw,2.4rem)] pt-[clamp(1.1rem,2.2vw,1.5rem)]">
          <p className="nb-slug">start from a scenario</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              className="nb-btn-ghost nb-btn-sm"
              onClick={() => setMechanisms(typicalDrive())}
            >
              Typical drive
            </button>
            <button
              type="button"
              className="nb-btn-ghost nb-btn-sm"
              onClick={() => setMechanisms(fullSend())}
            >
              Full send, everything stalled
            </button>
          </div>
          <p className="mt-3 max-w-[70ch] text-[0.95rem] leading-relaxed text-graphite">
            Typical drive is a four-Kraken drivetrain at a 40 A limit with the
            intake and elevator idle. Full send runs the same robot with every
            motor stalled at once, which is what a pin against the wall looks
            like electrically.
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------------------- *
       * 2. The verdict, stamped across an ink band
       *
       * This is a pass/fail a match will answer anyway, so it goes at the top
       * and big. The wording carries the state; the inverted band is weight,
       * never the only signal.
       * ---------------------------------------------------------------- */}
      <section
        className="nb-slab py-[clamp(2rem,4.4vw,3.2rem)]"
        aria-live="polite"
      >
        <div className="nb-wrap grid items-end gap-[clamp(1.3rem,3vw,2.6rem)] lg:grid-cols-[minmax(0,1.05fr)_repeat(3,minmax(0,0.72fr))]">
          <div>
            <p className="nb-slug !text-[rgba(245,246,242,0.82)]">
              verdict / {runningCount} of {mechanisms.length} mechanisms running
            </p>
            <h2 className="mt-2 max-w-[16ch] text-[clamp(1.5rem,1.1rem+1.7vw,2.4rem)] text-card">
              {verdictLine}
            </h2>
            <p className="mt-3 max-w-[36ch] text-[0.95rem] text-[rgba(245,246,242,0.85)]">
              {verdictBody}
            </p>
          </div>

          <p className="nb-stamp">
            <b>{fmt(computed.iTotal, 0)}</b>
            <span>amps drawn at once</span>
          </p>
          <p className="nb-stamp">
            <b>{offScale ? "dark" : fmt(computed.vBus, 2)}</b>
            <span>
              {offScale
                ? `under the ${BLACKOUT_V} V blackout floor`
                : "volts left at the board"}
            </span>
          </p>
          <p className="nb-stamp">
            <b>{fmt(Math.abs(headroomA), 0)}</b>
            <span>
              amps {headroomA >= 0 ? "under" : "over"} the 120 A main
            </span>
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * 3. The pack and the controller, written on one tag
       *
       * Four numbers set every line the robot is measured against, so they
       * live together on one hand-ruled tag with the lines they produce
       * printed in its footer.
       * ---------------------------------------------------------------- */}
      <section className="py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <p className="nb-marker">the pack / four numbers set the lines</p>
          <h2 className="max-w-[21ch] text-[clamp(1.5rem,1.1rem+1.6vw,2.4rem)]">
            Describe the battery and the roboRIO you actually have.
          </h2>

          <div className="nb-box nb-tilt-3 relative mt-[clamp(1.4rem,3vw,2.2rem)] p-[clamp(1.2rem,2.6vw,2rem)]">
            <span
              className="nb-tape -top-3 left-[11%] rotate-[-3.6deg]"
              aria-hidden="true"
            />
            <span
              className="nb-tape -bottom-3 right-[16%] rotate-[2.4deg]"
              aria-hidden="true"
            />

            <div className="grid gap-[clamp(1rem,2.2vw,1.5rem)] sm:grid-cols-2">
              <div className="nb-field">
                <label className="nb-label" htmlFor="cb-rorio">
                  roboRIO version
                </label>
                <select
                  id="cb-rorio"
                  className="nb-input nb-select"
                  value={rorio}
                  onChange={(e) =>
                    setRorio(e.target.value === "1.0" ? "1.0" : "2.0")
                  }
                >
                  <option value="2.0">roboRIO 2.0</option>
                  <option value="1.0">roboRIO 1.0</option>
                </select>
                <p className="nb-hint">
                  Sets the brownout line. The 1.0 is fixed at 6.3 V, the 2.0
                  defaults to 6.75 V.
                </p>
              </div>

              <div className="nb-field">
                <label className="nb-label" htmlFor="cb-brownout">
                  Brownout threshold (V)
                </label>
                <input
                  id="cb-brownout"
                  className="nb-input"
                  type="number"
                  inputMode="decimal"
                  step="0.05"
                  value={rorio === "1.0" ? RORIO1_BROWNOUT_V : brownout2}
                  disabled={rorio === "1.0"}
                  onChange={(e) => setBrownout2(e.target.value)}
                />
                <p className="nb-hint">
                  {rorio === "1.0"
                    ? "Fixed in hardware on the roboRIO 1.0."
                    : "Software-settable on the 2.0 with setBrownoutVoltage()."}
                </p>
              </div>

              <div className="nb-field">
                <label className="nb-label" htmlFor="cb-voc">
                  Battery resting voltage V<sub>oc</sub> (V)
                </label>
                <input
                  id="cb-voc"
                  className="nb-input"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={vOc}
                  onChange={(e) => setVOc(e.target.value)}
                />
                <p className="nb-hint">
                  12.5 V is a conservative default. A healthy match pack reads
                  about 12.7 to 13.5 V open circuit.
                </p>
              </div>

              <div className="nb-field">
                <label className="nb-label" htmlFor="cb-rint">
                  Internal resistance R<sub>int</sub> (Ω)
                </label>
                <div className="flex min-h-[2.75rem] items-center gap-3">
                  <input
                    id="cb-rint"
                    type="range"
                    min={RINT_MIN_OHM}
                    max={RINT_MAX_OHM}
                    step={0.001}
                    className="w-full"
                    value={rInt}
                    onChange={(e) => setRInt(Number.parseFloat(e.target.value))}
                  />
                  <span className="nb-slug shrink-0 !text-ink">
                    {rInt.toFixed(3)}
                  </span>
                </div>
                <p className="nb-hint">
                  0.011 is the manufacturer figure, under 0.015 is healthy, over
                  0.020 means retire the pack. Use your Battery Beak reading.
                </p>
              </div>
            </div>

            {/* Tag footer: the lines these four numbers draw. */}
            <dl className="nb-hair mt-[clamp(1.2rem,2.6vw,1.8rem)] grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 pt-[clamp(1.1rem,2.2vw,1.5rem)]">
              <dt className="nb-slug">brownout line</dt>
              <dd className="nb-slug !text-ink">
                {fmt(brownoutThreshold, 2)} V on the roboRIO {rorio}
              </dd>
              <dt className="nb-slug">rail droop</dt>
              <dd className="nb-slug !text-ink">
                {STAGE1_RAIL_V} V, where the 6 V PWM rail starts to sag
              </dd>
              <dt className="nb-slug">sag right now</dt>
              <dd className="nb-slug !text-ink">
                {fmt(toNum(vOc, DEFAULT_VOC_V), 2)} V resting minus{" "}
                {fmt(computed.iTotal, 0)} A times {rInt.toFixed(3)} Ω is{" "}
                {fmt(computed.vBus, 2)} V
              </dd>
              <dt className="nb-slug">margin</dt>
              <dd className="nb-slug !text-ink">
                {marginV >= 0
                  ? `${fmt(marginV, 2)} V above the brownout line`
                  : `${fmt(Math.abs(marginV), 2)} V below the brownout line`}
              </dd>
              <dt className="nb-slug">blackout floor</dt>
              <dd className="nb-slug !text-ink">
                {BLACKOUT_V} V, devices can drop out. Recovery at {RECOVERY_V} V.
              </dd>
            </dl>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * 4. The load list
       *
       * A robot is a stack of mechanisms, so the list is a stack of index
       * cards: one card per mechanism, one line per motor inside it, and a
       * running subtotal at the foot of each card.
       * ---------------------------------------------------------------- */}
      <section className="nb-rule py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <div className="grid gap-x-[clamp(1.5rem,4vw,3rem)] gap-y-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="nb-marker">the load list / one line per motor</p>
              <h2 className="max-w-[22ch] text-[clamp(1.5rem,1.1rem+1.6vw,2.4rem)]">
                Every motor, and whether it is moving right now.
              </h2>
              <p className="nb-sub mt-4">
                Only mechanisms marked running are counted in the simultaneous
                total. Untick the ones that never move at the same time, because
                a budget that assumes everything stalls at once is a budget
                nobody can build to.
              </p>
            </div>
            <button
              type="button"
              onClick={addMechanism}
              className="nb-btn-ghost nb-btn-sm shrink-0 lg:mb-1"
            >
              Add a mechanism
            </button>
          </div>

          <div className="mt-[clamp(1.4rem,3vw,2.2rem)] grid gap-[clamp(1.2rem,2.6vw,1.9rem)]">
            {mechanisms.map((m, mi) => {
              const p = computed.perMech.find((x) => x.mech.id === m.id);
              const current = p ? p.current : 0;
              return (
                <div
                  key={m.id}
                  className="nb-box relative p-[clamp(1.1rem,2.4vw,1.7rem)]"
                >
                  {mi === 0 ? (
                    <span
                      className="nb-tape -top-3 right-[12%] rotate-[2.9deg]"
                      aria-hidden="true"
                    />
                  ) : null}

                  <div className="grid items-end gap-[clamp(0.9rem,2vw,1.4rem)] sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <div className="nb-field">
                      <label className="nb-label" htmlFor={`cb-name-${m.id}`}>
                        Mechanism
                      </label>
                      <input
                        id={`cb-name-${m.id}`}
                        className="nb-input"
                        value={m.name}
                        onChange={(e) => updateMech(m.id, { name: e.target.value })}
                      />
                    </div>

                    <label className="flex min-h-[2.75rem] cursor-pointer items-center gap-2.5 sm:pb-1">
                      <input
                        type="checkbox"
                        className="size-4 shrink-0"
                        checked={m.running}
                        onChange={(e) =>
                          updateMech(m.id, { running: e.target.checked })
                        }
                      />
                      <span className="text-[0.95rem] font-semibold">
                        Running now
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => removeMechanism(m.id)}
                      className="nb-box-sm inline-flex size-11 items-center justify-center justify-self-start font-mono text-[0.95rem] sm:mb-1 sm:justify-self-end"
                    >
                      <span aria-hidden="true">−</span>
                      <span className="sr-only">Remove {m.name}</span>
                    </button>
                  </div>

                  <ul className="mt-[clamp(1rem,2.2vw,1.5rem)] border-t-2 border-ink">
                    {m.motors.map((mm) => {
                      const motor = MOTOR_BY_KEY[mm.motorKey];
                      const draw = motorCurrent(mm);
                      return (
                        <li
                          key={mm.id}
                          className="grid items-end gap-[0.7rem] border-b border-dashed border-rule py-[clamp(0.85rem,1.8vw,1.15rem)] sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.6fr)_minmax(0,0.6fr)_auto]"
                        >
                          <div className="nb-field">
                            <label
                              className="nb-label"
                              htmlFor={`cb-motor-${mm.id}`}
                            >
                              Motor
                            </label>
                            <select
                              id={`cb-motor-${mm.id}`}
                              className="nb-input nb-select"
                              value={mm.motorKey}
                              onChange={(e) =>
                                updateMotor(m.id, mm.id, {
                                  motorKey: e.target.value,
                                })
                              }
                            >
                              {MOTORS.map((mo) => (
                                <option key={mo.key} value={mo.key}>
                                  {mo.name}
                                  {mo.legacy ? " (legacy)" : ""}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="nb-field">
                            <label
                              className="nb-label"
                              htmlFor={`cb-mode-${mm.id}`}
                            >
                              Drawing
                            </label>
                            <select
                              id={`cb-mode-${mm.id}`}
                              className="nb-input nb-select"
                              value={mm.mode}
                              onChange={(e) =>
                                updateMotor(m.id, mm.id, {
                                  mode: e.target.value as CurrentMode,
                                })
                              }
                            >
                              <option value="limit">Smart limit</option>
                              <option value="running">Free running</option>
                              <option value="worst">Stalled</option>
                            </select>
                          </div>

                          <div className="nb-field">
                            <label
                              className="nb-label"
                              htmlFor={`cb-amps-${mm.id}`}
                            >
                              Amps
                            </label>
                            {mm.mode === "limit" ? (
                              <input
                                id={`cb-amps-${mm.id}`}
                                className="nb-input"
                                type="number"
                                inputMode="decimal"
                                min={0}
                                value={mm.limit}
                                onChange={(e) =>
                                  updateMotor(m.id, mm.id, {
                                    limit: e.target.value,
                                  })
                                }
                              />
                            ) : (
                              <p
                                id={`cb-amps-${mm.id}`}
                                className="nb-slug flex min-h-[2.75rem] items-center !text-ink"
                              >
                                {fmt(draw, 0)} A{" "}
                                {motor
                                  ? mm.mode === "worst"
                                    ? "at stall"
                                    : "idling"
                                  : ""}
                              </p>
                            )}
                          </div>

                          <div className="nb-field">
                            <label
                              className="nb-label"
                              htmlFor={`cb-brkr-${mm.id}`}
                            >
                              Breaker
                            </label>
                            <select
                              id={`cb-brkr-${mm.id}`}
                              className="nb-input nb-select"
                              value={mm.branch}
                              onChange={(e) =>
                                updateMotor(m.id, mm.id, {
                                  branch: Number.parseInt(e.target.value, 10),
                                })
                              }
                            >
                              {BRANCH_RATINGS.map((r) => (
                                <option key={r} value={r}>
                                  {r} A
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeMotor(m.id, mm.id)}
                            className="nb-box-sm inline-flex size-11 items-center justify-center justify-self-start font-mono text-[0.95rem] lg:mb-1 lg:justify-self-end"
                          >
                            <span aria-hidden="true">−</span>
                            <span className="sr-only">
                              Remove this motor from {m.name}
                            </span>
                          </button>
                        </li>
                      );
                    })}

                    {m.motors.length === 0 ? (
                      <li className="border-b border-dashed border-rule py-4">
                        <p className="nb-slug">
                          nothing on this mechanism yet
                        </p>
                      </li>
                    ) : null}
                  </ul>

                  <div className="mt-[clamp(0.9rem,2vw,1.3rem)] flex flex-wrap items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => addMotor(m.id)}
                      className="nb-btn-ghost nb-btn-sm"
                    >
                      Add a motor
                    </button>
                    <p className="nb-count">
                      {fmt(current, 0)}
                      <small>
                        A total{m.running ? "" : ", not counted while idle"}
                      </small>
                    </p>
                  </div>
                </div>
              );
            })}

            {mechanisms.length === 0 ? (
              <p className="nb-note max-w-[52ch] text-[0.95rem] text-graphite">
                <span className="nb-slug mb-1 block">nothing to budget</span>
                The list is empty. Add a mechanism, or load one of the two
                scenarios at the top of the page.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * 5. Every motor against its own breaker
       *
       * One breaker protects one controller, so the check that matters is per
       * motor. Printing the whole robot as one ruled table is the only way to
       * see which single motor is the problem.
       * ---------------------------------------------------------------- */}
      <section className="nb-rule py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <div className="grid gap-x-[clamp(1.5rem,4vw,3rem)] gap-y-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="nb-marker">the check / one breaker, one controller</p>
              <h2 className="max-w-[22ch] text-[clamp(1.5rem,1.1rem+1.6vw,2.4rem)]">
                Every motor measured against its own breaker.
              </h2>
              <p className="nb-sub mt-4">
                A four-motor drivetrain is four separate 40 A breakers, not one
                160 A one. Read the headroom column per motor, then read the
                total against the main.
              </p>
            </div>
            <p className="nb-count shrink-0 lg:pb-1 lg:text-right">
              {fmt(computed.iTotal, 0)}
              <small>A against the {MAIN_BREAKER_A} A main</small>
            </p>
          </div>

          {/* `tabIndex` because this table is 46rem wide and holds no links:
              below that width the scroller is reachable by pointer only, and
              the right-hand columns cannot be read from a keyboard at all. */}
          <div className="nb-scroll mt-[clamp(1.4rem,3vw,2.2rem)]" tabIndex={0}>
            <table className="nb-table min-w-[46rem]">
              <caption className="sr-only">
                Every motor in the load list with its draw, its own branch
                breaker rating, and the headroom between them.
              </caption>
              <thead>
                <tr>
                  <th scope="col">mechanism</th>
                  <th scope="col">motor</th>
                  <th scope="col">drawing</th>
                  <th scope="col">amps</th>
                  <th scope="col">breaker</th>
                  <th scope="col">headroom</th>
                  <th scope="col">verdict</th>
                </tr>
              </thead>
              <tbody>
                {computed.rows.map((row) => {
                  const flagged = row.status !== "ok";
                  return (
                    <tr
                      key={row.key}
                      // A flagged row is marked by weight, a blue bar and a
                      // word, so it survives greyscale and colour blindness.
                      className={
                        flagged ? "bg-[rgba(27,54,200,0.07)] font-semibold" : ""
                      }
                    >
                      <th
                        scope="row"
                        className={`!border-b-0 !pl-3 !text-[0.86rem] !normal-case ${
                          flagged ? "!text-ink" : ""
                        }`}
                        style={{
                          borderLeft: `3px solid ${flagged ? "var(--blue)" : "transparent"}`,
                        }}
                      >
                        {row.mechName}
                        {row.running ? "" : " (idle)"}
                      </th>
                      <td className="nb-slug !text-ink">{row.motorName}</td>
                      <td className="nb-slug">{MODE_WORD[row.mode]}</td>
                      <td className="nb-slug !text-ink">
                        {fmt(row.current, 0)} A
                      </td>
                      <td className="nb-slug !text-ink">{row.branch} A</td>
                      <td className="nb-slug !text-ink">
                        {row.current <= row.branch
                          ? `${fmt(row.branch - row.current, 0)} A left`
                          : `${fmt(row.current - row.branch, 0)} A over`}
                      </td>
                      <td className="nb-slug !text-ink">
                        {row.status === "over"
                          ? "trips on a sustained pull"
                          : row.status === "warn"
                            ? "within 15% of the breaker"
                            : "fine"}
                      </td>
                    </tr>
                  );
                })}

                {computed.rows.length === 0 ? (
                  <tr>
                    <td className="nb-slug" colSpan={7}>
                      no motors in the load list yet
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {computed.callouts.length > 0 ? (
            <div className="nb-note mt-[clamp(1.4rem,3vw,2.2rem)] max-w-[68ch]">
              <p className="nb-slug !text-ink">what goes wrong first</p>
              <ul className="nb-prose mt-3 !max-w-none text-[0.95rem]">
                {computed.callouts.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="nb-note mt-[clamp(1.4rem,3vw,2.2rem)] max-w-[64ch] text-[0.95rem] leading-relaxed text-graphite">
              <span className="nb-slug mb-1 block">nothing flagged</span>
              No motor is over its own breaker and the total sits under the main
              with voltage to spare. That is the budget working, not a promise
              about a worn battery on the third match of the day.
            </p>
          )}

          {/* Actions sit at the foot of the working, where you would sign a
              worksheet, not floating beside the numbers. */}
          <div className="mt-[clamp(1.4rem,3vw,2.2rem)] flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="nb-btn"
              onClick={() => window.print()}
            >
              Print this sheet
            </button>
            {authed ? (
              <button
                type="button"
                className="nb-btn-ghost"
                onClick={() => window.alert("Saved (persistence coming soon).")}
              >
                Save scenario
              </button>
            ) : (
              <Link
                href="/signup?next=/tools/frc-current-budget"
                className="nb-btn-ghost"
              >
                Save this budget to an account
              </Link>
            )}
          </div>
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
            aria-controls="cb-notes"
          >
            <span>
              <span className="nb-marker">the back of the sheet</span>
              <span className="block text-[clamp(1.35rem,1.05rem+1.2vw,2rem)] font-extrabold tracking-[-0.025em]">
                Every constant, and where it stops being true.
              </span>
            </span>
            <span className="nb-slug shrink-0 !text-ink" aria-hidden="true">
              {notesOpen ? "hide" : "show"}
            </span>
          </button>

          {notesOpen ? (
            <div id="cb-notes" className="mt-[clamp(1.4rem,3vw,2.2rem)]">
              <div className="grid gap-[clamp(1.4rem,3vw,2.6rem)] lg:grid-cols-2">
                <div>
                  <p className="nb-slug border-b-2 border-ink pb-2">
                    where it stops being true
                  </p>
                  <ul className="nb-prose mt-4 !max-w-none text-[0.95rem]">
                    <li>
                      The bus voltage is a first-order estimate, V =
                      V<sub>oc</sub> minus I times R. Real sustained sag is
                      worse, because the pack droops under a long pull and its
                      internal resistance climbs as it discharges and ages.
                      Treat the brownout line as a planning guide.
                    </li>
                    <li>
                      Snap-Action branch breakers and the 120 A main are thermal
                      breakers with trip curves. They carry rated current
                      continuously and tolerate a brief overcurrent. This sheet
                      flags when you exceed a rating, it does not model trip
                      time.
                    </li>
                    <li>
                      Stall currents are the theoretical unlimited worst case at
                      12 V. In practice you run configured supply limits, CTRE
                      SupplyCurrentLimit or REV setSmartCurrentLimit, well below
                      stall. Enter your own limits for a budget you can build to.
                    </li>
                    <li>
                      Internal resistance and resting voltage vary with age,
                      charge state and temperature. The defaults are typical
                      WPILib values, so replace them with your Battery Beak
                      numbers.
                    </li>
                    <li>
                      Published motor specs carry tolerance. REV lists plus or
                      minus 10% on brushless motors, and the figures here are
                      nominal manufacturer values.
                    </li>
                  </ul>
                </div>

                <div>
                  <p className="nb-slug border-b-2 border-ink pb-2">
                    sourced constants used
                  </p>
                  <ul className="nb-prose mt-4 !max-w-none text-[0.95rem]">
                    <li>
                      120 A main breaker, Cooper Bussmann CB285-120 via AndyMark
                      and Eaton Bussmann.
                    </li>
                    <li>
                      Branch breakers at 40, 30, 20 and 10 A, Snap-Action MX5 and
                      VB3, from WPILib Control System Hardware.
                    </li>
                    <li>
                      Brownout at 6.3 V on the roboRIO 1.0 (fixed) and 6.75 V on
                      the 2.0 (default, software-settable). Stage-1 rail droop
                      6.8 V, blackout 4.5 V, recovery 7.5 V, from WPILib roboRIO
                      Brownouts. The 6.8 V figure is the rail-droop point, not
                      the roboRIO 2 brownout.
                    </li>
                    <li>
                      Battery: 12 V 18 Ah SLA, briefly able to source over{" "}
                      {BATTERY_BRIEF_MAX_A} A. R<sub>int</sub> 0.011 Ω
                      manufacturer, under 0.015 Ω healthy, over 0.020
                      Ω retire. V<sub>oc</sub> about 12.7 to 13.5 V open,
                      from WPILib Robot Battery Basics. The sag parameters are
                      user-adjustable estimates.
                    </li>
                  </ul>
                  <p className="nb-slug mt-4 max-w-[52ch]">
                    Breaker, brownout, battery and motor data are evergreen.
                    Re-check each season only that the R-rules still specify the
                    120 A main and Snap-Action branch breakers, and add any new
                    motors from vendor spec pages.
                  </p>
                </div>
              </div>

              <div className="mt-[clamp(1.6rem,3.4vw,2.6rem)]">
                <p className="nb-slug border-b-2 border-ink pb-2">
                  motor library / published figures at 12 V
                </p>
                <div className="nb-scroll mt-3">
                  <table className="nb-table min-w-[44rem]">
                    <caption className="sr-only">
                      Published free speed, stall current, free current and
                      stall torque for every motor this calculator offers.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">motor</th>
                        <th scope="col">free rpm</th>
                        <th scope="col">stall A</th>
                        <th scope="col">free A</th>
                        <th scope="col">stall N·m</th>
                        <th scope="col">source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MOTORS.map((mo) => (
                        <tr key={mo.key}>
                          <th
                            scope="row"
                            className="!border-b-0 !text-[0.86rem] !normal-case !text-ink"
                          >
                            {mo.name}
                            {mo.legacy ? " (legacy)" : ""}
                          </th>
                          <td className="nb-slug !text-ink">
                            {mo.freeRpm.toLocaleString("en-US")}
                          </td>
                          <td className="nb-slug !text-ink">{mo.stallA}</td>
                          <td className="nb-slug !text-ink">{mo.freeA}</td>
                          <td className="nb-slug !text-ink">{mo.stallNm}</td>
                          <td className="nb-slug">{mo.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="nb-slug mt-4 max-w-[74ch]">
                  The CIM is listed by the FIRST 2017 sheet at 5310 rpm and 133
                  A, while VEX and AndyMark product sheets say 5330 rpm and 131
                  A. Kraken X60 Trapezoidal (366 A stall) and FOC (483 A stall)
                  are distinct modes, so pick the one your controller actually
                  runs. Falcon 500 is discontinued but still legal.
                </p>
                <p className="nb-slug mt-3 max-w-[74ch]">
                  This tool estimates current and voltage only. Not affiliated
                  with or endorsed by FIRST, WPILib, WestCoast Products, REV
                  Robotics, CTR Electronics, or Eaton and Bussmann.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
