import { decideApplication } from "@/lib/app/admin-team-desk";
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
 * POST /api/app/admin/applications/{id}/decision { decision: "accept" | "reject", note? }
 *
 * Decides an application through decideApplication
 * (src/lib/app/admin-team-desk.ts), the function /admin/team's Accept and
 * Reject call: the status-gated update (a second decision gets 409), the grant
 * with its rollback, and the decision email to the applicant. A note over 1000
 * characters answers 400 with `field: "note"`. Super admins only.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const body = await readJsonObject(req);
    if (!body) return badJson();
    const { id } = await params;
    const result = await decideApplication(auth.user, {
      id: id.toLowerCase(),
      decision: body.decision,
      note: body.note,
    });
    if (!result.ok) return fromFailure(result);
    return ok({ ok: true, status: result.status });
  });
}
