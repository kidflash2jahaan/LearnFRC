import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getAdminStats, getPendingEdits, getPendingSubmissions } from "@/lib/admin";
import { getRetentionStats } from "@/lib/retention";
import { getFeedback } from "@/lib/feedback";
import { StatTile, StatGrid, StatSection } from "@/components/admin/stat-tile";
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

  const [stats, retention, pendingEdits, pendingSubmissions, feedback] =
    await Promise.all([
      getAdminStats(),
      getRetentionStats(),
      getPendingEdits(),
      getPendingSubmissions(),
      getFeedback(),
    ]);

  // Computed here, not via the client module's openFeedbackCount helper —
  // calling an export of a "use client" module from a Server Component throws.
  const openFeedback = feedback.filter((f) => f.status !== "replied").length;
  const completionsAll = stats.totals.completions + stats.guestCompletions;

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

        {/* ======================= EVERY NUMBER, AT A GLANCE ======================= */}
        <StatSection title="Audience">
          <StatGrid>
            <StatTile
              label="Unique visitors"
              value={stats.uniqueVisitors}
              hint={`${stats.uniqueVisitors30d.toLocaleString()} in 30d`}
              icon="UsersRound"
              accent="#2560e6"
              hero
            />
            <StatTile
              label="Visitors · 7d"
              value={stats.uniqueVisitors7d}
              icon="TrendingUp"
              accent="#12a150"
            />
            <StatTile
              label="Page views"
              value={stats.pageViewsTotal}
              hint={`+${stats.pageViews7d.toLocaleString()} this week`}
              icon="Eye"
              accent="#1aa9d6"
            />
            <StatTile
              label="Views · 30d"
              value={stats.pageViews30d}
              icon="CalendarClock"
              accent="#1aa9d6"
            />
            <StatTile
              label="Online now"
              value={stats.onlineNow}
              icon="Activity"
              accent="#2560e6"
              live
            />
            <StatTile
              label="Teams"
              value={stats.totalUniqueTeams}
              hint="FRC teams represented"
              icon="Flag"
              accent="#12a150"
            />
          </StatGrid>
        </StatSection>

        <StatSection title="Members">
          <StatGrid>
            <StatTile
              label="Total users"
              value={stats.totals.users}
              hint={`${stats.verifiedUsers.toLocaleString()} verified`}
              icon="Users"
              accent="#7c5cff"
              hero
            />
            <StatTile
              label="Verified"
              value={stats.verifiedUsers}
              icon="UserCheck"
              accent="#7c5cff"
            />
            <StatTile
              label="Signups · 7d"
              value={stats.signups7d}
              icon="UserPlus"
              accent="#12a150"
            />
            <StatTile
              label="Signups · 30d"
              value={stats.signups30d}
              icon="Rocket"
              accent="#12a150"
            />
            <StatTile
              label="Referral signups"
              value={stats.referralUsers}
              hint="joined via a friend"
              icon="Share2"
              accent="#1aa9d6"
            />
            <StatTile
              label="Guest learners"
              value={stats.guestLearners}
              hint="learning, no account"
              icon="Ghost"
              accent="#0ea5a3"
            />
          </StatGrid>
        </StatSection>

        <StatSection title="Learning">
          <StatGrid>
            {/* "Completions" not "Lessons completed" — the 6-across desktop tile
                truncates the longer label, and a clipped hero stat reads badly. */}
            <StatTile
              label="Completions"
              value={completionsAll}
              hint={
                stats.guestCompletions > 0
                  ? `all-time · ${stats.guestCompletions.toLocaleString()} by guests`
                  : "all-time"
              }
              icon="BookOpenCheck"
              accent="#2560e6"
              hero
            />
            <StatTile
              label="Completions · 7d"
              value={stats.completions7d}
              icon="Zap"
              accent="#f5a623"
            />
            <StatTile
              label="Completions · 30d"
              value={stats.completions30d}
              icon="CalendarClock"
              accent="#f5a623"
            />
            <StatTile
              label="Guide viewers"
              value={stats.guideViewersTotal}
              hint={`${stats.guideViewsTotal.toLocaleString()} guide views`}
              icon="BookOpen"
              accent="#d64b8a"
            />
            <StatTile
              label="Article views"
              value={stats.articleViewsTotal}
              hint={`+${stats.articleViews7d.toLocaleString()} this week`}
              icon="Newspaper"
              accent="#1aa9d6"
            />
            <StatTile
              label="Bookmarks"
              value={stats.totals.bookmarks}
              icon="Bookmark"
              accent="#7c5cff"
            />
          </StatGrid>
        </StatSection>

        <StatSection title="Retention">
          <StatGrid>
            <StatTile
              label="Activation"
              value={retention.activationPct}
              suffix="%"
              hint={`${retention.activated}/${retention.totalUsers} did a lesson`}
              icon="Percent"
              accent="#f5a623"
            />
            <StatTile
              label="Return rate"
              value={retention.returnPct}
              suffix="%"
              hint="came back a 2nd day"
              icon="Repeat"
              accent="#d64b8a"
            />
            <StatTile
              label="Power users"
              value={retention.powerUsers}
              hint="active on 5+ days"
              icon="Flame"
              accent="#f5a623"
            />
            <StatTile
              label="Median lessons"
              value={retention.medianLessons}
              hint="per activated user"
              icon="Target"
              accent="#2560e6"
            />
            <StatTile
              label="Achievements"
              value={stats.totals.achievementsEarned}
              hint="earned by members"
              icon="Trophy"
              accent="#f5a623"
            />
            <StatTile
              label="Total XP"
              value={stats.totalXP}
              hint="awarded all-time"
              icon="Sparkles"
              accent="#7c5cff"
            />
          </StatGrid>
        </StatSection>

        <StatSection title="Catalog & operations">
          <StatGrid>
            <StatTile
              label="Lessons"
              value={stats.totals.lessons}
              icon="Layers"
              accent="#2560e6"
            />
            <StatTile
              label="Departments"
              value={stats.totals.departments}
              icon="GraduationCap"
              accent="#2560e6"
            />
            <StatTile
              label="Subscribers"
              value={stats.totals.subscribers}
              hint="newsletter"
              icon="Mail"
              accent="#12a150"
            />
            <StatTile
              label="Email queue"
              value={retention.lifecycleEligible}
              hint={`${retention.emailedRecently} sent in 7d`}
              icon="Send"
              accent="#1aa9d6"
            />
            <StatTile
              label="Opted out"
              value={retention.optedOut}
              hint="of lifecycle email"
              icon="MailX"
              accent="#8a97ad"
            />
            <StatTile
              label="Open feedback"
              value={openFeedback}
              hint={`${feedback.length} total received`}
              icon="Inbox"
              accent="#d64b8a"
            />
            <StatTile
              label="Pending edits"
              value={pendingEdits.length}
              hint="community suggestions"
              icon="FileClock"
              accent="#f5a623"
            />
            <StatTile
              label="Submissions"
              value={pendingSubmissions.length}
              hint="awaiting review"
              icon="FileText"
              accent="#f5a623"
            />
          </StatGrid>
        </StatSection>

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
