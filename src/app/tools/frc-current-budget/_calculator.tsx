"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Battery,
  Cpu,
  Gauge,
  Plus,
  Printer,
  Trash2,
  TriangleAlert,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Verified constants — every number below is sourced in tools_verified */
/* and rendered with its citation in the Notes & sources section.       */
/* ------------------------------------------------------------------ */

const MAIN_BREAKER_A = 120; // Cooper Bussmann CB285-120
const BRANCH_RATINGS = [40, 30, 20, 10] as const; // Snap-Action MX5/VB3
const RORIO1_BROWNOUT_V = 6.3; // roboRIO 1.0 fixed (WPILib)
const RORIO2_BROWNOUT_DEFAULT_V = 6.75; // roboRIO 2.0 default, software-settable
const STAGE1_RAIL_V = 6.8; // 6V PWM rail begins to droop (WPILib)
const BLACKOUT_V = 4.5; // possible device blackout (WPILib)
const RECOVERY_V = 7.5; // brownout recovery (WPILib)
const BATTERY_BRIEF_MAX_A = 180; // battery can briefly supply >180 A (WPILib)

// Battery sag-model defaults (needs_range — user-adjustable)
const DEFAULT_VOC_V = 12.5; // conservative resting default (WPILib range 12.7–13.5 open)
const DEFAULT_RINT_OHM = 0.015; // ideal ceiling; range 0.011 (mfr) – 0.020 (retire)
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

// Motor library — FIRST 2017 Motor Information sheet + vendor spec pages.
const MOTORS: Motor[] = [
  {
    key: "kraken-trap",
    name: "Kraken X60 (Trapezoidal)",
    freeRpm: 6000,
    stallA: 366,
    freeA: 2,
    stallNm: 7.09,
    note: "WCP Trapezoidal @ 12 V",
    source: "WCP Kraken X60 motor-performance (Trap)",
  },
  {
    key: "kraken-foc",
    name: "Kraken X60 (FOC)",
    freeRpm: 5800,
    stallA: 483,
    freeA: 2,
    stallNm: 9.37,
    note: "WCP Field-Oriented Control @ 12 V — higher stall than Trap mode",
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
    note: "Discontinued but still legal & common",
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
    note: "FIRST 2017 sheet: 5310 rpm / 133 A. VEX/AndyMark sheets list 5330 rpm / 131 A.",
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
  limit: string; // amps as free-text (only used in "limit" mode)
  branch: number; // branch breaker rating (A) — one breaker PER motor controller (FRC rules)
};

type Mechanism = {
  id: number;
  name: string;
  running: boolean; // included in simultaneous total?
  motors: MechMotor[];
};

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function toNum(s: string, fallback: number): number {
  const v = Number.parseFloat(s);
  return Number.isFinite(v) ? v : fallback;
}

function fmt(n: number, digits = 1): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

// Current a single motor contributes for the selected mode.
function motorCurrent(mm: MechMotor): number {
  const motor = MOTOR_BY_KEY[mm.motorKey];
  if (!motor) return 0;
  if (mm.mode === "worst") return motor.stallA;
  if (mm.mode === "running") return motor.freeA;
  const lim = toNum(mm.limit, 0);
  return lim > 0 ? lim : 0;
}

const inputCls =
  "w-full rounded-xl border border-border bg-white/60 px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

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
  branch: number
): MechMotor {
  return { id, motorKey, mode, limit, branch };
}

// The initial preset renders during SSR, so its ids MUST be deterministic —
// a module-level counter diverges between the server and client render and
// trips a React hydration mismatch. Use a local counter that yields the same
// 1..N ids on every call.
function typicalDrive(): Mechanism[] {
  let s = 0;
  const id = () => (s += 1);
  // Each motor controller sits on its OWN branch breaker (FRC electrical rules):
  // one breaker protects one controller, so a 4-motor drivetrain is 4 × 40 A, not 1.
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
    motors: m.motors.map((mm) => ({ ...mm, id: nextId(), mode: "worst" as CurrentMode })),
  }));
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function CurrentBudgetCalculator({ authed }: { authed: boolean }) {
  const [rorio, setRorio] = useState<"1.0" | "2.0">("2.0");
  const [brownout2, setBrownout2] = useState<string>(String(RORIO2_BROWNOUT_DEFAULT_V));
  const [vOc, setVOc] = useState<string>(String(DEFAULT_VOC_V));
  const [rInt, setRInt] = useState<number>(DEFAULT_RINT_OHM);
  const [mechanisms, setMechanisms] = useState<Mechanism[]>(() => typicalDrive());
  const [showNotes, setShowNotes] = useState(false);
  const noteAnchor = useRef<HTMLDivElement>(null);

  const brownoutThreshold =
    rorio === "1.0" ? RORIO1_BROWNOUT_V : toNum(brownout2, RORIO2_BROWNOUT_DEFAULT_V);

  /* ---- live computation ---- */
  const computed = useMemo(() => {
    const perMech = mechanisms.map((m) => {
      // Each motor is protected by its OWN branch breaker, so the branch check
      // is per motor — never the summed multi-motor mechanism total.
      const motors = m.motors.map((mm) => {
        const current = motorCurrent(mm);
        const status: "ok" | "warn" | "over" =
          current > mm.branch ? "over" : current > mm.branch * 0.85 ? "warn" : "ok";
        return { mm, current, status };
      });
      // Mechanism total still feeds the 120 A main breaker + brownout sag.
      const current = motors.reduce((sum, x) => sum + x.current, 0);
      // Worst per-motor breaker status, for the compact mechanism chip.
      const branchStatus: "ok" | "warn" | "over" = motors.some((x) => x.status === "over")
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
      iTotal > MAIN_BREAKER_A ? "over" : iTotal > MAIN_BREAKER_A * 0.85 ? "warn" : "ok";

    let brownoutVerdict: "safe" | "marginal" | "brownout";
    if (vBus <= brownoutThreshold) brownoutVerdict = "brownout";
    else if (vBus <= STAGE1_RAIL_V) brownoutVerdict = "marginal";
    else brownoutVerdict = "safe";

    // Plain-language callouts. Branch breakers are PER motor controller, so we
    // describe individual motors vs their own breaker — never claim one breaker
    // carries a whole mechanism's summed current.
    const callouts: string[] = [];
    for (const p of perMech) {
      const over = p.motors.filter((x) => x.status === "over");
      const warn = p.motors.filter((x) => x.status === "warn");
      if (over.length === 1) {
        const x = over[0];
        callouts.push(
          `A ${p.mech.name} motor (${fmt(x.current, 0)} A) exceeds its ${x.mm.branch} A branch breaker — will trip on a sustained pull.`,
        );
      } else if (over.length > 1) {
        const maxA = Math.max(...over.map((x) => x.current));
        const sameBranch = over.every((x) => x.mm.branch === over[0].mm.branch);
        callouts.push(
          sameBranch
            ? `${p.mech.name}: ${over.length} motors each exceed their ${over[0].mm.branch} A branch breaker (up to ${fmt(maxA, 0)} A) — each will trip on a sustained pull.`
            : `${p.mech.name}: ${over.length} motors exceed their own branch breakers (up to ${fmt(maxA, 0)} A) — each will trip on a sustained pull.`,
        );
      }
      if (warn.length === 1) {
        const x = warn[0];
        callouts.push(
          `A ${p.mech.name} motor (${fmt(x.current, 0)} A) is within 15% of its ${x.mm.branch} A branch breaker — little headroom.`,
        );
      } else if (warn.length > 1) {
        const avgA = warn.reduce((s, x) => s + x.current, 0) / warn.length;
        const sameBranch = warn.every((x) => x.mm.branch === warn[0].mm.branch);
        callouts.push(
          sameBranch
            ? `${p.mech.name}: each of the ${warn.length} motors (~${fmt(avgA, 0)} A) is at its ${warn[0].mm.branch} A branch breaker limit — little headroom.`
            : `${p.mech.name}: ${warn.length} motors are within 15% of their own branch breakers — little headroom.`,
        );
      }
    }
    if (mainStatus === "over") {
      callouts.push(
        `Simultaneous draw ≈ ${fmt(iTotal, 0)} A is past the 120 A main breaker — sustained overage will trip it (battery can source >180 A only briefly).`,
      );
    } else if (mainStatus === "warn") {
      callouts.push(
        `Simultaneous draw ≈ ${fmt(iTotal, 0)} A is close to the 120 A main breaker.`,
      );
    }
    if (brownoutVerdict === "brownout") {
      callouts.push(
        `Estimated bus voltage ${fmt(vBus, 2)} V is at/below the ${fmt(brownoutThreshold, 2)} V brownout line — the roboRIO would likely disable outputs.`,
      );
    } else if (brownoutVerdict === "marginal") {
      callouts.push(
        `Estimated bus voltage ${fmt(vBus, 2)} V is below the ${STAGE1_RAIL_V} V rail-droop point but above the ${fmt(brownoutThreshold, 2)} V brownout line — marginal.`,
      );
    }

    return { perMech, iTotal, vBus, mainStatus, brownoutVerdict, callouts };
  }, [mechanisms, vOc, rInt, brownoutThreshold]);

  /* ---- mechanism editing ---- */
  function updateMech(id: number, patch: Partial<Mechanism>) {
    setMechanisms((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }
  function updateMotor(mechId: number, motorId: number, patch: Partial<MechMotor>) {
    setMechanisms((prev) =>
      prev.map((m) =>
        m.id === mechId
          ? { ...m, motors: m.motors.map((mm) => (mm.id === motorId ? { ...mm, ...patch } : mm)) }
          : m,
      ),
    );
  }
  function addMotor(mechId: number) {
    setMechanisms((prev) =>
      prev.map((m) =>
        m.id === mechId
          ? { ...m, motors: [...m.motors, makeMotor(nextId(), "neo", "limit", "40", 40)] }
          : m,
      ),
    );
  }
  function removeMotor(mechId: number, motorId: number) {
    setMechanisms((prev) =>
      prev.map((m) =>
        m.id === mechId ? { ...m, motors: m.motors.filter((mm) => mm.id !== motorId) } : m,
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

  const statusChip = (s: "ok" | "warn" | "over") =>
    s === "over"
      ? "bg-red-500/10 text-red-700"
      : s === "warn"
        ? "bg-amber-500/10 text-amber-700"
        : "bg-emerald-500/10 text-emerald-700";

  // Voltage meter geometry: map 4–13.5 V onto 0–100%.
  const V_LO = 4;
  const V_HI = 13.5;
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - V_LO) / (V_HI - V_LO)) * 100));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
      {/* Header */}
      <div className="mb-6">
        <span className="ac-chip inline-flex items-center gap-2">
          <span className="ac-eyebrow">FRC ELECTRICAL</span>
        </span>
        <h2 className="font-display mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Current Budget &amp;{" "}
          <span
            style={{
              background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Brownout
          </span>{" "}
          Checker
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-foreground/70">
          Add your mechanisms and motors, set your smart-current limits, and see whether your
          branch breakers, the 120&nbsp;A main, and the roboRIO brownout line hold up when
          everything runs at once. Bus-voltage sag is a first-order estimate.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Figures: motor specs from the FIRST 2017 motor sheet &amp; vendor pages; breaker /
          brownout data from WPILib (evergreen). Verify against the current FIRST Game Manual and
          vendor spec sheets.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* ---------------- LEFT: inputs ---------------- */}
        <div className="space-y-6">
          {/* Global settings */}
          <div className="ac-card rounded-2xl p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="ac-badge inline-flex h-8 w-8 items-center justify-center" style={{ ["--a" as string]: "#2560e6" }}>
                <Cpu className="h-4 w-4" aria-hidden />
              </span>
              <h3 className="font-display text-lg font-semibold">System &amp; battery</h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-foreground" htmlFor="rorio">
                  roboRIO version
                </label>
                <select
                  id="rorio"
                  className={`${inputCls} mt-1`}
                  value={rorio}
                  onChange={(e) => setRorio(e.target.value === "1.0" ? "1.0" : "2.0")}
                >
                  <option value="2.0">roboRIO 2.0</option>
                  <option value="1.0">roboRIO 1.0</option>
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sets the brownout line: 1.0 is fixed at 6.3&nbsp;V; 2.0 defaults to 6.75&nbsp;V.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground" htmlFor="brownout">
                  Brownout threshold (V)
                </label>
                <input
                  id="brownout"
                  type="number"
                  step="0.05"
                  className={`${inputCls} mt-1`}
                  value={rorio === "1.0" ? RORIO1_BROWNOUT_V : brownout2}
                  disabled={rorio === "1.0"}
                  onChange={(e) => setBrownout2(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {rorio === "1.0"
                    ? "Fixed on roboRIO 1.0 (WPILib)."
                    : "roboRIO 2.0 is software-settable via setBrownoutVoltage()."}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground" htmlFor="voc">
                  Battery open-circuit V₍oc₎ (V)
                </label>
                <input
                  id="voc"
                  type="number"
                  step="0.1"
                  className={`${inputCls} mt-1`}
                  value={vOc}
                  onChange={(e) => setVOc(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Conservative default 12.5&nbsp;V. Enter your measured resting voltage — a healthy
                  match pack reads ~12.7–13.5&nbsp;V open.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground" htmlFor="rint">
                  Battery internal resistance (Ω)
                </label>
                <div className="mt-1 flex items-center gap-3">
                  <input
                    id="rint"
                    type="range"
                    min={RINT_MIN_OHM}
                    max={RINT_MAX_OHM}
                    step={0.001}
                    className="w-full accent-primary"
                    value={rInt}
                    onChange={(e) => setRInt(Number.parseFloat(e.target.value))}
                  />
                  <span className="tabular-nums text-sm font-medium text-foreground">
                    {rInt.toFixed(3)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  0.011&nbsp;Ω mfr spec · &lt;0.015&nbsp;Ω ideal · &gt;0.020&nbsp;Ω retire (WPILib).
                  Use your Battery Beak reading.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="ac-btn-ghost"
                onClick={() => setMechanisms(typicalDrive())}
              >
                Preset: Typical drive
              </button>
              <button
                type="button"
                className="ac-btn-ghost"
                onClick={() => setMechanisms(fullSend())}
              >
                Preset: Full-send (all stall)
              </button>
            </div>
          </div>

          {/* Mechanisms */}
          <div className="ac-card rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="ac-badge inline-flex h-8 w-8 items-center justify-center" style={{ ["--a" as string]: "#1aa9d6" }}>
                  <Zap className="h-4 w-4" aria-hidden />
                </span>
                <h3 className="font-display text-lg font-semibold">Mechanisms</h3>
              </div>
              <button type="button" className="ac-btn-ghost" onClick={addMechanism}>
                <Plus className="h-4 w-4" aria-hidden /> Add
              </button>
            </div>

            <div className="space-y-4">
              {mechanisms.map((m) => {
                const p = computed.perMech.find((x) => x.mech.id === m.id);
                const current = p ? p.current : 0;
                const status = p ? p.branchStatus : "ok";
                return (
                  <div key={m.id} className="rounded-xl border border-border bg-white/40 p-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-[8rem] flex-1">
                        <label className="text-xs font-medium text-foreground" htmlFor={`name-${m.id}`}>
                          Name
                        </label>
                        <input
                          id={`name-${m.id}`}
                          className={`${inputCls} mt-1`}
                          value={m.name}
                          onChange={(e) => updateMech(m.id, { name: e.target.value })}
                        />
                      </div>
                      <label className="flex items-center gap-2 pb-2 text-xs font-medium text-foreground">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={m.running}
                          onChange={(e) => updateMech(m.id, { running: e.target.checked })}
                        />
                        Running now
                      </label>
                      <button
                        type="button"
                        className="pb-2 text-muted-foreground hover:text-red-600"
                        aria-label={`Remove ${m.name}`}
                        onClick={() => removeMechanism(m.id)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>

                    {/* motors */}
                    <div className="mt-3 space-y-2">
                      {m.motors.map((mm) => {
                        const motor = MOTOR_BY_KEY[mm.motorKey];
                        return (
                          <div key={mm.id} className="flex flex-wrap items-center gap-2">
                            <select
                              className={`${inputCls} flex-1 min-w-[9rem]`}
                              value={mm.motorKey}
                              onChange={(e) => updateMotor(m.id, mm.id, { motorKey: e.target.value })}
                              aria-label="Motor"
                            >
                              {MOTORS.map((mo) => (
                                <option key={mo.key} value={mo.key}>
                                  {mo.name}
                                  {mo.legacy ? " (legacy)" : ""}
                                </option>
                              ))}
                            </select>
                            <select
                              className={`${inputCls} w-32`}
                              value={mm.mode}
                              onChange={(e) =>
                                updateMotor(m.id, mm.id, { mode: e.target.value as CurrentMode })
                              }
                              aria-label="Current mode"
                            >
                              <option value="limit">Smart limit</option>
                              <option value="running">Running (free)</option>
                              <option value="worst">Worst (stall)</option>
                            </select>
                            {mm.mode === "limit" ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  className={`${inputCls} w-20`}
                                  value={mm.limit}
                                  onChange={(e) => updateMotor(m.id, mm.id, { limit: e.target.value })}
                                  aria-label="Current limit amps"
                                />
                                <span className="text-xs text-muted-foreground">A</span>
                              </div>
                            ) : (
                              <span
                                className="tabular-nums w-20 text-right text-sm text-foreground/70"
                                title={
                                  motor
                                    ? mm.mode === "worst"
                                      ? `Stall current ${motor.stallA} A`
                                      : `Free (idle) current ${motor.freeA} A`
                                    : ""
                                }
                              >
                                {fmt(motorCurrent(mm), 0)} A
                              </span>
                            )}
                            {/* Per-motor branch breaker — one breaker per controller. */}
                            <label className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span className="whitespace-nowrap">Brkr</span>
                              <select
                                className={`${inputCls} w-[4.5rem]`}
                                value={mm.branch}
                                onChange={(e) =>
                                  updateMotor(m.id, mm.id, { branch: Number.parseInt(e.target.value, 10) })
                                }
                                aria-label="Branch breaker rating"
                              >
                                {BRANCH_RATINGS.map((r) => (
                                  <option key={r} value={r}>
                                    {r} A
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-red-600"
                              aria-label="Remove motor"
                              onClick={() => removeMotor(m.id, mm.id)}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        onClick={() => addMotor(m.id)}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden /> Add motor
                      </button>
                      <span
                        className={`tabular-nums rounded-full px-2.5 py-1 text-xs font-semibold ${statusChip(status)}`}
                        title="Mechanism total draw; branch breakers are checked per motor"
                      >
                        {fmt(current, 0)} A total
                        {status === "over"
                          ? " · breaker over"
                          : status === "warn"
                            ? " · breaker tight"
                            : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
              {mechanisms.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No mechanisms yet — add one to start budgeting current.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ---------------- RIGHT: live results ---------------- */}
        <div className="space-y-6">
          <div className="ac-card rounded-2xl p-5">
            {/* Primary result */}
            <p className="text-sm font-medium text-muted-foreground">
              Simultaneous system draw
            </p>
            <div className="flex items-end gap-2">
              <span
                className="tabular-nums font-display text-5xl font-bold leading-none"
                style={{
                  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                {fmt(computed.iTotal, 0)}
              </span>
              <span className="mb-1 text-lg font-semibold text-foreground/70">A</span>
            </div>

            {/* Main breaker headroom */}
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>vs 120 A main breaker</span>
                <span className="tabular-nums">
                  {computed.iTotal <= MAIN_BREAKER_A
                    ? `${fmt(MAIN_BREAKER_A - computed.iTotal, 0)} A headroom`
                    : `${fmt(computed.iTotal - MAIN_BREAKER_A, 0)} A over`}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/5">
                <div
                  className={`h-full rounded-full ${
                    computed.mainStatus === "over"
                      ? "bg-red-500"
                      : computed.mainStatus === "warn"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, (computed.iTotal / MAIN_BREAKER_A) * 100)}%` }}
                />
              </div>
            </div>

            {/* Brownout verdict */}
            <div className="ac-divider my-4" />
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
                  computed.brownoutVerdict === "brownout"
                    ? "bg-red-500/10 text-red-700"
                    : computed.brownoutVerdict === "marginal"
                      ? "bg-amber-500/10 text-amber-700"
                      : "bg-emerald-500/10 text-emerald-700"
                }`}
              >
                <Gauge className="h-4 w-4" aria-hidden />
                {computed.brownoutVerdict === "brownout"
                  ? "Brownout likely"
                  : computed.brownoutVerdict === "marginal"
                    ? "Marginal"
                    : "Safe"}
              </span>
              <span className="text-sm text-foreground/70">
                Est. bus voltage{" "}
                <span className="tabular-nums font-semibold text-foreground">
                  {fmt(computed.vBus, 2)} V
                </span>{" "}
                <span className="text-xs text-muted-foreground">(V₍oc₎ − I·R estimate)</span>
              </span>
            </div>

            {/* Voltage meter */}
            <div className="mt-4">
              <div className="relative h-8">
                {/* gradient track */}
                <div
                  className="absolute inset-x-0 top-3 h-2.5 rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg,#ef4444 0%,#f59e0b 30%,#10b981 55%,#10b981 100%)",
                  }}
                />
                {/* threshold ticks */}
                {[
                  { v: BLACKOUT_V, label: "4.5", color: "#b91c1c" },
                  { v: brownoutThreshold, label: fmt(brownoutThreshold, 2), color: "#dc2626" },
                  { v: STAGE1_RAIL_V, label: "6.8", color: "#d97706" },
                  { v: RECOVERY_V, label: "7.5", color: "#059669" },
                ].map((t) => (
                  <div
                    key={t.label}
                    className="absolute top-1 h-6 w-px"
                    style={{ left: `${pct(t.v)}%`, background: t.color }}
                    title={`${t.label} V`}
                  />
                ))}
                {/* V_bus marker */}
                <div
                  className="absolute -top-1 flex -translate-x-1/2 flex-col items-center"
                  style={{ left: `${pct(computed.vBus)}%` }}
                >
                  <div className="h-4 w-1 rounded bg-[#16203a]" />
                </div>
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>Blackout 4.5</span>
                <span>Brownout {fmt(brownoutThreshold, 2)}</span>
                <span>Rail 6.8</span>
                <span>Recover 7.5</span>
              </div>
            </div>

            {/* Callouts */}
            {computed.callouts.length > 0 && (
              <div className="mt-4 space-y-2">
                {computed.callouts.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-xl bg-amber-500/5 px-3 py-2 text-sm text-foreground/80"
                  >
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Per-motor breaker headroom (one branch breaker per controller) */}
          <div className="ac-card rounded-2xl p-5">
            <h3 className="font-display mb-1 text-lg font-semibold">Per-motor breaker headroom</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Each motor controller is on its own branch breaker, so headroom is checked per motor
              — not against the mechanism&rsquo;s summed draw.
            </p>
            <div className="space-y-3">
              {computed.perMech.map((p) => (
                <div key={p.mech.id} className="rounded-xl border border-border bg-white/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {p.mech.name}
                      {!p.mech.running && (
                        <span className="ml-2 text-xs text-muted-foreground">(idle)</span>
                      )}
                    </span>
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {fmt(p.current, 0)} A total
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {p.motors.map((x) => {
                      const mo = MOTOR_BY_KEY[x.mm.motorKey];
                      return (
                        <div key={x.mm.id} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-xs text-foreground/70">
                            {mo ? mo.name : "Motor"}
                          </span>
                          <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-black/5 sm:w-24">
                            <div
                              className={`h-full rounded-full ${
                                x.status === "over"
                                  ? "bg-red-500"
                                  : x.status === "warn"
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                              }`}
                              style={{ width: `${Math.min(100, (x.current / x.mm.branch) * 100)}%` }}
                            />
                          </div>
                          <span
                            className={`tabular-nums shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusChip(x.status)}`}
                          >
                            {fmt(x.current, 0)}/{x.mm.branch} A
                          </span>
                        </div>
                      );
                    })}
                    {p.motors.length === 0 && (
                      <p className="text-xs text-muted-foreground">No motors in this mechanism.</p>
                    )}
                  </div>
                </div>
              ))}
              {computed.perMech.length === 0 && (
                <p className="text-sm text-muted-foreground">Add a mechanism to see headroom.</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="ac-card rounded-2xl p-5">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="ac-btn" onClick={() => window.print()}>
                <Printer className="h-4 w-4" aria-hidden /> Print / Save PDF
              </button>
              {authed ? (
                <button
                  type="button"
                  className="ac-btn-ghost"
                  onClick={() => window.alert("Saved (persistence coming soon).")}
                >
                  Save scenario
                </button>
              ) : (
                <Link href="/signup?next=/tools/frc-current-budget" className="ac-btn-ghost">
                  Create a free account to save scenarios &amp; export
                </Link>
              )}
              <button
                type="button"
                className="ml-auto text-sm font-medium text-primary hover:underline"
                onClick={() => {
                  setShowNotes(true);
                  requestAnimationFrame(() =>
                    noteAnchor.current?.scrollIntoView({ behavior: "smooth" }),
                  );
                }}
              >
                Notes &amp; sources
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- Notes & sources ---------------- */}
      <div ref={noteAnchor} className="mt-8">
        <div className="ac-glass p-5 sm:p-6">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left"
            onClick={() => setShowNotes((s) => !s)}
            aria-expanded={showNotes}
          >
            <span className="font-display inline-flex items-center gap-2 text-lg font-semibold">
              <Battery className="h-5 w-5 text-primary" aria-hidden /> Notes &amp; sources
            </span>
            <span className="text-sm text-primary">{showNotes ? "Hide" : "Show"}</span>
          </button>

          {showNotes && (
            <div className="mt-4 space-y-5 text-sm text-foreground/80">
              <div>
                <h4 className="mb-2 font-semibold text-foreground">Important disclaimers</h4>
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>
                    The bus-voltage / brownout output is a <strong>first-order estimate</strong>{" "}
                    (V = V₍oc₎ − I·R), not a guarantee. Real sustained sag is worse than the pure IR
                    term because battery voltage also droops under sustained high current and
                    internal resistance rises as the battery discharges and ages. Treat the brownout
                    line as a planning guide.
                  </li>
                  <li>
                    Snap-Action branch breakers and the 120&nbsp;A main are <strong>thermal
                    breakers</strong> with trip curves — they carry rated current continuously and
                    tolerate brief overcurrent before tripping. The tool flags when you exceed a
                    rating; it does not model exact trip time.
                  </li>
                  <li>
                    Motor stall currents are the theoretical unlimited worst case at 12&nbsp;V. In
                    practice you run configured supply-current limits (CTRE SupplyCurrentLimit / REV
                    setSmartCurrentLimit) far below stall — enter <strong>your</strong> limits for a
                    realistic budget.
                  </li>
                  <li>
                    Battery internal resistance and open-circuit voltage vary by age, charge state,
                    and temperature; defaults are typical WPILib values. Adjust to your measured
                    (Battery Beak) numbers.
                  </li>
                  <li>
                    Published motor specs carry tolerance (REV lists ±10% on brushless motors);
                    values shown are nominal manufacturer figures.
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="mb-2 font-semibold text-foreground">Sourced constants used</h4>
                <ul className="space-y-1.5">
                  <li>
                    <strong>120 A main breaker</strong> — Cooper Bussmann CB285-120 (AndyMark /
                    Eaton Bussmann).
                  </li>
                  <li>
                    <strong>Branch breakers 40 / 30 / 20 / 10 A</strong> — Snap-Action MX5/VB3
                    (WPILib Control System Hardware).
                  </li>
                  <li>
                    <strong>Brownout 6.3 V (roboRIO 1.0, fixed) / 6.75 V (roboRIO 2.0, default,
                    software-settable)</strong>; Stage-1 rail droop 6.8 V; blackout 4.5 V; recovery
                    7.5 V — WPILib roboRIO Brownouts.{" "}
                    <span className="text-muted-foreground">
                      Note: 6.8 V is the Stage-1 6 V-rail droop point, not the roboRIO 2 brownout
                      (which is 6.75 V).
                    </span>
                  </li>
                  <li>
                    <strong>Battery: 12 V 18 Ah SLA, briefly &gt;{BATTERY_BRIEF_MAX_A} A</strong>;
                    R₍int₎ 0.011 Ω mfr / &lt;0.015 Ω ideal / &gt;0.020 Ω retire; V₍oc₎ ~12.7–13.5 V
                    open — WPILib Robot Battery Basics. Sag parameters are user-adjustable estimates.
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="mb-2 font-semibold text-foreground">Motor library</h4>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[34rem] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="py-1.5 pr-3 font-medium">Motor</th>
                        <th className="py-1.5 pr-3 font-medium">Free RPM</th>
                        <th className="py-1.5 pr-3 font-medium">Stall A</th>
                        <th className="py-1.5 pr-3 font-medium">Free A</th>
                        <th className="py-1.5 pr-3 font-medium">Stall N·m</th>
                        <th className="py-1.5 pr-3 font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {MOTORS.map((mo) => (
                        <tr key={mo.key} className="border-b border-border/60">
                          <td className="py-1.5 pr-3 font-medium text-foreground">
                            {mo.name}
                            {mo.legacy ? (
                              <span className="ml-1 text-[10px] text-muted-foreground">legacy</span>
                            ) : null}
                          </td>
                          <td className="py-1.5 pr-3">{mo.freeRpm.toLocaleString("en-US")}</td>
                          <td className="py-1.5 pr-3">{mo.stallA}</td>
                          <td className="py-1.5 pr-3">{mo.freeA}</td>
                          <td className="py-1.5 pr-3">{mo.stallNm}</td>
                          <td className="py-1.5 pr-3 text-muted-foreground">{mo.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  CIM: FIRST 2017 sheet lists 5310 rpm / 133 A; VEX/AndyMark product sheets list
                  5330 rpm / 131 A. Kraken X60 Trapezoidal (366 A stall) and FOC (483 A stall) are
                  distinct modes — pick the one your controller runs. Kraken specs: WCP
                  motor-performance page
                  (docs.wcproducts.com/welcome/electronics/kraken-x60/kraken-x60-+-talonfx/overview-and-features/motor-performance).
                  Falcon 500 is discontinued but still legal.
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                Breaker, brownout, battery and motor data are evergreen; re-check each season only
                that FRC R-rules still specify the 120 A main and Snap-Action branch breakers, and
                add any new motors from vendor spec pages. This tool estimates current/voltage only
                and is not affiliated with or endorsed by FIRST, WPILib, WestCoast Products, REV
                Robotics, CTR Electronics, or Eaton/Bussmann.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
