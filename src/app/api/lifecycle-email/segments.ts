import type { LifecycleSegment } from "@/lib/email";

/**
 * Win-back segmentation policy for the lifecycle email.
 *
 * Deliberately PURE — no `server-only`, no DB, no catalog fetch (that lives in
 * ./catalog.ts). Keeping it dependency-free is what lets src/lib/retention.ts
 * import the same thresholds the job runs on, so the founder's retention panel
 * can never again describe a different audience than the one being mailed.
 *
 * The old job had one audience ("completed >= 1 lesson, dormant 5 days") and
 * one message. That excluded every zero-completion account by construction, so
 * the 156 users who signed up and never started had received exactly zero
 * recovery emails, ever — 45% of the user base was structurally unreachable.
 * It also pointed everyone at the globally-first uncompleted lesson, which for
 * 125 of 191 learners with progress meant "What Is FIRST?" no matter how deep
 * into CAD or programming they actually were.
 *
 * This module fixes both: it decides WHICH conversation a learner is in, and it
 * finds the next lesson in the department they were actually working in.
 *
 * Everything here is a pure function of already-fetched rows so the rules can be
 * reasoned about (and unit-checked) without touching the network.
 */

export const DAY = 86_400_000;

/** Lessons-in-first-week threshold where retention stops being flat and jumps
 * 5x (churn analysis: 0-4 lessons all sit at 4-8% d21 survival, 5+ hits 32%).
 * Also the dashboard's own INVITE_EARNED_AT, so the two agree. */
export const MAGIC_NUMBER = 5;

/** No lesson activity AND no site presence for this long before we consider
 * someone lapsed. Presence matters: the old job read dormancy purely from
 * lesson_progress, so a learner browsing daily could be told to come back. */
export const DORMANT_DAYS = 5;

/** Past this much dormancy the win-back stops entirely. Measured: of the 102
 * emailed users churned >= 21 days, exactly zero returned, and no dormancy
 * bucket past ~35 days shows any response in either arm. Mailing beyond this is
 * volume without upside, which is precisely how a mail reputation is lost. */
export const GIVE_UP_DORMANT_DAYS = 60;

/** Dormancy past which we slow right down instead of mailing weekly. */
export const COLD_DORMANT_DAYS = 21;
export const THROTTLE_DAYS = 7; // warm: lapsed under COLD_DORMANT_DAYS
export const THROTTLE_DAYS_COLD = 30; // cold: lapsed 21-60 days

/** never_started guards. Activation is a day-zero event (70% of everyone who
 * ever activated did it within 10 minutes of signing up), so waiting a day
 * costs nothing and avoids mailing someone mid-first-session. */
export const NEVER_STARTED_MIN_AGE_DAYS = 1;
/** ...and don't mail someone who was on the site in the last two days. */
export const NEVER_STARTED_QUIET_DAYS = 2;
/** Past this the relationship is too stale for an onboarding nudge to read as
 * anything but unsolicited mail. Today's oldest such account is 51 days, so
 * this excludes nobody now — it is a guard for later. */
export const NEVER_STARTED_MAX_AGE_DAYS = 90;

/**
 * Reserved / non-routable TLDs (RFC 2606 + RFC 6761). Mail to these ALWAYS hard
 * bounces. Two such accounts exist today (@learnfrc.test) and both sit in the
 * never_started lane, so the first run of the widened job would have posted a
 * ~7% hard-bounce rate from a young sending domain — Resend and every inbox
 * provider treat 5% as the point where delivery starts being throttled. This
 * costs nothing to check and protects the one asset the win-back depends on.
 */
const UNDELIVERABLE_TLDS = new Set(["test", "example", "invalid", "localhost", "local"]);

export function isDeliverable(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return false;
  const domain = email.slice(at + 1).toLowerCase();
  const tld = domain.slice(domain.lastIndexOf(".") + 1);
  return !UNDELIVERABLE_TLDS.has(tld) && !UNDELIVERABLE_TLDS.has(domain);
}

export type CatalogLesson = {
  id: string;
  title: string;
  summary: string | null;
  href: string;
  departmentSlug: string;
  departmentName: string;
};

/** Per-learner progress, reduced from lesson_progress rows. */
export type ProgressSummary = {
  /** Distinct lessons with a completed_at. */
  completed: number;
  /** Distinct calendar days with a completion. */
  activeDays: number;
  /** Epoch ms of the most recent completion, or null. */
  lastCompletedAt: number | null;
  /** Lesson id of the most recent completion, or null. */
  lastLessonId: string | null;
  /** Every completed lesson id, for "what haven't they done". */
  lessonIds: Set<string>;
};

export const emptyProgress = (): ProgressSummary => ({
  completed: 0,
  activeDays: 0,
  lastCompletedAt: null,
  lastLessonId: null,
  lessonIds: new Set(),
});

export function summarise(
  rows: { lesson_id: string | null; completed_at: string | null }[]
): ProgressSummary {
  const p = emptyProgress();
  const days = new Set<string>();
  for (const r of rows) {
    if (r.lesson_id) p.lessonIds.add(r.lesson_id);
    if (!r.completed_at) continue;
    const t = new Date(r.completed_at).getTime();
    if (Number.isNaN(t)) continue;
    p.completed++;
    days.add(r.completed_at.slice(0, 10));
    if (p.lastCompletedAt === null || t > p.lastCompletedAt) {
      p.lastCompletedAt = t;
      p.lastLessonId = r.lesson_id;
    }
  }
  p.activeDays = days.size;
  return p;
}

export type Decision =
  | { send: false; skip: string }
  | { send: true; segment: LifecycleSegment; dormantDays: number };

/**
 * The whole eligibility policy, in one pure function.
 *
 * Note how never_started enforces "once, ever" without needing a new column:
 * the lane requires zero completions AND last_lifecycle_email_at IS NULL, so
 * the moment we send, the stamp is set and the learner can never re-enter the
 * lane while they still have zero completions. If they later complete a lesson
 * and lapse, they legitimately re-enter as stalled_early instead. That makes
 * the footer promise ("the only reminder we'll send about it") literally true.
 */
export function decide(args: {
  now: number;
  createdAt: number;
  lastSeenAt: number | null;
  lastEmailedAt: number | null;
  progress: ProgressSummary;
}): Decision {
  const { now, createdAt, lastSeenAt, lastEmailedAt, progress } = args;

  if (progress.completed === 0) {
    const ageDays = (now - createdAt) / DAY;
    if (ageDays < NEVER_STARTED_MIN_AGE_DAYS)
      return { send: false, skip: "too new — may still activate" };
    if (ageDays > NEVER_STARTED_MAX_AGE_DAYS)
      return { send: false, skip: "signup too old for an onboarding nudge" };
    if (lastEmailedAt !== null)
      return { send: false, skip: "already had the one onboarding nudge" };
    // Someone browsing right now doesn't need a "come start" email.
    const quietSince = Math.max(lastSeenAt ?? 0, createdAt);
    if (now - quietSince < NEVER_STARTED_QUIET_DAYS * DAY)
      return { send: false, skip: "on the site recently" };
    return {
      send: true,
      segment: "never_started",
      dormantDays: Math.floor((now - quietSince) / DAY),
    };
  }

  // Lapsed = no completion AND no presence heartbeat. Using both is the fix for
  // the old job telling daily visitors that they'd disappeared.
  const lastTouch = Math.max(progress.lastCompletedAt ?? 0, lastSeenAt ?? 0);
  const dormantDays = Math.floor((now - lastTouch) / DAY);
  if (dormantDays < DORMANT_DAYS)
    return { send: false, skip: "still active" };
  if (dormantDays > GIVE_UP_DORMANT_DAYS)
    return { send: false, skip: "past the win-back horizon" };

  const throttleDays =
    dormantDays >= COLD_DORMANT_DAYS ? THROTTLE_DAYS_COLD : THROTTLE_DAYS;
  if (lastEmailedAt !== null && now - lastEmailedAt < throttleDays * DAY)
    return { send: false, skip: `throttled (<${throttleDays}d since last)` };

  return {
    send: true,
    segment:
      progress.completed >= MAGIC_NUMBER ? "deep_churn" : "stalled_early",
    dormantDays,
  };
}

export type NextLesson = {
  lesson: CatalogLesson;
  departmentDone: number;
  departmentTotal: number;
};

/**
 * The learner's real next lesson: the first uncompleted lesson in the
 * department they most recently worked in, falling back to the first
 * uncompleted lesson anywhere.
 *
 * The old code did a plain `catalog.find(l => !done.has(l.id))`, which returns
 * the globally-first uncompleted lesson. Measured against live data that points
 * 125 of 191 learners with progress at a department they weren't in — including
 * telling someone 94 lessons deep that their next lesson is "The FIRST
 * Progression: FLL, FTC, and FRC". That is the single most obvious tell that an
 * email is automated and doesn't know you.
 */
export function pickNextLesson(
  catalog: CatalogLesson[],
  progress: ProgressSummary
): NextLesson | null {
  const done = progress.lessonIds;
  const homeDept = progress.lastLessonId
    ? (catalog.find((l) => l.id === progress.lastLessonId)?.departmentSlug ??
      null)
    : null;

  const pick = (slug: string | null): CatalogLesson | null => {
    for (const l of catalog) {
      if (slug !== null && l.departmentSlug !== slug) continue;
      if (!done.has(l.id)) return l;
    }
    return null;
  };

  const lesson = (homeDept ? pick(homeDept) : null) ?? pick(null);
  if (!lesson) return null;

  let departmentTotal = 0;
  let departmentDone = 0;
  for (const l of catalog) {
    if (l.departmentSlug !== lesson.departmentSlug) continue;
    departmentTotal++;
    if (done.has(l.id)) departmentDone++;
  }
  return { lesson, departmentDone, departmentTotal };
}
