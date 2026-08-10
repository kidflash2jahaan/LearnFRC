import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getBookmarkedLessonIds, isEmailSubscribed } from "@/lib/queries";
import {
  achievementProgress,
  computeRhythm,
  isNudgeableCriteria,
  pickNextUnlock,
  type Rhythm,
} from "@/lib/streaks";
import type { Achievement } from "@/lib/types";

export const dynamic = "force-dynamic";

// Per-user progress for the (now static/ISR) guides pages. The department and
// lesson pages render their full content statically for crawlers; the signed-in
// progress UI — completed checkmarks, continue/next state, mastery rings,
// bookmarks, the completion card — hydrates from this route after mount (the
// same client-fetch pattern the Navbar already uses via /api/me). Everything
// here is session-scoped and never cached.
//
// THE CLOCK LIVES HERE. This route is also where the week-rhythm (five lessons
// in seven days) is computed, and that is not an accident of convenience: every
// surface that renders the rhythm — the department page card, the lesson
// reading rail — is a STATIC page whose HTML is shared by every visitor and
// every crawler. There is no per-user server render to compute "days since" in.
// So `computeRhythm` is called here, on the server, with the SERVER's
// `Date.now()`, and the finished plain object is shipped to the client. The
// components never touch a clock; they render a prop. See the hydration note in
// src/lib/streaks.ts.

/** One `lesson_progress` row, trimmed to what the rhythm and the id set need. */
type ProgressRow = { lesson_id: string; completed_at: string | null };

/**
 * Every completion row for a user, paged.
 *
 * PostgREST caps a select at 1000 rows and does it SILENTLY — no error, no
 * flag, just a short array. A learner who has cleared more than 1000 lessons
 * would previously have had the tail of their history quietly dropped, which
 * would take checkmarks off lessons they finished and under-count the rhythm.
 * The corpus is not that big today; the loop costs one extra round trip only
 * when it actually needs one, and it will not rot.
 */
async function readCompletions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<ProgressRow[]> {
  const PAGE = 1000;
  const out: ProgressRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("lesson_progress")
      .select("lesson_id, completed_at")
      .eq("user_id", userId)
      .order("completed_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) break;
    const chunk = (data ?? []) as ProgressRow[];
    out.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return out;
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
 * Only lesson-count badges are eligible — see `isNudgeableCriteria` in
 * src/lib/streaks.ts for why a streak badge is deliberately never dangled.
 */
async function readNextUnlock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  lessonsDone: number
): Promise<NextUnlockPayload | null> {
  const [catalogRes, earnedRes] = await Promise.all([
    supabase
      .from("achievements")
      .select("id, slug, name, description, icon, criteria, sort_order")
      .order("sort_order"),
    supabase.from("user_achievements").select("achievement_id").eq("user_id", userId),
  ]);

  const catalog = (catalogRes.data as Achievement[] | null) ?? [];
  if (catalog.length === 0) return null;
  const earned = new Set(
    ((earnedRes.data as { achievement_id: string }[] | null) ?? []).map(
      (r) => r.achievement_id
    )
  );

  const candidates = catalog.map((a) => ({
    a,
    earned: earned.has(a.id),
    progress: isNudgeableCriteria(a.criteria)
      ? achievementProgress(a.criteria, {
          lessons: lessonsDone,
          // Not computable from a per-request progress read, and never shown
          // (isNudgeableCriteria already excluded both of these types).
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

export type MyProgressPayload = {
  authed: boolean;
  completedLessonIds: string[];
  bookmarkedLessonIds: string[];
  username: string | null;
  subscribed: boolean;
  /** Server-computed week rhythm. Null for signed-out readers. */
  rhythm: Rhythm | null;
  nextUnlock: NextUnlockPayload | null;
};

const SIGNED_OUT: MyProgressPayload = {
  authed: false,
  completedLessonIds: [],
  bookmarkedLessonIds: [],
  username: null,
  subscribed: false,
  rhythm: null,
  nextUnlock: null,
};

export async function GET() {
  const { user, profile } = await getSession();
  if (!user) {
    return NextResponse.json(SIGNED_OUT, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const supabase = await createClient();
  const [rows, bookmarks, subscribed] = await Promise.all([
    readCompletions(supabase, user.id),
    getBookmarkedLessonIds(user.id),
    user.email ? isEmailSubscribed(user.email) : Promise.resolve(false),
  ]);

  // One read, two derivations: the id set the checkmarks need and the
  // timestamps the rhythm needs. (`lesson_progress` is one row per completed
  // lesson, so a distinct id set and a raw timestamp list are both correct
  // reads of the same rows.)
  const completed = new Set<string>();
  const completedAt: string[] = [];
  for (const r of rows) {
    if (r.lesson_id) completed.add(r.lesson_id);
    if (r.completed_at) completedAt.push(r.completed_at);
  }

  const rhythm = computeRhythm({
    completedAt,
    createdAt: profile?.created_at ?? null,
    // Server clock, once, here. Never in a component.
    now: Date.now(),
  });

  const payload: MyProgressPayload = {
    authed: true,
    // Global completion set — `has()` covers per-department lookups, and the
    // pages derive per-department counts from the lesson ids already on page.
    completedLessonIds: [...completed],
    bookmarkedLessonIds: [...bookmarks],
    username: profile?.username ?? null,
    subscribed,
    rhythm,
    nextUnlock: await readNextUnlock(supabase, user.id, completed.size),
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
