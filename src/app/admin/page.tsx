import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert, TrendingUp, PieChart, Users } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getAdminStats } from "@/lib/admin";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/motion/reveal";
import { ActivityChart } from "@/components/admin/activity-chart";
import { AdminOverview } from "@/components/admin/admin-overview";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { SourceBreakdown } from "@/components/admin/source-breakdown";
import { AnimatedCounter } from "@/components/animated-counter";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const { user, isAdmin } = await getSession();
  if (!user) redirect("/login?next=/admin");

  if (!isAdmin) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 pt-40 pb-20 text-center">
        <div
          className="aq-badge flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ "--a": "#e06a6a" } as CSSProperties}
        >
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-3xl font-bold">Access denied</h1>
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          The pit&rsquo;s locked. This control room is reserved for LearnFRC
          administrators.
        </p>
        <Link href="/dashboard" className="aq-cta mt-7 inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold">
          Back to dashboard
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
    <div className="relative mx-auto max-w-6xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
      {/* Ambient glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <span className="absolute -top-24 left-[8%] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(37,96,230,0.16),transparent_70%)] blur-2xl" />
        <span className="absolute top-40 right-[4%] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(26,169,214,0.14),transparent_70%)] blur-2xl" />
        <span className="absolute bottom-10 left-[30%] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(139,127,255,0.12),transparent_70%)] blur-2xl" />
      </div>

      {/* Hero */}
      <div className="flex flex-wrap items-center gap-3 aq-rise aq-rise-1">
        <span className="aq-eyebrow inline-flex items-center gap-2">
          <span className="aq-pulse inline-block h-2 w-2 rounded-full bg-primary" />
          Mission control
        </span>
        <span className="aq-chip font-mono text-xs">
          Signed in as {user.email}
        </span>
        <span className="ml-auto">
          <AutoRefresh seconds={30} />
        </span>
      </div>
      <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl aq-rise aq-rise-2">
        Live across{" "}
        <span
          className="aq-grad-anim"
          style={{
            background: "linear-gradient(120deg,#2560e6,#1aa9d6,#8b7fff,#2560e6)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          LearnFRC
        </span>
      </h1>
      <p className="mt-3 max-w-xl text-base leading-relaxed text-foreground/70 aq-rise aq-rise-3">
        Every metric across the platform, refreshing itself while build season
        rolls on. Tap a highlighted card to drill in.
      </p>

      {/* Overview metric cards (client island — unchanged data + panels) */}
      <div className="mt-8 aq-rise aq-rise-4">
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
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <Reveal className="lg:col-span-3 h-full">
          <section className="aq-card aq-card-hover aq-sheen flex h-full flex-col p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <span
                  className="aq-icon aq-badge-bob h-9 w-9"
                  style={{ "--a": "#2560e6" } as CSSProperties}
                >
                  <TrendingUp className="h-4.5 w-4.5" />
                </span>
                Activity
              </h2>
              <span className="aq-chip text-[11px]">Last 14 days</span>
            </div>
            <ActivityChart data={stats.daily} />
          </section>
        </Reveal>

        <Reveal delay={0.05} className="lg:col-span-2 h-full">
          <section className="aq-card aq-card-hover flex h-full flex-col p-5 sm:p-6">
            <h2 className="mb-5 text-lg font-semibold">Top departments</h2>
            <div className="space-y-3.5">
              {stats.topDepartments.slice(0, 8).map((d, i) => {
                const pct = Math.round(((d.completions ?? 0) / maxCompletions) * 100);
                return (
                  <div
                    key={d.id}
                    className="aq-reveal"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="truncate font-medium text-foreground">
                        {d.name}
                      </span>
                      <span className="font-mono text-xs font-semibold text-primary">
                        <AnimatedCounter value={d.completions ?? 0} />
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-primary/10">
                      <div
                        className="aq-bar-anim h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          animationDelay: `${i * 60}ms`,
                          background:
                            "linear-gradient(90deg, var(--accent), var(--primary))",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </Reveal>
      </div>

      <Reveal className="mt-6">
        <section className="aq-card p-5 sm:p-6">
          <h2 className="mb-1.5 flex items-center gap-2 text-lg font-semibold">
            <span
              className="aq-icon aq-badge-bob h-9 w-9"
              style={{ "--a": "#1aa9d6" } as CSSProperties}
            >
              <PieChart className="h-4.5 w-4.5" />
            </span>
            Where users come from
          </h2>
          <p className="mb-5 max-w-md text-sm leading-relaxed text-foreground/70">
            Acquisition source captured at signup — toggle last 7 days vs
            all-time to see what&rsquo;s driving signups now. Pre-tracking users
            show as &ldquo;Unknown / Direct.&rdquo;
          </p>
          <SourceBreakdown week={stats.sources7d} allTime={stats.sources} />
        </section>
      </Reveal>

      <Reveal className="mt-6">
        <section className="aq-card p-5 sm:p-6">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold">
            <span
              className="aq-icon aq-badge-bob h-9 w-9"
              style={{ "--a": "#8b7fff" } as CSSProperties}
            >
              <Users className="h-4.5 w-4.5" />
            </span>
            Recent signups
          </h2>
          {stats.recentSignups.length === 0 ? (
            <p className="text-sm text-foreground/70">No signups yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm [&_th]:px-3 [&_td]:px-3 [&_th:first-child]:pl-0 [&_td:first-child]:pl-0 [&_th:last-child]:pr-0 [&_td:last-child]:pr-0">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2.5 font-medium">Member</th>
                    <th className="pb-2.5 font-medium">Team</th>
                    <th className="pb-2.5 text-right font-medium">XP</th>
                    <th className="pb-2.5 text-right font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentSignups.map((p, i) => (
                    <tr
                      key={p.id}
                      className="aq-reveal border-b border-border/60 transition-colors last:border-0 hover:bg-primary/[0.05]"
                      style={{ animationDelay: `${i * 45}ms` }}
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
                      <td className="py-3 font-mono text-muted-foreground">
                        {p.team_number ? `#${p.team_number}` : "—"}
                      </td>
                      <td className="py-3 text-right font-mono font-semibold text-primary">
                        <AnimatedCounter value={p.xp} />
                      </td>
                      <td className="py-3 text-right font-mono text-muted-foreground">
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
  );
}
