import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ShieldAlert,
  ShieldCheck,
  Users2,
  Trophy,
  UserPlus,
  CheckCircle2,
  Inbox,
  FileClock,
  Sparkles,
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
  RiseGroup,
  RiseItem,
  Reveal,
  RevealGroup,
  RevealItem,
  Hover,
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
    completions: stats.totals.completions,
    onlineNow: stats.onlineNow,
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

      <div className="relative mx-auto max-w-7xl px-4 pt-24 pb-24 sm:px-6 lg:px-8 lg:pt-28">
        {/* ============ HERO ============ */}
        <RiseGroup>
          <RiseItem>
            <span className="ac-chip inline-flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="ac-eyebrow">Mission control</span>
            </span>
          </RiseItem>
          <RiseItem>
            <h1 className="mt-4 text-balance font-display text-4xl font-extrabold leading-[1.03] sm:text-5xl">
              LearnFRC <span style={GRADIENT}>dashboard</span>
            </h1>
          </RiseItem>
          <RiseItem>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <AutoRefresh seconds={30} />
              <span className="ac-chip inline-flex items-center gap-1.5 text-xs">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                <span className="font-semibold tabular-nums">{stats.onlineNow}</span> online now
              </span>
              <span className="ac-chip max-w-full text-xs">
                <span className="break-all font-mono">{user.email}</span>
              </span>
            </div>
          </RiseItem>
        </RiseGroup>

        {/* ============ NORTH-STAR KPIs ============ */}
        <div className="mt-8">
          <KpiStrip s={kpi} />
        </div>

        {/* ============ GROWTH CHART ============ */}
        <Reveal className="mt-6">
          <GrowthChart daily={stats.daily} />
        </Reveal>

        {/* ============ TRAFFIC ============ */}
        <Reveal className="mt-6">
          <TrafficPanel
            s={{
              pageViewsTotal: stats.pageViewsTotal,
              pageViews7d: stats.pageViews7d,
              pageViews30d: stats.pageViews30d,
              uniqueVisitors: stats.uniqueVisitors,
              uniqueVisitors30d: stats.uniqueVisitors30d,
              topPages: stats.topPages,
            }}
          />
        </Reveal>

        {/* ============ ACQUISITION + RETENTION ============ */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Reveal>
            <section className="ac-card p-5 sm:p-6">
              <h2 className="mb-4 font-display text-lg font-semibold">Where they come from</h2>
              <SourceBreakdown
                userWeek={stats.sources7d}
                userAllTime={stats.sources}
                visitorWeek={stats.visitorSources7d}
                visitorAllTime={stats.visitorSources}
              />
            </section>
          </Reveal>
          <Reveal delay={0.05}>
            <RetentionPanel s={retention} />
          </Reveal>
        </div>

        {/* ============ ENGAGEMENT ============ */}
        <Reveal className="mt-6">
          <EngagementPanel
            topLessons={stats.topLessons}
            topDepartments={stats.topDepartments.map((d) => ({
              name: d.name,
              completions: d.completions ?? 0,
            }))}
          />
        </Reveal>

        {/* ============ TEAMS + REVIEW QUEUE ============ */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Reveal>
            <section className="ac-card p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <span className="ac-badge flex h-9 w-9 items-center justify-center" style={{ "--a": "#2560e6" } as CSSProperties}>
                    <Users2 className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  Top teams
                </h2>
                <span className="ac-chip text-xs tabular-nums">{stats.totalUniqueTeams} teams</span>
              </div>
              {topTeams.length === 0 ? (
                <p className="text-sm text-muted-foreground">No teams yet.</p>
              ) : (
                <RevealGroup className="space-y-3" stagger={0.05}>
                  {topTeams.map((t) => (
                    <RevealItem key={t.teamNumber}>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-semibold text-foreground">#{t.teamNumber}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {t.members} {t.members === 1 ? "member" : "members"} ·{" "}
                            <span className="font-semibold text-primary">{t.completed}</span> lessons
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
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

          <Reveal delay={0.05}>
            <section className="ac-card flex h-full flex-col p-5 sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
                <span className="ac-badge flex h-9 w-9 items-center justify-center" style={{ "--a": "#f5a623" } as CSSProperties}>
                  <FileClock className="h-[18px] w-[18px]" aria-hidden />
                </span>
                Moderation queue
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-white/60 p-4 text-center">
                  <div className="font-display text-3xl font-extrabold tabular-nums text-foreground">
                    <AnimatedCounter value={pendingEdits.length} />
                  </div>
                  <div className="mt-1 text-xs font-medium text-muted-foreground">pending edits</div>
                </div>
                <div className="rounded-xl border border-border bg-white/60 p-4 text-center">
                  <div className="font-display text-3xl font-extrabold tabular-nums text-foreground">
                    <AnimatedCounter value={pendingSubmissions.length} />
                  </div>
                  <div className="mt-1 text-xs font-medium text-muted-foreground">submissions</div>
                </div>
              </div>
              <p className="mt-auto pt-4 text-xs leading-relaxed text-muted-foreground">
                Community edits &amp; submissions are auto-reviewed by the
                fact-checking cron every 3 hours — these are what&rsquo;s still in
                flight.
              </p>
            </section>
          </Reveal>
        </div>

        {/* ============ FEEDBACK INBOX ============ */}
        <Reveal className="mt-6">
          <FeedbackInbox items={feedback} />
        </Reveal>

        {/* ============ RECENT ACTIVITY ============ */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Reveal>
            <section className="ac-card p-5 sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
                <span className="ac-badge flex h-9 w-9 items-center justify-center" style={{ "--a": "#12a150" } as CSSProperties}>
                  <UserPlus className="h-[18px] w-[18px]" aria-hidden />
                </span>
                Newest members
              </h2>
              {stats.recentSignups.length === 0 ? (
                <p className="text-sm text-muted-foreground">No signups yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {stats.recentSignups.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0 truncate font-medium text-foreground">
                        {u.username ? `@${u.username}` : u.full_name || "New member"}
                        {u.team_number ? <span className="ml-1.5 text-xs text-muted-foreground">#{u.team_number}</span> : null}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{timeAgo(u.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </Reveal>

          <Reveal delay={0.05}>
            <section className="ac-card p-5 sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
                <span className="ac-badge flex h-9 w-9 items-center justify-center" style={{ "--a": "#7c5cff" } as CSSProperties}>
                  <CheckCircle2 className="h-[18px] w-[18px]" aria-hidden />
                </span>
                Recent completions
              </h2>
              {stats.recentCompletions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No completions yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {stats.recentCompletions.slice(0, 8).map((c, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0 truncate">
                        <span className="font-medium text-foreground">{c.user}</span>
                        <span className="text-muted-foreground"> · {c.lesson}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{timeAgo(c.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </Reveal>
        </div>

        <Reveal className="mt-8">
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            Live data · refreshes every 30s · {stats.totals.lessons} lessons across {stats.totals.departments} departments
          </p>
        </Reveal>
      </div>
    </div>
  );
}
