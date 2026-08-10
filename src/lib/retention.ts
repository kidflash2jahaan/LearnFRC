import { createAdminClient } from "@/lib/supabase/admin";
import {
  COLD_DORMANT_DAYS,
  DAY,
  DORMANT_DAYS,
  GIVE_UP_DORMANT_DAYS,
  MAGIC_NUMBER,
  NEVER_STARTED_MAX_AGE_DAYS,
  NEVER_STARTED_MIN_AGE_DAYS,
  NEVER_STARTED_QUIET_DAYS,
  THROTTLE_DAYS,
  THROTTLE_DAYS_COLD,
} from "@/app/api/lifecycle-email/segments";

export type RetentionStats = {
  totalUsers: number;
  activated: number; // completed >= 1 lesson
  activationPct: number;
  returned: number; // active on >= 2 distinct days
  returnPct: number; // of activated
  powerUsers: number; // active on >= 5 distinct days
  medianLessons: number; // among activated
  /** Opted-in + lapsed + not throttled, across ALL lanes. Upper bound: this
   * module reads `profiles` only, so it cannot see which accounts never
   * confirmed their email. The job filters those too, and today that is 34
   * accounts — so the number it actually sends to is this minus the
   * unconfirmed. `/api/lifecycle-email?dry=1` reports the exact figure. */
  lifecycleEligible: number;
  emailedRecently: number; // lifecycle emails sent in last 7d
  optedOut: number;
  /** Reached the 5-lesson threshold where retention jumps ~5x. */
  reachedMagicNumber: number;
  /** Zero completions. Until now these were invisible to this panel AND
   * structurally excluded from every lifecycle email the product ever sent. */
  neverStarted: number;
  /** Of those, how many are opted in, inside the age window, quiet, and have
   * never had the one onboarding nudge. Same confirmation caveat as above. */
  neverStartedMailable: number;
  /** Win-back AUDIENCE split the way the lifecycle job splits it — how many
   * opted-in learners are currently in each conversation, before throttling.
   * `lifecycleEligible` is the subset sendable on this run. */
  segments: {
    never_started: number; // zero completions, inside the age + quiet window
    stalled_early: number; // 1-4 lessons, lapsed
    deep_churn: number; // 5+ lessons, lapsed
  };
};

/**
 * Founder-facing retention snapshot, computed live from profiles + lesson
 * progress (no third-party analytics). Answers the question the 2-year plan
 * hinges on: are users coming back, and is the win-back email doing its job?
 *
 * This used to `continue` on any user with no completions, which meant the
 * panel mirrored the lifecycle job's blind spot exactly — the 45% of accounts
 * that never started a lesson were missing from both the audience and the
 * dashboard that was supposed to reveal the audience was wrong. The thresholds
 * are now imported from the job's own segmentation module so the two can't
 * drift apart again.
 */
export async function getRetentionStats(): Promise<RetentionStats> {
  const admin = createAdminClient();

  // PAGED: PostgREST truncates any select at 1000 rows silently, so an unpaged
  // read here would quietly undercount every number below once the table grows.
  type ProfRow = {
    id: string;
    email_opt_in: boolean | null;
    last_lifecycle_email_at: string | null;
    last_seen_at: string | null;
    created_at: string;
  };
  const profs: ProfRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await admin
      .from("profiles")
      .select("id, email_opt_in, last_lifecycle_email_at, last_seen_at, created_at")
      .order("id", { ascending: true })
      .range(from, from + 999);
    const chunk = (data ?? []) as ProfRow[];
    profs.push(...chunk);
    if (chunk.length < 1000) break;
  }

  // One pass over lesson_progress (paged past the 1000-row cap): per user, the
  // set of distinct active days, the last-active time, and the lesson count.
  const days = new Map<string, Set<string>>();
  const lastActive = new Map<string, number>();
  const lessons = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data } = await admin
      .from("lesson_progress")
      .select("user_id, completed_at")
      .order("id", { ascending: true })
      .range(from, from + 999);
    const chunk = (data ?? []) as { user_id: string; completed_at: string }[];
    for (const r of chunk) {
      if (!r.completed_at) continue;
      let set = days.get(r.user_id);
      if (!set) days.set(r.user_id, (set = new Set()));
      set.add(r.completed_at.slice(0, 10));
      const t = new Date(r.completed_at).getTime();
      lastActive.set(r.user_id, Math.max(lastActive.get(r.user_id) ?? 0, t));
      lessons.set(r.user_id, (lessons.get(r.user_id) ?? 0) + 1);
    }
    if (chunk.length < 1000) break;
  }

  const totalUsers = profs.length;
  const activated = days.size;
  let returned = 0;
  let powerUsers = 0;
  for (const set of days.values()) {
    if (set.size >= 2) returned++;
    if (set.size >= 5) powerUsers++;
  }

  const counts = [...lessons.values()].sort((a, b) => a - b);
  const medianLessons = counts.length ? counts[Math.floor(counts.length / 2)] : 0;
  let reachedMagicNumber = 0;
  for (const n of counts) if (n >= MAGIC_NUMBER) reachedMagicNumber++;

  const now = Date.now();
  let lifecycleEligible = 0;
  let emailedRecently = 0;
  let optedOut = 0;
  let neverStarted = 0;
  let neverStartedMailable = 0;
  const segments = { never_started: 0, stalled_early: 0, deep_churn: 0 };

  for (const p of profs) {
    const done = lessons.get(p.id) ?? 0;
    if (done === 0) neverStarted++;

    if (p.email_opt_in === false) {
      optedOut++;
      continue;
    }
    const emailedAt = p.last_lifecycle_email_at
      ? new Date(p.last_lifecycle_email_at).getTime()
      : null;
    if (emailedAt !== null && now - emailedAt < 7 * DAY) emailedRecently++;

    if (done === 0) {
      const createdAt = new Date(p.created_at).getTime();
      const ageDays = (now - createdAt) / DAY;
      const fresh =
        ageDays >= NEVER_STARTED_MIN_AGE_DAYS &&
        ageDays <= NEVER_STARTED_MAX_AGE_DAYS;
      // Same quiet rule the job applies: someone browsing right now doesn't
      // need a "come start" email, so they aren't in the audience today.
      const quietSince = Math.max(
        p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0,
        createdAt
      );
      const quiet = now - quietSince >= NEVER_STARTED_QUIET_DAYS * DAY;
      if (!fresh || !quiet) continue;
      segments.never_started++;
      // The "once ever" rule: a never-started learner who already had their one
      // onboarding nudge stays in the segment but is no longer sendable.
      if (emailedAt === null) {
        neverStartedMailable++;
        lifecycleEligible++;
      }
      continue;
    }

    // Lapsed on BOTH signals, mirroring the job: a learner still browsing the
    // site is not dormant just because they haven't finished a lesson.
    const lastSeen = p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0;
    const lastTouch = Math.max(lastActive.get(p.id) ?? 0, lastSeen);
    const dormantDays = Math.floor((now - lastTouch) / DAY);
    if (dormantDays < DORMANT_DAYS || dormantDays > GIVE_UP_DORMANT_DAYS)
      continue;
    const lane = done >= MAGIC_NUMBER ? "deep_churn" : "stalled_early";
    segments[lane]++;
    const throttleDays =
      dormantDays >= COLD_DORMANT_DAYS ? THROTTLE_DAYS_COLD : THROTTLE_DAYS;
    if (emailedAt === null || now - emailedAt >= throttleDays * DAY)
      lifecycleEligible++;
  }

  return {
    totalUsers,
    activated,
    activationPct: totalUsers ? Math.round((activated / totalUsers) * 100) : 0,
    returned,
    returnPct: activated ? Math.round((returned / activated) * 100) : 0,
    powerUsers,
    medianLessons,
    lifecycleEligible,
    emailedRecently,
    optedOut,
    reachedMagicNumber,
    neverStarted,
    neverStartedMailable,
    segments,
  };
}
