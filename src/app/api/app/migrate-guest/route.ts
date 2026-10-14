import { migrateGuestProgress, normalizeVisitorId } from "@/lib/app/guest";
import {
  apiError,
  badJson,
  guarded,
  ok,
  readJsonObject,
  requireAppUser,
} from "@/lib/app/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/app/migrate-guest { visitorId }
 *
 * After sign-in or sign-up, moves the lessons this device completed as a guest
 * (POST /api/guest-progress with the same visitor id) into the account, using
 * migrateGuestProgress (src/lib/app/guest.ts), the function the website's
 * /api/migrate-guest calls. Only rows the server holds migrate, with their
 * original dates; XP comes from the trigger.
 */
export async function POST(req: Request) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const body = await readJsonObject(req);
    if (!body) return badJson();
    if (!normalizeVisitorId(body.visitorId)) return badJson();

    const result = await migrateGuestProgress(auth.user, body.visitorId);
    if (result.status === "rate_limited")
      return apiError("rate_limited", "Too many tries. Try again in a bit.", { retryAfter: 3600 });
    if (result.status === "error")
      return apiError("server", "Couldn't move your guest progress. Try again in a moment.");
    return ok({ migrated: result.migrated, xp: result.xp, lessonIds: result.lessonIds });
  });
}
