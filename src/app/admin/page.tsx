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
  Activity,
  UserPlus,
  CheckCircle2,
} from "lucide-react";
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
          className="aq-badge aq-badge-bob flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ "--a": "var(--destructive)" } as CSSProperties}
        >
          <ShieldAlert className="h-8 w-8" aria-hidden="true" />
        </div>
        <h1 className="mt-6 text-3xl font-bold">Access denied</h1>
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          The pit&rsquo;s locked. This control room is reserved for LearnFRC
          administrators.
        </p>
        <Link
          href="/dashboard"
          className="aq-cta mt-7 inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
        >
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

  // Live vitals for the mission-control command rail (signature element).
  const railVitals = [
    {
      icon: UserPlus,
      label: "New this week",
      value: stats.signups7d,
      suffix: "",
      hint: "signups",
    },
    {
      icon: CheckCircle2,
      label: "Completed 7d",
      value: stats.completions7d,
      suffix: "",
      hint: "lessons",
    },
    {
      icon: Users,
      label: "Total learners",
      value: stats.totals.users,
      suffix: "",
      hint: `${stats.verifiedUsers} verified`,
    },
  ];

  return (
    <div className="relative overflow-x-clip">
      {/* Ambient drifting glows — on the FULL-WIDTH wrapper so their clipping
          happens at the viewport edge, never mid-page at the container edge. */}
      <div className="aq-glow" aria-hidden>
        <span
          className="h-[520px] w-[520px] opacity-60"
          style={{
            left: "-140px",
            top: "-180px",
            background: "radial-gradient(circle, #8bbcff, transparent 70%)",
          }}
        />
        <span
          className="h-[480px] w-[480px] opacity-50"
          style={{
            right: "-160px",
            top: "60px",
            background: "radial-gradient(circle, #6ff0ea, transparent 70%)",
          }}
        />
        <span
          className="h-[440px] w-[440px] opacity-40"
          style={{
            left: "34%",
            top: "620px",
            background: "radial-gradient(circle, #c8b6ff, transparent 70%)",
          }}
        />
      </div>
    <div className="relative mx-auto max-w-6xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">

      {/* ===================== HERO: control-room header ===================== */}
      <section className="grid items-center gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
        <div>
          <span className="aq-eyebrow aq-rise aq-rise-1 inline-flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Mission control
          </span>
          <h1 className="aq-display aq-rise aq-rise-2 mt-4 text-balance text-4xl font-extrabold leading-[1.03] sm:text-5xl">
            The pit dashboard for{" "}
            <span
              className="aq-grad-anim"
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
          <p className="aq-rise aq-rise-3 mt-4 max-w-xl text-pretty text-base leading-relaxed text-foreground/70">
            Every metric across the platform, refreshing itself while build
            season rolls on. Tap a highlighted card to drill in.
          </p>
          <div className="aq-rise aq-rise-4 mt-6 flex flex-wrap items-center gap-3">
            <AutoRefresh seconds={30} />
            <span className="aq-chip max-w-full text-xs">
              Signed in as{" "}
              <span className="ml-1 break-all font-mono">{user.email}</span>
            </span>
          </div>
        </div>

        {/* SIGNATURE: floating glass "command rail" — live vitals readout */}
        <aside className="aq-glass aq-float aq-rise aq-rise-3 rounded-3xl p-6 lg:justify-self-end">
          <div className="mb-5 flex items-center justify-between gap-3">
            <span className="aq-display text-[17px] font-bold text-foreground">
              Live vitals
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[#0a7a43]">
              <span className="aq-pulse h-2 w-2 rounded-full bg-[#12b565]" />
              Online
            </span>
          </div>

          {/* Big online-now readout with a live ring */}
          <div className="mb-5 flex items-center gap-4">
            <svg width="82" height="82" viewBox="0 0 82 82" aria-hidden>
              <circle
                cx="41"
                cy="41"
                r="34"
                fill="none"
                stroke="rgba(120,145,190,.28)"
                strokeWidth="10"
              />
              <circle
                className="aq-ring-anim"
                cx="41"
                cy="41"
                r="34"
                fill="none"
                stroke="url(#aqadminring)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray="213.6"
                strokeDashoffset="47"
                transform="rotate(-90 41 41)"
              />
              <defs>
                <linearGradient id="aqadminring" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#2560e6" />
                  <stop offset="1" stopColor="#1aa9d6" />
                </linearGradient>
              </defs>
              <foreignObject x="21" y="30" width="40" height="24">
                <div className="flex h-6 items-center justify-center text-foreground/60">
                  <Activity className="h-5 w-5" aria-hidden="true" />
                </div>
              </foreignObject>
            </svg>
            <div>
              <div className="aq-display text-3xl font-extrabold leading-none text-foreground">
                <AnimatedCounter value={stats.onlineNow} />
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                signed in · last 5 min
              </div>
            </div>
          </div>

          <div className="aq-divider mb-4" />

          {/* Vitals list */}
          <div className="space-y-3">
            {railVitals.map((v, i) => (
              <div
                key={v.label}
                className="aq-reveal flex items-center gap-3"
                style={{ animationDelay: `${0.15 + i * 0.1}s` }}
              >
                <span
                  className="aq-icon flex h-9 w-9 shrink-0 items-center justify-center"
                  style={{ "--a": "var(--primary)" } as CSSProperties}
                >
                  <v.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {v.label}
                  </div>
                  <div className="text-xs text-muted-foreground">{v.hint}</div>
                </div>
                <span className="aq-display shrink-0 text-xl font-extrabold tabular-nums text-primary">
                  <AnimatedCounter value={v.value} suffix={v.suffix} />
                </span>
              </div>
            ))}
          </div>
        </aside>
      </section>

      {/* ===================== OVERVIEW: metric console grid ===================== */}
      <div className="mt-10 aq-rise aq-rise-5">
        <span className="aq-eyebrow">The whole platform</span>
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

      {/* ===================== SIGNALS: activity + top depts ===================== */}
      <div className="mt-10">
        <Reveal>
          <span className="aq-eyebrow">Signals</span>
        </Reveal>
        <div className="mt-3 grid gap-6 lg:grid-cols-5">
          <Reveal className="lg:col-span-3 h-full">
            <section className="aq-card aq-card-hover flex h-full flex-col p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <span
                    className="aq-icon aq-badge-bob h-9 w-9"
                    style={{ "--a": "var(--primary)" } as CSSProperties}
                  >
                    <TrendingUp className="h-4.5 w-4.5" aria-hidden="true" />
                  </span>
                  Activity
                </h2>
                <span className="aq-chip text-xs">Last 14 days</span>
              </div>
              <ActivityChart data={stats.daily} />
            </section>
          </Reveal>

          <Reveal delay={0.05} className="lg:col-span-2 h-full">
            <section className="aq-card aq-card-hover flex h-full flex-col p-5 sm:p-6">
              <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold">
                <span
                  className="aq-icon aq-badge-bob h-9 w-9"
                  style={{ "--a": "var(--accent)" } as CSSProperties}
                >
                  <TrendingUp className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                Top departments
              </h2>
              <div className="space-y-3.5">
                {stats.topDepartments.slice(0, 8).map((d, i) => {
                  const pct = Math.round(
                    ((d.completions ?? 0) / maxCompletions) * 100
                  );
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
                        <span className="tabular-nums text-xs font-semibold text-primary">
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
      </div>

      {/* ===================== ACQUISITION ===================== */}
      <Reveal className="mt-6">
        <section className="aq-card p-5 sm:p-6">
          <h2 className="mb-1.5 flex items-center gap-2 text-lg font-semibold">
            <span
              className="aq-icon aq-badge-bob h-9 w-9"
              style={{ "--a": "var(--accent)" } as CSSProperties}
            >
              <PieChart className="h-4.5 w-4.5" aria-hidden="true" />
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

      {/* ===================== RECENT SIGNUPS ===================== */}
      <Reveal className="mt-6">
        <section className="aq-card p-5 sm:p-6">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold">
            <span
              className="aq-icon aq-badge-bob h-9 w-9"
              style={{ "--a": "var(--primary)" } as CSSProperties}
            >
              <Users className="h-4.5 w-4.5" aria-hidden="true" />
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
                      className="border-b border-border/60 transition-colors last:border-0 hover:bg-primary/[0.05]"
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
