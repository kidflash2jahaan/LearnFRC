import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Department,
  Module,
  Lesson,
  Profile,
  FlatLesson,
  TeamMemberProgress,
} from "@/lib/types";

type DeptWithModules = Department & { modules: Module[] };

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

export async function getDepartments(): Promise<DepartmentSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .select("*, modules(id, lessons(id))")
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
}

export const getDepartmentBySlug = cache(async (
  slug: string
): Promise<DeptWithModules | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .select("*, modules(*, lessons(*))")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...(data as unknown as Department),
    modules: sortModules((data as { modules: Module[] }).modules ?? []),
  };
});

export async function getAllDepartmentSlugs(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("departments").select("slug");
  return (data ?? []).map((d) => d.slug as string);
}

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
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return (data as Profile) ?? null;
}

export async function getOverviewStats() {
  const supabase = await createClient();
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
}

export async function getLeaderboard(limit = 25): Promise<Profile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("xp", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data as Profile[]) ?? [];
}

export type WeeklyEntry = Profile & { weeklyXp: number; weeklyLessons: number };

/** Leaderboard by XP earned in the last 7 days — always gives newcomers a shot. */
export async function getWeeklyLeaderboard(limit = 50): Promise<WeeklyEntry[]> {
  // lesson_progress is RLS-protected per-user (lp_select_own), so a normal
  // client would only count the current user. Use the service-role client to
  // aggregate everyone's recent activity for the public weekly ranking.
  const supabase = createAdminClient();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: lp } = await supabase
    .from("lesson_progress")
    .select("user_id, completed_at")
    .gte("completed_at", since);
  const counts: Record<string, number> = {};
  for (const r of (lp ?? []) as { user_id: string }[]) {
    counts[r.user_id] = (counts[r.user_id] || 0) + 1;
  }
  const ids = Object.keys(counts);
  if (!ids.length) return [];
  const { data: profs } = await supabase
    .from("profiles")
    .select("*")
    .in("id", ids);
  return ((profs as Profile[]) ?? [])
    .map((p) => ({
      ...p,
      weeklyLessons: counts[p.id] ?? 0,
      weeklyXp: (counts[p.id] ?? 0) * 10,
    }))
    .sort((a, b) => b.weeklyXp - a.weeklyXp || b.xp - a.xp)
    .slice(0, limit);
}

export type TeamEntry = {
  team_number: number;
  totalXp: number;
  members: number;
};

/** Leaderboard of teams ranked by their members' combined XP. */
export async function getTeamLeaderboard(limit = 50): Promise<TeamEntry[]> {
  const supabase = await createClient();
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
}

/**
 * Auto-team view: everyone who signed up with the same FRC team number, plus
 * each member's progress. Uses the service-role client because lesson_progress
 * is per-user RLS-locked. By design, teammates can see each other's progress
 * (disclosed in the Privacy Policy); display names still honor `hide_name`.
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
