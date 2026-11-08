import { removeMarketerFor } from "@/lib/app/admin-apply-marketing";
import { fromFailure, guarded, ok, requireAppUser } from "@/lib/app/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ userId: string }> };

/**
 * DELETE /api/app/admin/marketers/{userId}
 *
 * Takes the marketing tag off an account, through removeMarketerFor
 * (src/lib/app/admin-apply-marketing.ts), the function /admin/team's Remove on
 * a marketer calls. Their account, progress and the signups already credited
 * to their link stay; /apply offers them the form again. Super admins only.
 */
export async function DELETE(req: Request, { params }: Ctx) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const { userId } = await params;
    const result = await removeMarketerFor(auth.user, { userId: userId.toLowerCase() });
    if (!result.ok) return fromFailure(result);
    return ok({ ok: true });
  });
}
