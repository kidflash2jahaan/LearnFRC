import "server-only";
import { getSiteRole, type SiteRole } from "@/lib/auth";
import { fail, type AppUser, type Failure } from "@/lib/app/result";

/**
 * Who may do admin work, decided once for both doors.
 *
 * Every shared admin function in src/lib/app/admin-*.ts starts by calling
 * `requireSiteRole` with the VERIFIED caller: the website hands in
 * `getSession().user` (cookie), the app's /api/app/admin/* routes hand in the
 * Bearer token's user. Neither door ever passes a role, a user id from a body,
 * or an "isAdmin" flag, and the app's cached `siteRole` is display only.
 *
 * The role itself comes from `getSiteRole` (src/lib/auth.ts): an owner email in
 * ADMIN_EMAILS is always a super admin, otherwise the RLS-locked `site_admins`
 * row decides. A signed-in account without the role gets `forbidden` (403),
 * never `unauthorized` (401), because the app treats a 401 as signed out.
 */

/** The refusal /admin's locked card gives a signed-in non-admin. */
export const NOT_ADMIN =
  "/admin holds the raw numbers for the whole site, so it is open to administrators only. Nothing is wrong with your account.";

/**
 * The refusal both super-admin actions give. One string, so the two cannot
 * drift apart, and it names the likely cause: the controls are only shown to a
 * super admin, so somebody reading this has almost certainly been signed out
 * under a screen that was open. It says what to do about that.
 */
export const NOT_SUPER_ADMIN =
  "Only a super admin can do that. Try reloading the page and signing in again.";

/** The input wasn't the shape the route documents (the app only). */
export const BAD_REQUEST = "That request wasn't in the format we expected.";

export type StaffRole = Exclude<SiteRole, "member">;

/** The caller's site role, straight from the server's own lookup. */
export function siteRoleFor(user: AppUser): Promise<SiteRole> {
  return getSiteRole(user.id, user.email);
}

/**
 * The caller's role when it is at least `need`, or a `forbidden` failure
 * carrying `refusal` (the website's own sentence for that surface).
 */
export async function requireSiteRole(
  user: AppUser,
  need: StaffRole,
  refusal: string
): Promise<{ ok: true; role: StaffRole } | Failure> {
  const role = await siteRoleFor(user);
  if (role === "member" || (need === "superadmin" && role !== "superadmin"))
    return fail("forbidden", refusal);
  return { ok: true, role };
}

/**
 * A request field as a trimmed string. Missing or null is "", any other
 * non-string is null (the caller answers BAD_REQUEST). FormData values are
 * always strings, so the website never sees null here.
 */
export function textField(v: unknown): string | null {
  if (v === undefined || v === null) return "";
  return typeof v === "string" ? v.trim() : null;
}
