import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const PAGE = 1000;
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Carry a guest's lesson completions into their now-signed-in account: insert
 * the missing lesson_progress rows (keeping the dates they actually earned),
 * award the achievements those lessons unlock, and clear the guest rows.
 *
 * Two things this deliberately does NOT do:
 *
 *  - It does not trust the request body. It migrates the rows the SERVER holds
 *    in `guest_progress` for this visitor id, which only get there through
 *    /api/guest-progress's quiz gate. The old version inserted whatever lesson
 *    ids the caller posted, so any signed-in user could POST all 394 ids and
 *    mint 394 completions plus the XP and leaderboard rank that come with them,
 *    bypassing the quiz check that `setLessonComplete` enforces.
 *
 *  - It does not touch `profiles.xp`. The `on_lesson_completed` trigger already
 *    awards XP on every lesson_progress insert; the old version added another
 *    10/lesson on top, so every migration paid out roughly double and inflated
 *    the leaderboard. Letting the trigger own XP is also what makes the "+10 XP
 *    per lesson" line in the signup ask literally true.
 */

/** Mirrors awardAchievements() in src/app/actions/progress.ts — a migrated
 *  learner should hold exactly the badges their lessons earned, otherwise the
 *  first thing they see after signing up is a zeroed achievements panel next to
 *  a full progress bar. */
async function awardAchievements(admin: SupabaseClient, userId: string) {
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

  // Current streak, same definition as the progress action.
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const days = new Set<string>();
  for (const ts of stamps) {
    const d = new Date(ts);
    if (!Number.isNaN(d.getTime())) days.add(key(d));
  }
  const DAY = 86_400_000;
  let streak = 0;
  if (days.size) {
    const today = new Date();
    if (days.has(key(today)) || days.has(key(new Date(today.getTime() - DAY)))) {
      const cur = new Date(today);
      if (!days.has(key(cur))) cur.setTime(cur.getTime() - DAY);
      while (days.has(key(cur))) {
        streak++;
        cur.setTime(cur.getTime() - DAY);
      }
    }
  }

  // lesson -> department, to count fully-finished departments.
  const totals: Record<string, number> = {};
  const done: Record<string, number> = {};
  for (let from = 0; ; from += PAGE) {
    const { data } = await admin
      .from("lessons")
      .select("id, modules(department_id)")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    const chunk = (data ?? []) as {
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

  const { data: achievements } = await admin
    .from("achievements")
    .select("id, criteria");
  const { data: have } = await admin
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", userId);
  const haveSet = new Set((have ?? []).map((h) => h.achievement_id as string));

  const toInsert: { user_id: string; achievement_id: string }[] = [];
  for (const a of achievements ?? []) {
    const id = a.id as string;
    if (haveSet.has(id)) continue;
    const c = (a.criteria ?? {}) as { type?: string; count?: number; days?: number };
    if (
      (c.type === "lessons" && completedCount >= (c.count ?? Infinity)) ||
      (c.type === "departments" && fullDepts >= (c.count ?? Infinity)) ||
      (c.type === "streak" && streak >= (c.days ?? Infinity))
    )
      toInsert.push({ user_id: userId, achievement_id: id });
  }
  if (toInsert.length)
    await admin.from("user_achievements").insert(toInsert);
  return toInsert.length;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* body is optional — visitorId is the only thing we read */
  }

  // THREAT MODEL for this unbound visitorId (reviewed 2026-08-10, accepted).
  // Nothing cryptographically ties this id to the caller: it is a client-side
  // crypto.randomUUID() kept in localStorage (see page-view-beacon.tsx), so in
  // principle a signed-in user could post someone else's id and claim their
  // guest completions. Three things make that unreachable in practice:
  //   1. Visitor ids cannot be enumerated. RLS returns [] to anon and ordinary
  //      authenticated reads of both page_views and guest_progress, so the id
  //      never leaves the owner's browser.
  //   2. Guessing is infeasible — a v4 UUID against the 30/hour rate limit below.
  //   3. The payoff is a handful of free lesson completions, which any visitor
  //      can earn honestly in minutes.
  // Binding it to a server-set httpOnly cookie is the real fix and is worth
  // doing if guest mode ever carries anything of value; it is not worth
  // destabilising the guest flow for today.
  const visitorId =
    typeof body.visitorId === "string" ? body.visitorId.slice(0, 64) : "";
  if (!visitorId)
    return NextResponse.json(
      { migrated: 0, xp: 0, lessonIds: [] },
      { headers: NO_STORE }
    );

  if (!(await rateLimit("migrate-guest", 30, 3600, user.id)))
    return NextResponse.json(
      { migrated: 0, xp: 0, lessonIds: [] },
      { status: 429, headers: NO_STORE }
    );

  const admin = createAdminClient();

  // The server's record of what this visitor completed as a guest, oldest
  // first so the streak the XP trigger computes walks forward the way it did
  // when they earned it. Paged — PostgREST truncates at 1000 rows silently.
  const guest: { lesson_id: string; completed_at: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await admin
      .from("guest_progress")
      .select("lesson_id, completed_at")
      .eq("visitor", visitorId)
      .order("completed_at", { ascending: true })
      .range(from, from + PAGE - 1);
    const chunk = (data ?? []) as { lesson_id: string; completed_at: string }[];
    guest.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  if (!guest.length)
    return NextResponse.json(
      { migrated: 0, xp: 0, lessonIds: [] },
      { headers: NO_STORE }
    );

  const lessonIds = [...new Set(guest.map((g) => g.lesson_id))];

  // Don't double-insert lessons the account already has.
  const have = new Set<string>();
  for (let i = 0; i < lessonIds.length; i += 200) {
    const { data } = await admin
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", user.id)
      .in("lesson_id", lessonIds.slice(i, i + 200));
    for (const r of (data ?? []) as { lesson_id: string }[])
      have.add(r.lesson_id);
  }

  const seen = new Set<string>();
  const toInsert = guest
    .filter((g) => {
      if (have.has(g.lesson_id) || seen.has(g.lesson_id)) return false;
      seen.add(g.lesson_id);
      return true;
    })
    .map((g) => ({
      user_id: user.id,
      lesson_id: g.lesson_id,
      // Keep the date they actually earned it. Stamping everything `now()`
      // would collapse a fortnight of learning into one day and erase the
      // streak the trigger reads back out of these rows.
      completed_at: g.completed_at,
    }));

  let migrated = 0;
  let xp = 0;
  if (toInsert.length) {
    const { error } = await admin.from("lesson_progress").insert(toInsert);
    if (error)
      return NextResponse.json(
        { migrated: 0, xp: 0, lessonIds: [] },
        { status: 500, headers: NO_STORE }
      );
    migrated = toInsert.length;

    // XP is trigger-computed (on_lesson_completed) — read back what it awarded
    // rather than adding a second, conflicting amount here.
    const migratedIds = toInsert.map((r) => r.lesson_id);
    for (let i = 0; i < migratedIds.length; i += 200) {
      const { data } = await admin
        .from("lesson_progress")
        .select("xp_awarded")
        .eq("user_id", user.id)
        .in("lesson_id", migratedIds.slice(i, i + 200));
      for (const r of (data ?? []) as { xp_awarded: number }[])
        xp += r.xp_awarded ?? 0;
    }

    await awardAchievements(admin, user.id);
  }

  // The guest rows are now redundant — the account owns this progress.
  await admin.from("guest_progress").delete().eq("visitor", visitorId);

  return NextResponse.json(
    { migrated, xp, lessonIds: [...seen] },
    { headers: NO_STORE }
  );
}
