import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guest (no-account) lesson progress, keyed to the anonymous visitor id. Mirrors
 * the browser's localStorage so completions survive across sessions on the same
 * device, feed the admin totals, and can be migrated into a real account on
 * signup. Anonymous + rate-limited; service-role insert (guest_progress is
 * RLS-locked with no public policies).
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const visitor =
    typeof body.visitorId === "string" && body.visitorId.length <= 64
      ? body.visitorId
      : "";
  const lessonId = typeof body.lessonId === "string" ? body.lessonId : "";
  if (!visitor || !UUID.test(lessonId))
    return new NextResponse(null, { status: 400 });

  const complete = body.complete !== false; // default true
  const quizPassed = body.quizPassed === true;

  if (!(await rateLimit("guest-progress", 120, 3600)))
    return new NextResponse(null, { status: 204 });

  const admin = createAdminClient();
  if (complete) {
    // Upsert on (visitor, lesson_id) — repeat completes are idempotent.
    await admin
      .from("guest_progress")
      .upsert(
        { visitor, lesson_id: lessonId, quiz_passed: quizPassed },
        { onConflict: "visitor,lesson_id" }
      );
  } else {
    await admin
      .from("guest_progress")
      .delete()
      .eq("visitor", visitor)
      .eq("lesson_id", lessonId);
  }
  return new NextResponse(null, { status: 204 });
}
