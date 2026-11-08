import { apiError } from "@/lib/app/http";

export const dynamic = "force-dynamic";

/**
 * PUT /api/app/admin/lessons/{lessonId}/verified: retired.
 *
 * Lessons no longer carry a verified mark, on the site or in the app, so
 * nothing can put one on. The route stays only so an older app copy that still
 * shows the admin control gets a sentence it can print ("Could not save: ...")
 * instead of a bare 404, which it would read as "this site has no admin
 * tools". It writes nothing and reads nothing, so it needs no session.
 *
 * `lessons.verified_at` and its neighbours stay in the table: installed app
 * copies still select them. See apple/docs/API.md.
 */
export async function PUT() {
  return apiError("not_found", "Lessons don't carry a verified mark any more.", {
    status: 410,
  });
}
