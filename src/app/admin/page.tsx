import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadAdminDashboard, type DashRow } from "@/lib/app/admin-dashboard";
import { listFeedback } from "@/lib/app/admin-feedback";
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

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.round(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/**
 * A shared dashboard row in the shape MiniList draws. The view-model sends
 * null where there is nothing; the component wants the key left out.
 */
function mini(rows: DashRow[]): MiniRow[] {
  return rows.map((r) => ({
    label: r.label,
    sub: r.sub ?? undefined,
    value: r.value,
    valueSuffix: r.valueSuffix ?? undefined,
    pct: r.pct ?? undefined,
  }));
}

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

/**
 * One line of the taped card at the top: a figure and what it wants.
 *
 * With `href` the whole row becomes the link and the label takes a standing
 * 2px underline, rather than one that appears under the pointer: this is the
 * only actionable row in the card, and a row that only looks like a link once
 * a mouse is on it is not discoverable by keyboard or on a touch screen. The
 * row clears 44px on its own, because the figure beside it is set at 24px and
 * up with 10px of padding either side.
 */
function NowRow({
  value,
  label,
  hint,
  href,
}: {
  value: number;
  label: string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <b className="min-w-[2.6ch] shrink-0 font-mono text-[clamp(1.5rem,1.1rem+1.3vw,2.05rem)] leading-none font-bold tabular-nums text-blue">
        {value.toLocaleString()}
      </b>
      <span className="min-w-0">
        <span
          className={
            href
              ? "block text-[0.95rem] leading-snug font-bold text-blue underline decoration-2 underline-offset-4"
              : "block text-[0.95rem] leading-snug"
          }
        >
          {label}
        </span>
        {hint ? <span className="nb-slug mt-0.5 block">{hint}</span> : null}
      </span>
    </>
  );
  const shell =
    "flex items-baseline gap-3 border-t border-[rgba(22,24,27,0.13)] py-2.5 first:border-t-0";
  if (!href) return <div className={shell}>{body}</div>;
  return (
    <Link href={href} className={shell}>
      {body}
    </Link>
  );
}

/** What a signed-in account without the admin role sees here. */
function LockedDrawer() {
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

export default async function AdminPage() {
  const { user, isAdmin } = await getSession();
  if (!user) redirect("/login?next=/admin");

  if (!isAdmin) return <LockedDrawer />;

  // Every figure, label and footnote below comes from loadAdminDashboard
  // (src/lib/app/admin-dashboard.ts), the same view-model the app's
  // /api/app/admin/dashboard sends, so the two doors print the same sentence
  // over the same number. Both shared functions re-check the role themselves.
  const [dashResult, feedbackResult] = await Promise.all([
    loadAdminDashboard(user),
    listFeedback(user),
  ]);
  if (!dashResult.ok || !feedbackResult.ok) return <LockedDrawer />;
  const dash = dashResult;
  const feedback = feedbackResult.items;
  const isSuperAdmin = dash.role === "superadmin";
  const { now, notes, growth, funnel, sources, engagement, teams, activity } = dash;
  const openFeedback = now.openFeedback;

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

            {/* Wayfinding only, with no count on it. The count lives in the
                card on the right with the other four things waiting on a
                person, so this stamp says where the desk is and nothing more:
                two figures for one fact on one screen is two figures that can
                disagree. A plain admin does not get the line at all. */}
            {isSuperAdmin ? (
              <p className="mt-1">
                <Link
                  href="/admin/team"
                  className="nb-slug inline-flex min-h-11 items-center font-bold text-blue underline decoration-2 underline-offset-4 hover:decoration-blue"
                >
                  team / manage admins
                </Link>
              </p>
            ) : null}
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
                  value={now.onlineNow}
                  label="people on the site right now"
                  hint="active in the last few minutes"
                />
                <NowRow
                  value={openFeedback}
                  label="messages waiting for a reply"
                  hint={`${now.feedbackTotal.toLocaleString()} received in total`}
                />
                {/* Super admins only, and the one row in this card that is a
                    link. Applications are the single thing on the site that
                    nobody else can answer, so leaving them out of the card the
                    page itself tells you to read first was the one count a
                    super admin could miss. A plain admin does not get the row,
                    because a link to a page that turns you away is worse than
                    no link. */}
                {isSuperAdmin && now.pendingApplications !== null ? (
                  <NowRow
                    value={now.pendingApplications}
                    label={
                      now.pendingApplications === 1
                        ? "application waiting on you"
                        : "applications waiting on you"
                    }
                    hint="only a super admin can answer these"
                    href="/admin/team"
                  />
                ) : null}
                <NowRow
                  value={now.pendingEdits}
                  label="content edits to review"
                />
                <NowRow
                  value={now.pendingSubmissions}
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
            {dash.stamps.map((stamp) => (
              <p key={stamp.key} className="nb-stamp">
                <b>{stamp.value.toLocaleString()}</b>
                <span>{stamp.label}</span>
              </p>
            ))}
          </div>
        </div>
      </section>

      {notes.traffic ? (
        <div className="nb-wrap mt-6">
          <div className="nb-note max-w-[70ch]">
            <p className="nb-slug">{notes.traffic.slug}</p>
            <p className="mt-2 text-[0.88rem] leading-relaxed text-graphite">
              {notes.traffic.text}
            </p>
          </div>
        </div>
      ) : null}

      {notes.coverage ? (
        <div className="nb-wrap mt-6">
          <div className="nb-note max-w-[70ch]">
            <p className="nb-slug">what those four numbers cover</p>
            <p className="mt-2 text-[0.88rem] leading-relaxed text-graphite">
              {notes.coverage}
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
          {dash.tally.map((column) => (
            <StatColumn key={column.slug} slug={column.slug}>
              {column.rows.map((r) => (
                <Stat
                  key={r.label}
                  label={r.label}
                  value={r.value}
                  suffix={r.suffix ?? undefined}
                  hint={r.hint ?? undefined}
                />
              ))}
            </StatColumn>
          ))}
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
          <GrowthChart daily={growth.daily} totals={growth.totals} />
          {/* The 30-day window straddles the day visitor ids started, so the
              visitor line legitimately sits at zero for its left-hand days.
              Saying so stops it reading as a traffic collapse. */}
          {growth.footnote ? <Footnote>{growth.footnote}</Footnote> : null}
        </CollapsiblePanel>

        {/* Directly under Growth because it answers the one question the
            figures above cannot: WHERE the accounts that never complete a
            lesson actually stop. No time window, same contract as the tally. */}
        <CollapsiblePanel
          title="Activation funnel"
          slug="drawer / funnel"
          badge={funnel.badge ?? undefined}
        >
          <MiniList rows={mini(funnel.rows)} empty={funnel.empty} />

          {funnel.note ? <Footnote>{funnel.note}</Footnote> : null}

          {funnel.anonymousRows.length > 0 ? (
            <section
              aria-label="Before signup, anonymous readers"
              className="mt-6 min-w-0 border-t border-dashed border-rule pt-4"
            >
              <p className="nb-slug mb-2.5">before signup / anonymous readers</p>
              <MiniList rows={mini(funnel.anonymousRows)} />
              <Footnote>{funnel.anonymousNote}</Footnote>
            </section>
          ) : null}
        </CollapsiblePanel>

        <div className="grid items-start lg:grid-cols-2 lg:gap-x-14">
          <CollapsiblePanel title="Where they come from" slug="drawer / sources">
            <SourceBreakdown
              userWeek={sources.users.week}
              userAllTime={sources.users.allTime}
              visitorWeek={sources.visitors.week}
              visitorAllTime={sources.visitors.allTime}
              visitorTotal={sources.visitors.allTimeTotal}
              visitorWeekTotal={sources.visitors.weekTotal}
            />
            {/* The two halves of this control do NOT cover the same span, and
                the toggle says "All-time" for both, so the difference has to be
                written down. This note used to be gated on `visitorsSince`,
                which Vercel made permanently null, so it stopped rendering at
                all and the mismatch went unlabelled. It is unconditional now,
                because the mismatch is unconditional. */}
            <Footnote>{sources.footnote}</Footnote>
          </CollapsiblePanel>

          <CollapsiblePanel title="What gets read" slug="drawer / engagement">
            <MiniListPair
              left={{
                title: "most-completed lessons",
                rows: mini(engagement.lessons),
                empty: "No completions yet.",
              }}
              right={{
                title: "top departments",
                rows: mini(engagement.departments),
                empty: "No completions yet.",
              }}
            />
          </CollapsiblePanel>

          <CollapsiblePanel title="Teams and referrals" slug="drawer / teams">
            <MiniListPair
              left={{
                title: "top teams",
                rows: mini(teams.teams),
                empty: "No teams yet.",
              }}
              right={{
                title: "top recruiters",
                rows: mini(teams.recruiters),
                empty: "No referrals yet.",
              }}
            />

            <section
              aria-label="Referral signups by surface"
              className="mt-6 min-w-0 border-t border-dashed border-rule pt-4"
            >
              <p className="nb-slug mb-2.5">referral signups / by surface</p>
              <MiniList rows={mini(teams.surfaces)} empty="No referrals yet." />
              {teams.surfacesFootnote ? (
                <Footnote>{teams.surfacesFootnote}</Footnote>
              ) : null}
            </section>
          </CollapsiblePanel>

          <CollapsiblePanel title="Top articles" slug="drawer / articles">
            <MiniList rows={mini(dash.articles)} empty="No article views yet." />
          </CollapsiblePanel>

          <CollapsiblePanel title="Achievements" slug="drawer / achievements">
            <MiniList rows={mini(dash.achievements)} empty="No achievements earned yet." />
          </CollapsiblePanel>

          <CollapsiblePanel title="Recent activity" slug="drawer / activity">
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <section aria-label="Newest members" className="min-w-0">
                <p className="nb-slug mb-2.5 border-b border-dashed border-rule pb-2">
                  newest members
                </p>
                {activity.newestMembers.length === 0 ? (
                  <p className="nb-slug py-2">No signups yet.</p>
                ) : (
                  <ul className="min-w-0">
                    {activity.newestMembers.map((u, i) => (
                      <li
                        key={`${u.createdAt}-${i}`}
                        className="nb-hair flex items-baseline justify-between gap-3 py-2 first:border-t-0 first:pt-0"
                      >
                        <span className="min-w-0 truncate text-[0.95rem]">
                          {u.username ? `@${u.username}` : "New member"}
                          {u.teamNumber ? (
                            <span className="nb-slug ml-2">#{u.teamNumber}</span>
                          ) : null}
                        </span>
                        <span className="nb-slug shrink-0">{timeAgo(u.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-label="Recent completions" className="min-w-0">
                <p className="nb-slug mb-2.5 border-b border-dashed border-rule pb-2">
                  recent completions
                </p>
                {activity.recentCompletions.length === 0 ? (
                  <p className="nb-slug py-2">No completions yet.</p>
                ) : (
                  <ul className="min-w-0">
                    {activity.recentCompletions.map((c, i) => (
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
