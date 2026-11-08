import { banReportedAccount } from "@/lib/app/admin-reports";
import { badJson, fromFailure, guarded, ok, readJsonObject, requireAppUser } from "@/lib/app/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/app/admin/reports/{id}/ban { note? }: bans the reported account
 * (its email on banned_emails, its signup IP on banned_ips once a second
 * banned account shares it), deletes it, and closes every open report about
 * it (banReportedAccount, the function /admin/reports' Ban button calls).
 * Can't be undone. 409 when the report was already answered. Super admins only.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const body = await readJsonObject(req);
    if (!body) return badJson();
    const { id } = await params;
    const result = await banReportedAccount(auth.user, { id: id.toLowerCase(), note: body.note });
    if (!result.ok) return fromFailure(result);
    return ok({ ok: true, status: result.status });
  });
}
