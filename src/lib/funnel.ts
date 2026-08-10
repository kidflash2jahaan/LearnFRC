import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ACTIVATION-FUNNEL INSTRUMENTATION
 *
 * Why this file exists: 45% of accounts never complete a lesson, and until now
 * nothing in the product could say WHERE they stopped. Every funnel number in
 * the 2026-08 investigation had to be reconstructed by matching page_views
 * timestamps against profiles.created_at at ~95% confidence, and that
 * reconstruction is impossible at all for anything before 22 Jul. This module
 * makes the funnel a first-class, queryable fact.
 *
 * The privacy shape (see also the migration, which enforces it in the DB):
 *  - a row is (step, subject, when). No path, no IP, no user agent, no
 *    referrer, no email, no free text.
 *  - a subject is EITHER an account id OR the anonymous lf_vid visitor id,
 *    never both on the same row — so this table never becomes the join that
 *    links a person's account to their pre-signup browsing.
 *  - events cascade-delete with the auth user.
 *  - no third-party analytics, no new dependency: this is the same
 *    service-role-insert + per-IP rateLimit() shape as /api/page-view.
 */

/* ------------------------------------------------------------------ */
/*  Steps                                                              */
/* ------------------------------------------------------------------ */

/**
 * The funnel, in order. This list is duplicated as a CHECK constraint in the
 * database ON PURPOSE: the constraint is what bounds `funnel_summary()` to six
 * rows forever, which is what makes it structurally immune to PostgREST's
 * silent 1000-row truncation. Adding a step means editing both.
 */
export const FUNNEL_STEPS = [
  "signup",
  "lesson_opened",
  "quiz_attempted",
  "lesson_completed",
  "second_lesson_completed",
  "return_visit",
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

const STEP_SET: ReadonlySet<string> = new Set(FUNNEL_STEPS);

/** Narrowing guard for untrusted input (the ingest route's only validation). */
export function isFunnelStep(value: unknown): value is FunnelStep {
  return typeof value === "string" && STEP_SET.has(value);
}

/**
 * Per-step display metadata.
 *
 * `base` is the step this row's CONVERSION RATE is measured against — normally
 * the previous row, with one deliberate exception: `return_visit` is based on
 * `lesson_completed`, not on `second_lesson_completed`. Coming back on a later
 * day is not conditional on having done a second lesson (most second lessons
 * happen in the same sitting — 113 of 191 activated users are one-day
 * wonders), so basing it on the row above would print a meaningless number.
 */
const STEP_META: Record<
  FunnelStep,
  {
    label: string;
    base: FunnelStep | null;
    baseLabel: string;
    /**
     * True when profiles + lesson_progress can answer this step EXACTLY with
     * no events at all — so the number is already trustworthy and always was.
     * False means the derived value is only a LOWER BOUND (everyone who
     * completed a lesson must have opened it and attempted its quiz) and the
     * real figure is unknown until the beacon fires. The panel says which is
     * which; a floor presented as a measurement is how you end up believing
     * 100% of readers pass the quiz.
     */
    derivedExact: boolean;
  }
> = {
  signup: {
    label: "Signed up",
    base: null,
    baseLabel: "",
    derivedExact: true, // profiles
  },
  lesson_opened: {
    label: "Opened a lesson",
    base: "signup",
    baseLabel: "signups",
    derivedExact: false, // page_views has no user_id — nothing can answer this
  },
  quiz_attempted: {
    label: "Attempted a quiz",
    base: "lesson_opened",
    baseLabel: "openers",
    derivedExact: false, // quiz grading is pure client state; nothing persists
  },
  lesson_completed: {
    label: "Completed a lesson",
    base: "quiz_attempted",
    baseLabel: "quiz takers",
    derivedExact: true, // lesson_progress
  },
  second_lesson_completed: {
    label: "Completed a second",
    base: "lesson_completed",
    baseLabel: "activated",
    derivedExact: true, // lesson_progress
  },
  return_visit: {
    label: "Came back on a later day",
    base: "lesson_completed",
    baseLabel: "activated",
    derivedExact: true, // lesson_progress days + profiles.last_seen_at
  },
};

/* ------------------------------------------------------------------ */
/*  Recording                                                          */
/* ------------------------------------------------------------------ */

export type FunnelEventInput = {
  step: FunnelStep;
  /** Authenticated account id. When set, `visitor` is ignored (see below). */
  userId?: string | null;
  /** Anonymous lf_vid. Used only for logged-out subjects. */
  visitor?: string | null;
};

/**
 * Record one funnel milestone. Safe to call from anywhere on the server —
 * a route handler, a Server Action, a cron — and safe to call repeatedly.
 *
 * Three properties callers can rely on:
 *
 *  1. IDEMPOTENT. Partial unique indexes on (user_id, step) and (visitor, step)
 *     mean a subject can hold at most one row per step for all time. A repeat
 *     insert comes back 23505 and is treated as success, so no call site needs
 *     its own "have I already sent this?" state. That is the whole reason
 *     these are milestone events rather than a firehose: a user is worth at
 *     most six rows, ever.
 *  2. NEVER THROWS. Instrumentation must not be able to fail a signup or a
 *     lesson completion. Every error is swallowed after being logged; the
 *     worst case is a missing data point.
 *  3. NEVER CORRELATES. If `userId` is present the row is keyed by the account
 *     and `visitor` is dropped on the floor. Storing both would turn this
 *     table into a lookup from account → device id, which is exactly the
 *     linkage the anonymous visitor id exists to avoid.
 */
export async function recordFunnelEvent(evt: FunnelEventInput): Promise<void> {
  if (!isFunnelStep(evt.step)) return;

  const userId = evt.userId || null;
  const visitor = userId ? null : evt.visitor || null;
  // The DB CHECK enforces this too; bailing here saves a pointless round trip.
  if (!userId && !visitor) return;

  try {
    const { error } = await createAdminClient()
      .from("funnel_events")
      .insert({ step: evt.step, user_id: userId, visitor });
    // 23505 = unique violation = this subject already reached this step. That
    // is the expected steady state, not a failure.
    if (error && error.code !== "23505") {
      console.error("[funnel] insert failed:", evt.step, error.message);
    }
  } catch (e) {
    console.error("[funnel] insert threw:", evt.step, (e as Error)?.message);
  }
}

/* ------------------------------------------------------------------ */
/*  Reading                                                            */
/* ------------------------------------------------------------------ */

export type FunnelRow = {
  step: FunnelStep;
  label: string;
  /**
   * Distinct ACCOUNTS that have reached this step: recorded events UNIONed
   * with what profiles + lesson_progress already prove, and transitively
   * closed (reaching a later step proves the earlier ones).
   */
  count: number;
  /**
   * How many accounts got here from a RECORDED event rather than inference.
   * `measured === 0` on a step whose `count > 0` means the number you are
   * looking at is a floor, not a measurement — that distinction is the entire
   * point of shipping this, so it is surfaced rather than smoothed over.
   */
  measured: number;
  /** Distinct anonymous visitors recorded at this step (no account yet). */
  anonymous: number;
  /** 0–100, share of the first step. Drives the funnel bar. */
  pctOfStart: number;
  /** 0–100, conversion INTO this step from `baseLabel`. */
  conversionPct: number;
  /** What `conversionPct` is a percentage OF ("signups", "activated", …). */
  baseLabel: string;
  /** People lost between `baseLabel` and here. */
  lost: number;
  /**
   * False when `count` is a floor rather than a real figure — i.e. nothing in
   * the schema can answer this step and no event has been recorded for it yet.
   */
  trustworthy: boolean;
};

export type FunnelStats = {
  rows: FunnelRow[];
  /**
   * Labels of the steps that are still a FLOOR — no exact derivation exists
   * and no event has landed. These are the rows a reader must not take at face
   * value, and they are named in the panel for exactly that reason.
   */
  inferredSteps: string[];
  /** Total funnel_events rows recorded, all steps, accounts + anonymous. */
  recorded: number;
  /**
   * The single largest drop, for the panel badge. `precise` is false when the
   * step it lands on is one of the floors above — the people are genuinely
   * lost, but the drop is "at or before this step", not "at this step".
   */
  worstDrop: {
    label: string;
    lost: number;
    lostPct: number;
    precise: boolean;
  } | null;
};

const EMPTY: FunnelStats = {
  rows: [],
  inferredSteps: [],
  recorded: 0,
  worstDrop: null,
};

/** Percent of `whole`, clamped and rounded. 0 when there is nothing to divide. */
function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}

/**
 * The activation funnel, for /admin.
 *
 * Everything is aggregated SQL-side by `funnel_summary()`, which returns
 * exactly one row per step — six rows, provably, because the step allow-list
 * is a CHECK constraint. That bound matters: it is why this read can never hit
 * the PostgREST 1000-row truncation that has already shipped twice in this
 * repo, and it is why no paging loop appears here. Do not replace this with a
 * plain `.select()` over funnel_events.
 *
 * DELIBERATELY NO TIME WINDOW. Every number is a standing total over the whole
 * history of the site, matching the rest of the admin panel's tiles.
 */
export async function getFunnelStats(): Promise<FunnelStats> {
  let rowsRaw: {
    step: string;
    accounts: number | string;
    measured: number | string;
    visitors: number | string;
  }[] = [];

  try {
    const { data, error } = await createAdminClient().rpc("funnel_summary");
    if (error) {
      // A missing function/table (migration not applied yet) must degrade to an
      // empty panel, never to a 500 that takes the whole dashboard down.
      console.error("[funnel] funnel_summary failed:", error.message);
      return EMPTY;
    }
    rowsRaw = (data as typeof rowsRaw | null) ?? [];
  } catch (e) {
    console.error("[funnel] funnel_summary threw:", (e as Error)?.message);
    return EMPTY;
  }

  // Postgres bigints arrive over PostgREST as strings — coerce everything.
  const byStep = new Map<
    FunnelStep,
    { accounts: number; measured: number; visitors: number }
  >();
  for (const r of rowsRaw) {
    if (!isFunnelStep(r.step)) continue; // future step the UI doesn't know yet
    byStep.set(r.step, {
      accounts: Number(r.accounts ?? 0),
      measured: Number(r.measured ?? 0),
      visitors: Number(r.visitors ?? 0),
    });
  }
  if (byStep.size === 0) return EMPTY;

  const countOf = (s: FunnelStep) => byStep.get(s)?.accounts ?? 0;
  const start = countOf(FUNNEL_STEPS[0]);

  const rows: FunnelRow[] = FUNNEL_STEPS.map((step) => {
    const meta = STEP_META[step];
    const agg = byStep.get(step) ?? { accounts: 0, measured: 0, visitors: 0 };
    const baseCount = meta.base ? countOf(meta.base) : agg.accounts;
    return {
      step,
      label: meta.label,
      count: agg.accounts,
      measured: agg.measured,
      anonymous: agg.visitors,
      pctOfStart: pct(agg.accounts, start),
      conversionPct: meta.base ? pct(agg.accounts, baseCount) : 100,
      baseLabel: meta.baseLabel,
      lost: meta.base ? Math.max(0, baseCount - agg.accounts) : 0,
      trustworthy: meta.derivedExact || agg.measured > 0,
    };
  });

  const inferredSteps = rows.filter((r) => !r.trustworthy).map((r) => r.label);

  // Biggest single leak, by PEOPLE lost rather than by percentage — a 90% drop
  // off a base of 10 is not the thing to go fix.
  let worstDrop: FunnelStats["worstDrop"] = null;
  for (const r of rows) {
    if (r.lost <= 0) continue;
    if (!worstDrop || r.lost > worstDrop.lost) {
      worstDrop = {
        label: r.label,
        lost: r.lost,
        lostPct: 100 - r.conversionPct,
        precise: r.trustworthy,
      };
    }
  }

  const recorded =
    rows.reduce((n, r) => n + r.measured + r.anonymous, 0) > 0
      ? await countRecordedEvents()
      : 0;

  return { rows, inferredSteps, recorded, worstDrop };
}

/**
 * Raw funnel_events row count. Split out because it is only worth a round trip
 * once at least one event exists — on day one the aggregate above already
 * proves the table is empty.
 */
async function countRecordedEvents(): Promise<number> {
  try {
    const { count } = await createAdminClient()
      .from("funnel_events")
      .select("*", { count: "exact", head: true });
    return count ?? 0;
  } catch {
    return 0;
  }
}
