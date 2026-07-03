import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  PieChart,
  Users,
  UserPlus,
  CheckCircle2,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { getAdminStats } from "@/lib/admin";
import { Avatar } from "@/components/ui/avatar";
import { ActivityChart } from "@/components/admin/activity-chart";
import { AdminOverview } from "@/components/admin/admin-overview";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { SourceBreakdown } from "@/components/admin/source-breakdown";
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
import { MissionRail } from "./_mission-rail";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const { user, isAdmin } = await getSession();
  if (!user) redirect("/login?next=/admin");

  if (!isAdmin) {
    return (
      <div className="relative overflow-x-clip">
        <Glow
          blobs={[
            {
              size: "480px",
              pos: { left: "50%", top: "-160px" },
              color: "#8bbcff",
              opacity: 0.4,
            },
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
            <h1 className="mt-6 font-display text-3xl font-bold">
              Access denied
            </h1>
          </Rise>
          <Rise delay={0.14}>
            <p className="mt-3 text-base leading-relaxed text-foreground/70">
              The pit&rsquo;s locked. This control room is reserved for
              LearnFRC administrators.
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

  const stats = await getAdminStats();
  const maxCompletions = Math.max(
    1,
    ...stats.topDepartments.map((d) => d.completions ?? 0)
  );

  // Live vitals for the mission-control command rail (signature element).
  const railVitals = [
    {
      icon: "userPlus" as const,
      label: "New this week",
      value: stats.signups7d,
      hint: "signups",
    },
    {
      icon: "checkCircle" as const,
      label: "Completed 7d",
      value: stats.completions7d,
      hint: "lessons",
    },
    {
      icon: "users" as const,
      label: "Total learners",
      value: stats.totals.users,
      hint: `${stats.verifiedUsers} verified`,
    },
  ];

  return (
    <div className="relative overflow-x-clip">
      {/* Ambient drifting glows — on the FULL-WIDTH wrapper so their clipping
          happens at the viewport edge, never mid-page at the container edge. */}
      <Glow
        blobs={[
          {
            size: "520px",
            pos: { left: "-140px", top: "-180px" },
            color: "#8bbcff",
            opacity: 0.6,
          },
          {
            size: "480px",
            pos: { right: "-160px", top: "60px" },
            color: "#6ff0ea",
            opacity: 0.5,
            delay: 2,
          },
          {
            size: "440px",
            pos: { left: "34%", top: "620px" },
            color: "#c8b6ff",
            opacity: 0.4,
            delay: 4,
          },
        ]}
      />

      <div className="relative mx-auto max-w-6xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
        {/* ===================== HERO: control-room header ===================== */}
        <section className="grid items-center gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
          <RiseGroup>
            <RiseItem>
              <span className="ac-chip inline-flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span className="ac-eyebrow">Mission control</span>
              </span>
            </RiseItem>
            <RiseItem>
              <h1 className="mt-4 text-balance font-display text-4xl font-extrabold leading-[1.03] sm:text-5xl">
                The pit dashboard for{" "}
                <span
                  style={{
                    background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  LearnFRC
                </span>
              </h1>
            </RiseItem>
            <RiseItem>
              <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-foreground/70">
                Every metric across the platform, refreshing itself while
                build season rolls on. Tap a highlighted card to drill in.
              </p>
            </RiseItem>
            <RiseItem>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <AutoRefresh seconds={30} />
                <span className="ac-chip max-w-full text-xs">
                  Signed in as{" "}
                  <span className="ml-1 break-all font-mono">
                    {user.email}
                  </span>
                </span>
              </div>
            </RiseItem>
          </RiseGroup>

          {/* SIGNATURE: floating glass "command rail" — live vitals readout */}
          <MissionRail onlineNow={stats.onlineNow} vitals={railVitals} />
        </section>

        {/* ===================== OVERVIEW: metric console grid ===================== */}
        <Reveal className="mt-10">
          <span className="ac-eyebrow">The whole platform</span>
          <AdminOverview
            data={{
              onlineNow: stats.onlineNow,
              users: stats.totals.users,
              verifiedUsers: stats.verifiedUsers,
              completions: stats.totals.completions,
              totalXP: stats.totalXP,
              achievementsEarned: stats.totals.achievementsEarned,
              lessons: stats.totals.lessons,
              departments: stats.totals.departments,
              bookmarks: stats.totals.bookmarks,
              subscribers: stats.totals.subscribers,
              signups7d: stats.signups7d,
              completions7d: stats.completions7d,
              totalTeams: stats.totalUniqueTeams,
              referralUsers: stats.referralUsers,
              articleViewsTotal: stats.articleViewsTotal,
              articleViews7d: stats.articleViews7d,
            }}
            users={stats.users}
            teams={stats.teams}
            completions={stats.recentCompletions}
            subscribers={stats.subscriberList}
            achievements={stats.achievementBreakdown}
            onlineUsers={stats.onlineUsers}
            recruiters={stats.recruiters}
            articleViews={stats.articleViews}
          />
        </Reveal>

        {/* ===================== SIGNALS: activity + top depts ===================== */}
        <div className="mt-10">
          <Reveal>
            <span className="ac-eyebrow">Signals</span>
          </Reveal>
          <div className="mt-3 grid gap-6 lg:grid-cols-5">
            <Reveal className="h-full lg:col-span-3">
              <Hover className="h-full" lift={-3} scale={1.005}>
                <section className="ac-card flex h-full flex-col p-5 sm:p-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-lg font-semibold">
                      <span
                        className="ac-badge flex h-9 w-9 items-center justify-center"
                        style={{ "--a": "var(--primary)" } as CSSProperties}
                      >
                        <TrendingUp className="h-[18px] w-[18px]" aria-hidden="true" />
                      </span>
                      Activity
                    </h2>
                    <span className="ac-chip text-xs">Last 14 days</span>
                  </div>
                  <ActivityChart data={stats.daily} />
                </section>
              </Hover>
            </Reveal>

            <Reveal delay={0.05} className="h-full lg:col-span-2">
              <Hover className="h-full" lift={-3} scale={1.005}>
                <section className="ac-card flex h-full flex-col p-5 sm:p-6">
                  <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold">
                    <span
                      className="ac-badge flex h-9 w-9 items-center justify-center"
                      style={{ "--a": "var(--accent)" } as CSSProperties}
                    >
                      <TrendingUp className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                    Top departments
                  </h2>
                  <RevealGroup className="space-y-3.5" stagger={0.05}>
                    {stats.topDepartments.slice(0, 8).map((d) => {
                      const pct = Math.round(
                        ((d.completions ?? 0) / maxCompletions) * 100
                      );
                      return (
                        <RevealItem key={d.id}>
                          <div className="mb-1.5 flex items-center justify-between text-sm">
                            <span className="truncate font-medium text-foreground">
                              {d.name}
                            </span>
                            <span className="tabular-nums text-xs font-semibold text-primary">
                              <AnimatedCounter value={d.completions ?? 0} />
                            </span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-primary/10">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                background:
                                  "linear-gradient(90deg, var(--accent), var(--primary))",
                              }}
                            />
                          </div>
                        </RevealItem>
                      );
                    })}
                  </RevealGroup>
                </section>
              </Hover>
            </Reveal>
          </div>
        </div>

        {/* ===================== ACQUISITION ===================== */}
        <Reveal className="mt-6">
          <section className="ac-card p-5 sm:p-6">
            <h2 className="mb-1.5 flex items-center gap-2 text-lg font-semibold">
              <span
                className="ac-badge flex h-9 w-9 items-center justify-center"
                style={{ "--a": "var(--accent)" } as CSSProperties}
              >
                <PieChart className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              Where users come from
            </h2>
            <p className="mb-5 max-w-md text-sm leading-relaxed text-foreground/70">
              Acquisition source captured at signup — toggle last 7 days vs
              all-time to see what&rsquo;s driving signups now. Pre-tracking
              users show as &ldquo;Unknown / Direct.&rdquo;
            </p>
            <SourceBreakdown week={stats.sources7d} allTime={stats.sources} />
          </section>
        </Reveal>

        {/* ===================== RECENT SIGNUPS ===================== */}
        <Reveal className="mt-6">
          <section className="ac-card p-5 sm:p-6">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold">
              <span
                className="ac-badge flex h-9 w-9 items-center justify-center"
                style={{ "--a": "var(--primary)" } as CSSProperties}
              >
                <Users className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              Recent signups
            </h2>
            {stats.recentSignups.length === 0 ? (
              <p className="text-sm text-foreground/70">No signups yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm [&_td]:px-3 [&_th]:px-3 [&_td:first-child]:pl-0 [&_th:first-child]:pl-0 [&_td:last-child]:pr-0 [&_th:last-child]:pr-0">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2.5 font-medium">Member</th>
                      <th className="pb-2.5 font-medium">Team</th>
                      <th className="pb-2.5 text-right font-medium">XP</th>
                      <th className="pb-2.5 text-right font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentSignups.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-border/60 transition-colors last:border-0 hover:bg-primary/[0.05]"
                      >
                        <td className="py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              name={p.full_name || p.username}
                              seed={p.id}
                              className="h-8 w-8"
                            />
                            <span className="font-medium text-foreground">
                              {p.full_name || p.username || "Learner"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 tabular-nums text-muted-foreground">
                          {p.team_number ? `#${p.team_number}` : "—"}
                        </td>
                        <td className="py-3 text-right tabular-nums font-semibold text-primary">
                          <AnimatedCounter value={p.xp} />
                        </td>
                        <td className="py-3 text-right tabular-nums text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </Reveal>
      </div>
    </div>
  );
}
