import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert, TrendingUp, PieChart } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getAdminStats } from "@/lib/admin";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/motion/reveal";
import { TerminalFrame, StatusPill } from "@/components/motion/terminal";
import { ActivityChart } from "@/components/admin/activity-chart";
import { AdminOverview } from "@/components/admin/admin-overview";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { SourceBreakdown } from "@/components/admin/source-breakdown";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const { user, isAdmin } = await getSession();
  if (!user) redirect("/login?next=/admin");

  if (!isAdmin) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 pt-40 pb-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive shadow-[0_0_24px_-6px_var(--destructive)]">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold">Access denied</h1>
        <p className="mt-2 font-mono text-sm text-muted-foreground">
          // this area is restricted to LearnFRC administrators
        </p>
        <Link
          href="/dashboard"
          className="mt-6 font-mono text-sm text-primary transition-colors hover:underline"
        >
          ← back to dashboard
        </Link>
      </div>
    );
  }

  const stats = await getAdminStats();
  const maxCompletions = Math.max(
    1,
    ...stats.topDepartments.map((d) => d.completions ?? 0)
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
      <Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill tone="primary">ADMIN</StatusPill>
          <span className="font-mono text-xs text-muted-foreground">
            signed in as {user.email}
          </span>
          <span className="ml-auto">
            <AutoRefresh seconds={30} />
          </span>
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Mission <span className="text-gradient">control</span>
        </h1>
        <p className="mt-1.5 font-mono text-sm text-muted-foreground">
          // live metrics across LearnFRC — tap a highlighted card to drill in
        </p>
      </Reveal>

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
        }}
        users={stats.users}
        teams={stats.teams}
        completions={stats.recentCompletions}
        subscribers={stats.subscriberList}
        achievements={stats.achievementBreakdown}
        onlineUsers={stats.onlineUsers}
        recruiters={stats.recruiters}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <Reveal className="lg:col-span-3 h-full">
          <TerminalFrame
            title="~/admin $ tail -f activity.log"
            glow
            className="h-full"
            bodyClassName="p-5 sm:p-6"
            right={
              <span className="font-mono text-[11px] text-muted-foreground">14d</span>
            }
          >
            <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-primary" /> Activity
            </h2>
            <ActivityChart data={stats.daily} />
          </TerminalFrame>
        </Reveal>

        <Reveal delay={0.05} className="lg:col-span-2 h-full">
          <TerminalFrame
            title="~/admin $ sort -rk completions"
            className="h-full"
            bodyClassName="p-5 sm:p-6"
          >
            <h2 className="mb-4 font-display font-semibold">Top departments</h2>
            <div className="space-y-3">
              {stats.topDepartments.slice(0, 8).map((d) => {
                const pct = Math.round(((d.completions ?? 0) / maxCompletions) * 100);
                return (
                  <div key={d.id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="truncate">{d.name}</span>
                      <span className="font-mono text-xs text-accent">
                        {d.completions ?? 0}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background:
                            "linear-gradient(90deg, var(--accent), var(--primary))",
                          boxShadow:
                            "0 0 10px color-mix(in srgb, var(--primary) 45%, transparent)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </TerminalFrame>
        </Reveal>
      </div>

      <Reveal className="mt-6">
        <TerminalFrame
          title="~/admin $ analyze --sources"
          glow
          bodyClassName="p-5 sm:p-6"
        >
          <h2 className="mb-1 flex items-center gap-2 font-display font-semibold">
            <PieChart className="h-4 w-4 text-primary" /> Where users come from
          </h2>
          <p className="mb-5 max-w-md font-mono text-xs text-muted-foreground">
            // acquisition source captured at signup — toggle last 7 days vs
            all-time to see what&rsquo;s driving signups now. Pre-tracking users
            show as &ldquo;Unknown / Direct.&rdquo;
          </p>
          <SourceBreakdown week={stats.sources7d} allTime={stats.sources} />
        </TerminalFrame>
      </Reveal>

      <Reveal className="mt-6">
        <TerminalFrame
          title="~/admin $ tail signups.log"
          bodyClassName="p-5 sm:p-6"
        >
          <h2 className="mb-4 font-display font-semibold">Recent signups</h2>
          {stats.recentSignups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No signups yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm [&_th]:px-3 [&_td]:px-3 [&_th:first-child]:pl-0 [&_td:first-child]:pl-0 [&_th:last-child]:pr-0 [&_td:last-child]:pr-0">
                <thead>
                  <tr className="border-b border-border text-left font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 font-medium">Member</th>
                    <th className="pb-2 font-medium">Team</th>
                    <th className="pb-2 text-right font-medium">XP</th>
                    <th className="pb-2 text-right font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentSignups.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-border/60 transition-colors last:border-0 hover:bg-primary/[0.04]"
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            name={p.full_name || p.username}
                            seed={p.id}
                            className="h-8 w-8"
                          />
                          <span className="font-medium">
                            {p.full_name || p.username || "Learner"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 font-mono text-muted-foreground">
                        {p.team_number ? `#${p.team_number}` : "—"}
                      </td>
                      <td className="py-3 text-right font-mono text-accent">{p.xp}</td>
                      <td className="py-3 text-right font-mono text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TerminalFrame>
      </Reveal>
    </div>
  );
}
