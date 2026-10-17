import { loadAdminSummary } from "@/lib/app/admin-dashboard";
import { fromFailure, guarded, ok, requireAppUser, successBody } from "@/lib/app/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/app/admin/summary: the cheap counts behind the app's admin badges
 * (open feedback, pending applications for super admins, pending edits and
 * submissions). Admins only; a signed-in member gets 403 `forbidden`.
 * loadAdminSummary in src/lib/app/admin-dashboard.ts. See apple/docs/API.md.
 */
export async function GET(req: Request) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const result = await loadAdminSummary(auth.user);
    if (!result.ok) return fromFailure(result);
    return ok(successBody(result));
  });
}
