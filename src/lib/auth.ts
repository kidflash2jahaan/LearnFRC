import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/queries";
import type { Profile } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

/**
 * The bootstrap owners. Whoever is listed here is a super admin no matter what
 * the `site_admins` table says, so the person who runs the site can never lock
 * themselves out by editing the team from the panel.
 */
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isOwnerEmail(email?: string | null) {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * Site-level authority, distinct from `profiles.role` (which is the reader's
 * role on their FRC team and is sent to the browser).
 *
 * - member: everyone.
 * - admin: can open /admin, answer feedback, review edits, verify lessons.
 * - superadmin: admin, plus accepting applications and managing the team.
 */
export type SiteRole = "member" | "admin" | "superadmin";

export type SessionInfo = {
  user: User | null;
  profile: Profile | null;
  role: SiteRole;
  isAdmin: boolean;
  isSuperAdmin: boolean;
};

const SIGNED_OUT: SessionInfo = {
  user: null,
  profile: null,
  role: "member",
  isAdmin: false,
  isSuperAdmin: false,
};

/** Service-role lookup: `site_admins` is RLS-locked to trusted server code. */
export async function getSiteRole(
  userId: string,
  email?: string | null
): Promise<SiteRole> {
  if (isOwnerEmail(email)) return "superadmin";
  const { data } = await createAdminClient()
    .from("site_admins")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.role === "superadmin") return "superadmin";
  if (data?.role === "admin") return "admin";
  return "member";
}

export async function getSession(): Promise<SessionInfo> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return SIGNED_OUT;
  const [profile, role] = await Promise.all([
    getProfile(user.id),
    getSiteRole(user.id, user.email),
  ]);
  return {
    user,
    profile,
    role,
    isAdmin: role !== "member",
    isSuperAdmin: role === "superadmin",
  };
}
