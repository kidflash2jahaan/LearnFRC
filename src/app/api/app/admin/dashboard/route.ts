import { loadAdminDashboard } from "@/lib/app/admin-dashboard";
import { fromFailure, guarded, ok, requireAppUser, successBody } from "@/lib/app/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/app/admin/dashboard: everything /admin prints, as the one
 * view-model the website's /admin page renders from (loadAdminDashboard in
 * src/lib/app/admin-dashboard.ts), so every label and footnote matches.
 * Admins only; a signed-in member gets 403 `forbidden`. See apple/docs/API.md.
 */
export async function GET(req: Request) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const result = await loadAdminDashboard(auth.user);
    if (!result.ok) return fromFailure(result);
    return ok(successBody(result));
  });
}
