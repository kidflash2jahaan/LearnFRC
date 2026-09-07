/**
 * THE ADMIN PANEL'S NUMBERS, AND WHERE EACH ONE COMES FROM
 *
 * Two sources, split on one line: Vercel measures traffic, the database holds
 * application facts.
 *
 *  - TRAFFIC comes from Vercel Web Analytics, through
 *    `src/lib/vercel-analytics.ts`: page views, unique visitors, the daily
 *    views and visitors series, referrers, per-article reads, guide reads.
 *    The homegrown `page_views` beacon that used to answer those questions is
 *    retired and nothing writes that table any more, so reading it here would
 *    print a frozen number that quietly ages. Vercel is also the better
 *    measure: it counts readers who never reach our own JavaScript.
 *  - EVERYTHING ELSE stays on Supabase, because Vercel cannot answer it.
 *    Accounts, signups, activation, retention, completions, XP, bookmarks,
 *    achievements, teams, referrals, feedback, edits, submissions, presence,
 *    the funnel. Anything joined to a user id is a database question by
 *    definition, and Vercel holds no user ids.
 *
 * The two are never added together and no figure here is half of each.
 * `daily` is the single row carrying both, and it keeps them in separate
 * keys: signups and completions from Postgres, views and visitors from
 * Vercel, on one shared day axis.
 *
 * WHEN VERCEL CANNOT ANSWER
 * Every traffic query is independent, and none of them can throw: the client
 * returns a typed failure instead of rejecting. A revoked token, a spent rate
 * limit or an unset env var therefore costs that one figure and never the
 * page, every database number still renders, and `analytics.viewsSince` goes
 * null so the panel stops claiming a coverage window it cannot back. A zero
 * that arrives that way is a placeholder, not a measurement.
 */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { countDistinctTeams, isPlausibleTeamNumber } from "@/lib/frc-team";
import { getArticles } from "@/lib/queries";
import {
  getReferrerBreakdown,
  getTrafficBreakdown,
  getTrafficSeries,
  getTrafficTotals,
  trafficWindow,
  type AnalyticsFailureKind,
  type AnalyticsResult,
  type FilterClause,
  type ReferrerBreakdown,
} from "@/lib/vercel-analytics";

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
 * What the traffic figures actually cover.
 *
 * This used to describe three eras of the `page_views` table, one of them 992
 * synthetic rows reconstructed from lesson completions, which is how a
 * 100%-activation illusion once got into a growth analysis. That table is
 * retired and none of it applies now, so these fields say something simpler:
 * the window Vercel was asked about.
 *
 * The caveat still worth printing is that "all time" is not forever. This plan
 * keeps 366 days, so the standing totals are a rolling window that will one
 * day start dropping its oldest days off the back. `viewsSince` is where that
 * window begins, and it is null when Vercel could not be reached at all, which
 * is the difference between a measured zero and an unanswered question.
 */
export type AnalyticsCoverage = {
  /**
   * Start of the Vercel window every all-time traffic figure covers. Null when
   * the query failed or no token is configured, so the panel can drop the
   * coverage line rather than date a number nobody measured.
   */
  viewsSince: string | null;
  /**
   * Null, always, and that means "no such boundary exists". The old beacon
   * counted views for three weeks before it started sending visitor ids, so
   * per-person numbers legitimately began later than raw ones. Vercel
   * identifies every visit it records, so unique visitors cover exactly the
   * window above and there is no second date to print.
   */
  visitorsSince: string | null;
  /** Zero. The synthetic rows lived in `page_views`, which nothing reads now. */
  backfillViews: number;
  /** Zero, same reason: nothing reaching this panel is reconstructed. */
  backfillVisitors: number;
  backfillFrom: string | null;
  backfillTo: string | null;
  /**
   * Why the traffic queries could not answer, or null when they did.
   *
   * WITHOUT THIS the panel could not tell a measured zero from an unanswered
   * question. Every traffic figure falls back to 0 when a query fails, and a
   * dead token, a spent rate limit or Web Analytics being switched off would
   * therefore print "0 unique visitors" in stamp type with nothing beside it
   * saying the number was never measured. That is the exact failure this whole
   * file is written against, and the client already builds the sentence: it was
   * being thrown away one line later by `measured()`. The panel prints this in
   * the same note the missing-credentials case uses.
   */
  failure: { kind: AnalyticsFailureKind; message: string } | null;
};

/**
 * One calendar day of activity for the chart, on a UTC day axis.
 *
 * Two sources on one row, never mixed: `signups` and `completions` are counted
 * in Postgres, `views` and `visitors` are Vercel's day buckets. `visitors` is
 * distinct visitors WITHIN the day, so the series must not be summed to get a
 * window total (the chart's legend figures are true window counts instead).
 */
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
  /** Every measured view on the blog-article route, over the Vercel window. */
  articleViewsTotal: number;
  /** True when the two totals above came from the banked ledger, not live. */
  trafficFromLedger: boolean;
  /**
   * Per-article view counts, most read first, incl. zero-view articles. Views
   * are Vercel's, titles are the articles table's: Vercel only knows the path.
   */
  articleViews: { slug: string; title: string; views: number }[];
  /** Site-wide measured page views (all pages), over the Vercel window. */
  pageViewsTotal: number;
  /** Unique visitors over the same window, as Vercel counts them. */
  uniqueVisitors: number;
  uniqueVisitors30d: number;
  /**
   * Unique visitors over the last 7 days.
   *
   * Exists because the sources drawer opens on "Visitors / last 7 days" and its
   * headline figure must be a real headcount for THAT window. Visitor rows are
   * not additive across referrers (one person who arrives direct on Monday and
   * from Google on Friday is in both rows), so the chart is handed an
   * authoritative total instead of summing them — and the authoritative total
   * has to cover the same window as the rows underneath it, or the fix for the
   * summing bug just moves the error somewhere else.
   */
  uniqueVisitors7d: number;
  /** What window every traffic figure above covers, and whether it was measured. */
  analytics: AnalyticsCoverage;
  /** Most-completed lessons. */
  topLessons: { slug: string; title: string; completions: number }[];
  /**
   * Where visitors came from, by referring host, folded (all-time / last 7d).
   * Each search engine is one row rather than four, our own Google OAuth return
   * leg is not a source, and neither are hops between our own domains.
   */
  visitorSources: { name: string; count: number }[];
  visitorSources7d: { name: string; count: number }[];
  /** Guest (no-account) learning — completions + distinct learners. */
  guestCompletions: number;
  guestLearners: number;
  /** Measured views on guide lesson pages, over the Vercel window. */
  guideViewsTotal: number;
  /**
   * Distinct people behind those views, over the same window and the same
   * filter, which is what makes the pair comparable. See `GUIDE_LESSON_ROUTE`
   * for why the filter is the lesson route rather than the whole /guides tree.
   */
  guideViewersTotal: number;
};

/** Number of trailing calendar days rendered in the activity chart. */
const DAILY_WINDOW = 30;

/** The "last 7 days" half of the sources control. */
const RECENT_WINDOW = 7;

/**
 * "All time", as far as this plan can see. Vercel keeps 366 days and refuses a
 * wider window, so every standing total on this panel is really a rolling year.
 * `analytics.viewsSince` prints where it starts, which is the only honest way
 * to label a number called all-time that is not.
 */
const ALL_TIME_WINDOW = 366;

/**
 * Seconds a traffic answer stays cached. The API allows 400 requests an hour
 * and one render of this panel is eight queries, so a continuously-watched
 * admin page costs about 96 an hour at five minutes. It also keeps the window
 * (and therefore the cache key) stable for exactly as long as the entry lives.
 */
const TRAFFIC_REVALIDATE = 300;

/**
 * Blog articles, by Next.js route pattern. Grouping by `requestPath` UNDER
 * this filter is what makes the per-article list usable: Vercel names at most
 * 100 values per dimension, and an unfiltered path breakdown would spend that
 * budget on guides, tools and the home page long before it reached the
 * articles. Filtered, every named row is an article.
 */
const BLOG_ARTICLE_ROUTE: FilterClause = {
  dimension: "route",
  op: "eq",
  value: "/blog/[slug]",
};

/**
 * Guide lesson pages. The /guides tree is four route patterns (the index, a
 * department, a module, a lesson) and an OData filter here can only match one
 * value at a time. Views across the four could be added up, but DISTINCT
 * VISITORS could not: a reader who opened the index and then a lesson is one
 * person in two rows. Since `guideViewsTotal` and `guideViewersTotal` are
 * printed next to each other, both come from this single filter so they
 * describe one population. The index pages are navigation; a lesson page is
 * the guide.
 */
const GUIDE_LESSON_ROUTE: FilterClause = {
  dimension: "route",
  op: "eq",
  value: "/guides/[department]/[module]/[lesson]",
};

/** Named referrer rows kept before the rest folds into one remainder. */
const SOURCE_ROWS = 12;

/** Vercel names at most 100 values per dimension; keep all of them. */
const ARTICLE_ROWS = 100;

/** Format a Date as a UTC `YYYY-MM-DD` key (matches Vercel's day buckets). */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Attaches a rejection handler the moment a traffic query starts.
 *
 * The client answers with a typed failure rather than throwing, so this should
 * never fire. It exists because these promises are created before the database
 * batch is awaited: an unexpected rejection with no handler yet attached would
 * take down the whole render, and one unreachable analytics API must never
 * cost the panel its database figures.
 */
function guard<T>(
  promise: Promise<AnalyticsResult<T>>
): Promise<AnalyticsResult<T> | null> {
  return promise.catch(() => null);
}

/** The data when the query answered, null when it did not. */
function measured<T>(result: AnalyticsResult<T> | null): T | null {
  return result && result.ok ? result.data : null;
}

/**
 * `/blog/a-slug/?utm=x` to `/blog/a-slug`, so one article cannot be split
 * across two rows by a trailing slash or a tracking parameter.
 */
function normalizePath(raw: string): string {
  const path = raw.split(/[?#]/, 1)[0] ?? raw;
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/**
 * A folded referrer breakdown, in the `{ name, count }` shape the acquisition
 * chart takes.
 *
 * Direct traffic is a row, because "typed the URL or came from a bookmark" is
 * a real answer to where people come from and dropping it would make every
 * other share look bigger than it is. The two hops that are NOT acquisition
 * stay out: `accounts.google.com` is our own Google sign-in round trip coming
 * back, and a referral from one of our own domains is a reader moving around
 * inside the site. The client's fold has already merged cn.bing.com into Bing
 * and noai.duckduckgo.com into DuckDuckGo, so search is not split four ways.
 */
function toVisitorSources(
  breakdown: ReferrerBreakdown | null
): { name: string; count: number }[] {
  if (!breakdown) return [];

  const rows = breakdown.rows.map((r) => ({ name: r.label, count: r.visitors }));
  if (breakdown.direct.visitors > 0) {
    rows.push({ name: "Direct", count: breakdown.direct.visitors });
  }
  if (breakdown.other && breakdown.other.visitors > 0) {
    rows.push({ name: "Everything else", count: breakdown.other.visitors });
  }

  return rows.filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
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

  // ── Traffic, from Vercel ──────────────────────────────────────────
  // Started here, before the database batch below is awaited, so the two sets
  // of round trips overlap instead of queueing. `guard` attaches a rejection
  // handler to each one immediately, which is what makes starting them early
  // safe. All three windows are built once and passed as objects: every query
  // then shares one `since`/`until` pair, so the numbers on the panel line up
  // with each other and the cache keys stay stable between renders.
  const allTime = trafficWindow(ALL_TIME_WINDOW, { revalidate: TRAFFIC_REVALIDATE });
  const lastMonth = trafficWindow(DAILY_WINDOW, { revalidate: TRAFFIC_REVALIDATE });
  const lastWeek = trafficWindow(RECENT_WINDOW, { revalidate: TRAFFIC_REVALIDATE });
  const cached = { revalidate: TRAFFIC_REVALIDATE };

  const trafficTotalsP = guard(getTrafficTotals({ ...cached, window: allTime }));
  const traffic30dP = guard(getTrafficTotals({ ...cached, window: lastMonth }));
  const traffic7dP = guard(getTrafficTotals({ ...cached, window: lastWeek }));
  const trafficSeriesP = guard(getTrafficSeries({ ...cached, window: lastMonth }));
  const sourcesAllP = guard(
    getReferrerBreakdown({ ...cached, window: allTime, top: SOURCE_ROWS })
  );
  const sources7dP = guard(
    getReferrerBreakdown({ ...cached, window: lastWeek, top: SOURCE_ROWS })
  );
  const articlePathsP = guard(
    getTrafficBreakdown("requestPath", {
      ...cached,
      window: allTime,
      filter: [BLOG_ARTICLE_ROUTE],
      top: ARTICLE_ROWS,
    })
  );
  const guideTrafficP = guard(
    getTrafficTotals({ ...cached, window: allTime, filter: [GUIDE_LESSON_ROUTE] })
  );

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
    topLessonsRes,
    guestStatsRes,
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
    // Reads lesson_progress, which is a record of what people did, not of what
    // was served. Vercel could rank the most-VIEWED lesson pages; only the
    // database knows which lessons were finished.
    supabase.rpc("top_lessons", { lim: 8 }),
    supabase.rpc("guest_progress_stats"),
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
  // Every traffic answer, resolved together. They have been in flight since
  // before the database batch above, so this waits on whichever is still out
  // rather than on all seven.
  const [
    trafficTotalsRes,
    traffic30dRes,
    traffic7dRes,
    trafficSeriesRes,
    sourcesAllRes,
    sources7dRes,
    articlePathsRes,
    guideTrafficRes,
  ] = await Promise.all([
    trafficTotalsP,
    traffic30dP,
    traffic7dP,
    trafficSeriesP,
    sourcesAllP,
    sources7dP,
    articlePathsP,
    guideTrafficP,
  ]);

  // Vercel's day buckets, keyed the same way the loop below reads them: a UTC
  // `YYYY-MM-DD`. Vercel returns an explicit zero row for a quiet day rather
  // than dropping it, so a gap here means the query failed, not that nobody
  // came.
  const viewsByDay = new Map<string, number>();
  const visitorsByDay = new Map<string, number>();
  for (const point of measured(trafficSeriesRes)?.points ?? []) {
    viewsByDay.set(point.day, point.pageviews);
    visitorsByDay.set(point.day, point.visitors);
  }

  // Last DAILY_WINDOW calendar days, oldest → newest, missing days filled with 0.
  const daily: DailyPoint[] = [];
  for (let i = DAILY_WINDOW - 1; i >= 0; i--) {
    const key = dayKey(new Date(now - i * DAY));
    daily.push({
      day: key,
      signups: signupsByDay.get(key) ?? 0,
      completions: completionsByDay.get(key) ?? 0,
      views: viewsByDay.get(key) ?? 0,
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
    // Same plausibility rule as the count below, so the "top teams" list cannot
    // rank a team the tally above says does not exist.
    if (!isPlausibleTeamNumber(p.team_number)) continue;
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

  // Same predicate the home page's public counter uses. Both surfaces print
  // the label "FRC teams represented"; when only one of them filtered
  // placeholder entries the site read 173 in one place and 175 in the other for
  // the same words. The rule lives in @/lib/frc-team so it cannot drift again.
  const totalUniqueTeams = countDistinctTeams(
    allProfs as { team_number: number | null }[]
  );

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
  // member count above. This used to be a superset of onlineMembers, because
  // everyone fired the page-view beacon; that beacon is retired, so the RPC
  // reads a table nothing writes and now answers 0, leaving the signed-in
  // heartbeat as the live number. The max() was always a floor, so the tile
  // still reports what it says it reports rather than silently going empty.
  //
  // Vercel cannot replace this one: it reports a window of days, not who is
  // on the site right now, and presence is a database fact about members.
  // Counting anonymous readers live again would need its own heartbeat, which
  // is a product decision and not this file's to make.
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

  // ── Blog-article views ────────────────────────────────────────────
  // Vercel knows paths, not articles, so the path is the join key and the
  // titles come from the articles table. Both halves are needed: Vercel cannot
  // name an article and the database can no longer count a read.
  //
  // The breakdown is filtered to the `/blog/[slug]` route, which is what
  // spends Vercel's 100-value naming budget on articles instead of on guides,
  // tools and the home page.
  const articlePaths = measured(articlePathsRes);
  const viewsByPath = new Map<string, number>();
  for (const row of articlePaths?.rows ?? []) {
    const path = normalizePath(row.key);
    viewsByPath.set(path, (viewsByPath.get(path) ?? 0) + row.pageviews);
  }
  const allArticles = await getArticles();
  const articleViews = allArticles
    .map((a) => ({
      slug: a.slug,
      title: a.title,
      views: viewsByPath.get(`/blog/${a.slug}`) ?? 0,
    }))
    .sort((x, y) => y.views - x.views);
  // The exact route total, not a sum of the rows above. There are more
  // articles than the 100 paths Vercel will name, and it folds the rest into
  // one unnamed remainder: those few show as zero in the list above, while
  // their views are still inside this total. The list is ordered by reads and
  // the panel prints the top of it, so the unnamed tail never reaches a
  // figure anyone reads as a ranking.
  const articleViewsTotal = articlePaths?.summedPageviews ?? 0;

  // ── Site-wide traffic ─────────────────────────────────────────────
  // Straight from Vercel, production only. A failed query leaves these at zero
  // AND `viewsSince` at null, which is how the panel tells "nobody came" from
  // "nobody asked": the coverage line only prints when a query answered.
  const trafficTotals = measured(trafficTotalsRes);

  // FALL BACK TO THE BANKED LEDGER when Vercel will not answer.
  //
  // /api/snapshot writes every closed month into `traffic_months` precisely so
  // these figures outlive Vercel's 366-day window. That ledger is equally the
  // right answer when the API is merely unreachable: a dead token is not a
  // reason to print 0 next to "unique visitors" when the real number is sitting
  // in our own database. Verified summable: month buckets add to exactly the
  // same totals a single range query returns, which is why this is a
  // substitution and not an estimate.
  let bankedVisitors: number | null = null;
  let bankedPageviews: number | null = null;
  if (!trafficTotals) {
    const { data: ledger } = await supabase
      .from("traffic_months")
      .select("visitors, pageviews");
    if (ledger && ledger.length > 0) {
      bankedVisitors = ledger.reduce((a, r) => a + (r.visitors ?? 0), 0);
      bankedPageviews = ledger.reduce((a, r) => a + (r.pageviews ?? 0), 0);
    }
  }

  const pageViewsTotal = trafficTotals?.pageviews ?? bankedPageviews ?? 0;
  const uniqueVisitors = trafficTotals?.visitors ?? bankedVisitors ?? 0;
  const uniqueVisitors30d = measured(traffic30dRes)?.visitors ?? 0;
  const uniqueVisitors7d = measured(traffic7dRes)?.visitors ?? 0;
  // The first traffic query that could not answer, in the order the panel
  // reads them. One reason is enough — a dead token fails all eight the same
  // way, and eight copies of one sentence is not eight findings. `null` is the
  // guard()ed rejection that should never happen, and it is still a failure, so
  // it gets its own sentence rather than being read as "answered".
  const trafficResults = [
    trafficTotalsRes,
    traffic30dRes,
    traffic7dRes,
    trafficSeriesRes,
    sourcesAllRes,
    sources7dRes,
    articlePathsRes,
    guideTrafficRes,
  ];
  const firstBad = trafficResults.find((r) => r === null || !r.ok);
  const trafficFailure: AnalyticsCoverage["failure"] =
    firstBad === undefined
      ? null
      : firstBad === null
        ? {
            kind: "unreachable",
            message:
              "A traffic query rejected outright, which the client is written never to do. Treat every traffic figure below as unmeasured and check the server logs.",
          }
        : firstBad.ok
          ? null
          : { kind: firstBad.kind, message: firstBad.message };
  const analytics: AnalyticsCoverage = {
    viewsSince: trafficTotalsRes?.ok ? trafficTotalsRes.window.since : null,
    // Never set. Vercel identifies every visit it records, so there is no
    // second, later date on which per-person counting began. See the type.
    visitorsSince: null,
    backfillViews: 0,
    backfillVisitors: 0,
    backfillFrom: null,
    backfillTo: null,
    failure: trafficFailure,
  };
  const topLessons = ((topLessonsRes.data as
    | { slug: string; title: string; completions: number | string }[]
    | null) ?? []).map((r) => ({
    slug: r.slug,
    title: r.title,
    completions: Number(r.completions),
  }));

  // Where visitors came from, by referring host. This is not the same question
  // as `sources` above, and the panel says so: that one is the first-touch tag
  // stored on a profile at signup, this one is measured arrivals, signed in or
  // not, over a window.
  const visitorSources = toVisitorSources(measured(sourcesAllRes));
  const visitorSources7d = toVisitorSources(measured(sources7dRes));

  // Guest (no-account) learning.
  const gs = ((guestStatsRes.data as
    | { guest_completions: number | string; guest_learners: number | string; guest_completions_7d: number | string; guest_learners_7d: number | string }[]
    | null) ?? [])[0];
  const guestCompletions = Number(gs?.guest_completions ?? 0);
  const guestLearners = Number(gs?.guest_learners ?? 0);

  // Guide audience. One filtered count, so the views and the people behind
  // them are the same population over the same window: distinct visitors are
  // exact for a filter and cannot be added up across several (see
  // GUIDE_LESSON_ROUTE).
  const guideTraffic = measured(guideTrafficRes);
  const guideViewsTotal = guideTraffic?.pageviews ?? 0;
  const guideViewersTotal = guideTraffic?.visitors ?? 0;

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
    trafficFromLedger: bankedVisitors != null,
    articleViewsTotal,
    articleViews,
    pageViewsTotal,
    uniqueVisitors,
    uniqueVisitors30d,
    uniqueVisitors7d,
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
