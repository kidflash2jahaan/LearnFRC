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

/** A team (grouped by FRC team number) for the admin Teams table. */
export type AdminTeam = {
  teamNumber: number;
  members: number;
  completed: number;
};

/** One calendar day of activity for the chart. */
export type DailyPoint = {
  day: string; // YYYY-MM-DD
  signups: number;
  verified: number;
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
  /** Total signups whose email is confirmed. */
  verifiedUsers: number;
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
  /** Signed-in users active within the last few minutes. */
  onlineNow: number;
  onlineUsers: { name: string; username: string | null; lastSeen: string }[];
  daily: DailyPoint[];
};

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
      verified: 0, // filled from auth list below
      completions: completionsByDay.get(key) ?? 0,
    });
  }

  const authList = await supabase.auth.admin.listUsers({ perPage: 1000 });

  // Verified-user totals + per-day, derived from auth (email_confirmed_at).
  const verifiedByDay = new Map<string, number>();
  let verifiedUsers = 0;
  for (const u of authList.data?.users ?? []) {
    if (!u.email_confirmed_at) continue;
    verifiedUsers++;
    const k = dayKey(new Date(u.created_at));
    verifiedByDay.set(k, (verifiedByDay.get(k) ?? 0) + 1);
  }
  for (const d of daily) d.verified = verifiedByDay.get(d.day) ?? 0;

  const profsRes = await supabase
    .from("profiles")
    .select("id, full_name, username, team_number, xp");
  const pmap = new Map(
    ((profsRes.data as Record<string, unknown>[]) ?? []).map((p) => [
      p.id as string,
      p,
    ])
  );
  // Real total XP = sum of every profile's stored xp (includes the streak
  // multiplier and referral bonuses), not completions * 10.
  const totalXP = ((profsRes.data as { xp: number | null }[]) ?? []).reduce(
    (s, p) => s + (p.xp ?? 0),
    0
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

  // ── Teams (grouped by FRC team number from profiles) ───────────
  const teamAgg = new Map<number, { members: number; completed: number }>();
  const userTeam = new Map<string, number>();
  for (const p of (profsRes.data as { id: string; team_number: number | null }[]) ?? []) {
    if (p.team_number == null) continue;
    userTeam.set(p.id, p.team_number);
    const t = teamAgg.get(p.team_number) ?? { members: 0, completed: 0 };
    t.members += 1;
    teamAgg.set(p.team_number, t);
  }
  const { data: allLpRows } = await supabase.from("lesson_progress").select("user_id");
  for (const r of (allLpRows as { user_id: string }[]) ?? []) {
    const tn = userTeam.get(r.user_id);
    if (tn == null) continue;
    const t = teamAgg.get(tn);
    if (t) t.completed += 1;
  }
  const teams: AdminTeam[] = [...teamAgg.entries()]
    .map(([teamNumber, v]) => ({ teamNumber, members: v.members, completed: v.completed }))
    .sort((a, b) => b.members - a.members || b.completed - a.completed);

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

  // Online now: signed-in users with a heartbeat in the last 5 minutes.
  const onlineSince = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const onlineRes = await supabase
    .from("profiles")
    .select("full_name, username, hide_name, last_seen_at")
    .gte("last_seen_at", onlineSince)
    .order("last_seen_at", { ascending: false });
  const onlineUsers = (
    (onlineRes.data as {
      full_name: string | null;
      username: string | null;
      hide_name: boolean | null;
      last_seen_at: string;
    }[]) ?? []
  ).map((p) => ({
    name: (!p.hide_name && (p.full_name || p.username)) || p.username || "Member",
    username: p.username,
    lastSeen: p.last_seen_at,
  }));
  const onlineNow = onlineUsers.length;

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
    totalXP,
    verifiedUsers,
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
    onlineNow,
    onlineUsers,
    daily,
  };
}
