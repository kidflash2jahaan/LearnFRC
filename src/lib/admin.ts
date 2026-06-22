import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** A row from the `admin_department_stats` view. */
export type DepartmentStat = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  lesson_count: number;
  completions: number;
  learners: number;
};

/** A trimmed profile used for the recent-signups table. */
export type RecentSignup = {
  id: string;
  username: string | null;
  full_name: string | null;
  team_number: number | null;
  xp: number;
  created_at: string;
};

export type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  team_number: number | null;
  xp: number;
  confirmed: boolean;
  created_at: string;
};

/** A managed team for the admin Teams table. */
export type AdminTeam = {
  id: string;
  name: string;
  team_number: number | null;
  join_code: string;
  owner: string;
  members: number;
  completed: number;
  created_at: string;
};

/** One calendar day of activity for the chart. */
export type DailyPoint = {
  day: string; // YYYY-MM-DD
  signups: number;
  completions: number;
};

export type AdminStats = {
  totals: {
    users: number;
    completions: number;
    bookmarks: number;
    lessons: number;
    departments: number;
    achievementsEarned: number;
    subscribers: number;
  };
  totalXP: number;
  signups7d: number;
  signups30d: number;
  completions7d: number;
  topDepartments: DepartmentStat[];
  recentSignups: RecentSignup[];
  users: AdminUser[];
  teams: AdminTeam[];
  /** Distinct FRC team numbers represented across all user profiles. */
  totalUniqueTeams: number;
  recentCompletions: { user: string; lesson: string; dept: string; at: string }[];
  subscriberList: { email: string; created_at: string }[];
  achievementBreakdown: { name: string; icon: string; earned: number }[];
  daily: DailyPoint[];
};

/** XP awarded per completed lesson (kept in sync with the progress action). */
const XP_PER_COMPLETION = 10;

/** Number of trailing calendar days rendered in the activity chart. */
const DAILY_WINDOW = 14;

/** Format a Date as a UTC `YYYY-MM-DD` key (matches the daily views). */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Aggregate every metric the admin dashboard needs.
 *
 * Uses the service-role client, which bypasses RLS — callers MUST verify the
 * requester is an admin (see `getSession().isAdmin`) before invoking this.
 */
export async function getAdminStats(): Promise<AdminStats> {
  const supabase = createAdminClient();

  const now = Date.now();
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  const DAY = 24 * 60 * 60 * 1000;
  const since7d = iso(7 * DAY);
  const since30d = iso(30 * DAY);

  const countOf = (rows: { count: number | null }) => rows.count ?? 0;

  const [
    usersRes,
    completionsRes,
    bookmarksRes,
    lessonsRes,
    departmentsRes,
    achievementsEarnedRes,
    signups7dRes,
    signups30dRes,
    completions7dRes,
    deptStatsRes,
    recentRes,
    dailySignupsRes,
    dailyCompletionsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("lesson_progress").select("*", { count: "exact", head: true }),
    supabase.from("bookmarks").select("*", { count: "exact", head: true }),
    supabase.from("lessons").select("*", { count: "exact", head: true }),
    supabase.from("departments").select("*", { count: "exact", head: true }),
    supabase
      .from("user_achievements")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since7d),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since30d),
    supabase
      .from("lesson_progress")
      .select("*", { count: "exact", head: true })
      .gte("completed_at", since7d),
    supabase.from("admin_department_stats").select("*"),
    supabase
      .from("profiles")
      .select("id, username, full_name, team_number, xp, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("admin_daily_signups").select("day, count"),
    supabase.from("admin_daily_completions").select("day, count"),
  ]);

  const subscribersRes = await supabase
    .from("subscribers")
    .select("*", { count: "exact", head: true });

  const completions = countOf(completionsRes);

  const topDepartments = ((deptStatsRes.data as DepartmentStat[]) ?? [])
    .slice()
    .sort((a, b) => (b.completions ?? 0) - (a.completions ?? 0));

  const recentSignups = (recentRes.data as RecentSignup[]) ?? [];

  // Build a fast lookup keyed by YYYY-MM-DD for each daily view.
  const toMap = (
    rows: { day: string | null; count: number | null }[] | null
  ) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!r.day) continue;
      // `day` may arrive as a date or timestamp string — normalise to 10 chars.
      m.set(String(r.day).slice(0, 10), r.count ?? 0);
    }
    return m;
  };

  const signupsByDay = toMap(
    dailySignupsRes.data as { day: string | null; count: number | null }[]
  );
  const completionsByDay = toMap(
    dailyCompletionsRes.data as { day: string | null; count: number | null }[]
  );

  // Last DAILY_WINDOW calendar days, oldest → newest, missing days filled with 0.
  const daily: DailyPoint[] = [];
  for (let i = DAILY_WINDOW - 1; i >= 0; i--) {
    const key = dayKey(new Date(now - i * DAY));
    daily.push({
      day: key,
      signups: signupsByDay.get(key) ?? 0,
      completions: completionsByDay.get(key) ?? 0,
    });
  }

  const authList = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const profsRes = await supabase
    .from("profiles")
    .select("id, full_name, username, team_number, xp");
  const pmap = new Map(
    ((profsRes.data as Record<string, unknown>[]) ?? []).map((p) => [
      p.id as string,
      p,
    ])
  );
  const users: AdminUser[] = (authList.data?.users ?? [])
    .map((u) => {
      const p = (pmap.get(u.id) ?? {}) as Record<string, unknown>;
      return {
        id: u.id,
        email: u.email ?? "",
        full_name:
          (p.full_name as string) ??
          ((u.user_metadata?.full_name as string) || null),
        username: (p.username as string) ?? null,
        team_number: (p.team_number as number) ?? null,
        xp: (p.xp as number) ?? 0,
        confirmed: !!u.email_confirmed_at,
        created_at: u.created_at,
      };
    })
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  // ── Teams ──────────────────────────────────────────────────────
  const [teamsRes, membershipsRes] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, team_number, join_code, owner_id, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("team_memberships").select("team_id, user_id"),
  ]);
  const teamRows = (teamsRes.data ?? []) as {
    id: string;
    name: string;
    team_number: number | null;
    join_code: string;
    owner_id: string;
    created_at: string;
  }[];
  const memRows = (membershipsRes.data ?? []) as {
    team_id: string;
    user_id: string;
  }[];
  const membersByTeam = new Map<string, string[]>();
  for (const m of memRows) {
    const arr = membersByTeam.get(m.team_id) ?? [];
    arr.push(m.user_id);
    membersByTeam.set(m.team_id, arr);
  }
  const completedByUser = new Map<string, number>();
  const memberIds = [...new Set(memRows.map((m) => m.user_id))];
  if (memberIds.length) {
    const lpRes = await supabase
      .from("lesson_progress")
      .select("user_id")
      .in("user_id", memberIds);
    for (const r of (lpRes.data as { user_id: string }[]) ?? [])
      completedByUser.set(r.user_id, (completedByUser.get(r.user_id) ?? 0) + 1);
  }
  const teams: AdminTeam[] = teamRows.map((t) => {
    const ids = membersByTeam.get(t.id) ?? [];
    const owner = pmap.get(t.owner_id) as Record<string, unknown> | undefined;
    return {
      id: t.id,
      name: t.name,
      team_number: t.team_number,
      join_code: t.join_code,
      owner:
        (owner?.full_name as string) || (owner?.username as string) || "—",
      members: ids.length,
      completed: ids.reduce((s, id) => s + (completedByUser.get(id) ?? 0), 0),
      created_at: t.created_at,
    };
  });

  const totalUniqueTeams = new Set(
    ((profsRes.data as { team_number: number | null }[]) ?? [])
      .map((p) => p.team_number)
      .filter((t): t is number => t != null)
  ).size;

  // Recent lesson completions (activity feed under the "Lessons completed" card).
  const recentCompRes = await supabase
    .from("lesson_progress")
    .select("user_id, completed_at, lessons(title, modules(departments(name)))")
    .order("completed_at", { ascending: false })
    .limit(50);
  type CompRow = {
    user_id: string;
    completed_at: string;
    lessons: {
      title: string | null;
      modules: { departments: { name: string | null } | null } | null;
    } | null;
  };
  const recentCompletions = ((recentCompRes.data as unknown as CompRow[]) ?? []).map((r) => {
    const p = pmap.get(r.user_id) as Record<string, unknown> | undefined;
    return {
      user: (p?.full_name as string) || (p?.username as string) || "Learner",
      lesson: r.lessons?.title ?? "—",
      dept: r.lessons?.modules?.departments?.name ?? "—",
      at: r.completed_at,
    };
  });

  // Subscriber list (under the "Email subscribers" card).
  const subsListRes = await supabase
    .from("subscribers")
    .select("email, created_at")
    .order("created_at", { ascending: false });
  const subscriberList =
    (subsListRes.data as { email: string; created_at: string }[]) ?? [];

  // Achievement distribution (under the "Achievements earned" card).
  const [achListRes, uaListRes] = await Promise.all([
    supabase.from("achievements").select("id, name, icon, sort_order").order("sort_order"),
    supabase.from("user_achievements").select("achievement_id"),
  ]);
  const uaCounts: Record<string, number> = {};
  for (const r of (uaListRes.data as { achievement_id: string }[]) ?? [])
    uaCounts[r.achievement_id] = (uaCounts[r.achievement_id] ?? 0) + 1;
  const achievementBreakdown = (
    (achListRes.data as { id: string; name: string; icon: string }[]) ?? []
  )
    .map((a) => ({ name: a.name, icon: a.icon, earned: uaCounts[a.id] ?? 0 }))
    .sort((a, b) => b.earned - a.earned);

  return {
    totals: {
      users: countOf(usersRes),
      completions,
      bookmarks: countOf(bookmarksRes),
      lessons: countOf(lessonsRes),
      departments: countOf(departmentsRes),
      achievementsEarned: countOf(achievementsEarnedRes),
      subscribers: countOf(subscribersRes),
    },
    totalXP: completions * XP_PER_COMPLETION,
    signups7d: countOf(signups7dRes),
    signups30d: countOf(signups30dRes),
    completions7d: countOf(completions7dRes),
    topDepartments,
    recentSignups,
    users,
    teams,
    totalUniqueTeams,
    recentCompletions,
    subscriberList,
    achievementBreakdown,
    daily,
  };
}
