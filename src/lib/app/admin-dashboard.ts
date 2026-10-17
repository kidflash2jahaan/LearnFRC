import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminStats } from "@/lib/admin";
import { getPendingApplicationCount } from "@/lib/admin-team";
import { getFeedbackCounts } from "@/lib/feedback";
import { getAnalyticsAvailability } from "@/lib/vercel-analytics";
import { getRetentionStats } from "@/lib/retention";
import { getFunnelStats } from "@/lib/funnel";
import { toIso } from "@/lib/app/format";
import { NOT_ADMIN, requireSiteRole, type StaffRole } from "@/lib/app/admin-access";
import type { AppUser, Result } from "@/lib/app/result";

/**
 * /admin as data. Shared by the website's /admin page, which renders straight
 * from `loadAdminDashboard`, and the app's GET /api/app/admin/dashboard and
 * GET /api/app/admin/summary.
 *
 * A view-model on purpose: every label, hint, footnote and percentage the page
 * used to work out inline lives here, so the site and the app print the same
 * sentence over the same number and can't drift. The page keeps only what is
 * presentation (relative times, layout).
 */

/* ── Shapes ───────────────────────────────────────────────────────── */

export type DashRow = {
  label: string;
  sub: string | null;
  value: number;
  valueSuffix: string | null;
  /** 0 to 100, the gauge under the row; null draws no gauge. */
  pct: number | null;
};

export type Slice = { name: string; count: number };

export type AdminSummary = {
  role: StaffRole;
  openFeedback: number;
  feedbackTotal: number;
  /** Null unless the caller is a super admin (only they can answer these). */
  pendingApplications: number | null;
  pendingEdits: number;
  pendingSubmissions: number;
};

export type AdminDashboard = {
  role: StaffRole;
  generatedAt: string;
  /** The site re-reads /admin this often while the tab is visible. */
  refreshSeconds: 30;
  now: {
    onlineNow: number;
    openFeedback: number;
    feedbackTotal: number;
    pendingApplications: number | null;
    pendingEdits: number;
    pendingSubmissions: number;
  };
  stamps: { key: "visitors" | "pageViews" | "learners" | "completions"; value: number; label: string }[];
  notes: { traffic: { slug: string; text: string } | null; coverage: string | null };
  tally: {
    slug: string;
    rows: { label: string; value: number; suffix: string | null; hint: string | null }[];
  }[];
  growth: {
    daily: { day: string; signups: number; completions: number; views: number; visitors: number }[];
    totals: { visitors: number; signups: number; completions: number };
    footnote: string | null;
  };
  funnel: {
    rows: DashRow[];
    badge: string | null;
    note: string | null;
    anonymousRows: DashRow[];
    /** Printed under the anonymous rows whenever there are any. */
    anonymousNote: string;
    empty: string;
  };
  sources: {
    users: { week: Slice[]; allTime: Slice[] };
    visitors: { week: Slice[]; allTime: Slice[]; weekTotal: number; allTimeTotal: number };
    footnote: string;
  };
  engagement: { lessons: DashRow[]; departments: DashRow[] };
  teams: { teams: DashRow[]; recruiters: DashRow[]; surfaces: DashRow[]; surfacesFootnote: string | null };
  articles: DashRow[];
  achievements: DashRow[];
  activity: {
    newestMembers: { username: string | null; teamNumber: number | null; createdAt: string }[];
    recentCompletions: { user: string; lesson: string; at: string }[];
  };
};

/* ── Helpers moved from /admin ────────────────────────────────────── */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * `2026-07-22T23:13:50Z` to `Jul 22` (or `Jul 22, 2026`).
 *
 * UTC and table-driven on purpose. The pageview coverage windows are computed
 * in UTC SQL-side, so rendering them in the runtime's local zone would print a
 * boundary a day off from the one the numbers actually use; and
 * `toLocaleDateString` returns different strings on different ICU builds.
 */
function utcDay(iso: string | null, withYear = false): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const md = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return withYear ? `${md}, ${d.getUTCFullYear()}` : md;
}

/** A count the way the page prints it: 18,204. */
const n = (v: number) => v.toLocaleString("en-US");

type RowIn = { label: string; sub?: string | null; value: number; valueSuffix?: string | null; pct?: number | null };

function row(r: RowIn): DashRow {
  return {
    label: r.label,
    sub: r.sub ?? null,
    value: r.value,
    valueSuffix: r.valueSuffix ?? null,
    pct: r.pct ?? null,
  };
}

/** Scale a list of values to 0-100 so the gauges are comparable within one list. */
function withPct(rows: RowIn[]): DashRow[] {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return rows.map((r) => row({ ...r, pct: (r.value / max) * 100 }));
}

/**
 * Every surface that can earn a referral (the `?via=` allow-list), in journey
 * order. All four are rendered even at zero: a surface that shipped and earned
 * nothing is a finding, and it can only be read as one if the row is present.
 */
const REFERRAL_SURFACES: { key: string; label: string }[] = [
  { key: "lesson-milestone", label: "Lesson milestone" },
  { key: "certificate", label: "Certificate" },
  { key: "dashboard", label: "Dashboard" },
  { key: "leaderboard", label: "Leaderboard" },
];

/* ── Counts ───────────────────────────────────────────────────────── */

/**
 * Exact pending counts, cheap head queries. These used to be the length of the
 * 100-row review lists, which stops being true at 101.
 */
async function pendingCount(table: "content_edits" | "content_submissions"): Promise<number> {
  const { count } = await createAdminClient()
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}

async function readNow(role: StaffRole) {
  const [feedback, pendingEdits, pendingSubmissions, pendingApplications] = await Promise.all([
    getFeedbackCounts(),
    pendingCount("content_edits"),
    pendingCount("content_submissions"),
    // Only a super admin sees the line this feeds, so a plain admin does not
    // pay for the query at all.
    role === "superadmin" ? getPendingApplicationCount() : Promise.resolve(null),
  ]);
  return {
    openFeedback: feedback.openCount,
    feedbackTotal: feedback.total,
    pendingApplications,
    pendingEdits,
    pendingSubmissions,
  };
}

/** The badge counts, without the expensive site-wide figures. */
export async function loadAdminSummary(user: AppUser): Promise<Result<AdminSummary>> {
  const gate = await requireSiteRole(user, "admin", NOT_ADMIN);
  if (!gate.ok) return gate;
  return { ok: true, role: gate.role, ...(await readNow(gate.role)) };
}

/* ── The whole page ───────────────────────────────────────────────── */

export async function loadAdminDashboard(user: AppUser): Promise<Result<AdminDashboard>> {
  const gate = await requireSiteRole(user, "admin", NOT_ADMIN);
  if (!gate.ok) return gate;
  const role = gate.role;

  const [stats, retention, funnel, now] = await Promise.all([
    getAdminStats(),
    getRetentionStats(),
    getFunnelStats(),
    readNow(role),
  ]);

  const completionsAll = stats.totals.completions + stats.guestCompletions;

  // ── What the traffic numbers actually cover ──────────────────────
  // Printing the window is the whole point of this block: a growth analysis
  // read straight across the eras once got a ~100% activation rate out of rows
  // that, by construction, exist only for people who had already completed a
  // lesson. A reader who can see "since Jul 22" cannot make that mistake twice.
  // Year included on purpose: the Vercel window opens 366 days back, so a bare
  // "Sep 6" reads as TODAY and makes a year of page views look like one day's.
  const analyticsAvailability = getAnalyticsAvailability();
  // Why the traffic figures cannot be believed, or null when they can. TWO WAYS
  // TO FAIL: missing credentials, or a token that is present but dead, a spent
  // rate limit, or Web Analytics switched off. A zero that arrives either way
  // is a placeholder, not a measurement, and this line says which it is.
  const trafficUnmeasured = !analyticsAvailability.configured
    ? analyticsAvailability.message
    : stats.analytics.failure
      ? stats.trafficFromLedger
        ? // The headline pair is real, just not live. Say which is which
          // rather than blanketing the whole band as unmeasured.
          `${stats.analytics.failure.message} Unique visitors and page views above come from the banked monthly ledger, which is complete through the last closed month and is where these numbers are kept permanently. Everything else here that needs live traffic is unmeasured rather than zero: article and guide reads, the visitor line on the growth chart, and the Visitors half of the sources drawer.`
        : `${stats.analytics.failure.message} Every traffic figure on this page is therefore unmeasured, not zero: unique visitors, page views, article and guide reads, the visitor line on the growth chart, and the Visitors half of the sources drawer.`
      : null;
  const viewsSince = utcDay(stats.analytics.viewsSince, true);
  const visitorsSince = utcDay(stats.analytics.visitorsSince, true);
  const coverageParts: string[] = [];
  // BOTH traffic figures, not just page views: they are the rolling year Vercel
  // keeps, not the whole history of the site.
  if (viewsSince)
    coverageParts.push(
      `Page views and unique visitors are Vercel's, and Vercel keeps a rolling 366 days, so both of those cover ${viewsSince} onward rather than the whole history. Every figure read out of the database does go back to the first signup`
    );
  if (visitorsSince)
    coverageParts.push(
      `every per-person number (unique visitors, guide viewers, acquisition sources) since ${visitorsSince}, when the beacon began sending visitor ids`
    );
  const backfillFrom = utcDay(stats.analytics.backfillFrom, true);
  const backfillTo = utcDay(stats.analytics.backfillTo, true);
  const coverageNote = [
    coverageParts.length > 0 ? `${coverageParts.join("; ")}.` : null,
    stats.analytics.backfillViews > 0
      ? `A further ${n(stats.analytics.backfillViews)} rows${
          backfillFrom && backfillTo ? ` (${backfillFrom} to ${backfillTo})` : ""
        } reconstructed from lesson completions and labelled source=backfill are held out of every figure here and are not added in anywhere: they exist only for people who already finished a lesson, so any funnel built on them reads ~100% by construction.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  // ── Drawers ──────────────────────────────────────────────────────
  const lessonRows = withPct(
    stats.topLessons.slice(0, 8).map((l) => ({ label: l.title, value: l.completions }))
  );
  const deptRows = withPct(
    stats.topDepartments.slice(0, 8).map((d) => ({ label: d.name, value: d.completions ?? 0 }))
  );
  const teamRows = withPct(
    stats.teams.slice(0, 8).map((t) => ({
      label: `#${t.teamNumber}`,
      sub: `${t.members} ${t.members === 1 ? "member" : "members"}`,
      value: t.completed,
    }))
  );
  // One identifier per row, already built server-side: a handle, or a short id
  // fragment for someone who never picked one.
  const recruiterRows = withPct(
    stats.recruiters.slice(0, 8).map((r) => ({ label: r.label, value: r.referrals }))
  );
  // Referral signups by the surface that earned them. The four known surfaces
  // are scaled against EACH OTHER; referrals from before attribution existed
  // get a labelled row with NO gauge, pinned last, so the historical bucket
  // never looks like the winning channel.
  const bySurface = new Map(stats.referralSurfaces.map((s) => [s.surface ?? "", s]));
  const untrackedReferrals = bySurface.get("")?.signups ?? 0;
  const attributedReferrals = stats.referralSurfaces
    .filter((s) => s.surface)
    .reduce((sum, s) => sum + s.signups, 0);
  // A surface key the server sends that REFERRAL_SURFACES does not know yet is
  // rendered under its raw key rather than dropped, so the total reconciles.
  const unknownSurfaces = stats.referralSurfaces
    .map((s) => s.surface)
    .filter((k): k is string => !!k && !REFERRAL_SURFACES.some((r) => r.key === k))
    .map((key) => ({ key, label: key }));
  const surfaceRows: DashRow[] = [
    ...withPct(
      [...REFERRAL_SURFACES, ...unknownSurfaces]
        .map(({ key, label }) => {
          const s = bySurface.get(key);
          return {
            label,
            sub: s && s.signups7d > 0 ? `${s.signups7d} this week` : null,
            value: s?.signups ?? 0,
          };
        })
        .sort((a, b) => b.value - a.value)
    ),
    ...(untrackedReferrals > 0
      ? [row({ label: "Before tracking", sub: "surface unknown", value: untrackedReferrals })]
      : []),
  ];

  // ── Activation funnel ────────────────────────────────────────────
  // NOT run through withPct(): the gauge is each step's share of the FIRST
  // step, which is what makes the list read as a funnel narrowing to a point.
  const funnelRows = funnel.rows.map((r) =>
    row({
      label: r.label,
      // The conversion INTO this step. Bases are mostly the previous row; see
      // STEP_META in src/lib/funnel.ts for the one deliberate exception.
      sub: r.baseLabel ? `${r.conversionPct}% of ${r.baseLabel}` : null,
      value: r.count,
      pct: r.pctOfStart,
    })
  );
  // Logged-out readers who reached a step before they had an account. Only
  // when there is something to show.
  const funnelAnonRows = withPct(
    funnel.rows.filter((r) => r.anonymous > 0).map((r) => ({ label: r.label, value: r.anonymous }))
  );
  // Kept SHORT on purpose: the site's chip is nowrap, so a long badge would push
  // the drawer header sideways at 375px.
  const funnelBadge = funnel.worstDrop
    ? `-${funnel.worstDrop.lostPct}% ${funnel.worstDrop.label}`
    : null;
  // Which rows can be believed: 'Opened a lesson' and 'Attempted a quiz' have no
  // source in the schema, so until the beacon fires they show the floor.
  const funnelNote =
    funnel.rows.length === 0
      ? null
      : funnel.inferredSteps.length > 0
        ? `${funnel.inferredSteps.join(" and ")} ${
            funnel.inferredSteps.length === 1 ? "is" : "are"
          } a floor, not a measurement. Nothing has ever recorded them, so the count shown is everyone who completed a lesson, because you cannot finish one without opening it and passing its quiz. They separate from the completed row the moment the beacon fires on a reader who opens a lesson and stops. Every other row is exact, back to the first signup.`
        : `Every step measured directly, ${n(funnel.recorded)} events recorded.`;

  return {
    ok: true,
    role,
    generatedAt: new Date().toISOString(),
    refreshSeconds: 30,
    now: { onlineNow: stats.onlineNow, ...now },
    stamps: [
      {
        key: "visitors",
        value: stats.uniqueVisitors,
        label: `unique visitors${visitorsSince ? `, since ${visitorsSince}` : ""}`,
      },
      {
        key: "pageViews",
        value: stats.pageViewsTotal,
        label: `page views, ${n(stats.articleViewsTotal)} of them on articles`,
      },
      {
        key: "learners",
        value: stats.totals.users + stats.guestLearners,
        label: `learners: ${n(stats.totals.users)} accounts (including unverified) + ${n(stats.guestLearners)} guest learners`,
      },
      {
        key: "completions",
        value: completionsAll,
        label: `lessons completed${
          stats.guestCompletions > 0 ? `, ${n(stats.guestCompletions)} by guests` : ""
        }`,
      },
    ],
    notes: {
      traffic: trafficUnmeasured
        ? {
            slug: stats.trafficFromLedger
              ? "traffic is coming from the banked ledger"
              : "traffic panels are not measuring",
            text: trafficUnmeasured,
          }
        : null,
      coverage: coverageNote || null,
    },
    tally: [
      {
        slug: "tally / reach",
        rows: [
          // Same figure and same rule as the home page's public counter.
          {
            label: "FRC teams represented",
            value: stats.totalUniqueTeams,
            suffix: null,
            hint: "distinct team numbers on profiles, placeholders excluded",
          },
          {
            label: "Guest learners",
            value: stats.guestLearners,
            suffix: null,
            hint: "learning without an account",
          },
          {
            label: "Guide viewers",
            value: stats.guideViewersTotal,
            suffix: null,
            hint: `${n(stats.guideViewsTotal)} guide views${
              visitorsSince ? `, viewers since ${visitorsSince}` : ""
            }`,
          },
          {
            label: "Referred signups",
            value: stats.referralUsers,
            suffix: null,
            hint: `of ${n(stats.totals.users)} accounts`,
          },
        ],
      },
      {
        slug: "tally / learning",
        rows: [
          {
            label: "Activation",
            value: retention.activationPct,
            suffix: "%",
            hint: `${n(retention.activated)} of ${n(retention.totalUsers)} accounts finished a lesson`,
          },
          {
            label: "Return rate",
            value: retention.returnPct,
            suffix: "%",
            hint: "of activated accounts, active on a second day",
          },
          // The median is across every ACTIVATED account, not across the power
          // users beside it.
          {
            label: "Power users",
            value: retention.powerUsers,
            suffix: null,
            hint: `active on 5+ days; median ${retention.medianLessons} lessons across all activated`,
          },
          {
            label: "Achievements earned",
            value: stats.totals.achievementsEarned,
            suffix: null,
            hint: `${n(stats.totalXP)} XP awarded`,
          },
        ],
      },
      {
        slug: "tally / the binder",
        rows: [
          {
            label: "Lessons published",
            value: stats.totals.lessons,
            suffix: null,
            hint: `across ${stats.totals.departments} departments`,
          },
          {
            label: "Bookmarks kept",
            value: stats.totals.bookmarks,
            suffix: null,
            hint: "lessons saved to read later",
          },
          {
            label: "Email queue",
            value: retention.lifecycleEligible,
            suffix: null,
            hint: `${n(stats.totals.subscribers)} subscribers, ${n(retention.optedOut)} opted out`,
          },
        ],
      },
    ],
    growth: {
      daily: stats.daily.map((d) => ({
        day: d.day,
        signups: d.signups,
        completions: d.completions,
        views: d.views,
        visitors: d.visitors,
      })),
      // TRUE 30-day-window totals (visitors = count(distinct) over the window),
      // not a sum of the daily series.
      totals: {
        visitors: stats.uniqueVisitors30d,
        signups: stats.signups30d,
        completions: stats.completions30d,
      },
      // The window straddles the day visitor ids started, so the visitor line
      // legitimately sits at zero on its left. Saying so stops it reading as a
      // traffic collapse.
      footnote: visitorsSince
        ? `Days before ${visitorsSince} plot views but no visitors: the beacon had not started sending visitor ids, so that stretch of the visitor line is missing data, not a quiet week. The reconstructed backfill is excluded here, so nothing plotted is synthetic.`
        : null,
    },
    funnel: {
      rows: funnelRows,
      badge: funnelBadge,
      note: funnelNote,
      anonymousRows: funnelAnonRows,
      anonymousNote:
        "Counted by device, not by person, and never joined to an account. A reader who signs up starts a fresh row above.",
      empty: "Funnel unavailable. Check the server logs for [funnel].",
    },
    sources: {
      users: { week: stats.sources7d, allTime: stats.sources },
      visitors: {
        week: stats.visitorSources7d,
        allTime: stats.visitorSources,
        weekTotal: stats.uniqueVisitors7d,
        allTimeTotal: stats.uniqueVisitors,
      },
      // The two halves of the control do NOT cover the same span, and both say
      // "All-time", so the difference is written down, unconditionally.
      footnote: `“All-time” means two different spans here. On the Users view it is every signup ever, out of the database. On the Visitors view it is only as far back as Vercel still keeps, which is a rolling 366 days${
        viewsSince ? `, starting ${viewsSince}` : ""
      }. Differencing the two would invent a gap that is really just the older half of the site’s history.`,
    },
    engagement: { lessons: lessonRows, departments: deptRows },
    teams: {
      teams: teamRows,
      recruiters: recruiterRows,
      surfaces: surfaceRows,
      surfacesFootnote:
        attributedReferrals === 0 && untrackedReferrals > 0
          ? "Per-surface attribution only starts now, so every referral so far is unattributed, not missing."
          : null,
    },
    articles: withPct(
      stats.articleViews.slice(0, 10).map((a) => ({ label: a.title, value: a.views }))
    ),
    achievements: withPct(
      stats.achievementBreakdown.slice(0, 12).map((a) => ({ label: a.name, value: a.earned }))
    ),
    activity: {
      newestMembers: stats.recentSignups.slice(0, 8).map((u) => ({
        username: u.username,
        teamNumber: u.team_number,
        createdAt: toIso(u.created_at) ?? u.created_at,
      })),
      recentCompletions: stats.recentCompletions.slice(0, 8).map((c) => ({
        user: c.user,
        lesson: c.lesson,
        at: toIso(c.at) ?? c.at,
      })),
    },
  };
}
