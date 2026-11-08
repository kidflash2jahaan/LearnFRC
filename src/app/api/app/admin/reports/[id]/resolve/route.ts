import { resolveReport } from "@/lib/app/admin-reports";
import { badJson, fromFailure, guarded, ok, readJsonObject, requireAppUser } from "@/lib/app/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/app/admin/reports/{id}/resolve { note? }: closes a report with
 * nothing taken down (resolveReport, the function /admin/reports' Close
 * button calls). 409 when it was already answered. Admins only.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const body = await readJsonObject(req);
    if (!body) return badJson();
    const { id } = await params;
    const result = await resolveReport(auth.user, { id: id.toLowerCase(), note: body.note });
    if (!result.ok) return fromFailure(result);
    return ok({ ok: true, status: result.status });
  });
}
