import { setLessonVerifiedAs } from "@/lib/app/admin-content";
import {
  badJson,
  fromFailure,
  guarded,
  ok,
  readJsonObject,
  requireAppUser,
} from "@/lib/app/http";

export const dynamic = "force-dynamic";

/**
 * PUT /api/app/admin/lessons/{lessonId}/verified { verified: boolean }
 *
 * Puts the public verified mark on a lesson, or takes it off, through
 * setLessonVerifiedAs (src/lib/app/admin-content.ts), the function the lesson
 * page's button calls. Records who checked it (their handle) and refreshes the
 * lesson, catalog and /fact-check caches. Admins only.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const body = await readJsonObject(req);
    if (!body) return badJson();
    const { lessonId } = await params;
    const result = await setLessonVerifiedAs(auth.user, {
      lessonId: lessonId.toLowerCase(),
      verified: body.verified,
    });
    if (!result.ok) return fromFailure(result);
    return ok({ ok: true, lessonId: result.lessonId, verifiedAt: result.verifiedAt });
  });
}
