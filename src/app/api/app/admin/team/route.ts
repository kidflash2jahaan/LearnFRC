import { loadAdminTeamDesk } from "@/lib/app/admin-team-desk";
import { fromFailure, guarded, ok, requireAppUser, successBody } from "@/lib/app/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/app/admin/team: the super admin's desk, the same reads /admin/team
 * renders from (loadAdminTeamDesk in src/lib/app/admin-team-desk.ts): what
 * accepting hands over, pending applications, the team, and the last 30
 * decisions. Handles and team numbers only, never names or emails. Super
 * admins only; an admin or member gets 403 `forbidden`.
 */
export async function GET(req: Request) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const result = await loadAdminTeamDesk(auth.user);
    if (!result.ok) return fromFailure(result);
    return ok(successBody(result));
  });
}
