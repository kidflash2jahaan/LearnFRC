import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Guest (no-account) lesson progress, keyed to the anonymous visitor id.
 *
 * This is not just a mirror of localStorage any more: it is the ONLY copy
 * /api/migrate-guest will carry into a real account, because a client-supplied
 * list of lesson ids is not evidence that anyone did the lessons. So the quiz
 * gate is enforced here exactly as `setLessonComplete` enforces it for signed-in
 * readers — same rule, same server, no account required. `quiz_passed` is then
 * a fact rather than a claim, and "sign up and keep your progress" is a promise
 * the migration can actually honour.
 *
 * Anonymous + rate-limited; service-role writes (guest_progress is RLS-locked
 * with no public policies).
 */

/** The visitor's completed lesson ids — the set that will migrate at signup. */
export async function GET(req: Request) {
  const visitor = (
    new URL(req.url).searchParams.get("visitorId") || ""
  ).slice(0, 64);
  if (!visitor)
    return NextResponse.json({ lessonIds: [] }, { headers: NO_STORE });

  if (!(await rateLimit("guest-progress-read", 240, 3600)))
    return NextResponse.json({ lessonIds: [] }, { headers: NO_STORE });

  const admin = createAdminClient();
  // Paged: PostgREST silently truncates any select at 1000 rows. A single
  // visitor cannot realistically exceed that today (394 lessons), but the
  // catalogue grows and a silent truncation here would quietly drop lessons
  // out of someone's migration.
  const PAGE = 1000;
  const ids: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await admin
      .from("guest_progress")
      .select("lesson_id")
      .eq("visitor", visitor)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    const chunk = (data ?? []) as { lesson_id: string }[];
    for (const r of chunk) ids.push(r.lesson_id);
    if (chunk.length < PAGE) break;
  }
  return NextResponse.json({ lessonIds: ids }, { headers: NO_STORE });
}

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
  const answers = Array.isArray(body.answers)
    ? (body.answers as unknown[]).map((n) => (typeof n === "number" ? n : -1))
    : null;

  // 429, not a silent 204: the client parks unconfirmed writes in a retry queue
  // and needs to be able to tell "saved" from "dropped". The old 204-on-limit
  // was indistinguishable from success, so a throttled completion looked saved
  // and then vanished at signup.
  if (!(await rateLimit("guest-progress", 120, 3600)))
    return new NextResponse(null, { status: 429, headers: NO_STORE });

  const admin = createAdminClient();

  if (!complete) {
    await admin
      .from("guest_progress")
      .delete()
      .eq("visitor", visitor)
      .eq("lesson_id", lessonId);
    return NextResponse.json({ saved: false }, { headers: NO_STORE });
  }

  // ---- Server-enforced quiz gate (same rule as src/app/actions/progress.ts) --
  const { data: lesson } = await admin
    .from("lessons")
    .select("quiz")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) return new NextResponse(null, { status: 404, headers: NO_STORE });

  const quiz = (lesson.quiz as { answer: number }[] | null) ?? [];
  let quizPassed = false;
  if (quiz.length > 0) {
    const verified =
      !!answers &&
      answers.length === quiz.length &&
      quiz.every((q, i) => answers[i] === q.answer);
    if (verified) {
      quizPassed = true;
    } else {
      // No answers (a retry from the pending queue, or a stale client) — accept
      // it only if this visitor already has a verified row for the lesson.
      const { data: existing } = await admin
        .from("guest_progress")
        .select("quiz_passed")
        .eq("visitor", visitor)
        .eq("lesson_id", lessonId)
        .maybeSingle();
      if (!existing?.quiz_passed)
        return NextResponse.json(
          { error: "Answer every quiz question correctly to complete this lesson." },
          { status: 422, headers: NO_STORE }
        );
      quizPassed = true;
    }
  }

  // Upsert on (visitor, lesson_id) — repeat completes are idempotent.
  const { error } = await admin
    .from("guest_progress")
    .upsert(
      { visitor, lesson_id: lessonId, quiz_passed: quizPassed },
      { onConflict: "visitor,lesson_id" }
    );
  if (error) return new NextResponse(null, { status: 500, headers: NO_STORE });

  return NextResponse.json({ saved: true }, { headers: NO_STORE });
}
