import { loadMe } from "@/lib/app/me";
import { guarded, ok, requireAppUser } from "@/lib/app/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/app/me: who the Bearer token belongs to, their own profile (the
 * only place anyone's full name is sent, and only their own), and the
 * onboarding flags the site uses: the username gate and the one-time
 * reminder-email question, and `siteRole` (member, admin or superadmin) so the
 * app knows whether to show the admin rows. That role is display only; every
 * admin route checks it again on the server. See apple/docs/API.md.
 */
export async function GET(req: Request) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    return ok(await loadMe(auth.user));
  });
}
