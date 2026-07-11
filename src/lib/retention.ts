import { createAdminClient } from "@/lib/supabase/admin";

export type RetentionStats = {
  totalUsers: number;
  activated: number; // completed >= 1 lesson
  activationPct: number;
  returned: number; // active on >= 2 distinct days
  returnPct: number; // of activated
  powerUsers: number; // active on >= 5 distinct days
  medianLessons: number; // among activated
  lifecycleEligible: number; // opted-in + engaged + lapsed >5d + not emailed <7d
  emailedRecently: number; // lifecycle emails sent in last 7d
  optedOut: number;
};

const DAY = 86_400_000;

/**
 * Founder-facing retention snapshot, computed live from profiles + lesson
 * progress (no third-party analytics). Answers the question the 2-year plan
 * hinges on: are users coming back, and is the lifecycle email doing its job?
 */
export async function getRetentionStats(): Promise<RetentionStats> {
  const admin = createAdminClient();

  const { data: profRows } = await admin
    .from("profiles")
    .select("id, email_opt_in, last_lifecycle_email_at");
  const profs = (profRows ?? []) as {
    id: string;
    email_opt_in: boolean | null;
    last_lifecycle_email_at: string | null;
  }[];

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

  const now = Date.now();
  let lifecycleEligible = 0;
  let emailedRecently = 0;
  let optedOut = 0;
  for (const p of profs) {
    if (p.email_opt_in === false) {
      optedOut++;
      continue;
    }
    const last = lastActive.get(p.id);
    if (last === undefined) continue; // never engaged — not in the email audience
    const emailedRecent =
      !!p.last_lifecycle_email_at &&
      now - new Date(p.last_lifecycle_email_at).getTime() < 7 * DAY;
    if (emailedRecent) emailedRecently++;
    if (now - last >= 5 * DAY && !emailedRecent) lifecycleEligible++;
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
  };
}
