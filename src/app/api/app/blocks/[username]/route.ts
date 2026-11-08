import { unblockUser } from "@/lib/app/blocks";
import { fromFailure, guarded, ok, requireAppUser } from "@/lib/app/http";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/app/blocks/{username}: undoes a block, through unblockUser, the
 * function the website's Settings list calls. Idempotent: unblocking someone
 * who isn't blocked answers 200 too.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const { username } = await params;
    const result = await unblockUser(auth.user, { username: decodeURIComponent(username) });
    if (!result.ok) return fromFailure(result);
    return ok({ ok: true, username: result.username });
  });
}
