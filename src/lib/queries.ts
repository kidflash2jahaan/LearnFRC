import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Department,
  Module,
  Lesson,
  Profile,
  FlatLesson,
  Team,
  TeamDashboard,
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

/** The team the user owns or belongs to (one per user), or null. */
export async function getMyTeam(
  userId: string
): Promise<{ team: Team; role: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_memberships")
    .select("role, teams(*)")
    .eq("user_id", userId)
    .maybeSingle();
  const team = (data as { role: string; teams: Team | null } | null)?.teams;
  if (!data || !team) return null;
  return { team, role: (data as { role: string }).role };
}

/**
 * Full mentor dashboard: roster with each member's completed-lesson count, XP,
 * and last activity. Member progress lives behind per-user RLS, so this uses the
 * service-role client — and only returns the roster when the requester actually
 * owns the team.
 */
export async function getTeamDashboard(
  teamId: string,
  requesterId: string
): Promise<TeamDashboard | null> {
  const admin = createAdminClient();
  const { data: team } = await admin
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return null;
  const isOwner = (team as Team).owner_id === requesterId;

  const { count: totalLessons } = await admin
    .from("lessons")
    .select("*", { count: "exact", head: true });

  if (!isOwner) {
    return { team: team as Team, isOwner: false, totalLessons: totalLessons ?? 0, members: [] };
  }

  const { data: memberRows } = await admin
    .from("team_memberships")
    .select("user_id, role, joined_at")
    .eq("team_id", teamId);
  const rows = (memberRows ?? []) as {
    user_id: string;
    role: string;
    joined_at: string;
  }[];
  const ids = rows.map((r) => r.user_id);
  if (!ids.length) {
    return { team: team as Team, isOwner: true, totalLessons: totalLessons ?? 0, members: [] };
  }

  const [{ data: profs }, { data: lp }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, username, full_name, avatar_url, xp, hide_name")
      .in("id", ids),
    admin
      .from("lesson_progress")
      .select("user_id, completed_at")
      .in("user_id", ids),
  ]);

  const profMap = new Map(
    ((profs ?? []) as Profile[]).map((p) => [p.id, p])
  );
  const counts: Record<string, number> = {};
  const last: Record<string, string> = {};
  for (const r of (lp ?? []) as { user_id: string; completed_at: string }[]) {
    counts[r.user_id] = (counts[r.user_id] ?? 0) + 1;
    if (!last[r.user_id] || r.completed_at > last[r.user_id])
      last[r.user_id] = r.completed_at;
  }

  const members: TeamMemberProgress[] = rows
    .map((r) => {
      const p = profMap.get(r.user_id);
      const name =
        (!p?.hide_name && (p?.full_name || p?.username)) ||
        p?.username ||
        "Member";
      return {
        userId: r.user_id,
        name,
        username: p?.username ?? null,
        avatarUrl: p?.avatar_url ?? null,
        role: r.role,
        xp: p?.xp ?? 0,
        completed: counts[r.user_id] ?? 0,
        lastActive: last[r.user_id] ?? null,
        joinedAt: r.joined_at,
      };
    })
    .sort(
      (a, b) =>
        (a.role === "owner" ? -1 : 0) - (b.role === "owner" ? -1 : 0) ||
        b.completed - a.completed ||
        b.xp - a.xp
    );

  return { team: team as Team, isOwner: true, totalLessons: totalLessons ?? 0, members };
}
