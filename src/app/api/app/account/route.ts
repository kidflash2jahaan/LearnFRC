import { deleteAccountData } from "@/lib/app/profile";
import { clientsFor } from "@/lib/app/result";
import { fromFailure, guarded, ok, requireAppUser } from "@/lib/app/http";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/app/account
 *
 * Permanently deletes the caller's own account and everything in it, through
 * deleteAccountData (src/lib/app/profile.ts), the function the website's
 * Settings "Delete account" calls. Required in-app by App Store guideline
 * 5.1.1(v). The app signs out locally afterwards; the auth user and every
 * session it had are gone.
 */
export async function DELETE(req: Request) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const result = await deleteAccountData(auth.user, clientsFor(auth.supabase));
    if (!result.ok) return fromFailure(result);
    return ok({ ok: true });
  });
}
