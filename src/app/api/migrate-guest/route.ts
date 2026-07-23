import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Migrate a guest's on-device lesson completions into their now-signed-in
 * account: insert the missing lesson_progress rows, award the XP, and clear the
 * guest rows. Called by <GuestMigration/> once, right after a guest signs up.
 */
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
    return new NextResponse(null, { status: 400 });
  }

  const lessonIds = Array.isArray(body.lessonIds)
    ? (body.lessonIds as unknown[])
        .filter((id): id is string => typeof id === "string" && UUID.test(id))
        .slice(0, 500)
    : [];
  const visitorId =
    typeof body.visitorId === "string" ? body.visitorId.slice(0, 64) : null;
  if (!lessonIds.length) return NextResponse.json({ migrated: 0 });

  const admin = createAdminClient();

  // Don't double-insert lessons the account already has.
  const { data: existing } = await admin
    .from("lesson_progress")
    .select("lesson_id")
    .eq("user_id", user.id)
    .in("lesson_id", lessonIds);
  const have = new Set((existing ?? []).map((r) => r.lesson_id as string));
  const now = new Date().toISOString();
  const toInsert = lessonIds
    .filter((id) => !have.has(id))
    .map((id) => ({ user_id: user.id, lesson_id: id, completed_at: now }));

  if (toInsert.length) {
    await admin.from("lesson_progress").insert(toInsert);
    // +10 XP per newly-migrated lesson, matching a normal completion.
    const { data: prof } = await admin
      .from("profiles")
      .select("xp")
      .eq("id", user.id)
      .maybeSingle();
    await admin
      .from("profiles")
      .update({ xp: ((prof?.xp as number) ?? 0) + toInsert.length * 10 })
      .eq("id", user.id);
  }

  // The guest rows are now redundant.
  if (visitorId)
    await admin.from("guest_progress").delete().eq("visitor", visitorId);

  return NextResponse.json({ migrated: toInsert.length });
}
