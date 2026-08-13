/**
 * Learning-rhythm math — the week-one retention mechanic.
 *
 * WHY FIVE, AND WHY A WEEK (measured on this database, Aug 2026):
 *   • Retention is a step function, not a slope. Of accounts older than 28
 *     days, those who cleared >= 5 lessons in their first 7 days were still
 *     active on days 8-28 at 21.4% (15/70); everyone else at 3.7% (6/162).
 *     Fisher p = 5.2e-5. That is ~5x.
 *   • Between 1 and 4 lessons there is NO signal at all — d21 survival is
 *     6% / 4% / 8% / 5% for 0 / 1 / 2 / 3-4 lessons. Celebrating lesson #1 and
 *     then going quiet is why 113 of 191 activated learners are one-day
 *     wonders. The only two real steps are 0 -> 1 and 4 -> 5.
 *   • A second distinct active day is worth another ~1.7x on top of depth
 *     (5+ lessons on one day 24%, 5+ across two days 41%).
 *
 * So the unit of progress this module models is FIVE LESSONS IN A WEEK, and
 * the day strip exists to make "come back on a second day" visible — not to
 * threaten anyone with a broken streak.
 *
 * HONESTY RULES BAKED IN (this is a product used by 14-year-olds):
 *   • Nothing here can go DOWN. The window count is per-calendar-week, the
 *     lifetime totals and `bestStreak` / `bestWindow` records are permanent.
 *     A missed day removes nothing a learner already earned.
 *   • There is no deadline, no countdown, no "expires at midnight", no
 *     manufactured scarcity. `describeRhythm` never produces loss-framed copy
 *     — a gap produces a welcome-back line, not a guilt line.
 *   • FRC is seasonal. A learner can be in the shop 20 hours in build season
 *     and touch zero lessons; a daily streak would punish exactly the people
 *     doing the most robotics. The streak count is kept as a RECORD (and to
 *     feed the pre-existing `streak` achievements), never as a stake.
 *
 * HYDRATION CONTRACT:
 *   Every function here is pure and takes `now` as a REQUIRED argument. There
 *   is deliberately no `Date.now()` default anywhere in this file, because a
 *   default would silently read the *client* clock if a client component ever
 *   called it during render, and the server/client HTML would disagree.
 *   Call `computeRhythm` in a Server Component (or a route handler) and pass
 *   the resulting plain object down as props. Day labels are resolved from a
 *   constant table rather than `toLocaleDateString`, because ICU locale data
 *   differs between the Node server and the browser and that too is a
 *   hydration mismatch.
 *
 * TIMEZONE:
 *   `tzOffsetMinutes` is minutes to ADD to UTC to reach the learner's local
 *   day (US Eastern in summer = -240). It defaults to 0 (UTC), which matches
 *   what the existing dashboard already effectively uses on Vercel. Pass a
 *   real offset only if you have a server-known one — never read it from the
 *   browser during render.
 */

/** Lessons in a week that the data says makes retention stick. */
export const WEEK_GOAL = 5;
/** Days in the rhythm window. */
export const WEEK_LEN = 7;

const DAY_MS = 86_400_000;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function clamp01to100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Calendar day of an instant, as `YYYY-MM-DD`, in the caller's timezone.
 * Keys sort lexicographically in chronological order, which every comparison
 * in this file relies on.
 */
export function dayKey(ms: number, tzOffsetMinutes = 0): string {
  const d = new Date(ms + tzOffsetMinutes * 60_000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(
    d.getUTCDate()
  )}`;
}

/** Epoch ms of local midnight for a day key. Inverse of `dayKey`. */
function keyToMs(key: string, tzOffsetMinutes = 0): number {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  const d = Number(key.slice(8, 10));
  return Date.UTC(y, m - 1, d) - tzOffsetMinutes * 60_000;
}

/** Shift a day key by whole days. */
function addDays(key: string, n: number, tzOffsetMinutes = 0): string {
  return dayKey(keyToMs(key, tzOffsetMinutes) + n * DAY_MS, tzOffsetMinutes);
}

/** Whole days from `a` to `b` (negative if b is before a). */
function daysBetween(a: string, b: string): number {
  // Offset cancels out, so this is exact regardless of timezone.
  return Math.round((keyToMs(b) - keyToMs(a)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday. Derived from the calendar date, not a clock. */
function weekdayIndex(key: string): number {
  return new Date(keyToMs(key)).getUTCDay();
}

/** Short weekday name from a constant table (locale-stable across server/client). */
export function dayLabel(key: string): string {
  return WEEKDAY_LABELS[weekdayIndex(key)];
}

/** One square in the seven-day strip. */
export type DayCell = {
  /** `YYYY-MM-DD` — stable id, safe as a React key. */
  key: string;
  /** "Mon" — resolved server-side from a constant table. */
  label: string;
  dayOfMonth: number;
  /** Lessons completed on this day. */
  count: number;
  isToday: boolean;
  /** True for days of the window that haven't happened yet (first week only). */
  isFuture: boolean;
};

export type RhythmPhase =
  /** No lessons ever. Show the invitation, not a wall of zeros. */
  | "new"
  /** Exactly one lesson, ever. The single biggest step is already taken. */
  | "first-lesson"
  /** 1..goal-1 this window, and they've been here before. */
  | "building"
  /** Hit the mark. Everything past here is bonus, and we say so. */
  | "goal-met"
  /** Came back after a gap of 3+ days. Celebrate, never scold. */
  | "returning"
  /** Has history, nothing yet this window. No penalty framing. */
  | "resting";

export type Rhythm = {
  /** Lessons that make a week count. */
  goal: number;
  /**
   * `first-week` = the seven days from signup (the measured activation
   * window). `week` = the Monday-aligned calendar week after that.
   */
  windowKind: "first-week" | "week";
  /** Human label for the window, e.g. "your first week" / "this week". */
  windowLabel: string;
  windowStartKey: string;
  windowEndKey: string;
  /** Lessons completed inside the window. Never decreases within a window. */
  windowCount: number;
  /** goal - windowCount, floored at 0. */
  remaining: number;
  /** 0-100 toward the goal. */
  pct: number;
  /** Exactly WEEK_LEN cells, oldest first. */
  days: DayCell[];
  /** Distinct days with activity inside the window (the "second day" signal). */
  daysActiveInWindow: number;
  /** Lessons completed, all time. */
  lifetime: number;
  /** Distinct days with any activity, all time. */
  activeDays: number;
  /** Consecutive days ending today or yesterday. A record, not a stake. */
  currentStreak: number;
  /** Longest run ever. Permanent — a missed day can never take this away. */
  bestStreak: number;
  /** Most lessons ever inside any seven-day span. Permanent. */
  bestWindow: number;
  /** Whole days since the last completion; null when there's never been one. */
  daysSinceLast: number | null;
  /**
   * When the learner is back after a break (active today/yesterday, and the
   * gap before that was 3+ days), the length of that break. Drives the
   * welcome-back line. Null otherwise.
   */
  returnedAfterDays: number | null;
  phase: RhythmPhase;
};

export type RhythmInput = {
  /** `lesson_progress.completed_at` values. One row = one lesson. */
  completedAt: readonly string[];
  /** `profiles.created_at` — anchors the first-week window. */
  createdAt?: string | null;
  /** Epoch ms. REQUIRED, and must come from the server. */
  now: number;
  /** Minutes to add to UTC for the learner's local day. Defaults to UTC. */
  tzOffsetMinutes?: number;
  /** Override the five-lesson goal (tests only — five is the measured number). */
  goal?: number;
};

/** The zero-state rhythm. Used when a caller has nothing to compute from. */
export function emptyRhythm(now: number, tzOffsetMinutes = 0): Rhythm {
  return computeRhythm({ completedAt: [], now, tzOffsetMinutes });
}

export function computeRhythm(input: RhythmInput): Rhythm {
  const off = input.tzOffsetMinutes ?? 0;
  const goal = Math.max(1, Math.floor(input.goal ?? WEEK_GOAL));
  const now = input.now;

  // ── Bucket completions by local calendar day ──────────────────
  const counts = new Map<string, number>();
  let lifetime = 0;
  for (const ts of input.completedAt) {
    const t = Date.parse(ts);
    if (!Number.isFinite(t)) continue;
    lifetime++;
    const k = dayKey(t, off);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const activeKeys = [...counts.keys()].sort();
  const todayKey = dayKey(now, off);

  // ── Pick the window ───────────────────────────────────────────
  // A brand-new account gets the signup-anchored week, because that is the
  // window the retention number was actually measured over — and because
  // someone who signs up on a Saturday should not be handed a "week" with a
  // day and a half left in it. Everyone else gets Monday-aligned weeks, which
  // reset on a schedule a person can predict.
  let windowKind: Rhythm["windowKind"] = "week";
  let startKey: string;

  const created = input.createdAt ? Date.parse(input.createdAt) : NaN;
  const firstWeekStart =
    Number.isFinite(created) && created <= now ? dayKey(created, off) : null;
  const firstWeekEnd = firstWeekStart ? addDays(firstWeekStart, WEEK_LEN - 1, off) : null;

  if (firstWeekStart && firstWeekEnd && todayKey <= firstWeekEnd) {
    windowKind = "first-week";
    startKey = firstWeekStart;
  } else {
    // Monday-aligned: Mon -> 0 days back … Sun -> 6 days back.
    const back = (weekdayIndex(todayKey) + 6) % 7;
    startKey = addDays(todayKey, -back, off);
  }
  const endKey = addDays(startKey, WEEK_LEN - 1, off);

  // ── The seven-day strip ───────────────────────────────────────
  const days: DayCell[] = [];
  let windowCount = 0;
  let daysActiveInWindow = 0;
  for (let i = 0; i < WEEK_LEN; i++) {
    const k = addDays(startKey, i, off);
    const count = counts.get(k) ?? 0;
    windowCount += count;
    if (count > 0) daysActiveInWindow++;
    days.push({
      key: k,
      label: dayLabel(k),
      dayOfMonth: Number(k.slice(8, 10)),
      count,
      isToday: k === todayKey,
      isFuture: k > todayKey,
    });
  }

  // ── Streaks: kept as a record, never as a stake ───────────────
  const yesterdayKey = addDays(todayKey, -1, off);
  let currentStreak = 0;
  if (counts.has(todayKey) || counts.has(yesterdayKey)) {
    let cursor = counts.has(todayKey) ? todayKey : yesterdayKey;
    while (counts.has(cursor)) {
      currentStreak++;
      cursor = addDays(cursor, -1, off);
    }
  }

  let bestStreak = 0;
  let run = 0;
  for (let i = 0; i < activeKeys.length; i++) {
    run =
      i > 0 && daysBetween(activeKeys[i - 1], activeKeys[i]) === 1 ? run + 1 : 1;
    if (run > bestStreak) bestStreak = run;
  }

  // Best lessons inside any rolling seven-day span. activeKeys is at most a
  // few dozen entries per learner, so the quadratic scan is free.
  let bestWindow = 0;
  for (let i = 0; i < activeKeys.length; i++) {
    let sum = 0;
    for (let j = i; j < activeKeys.length; j++) {
      if (daysBetween(activeKeys[i], activeKeys[j]) >= WEEK_LEN) break;
      sum += counts.get(activeKeys[j]) ?? 0;
    }
    if (sum > bestWindow) bestWindow = sum;
  }

  const lastKey = activeKeys.length ? activeKeys[activeKeys.length - 1] : null;
  const daysSinceLast = lastKey ? daysBetween(lastKey, todayKey) : null;

  // "Back after a break" = active today or yesterday, with a 3+ day gap
  // before that. Three days is the point where a returning learner deserves
  // an acknowledgement rather than a fresh-week greeting.
  let returnedAfterDays: number | null = null;
  if (lastKey && daysSinceLast !== null && daysSinceLast <= 1 && activeKeys.length >= 2) {
    const gap = daysBetween(activeKeys[activeKeys.length - 2], lastKey);
    if (gap >= 3) returnedAfterDays = gap;
  }

  let phase: RhythmPhase;
  if (lifetime === 0) phase = "new";
  else if (windowCount >= goal) phase = "goal-met";
  else if (returnedAfterDays !== null) phase = "returning";
  else if (windowCount === 0) phase = "resting";
  else if (lifetime === 1) phase = "first-lesson";
  else phase = "building";

  return {
    goal,
    windowKind,
    windowLabel: windowKind === "first-week" ? "your first week" : "this week",
    windowStartKey: startKey,
    windowEndKey: endKey,
    windowCount,
    remaining: Math.max(0, goal - windowCount),
    pct: clamp01to100((windowCount / goal) * 100),
    days,
    daysActiveInWindow,
    lifetime,
    activeDays: activeKeys.length,
    currentStreak,
    bestStreak,
    bestWindow,
    daysSinceLast,
    returnedAfterDays,
    phase,
  };
}

/* ------------------------------------------------------------------ */
/*  Copy                                                               */
/* ------------------------------------------------------------------ */

export type RhythmCopy = {
  eyebrow: string;
  headline: string;
  body: string;
  /** Label for the primary action, e.g. "Start your first lesson". */
  cta: string;
};

function lessons(n: number): string {
  return n === 1 ? "1 lesson" : `${n} lessons`;
}

/**
 * Honest, forgiving copy for each phase.
 *
 * Deliberately absent from every branch: deadlines, countdowns, "don't lose",
 * "expires", "last chance", fire emoji attached to a threat, or any sentence
 * that implies a missed day destroyed something. The strongest claim made is
 * the measured one, stated once, as information.
 *
 * A subtler rule, learned the hard way while writing this: reassurance that
 * NAMES the fear still plants it. "Nothing expired while you were away" and
 * "nothing to lose" both smuggle in the idea that expiry was on the table.
 * Every branch below states the positive fact instead — "everything you
 * finished is still here" — so a learner who was never worried isn't taught
 * to be. The unit test in the build log asserts this with a banned-phrase
 * regex; if you add a branch, keep it clean.
 */
export function describeRhythm(r: Rhythm): RhythmCopy {
  const first = r.windowKind === "first-week";
  const eyebrow = first ? "Your first week" : "This week";

  switch (r.phase) {
    case "new":
      return {
        eyebrow,
        headline: `${r.goal} lessons is where it sticks`,
        body: `Learners who finish ${r.goal} in their first week are about five times more likely to still be learning here three weeks later. One sitting or spread across the week, whichever suits you.`,
        cta: "Start your first lesson",
      };

    case "first-lesson":
      return {
        eyebrow,
        headline: "One down: that was the hard one",
        body: `Starting is the single biggest step there is. ${r.remaining} more ${
          first ? "this first week" : "this week"
        } is the point where it usually turns into a habit.`,
        cta: "Next lesson",
      };

    case "building":
      return {
        eyebrow,
        headline: `${r.remaining} to go${first ? " this first week" : " this week"}`,
        // The second sentence is the day-2 nudge: returning on another day is
        // worth ~1.7x on its own, so it's worth naming once they've done one.
        body: `${lessons(r.windowCount)} down. ${
          r.daysActiveInWindow === 1
            ? "Coming back on another day counts for more than doing them all at once."
            : `${r.daysActiveInWindow} days in: that's the part most people skip.`
        }`,
        cta: "Next lesson",
      };

    case "goal-met":
      return {
        eyebrow,
        headline: `${r.windowCount} cleared${first ? " in your first week" : " this week"} 🎉`,
        body: `That's the mark. Everything past here is bonus: carry on if you're enjoying it, stop if you've had enough. ${
          r.bestWindow > r.windowCount
            ? `Your best week so far is ${r.bestWindow}.`
            : "This is your best week yet."
        }`,
        cta: "Keep going",
      };

    case "returning": {
      // A gap gets acknowledged warmly and then the card gets straight back to
      // pointing at the week goal — a welcome that forgets to give you a target
      // is just a greeting.
      //
      // Note what this branch does NOT say. `r.returnedAfterDays` is right
      // there and it would be trivial to print "back after 11 days"; naming the
      // gap is scorekeeping about absence, so the number is computed and not
      // used. Nor does it say "still here" / "nothing expired" — a sentence
      // that reassures you your work survived is a sentence that just told you
      // it might not have. It states the standing total, flat.
      const record = `${lessons(r.lifetime)} completed${
        r.bestStreak > 1 ? `, best run ${r.bestStreak} days` : ""
      }`;
      const onward =
        r.remaining > 0
          ? ` ${r.remaining} more ${
              r.remaining === 1 ? "lesson" : "lessons"
            } makes it a full week.`
          : "";
      return {
        eyebrow: "Welcome back",
        headline: "Right where you left it",
        body: `You're at ${record}.${onward}`,
        cta: "Pick up where you left off",
      };
    }

    case "resting":
    default:
      return {
        eyebrow,
        headline: "Pick it back up whenever",
        body: `${lessons(r.lifetime)} completed so far${
          r.bestWindow > 0 ? `, best week ${r.bestWindow}` : ""
        }. Come back at whatever pace suits you. The week starts counting again when you do.`,
        cta: "Resume learning",
      };
  }
}

/**
 * The one-line version of `describeRhythm`, for a 260px column (the lesson
 * reading rail) where the full card would not fit and a truncated headline
 * would read worse than a short sentence.
 *
 * Same rules as `describeRhythm`, and they matter more here because this line
 * sits beside a learner for the whole time they are reading: no deadline, no
 * countdown, no reference to a gap, nothing that reads as a scold. The
 * "resting" and "returning" lines are deliberately the warmest two.
 */
export function rhythmMicrocopy(r: Rhythm): string {
  switch (r.phase) {
    case "new":
      return `${r.goal} lessons in a week is where it starts to stick.`;
    case "first-lesson":
      return "One down. That was the hard one.";
    case "building":
      return r.remaining === 1
        ? "One more makes the week."
        : `${r.remaining} more makes the week.`;
    case "goal-met":
      return "Week made. Anything past here is bonus.";
    case "returning":
      return "Good to have you back.";
    case "resting":
    default:
      return "Whenever you're ready, it picks up where you left it.";
  }
}

/* ------------------------------------------------------------------ */
/*  Achievements — extend the existing table, don't duplicate it        */
/* ------------------------------------------------------------------ */

/**
 * How far along a locked badge is. The `achievements` table already stores
 * `criteria` as `{type:'lessons',count}` / `{type:'departments',count}` /
 * `{type:'streak',days}` and `src/app/actions/progress.ts` already awards
 * against exactly those three shapes — this reads the same shapes so a locked
 * badge can show "3 / 5" instead of just a padlock. Nothing new is stored.
 */
export type BadgeProgress = {
  current: number;
  target: number;
  /** e.g. "lessons", "departments", "day streak" */
  unit: string;
};

/** The three counters the existing criteria types measure against. */
export type AchievementStats = {
  lessons: number;
  departments: number;
  streak: number;
};

export function achievementProgress(
  criteria: unknown,
  stats: AchievementStats
): BadgeProgress | null {
  const c = (criteria ?? {}) as { type?: string; count?: number; days?: number };
  if (c.type === "lessons" && typeof c.count === "number")
    return { current: Math.min(stats.lessons, c.count), target: c.count, unit: "lessons" };
  if (c.type === "departments" && typeof c.count === "number")
    return {
      current: Math.min(stats.departments, c.count),
      target: c.count,
      unit: c.count === 1 ? "department" : "departments",
    };
  if (c.type === "streak" && typeof c.days === "number")
    return { current: Math.min(stats.streak, c.days), target: c.days, unit: "day streak" };
  return null;
}

/**
 * Whether a badge's criteria may be dangled in front of a learner as a "next
 * unlock" nudge. This is a product rule, not a data limitation.
 *
 *   • `lessons` — YES. The counter is monotonic. The gap can only ever shrink,
 *     so naming it cannot create something a learner is able to lose.
 *
 *   • `streak`  — NO, deliberately. A day streak is the one counter in this
 *     product that goes DOWN, and "2 more days" printed on a page is exactly
 *     the mechanic that turns a missed Tuesday into a loss. The streak badges
 *     stay in the achievements grid (they're already awarded, and seeing one
 *     you earned is a nice surprise); what this rule forbids is *pointing at
 *     an unearned one*, because that converts a record into a stake. A product
 *     that tells a 14-year-old they are two days from a badge has also told
 *     them what missing tomorrow costs.
 *
 *   • `departments` — NO from rhythm surfaces, for a boring reason rather than
 *     an ethical one: "departments fully finished" can only be computed from
 *     the whole lesson→department map, which a per-request progress read does
 *     not have. A caller that HAS that map (the dashboard, /profile) can call
 *     `achievementProgress` directly and show it honestly. Guessing zero here
 *     would rank a 0/1 department badge as the *nearest* unlock and print a
 *     number that is simply wrong.
 */
export function isNudgeableCriteria(criteria: unknown): boolean {
  const c = (criteria ?? {}) as { type?: string };
  return c.type === "lessons";
}

/**
 * The closest unearned badge — the one worth showing as "next", so the badge
 * grid stops being eleven padlocks and becomes one reachable target.
 * Ranks by absolute distance first (2 lessons away beats 40% of a 25-lesson
 * badge), then by completion fraction as a tiebreak.
 */
export function pickNextUnlock<
  T extends { earned: boolean; progress?: BadgeProgress | null },
>(list: readonly T[]): T | null {
  let best: T | null = null;
  let bestGap = Infinity;
  let bestFrac = -1;
  for (const a of list) {
    if (a.earned || !a.progress) continue;
    const { current, target } = a.progress;
    if (target <= 0) continue;
    const gap = target - current;
    if (gap <= 0) continue;
    const frac = current / target;
    if (gap < bestGap || (gap === bestGap && frac > bestFrac)) {
      best = a;
      bestGap = gap;
      bestFrac = frac;
    }
  }
  return best;
}
