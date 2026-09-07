import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAdminStats, getPendingEdits, getPendingSubmissions } from "@/lib/admin";
import { getAnalyticsAvailability } from "@/lib/vercel-analytics";
import { getRetentionStats } from "@/lib/retention";
import { getFunnelStats } from "@/lib/funnel";
import { getFeedback } from "@/lib/feedback";
import { StatSheet, StatColumn, Stat } from "@/components/admin/stat-tile";
import { CollapsiblePanel } from "@/components/admin/collapsible-panel";
import { MiniList, MiniListPair, type MiniRow } from "@/components/admin/mini-list";
import { GrowthChart } from "@/components/admin/growth-chart";
import { SourceBreakdown } from "@/components/admin/source-breakdown";
import { FeedbackInbox } from "@/components/admin/feedback-inbox";
import { AutoRefresh } from "@/components/admin/auto-refresh";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

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

/** Scale a list of values to 0-100 so the gauges are comparable within one list. */
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

/**
 * The quiet paragraph that says what a set of figures can and cannot be read
 * to mean. Sans rather than mono, at reading size rather than 11px: these are
 * sentences, and the whole point of them is that they get read.
 */
function Footnote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 max-w-[68ch] text-[0.88rem] leading-relaxed text-graphite">
      {children}
    </p>
  );
}

/** One line of the taped card at the top: a figure and what it wants. */
function NowRow({
  value,
  label,
  hint,
}: {
  value: number;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline gap-3 border-t border-[rgba(22,24,27,0.13)] py-2.5 first:border-t-0">
      <b className="min-w-[2.6ch] shrink-0 font-mono text-[clamp(1.5rem,1.1rem+1.3vw,2.05rem)] leading-none font-bold tabular-nums text-blue">
        {value.toLocaleString()}
      </b>
      <span className="min-w-0">
        <span className="block text-[0.95rem] leading-snug">{label}</span>
        {hint ? <span className="nb-slug mt-0.5 block">{hint}</span> : null}
      </span>
    </div>
  );
}

export default async function AdminPage() {
  const { user, isAdmin } = await getSession();
  if (!user) redirect("/login?next=/admin");

  if (!isAdmin) {
    return (
      <div className="nb-route nb-wrap flex min-h-[60dvh] items-center justify-center py-20">
        <div className="nb-box nb-tilt-2 w-full max-w-lg p-[clamp(1.4rem,4vw,2.4rem)]">
          <span className="nb-tape -top-3 left-[18%] rotate-[-3.2deg]" aria-hidden="true" />
          <p className="nb-slug">access / denied</p>
          <h1 className="mt-3 text-[clamp(1.9rem,1.3rem+2vw,2.8rem)]">
            This drawer is locked.
          </h1>
          <p className="mt-4 text-graphite">
            /admin holds the raw numbers for the whole site, so it is open to
            administrators only. Nothing is wrong with your account.
          </p>
          <Link href="/dashboard" className="nb-btn mt-6">
            Back to your dashboard
          </Link>
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

  // Computed here, not via the client module's openFeedbackCount helper:
  // calling an export of a "use client" module from a Server Component throws.
  const openFeedback = feedback.filter((f) => f.status !== "replied").length;
  const completionsAll = stats.totals.completions + stats.guestCompletions;

  // ── What the traffic numbers actually cover ──────────────────────
  // `page_views` spans three eras and the figures read only the measured one
  // (see AnalyticsCoverage in src/lib/admin.ts). Printing the window is the
  // whole point of this block: a growth analysis read straight across the eras
  // and got a ~100% activation rate out of rows that, by construction, exist
  // only for people who had already completed a lesson. A reader who can see
  // "since Jul 22" cannot make that mistake twice.
  // Year included on purpose: the Vercel window opens 366 days back, so a
  // bare "Sep 6" reads as TODAY and makes a year of page views look like one
  // day's traffic. That is the exact misreading this block exists to stop.
  const analyticsAvailability = getAnalyticsAvailability();
  // Why the traffic figures cannot be believed, or null when they can.
  //
  // TWO WAYS TO FAIL, and only one of them used to be said out loud. Missing
  // credentials was caught here; a token that is present but dead, a spent rate
  // limit, or Web Analytics switched off on the project was not, because
  // availability only ever checked whether the env vars exist. Every traffic
  // query then failed, every traffic figure fell back to 0, and the panel
  // printed "0 unique visitors" in stamp type with no note beside it. A zero
  // that arrives that way is a placeholder, not a measurement, and this line is
  // what makes the page say which one it is looking at.
  const trafficUnmeasured = !analyticsAvailability.configured
    ? analyticsAvailability.message
    : stats.analytics.failure
      ? `${stats.analytics.failure.message} Every traffic figure on this page is therefore unmeasured, not zero: unique visitors, page views, article and guide reads, the visitor line on the growth chart, and the Visitors half of the sources drawer.`
      : null;
  const viewsSince = utcDay(stats.analytics.viewsSince, true);
  const visitorsSince = utcDay(stats.analytics.visitorsSince, true);
  const coverageParts: string[] = [];
  // BOTH traffic figures, not just page views. This used to date page views
  // alone, which left "unique visitors" stamped undated directly under a band
  // that says these are totals over the whole history of the site. They are not:
  // they are the rolling year Vercel keeps, and the visitors stamp has no
  // "since" of its own now that Vercel dates every visit it records.
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
      ? `A further ${stats.analytics.backfillViews.toLocaleString()} rows${
          backfillFrom && backfillTo ? ` (${backfillFrom} to ${backfillTo})` : ""
        } reconstructed from lesson completions and labelled source=backfill are held out of every figure here and are not added in anywhere: they exist only for people who already finished a lesson, so any funnel built on them reads ~100% by construction.`
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
  //  - The four known surfaces are scaled against EACH OTHER, so the gauges
  //    compare like with like.
  //  - Referrals from before attribution existed get a labelled row with NO
  //    gauge (pct omitted), pinned last. They are real signups, so dropping
  //    them would understate the referral total, but they are not a surface,
  //    and letting them into the scale would make the historical bucket look
  //    like the winning channel forever.
  const bySurface = new Map(stats.referralSurfaces.map((s) => [s.surface ?? "", s]));
  const untrackedReferrals = bySurface.get("")?.signups ?? 0;
  const attributedReferrals = stats.referralSurfaces
    .filter((s) => s.surface)
    .reduce((n, s) => n + s.signups, 0);
  // Any surface key the server has started sending that REFERRAL_SURFACES does
  // not know about yet is rendered under its raw key rather than dropped:
  // otherwise adding a `via` value server-side would silently delete real
  // signups from this drawer and stop the total reconciling with `referralUsers`.
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
  // NOT run through withPct(): the gauge must be each step's share of the FIRST
  // step, which is what makes the list read as a funnel narrowing to a point.
  // withPct() rescales to the largest row, which here is always step 1, the
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
  // only when there is something to show: an all-zero list on day one would be
  // noise, and its absence is not a finding (the beacon simply has not fired).
  const funnelAnonRows = withPct(
    funnel.rows
      .filter((r) => r.anonymous > 0)
      .map((r) => ({ label: r.label, value: r.anonymous }))
  );
  // Kept SHORT on purpose: the chip is whitespace-nowrap, so a long badge
  // cannot wrap and would push the drawer header sideways at 375px.
  const funnelBadge = funnel.worstDrop
    ? `-${funnel.worstDrop.lostPct}% ${funnel.worstDrop.label}`
    : undefined;
  // Which rows can be believed. This is the honesty valve for the whole drawer:
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
          } a floor, not a measurement. Nothing has ever recorded them, so the count shown is everyone who completed a lesson, because you cannot finish one without opening it and passing its quiz. They separate from the completed row the moment the beacon fires on a reader who opens a lesson and stops. Every other row is exact, back to the first signup.`
        : `Every step measured directly, ${funnel.recorded.toLocaleString()} events recorded.`;

  const articleRows = withPct(
    stats.articleViews.slice(0, 10).map((a) => ({ label: a.title, value: a.views }))
  );
  const achievementRows = withPct(
    stats.achievementBreakdown.slice(0, 12).map((a) => ({ label: a.name, value: a.earned }))
  );

  return (
    <div className="nb-route pb-24">
      {/* ============================ MASTHEAD ============================
          The cover sheet of the binder's back section: what this page is, and
          the one card that says whether anything wants doing today. Everything
          actionable is here, at the top, before a single standing total. */}
      <section className="nb-wrap pt-10 lg:pt-16">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)] lg:gap-16">
          <div>
            <p className="nb-marker">sheet / admin</p>
            <h1 className="text-[clamp(2.2rem,1rem+3.4vw,3.6rem)]">
              Everything the site knows about itself.
            </h1>
            <p className="nb-lede mt-5">
              Read straight off the database on every load, with no rounding and
              no smoothing. Where a number cannot see the whole history, it says
              so underneath.
            </p>
            <p className="mt-5">
              <AutoRefresh seconds={30} />
            </p>
          </div>

          <div>
            <div className="nb-box nb-tilt-1 p-[clamp(1.15rem,2.4vw,1.65rem)]">
              <span className="nb-tape -top-3 left-[20%] rotate-[-3.4deg]" aria-hidden="true" />
              <span className="nb-tape -bottom-3 right-[14%] rotate-[2.6deg]" aria-hidden="true" />

              <p className="nb-slug border-b border-dashed border-rule pb-3">
                what wants a person today
              </p>
              <div className="mt-1">
                <NowRow
                  value={stats.onlineNow}
                  label="people on the site right now"
                  hint="active in the last few minutes"
                />
                <NowRow
                  value={openFeedback}
                  label="messages waiting for a reply"
                  hint={`${feedback.length.toLocaleString()} received in total`}
                />
                <NowRow
                  value={pendingEdits.length}
                  label="content edits to review"
                />
                <NowRow
                  value={pendingSubmissions.length}
                  label="lesson submissions to review"
                />
              </div>
            </div>
            <p className="nb-pen mt-4 rotate-[-1.2deg]">this card first, the rest after</p>
          </div>
        </div>
      </section>

      {/* ============================ THE SIZE OF IT ============================
          Four standing totals on the one inverted surface in the system. These
          are the numbers you would write on the front of the folder, and they
          are the only place on this page where a figure is set big. */}
      <section className="nb-slab mt-14 py-[clamp(2.2rem,4.6vw,3.4rem)] lg:mt-20">
        <div className="nb-wrap">
          <h2 className="text-[clamp(1.6rem,1.1rem+1.9vw,2.5rem)]">How far it has got.</h2>
          <p className="mt-4 max-w-[54ch] text-[0.95rem] text-[rgba(245,246,242,0.85)]">
            Totals over the whole history of the site, not a window. The note
            under this band says how far back each of them can actually see.
          </p>

          {/* The stamps get the full gutter width and only go four across at
              lg. A six-digit figure at the kit's own stamp size needs about
              260px of column: put four of those beside a heading and 18,204
              runs straight into 96,431. The `[&_b]` step-down is the same
              trade in the other direction, so the row still fits at 1024px. */}
          <div className="mt-9 grid grid-cols-2 gap-x-8 gap-y-9 lg:grid-cols-4 [&_b]:text-[clamp(2rem,1.2rem+2.4vw,3.4rem)]">
            <p className="nb-stamp">
              <b>{stats.uniqueVisitors.toLocaleString()}</b>
              <span>
                unique visitors{visitorsSince ? `, since ${visitorsSince}` : ""}
              </span>
            </p>
            <p className="nb-stamp">
              <b>{stats.pageViewsTotal.toLocaleString()}</b>
              <span>
                page views, {stats.articleViewsTotal.toLocaleString()} of them on articles
              </span>
            </p>
            <p className="nb-stamp">
              <b>{stats.totals.users.toLocaleString()}</b>
              <span>
                accounts, {stats.verifiedUsers.toLocaleString()} verified
              </span>
            </p>
            <p className="nb-stamp">
              <b>{completionsAll.toLocaleString()}</b>
              <span>
                lessons completed
                {stats.guestCompletions > 0
                  ? `, ${stats.guestCompletions.toLocaleString()} by guests`
                  : ""}
              </span>
            </p>
          </div>
        </div>
      </section>

      {trafficUnmeasured ? (
        <div className="nb-wrap mt-6">
          <div className="nb-note max-w-[70ch]">
            <p className="nb-slug">traffic panels are not measuring</p>
            <p className="mt-2 text-[0.88rem] leading-relaxed text-graphite">
              {trafficUnmeasured}
            </p>
          </div>
        </div>
      ) : null}

      {coverageNote ? (
        <div className="nb-wrap mt-6">
          <div className="nb-note max-w-[70ch]">
            <p className="nb-slug">what those four numbers cover</p>
            <p className="mt-2 text-[0.88rem] leading-relaxed text-graphite">
              {coverageNote}
            </p>
          </div>
        </div>
      ) : null}

      {/* ============================ THE TALLY SHEET ============================
          The standing totals nobody needs set in 44px type. One ruled page,
          three columns, one line per reading. Deliberately no time windows in
          here: anything period-shaped lives in a drawer below, which is built
          for it. */}
      <section className="nb-wrap mt-14 lg:mt-20">
        <div className="mb-7">
          <p className="nb-marker">tally / standing totals</p>
          <h2 className="text-[clamp(1.6rem,1.1rem+1.9vw,2.5rem)]">
            Everything else, ruled off.
          </h2>
        </div>

        <StatSheet>
          <StatColumn slug="tally / reach">
            <Stat
              label="FRC teams represented"
              value={stats.totalUniqueTeams}
              hint="counted from team numbers on profiles"
            />
            <Stat
              label="Guest learners"
              value={stats.guestLearners}
              hint="learning without an account"
            />
            <Stat
              label="Guide viewers"
              value={stats.guideViewersTotal}
              hint={`${stats.guideViewsTotal.toLocaleString()} guide views${
                visitorsSince ? `, viewers since ${visitorsSince}` : ""
              }`}
            />
            <Stat
              label="Referred signups"
              value={stats.referralUsers}
              hint={`of ${stats.totals.users.toLocaleString()} accounts`}
            />
          </StatColumn>

          <StatColumn slug="tally / learning">
            <Stat
              label="Activation"
              value={retention.activationPct}
              suffix="%"
              hint={`${retention.activated.toLocaleString()} of ${retention.totalUsers.toLocaleString()} accounts finished a lesson`}
            />
            <Stat
              label="Return rate"
              value={retention.returnPct}
              suffix="%"
              hint="of activated accounts, active on a second day"
            />
            {/* The median is across every ACTIVATED account, not across the
                power users beside it. Written as "median N lessons each" it
                read as the typical power user's total, which it is not and is
                nowhere near: 8 against 47 the day this was caught. The figure
                is right, the sentence was not. */}
            <Stat
              label="Power users"
              value={retention.powerUsers}
              hint={`active on 5+ days; median ${retention.medianLessons} lessons across all activated`}
            />
            <Stat
              label="Achievements earned"
              value={stats.totals.achievementsEarned}
              hint={`${stats.totalXP.toLocaleString()} XP awarded`}
            />
          </StatColumn>

          <StatColumn slug="tally / the binder">
            <Stat
              label="Lessons published"
              value={stats.totals.lessons}
              hint={`across ${stats.totals.departments} departments`}
            />
            <Stat
              label="Bookmarks kept"
              value={stats.totals.bookmarks}
              hint="lessons saved to read later"
            />
            <Stat
              label="Email queue"
              value={retention.lifecycleEligible}
              hint={`${stats.totals.subscribers.toLocaleString()} subscribers, ${retention.optedOut.toLocaleString()} opted out`}
            />
          </StatColumn>
        </StatSheet>
      </section>

      {/* ============================ THE DRAWERS ============================
          Everything that needs a chart, a list or a form. Closed on arrival so
          the page reads as figures first and detail second, and so the chart
          only mounts once something is going to look at it. */}
      <section className="nb-wrap mt-14 lg:mt-20">
        <div className="mb-7">
          <p className="nb-marker">drawers / open one to read it</p>
          <h2 className="text-[clamp(1.6rem,1.1rem+1.9vw,2.5rem)]">The detail, filed.</h2>
        </div>

        <CollapsiblePanel title="Growth" slug="drawer / growth" badge="last 30 days">
          {/* The figures beside each line are TRUE 30-day-window totals
              (visitors = count(distinct) over the window), not a sum of the
              daily series. */}
          <GrowthChart
            daily={stats.daily}
            totals={{
              visitors: stats.uniqueVisitors30d,
              signups: stats.signups30d,
              completions: stats.completions30d,
            }}
          />
          {/* The 30-day window straddles the day visitor ids started, so the
              visitor line legitimately sits at zero for its left-hand days.
              Saying so stops it reading as a traffic collapse. */}
          {visitorsSince ? (
            <Footnote>
              Days before {visitorsSince} plot views but no visitors: the beacon
              had not started sending visitor ids, so that stretch of the visitor
              line is missing data, not a quiet week. The reconstructed backfill
              is excluded here, so nothing plotted is synthetic.
            </Footnote>
          ) : null}
        </CollapsiblePanel>

        {/* Directly under Growth because it answers the one question the
            figures above cannot: WHERE the accounts that never complete a
            lesson actually stop. No time window, same contract as the tally. */}
        <CollapsiblePanel
          title="Activation funnel"
          slug="drawer / funnel"
          badge={funnelBadge}
        >
          <MiniList
            rows={funnelRows}
            empty="Funnel unavailable. Check the server logs for [funnel]."
          />

          {funnelNote ? <Footnote>{funnelNote}</Footnote> : null}

          {funnelAnonRows.length > 0 ? (
            <section
              aria-label="Before signup, anonymous readers"
              className="mt-6 min-w-0 border-t border-dashed border-rule pt-4"
            >
              <p className="nb-slug mb-2.5">before signup / anonymous readers</p>
              <MiniList rows={funnelAnonRows} />
              <Footnote>
                Counted by device, not by person, and never joined to an account.
                A reader who signs up starts a fresh row above.
              </Footnote>
            </section>
          ) : null}
        </CollapsiblePanel>

        <div className="grid items-start lg:grid-cols-2 lg:gap-x-14">
          <CollapsiblePanel title="Where they come from" slug="drawer / sources">
            <SourceBreakdown
              userWeek={stats.sources7d}
              userAllTime={stats.sources}
              visitorWeek={stats.visitorSources7d}
              visitorAllTime={stats.visitorSources}
              visitorTotal={stats.uniqueVisitors}
              visitorWeekTotal={stats.uniqueVisitors7d}
            />
            {/* The two halves of this control do NOT cover the same span, and
                the toggle says "All-time" for both, so the difference has to be
                written down. This note used to be gated on `visitorsSince`,
                which Vercel made permanently null, so it stopped rendering at
                all and the mismatch went unlabelled. It is unconditional now,
                because the mismatch is unconditional. */}
            <Footnote>
              &ldquo;All-time&rdquo; means two different spans here. On the Users
              view it is every signup ever, out of the database. On the Visitors
              view it is only as far back as Vercel still keeps, which is a
              rolling 366 days
              {viewsSince ? `, starting ${viewsSince}` : ""}. Differencing the
              two would invent a gap that is really just the older half of the
              site&rsquo;s history.
            </Footnote>
          </CollapsiblePanel>

          <CollapsiblePanel title="What gets read" slug="drawer / engagement">
            <MiniListPair
              left={{
                title: "most-completed lessons",
                rows: lessonRows,
                empty: "No completions yet.",
              }}
              right={{
                title: "top departments",
                rows: deptRows,
                empty: "No completions yet.",
              }}
            />
          </CollapsiblePanel>

          <CollapsiblePanel title="Teams and referrals" slug="drawer / teams">
            <MiniListPair
              left={{
                title: "top teams",
                rows: teamRows,
                empty: "No teams yet.",
              }}
              right={{
                title: "top recruiters",
                rows: recruiterRows,
                empty: "No referrals yet.",
              }}
            />

            <section
              aria-label="Referral signups by surface"
              className="mt-6 min-w-0 border-t border-dashed border-rule pt-4"
            >
              <p className="nb-slug mb-2.5">referral signups / by surface</p>
              <MiniList rows={surfaceRows} empty="No referrals yet." />
              {attributedReferrals === 0 && untrackedReferrals > 0 ? (
                <Footnote>
                  Per-surface attribution only starts now, so every referral so
                  far is unattributed, not missing.
                </Footnote>
              ) : null}
            </section>
          </CollapsiblePanel>

          <CollapsiblePanel title="Top articles" slug="drawer / articles">
            <MiniList rows={articleRows} empty="No article views yet." />
          </CollapsiblePanel>

          <CollapsiblePanel title="Achievements" slug="drawer / achievements">
            <MiniList rows={achievementRows} empty="No achievements earned yet." />
          </CollapsiblePanel>

          <CollapsiblePanel title="Recent activity" slug="drawer / activity">
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <section aria-label="Newest members" className="min-w-0">
                <p className="nb-slug mb-2.5 border-b border-dashed border-rule pb-2">
                  newest members
                </p>
                {stats.recentSignups.length === 0 ? (
                  <p className="nb-slug py-2">No signups yet.</p>
                ) : (
                  <ul className="min-w-0">
                    {stats.recentSignups.slice(0, 8).map((u) => (
                      <li
                        key={u.id}
                        className="nb-hair flex items-baseline justify-between gap-3 py-2 first:border-t-0 first:pt-0"
                      >
                        <span className="min-w-0 truncate text-[0.95rem]">
                          {u.username ? `@${u.username}` : u.full_name || "New member"}
                          {u.team_number ? (
                            <span className="nb-slug ml-2">#{u.team_number}</span>
                          ) : null}
                        </span>
                        <span className="nb-slug shrink-0">{timeAgo(u.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-label="Recent completions" className="min-w-0">
                <p className="nb-slug mb-2.5 border-b border-dashed border-rule pb-2">
                  recent completions
                </p>
                {stats.recentCompletions.length === 0 ? (
                  <p className="nb-slug py-2">No completions yet.</p>
                ) : (
                  <ul className="min-w-0">
                    {stats.recentCompletions.slice(0, 8).map((c, i) => (
                      <li
                        key={`${c.user}-${c.at}-${i}`}
                        className="nb-hair flex items-baseline justify-between gap-3 py-2 first:border-t-0 first:pt-0"
                      >
                        <span
                          className="min-w-0 truncate text-[0.95rem]"
                          title={`${c.user}: ${c.lesson}`}
                        >
                          {c.user}
                          <span className="text-graphite"> {c.lesson}</span>
                        </span>
                        <span className="nb-slug shrink-0">{timeAgo(c.at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </CollapsiblePanel>
        </div>

        <CollapsiblePanel
          title="Feedback"
          slug="drawer / feedback"
          badge={openFeedback > 0 ? `${openFeedback} open` : undefined}
        >
          <FeedbackInbox items={feedback} />
        </CollapsiblePanel>

        {/* Closes the last drawer off, the way a ruled page ends. */}
        <div className="nb-rule" />
      </section>
    </div>
  );
}
