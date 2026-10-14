import { loadProgressSnapshot } from "@/lib/app/me";
import { clientsFor } from "@/lib/app/result";
import { guarded, ok, requireAppUser } from "@/lib/app/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/app/me/progress: every completion (with the XP it earned),
 * bookmark and badge, plus the week rhythm and its copy computed on the
 * server in UTC, exactly as the site's /api/me/progress does. The app shows
 * the rhythm and the words as sent and never recomputes them.
 * See apple/docs/API.md.
 */
export async function GET(req: Request) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    return ok(await loadProgressSnapshot(auth.user, clientsFor(auth.supabase)));
  });
}
