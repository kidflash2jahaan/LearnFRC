import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordFunnelEvent } from "@/lib/funnel";
import type { SupabaseClient } from "@supabase/supabase-js";

// Presence heartbeat. Signed-in clients POST here every ~60s; we stamp the
// authenticated user's last_seen_at. Anonymous visitors are a no-op, so the
// admin "online" count only ever reflects logged-in people.
//
// It is also the only place in the product that can see a reader cross a
// calendar-day boundary, which makes it the natural home for the funnel's
// `return_visit` milestone (see recordReturnVisit below).
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response(null, { status: 204 });

  const admin = createAdminClient();
  const now = new Date();

  // Read the PREVIOUS heartbeat before overwriting it — one indexed
  // primary-key select, next to an auth round trip that already happened above.
  // Nothing else on the server can tell "first visit today" from "still here
  // from a minute ago" once this column has been stamped.
  const { data: prior } = await admin
    .from("profiles")
    .select("last_seen_at")
    .eq("id", user.id)
    .maybeSingle();

  await admin
    .from("profiles")
    .update({ last_seen_at: now.toISOString() })
    .eq("id", user.id);

  await recordReturnVisit(admin, user.id, prior?.last_seen_at ?? null, now);

  return new Response(null, { status: 204 });
}

/**
 * Funnel step `return_visit` — "came back on a later day".
 *
 * Two conditions, both required:
 *
 *  1. The previous heartbeat is on a strictly earlier UTC calendar day. Compared
 *     against the SERVER clock and stored UTC timestamps, never a client clock,
 *     so a reader with a skewed device cannot mint the step.
 *  2. They have completed at least one lesson. This one is not optional
 *     bookkeeping: funnel_summary() closes events transitively, and
 *     `return_visit` implies `lesson_completed`, `quiz_attempted` and
 *     `lesson_opened`. Recording it for someone who has never finished anything
 *     would inflate three earlier steps with people who never reached them and
 *     would break the exactness of the completion row.
 *
 * Deliberately biased toward UNDER-counting. A reader whose first completion
 * happens later on the same day they returned is not recorded until their next
 * new day, because at the moment of the heartbeat they had nothing to return to.
 * That costs a `measured` tick; funnel_summary() still derives the step exactly
 * from lesson_progress + last_seen_at, so the funnel's COUNT is unaffected. The
 * opposite bias would not be recoverable.
 */
async function recordReturnVisit(
  admin: SupabaseClient,
  userId: string,
  lastSeenAt: string | null,
  now: Date
): Promise<void> {
  if (!lastSeenAt) return;
  const prev = new Date(lastSeenAt);
  if (Number.isNaN(prev.getTime())) return;
  // ISO date halves compare correctly as strings (YYYY-MM-DD, both UTC).
  if (prev.toISOString().slice(0, 10) >= now.toISOString().slice(0, 10)) return;

  // head + exact count: no rows come back, so this cannot hit the PostgREST
  // 1000-row select truncation. Reached at most once per user per day.
  const { count } = await admin
    .from("lesson_progress")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if (!count) return;

  await recordFunnelEvent({ step: "return_visit", userId });
}
