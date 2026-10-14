import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { awardAchievements } from "@/lib/app/achievements";
import type { AppUser } from "@/lib/app/result";

/**
 * Carries a guest's lesson completions into the account they just made or
 * signed in to: insert the missing lesson_progress rows, keeping the dates they
 * actually earned, award the achievements those lessons unlock, and clear the
 * guest rows. Shared by the website's POST /api/migrate-guest and the app's
 * POST /api/app/migrate-guest.
 *
 * Two things this deliberately does NOT do.
 *
 * It does not trust the request body. It migrates the rows the SERVER holds in
 * guest_progress for this visitor id, and those only get there through
 * /api/guest-progress's quiz gate. An older version inserted whatever lesson
 * ids the caller posted, so any signed-in user could post all 394 ids and mint
 * 394 completions plus the XP and leaderboard rank that come with them.
 *
 * It does not touch profiles.xp. The on_lesson_completed trigger already awards
 * XP on every lesson_progress insert. An older version added another 10 per
 * lesson on top, so every migration paid out roughly double.
 *
 * THREAT MODEL for the unbound visitorId, reviewed 2026-08-10 and accepted.
 * Nothing cryptographically ties this id to the caller: it is a random UUID the
 * client keeps (localStorage on the website, the Keychain in the app), so in
 * principle a signed-in user could post somebody else's id and claim their
 * guest completions. Three things make that unreachable in practice.
 *   1. Visitor ids cannot be enumerated. RLS returns [] to anon and to ordinary
 *      authenticated reads of guest_progress, so the id never leaves the
 *      owner's device.
 *   2. Guessing is infeasible: a v4 UUID against the 30 per hour limit below.
 *   3. The payoff is a handful of free lesson completions, which any visitor
 *      can earn honestly in minutes.
 */

const PAGE = 1000;

export type GuestMigration =
  | { status: "ok"; migrated: number; xp: number; lessonIds: string[] }
  | { status: "rate_limited" }
  | { status: "error" };

/** Reduce an untrusted visitor id to what the guest tables store, or "". */
export function normalizeVisitorId(raw: unknown): string {
  return typeof raw === "string" ? raw.slice(0, 64) : "";
}

export async function migrateGuestProgress(
  user: AppUser,
  rawVisitorId: unknown
): Promise<GuestMigration> {
  const visitorId = normalizeVisitorId(rawVisitorId);
  if (!visitorId) return { status: "ok", migrated: 0, xp: 0, lessonIds: [] };

  if (!(await rateLimit("migrate-guest", 30, 3600, user.id)))
    return { status: "rate_limited" };

  const admin = createAdminClient();

  // The server's record of what this visitor completed as a guest, oldest first
  // so the streak the XP trigger computes walks forward the way it did when they
  // earned it. Paged, because PostgREST truncates at 1000 rows silently.
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
  if (!guest.length) return { status: "ok", migrated: 0, xp: 0, lessonIds: [] };

  const lessonIds = [...new Set(guest.map((g) => g.lesson_id))];

  // Do not double-insert lessons the account already has.
  const have = new Set<string>();
  for (let i = 0; i < lessonIds.length; i += 200) {
    const { data } = await admin
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", user.id)
      .in("lesson_id", lessonIds.slice(i, i + 200));
    for (const r of (data ?? []) as { lesson_id: string }[]) have.add(r.lesson_id);
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
      // Keep the date they actually earned it. Stamping everything now() would
      // collapse a fortnight of learning into one day and erase the streak the
      // trigger reads back out of these rows.
      completed_at: g.completed_at,
    }));

  let migrated = 0;
  let xp = 0;
  if (toInsert.length) {
    const { error } = await admin.from("lesson_progress").insert(toInsert);
    if (error) return { status: "error" };
    migrated = toInsert.length;

    // XP is trigger computed by on_lesson_completed, so read back what it
    // awarded rather than adding a second, conflicting amount here.
    const migratedIds = toInsert.map((r) => r.lesson_id);
    for (let i = 0; i < migratedIds.length; i += 200) {
      const { data } = await admin
        .from("lesson_progress")
        .select("xp_awarded")
        .eq("user_id", user.id)
        .in("lesson_id", migratedIds.slice(i, i + 200));
      for (const r of (data ?? []) as { xp_awarded: number }[]) xp += r.xp_awarded ?? 0;
    }

    await awardAchievements(admin, user.id);
  }

  // The guest rows are redundant now, the account owns this progress.
  await admin.from("guest_progress").delete().eq("visitor", visitorId);

  return { status: "ok", migrated, xp, lessonIds: [...seen] };
}
