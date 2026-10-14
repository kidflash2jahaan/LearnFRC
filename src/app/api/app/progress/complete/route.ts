import type { NextRequest } from "next/server";
import { completeLesson, uncompleteLesson } from "@/lib/app/progress";
import { loadStateAfterWrite } from "@/lib/app/me";
import { clientsFor } from "@/lib/app/result";
import {
  apiError,
  badJson,
  fromFailure,
  guarded,
  isUuid,
  ok,
  readJsonObject,
  requireAppUser,
} from "@/lib/app/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/app/progress/complete { lessonId, answers }
 *
 * Completes a lesson through completeLesson (src/lib/app/progress.ts), the
 * same function the website's setLessonComplete calls: the server re-grades
 * the quiz, applies both rate limits, writes the row, awards XP (trigger) and
 * badges, and records the funnel events. The response carries the real XP
 * the lesson earned, so the app never guesses it.
 */
export async function POST(req: NextRequest) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const body = await readJsonObject(req);
    if (!body) return badJson();
    if (!isUuid(body.lessonId)) return apiError("validation", "That lesson id isn't valid.");
    const lessonId = body.lessonId;

    const clients = clientsFor(auth.supabase);
    const result = await completeLesson(auth.user, clients, {
      lessonId,
      answers: body.answers,
    });
    if (!result.ok) return fromFailure(result);

    const state = await loadStateAfterWrite(auth.user, clients, lessonId);
    return ok({
      ok: true,
      alreadyCompleted: !result.inserted,
      // Nothing new was earned when the lesson was already complete.
      xpAwarded: result.inserted ? (state.lessonXp ?? 0) : 0,
      xp: state.xp,
      level: state.level,
      newAchievements: result.newAchievements,
      completedCount: state.completedCount,
      rhythm: state.rhythm,
      rhythmCopy: state.rhythmCopy,
      rhythmMicrocopy: state.rhythmMicrocopy,
    });
  });
}

/**
 * DELETE /api/app/progress/complete?lessonId=<uuid>
 *
 * Marks a lesson not complete, through the same uncompleteLesson the website
 * uses. The trigger refunds the XP that completion earned; badges stay.
 */
export async function DELETE(req: NextRequest) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const lessonId = req.nextUrl.searchParams.get("lessonId");
    if (!isUuid(lessonId)) return apiError("validation", "That lesson id isn't valid.");

    const clients = clientsFor(auth.supabase);
    const result = await uncompleteLesson(auth.user, clients, { lessonId });
    if (!result.ok) return fromFailure(result);

    const state = await loadStateAfterWrite(auth.user, clients, lessonId);
    return ok({
      ok: true,
      xp: state.xp,
      level: state.level,
      completedCount: state.completedCount,
      rhythm: state.rhythm,
      rhythmCopy: state.rhythmCopy,
      rhythmMicrocopy: state.rhythmMicrocopy,
    });
  });
}
