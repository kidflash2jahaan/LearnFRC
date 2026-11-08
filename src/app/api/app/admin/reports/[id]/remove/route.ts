import { removeReportedContent } from "@/lib/app/admin-reports";
import { badJson, fromFailure, guarded, ok, readJsonObject, requireAppUser } from "@/lib/app/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/app/admin/reports/{id}/remove { note?, replaceUsername? }: takes
 * the reported content down and closes every open report about it
 * (removeReportedContent, the function /admin/reports' Remove button calls).
 * A profile loses its bio and picture, and its handle too when
 * `replaceUsername` is true; an edit or proposal loses its words and, if still
 * pending, is turned down. 409 when it was already answered. Admins only.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const body = await readJsonObject(req);
    if (!body) return badJson();
    const { id } = await params;
    const result = await removeReportedContent(auth.user, {
      id: id.toLowerCase(),
      note: body.note,
      replaceUsername: body.replaceUsername,
    });
    if (!result.ok) return fromFailure(result);
    return ok({ ok: true, status: result.status, newUsername: result.newUsername });
  });
}
