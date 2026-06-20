import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Users,
  CheckCircle2,
  Zap,
  BookOpen,
  Layers,
  Award,
  ShieldAlert,
  TrendingUp,
  Mail,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { getAdminStats } from "@/lib/admin";
import { deptMeta } from "@/lib/departments";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AnimatedCounter } from "@/components/animated-counter";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { ActivityChart } from "@/components/admin/activity-chart";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const { user, isAdmin } = await getSession();
  if (!user) redirect("/login?next=/admin");

  if (!isAdmin) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 pt-40 pb-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-2xl font-bold">Not authorized</h1>
        <p className="mt-2 text-muted-foreground">
          This area is restricted to LearnFRC administrators.
        </p>
        <Link href="/dashboard" className="mt-6 text-sm text-primary hover:underline">
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

  const cards = [
    { label: "Learners", value: stats.totals.users, icon: Users, sub: `+${stats.signups7d} this week` },
    { label: "Lessons completed", value: stats.totals.completions, icon: CheckCircle2, sub: `+${stats.completions7d} this week` },
    { label: "Total XP awarded", value: stats.totalXP, icon: Zap, sub: "across all learners" },
    { label: "Achievements earned", value: stats.totals.achievementsEarned, icon: Award, sub: "badges unlocked" },
    { label: "Lessons", value: stats.totals.lessons, icon: BookOpen, sub: `${stats.totals.departments} departments` },
    { label: "Bookmarks", value: stats.totals.bookmarks, icon: Layers, sub: "saved lessons" },
    { label: "Email subscribers", value: stats.totals.subscribers, icon: Mail, sub: "early-access list" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
      <Reveal>
        <div className="flex items-center gap-3">
          <Badge variant="primary">
            <ShieldAlert className="h-3.5 w-3.5" /> Admin
          </Badge>
          <span className="text-sm text-muted-foreground">
            Signed in as {user.email}
          </span>
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Overview</h1>
        <p className="mt-1.5 text-muted-foreground">
          Live metrics across LearnFRC.
        </p>
      </Reveal>

      <Stagger className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map((c) => (
          <StaggerItem key={c.label}>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{c.label}</span>
                <c.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-2 font-display text-3xl font-bold">
                <AnimatedCounter value={c.value} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{c.sub}</div>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <Reveal className="lg:col-span-3">
          <div className="h-full rounded-2xl border border-border bg-card p-6">
            <div className="mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Activity</h2>
            </div>
            <ActivityChart data={stats.daily} />
          </div>
        </Reveal>

        <Reveal delay={0.05} className="lg:col-span-2">
          <div className="h-full rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-4 font-semibold">Top departments</h2>
            <div className="space-y-3">
              {stats.topDepartments.slice(0, 8).map((d) => {
                const m = deptMeta(d.slug);
                const pct = Math.round(((d.completions ?? 0) / maxCompletions) * 100);
                return (
                  <div key={d.id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="truncate">{d.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {d.completions ?? 0}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: m.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>

      <Reveal className="mt-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 font-semibold">Recent signups</h2>
          {stats.recentSignups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No signups yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 font-medium">Member</th>
                    <th className="pb-2 font-medium">Team</th>
                    <th className="pb-2 text-right font-medium">XP</th>
                    <th className="pb-2 text-right font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentSignups.map((p) => (
                    <tr key={p.id} className="border-b border-border/60 last:border-0">
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
                      <td className="py-3 text-muted-foreground">
                        {p.team_number ? `#${p.team_number}` : "—"}
                      </td>
                      <td className="py-3 text-right font-mono">{p.xp}</td>
                      <td className="py-3 text-right text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Reveal>

      <Reveal className="mt-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Users</h2>
            <Badge variant="outline">{stats.users.length} total</Badge>
          </div>
          {stats.users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 font-medium">Member</th>
                    <th className="pb-2 font-medium">Team</th>
                    <th className="pb-2 text-right font-medium">XP</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.users.map((u) => (
                    <tr key={u.id} className="border-b border-border/60 last:border-0">
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            name={u.full_name || u.username || u.email}
                            seed={u.id}
                            className="h-8 w-8"
                          />
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {u.full_name || u.username || "Learner"}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {u.team_number ? `#${u.team_number}` : "—"}
                      </td>
                      <td className="py-3 text-right font-mono">{u.xp}</td>
                      <td className="py-3">
                        {u.confirmed ? (
                          <Badge variant="success">Verified</Badge>
                        ) : (
                          <Badge variant="warning">Unverified</Badge>
                        )}
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Reveal>
    </div>
  );
}
