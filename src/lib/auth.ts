import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import type { Profile } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isAdminEmail(email?: string | null) {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

export type SessionInfo = {
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
};

export async function getSession(): Promise<SessionInfo> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, isAdmin: false };
  const profile = await getProfile(user.id);
  return { user, profile, isAdmin: isAdminEmail(user.email) };
}
