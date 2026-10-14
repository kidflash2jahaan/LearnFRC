import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";

/**
 * Somebody's public record, shared by the website's /u/[username] page and the
 * app's GET /api/app/u/{username}.
 *
 * Service-role, NOT a request-scoped client: `profiles` and `user_achievements`
 * are not SELECTable by the anon API role, which is what stops a stranger from
 * paging every account off /rest/v1. The service-role key bypasses RLS *and*
 * column grants, so every select below is an EXPLICIT allow-list. Never
 * `select("*")`, never `full_name`, `signup_ip`, `unsubscribe_token`, or
 * anything else that isn't public: there is no second line of defence behind
 * this key.
 */

export type PublicProfileRow = Pick<
  Profile,
  "id" | "username" | "avatar_url" | "team_number" | "bio" | "role" | "xp" | "created_at"
>;

export type PublicAchievement = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string | null;
};

export type PublicRecord = {
  profile: PublicProfileRow;
  /** Real completed-lesson count. */
  lessonCount: number;
  /** Most recent first. */
  achievements: PublicAchievement[];
};

/** The public record for an exact username, or null when there is none. */
export async function getPublicRecord(username: string): Promise<PublicRecord | null> {
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, team_number, bio, role, xp, created_at")
    .eq("username", username)
    .maybeSingle();
  if (!profile) return null;
  const p = profile as PublicProfileRow;

  // lesson_progress is RLS-private, so the count is read with the admin client.
  const { count: lessonsCount } = await supabase
    .from("lesson_progress")
    .select("*", { count: "exact", head: true })
    .eq("user_id", p.id);

  const { data: ua } = await supabase
    .from("user_achievements")
    .select("earned_at, achievements(slug, name, description, icon)")
    .eq("user_id", p.id)
    .order("earned_at", { ascending: false });

  type Ach = { slug: string; name: string; description: string; icon: string };
  const achievements: PublicAchievement[] = [];
  for (const r of ua ?? []) {
    const raw = r.achievements as unknown;
    const a = (Array.isArray(raw) ? raw[0] : raw) as Ach | undefined;
    if (a)
      achievements.push({
        slug: a.slug,
        name: a.name,
        description: a.description,
        icon: a.icon,
        earnedAt: (r.earned_at as string | null) ?? null,
      });
  }

  return { profile: p, lessonCount: lessonsCount ?? 0, achievements };
}
