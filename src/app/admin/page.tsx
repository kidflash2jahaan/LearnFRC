import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getAdminStats, getPendingEdits, getPendingSubmissions } from "@/lib/admin";
import { getRetentionStats } from "@/lib/retention";
import { getFunnelStats } from "@/lib/funnel";
import { getFeedback } from "@/lib/feedback";
import { StatTile, StatGrid } from "@/components/admin/stat-tile";
import { CollapsiblePanel } from "@/components/admin/collapsible-panel";
import { MiniList, MiniListPair, type MiniRow } from "@/components/admin/mini-list";
import { GrowthChart } from "@/components/admin/growth-chart";
import { SourceBreakdown } from "@/components/admin/source-breakdown";
import { FeedbackInbox } from "@/components/admin/feedback-inbox";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { Rise, Reveal, Glow } from "@/components/motion/primitives";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

const GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * `2026-07-22T23:13:50Z` → `Jul 22` (or `Jul 22, 2026`).
 *
 * UTC and table-driven on purpose. The pageview coverage windows are computed
 * in UTC SQL-side, so rendering them in the runtime's local zone would print a
 * boundary a day off from the one the numbers actually use; and
 * `toLocaleDateString` returns different strings on different ICU builds. This
 * runs in a Server Component and the result is handed down as a plain string,
 * so nothing is recomputed on the client and hydration cannot disagree.
 */
function utcDay(iso: string | null, withYear = false): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const md = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return withYear ? `${md}, ${d.getUTCFullYear()}` : md;
}

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.round(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/** Scale a list of values to 0-100 so MiniList bars are comparable within one list. */
function withPct(rows: Omit<MiniRow, "pct">[]): MiniRow[] {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return rows.map((r) => ({ ...r, pct: (r.value / max) * 100 }));
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

export default async function AdminPage() {
  const { user, isAdmin } = await getSession();
  if (!user) redirect("/login?next=/admin");

  if (!isAdmin) {
    return (
      <div className="relative overflow-x-clip">
        <Glow
          blobs={[
            { size: "480px", pos: { left: "50%", top: "-160px" }, color: "#8bbcff", opacity: 0.4 },
          ]}
        />
        <div className="relative mx-auto flex max-w-md flex-col items-center px-4 pt-40 pb-20 text-center">
          <Rise>
            <span
              className="ac-badge flex h-16 w-16 items-center justify-center"
              style={{ "--a": "var(--destructive)" } as CSSProperties}
            >
              <ShieldAlert className="h-8 w-8" aria-hidden="true" />
            </span>
          </Rise>
          <Rise delay={0.08}>
            <h1 className="mt-6 font-display text-3xl font-bold">Access denied</h1>
          </Rise>
          <Rise delay={0.14}>
            <p className="mt-3 text-base leading-relaxed text-foreground/70">
              The pit&rsquo;s locked. This control room is reserved for LearnFRC
              administrators.
            </p>
          </Rise>
          <Rise delay={0.2}>
            <Link href="/dashboard" className="ac-btn mt-7 text-sm">
              Back to dashboard
            </Link>
          </Rise>
        </div>
      </div>
    );
  }

  const [stats, retention, funnel, pendingEdits, pendingSubmissions, feedback] =
    await Promise.all([
      getAdminStats(),
      getRetentionStats(),
      getFunnelStats(),
      getPendingEdits(),
      getPendingSubmissions(),
      getFeedback(),
    ]);

  // Computed here, not via the client module's openFeedbackCount helper —
  // calling an export of a "use client" module from a Server Component throws.
  const openFeedback = feedback.filter((f) => f.status !== "replied").length;
  const completionsAll = stats.totals.completions + stats.guestCompletions;

  // ── What the traffic numbers actually cover ──────────────────────
  // `page_views` spans three eras and the tiles read only the measured one
  // (see AnalyticsCoverage in src/lib/admin.ts). Printing the window is the
  // whole point of this block: a growth analysis read straight across the eras
  // and got a ~100% activation rate out of rows that, by construction, exist
  // only for people who had already completed a lesson. A reader who can see
  // "since Jul 22" cannot make that mistake twice.
  const viewsSince = utcDay(stats.analytics.viewsSince);
  const visitorsSince = utcDay(stats.analytics.visitorsSince);
  const coverageParts: string[] = [];
  if (viewsSince) coverageParts.push(`Page views measured since ${viewsSince}`);
  if (visitorsSince)
    coverageParts.push(
      `every per-person number — unique visitors, guide viewers, acquisition sources — since ${visitorsSince}, when the beacon began sending visitor ids`
    );
  const backfillFrom = utcDay(stats.analytics.backfillFrom, true);
  const backfillTo = utcDay(stats.analytics.backfillTo, true);
  const coverageNote = [
    coverageParts.length > 0 ? `${coverageParts.join("; ")}.` : null,
    stats.analytics.backfillViews > 0
      ? `A further ${stats.analytics.backfillViews.toLocaleString()} rows${
          backfillFrom && backfillTo ? ` (${backfillFrom} – ${backfillTo})` : ""
        } reconstructed from lesson completions and labelled source=backfill are held out of every figure above and are not added in anywhere: they exist only for people who already finished a lesson, so any funnel built on them reads ~100% by construction.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  const lessonRows = withPct(
    stats.topLessons.slice(0, 8).map((l) => ({ label: l.title, value: l.completions }))
  );
  const deptRows = withPct(
    stats.topDepartments
      .slice(0, 8)
      .map((d) => ({ label: d.name, value: d.completions ?? 0 }))
  );
  const teamRows = withPct(
    stats.teams.slice(0, 8).map((t) => ({
      label: `#${t.teamNumber}`,
      sub: `${t.members} ${t.members === 1 ? "member" : "members"}`,
      value: t.completed,
    }))
  );
  const recruiterRows = withPct(
    stats.recruiters.slice(0, 8).map((r) => ({
      label: r.name,
      sub: r.username ? `@${r.username}` : undefined,
      value: r.referrals,
    }))
  );
  // Referral signups by the surface that earned them. Two deliberate choices:
  //  - The four known surfaces are scaled against EACH OTHER, so the bars
  //    compare like with like.
  //  - Referrals from before attribution existed get a labelled row with NO bar
  //    (pct omitted), pinned last. They are real signups, so dropping them would
  //    understate the referral total — but they are not a surface, and letting
  //    them into the bar scale would make the historical bucket look like the
  //    winning channel forever.
  const bySurface = new Map(stats.referralSurfaces.map((s) => [s.surface ?? "", s]));
  const untrackedReferrals = bySurface.get("")?.signups ?? 0;
  const attributedReferrals = stats.referralSurfaces
    .filter((s) => s.surface)
    .reduce((n, s) => n + s.signups, 0);
  // Any surface key the server has started sending that REFERRAL_SURFACES does
  // not know about yet is rendered under its raw key rather than dropped —
  // otherwise adding a `via` value server-side would silently delete real
  // signups from this panel and stop the total reconciling with `referralUsers`.
  const unknownSurfaces = stats.referralSurfaces
    .map((s) => s.surface)
    .filter((k): k is string => !!k && !REFERRAL_SURFACES.some((r) => r.key === k))
    .map((key) => ({ key, label: key }));
  const surfaceRows: MiniRow[] = [
    ...withPct(
      [...REFERRAL_SURFACES, ...unknownSurfaces]
        .map(({ key, label }) => {
          const s = bySurface.get(key);
          return {
            label,
            sub: s && s.signups7d > 0 ? `${s.signups7d} this week` : undefined,
            value: s?.signups ?? 0,
          };
        })
        .sort((a, b) => b.value - a.value)
    ),
    ...(untrackedReferrals > 0
      ? [{ label: "Before tracking", sub: "surface unknown", value: untrackedReferrals }]
      : []),
  ];

  // ── Activation funnel ────────────────────────────────────────────
  // NOT run through withPct(): the bar must be each step's share of the FIRST
  // step, which is what makes the list read as a funnel narrowing to a point.
  // withPct() rescales to the largest row, which here is always step 1 — the
  // same answer today, but it would silently stop being a funnel the moment a
  // step ever exceeded signups. pctOfStart says what it means.
  const funnelRows: MiniRow[] = funnel.rows.map((r) => ({
    label: r.label,
    // The conversion INTO this step. Bases are mostly the previous row; see
    // STEP_META in src/lib/funnel.ts for the one deliberate exception.
    sub: r.baseLabel ? `${r.conversionPct}% of ${r.baseLabel}` : undefined,
    value: r.count,
    pct: r.pctOfStart,
  }));
  // Logged-out readers who reached a step before they had an account. Rendered
  // only when there is something to show — an all-zero list on day one would be
  // noise, and its absence is not a finding (the beacon simply hasn't fired).
  const funnelAnonRows = withPct(
    funnel.rows
      .filter((r) => r.anonymous > 0)
      .map((r) => ({ label: r.label, value: r.anonymous }))
  );
  // Kept SHORT on purpose: the chip is whitespace-nowrap, so a long badge
  // cannot wrap and would push the panel header sideways at 375px.
  const funnelBadge = funnel.worstDrop
    ? `−${funnel.worstDrop.lostPct}% ${funnel.worstDrop.label}`
    : undefined;
  // Which rows can be believed. This is the honesty valve for the whole panel:
  // 'Opened a lesson' and 'Attempted a quiz' have no source in the schema, so
  // until the beacon fires they show the floor (= everyone who completed a
  // lesson) and the funnel LOOKS like 100% of openers finish. Saying so is the
  // difference between an instrument and a decoration.
  const funnelNote =
    funnel.rows.length === 0
      ? null
      : funnel.inferredSteps.length > 0
        ? `${funnel.inferredSteps.join(" and ")} ${
            funnel.inferredSteps.length === 1 ? "is" : "are"
          } a floor, not a measurement — nothing has ever recorded them, so the count shown is everyone who completed a lesson (you cannot finish one without opening it and passing its quiz). They separate from “Completed a lesson” the moment the beacon fires on a reader who opens a lesson and stops. Every other row is exact, back to the first signup.`
        : `Every step measured directly · ${funnel.recorded.toLocaleString()} events recorded.`;

  const articleRows = withPct(
    stats.articleViews.slice(0, 10).map((a) => ({ label: a.title, value: a.views }))
  );
  const achievementRows = withPct(
    stats.achievementBreakdown.slice(0, 12).map((a) => ({ label: a.name, value: a.earned }))
  );

  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "560px", pos: { left: "-160px", top: "-200px" }, color: "#8bbcff", opacity: 0.55 },
          { size: "520px", pos: { right: "-170px", top: "60px" }, color: "#6ff0ea", opacity: 0.45, delay: 2 },
        ]}
      />

      <div className="relative mx-auto max-w-6xl px-4 pt-20 pb-20 sm:px-6 lg:px-8 lg:pt-24">
        {/* ============================ HEADER ============================ */}
        <Rise>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
              <span style={GRADIENT}>Dashboard</span>
            </h1>
            <AutoRefresh seconds={30} />
          </div>
        </Rise>

        {/* ============ EVERY NUMBER, ONE GRID ============
            Deliberately no time-window stats here — a tile is a standing
            total, and anything trend/period-shaped lives in the Growth
            panel below, which is built for it.

            The traffic tiles' "since <date>" hints are not an exception to
            that: they say how far back the standing total can see, which is a
            property of the data, not a window chosen for the tile. A total
            whose coverage is unstated is the failure this whole block exists
            to prevent — see the footnote under the grid. */}
        <StatGrid className="mt-5">
          {/* The two traffic tiles carry their own coverage window in the hint.
              They read MEASURED pageviews only — the reconstructed backfill is
              excluded SQL-side and accounted for in the note under this grid —
              and the two windows differ on purpose: raw views go back to the
              first beacon row, per-visitor counts only to the first row that
              carried a visitor id. */}
          <StatTile
            label="Unique visitors"
            value={stats.uniqueVisitors}
            hint={visitorsSince ? `measured since ${visitorsSince}` : undefined}
            icon="UsersRound"
            accent="#2560e6"
            hero
          />
          <StatTile
            label="Page views"
            value={stats.pageViewsTotal}
            hint={`${stats.articleViewsTotal.toLocaleString()} on articles${
              viewsSince ? ` · since ${viewsSince}` : ""
            }`}
            icon="Eye"
            accent="#1aa9d6"
          />
          <StatTile label="Online now" value={stats.onlineNow} icon="Activity" accent="#0ea5a3" live />
          <StatTile label="Teams" value={stats.totalUniqueTeams} hint="FRC teams represented" icon="Flag" accent="#12a150" />

          <StatTile
            label="Total users"
            value={stats.totals.users}
            hint={`${stats.verifiedUsers.toLocaleString()} verified · ${stats.referralUsers.toLocaleString()} referred`}
            icon="Users"
            accent="#7c5cff"
            hero
          />
          <StatTile label="Guest learners" value={stats.guestLearners} hint="learning, no account" icon="Ghost" accent="#0ea5a3" />

          <StatTile
            label="Completions"
            value={completionsAll}
            hint={stats.guestCompletions > 0 ? `${stats.guestCompletions.toLocaleString()} by guests` : undefined}
            icon="BookOpenCheck"
            accent="#2560e6"
            hero
          />
          <StatTile
            label="Guide viewers"
            value={stats.guideViewersTotal}
            hint={`${stats.guideViewsTotal.toLocaleString()} guide views${
              visitorsSince ? ` · viewers since ${visitorsSince}` : ""
            }`}
            icon="BookOpen"
            accent="#d64b8a"
          />
          <StatTile label="Bookmarks" value={stats.totals.bookmarks} icon="Bookmark" accent="#7c5cff" />

          <StatTile label="Activation" value={retention.activationPct} suffix="%" hint={`${retention.activated}/${retention.totalUsers} did a lesson`} icon="Percent" accent="#f5a623" />
          <StatTile label="Return rate" value={retention.returnPct} suffix="%" hint="of activated users" icon="Repeat" accent="#d64b8a" />
          <StatTile label="Power users" value={retention.powerUsers} hint={`median ${retention.medianLessons} lessons each`} icon="Flame" accent="#f5a623" />
          <StatTile label="Achievements" value={stats.totals.achievementsEarned} hint={`${stats.totalXP.toLocaleString()} XP awarded`} icon="Trophy" accent="#f5a623" />

          <StatTile label="Lessons" value={stats.totals.lessons} hint={`across ${stats.totals.departments} departments`} icon="Layers" accent="#2560e6" />
          <StatTile
            label="Email queue"
            value={retention.lifecycleEligible}
            hint={`${stats.totals.subscribers.toLocaleString()} subscribers · ${retention.optedOut} opted out`}
            icon="Send"
            accent="#1aa9d6"
          />
          <StatTile label="Open feedback" value={openFeedback} hint={`${feedback.length} received`} icon="Inbox" accent="#d64b8a" />
          <StatTile label="Pending edits" value={pendingEdits.length} hint={`${pendingSubmissions.length} pending submissions`} icon="FileClock" accent="#f5a623" />
        </StatGrid>

        {/* Coverage footnote for the traffic tiles. Same 11px muted note the
            panels below use for the same job (see the funnel note), placed
            directly under the grid because that is where the numbers it
            qualifies are read. Deliberately not a tile and not a panel: it is
            not a metric, it is the provenance of four of them. */}
        {coverageNote ? (
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {coverageNote}
          </p>
        ) : null}

        {/* ===================== DETAIL — COLLAPSED BY DEFAULT ===================== */}
        <Reveal className="mt-6">
          <CollapsiblePanel title="Growth" icon="TrendingUp" badge="Last 30 days">
            {/* Chip totals are TRUE 30-day-window figures (visitors =
                count(distinct) over the window), not a sum of the daily series. */}
            <GrowthChart
              daily={stats.daily}
              totals={{
                visitors: stats.uniqueVisitors30d,
                signups: stats.signups30d,
                completions: stats.completions30d,
              }}
              bare
            />
            {/* The 30-day window straddles the day visitor ids started, so the
                visitor line legitimately sits at zero for its left-hand days.
                Saying so stops it reading as a traffic collapse. */}
            {visitorsSince ? (
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Days before {visitorsSince} plot views but no visitors — the
                beacon had not started sending visitor ids, so that stretch of
                the visitor line is missing data, not a quiet week. The
                reconstructed backfill is excluded from this chart, so nothing
                plotted here is synthetic.
              </p>
            ) : null}
          </CollapsiblePanel>
        </Reveal>

        {/* ===================== ACTIVATION FUNNEL =====================
            Full width and directly under Growth because it answers the one
            question the dashboard could not: WHERE the 45% of accounts that
            never complete a lesson actually stop. No time-window control —
            every row is a standing total over the whole history of the site,
            same contract as the tiles above. */}
        <Reveal className="mt-3">
          <CollapsiblePanel
            title="Activation funnel"
            icon="Gauge"
            accent="#0ea5a3"
            badge={funnelBadge}
          >
            <MiniList
              rows={funnelRows}
              accent="#0ea5a3"
              empty="Funnel unavailable — check the server logs for [funnel]."
            />

            {funnelNote ? (
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                {funnelNote}
              </p>
            ) : null}

            {funnelAnonRows.length > 0 ? (
              <section
                aria-labelledby="admin-funnel-anonymous"
                className="mt-4 min-w-0 border-t border-border/50 pt-3"
              >
                <h4
                  id="admin-funnel-anonymous"
                  className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Before signup — anonymous readers
                </h4>
                <MiniList rows={funnelAnonRows} accent="#8a97ad" />
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Counted by device, not by person, and never joined to an
                  account — a reader who signs up starts a fresh row above.
                </p>
              </section>
            ) : null}
          </CollapsiblePanel>
        </Reveal>

        <div className="mt-3 grid items-start gap-3 lg:grid-cols-2">
          <Reveal>
            <CollapsiblePanel title="Where they come from" icon="PieChart" accent="#1aa9d6">
              <SourceBreakdown
                userWeek={stats.sources7d}
                userAllTime={stats.sources}
                visitorWeek={stats.visitorSources7d}
                visitorAllTime={stats.visitorSources}
              />
              {/* The two halves of this control do NOT cover the same span, and
                  the toggle says "All-time" for both. Users come from
                  profiles.source (every signup ever); visitors come from
                  first-touch pageviews, which only carry a visitor id from the
                  date below. Differencing the two would invent a gap. */}
              {visitorsSince ? (
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  &ldquo;All-time&rdquo; means every signup ever on the Users
                  view, but only {visitorsSince} onward on the Visitors view —
                  that is when pageviews began carrying a visitor id, so no
                  earlier visitor can be attributed to a source. The two are not
                  comparable totals. <em>backfill</em> no longer appears as a
                  channel here: it was our own reconstruction script, not a
                  referrer, and it was counting {stats.analytics.backfillVisitors}{" "}
                  synthetic visitors.
                </p>
              ) : null}
            </CollapsiblePanel>
          </Reveal>

          <Reveal delay={0.04}>
            <CollapsiblePanel title="Engagement" icon="BookOpenCheck" accent="#2560e6">
              <MiniListPair
                left={{
                  title: "Most-completed lessons",
                  rows: lessonRows,
                  accent: "#2560e6",
                  empty: "No completions yet.",
                }}
                right={{
                  title: "Top departments",
                  rows: deptRows,
                  accent: "#1aa9d6",
                  empty: "No completions yet.",
                }}
              />
            </CollapsiblePanel>
          </Reveal>

          <Reveal delay={0.06}>
            <CollapsiblePanel title="Teams & referrals" icon="Flag" accent="#12a150">
              <MiniListPair
                left={{
                  title: "Top teams",
                  rows: teamRows,
                  accent: "#12a150",
                  empty: "No teams yet.",
                }}
                right={{
                  title: "Top recruiters",
                  rows: recruiterRows,
                  accent: "#7c5cff",
                  empty: "No referrals yet.",
                }}
              />

              <section
                aria-labelledby="admin-referral-surfaces"
                className="mt-4 min-w-0 border-t border-border/50 pt-3"
              >
                <h4
                  id="admin-referral-surfaces"
                  className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Referral signups by surface
                </h4>
                <MiniList rows={surfaceRows} accent="#7c5cff" empty="No referrals yet." />
                {attributedReferrals === 0 && untrackedReferrals > 0 ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    Per-surface attribution only starts now, so every referral so
                    far is unattributed — not missing.
                  </p>
                ) : null}
              </section>
            </CollapsiblePanel>
          </Reveal>

          <Reveal delay={0.08}>
            <CollapsiblePanel title="Top articles" icon="Newspaper" accent="#1aa9d6">
              <MiniList rows={articleRows} accent="#1aa9d6" empty="No article views yet." />
            </CollapsiblePanel>
          </Reveal>

          <Reveal delay={0.1}>
            <CollapsiblePanel title="Achievements" icon="Trophy" accent="#f5a623">
              <MiniList
                rows={achievementRows}
                accent="#f5a623"
                empty="No achievements earned yet."
              />
            </CollapsiblePanel>
          </Reveal>

          <Reveal delay={0.12}>
            <CollapsiblePanel title="Recent activity" icon="History" accent="#7c5cff">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Newest members
                  </h3>
                  {stats.recentSignups.length === 0 ? (
                    <p className="text-[13px] text-muted-foreground">No signups yet.</p>
                  ) : (
                    <ul className="divide-y divide-border/50">
                      {stats.recentSignups.slice(0, 8).map((u) => (
                        <li
                          key={u.id}
                          className="flex items-center justify-between gap-3 py-1.5 text-[13px]"
                        >
                          <span className="min-w-0 truncate font-medium text-foreground">
                            {u.username ? `@${u.username}` : u.full_name || "New member"}
                            {u.team_number ? (
                              <span className="ml-1.5 text-[11px] text-muted-foreground">
                                #{u.team_number}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                            {timeAgo(u.created_at)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="min-w-0">
                  <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Recent completions
                  </h3>
                  {stats.recentCompletions.length === 0 ? (
                    <p className="text-[13px] text-muted-foreground">No completions yet.</p>
                  ) : (
                    <ul className="divide-y divide-border/50">
                      {stats.recentCompletions.slice(0, 8).map((c, i) => (
                        <li
                          key={`${c.user}-${c.at}-${i}`}
                          className="flex items-center justify-between gap-3 py-1.5 text-[13px]"
                        >
                          <span className="min-w-0 truncate" title={`${c.user} · ${c.lesson}`}>
                            <span className="font-medium text-foreground">{c.user}</span>
                            <span className="text-muted-foreground"> · {c.lesson}</span>
                          </span>
                          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                            {timeAgo(c.at)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </CollapsiblePanel>
          </Reveal>
        </div>

        <Reveal className="mt-3">
          <CollapsiblePanel
            title="Feedback"
            icon="Inbox"
            accent="#d64b8a"
            badge={openFeedback > 0 ? `${openFeedback} open` : undefined}
          >
            <FeedbackInbox items={feedback} />
          </CollapsiblePanel>
        </Reveal>
      </div>
    </div>
  );
}
