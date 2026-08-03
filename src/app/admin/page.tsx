import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ShieldAlert,
  ShieldCheck,
  Users2,
  UserPlus,
  CheckCircle2,
  FileClock,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { getAdminStats, getPendingEdits, getPendingSubmissions } from "@/lib/admin";
import { getRetentionStats } from "@/lib/retention";
import { getFeedback } from "@/lib/feedback";
import { KpiStrip } from "@/components/admin/kpi-strip";
import { GrowthChart } from "@/components/admin/growth-chart";
import { TrafficPanel } from "@/components/admin/traffic-panel";
import { EngagementPanel } from "@/components/admin/engagement-panel";
import { RetentionPanel } from "@/components/admin/retention-panel";
import { SourceBreakdown } from "@/components/admin/source-breakdown";
import { FeedbackInbox } from "@/components/admin/feedback-inbox";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { AnimatedCounter } from "@/components/animated-counter";
import {
  Rise,
  Reveal,
  RevealGroup,
  RevealItem,
  Glow,
} from "@/components/motion/primitives";

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

/** Turn a raw path into a friendly label for the teams/recent lists. */
function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.round(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
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

  const [stats, pendingEdits, pendingSubmissions, retention, feedback] =
    await Promise.all([
      getAdminStats(),
      getPendingEdits(),
      getPendingSubmissions(),
      getRetentionStats(),
      getFeedback(),
    ]);

  const kpi = {
    pageViewsTotal: stats.pageViewsTotal,
    pageViews7d: stats.pageViews7d,
    uniqueVisitors: stats.uniqueVisitors,
    users: stats.totals.users,
    verifiedUsers: stats.verifiedUsers,
    signups7d: stats.signups7d,
    activationPct: retention.activationPct,
    returnPct: retention.returnPct,
    // Total lessons completed now includes no-account guest completions.
    completions: stats.totals.completions + stats.guestCompletions,
    onlineNow: stats.onlineNow,
    guestLearners: stats.guestLearners,
    guestCompletions: stats.guestCompletions,
    guideViewers: stats.guideViewersTotal,
    guideViews: stats.guideViewsTotal,
  };

  const topTeams = stats.teams.slice(0, 6);
  const maxTeam = Math.max(1, ...topTeams.map((t) => t.completed));

  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "560px", pos: { left: "-160px", top: "-200px" }, color: "#8bbcff", opacity: 0.55 },
          { size: "520px", pos: { right: "-170px", top: "60px" }, color: "#6ff0ea", opacity: 0.45, delay: 2 },
          { size: "460px", pos: { left: "36%", top: "760px" }, color: "#c8b6ff", opacity: 0.35, delay: 4 },
        ]}
      />

      <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-16 sm:px-6 lg:px-8 lg:pt-24">
        {/* ============ HEADER (slim) ============ */}
        <Rise>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
              <span style={GRADIENT}>Dashboard</span>
            </h1>
            <AutoRefresh seconds={30} />
            <span className="ac-chip inline-flex items-center gap-1.5 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span className="font-semibold tabular-nums">{stats.onlineNow}</span> online
            </span>
            <span className="ac-chip hidden text-xs sm:inline-flex">
              <span className="break-all font-mono">{user.email}</span>
            </span>
          </div>
        </Rise>

        {/* ============ NORTH-STAR KPIs ============ */}
        <div className="mt-4">
          <KpiStrip s={kpi} />
        </div>

        {/* ============ GROWTH + TRAFFIC (side by side) ============ */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Reveal>
            {/* Chip totals are TRUE 30-day-window figures (visitors =
                count(distinct) over the window, = the Traffic panel's "in the
                last 30 days"), not a sum of the per-day series. */}
            <GrowthChart
              daily={stats.daily}
              totals={{
                visitors: stats.uniqueVisitors30d,
                signups: stats.signups30d,
                completions: stats.completions30d,
              }}
            />
          </Reveal>
          <Reveal delay={0.05}>
            <TrafficPanel s={{ topPages: stats.topPages }} />
          </Reveal>
        </div>

        {/* ============ ACQUISITION + RETENTION + ENGAGEMENT ============ */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Reveal>
            <section className="ac-card p-4">
              <h2 className="mb-2.5 text-sm font-semibold">Where they come from</h2>
              <SourceBreakdown
                userWeek={stats.sources7d}
                userAllTime={stats.sources}
                visitorWeek={stats.visitorSources7d}
                visitorAllTime={stats.visitorSources}
              />
            </section>
          </Reveal>
          <Reveal delay={0.04}>
            <RetentionPanel s={retention} />
          </Reveal>
          <Reveal delay={0.08}>
            <section className="ac-card flex h-full flex-col p-4">
              <h2 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold">
                <FileClock className="h-4 w-4 text-primary" aria-hidden />
                Moderation queue
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border bg-white/60 p-2.5 text-center">
                  <div className="font-display text-xl font-bold tabular-nums text-foreground">
                    <AnimatedCounter value={pendingEdits.length} />
                  </div>
                  <div className="text-[11px] font-medium text-muted-foreground">pending edits</div>
                </div>
                <div className="rounded-lg border border-border bg-white/60 p-2.5 text-center">
                  <div className="font-display text-xl font-bold tabular-nums text-foreground">
                    <AnimatedCounter value={pendingSubmissions.length} />
                  </div>
                  <div className="text-[11px] font-medium text-muted-foreground">submissions</div>
                </div>
              </div>
              <p className="mt-auto pt-2.5 text-[11px] leading-snug text-muted-foreground">
                Auto-reviewed by the fact-checking cron every 3h.
              </p>
            </section>
          </Reveal>
        </div>

        {/* ============ ENGAGEMENT + TEAMS ============ */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Reveal>
            <EngagementPanel
              topLessons={stats.topLessons}
              topDepartments={stats.topDepartments.map((d) => ({
                name: d.name,
                completions: d.completions ?? 0,
              }))}
            />
          </Reveal>

          <Reveal delay={0.05}>
            <section className="ac-card h-full p-4">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                  <Users2 className="h-4 w-4 text-primary" aria-hidden />
                  Top teams
                </h2>
                <span className="ac-chip text-[11px] tabular-nums">{stats.totalUniqueTeams} teams</span>
              </div>
              {topTeams.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">No teams yet.</p>
              ) : (
                <RevealGroup className="space-y-2" stagger={0.03}>
                  {topTeams.map((t) => (
                    <RevealItem key={t.teamNumber}>
                      <div>
                        <div className="mb-0.5 flex items-center justify-between text-[13px]">
                          <span className="font-semibold text-foreground">#{t.teamNumber}</span>
                          <span className="tabular-nums text-[11px] text-muted-foreground">
                            {t.members} {t.members === 1 ? "member" : "members"} ·{" "}
                            <span className="font-semibold text-primary">{t.completed}</span> lessons
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full transition-[width] duration-700"
                            style={{ width: `${(t.completed / maxTeam) * 100}%`, background: "linear-gradient(90deg,var(--accent),var(--primary))" }}
                          />
                        </div>
                      </div>
                    </RevealItem>
                  ))}
                </RevealGroup>
              )}
            </section>
          </Reveal>
        </div>

        {/* ============ RECENT ACTIVITY + FEEDBACK ============ */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Reveal>
            <section className="ac-card p-4">
              <h2 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold">
                <UserPlus className="h-4 w-4 text-primary" aria-hidden />
                Newest members
              </h2>
              {stats.recentSignups.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">No signups yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {stats.recentSignups.slice(0, 6).map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                      <span className="min-w-0 truncate font-medium text-foreground">
                        {u.username ? `@${u.username}` : u.full_name || "New member"}
                        {u.team_number ? <span className="ml-1.5 text-[11px] text-muted-foreground">#{u.team_number}</span> : null}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{timeAgo(u.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </Reveal>

          <Reveal delay={0.05}>
            <section className="ac-card p-4">
              <h2 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
                Recent completions
              </h2>
              {stats.recentCompletions.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">No completions yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {stats.recentCompletions.slice(0, 6).map((c, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                      <span className="min-w-0 truncate">
                        <span className="font-medium text-foreground">{c.user}</span>
                        <span className="text-muted-foreground"> · {c.lesson}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{timeAgo(c.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </Reveal>
        </div>

        {/* ============ FEEDBACK INBOX ============ */}
        <Reveal className="mt-4">
          <FeedbackInbox items={feedback} />
        </Reveal>
      </div>
    </div>
  );
}
