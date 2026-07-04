"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import type { SupabaseClient } from "@supabase/supabase-js";

function currentStreak(timestamps: string[]): number {
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

async function awardAchievements(supabase: SupabaseClient, userId: string) {
  // total completed
  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed_at")
    .eq("user_id", userId);
  const completedIds = new Set((progress ?? []).map((r) => r.lesson_id as string));
  const completedCount = completedIds.size;
  const streak = currentStreak(
    (progress ?? []).map((r) => r.completed_at as string)
  );

  // lesson -> department map to compute fully-finished departments
  const { data: lessonRows } = await supabase
    .from("lessons")
    .select("id, modules(department_id)");
  const totals: Record<string, number> = {};
  const done: Record<string, number> = {};
  for (const l of lessonRows ?? []) {
    const dep = (l.modules as { department_id?: string } | null)?.department_id;
    if (!dep) continue;
    totals[dep] = (totals[dep] ?? 0) + 1;
    if (completedIds.has(l.id as string)) done[dep] = (done[dep] ?? 0) + 1;
  }
  let fullDepts = 0;
  for (const dep of Object.keys(totals)) {
    if (totals[dep] > 0 && (done[dep] ?? 0) >= totals[dep]) fullDepts++;
  }

  const { data: achievements } = await supabase
    .from("achievements")
    .select("id, criteria");
  const { data: have } = await supabase
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", userId);
  const haveSet = new Set((have ?? []).map((h) => h.achievement_id as string));

  const toInsert: { user_id: string; achievement_id: string }[] = [];
  for (const a of achievements ?? []) {
    if (haveSet.has(a.id as string)) continue;
    const c = (a.criteria ?? {}) as {
      type?: string;
      count?: number;
      days?: number;
    };
    if (c.type === "lessons" && completedCount >= (c.count ?? Infinity))
      toInsert.push({ user_id: userId, achievement_id: a.id as string });
    if (c.type === "departments" && fullDepts >= (c.count ?? Infinity))
      toInsert.push({ user_id: userId, achievement_id: a.id as string });
    if (c.type === "streak" && streak >= (c.days ?? Infinity))
      toInsert.push({ user_id: userId, achievement_id: a.id as string });
  }
  if (toInsert.length)
    await supabase.from("user_achievements").insert(toInsert);
}

export async function setLessonComplete(
  lessonId: string,
  deptSlug: string,
  completed: boolean
): Promise<{ ok?: boolean; error?: string; completed?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  if (completed) {
    // Leaderboard integrity: a real learner reads before completing, so no one
    // legitimately marks dozens of lessons done per minute. Cap the rate per
    // user (keyed to their id, not just IP) so the board can't be farmed by a
    // script hammering this action. XP itself is trigger-computed and no longer
    // user-writable, so this is defense-in-depth against automated completion.
    const withinLimit =
      (await rateLimit("lesson-complete", 12, 60, user.id)) &&
      (await rateLimit("lesson-complete-hourly", 120, 3600, user.id));
    if (!withinLimit)
      return { error: "You're completing lessons unusually fast — take a breather and try again in a minute." };

    const { error } = await supabase
      .from("lesson_progress")
      .upsert(
        { user_id: user.id, lesson_id: lessonId },
        { onConflict: "user_id,lesson_id", ignoreDuplicates: true }
      );
    if (error) return { error: error.message };
    await awardAchievements(supabase, user.id);
  } else {
    const { error } = await supabase
      .from("lesson_progress")
      .delete()
      .eq("user_id", user.id)
      .eq("lesson_id", lessonId);
    if (error) return { error: error.message };
  }

  revalidatePath(`/guides/${deptSlug}`);
  revalidatePath("/dashboard");
  return { ok: true, completed };
}

export async function toggleBookmark(
  lessonId: string,
  bookmarked: boolean
): Promise<{ ok?: boolean; error?: string; bookmarked?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  if (bookmarked) {
    const { error } = await supabase
      .from("bookmarks")
      .upsert(
        { user_id: user.id, lesson_id: lessonId },
        { onConflict: "user_id,lesson_id", ignoreDuplicates: true }
      );
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("user_id", user.id)
      .eq("lesson_id", lessonId);
    if (error) return { error: error.message };
  }
  revalidatePath("/bookmarks");
  return { ok: true, bookmarked };
}
