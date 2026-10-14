import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Achievement awarding, shared by every path that adds completions:
 * a lesson completion (website action and app route, src/lib/app/progress.ts)
 * and a guest-progress migration (src/lib/app/guest.ts).
 *
 * These used to be two near-identical copies, one in
 * src/app/actions/progress.ts and one in src/app/api/migrate-guest/route.ts.
 * This is the merged version: the paged reads come from the migration copy
 * (PostgREST truncates at 1000 rows without saying so) and the streak rule is
 * the one both copies already shared.
 *
 * Reads and the insert go through the service-role client, scoped to the
 * user id the caller verified, so neither depends on the `authenticated` grants
 * on user_achievements (SELECT is slated for revoke, and so is the direct
 * INSERT that let anyone award themselves a badge).
 */

const PAGE = 1000;

/**
 * Consecutive days with a completion, ending today or yesterday, in the
 * server's local time (UTC on Vercel). Unchanged from the original action.
 */
export function currentStreak(timestamps: string[]): number {
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const days = new Set<string>();
  for (const ts of timestamps) {
    const d = new Date(ts);
    if (!Number.isNaN(d.getTime())) days.add(key(d));
  }
  if (!days.size) return 0;
  const DAY = 86_400_000;
  const today = new Date();
  if (!days.has(key(today)) && !days.has(key(new Date(today.getTime() - DAY))))
    return 0;
  let streak = 0;
  const cur = new Date(today);
  if (!days.has(key(cur))) cur.setTime(cur.getTime() - DAY);
  while (days.has(key(cur))) {
    streak++;
    cur.setTime(cur.getTime() - DAY);
  }
  return streak;
}

/** A badge as the app shows it in the completion celebration. */
export type AwardedAchievement = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
};

export type AwardOutcome = {
  /** Distinct lessons this user has completed, all time. */
  completedCount: number;
  /** Badges this call awarded, in catalog order. Empty when none were new. */
  newAchievements: AwardedAchievement[];
};

/**
 * Award every achievement the user now qualifies for and doesn't hold yet.
 * Criteria types: `lessons` (count), `departments` (fully finished
 * departments), `streak` (days). Badges are never taken away.
 */
export async function awardAchievements(
  admin: SupabaseClient,
  userId: string
): Promise<AwardOutcome> {
  const completedIds = new Set<string>();
  const stamps: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await admin
      .from("lesson_progress")
      .select("lesson_id, completed_at")
      .eq("user_id", userId)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    const chunk = (data ?? []) as { lesson_id: string; completed_at: string }[];
    for (const r of chunk) {
      completedIds.add(r.lesson_id);
      stamps.push(r.completed_at);
    }
    if (chunk.length < PAGE) break;
  }
  const completedCount = completedIds.size;
  const streak = currentStreak(stamps);

  // Lesson to department, so fully finished departments can be counted.
  const totals: Record<string, number> = {};
  const done: Record<string, number> = {};
  for (let from = 0; ; from += PAGE) {
    const { data } = await admin
      .from("lessons")
      .select("id, modules(department_id)")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    const chunk = (data ?? []) as unknown as {
      id: string;
      modules: { department_id?: string } | null;
    }[];
    for (const l of chunk) {
      const dep = l.modules?.department_id;
      if (!dep) continue;
      totals[dep] = (totals[dep] ?? 0) + 1;
      if (completedIds.has(l.id)) done[dep] = (done[dep] ?? 0) + 1;
    }
    if (chunk.length < PAGE) break;
  }
  let fullDepts = 0;
  for (const dep of Object.keys(totals))
    if (totals[dep] > 0 && (done[dep] ?? 0) >= totals[dep]) fullDepts++;

  const [{ data: achievements }, { data: have }] = await Promise.all([
    admin
      .from("achievements")
      .select("id, slug, name, description, icon, criteria, sort_order")
      .order("sort_order"),
    admin.from("user_achievements").select("achievement_id").eq("user_id", userId),
  ]);
  const haveSet = new Set((have ?? []).map((h) => h.achievement_id as string));

  const earned: AwardedAchievement[] = [];
  for (const a of achievements ?? []) {
    const id = a.id as string;
    if (haveSet.has(id)) continue;
    const c = (a.criteria ?? {}) as { type?: string; count?: number; days?: number };
    if (
      (c.type === "lessons" && completedCount >= (c.count ?? Infinity)) ||
      (c.type === "departments" && fullDepts >= (c.count ?? Infinity)) ||
      (c.type === "streak" && streak >= (c.days ?? Infinity))
    )
      earned.push({
        id,
        slug: a.slug as string,
        name: a.name as string,
        description: a.description as string,
        icon: a.icon as string,
      });
  }

  if (!earned.length) return { completedCount, newAchievements: [] };

  // ignoreDuplicates: two completions racing each other can both decide the
  // same badge is new. The unique (user_id, achievement_id) index keeps one
  // row either way; this stops the loser's whole batch from failing with it.
  //
  // Report only the rows THIS call inserted (ignoreDuplicates returns just
  // those), so the loser of a race doesn't celebrate the same badge twice.
  const { data: inserted, error } = await admin
    .from("user_achievements")
    .upsert(
      earned.map((a) => ({ user_id: userId, achievement_id: a.id })),
      { onConflict: "user_id,achievement_id", ignoreDuplicates: true }
    )
    .select("achievement_id");
  if (error) return { completedCount, newAchievements: [] };
  const insertedIds = new Set((inserted ?? []).map((r) => r.achievement_id as string));
  return {
    completedCount,
    newAchievements: earned.filter((a) => insertedIds.has(a.id)),
  };
}
