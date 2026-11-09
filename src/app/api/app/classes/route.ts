import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/app/auth";
import { listUpcomingClasses } from "@/lib/app/classes";
import { guarded, ok, publicOk, unauthorized } from "@/lib/app/http";
import type { AppUser } from "@/lib/app/result";
import { teachUrl } from "@/lib/classes/config";

export const dynamic = "force-dynamic";

/** Bumped only if a field changes meaning. Fields are added, never renamed or removed. */
const CLASSES_FEED_VERSION = "1";

/**
 * GET /api/app/classes: the live classes list the app shows (Live now and
 * Upcoming, and the Home card). The same listing /classes renders, from the
 * same function, listUpcomingClasses in src/lib/app/classes.ts, so the two
 * can't drift: only this deployment's RealtimeKit app's classes, soonest
 * first, live and upcoming only.
 *
 * Bearer optional, like /api/app/start-plan.
 *   - Signed out: public and the same for everyone, so the CDN keeps it for 60
 *     seconds (`Vary: Authorization`, so a signed-in request never gets it).
 *     `teacher` and `enrolled` are null on every row: signed-out visitors never
 *     see a handle ("Taught by an FRC student").
 *   - With a valid token: `no-store`, the teacher's username and the viewer's
 *     enrollment on every row, and no class taught by someone the viewer
 *     blocked or who blocked the viewer.
 *   - A token that's sent but no longer valid is a 401, never a quiet fall
 *     back to the signed-out list, so the app refreshes the session instead of
 *     showing a list that ignores its blocks.
 *
 * While classes aren't visible (section 1 of the design: CLASSES_VISIBLE and
 * class_settings.classes_visible) the answer is `{ visible: false, classes: [] }`
 * and the app shows nothing about classes. Full reference: apple/docs/API.md,
 * "Live classes".
 */
export async function GET(req: Request) {
  return guarded(async () => {
    let viewer: AppUser | null = null;
    if (req.headers.has("authorization")) {
      const session = await getAppUser(req);
      if (!session) return unauthorized();
      viewer = session.user;
    }

    const listing = await listUpcomingClasses({ viewer });
    const body = listing.visible
      ? {
          visible: true,
          classes: listing.classes,
          liveNow: listing.liveNow,
          teachUrl: teachUrl(),
          version: CLASSES_FEED_VERSION,
        }
      : { visible: false, classes: [] };

    if (viewer) return ok(body);
    return withVaryAuthorization(publicOk(body, 60));
  });
}

/** The signed-out answer is cached by the CDN; a request with a token must never be served it. */
function withVaryAuthorization(res: NextResponse): NextResponse {
  res.headers.set("Vary", "Authorization");
  return res;
}
