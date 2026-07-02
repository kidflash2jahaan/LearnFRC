import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  CheckCircle2,
  Flame,
  GraduationCap,
  Layers,
  Play,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { DepartmentCard } from "@/components/department-card";
import { InviteCard } from "@/components/leaderboard/invite-card";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { AnimatedCounter } from "@/components/animated-counter";
import {
  AchievementBadge,
  type AchievementView,
} from "@/components/dashboard/achievement-badge";
import { getSession } from "@/lib/auth";
import { getDepartments, getDepartmentBySlug, getReferralCount } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { deptMeta, inkFor } from "@/lib/departments";
import { clampPct, pluralize } from "@/lib/utils";
import type { Achievement } from "@/lib/types";
import { GaugeCluster } from "./_gauge-cluster";

export const metadata: Metadata = {
  title: "Dashboard · LearnFRC",
  description: "Your progress, streak, and achievements across every FRC department.",
};

const XP_PER_LEVEL = 100;

/** Distinct local calendar days, descending, from completion timestamps. */
function streakFromDates(timestamps: string[]): number {
  const days = new Set<string>();
  for (const ts of timestamps) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) continue;
    days.add(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`
    );
  }
  if (days.size === 0) return 0;

  const dayMs = 86_400_000;
  const keyOf = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  const today = new Date();
  const yesterday = new Date(today.getTime() - dayMs);
  // Streak only counts if the most recent activity was today or yesterday.
  if (!days.has(keyOf(today)) && !days.has(keyOf(yesterday))) return 0;

  let streak = 0;
  const cursor = new Date(today);
  if (!days.has(keyOf(today))) cursor.setTime(cursor.getTime() - dayMs);
  while (days.has(keyOf(cursor))) {
    streak++;
    cursor.setTime(cursor.getTime() - dayMs);
  }
  return streak;
}

export default async function DashboardPage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login?next=/dashboard");

  const supabase = await createClient();

  const [departments, progressRes, lessonMapRes, achievementsRes, earnedRes] =
    await Promise.all([
      getDepartments().catch(() => []),
      supabase
        .from("lesson_progress")
        .select("lesson_id, completed_at")
        .eq("user_id", user.id),
      // lesson -> department mapping in a single query
      supabase.from("lessons").select("id, modules(department_id)"),
      supabase
        .from("achievements")
        .select("id, slug, name, description, icon, criteria, sort_order")
        .order("sort_order"),
      supabase
        .from("user_achievements")
        .select("achievement_id, earned_at")
        .eq("user_id", user.id),
    ]);

  const progressRows = (progressRes.data ?? []) as {
    lesson_id: string;
    completed_at: string;
  }[];
  const completedIds = new Set(progressRows.map((r) => r.lesson_id));
  const completedCount = completedIds.size;
  const streak = streakFromDates(progressRows.map((r) => r.completed_at));
  // Lesson XP = 10 + 1 per streak-day, capped at 20 (max 2x). Show the multiplier.
  const xpMultiplier = (
    1 + Math.min(10, Math.max(0, streak - 1)) / 10
  ).toFixed(1);

  // lesson -> department id
  const lessonRows = (lessonMapRes.data ?? []) as {
    id: string;
    modules: { department_id?: string } | null;
  }[];
  const lessonToDept = new Map<string, string>();
  const deptTotals = new Map<string, number>();
  const deptDone = new Map<string, number>();
  for (const l of lessonRows) {
    const depId = l.modules?.department_id;
    if (!depId) continue;
    lessonToDept.set(l.id, depId);
    deptTotals.set(depId, (deptTotals.get(depId) ?? 0) + 1);
    if (completedIds.has(l.id)) deptDone.set(depId, (deptDone.get(depId) ?? 0) + 1);
  }

  // Per-department progress
  const deptProgress = departments.map((d) => {
    const total = deptTotals.get(d.id) ?? d.lessonCount ?? 0;
    const done = deptDone.get(d.id) ?? 0;
    const pct = total > 0 ? clampPct((done / total) * 100) : 0;
    return { dept: d, total, done, pct };
  });

  const departmentsInProgress = deptProgress.filter(
    (p) => p.done > 0 && p.pct < 100
  ).length;
  const departmentsCompleted = deptProgress.filter(
    (p) => p.total > 0 && p.pct >= 100
  ).length;

  // ── Achievements ──────────────────────────────────────────────
  const allAchievements = (achievementsRes.data ?? []) as Achievement[];
  const earnedRows = (earnedRes.data ?? []) as {
    achievement_id: string;
    earned_at: string;
  }[];
  const earnedMap = new Map(earnedRows.map((r) => [r.achievement_id, r.earned_at]));
  const achievements: AchievementView[] = allAchievements.map((a) => ({
    slug: a.slug,
    name: a.name,
    description: a.description,
    icon: a.icon,
    earned: earnedMap.has(a.id),
    earnedAt: earnedMap.get(a.id) ?? null,
  }));
  const achievementsEarned = achievements.filter((a) => a.earned).length;

  // ── Level / XP ────────────────────────────────────────────────
  const xp = profile?.xp ?? 0;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = xp % XP_PER_LEVEL;
  const levelPct = clampPct((xpIntoLevel / XP_PER_LEVEL) * 100);
  const xpToNext = XP_PER_LEVEL - xpIntoLevel;

  const displayName =
    profile?.full_name || profile?.username || user.email?.split("@")[0] || "there";
  const firstName = displayName.split(" ")[0];

  const referralCount = profile?.username ? await getReferralCount(user.id) : 0;

  // ── Continue learning target ──────────────────────────────────
  // Pick the started-but-not-finished department with the most progress;
  // otherwise the user hasn't started anything → suggest getting-started.
  const inProgressSorted = deptProgress
    .filter((p) => p.done > 0 && p.pct < 100)
    .sort((a, b) => b.pct - a.pct || b.done - a.done);

  let continueLesson: {
    deptSlug: string;
    deptName: string;
    moduleSlug: string;
    lessonSlug: string;
    lessonTitle: string;
    moduleTitle: string;
    pct: number;
    fresh: boolean;
  } | null = null;

  const target =
    inProgressSorted[0]?.dept ??
    departments.find((d) => d.slug === "getting-started") ??
    departments[0];

  if (target) {
    const full = await getDepartmentBySlug(target.slug).catch(() => null);
    if (full) {
      const fresh = !(inProgressSorted[0]?.dept);
      // first lesson (in order) that isn't completed
      let pick:
        | { moduleSlug: string; moduleTitle: string; lessonSlug: string; lessonTitle: string }
        | null = null;
      outer: for (const m of full.modules) {
        for (const l of m.lessons) {
          if (!completedIds.has(l.id)) {
            pick = {
              moduleSlug: m.slug,
              moduleTitle: m.title,
              lessonSlug: l.slug,
              lessonTitle: l.title,
            };
            break outer;
          }
        }
      }
      // if everything in target is done (edge case), fall back to its first lesson
      if (!pick && full.modules[0]?.lessons[0]) {
        const m = full.modules[0];
        const l = m.lessons[0];
        pick = {
          moduleSlug: m.slug,
          moduleTitle: m.title,
          lessonSlug: l.slug,
          lessonTitle: l.title,
        };
      }
      if (pick) {
        const tp = deptProgress.find((p) => p.dept.id === target.id);
        continueLesson = {
          deptSlug: target.slug,
          deptName: target.name,
          pct: tp?.pct ?? 0,
          fresh,
          ...pick,
        };
      }
    }
  }

  const stats = [
    { icon: BookOpenCheck, label: "Lessons completed", value: completedCount, accent: "#2560e6" },
    { icon: Layers, label: "Departments in progress", value: departmentsInProgress, accent: "#1aa9d6" },
    { icon: GraduationCap, label: "Departments completed", value: departmentsCompleted, accent: "#12b565" },
    { icon: Trophy, label: "Achievements earned", value: achievementsEarned, accent: "#f5a623" },
    { icon: Flame, label: "Day streak", value: streak, accent: "#ff8a3d" },
    { icon: Zap, label: "Total XP", value: xp, accent: "#8b7fff" },
  ];

  const cm = continueLesson ? deptMeta(continueLesson.deptSlug) : null;

  const blueGradient = {
    background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  } as CSSProperties;
  // shared blue→cyan progress fill
  const xpBar = {
    background: "linear-gradient(90deg,var(--primary),var(--accent))",
  } as const;

  const nextLevel = level + 1;

  return (
    <div className="relative mx-auto max-w-7xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
      {/* ambient glows */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute left-[-10%] top-[-6%] h-[440px] w-[560px] rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle,rgba(37,96,230,0.18),transparent 68%)" }}
        />
        <div
          className="absolute right-[-8%] top-[8%] h-[400px] w-[520px] rounded-full opacity-55 blur-3xl"
          style={{ background: "radial-gradient(circle,rgba(26,169,214,0.16),transparent 68%)" }}
        />
        <div
          className="absolute left-1/2 top-[36%] h-[420px] w-[620px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle,rgba(139,127,255,0.14),transparent 70%)" }}
        />
      </div>

      {/* ============================ HERO — THE INSTRUMENT CLUSTER ============================ */}
      {/* Signature: a telemetry gauge cluster reads out the learner's progress
          like a robot's dashboard — streak, level, and XP-to-next as spring-fill dials. */}
      <section className="aq-glass aq-sheen aq-rise aq-rise-1 overflow-hidden rounded-[30px] p-6 sm:p-9">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle,rgba(37,96,230,0.35),transparent 70%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-72 rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle,rgba(139,127,255,0.32),transparent 70%)" }}
        />
        <div className="relative grid gap-8 lg:grid-cols-[1.05fr_1.2fr] lg:items-center">
          {/* Greeting + actions */}
          <div className="min-w-0">
            <span className="aq-eyebrow aq-rise aq-rise-2">
              <Sparkles aria-hidden className="h-3.5 w-3.5 aq-badge-bob" /> Your telemetry
            </span>
            <div className="aq-rise aq-rise-3 mt-4 flex items-center gap-4">
              <Avatar
                name={displayName}
                src={profile?.avatar_url}
                seed={user.id}
                className="h-16 w-16 shrink-0 shadow-[0_10px_26px_rgba(38,78,150,0.22),inset_0_1px_0_rgba(255,255,255,0.9)] ring-2 ring-white/80"
              />
              <div className="min-w-0">
                <h1 className="aq-display truncate text-3xl font-bold leading-tight sm:text-4xl">
                  Hey, <span className="aq-grad-anim" style={blueGradient}>{firstName}</span>
                </h1>
                <p className="mt-1 text-[15px] text-foreground/70">
                  {completedCount > 0
                    ? `${pluralize(completedCount, "lesson")} cleared${
                        streak > 1 ? ` · ${streak}-day streak (${xpMultiplier}× XP)` : ""
                      }`
                    : "Fresh start — pick a department and begin your build season."}
                </p>
              </div>
            </div>

            {/* Level chip + XP-to-next line */}
            <div className="aq-rise aq-rise-4 mt-6 flex flex-wrap items-center gap-2.5 text-sm">
              <span className="aq-chip font-semibold">
                <Zap aria-hidden className="h-3.5 w-3.5 text-primary" />
                Level {level}
              </span>
              <span className="aq-chip font-semibold">
                <AnimatedCounter value={xp} /> XP total
              </span>
              {streak > 0 && (
                <span className="aq-chip font-semibold">
                  <Flame aria-hidden className="h-3.5 w-3.5" style={{ color: "#e0721f" }} />
                  {streak}-day streak
                </span>
              )}
            </div>

            <div className="aq-rise aq-rise-4 mt-6 flex flex-wrap items-center gap-3">
              {continueLesson && cm ? (
                <Link
                  href={`/guides/${continueLesson.deptSlug}/${continueLesson.moduleSlug}/${continueLesson.lessonSlug}`}
                  className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Play aria-hidden className="h-4 w-4 fill-current" />
                  {continueLesson.fresh ? "Start learning" : "Continue learning"}
                </Link>
              ) : (
                <Link
                  href="/guides"
                  className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Play aria-hidden className="h-4 w-4 fill-current" />
                  Browse the guides
                </Link>
              )}
              <Link
                href="/leaderboard"
                className="aq-ghost inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Trophy aria-hidden className="h-4 w-4" />
                Leaderboard
              </Link>
            </div>
          </div>

          {/* Instrument cluster — three spring-fill gauges */}
          <div className="aq-rise aq-rise-5 aq-float aq-card rounded-[24px] p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="aq-display text-[15px] font-bold text-foreground">
                Progress at a glance
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0a7a43]">
                <span className="aq-pulse h-2 w-2 rounded-full bg-[#12b565]" />
                Live
              </span>
            </div>
            <GaugeCluster
              level={level}
              levelPct={levelPct}
              xpToNext={xpToNext}
              xp={xp}
              xpIntoLevel={xpIntoLevel}
              streak={streak}
              xpMultiplier={xpMultiplier}
              nextLevel={nextLevel}
            />
            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-foreground/70">
                <span>Level {level} → {nextLevel}</span>
                <span className="font-semibold text-foreground">
                  {xpToNext} XP to go
                </span>
              </div>
              <Progress value={levelPct} className="h-2.5 bg-white/55" barClassName="aq-bar-anim" style={xpBar} />
            </div>
          </div>
        </div>
      </section>

      {/* ============================ PROFILE NUDGE ============================ */}
      {(!profile?.username || !profile?.team_number) && (
        <Reveal className="mt-6">
          <Link
            href="/settings"
            className="aq-card aq-card-hover group flex items-center justify-between gap-4 rounded-[20px] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="flex items-center gap-3">
              <span className="aq-icon aq-badge-bob flex h-11 w-11 shrink-0 rounded-2xl">
                <Sparkles aria-hidden className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[15px] font-semibold text-foreground">
                  Complete your profile
                </p>
                <p className="text-sm text-muted-foreground">
                  Add a username
                  {!profile?.team_number ? " and your FRC team number" : ""} to show up
                  on the leaderboard.
                </p>
              </div>
            </div>
            <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>
      )}

      {/* ============================ INVITE / REFERRALS ============================ */}
      {profile?.username && (
        <Reveal>
          <InviteCard username={profile.username} count={referralCount} />
        </Reveal>
      )}

      {/* ============================ MISSION READOUT — STAT CARDS ============================ */}
      <Reveal className="mt-10" delay={0.04}>
        <span className="aq-eyebrow">Mission readout</span>
        <h2 className="aq-display mt-2 text-2xl font-bold text-foreground">
          Every gauge on the board
        </h2>
      </Reveal>
      <Stagger className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <StaggerItem key={s.label}>
            <div className="aq-card aq-card-hover group h-full rounded-[20px] p-4">
              <span
                className="aq-badge aq-badge-bob mb-3 flex h-10 w-10 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110"
                style={{ "--a": s.accent } as CSSProperties}
              >
                <s.icon aria-hidden className="h-5 w-5" />
              </span>
              <div
                className="aq-display text-3xl font-bold tabular-nums"
                style={{ color: inkFor(s.accent) }}
              >
                <AnimatedCounter value={s.value} />
              </div>
              <div className="mt-1 text-[13px] font-medium leading-snug text-muted-foreground">
                {s.label}
              </div>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      {/* ============================ CONTINUE LEARNING ============================ */}
      {continueLesson && cm && (
        <Reveal className="mt-10">
          <Link
            href={`/guides/${continueLesson.deptSlug}/${continueLesson.moduleSlug}/${continueLesson.lessonSlug}`}
            className="aq-tile group block rounded-[24px] p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-8"
            style={{ "--a": cm.color } as CSSProperties}
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/75">
                  <Play aria-hidden className="h-3.5 w-3.5 fill-current aq-badge-bob" />
                  {continueLesson.fresh ? "Start learning" : "Continue learning"}
                </span>
                <h2 className="aq-display mt-2 text-balance text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                  {continueLesson.lessonTitle}
                </h2>
                <p className="mt-1.5 text-[15px] font-medium text-foreground/75">
                  {continueLesson.deptName} · {continueLesson.moduleTitle}
                </p>
                {!continueLesson.fresh && (
                  <div className="mt-4 max-w-sm">
                    <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-foreground/75">
                      <span>{continueLesson.deptName} progress</span>
                      <span className="text-foreground">{continueLesson.pct}%</span>
                    </div>
                    <Progress
                      value={continueLesson.pct}
                      className="h-2 bg-white/45"
                      barClassName="aq-bar-anim bg-[color-mix(in_srgb,var(--a)_78%,#141f2c)]"
                    />
                  </div>
                )}
              </div>
              <span className="aq-cta inline-flex shrink-0 items-center gap-2 self-start rounded-2xl px-5 py-3 text-sm font-semibold sm:self-center">
                {continueLesson.fresh ? "Begin" : "Resume"}
                <ArrowRight aria-hidden className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        </Reveal>
      )}

      {/* ============================ YOUR DEPARTMENTS ============================ */}
      <section className="mt-12">
        <Reveal>
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="aq-eyebrow">
                {departments.length} departments
              </span>
              <h2 className="aq-display mt-2 text-2xl font-bold text-foreground sm:text-3xl">
                Your departments
              </h2>
              <p className="mt-1.5 text-[15px] text-muted-foreground">
                Pick up where you left off across every track.
              </p>
            </div>
            <Button asChild variant="secondary" size="sm" className="min-h-11 shrink-0">
              <Link href="/guides">
                All guides <ArrowUpRight aria-hidden className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Reveal>

        {deptProgress.length > 0 ? (
          <Stagger className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {deptProgress.map(({ dept, pct }) => (
              <StaggerItem key={dept.slug}>
                <DepartmentCard
                  slug={dept.slug}
                  name={dept.name}
                  tagline={dept.tagline}
                  moduleCount={dept.moduleCount}
                  lessonCount={dept.lessonCount}
                  progressPct={pct}
                />
              </StaggerItem>
            ))}
          </Stagger>
        ) : (
          <Reveal className="mt-6">
            <div className="aq-card rounded-[20px] p-10 text-center text-[15px] text-muted-foreground">
              Departments are loading — check back in a moment, or{" "}
              <Link
                href="/guides"
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                browse the guides
              </Link>
              .
            </div>
          </Reveal>
        )}
      </section>

      {/* ============================ ACHIEVEMENTS ============================ */}
      {achievements.length > 0 && (
        <section className="mt-14">
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <div>
                <span className="aq-eyebrow">Unlocks</span>
                <h2 className="aq-display mt-2 text-2xl font-bold text-foreground sm:text-3xl">
                  Achievements
                </h2>
                <p className="mt-1.5 text-[15px] text-muted-foreground">
                  {achievementsEarned > 0
                    ? `${achievementsEarned} of ${achievements.length} unlocked — keep going.`
                    : `Complete lessons to unlock all ${achievements.length} badges.`}
                </p>
              </div>
              <span className="aq-chip shrink-0 text-xs font-semibold">
                {achievementsEarned}/{achievements.length} unlocked
              </span>
            </div>
          </Reveal>

          <Reveal delay={0.05} className="mt-4">
            <Progress
              value={clampPct((achievementsEarned / achievements.length) * 100)}
              className="h-2.5 bg-white/55"
              barClassName="aq-bar-anim"
              style={xpBar}
            />
          </Reveal>

          <Stagger className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {achievements.map((a) => (
              <StaggerItem key={a.slug}>
                <AchievementBadge achievement={a} />
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}

      {/* ============================ ZERO STATE ENCOURAGEMENT ============================ */}
      {completedCount === 0 && (
        <Reveal className="mt-14">
          <div className="aq-glass aq-sheen relative overflow-hidden rounded-[28px] p-8 text-center sm:p-10">
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[-30%] h-56 w-72 -translate-x-1/2 rounded-full opacity-40 blur-3xl"
              style={{ background: "radial-gradient(circle,rgba(37,96,230,0.3),transparent 70%)" }}
            />
            <span
              className="aq-badge aq-badge-bob relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ "--a": "#2560e6" } as CSSProperties}
            >
              <CheckCircle2 aria-hidden className="h-8 w-8" />
            </span>
            <h2 className="aq-display mt-5 text-2xl font-bold text-foreground">
              Complete your first lesson
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] text-foreground/70">
              Mark a lesson complete to earn XP, start your streak, and unlock your first
              achievement. Gracious professionalism starts with rep one.
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                href="/guides/getting-started"
                className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Start with the basics <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Reveal>
      )}
    </div>
  );
}
