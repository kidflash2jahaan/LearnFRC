import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Department,
  Module,
  Lesson,
  Profile,
  FlatLesson,
  TeamMemberProgress,
  Resource,
} from "@/lib/types";

type DeptWithModules = Department & { modules: Module[] };

// Revalidation windows (seconds). The catalog (departments / modules / lessons)
// changes only via the admin panel, so an hour is plenty; the leaderboard is a
// live-ish aggregate that's identical for every anonymous viewer, so a short
// window keeps it fresh without re-querying every profile on every page view.
const CATALOG_TTL = 3600; // 1 hour
const LEADERBOARD_TTL = 300; // 5 minutes

// Explicit column lists — never `select("*")`. List views in particular must
// never pull `lessons.content` (the heavy per-lesson markdown).
const DEPT_COLS =
  "id, slug, name, tagline, description, difficulty, estimated_hours, what_youll_learn, prerequisites, tools, sources, accent, icon, sort_order";
const MODULE_COLS =
  "id, department_id, slug, title, overview, sort_order, is_prerequisite";
// Lessons WITHOUT `content` / `key_takeaways` / `resources` / `quiz` — enough to
// render module/lesson lists and build lesson navigation. The heavy fields are
// fetched per-lesson on demand via getLessonContent().
const LESSON_LIST_COLS =
  "id, module_id, slug, title, summary, estimated_minutes, sort_order";
// Profile columns needed by the leaderboard/podium (drops the free-text `bio`).
const PROFILE_BOARD_COLS =
  "id, username, full_name, avatar_url, team_number, role, xp, hide_name, created_at";

function sortModules(modules: Module[]): Module[] {
  return [...(modules ?? [])]
    .sort((a, b) => {
      // Prerequisite modules always come first.
      const ap = a.is_prerequisite ? 0 : 1;
      const bp = b.is_prerequisite ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return a.sort_order - b.sort_order;
    })
    .map((m) => ({
      ...m,
      lessons: [...(m.lessons ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    }));
}

export function flattenLessons(dept: DeptWithModules): FlatLesson[] {
  const out: FlatLesson[] = [];
  for (const m of dept.modules) {
    for (const l of m.lessons) {
      out.push({
        ...l,
        moduleTitle: m.title,
        moduleSlug: m.slug,
        departmentSlug: dept.slug,
        departmentName: dept.name,
      });
    }
  }
  return out;
}

export type DepartmentSummary = Department & {
  moduleCount: number;
  lessonCount: number;
};

/**
 * Department cards for every list view (home, guides index, paths, for-teams).
 * Durably cached — the catalog is the same for everyone and rarely changes.
 * Only pulls department fields + module/lesson IDs for the counts (no content).
 */
export const getDepartments = unstable_cache(
  async (): Promise<DepartmentSummary[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("departments")
      .select(`${DEPT_COLS}, modules(id, lessons(id))`)
      .order("sort_order");
    if (error) throw error;
    return (data ?? []).map((d: Record<string, unknown>) => {
      const modules = (d.modules as { lessons?: unknown[] }[]) ?? [];
      const moduleCount = modules.length;
      const lessonCount = modules.reduce(
        (s, m) => s + (m.lessons?.length ?? 0),
        0
      );
      const rest = { ...d };
      delete rest.modules;
      return { ...(rest as unknown as Department), moduleCount, lessonCount };
    });
  },
  ["departments-summary"],
  { revalidate: CATALOG_TTL, tags: ["catalog", "departments"] }
);

/**
 * A department with its modules and lessons — WITHOUT lesson content. Powers
 * the department page (module/lesson listing) and lesson-page navigation.
 * Durably cached per slug. The heavy lesson body is loaded via
 * getLessonContent() only on the lesson page that actually renders it.
 */
export const getDepartmentBySlug = cache(
  unstable_cache(
    async (slug: string): Promise<DeptWithModules | null> => {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from("departments")
        .select(`${DEPT_COLS}, modules(${MODULE_COLS}, lessons(${LESSON_LIST_COLS}))`)
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...(data as unknown as Department),
        modules: sortModules(
          (data as unknown as { modules: Module[] }).modules ?? []
        ),
      };
    },
    ["department-by-slug"],
    { revalidate: CATALOG_TTL, tags: ["catalog", "departments"] }
  )
);

/**
 * The heavy body of a single lesson (markdown content, takeaways, resources,
 * quiz). Fetched only on the lesson page, keyed and cached per lesson id so the
 * full-content query runs at most once per lesson per revalidation window.
 */
export type LessonContent = Pick<
  Lesson,
  "id" | "content" | "key_takeaways" | "resources" | "quiz"
>;

export const getLessonContent = unstable_cache(
  async (lessonId: string): Promise<LessonContent | null> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("lessons")
      .select("id, content, key_takeaways, resources, quiz")
      .eq("id", lessonId)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as LessonContent) ?? null;
  },
  ["lesson-content"],
  { revalidate: CATALOG_TTL, tags: ["catalog", "lessons"] }
);

/** Per-department cited sources for the /resources page. Cached — public data. */
export type DepartmentSources = { name: string; slug: string; sources: Resource[] };

export const getDepartmentSources = unstable_cache(
  async (): Promise<DepartmentSources[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("departments")
      .select("name, slug, sources")
      .order("sort_order");
    return (data ?? []).map((d) => ({
      name: d.name as string,
      slug: d.slug as string,
      sources: (d.sources as Resource[]) ?? [],
    }));
  },
  ["department-sources"],
  { revalidate: CATALOG_TTL, tags: ["catalog", "departments"] }
);

export const getAllDepartmentSlugs = unstable_cache(
  async (): Promise<string[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase.from("departments").select("slug");
    return (data ?? []).map((d) => d.slug as string);
  },
  ["department-slugs"],
  { revalidate: CATALOG_TTL, tags: ["catalog", "departments"] }
);

// ─── Per-user reads — always fresh, never cached (tiny, session-scoped) ───

export async function getCompletedLessonIds(
  userId: string
): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_progress")
    .select("lesson_id")
    .eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.lesson_id as string));
}

export async function getBookmarkedLessonIds(
  userId: string
): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookmarks")
    .select("lesson_id")
    .eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.lesson_id as string));
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, username, full_name, avatar_url, team_number, bio, role, xp, hide_name, created_at"
    )
    .eq("id", userId)
    .maybeSingle();
  return (data as Profile) ?? null;
}

/** Site-wide catalog counts for the home hero. Count-only (no row egress), cached. */
export const getOverviewStats = unstable_cache(
  async () => {
    const supabase = createPublicClient();
    const [depts, modules, lessons, learners] = await Promise.all([
      supabase.from("departments").select("*", { count: "exact", head: true }),
      supabase.from("modules").select("*", { count: "exact", head: true }),
      supabase.from("lessons").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
    ]);
    return {
      deptCount: depts.count ?? 0,
      moduleCount: modules.count ?? 0,
      lessonCount: lessons.count ?? 0,
      learners: learners.count ?? 0,
    };
  },
  ["overview-stats"],
  { revalidate: CATALOG_TTL, tags: ["catalog"] }
);

/**
 * All-time leaderboard — same for every viewer, so it's cached briefly. The
 * page applies per-user "you" highlighting afterward from the (uncached)
 * session, so caching the aggregate is safe.
 */
export const getLeaderboard = unstable_cache(
  async (limit = 25): Promise<(Profile & { lessons: number })[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("profiles")
      .select(PROFILE_BOARD_COLS)
      .order("xp", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(limit);
    const profs = (data as Profile[]) ?? [];
    if (!profs.length) return [];
    // XP no longer equals lessons*10 (streak multiplier), so count real
    // completions. lesson_progress is per-user RLS-locked → use the admin client.
    const admin = createAdminClient();
    const { data: lp } = await admin
      .from("lesson_progress")
      .select("user_id")
      .in(
        "user_id",
        profs.map((p) => p.id)
      );
    const counts: Record<string, number> = {};
    for (const r of (lp ?? []) as { user_id: string }[])
      counts[r.user_id] = (counts[r.user_id] ?? 0) + 1;
    return profs.map((p) => ({ ...p, lessons: counts[p.id] ?? 0 }));
  },
  ["leaderboard-all-time"],
  { revalidate: LEADERBOARD_TTL, tags: ["leaderboard"] }
);

export type WeeklyEntry = Profile & { weeklyXp: number; weeklyLessons: number };

/** Leaderboard by XP earned in the last 7 days — always gives newcomers a shot. */
export const getWeeklyLeaderboard = unstable_cache(
  async (limit = 50): Promise<WeeklyEntry[]> => {
    // lesson_progress is RLS-protected per-user (lp_select_own), so a normal
    // client would only count the current user. Use the service-role client to
    // aggregate everyone's recent activity for the public weekly ranking.
    const supabase = createAdminClient();
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data: lp } = await supabase
      .from("lesson_progress")
      .select("user_id, xp_awarded")
      .gte("completed_at", since);
    const counts: Record<string, number> = {};
    const xpByUser: Record<string, number> = {};
    for (const r of (lp ?? []) as { user_id: string; xp_awarded: number | null }[]) {
      counts[r.user_id] = (counts[r.user_id] || 0) + 1;
      xpByUser[r.user_id] = (xpByUser[r.user_id] || 0) + (r.xp_awarded ?? 10);
    }
    const ids = Object.keys(counts);
    if (!ids.length) return [];
    const { data: profs } = await supabase
      .from("profiles")
      .select(PROFILE_BOARD_COLS)
      .in("id", ids);
    return ((profs as Profile[]) ?? [])
      .map((p) => ({
        ...p,
        weeklyLessons: counts[p.id] ?? 0,
        weeklyXp: xpByUser[p.id] ?? 0,
      }))
      .sort((a, b) => b.weeklyXp - a.weeklyXp || b.xp - a.xp)
      .slice(0, limit);
  },
  ["leaderboard-weekly"],
  { revalidate: LEADERBOARD_TTL, tags: ["leaderboard"] }
);

export type TeamEntry = {
  team_number: number;
  totalXp: number;
  members: number;
};

/** Leaderboard of teams ranked by their members' combined XP. Cached briefly. */
export const getTeamLeaderboard = unstable_cache(
  async (limit = 50): Promise<TeamEntry[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("profiles")
      .select("team_number, xp")
      .not("team_number", "is", null);
    const teams: Record<number, TeamEntry> = {};
    for (const p of (data ?? []) as { team_number: number; xp: number }[]) {
      const t = p.team_number;
      if (t == null) continue;
      teams[t] = teams[t] || { team_number: t, totalXp: 0, members: 0 };
      teams[t].totalXp += p.xp || 0;
      teams[t].members += 1;
    }
    return Object.values(teams)
      .sort((a, b) => b.totalXp - a.totalXp || b.members - a.members)
      .slice(0, limit);
  },
  ["leaderboard-teams"],
  { revalidate: LEADERBOARD_TTL, tags: ["leaderboard"] }
);

/**
 * Auto-team view: everyone who signed up with the same FRC team number, plus
 * each member's progress. Uses the service-role client because lesson_progress
 * is per-user RLS-locked. By design, teammates can see each other's progress
 * (disclosed in the Privacy Policy); display names still honor `hide_name`.
 *
 * Left uncached: it shows live per-member progress and isn't on the hot public
 * catalog path.
 */
export async function getTeamByNumber(
  teamNumber: number
): Promise<{ teamNumber: number; totalLessons: number; members: TeamMemberProgress[] }> {
  const admin = createAdminClient();
  const [{ count: totalLessons }, { data: profs }] = await Promise.all([
    admin.from("lessons").select("*", { count: "exact", head: true }),
    admin
      .from("profiles")
      .select("id, username, full_name, avatar_url, xp, hide_name, created_at")
      .eq("team_number", teamNumber),
  ]);
  const rows = (profs as Profile[]) ?? [];
  const ids = rows.map((p) => p.id);
  const counts: Record<string, number> = {};
  const last: Record<string, string> = {};
  if (ids.length) {
    const { data: lp } = await admin
      .from("lesson_progress")
      .select("user_id, completed_at")
      .in("user_id", ids);
    for (const r of (lp ?? []) as { user_id: string; completed_at: string }[]) {
      counts[r.user_id] = (counts[r.user_id] ?? 0) + 1;
      if (!last[r.user_id] || r.completed_at > last[r.user_id])
        last[r.user_id] = r.completed_at;
    }
  }
  const members: TeamMemberProgress[] = rows
    .map((p) => ({
      userId: p.id,
      name: (!p.hide_name && (p.full_name || p.username)) || p.username || "Member",
      username: p.username,
      avatarUrl: p.avatar_url,
      role: "member",
      xp: p.xp ?? 0,
      completed: counts[p.id] ?? 0,
      lastActive: last[p.id] ?? null,
      joinedAt: p.created_at,
    }))
    .sort((a, b) => b.completed - a.completed || b.xp - a.xp);
  return { teamNumber, totalLessons: totalLessons ?? 0, members };
}

export type Recruiter = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  referrals: number;
};

/** Members ranked by how many people they've referred (the recruiter board). */
export async function getTopRecruiters(limit = 10): Promise<Recruiter[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("referred_by")
    .not("referred_by", "is", null);
  const counts: Record<string, number> = {};
  for (const r of (data ?? []) as { referred_by: string }[])
    counts[r.referred_by] = (counts[r.referred_by] ?? 0) + 1;
  const ids = Object.keys(counts);
  if (!ids.length) return [];
  const { data: profs } = await admin
    .from("profiles")
    .select("id, username, full_name, avatar_url, hide_name")
    .in("id", ids);
  return ((profs as Profile[]) ?? [])
    .map((p) => ({
      id: p.id,
      name:
        (!p.hide_name && (p.full_name || p.username)) || p.username || "Learner",
      username: p.username,
      avatarUrl: p.avatar_url,
      referrals: counts[p.id] ?? 0,
    }))
    .sort((a, b) => b.referrals - a.referrals)
    .slice(0, limit);
}

/** How many people a given user has referred. Per-user, uncached. */
export async function getReferralCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("referred_by", userId);
  return count ?? 0;
}

/**
 * Site-wide XP totals for the leaderboard header — counts ALL learners, not
 * just the top 50 shown, so the numbers match the admin panel exactly. Same for
 * every viewer, so cached on the short leaderboard window.
 */
export const getXpTotals = unstable_cache(
  async (): Promise<{ learners: number; totalXp: number }> => {
    const supabase = createPublicClient();
    const { data } = await supabase.from("profiles").select("xp").gt("xp", 0);
    const rows = (data as { xp: number }[]) ?? [];
    return {
      learners: rows.length,
      totalXp: rows.reduce((s, r) => s + (r.xp || 0), 0),
    };
  },
  ["xp-totals"],
  { revalidate: LEADERBOARD_TTL, tags: ["leaderboard"] }
);
