import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getAdminStats } from "@/lib/admin";
import { getFeedback } from "@/lib/feedback";
import { KpiStrip } from "@/components/admin/kpi-strip";
import { GrowthChart } from "@/components/admin/growth-chart";
import { TrafficPanel } from "@/components/admin/traffic-panel";
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

  const [stats, feedback] = await Promise.all([getAdminStats(), getFeedback()]);

  const kpi = {
    pageViewsTotal: stats.pageViewsTotal,
    pageViews7d: stats.pageViews7d,
    uniqueVisitors: stats.uniqueVisitors,
    users: stats.totals.users,
    verifiedUsers: stats.verifiedUsers,
    signups7d: stats.signups7d,
    // Total lessons completed includes no-account guest completions.
    completions: stats.totals.completions + stats.guestCompletions,
    guestCompletions: stats.guestCompletions,
    guideViewers: stats.guideViewersTotal,
    guideViews: stats.guideViewsTotal,
  };

  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "560px", pos: { left: "-160px", top: "-200px" }, color: "#8bbcff", opacity: 0.55 },
          { size: "520px", pos: { right: "-170px", top: "60px" }, color: "#6ff0ea", opacity: 0.45, delay: 2 },
        ]}
      />

      <div className="relative mx-auto max-w-6xl px-4 pt-20 pb-20 sm:px-6 lg:px-8 lg:pt-24">
        {/* ============ HEADER ============ */}
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
          </div>
        </Rise>

        {/* ============ THE SIX NUMBERS ============ */}
        <div className="mt-5">
          <KpiStrip s={kpi} />
        </div>

        {/* ============ GROWTH ============ */}
        <Reveal className="mt-5">
          {/* Chip totals are TRUE 30-day-window figures (visitors =
              count(distinct) over the window), not a sum of the per-day series. */}
          <GrowthChart
            daily={stats.daily}
            totals={{
              visitors: stats.uniqueVisitors30d,
              signups: stats.signups30d,
              completions: stats.completions30d,
            }}
          />
        </Reveal>

        {/* ============ SOURCES + TOP PAGES ============ */}
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Reveal>
            <section className="ac-card h-full p-5">
              <h2 className="mb-3 font-display text-base font-semibold">
                Where they come from
              </h2>
              <SourceBreakdown
                userWeek={stats.sources7d}
                userAllTime={stats.sources}
                visitorWeek={stats.visitorSources7d}
                visitorAllTime={stats.visitorSources}
              />
            </section>
          </Reveal>
          <Reveal delay={0.05}>
            <TrafficPanel s={{ topPages: stats.topPages }} />
          </Reveal>
        </div>

        {/* ============ FEEDBACK ============ */}
        <Reveal className="mt-5">
          <FeedbackInbox items={feedback} />
        </Reveal>
      </div>
    </div>
  );
}
