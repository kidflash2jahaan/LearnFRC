import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getArticles } from "@/lib/queries";

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

/** A team (grouped by FRC team number) for the admin Teams table. */
export type AdminTeam = {
  teamNumber: number;
  members: number;
  completed: number;
};

/**
 * Referral signups grouped by the surface that earned them — the `?via=` value
 * on the referral link (`lesson-milestone`, `certificate`, `dashboard`,
 * `leaderboard`).
 */
export type ReferralSurfaceStat = {
  /**
   * The allow-listed surface key, or `null` for referrals created BEFORE
   * attribution shipped. Null is a real bucket, not missing data — those
   * signups happened, we just can't say which surface earned them.
   */
  surface: string | null;
  signups: number;
  signups7d: number;
};

/**
 * What the pageview-derived numbers actually cover.
 *
 * `page_views` holds three eras, and reading across them without saying so is
 * how a 100%-activation illusion got into a growth analysis:
 *
 *  1. 2026-06-19..07-03 — 992 SYNTHETIC rows (`source = 'backfill'`,
 *     `visitor = 'seed:<user_id>'`) reconstructed from `lesson_progress`. They
 *     exist ONLY for people who completed a lesson, so any funnel over them
 *     reads ~100% by construction. Kept in the table (they are honestly
 *     labelled and may stand in for real pre-beacon activity) but excluded
 *     from every figure here; the size and span come back as `backfill*` so
 *     the panel can show them as their own line instead of summing them in.
 *  2. 07-03..07-22 — real traffic, but `visitor` is NULL on every row. Fine as
 *     raw view counts, useless per-person. Needs no filter (`count(distinct)`
 *     ignores NULLs) — it is a COVERAGE fact, which is what `visitorsSince`
 *     starting later than `viewsSince` records.
 *  3. 07-22 onward — real traffic with real visitor ids.
 */
export type AnalyticsCoverage = {
  /** First measured pageview of any kind — raw view counts start here. */
  viewsSince: string | null;
  /** First measured pageview carrying a visitor id — per-person counts start here. */
  visitorsSince: string | null;
  /** Synthetic rows held out of every number above. */
  backfillViews: number;
  /** `seed:` pseudo-visitors held out of every per-visitor number above. */
  backfillVisitors: number;
  backfillFrom: string | null;
  backfillTo: string | null;
};

/** One calendar day of activity for the chart. */
export type DailyPoint = {
  day: string; // YYYY-MM-DD
  signups: number;
  completions: number;
  views: number;
  visitors: number;
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
  signups30d: number;
  completions30d: number;
  topDepartments: DepartmentStat[];
  recentSignups: RecentSignup[];
  teams: AdminTeam[];
  /** Distinct FRC team numbers represented across all user profiles. */
  totalUniqueTeams: number;
  recentCompletions: { user: string; lesson: string; dept: string; at: string }[];
  achievementBreakdown: { name: string; icon: string; earned: number }[];
  /** Signed-in users (or anonymous visitors) active in the last few minutes. */
  onlineNow: number;
  /** Acquisition-source breakdown for the pie chart. */
  sources: { name: string; count: number }[];
  /** Acquisition-source breakdown for signups in the last 7 days. */
  sources7d: { name: string; count: number }[];
  /** Number of users who joined via a referral link. */
  referralUsers: number;
  /** Who referred how many people, most first. */
  recruiters: { name: string; username: string | null; referrals: number }[];
  /**
   * Which surface earned each referral signup. Sums to `referralUsers`; the
   * `surface: null` row is everything that predates attribution.
   */
  referralSurfaces: ReferralSurfaceStat[];
  daily: DailyPoint[];
  /** Combined blog-article views, all-time. */
  articleViewsTotal: number;
  /** Per-article view counts, most read first, incl. zero-view articles. */
  articleViews: { slug: string; title: string; views: number }[];
  /** Site-wide MEASURED pageviews (all pages), all-time. Excludes the backfill. */
  pageViewsTotal: number;
  /** Distinct first-party visitor ids (unique visitors). Excludes the backfill. */
  uniqueVisitors: number;
  uniqueVisitors30d: number;
  /** Provenance + coverage window for every pageview-derived number above. */
  analytics: AnalyticsCoverage;
  /** Most-completed lessons. */
  topLessons: { slug: string; title: string; completions: number }[];
  /** Where UNIQUE VISITORS came from — first-touch source (all-time / last 7d). */
  visitorSources: { name: string; count: number }[];
  visitorSources7d: { name: string; count: number }[];
  /** Guest (no-account) learning — completions + distinct learners. */
  guestCompletions: number;
  guestLearners: number;
  /** All-time MEASURED views across every /guides page (backfill excluded). */
  guideViewsTotal: number;
  /**
   * Distinct people who viewed any guide (can't be summed per-dept). Covers
   * `analytics.visitorsSince` onward — the backfill's 73 `seed:` guide
   * "viewers" are excluded, and rows before visitor ids existed carry none.
   */
  guideViewersTotal: number;
};

/** Number of trailing calendar days rendered in the activity chart. */
const DAILY_WINDOW = 30;

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
  const since30d = iso(30 * DAY);

  const countOf = (rows: { count: number | null }) => rows.count ?? 0;

  const [
    usersRes,
    completionsRes,
    bookmarksRes,
    lessonsRes,
    departmentsRes,
    achievementsEarnedRes,
    signups30dRes,
    completions30dRes,
    deptStatsRes,
    recentRes,
    dailySignupsRes,
    dailyCompletionsRes,
    articleViewsRes,
    pageSummaryRes,
    dailyPageViewsRes,
    topLessonsRes,
    visitorSourcesRes,
    guestStatsRes,
    guideViewsSummaryRes,
    referralSurfacesRes,
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
      .gte("created_at", since30d),
    supabase
      .from("lesson_progress")
      .select("*", { count: "exact", head: true })
      .gte("completed_at", since30d),
    supabase.from("admin_department_stats").select("*"),
    supabase
      .from("profiles")
      .select("id, username, full_name, team_number, xp, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("admin_daily_signups").select("day, count"),
    supabase.from("admin_daily_completions").select("day, count"),
    // Aggregated in SQL (one row per slug) so we never fetch raw view rows.
    supabase.rpc("article_view_counts"),
    // Site-wide pageview aggregates — all computed SQL-side, and all reading
    // `page_views_measured` rather than `page_views` so the reconstructed
    // backfill (see AnalyticsCoverage) is excluded. This RPC also returns the
    // held-back backfill totals and the coverage window, so the panel can state
    // what each number covers instead of leaving it to be re-derived.
    supabase.rpc("page_view_summary"),
    supabase.rpc("page_views_daily", { days: DAILY_WINDOW }),
    // Reads lesson_progress, NOT page_views — the backfill cannot reach it, so
    // it is deliberately left unfiltered.
    supabase.rpc("top_lessons", { lim: 8 }),
    supabase.rpc("visitor_sources"),
    supabase.rpc("guest_progress_stats"),
    supabase.from("admin_guide_views_summary").select("*"),
    // Referral signups per `?via=` surface — grouped SQL-side, and served by
    // profiles_referred_by_idx, so it reads only the referral rows.
    supabase.rpc("referral_surfaces"),
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
  // page_views_daily returns (day, views) — build its own map.
  const pageViewsByDay = new Map<string, number>();
  const visitorsByDay = new Map<string, number>();
  for (const r of (dailyPageViewsRes.data as
    | { day: string | null; views: number | string | null; visitors: number | string | null }[]
    | null) ?? []) {
    if (!r.day) continue;
    const k = String(r.day).slice(0, 10);
    pageViewsByDay.set(k, Number(r.views ?? 0));
    visitorsByDay.set(k, Number(r.visitors ?? 0));
  }

  // Last DAILY_WINDOW calendar days, oldest → newest, missing days filled with 0.
  const daily: DailyPoint[] = [];
  for (let i = DAILY_WINDOW - 1; i >= 0; i--) {
    const key = dayKey(new Date(now - i * DAY));
    daily.push({
      day: key,
      signups: signupsByDay.get(key) ?? 0,
      completions: completionsByDay.get(key) ?? 0,
      views: pageViewsByDay.get(key) ?? 0,
      visitors: visitorsByDay.get(key) ?? 0,
    });
  }

  const authList = await supabase.auth.admin.listUsers({ perPage: 1000 });

  // Verified-user total, derived from auth (email_confirmed_at).
  let verifiedUsers = 0;
  for (const u of authList.data?.users ?? []) {
    if (u.email_confirmed_at) verifiedUsers++;
  }

  // Page through profiles — the table can exceed PostgREST's 1000-row response
  // cap as the user base grows, and a plain .select() would silently truncate
  // every total derived from it (XP, team members, unique teams).
  const allProfs: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("profiles")
      .select(
        "id, full_name, username, team_number, xp, referred_by, source, hide_name, created_at"
      )
      .order("id", { ascending: true })
      .range(from, from + 999);
    const chunk = (data as Record<string, unknown>[]) ?? [];
    allProfs.push(...chunk);
    if (chunk.length < 1000) break;
  }
  const pmap = new Map(allProfs.map((p) => [p.id as string, p]));
  // Real total XP = sum of every profile's stored xp (includes the streak
  // multiplier and referral bonuses), not completions * 10.
  const totalXP = (allProfs as { xp: number | null }[]).reduce(
    (s, p) => s + (p.xp ?? 0),
    0
  );

  // ── Teams (grouped by FRC team number from profiles) ───────────
  const teamAgg = new Map<number, { members: number; completed: number }>();
  const userTeam = new Map<string, number>();
  for (const p of allProfs as { id: string; team_number: number | null }[]) {
    if (p.team_number == null) continue;
    userTeam.set(p.id, p.team_number);
    const t = teamAgg.get(p.team_number) ?? { members: 0, completed: 0 };
    t.members += 1;
    teamAgg.set(p.team_number, t);
  }
  // Page through lesson_progress (it can exceed the 1000-row cap) and count each
  // team's DISTINCT completed lessons — matching the leaderboard's definition of
  // "lessons done". The old plain .select("user_id") both truncated at 1000 rows
  // AND counted raw rows, so team totals were wrong (this is the bug reported).
  {
    const perTeam = new Map<number, Set<string>>();
    for (let from = 0; ; from += 1000) {
      const { data: lp } = await supabase
        .from("lesson_progress")
        .select("user_id, lesson_id")
        .order("id", { ascending: true })
        .range(from, from + 999);
      const chunk = (lp ?? []) as { user_id: string; lesson_id: string }[];
      for (const r of chunk) {
        const tn = userTeam.get(r.user_id);
        if (tn == null) continue;
        let set = perTeam.get(tn);
        if (!set) {
          set = new Set();
          perTeam.set(tn, set);
        }
        set.add(`${r.user_id}:${r.lesson_id}`);
      }
      if (chunk.length < 1000) break;
    }
    for (const [tn, set] of perTeam) {
      const t = teamAgg.get(tn);
      if (t) t.completed = set.size;
    }
  }
  const teams: AdminTeam[] = [...teamAgg.entries()]
    .map(([teamNumber, v]) => ({ teamNumber, members: v.members, completed: v.completed }))
    .sort((a, b) => b.completed - a.completed || b.members - a.members);

  const totalUniqueTeams = new Set(
    (allProfs as { team_number: number | null }[])
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
  const onlineMembers = (onlineRes.data ?? []).length;
  // Anonymous/guest browsers active in the SAME 5-minute window used for the
  // member count above — everyone (members included) fires the page-view
  // beacon, so online_visitors is normally a superset of onlineMembers. Using
  // one consistent window means the two counts can't disagree on their window;
  // max() then just guarantees a floor (a member whose heartbeat landed without
  // a beacon in the window still counts).
  //
  // online_visitors also excludes the backfill now. That changes nothing today
  // — the synthetic rows are five weeks old and this window is five minutes —
  // but it is a distinct-visitor count, and the next reconstruction script to
  // stamp rows with now() would otherwise inflate a LIVE tile.
  const onlineVisitorsRes = await supabase.rpc("online_visitors", { minutes: 5 });
  const onlineVisitors = Number((onlineVisitorsRes.data as number | null) ?? 0);
  const onlineNow = Math.max(onlineMembers, onlineVisitors);

  // ── Acquisition sources + referrals (from the profiles we already fetched) ──
  type ProfRow = {
    id: string;
    full_name: string | null;
    username: string | null;
    referred_by: string | null;
    source: string | null;
    hide_name: boolean | null;
    created_at: string;
  };
  // Reuse the fully-paginated profile list fetched above (typed for this block).
  const profRows = allProfs as unknown as ProfRow[];

  const aggSources = (rows: ProfRow[]) => {
    const counts = new Map<string, number>();
    for (const p of rows) {
      const key = (p.source && p.source.trim()) || "Unknown / Direct";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  };
  const sources = aggSources(profRows);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const sources7d = aggSources(
    profRows.filter((p) => p.created_at && +new Date(p.created_at) >= weekAgo)
  );

  const referralUsers = profRows.filter((p) => p.referred_by != null).length;
  const recruiterCounts = new Map<string, number>();
  for (const p of profRows) {
    if (!p.referred_by) continue;
    recruiterCounts.set(p.referred_by, (recruiterCounts.get(p.referred_by) ?? 0) + 1);
  }
  const recruiters = [...recruiterCounts.entries()]
    .map(([refId, count]) => {
      const r = pmap.get(refId) as ProfRow | undefined;
      const name =
        (r && !r.hide_name && (r.full_name || r.username)) ||
        r?.username ||
        "Member";
      return { name, username: r?.username ?? null, referrals: count };
    })
    .sort((a, b) => b.referrals - a.referrals);

  // Which surface earned each referral (SQL aggregate above). Postgres bigints
  // arrive as strings. A null `surface` means the signup predates attribution —
  // it is kept as its own bucket so the totals still reconcile with
  // `referralUsers` above; the panel labels it rather than dropping it.
  const referralSurfaces = ((referralSurfacesRes.data as
    | { surface: string | null; signups: number | string; signups_7d: number | string }[]
    | null) ?? []).map((r) => ({
    surface: r.surface ?? null,
    signups: Number(r.signups ?? 0),
    signups7d: Number(r.signups_7d ?? 0),
  }));

  // ── Blog-article views (from the SQL aggregate above) ─────────────
  // Postgres bigints arrive as strings, so coerce everything through Number().
  type AVRow = { slug: string; views: number | string; views_7d: number | string };
  const avRows = (articleViewsRes.data as AVRow[] | null) ?? [];
  const avMap = new Map(avRows.map((r) => [r.slug, r]));
  const allArticles = await getArticles();
  const articleViews = allArticles.map((a) => ({
    slug: a.slug,
    title: a.title,
    views: Number(avMap.get(a.slug)?.views ?? 0),
  })).sort((x, y) => y.views - x.views);
  const articleViewsTotal = avRows.reduce((s, r) => s + Number(r.views ?? 0), 0);

  // ── Site-wide pageviews + top pages / lessons (SQL-aggregated) ─────
  // Every figure here is MEASURED traffic: page_view_summary reads
  // page_views_measured, so the 992 reconstructed rows are already out. The
  // `backfill_*` columns are what was held back — carried through to the panel
  // as its own labelled line, never added into the totals.
  const pvs = ((pageSummaryRes.data as
    | {
        total: number | string;
        views_7d: number | string;
        views_30d: number | string;
        visitors: number | string;
        visitors_30d: number | string;
        visitors_7d: number | string;
        views_since: string | null;
        visitors_since: string | null;
        backfill_views: number | string;
        backfill_visitors: number | string;
        backfill_from: string | null;
        backfill_to: string | null;
      }[]
    | null) ?? [])[0];
  const pageViewsTotal = Number(pvs?.total ?? 0);
  const uniqueVisitors = Number(pvs?.visitors ?? 0);
  const uniqueVisitors30d = Number(pvs?.visitors_30d ?? 0);
  const analytics: AnalyticsCoverage = {
    viewsSince: pvs?.views_since ?? null,
    visitorsSince: pvs?.visitors_since ?? null,
    backfillViews: Number(pvs?.backfill_views ?? 0),
    backfillVisitors: Number(pvs?.backfill_visitors ?? 0),
    backfillFrom: pvs?.backfill_from ?? null,
    backfillTo: pvs?.backfill_to ?? null,
  };
  const topLessons = ((topLessonsRes.data as
    | { slug: string; title: string; completions: number | string }[]
    | null) ?? []).map((r) => ({
    slug: r.slug,
    title: r.title,
    completions: Number(r.completions),
  }));

  // Where UNIQUE VISITORS came from (one first-touch source per visitor).
  // This was the worst-corrupted number on the panel: all 150 `seed:`
  // pseudo-visitors carried `source = 'backfill'`, so the pie chart rendered
  // "backfill" as the fourth-largest acquisition channel on the site (150
  // visitors, ahead of Chief Delphi's 143). The RPC now excludes them, so the
  // channel is gone and no real channel's count moved.
  const vsRows = (visitorSourcesRes.data as
    | { source: string; all_time: number | string; last_7d: number | string }[]
    | null) ?? [];
  const visitorSources = vsRows
    .map((r) => ({ name: r.source, count: Number(r.all_time) }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  const visitorSources7d = vsRows
    .map((r) => ({ name: r.source, count: Number(r.last_7d) }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  // Guest (no-account) learning.
  const gs = ((guestStatsRes.data as
    | { guest_completions: number | string; guest_learners: number | string; guest_completions_7d: number | string; guest_learners_7d: number | string }[]
    | null) ?? [])[0];
  const guestCompletions = Number(gs?.guest_completions ?? 0);
  const guestLearners = Number(gs?.guest_learners ?? 0);

  // Guide audience rollup (admin_guide_views_summary); bigints arrive as
  // strings. The view now reads page_views_measured: 842 of the backfill's 992
  // rows were /guides/ paths, which had inflated `views` by the same 842 and
  // `viewers` by the 73 distinct `seed:` ids among them.
  const gvSummary = (((guideViewsSummaryRes.data as { views: number | string; viewers: number | string }[] | null) ?? []))[0];
  const guideViewsTotal = Number(gvSummary?.views ?? 0);
  const guideViewersTotal = Number(gvSummary?.viewers ?? 0);

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
    signups30d: countOf(signups30dRes),
    completions30d: countOf(completions30dRes),
    topDepartments,
    recentSignups,
    teams,
    totalUniqueTeams,
    recentCompletions,
    achievementBreakdown,
    onlineNow,
    sources,
    sources7d,
    referralUsers,
    recruiters,
    referralSurfaces,
    daily,
    articleViewsTotal,
    articleViews,
    pageViewsTotal,
    uniqueVisitors,
    uniqueVisitors30d,
    analytics,
    topLessons,
    visitorSources,
    visitorSources7d,
    guestCompletions,
    guestLearners,
    guideViewsTotal,
    guideViewersTotal,
  };
}

export type PendingEdit = {
  id: string;
  lessonId: string;
  lessonTitle: string;
  lessonPath: string;
  editor: string;
  note: string | null;
  original: string;
  proposed: string;
  createdAt: string;
};

/** Pending community edit suggestions, newest first (admin panel review queue). */
export async function getPendingEdits(): Promise<PendingEdit[]> {
  const admin = createAdminClient();
  const { data: edits } = await admin
    .from("content_edits")
    .select(
      "id, content_type, lesson_id, article_id, editor_id, original_content, proposed_content, note, created_at"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);
  if (!edits?.length) return [];

  const lessonIds = [...new Set(edits.map((e) => e.lesson_id).filter(Boolean))] as string[];
  const articleIds = [...new Set(edits.map((e) => e.article_id).filter(Boolean))] as string[];
  const editorIds = [...new Set(edits.map((e) => e.editor_id as string))];

  const [{ data: lessons }, articlesRes, { data: profs }] = await Promise.all([
    lessonIds.length
      ? admin.from("lessons").select("id, slug, title, modules(slug, departments(slug))").in("id", lessonIds)
      : Promise.resolve({ data: [] }),
    articleIds.length
      ? admin.from("articles").select("id, slug, title").in("id", articleIds)
      : Promise.resolve({ data: [] as { id: string; slug: string; title: string }[] }),
    admin.from("profiles").select("id, full_name, username").in("id", editorIds),
  ]);

  type LessonRow = {
    id: string;
    slug: string;
    title: string;
    modules: { slug: string; departments: { slug: string } | null } | null;
  };
  const lessonById = new Map(
    ((lessons as unknown as LessonRow[]) ?? []).map((l) => [l.id, l])
  );
  const articleById = new Map(
    ((articlesRes.data as { id: string; slug: string; title: string }[]) ?? []).map((a) => [a.id, a])
  );
  const nameById = new Map(
    ((profs as { id: string; full_name: string | null; username: string | null }[]) ?? []).map(
      (p) => [p.id, p.full_name || p.username || "A member"]
    )
  );

  return edits.map((e) => {
    let title = "Unknown";
    let path = "/";
    if (e.content_type === "article") {
      const a = articleById.get(e.article_id as string);
      title = a?.title ?? "Unknown article";
      path = a ? `/blog/${a.slug}` : "/blog";
    } else {
      const l = lessonById.get(e.lesson_id as string);
      const deptSlug = l?.modules?.departments?.slug ?? "";
      const modSlug = l?.modules?.slug ?? "";
      title = l?.title ?? "Unknown lesson";
      path = l && deptSlug && modSlug ? `/guides/${deptSlug}/${modSlug}/${l.slug}` : "/guides";
    }
    return {
      id: e.id as string,
      lessonId: (e.lesson_id ?? e.article_id) as string,
      lessonTitle: title,
      lessonPath: path,
      editor: nameById.get(e.editor_id as string) ?? "A member",
      note: (e.note as string) ?? null,
      original: (e.original_content as string) ?? "",
      proposed: (e.proposed_content as string) ?? "",
      createdAt: e.created_at as string,
    };
  });
}

export type PendingSubmission = {
  id: string;
  title: string;
  department: string;
  moduleLabel: string;
  submitter: string;
  note: string | null;
  summary: string | null;
  content: string;
  createdAt: string;
};

/** Pending new-lesson submissions, newest first (admin review queue). */
export async function getPendingSubmissions(): Promise<PendingSubmission[]> {
  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("content_submissions")
    .select(
      "id, submitter_id, department_id, module_id, new_module_title, title, summary, content, note, created_at"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);
  if (!subs?.length) return [];

  type SubRow = {
    id: string;
    submitter_id: string;
    department_id: string;
    module_id: string | null;
    new_module_title: string | null;
    title: string;
    summary: string | null;
    content: string;
    note: string | null;
    created_at: string;
  };
  const rows = subs as unknown as SubRow[];
  const deptIds = [...new Set(rows.map((s) => s.department_id))];
  const modIds = [...new Set(rows.map((s) => s.module_id).filter(Boolean))] as string[];
  const subIds = [...new Set(rows.map((s) => s.submitter_id))];

  const [depts, mods, profs] = await Promise.all([
    admin.from("departments").select("id, name").in("id", deptIds),
    modIds.length
      ? admin.from("modules").select("id, title").in("id", modIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    admin.from("profiles").select("id, full_name, username").in("id", subIds),
  ]);
  const deptById = new Map(
    ((depts.data as { id: string; name: string }[]) ?? []).map((d) => [d.id, d.name])
  );
  const modById = new Map(
    ((mods.data as { id: string; title: string }[]) ?? []).map((m) => [m.id, m.title])
  );
  const nameById = new Map(
    ((profs.data as { id: string; full_name: string | null; username: string | null }[]) ?? []).map(
      (p) => [p.id, p.full_name || p.username || "A member"]
    )
  );

  return rows.map((s) => ({
    id: s.id,
    title: s.title,
    department: deptById.get(s.department_id) ?? "—",
    moduleLabel: s.module_id
      ? (modById.get(s.module_id) ?? "an existing module")
      : `New module: ${s.new_module_title ?? "Community Lessons"}`,
    submitter: nameById.get(s.submitter_id) ?? "A member",
    note: s.note ?? null,
    summary: s.summary ?? null,
    content: s.content,
    createdAt: s.created_at,
  }));
}
