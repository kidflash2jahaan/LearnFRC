import "server-only";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rate-limit";
import { recordFunnelEvent } from "@/lib/funnel";
import {
  achievementProgress,
  computeRhythm,
  isNudgeableCriteria,
  pickNextUnlock,
  type Rhythm,
} from "@/lib/streaks";
import type { Achievement } from "@/lib/types";
import {
  awardAchievements,
  type AwardedAchievement,
} from "@/lib/app/achievements";
import { fail, type AppClients, type AppUser, type Result } from "@/lib/app/result";

/**
 * Lesson completion and the per-user progress reads, shared by:
 *   - setLessonComplete (src/app/actions/progress.ts), the website's door;
 *   - GET /api/me/progress, the website's per-reader layer;
 *   - POST/DELETE /api/app/progress/complete and GET /api/app/me/progress,
 *     the native app's doors.
 *
 * The rules (quiz gate, both rate limits, achievements, funnel events,
 * revalidation) exist once, here.
 */

const PAGE = 1000;

/* ------------------------------------------------------------------ */
/*  Completing and un-completing a lesson                              */
/* ------------------------------------------------------------------ */

export type CompleteInput = {
  lessonId: string;
  /** One answer index per quiz question, in order. */
  answers?: unknown;
  /** The lesson's department slug, when the caller already knows it. */
  deptSlug?: string;
};

export type CompleteOutcome = {
  /** False when the lesson was already complete (nothing new was recorded). */
  inserted: boolean;
  completedCount: number;
  newAchievements: AwardedAchievement[];
};

type LessonGateRow = {
  quiz: { answer: number }[] | null;
  modules: { departments: { slug: string } | null } | null;
};

/**
 * Record a lesson as complete for a verified user.
 *
 * The quiz gate and rate limits run first; only then is the row written, with
 * the service-role client scoped to `user.id` (never an id from the request),
 * so the direct `authenticated` INSERT on lesson_progress can be revoked
 * without breaking either door. XP is awarded by the on_lesson_completed
 * trigger, never here.
 */
export async function completeLesson(
  user: AppUser,
  { supabase, admin }: AppClients,
  input: CompleteInput
): Promise<Result<CompleteOutcome>> {
  const { lessonId } = input;

  // Server-enforced quiz gate: if the lesson has a quiz, it only counts as
  // complete when every answer is correct. Verified here, not just in the UI,
  // so a completion can't be recorded by calling a door directly.
  const { data: lessonData, error: lessonError } = await supabase
    .from("lessons")
    .select("quiz, modules(departments(slug))")
    .eq("id", lessonId)
    .maybeSingle();
  // Fail closed: a lesson that can't be read can't have its quiz checked.
  if (lessonError) return fail("server", "Couldn't save that. Try again.");
  if (!lessonData) return fail("not_found", "We couldn't find that lesson.");
  const lesson = lessonData as unknown as LessonGateRow;
  const quiz = lesson.quiz ?? [];
  if (quiz.length > 0) {
    const a = Array.isArray(input.answers) ? (input.answers as unknown[]) : [];
    const allCorrect =
      a.length === quiz.length && quiz.every((q, i) => a[i] === q.answer);
    if (!allCorrect)
      return fail(
        "validation",
        "Answer every quiz question correctly to complete this lesson."
      );
  }

  // Leaderboard integrity: a real learner reads before completing, so no one
  // legitimately marks dozens of lessons done per minute. Cap the rate per
  // user (keyed to their id, not just IP) so the board can't be farmed by a
  // script hammering a door. XP itself is trigger-computed and not
  // user-writable, so this is defense-in-depth against automated completion.
  if (!(await rateLimit("lesson-complete", 12, 60, user.id)))
    return fail(
      "rate_limited",
      "You're completing lessons unusually fast. Take a breather and try again in a minute.",
      60
    );
  if (!(await rateLimit("lesson-complete-hourly", 120, 3600, user.id)))
    return fail(
      "rate_limited",
      "You're completing lessons unusually fast. Take a breather and try again in a minute.",
      3600
    );

  const { data: insertedRows, error } = await admin
    .from("lesson_progress")
    .upsert(
      { user_id: user.id, lesson_id: lessonId },
      { onConflict: "user_id,lesson_id", ignoreDuplicates: true }
    )
    .select("lesson_id");
  if (error) {
    console.error("completeLesson:", error.message);
    return fail("server", "Couldn't save that. Try again.");
  }
  const inserted = (insertedRows ?? []).length > 0;

  const { completedCount, newAchievements } = await awardAchievements(admin, user.id);

  // ---- Activation funnel ------------------------------------------------
  // Recorded HERE rather than from a client: this is the point at which a
  // completion is a server-verified fact (the quiz gate has passed and the row
  // is in lesson_progress), so the event cannot be minted by anyone POSTing at
  // /api/funnel-event. recordFunnelEvent never throws and treats a repeat as
  // success, so neither call can fail a completion. Awaited because a
  // serverless invocation can be frozen the moment the response is sent.
  //
  // `completedCount` comes from awardAchievements' paged read, so the >= 2
  // test is exact.
  await recordFunnelEvent({ step: "lesson_completed", userId: user.id });
  if (completedCount >= 2)
    await recordFunnelEvent({ step: "second_lesson_completed", userId: user.id });

  revalidateAfterProgress(input.deptSlug ?? lesson.modules?.departments?.slug);
  return { ok: true, inserted, completedCount, newAchievements };
}

/**
 * Un-complete a lesson. The on_lesson_uncompleted trigger refunds the XP that
 * row awarded. Achievements are never taken away. Deleted through the user's
 * own client (lp_delete_own), exactly as the website always has.
 */
export async function uncompleteLesson(
  user: AppUser,
  { supabase }: AppClients,
  input: { lessonId: string; deptSlug?: string }
): Promise<Result> {
  const { error } = await supabase
    .from("lesson_progress")
    .delete()
    .eq("user_id", user.id)
    .eq("lesson_id", input.lessonId);
  if (error) {
    console.error("uncompleteLesson:", error.message);
    return fail("server", "Couldn't save that. Try again.");
  }

  let deptSlug = input.deptSlug;
  if (deptSlug === undefined) {
    const { data } = await supabase
      .from("lessons")
      .select("modules(departments(slug))")
      .eq("id", input.lessonId)
      .maybeSingle();
    deptSlug = (data as unknown as Pick<LessonGateRow, "modules"> | null)?.modules
      ?.departments?.slug;
  }
  revalidateAfterProgress(deptSlug);
  return { ok: true };
}

function revalidateAfterProgress(deptSlug: string | undefined) {
  if (deptSlug) revalidatePath(`/guides/${deptSlug}`);
  revalidatePath("/dashboard");
}

/* ------------------------------------------------------------------ */
/*  Reads                                                              */
/* ------------------------------------------------------------------ */

/** One lesson_progress row, trimmed to what the progress views need. */
export type CompletionRow = {
  lesson_id: string;
  completed_at: string | null;
  xp_awarded: number | null;
};

/**
 * Every completion row for a reader, oldest first, paged.
 *
 * PostgREST caps a select at 1000 rows and does it SILENTLY: no error, no flag,
 * just a short array. A learner past 1000 lessons would have had the tail of
 * their history quietly dropped, which takes ticks off lessons they finished and
 * under-counts the rhythm. The loop costs one extra round trip only when it
 * actually needs one.
 */
export async function readCompletions(
  supabase: SupabaseClient,
  userId: string
): Promise<CompletionRow[]> {
  const out: CompletionRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("lesson_progress")
      .select("lesson_id, completed_at, xp_awarded")
      .eq("user_id", userId)
      .order("completed_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) break;
    const chunk = (data ?? []) as CompletionRow[];
    out.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return out;
}

/** A reader's bookmarks, oldest first, paged. */
export async function readBookmarks(
  supabase: SupabaseClient,
  userId: string
): Promise<{ lesson_id: string; created_at: string | null }[]> {
  const out: { lesson_id: string; created_at: string | null }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("bookmarks")
      .select("lesson_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) break;
    const chunk = (data ?? []) as { lesson_id: string; created_at: string | null }[];
    out.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return out;
}

export type EarnedRow = {
  achievement_id: string;
  earned_at: string | null;
  slug: string | null;
};

/**
 * The badges a user holds. Service-role, scoped to the verified id, so it
 * doesn't lean on the `authenticated` SELECT grant on user_achievements.
 */
export async function readEarnedAchievements(
  admin: SupabaseClient,
  userId: string
): Promise<EarnedRow[]> {
  const { data } = await admin
    .from("user_achievements")
    .select("achievement_id, earned_at, achievements(slug)")
    .eq("user_id", userId)
    .order("earned_at", { ascending: true });
  return ((data ?? []) as unknown as {
    achievement_id: string;
    earned_at: string | null;
    achievements: { slug: string } | { slug: string }[] | null;
  }[]).map((r) => {
    const a = Array.isArray(r.achievements) ? r.achievements[0] : r.achievements;
    return { achievement_id: r.achievement_id, earned_at: r.earned_at, slug: a?.slug ?? null };
  });
}

/** The completed-lesson id set and the week rhythm, from one read of the rows. */
export function rhythmFromCompletions(
  rows: readonly Pick<CompletionRow, "lesson_id" | "completed_at">[],
  createdAt: string | null | undefined,
  now: number
): { completed: Set<string>; rhythm: Rhythm } {
  // One read, two derivations: the id set the ticks need, and the timestamps the
  // rhythm needs. lesson_progress is one row per completed lesson, so a distinct
  // id set and a raw timestamp list are both correct reads of the same rows.
  const completed = new Set<string>();
  const completedAt: string[] = [];
  for (const r of rows) {
    if (r.lesson_id) completed.add(r.lesson_id);
    if (r.completed_at) completedAt.push(r.completed_at);
  }
  const rhythm = computeRhythm({ completedAt, createdAt: createdAt ?? null, now });
  return { completed, rhythm };
}

export type NextUnlockPayload = {
  name: string;
  description: string;
  icon: string;
  progress: { current: number; target: number; unit: string };
};

/**
 * The nearest badge a learner can still reach, or null.
 *
 * Only lesson-count badges are eligible. See isNudgeableCriteria in
 * src/lib/streaks.ts for why a streak badge is deliberately never dangled.
 *
 * Pass `earned` when the caller has already read the user's badges; otherwise
 * they are read through `supabase`.
 */
export async function readNextUnlock(
  supabase: SupabaseClient,
  userId: string,
  lessonsDone: number,
  earned?: ReadonlySet<string>
): Promise<NextUnlockPayload | null> {
  const [catalogRes, earnedRes] = await Promise.all([
    supabase
      .from("achievements")
      .select("id, slug, name, description, icon, criteria, sort_order")
      .order("sort_order"),
    earned
      ? Promise.resolve(null)
      : supabase.from("user_achievements").select("achievement_id").eq("user_id", userId),
  ]);

  const catalog = (catalogRes.data as Achievement[] | null) ?? [];
  if (catalog.length === 0) return null;
  const have =
    earned ??
    new Set(
      ((earnedRes?.data as { achievement_id: string }[] | null) ?? []).map(
        (r) => r.achievement_id
      )
    );

  const candidates = catalog.map((a) => ({
    a,
    earned: have.has(a.id),
    progress: isNudgeableCriteria(a.criteria)
      ? achievementProgress(a.criteria, {
          lessons: lessonsDone,
          // Not computable from a per-request progress read, and never shown:
          // isNudgeableCriteria already excluded both of these types.
          departments: 0,
          streak: 0,
        })
      : null,
  }));

  const next = pickNextUnlock(candidates);
  if (!next?.progress) return null;
  return {
    name: next.a.name,
    description: next.a.description,
    icon: next.a.icon,
    progress: next.progress,
  };
}
