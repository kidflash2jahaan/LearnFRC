import { loadReportsDesk } from "@/lib/app/admin-reports";
import { fromFailure, guarded, ok, requireAppUser, successBody } from "@/lib/app/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/app/admin/reports: the reports desk, the data /admin/reports
 * renders from (loadReportsDesk in src/lib/app/admin-reports.ts). Open reports
 * oldest first, each with when it must be answered by, then the last 20
 * closed. Admins only. Handles only: no real names or email addresses.
 */
export async function GET(req: Request) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const result = await loadReportsDesk(auth.user);
    if (!result.ok) return fromFailure(result);
    return ok(successBody(result));
  });
}
