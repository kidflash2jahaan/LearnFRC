import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
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
import {
  TerminalFrame,
  StatusPill,
  NeonCounter,
} from "@/components/motion/terminal";
import { LevelRing } from "@/components/dashboard/level-ring";
import {
  AchievementBadge,
  type AchievementView,
} from "@/components/dashboard/achievement-badge";
import { getSession } from "@/lib/auth";
import { getDepartments, getDepartmentBySlug, getReferralCount } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { deptMeta } from "@/lib/departments";
import { clampPct, pluralize } from "@/lib/utils";
import type { Achievement } from "@/lib/types";

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
    { icon: BookOpenCheck, label: "Lessons completed", value: completedCount, accent: "var(--color-primary)" },
    { icon: Layers, label: "Departments in progress", value: departmentsInProgress, accent: "var(--color-accent)" },
    { icon: GraduationCap, label: "Departments completed", value: departmentsCompleted, accent: "var(--color-success)" },
    { icon: Trophy, label: "Achievements earned", value: achievementsEarned, accent: "var(--color-gold)" },
    { icon: Flame, label: "Day streak", value: streak, accent: "var(--color-gold)" },
    { icon: Zap, label: "Total XP", value: xp, accent: "var(--color-magenta)" },
  ];

  const cm = continueLesson ? deptMeta(continueLesson.deptSlug) : null;
  const teamLabel = profile?.team_number
    ? `team${profile.team_number}`
    : profile?.username || "learnfrc";
  // cyan → lime fill for HUD progress bars
  const xpBar = {
    background: "linear-gradient(90deg, var(--color-accent), var(--color-primary))",
  } as const;

  return (
    <div className="relative mx-auto max-w-7xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
      {/* ambient background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[460px] hud-grid opacity-50 mask-b-faded" />
        <div className="absolute left-1/2 top-[-8%] h-[420px] w-[760px] -translate-x-1/2 rounded-full opacity-25 blur-3xl aurora-bg" />
      </div>

      {/* ============================ MISSION CONTROL ============================ */}
      <Reveal>
        <TerminalFrame
          glow
          title={`build_status.log — ~/${teamLabel}`}
          right={<StatusPill tone="primary">● ONLINE</StatusPill>}
          bodyClassName="p-6 sm:p-8"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar
                name={displayName}
                src={profile?.avatar_url}
                seed={user.id}
                className="h-16 w-16 ring-2 ring-primary/40"
              />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.18em] text-accent">
                  <Sparkles className="h-3 w-3" /> welcome back
                </p>
                <h1 className="mt-1 truncate text-2xl font-bold tracking-tight sm:text-3xl">
                  Hey, <span className="text-gradient">{firstName}</span>
                </h1>
                <p className="mt-1 font-mono text-sm text-muted-foreground">
                  {completedCount > 0
                    ? `${pluralize(completedCount, "lesson")} cleared${streak > 1 ? ` · ${streak}-day streak (${xpMultiplier}× XP)` : ""}`
                    : "// boot sequence ready — start your FRC journey"}
                  <span className="caret" aria-hidden />
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:gap-5">
              <LevelRing level={level} progressPct={levelPct} />
              <div className="text-sm">
                <div className="font-display text-xl font-bold">
                  <NeonCounter to={xp} />{" "}
                  <span className="font-mono text-base font-medium text-muted-foreground">
                    XP
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {xpToNext} XP → lvl {level + 1}
                </p>
                <div className="mt-2 w-32">
                  <Progress value={levelPct} style={xpBar} />
                </div>
              </div>
            </div>
          </div>
        </TerminalFrame>
      </Reveal>

      {/* ============================ PROFILE NUDGE ============================ */}
      {(!profile?.username || !profile?.team_number) && (
        <Reveal className="mt-4">
          <Link
            href="/settings"
            className="group flex items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-primary/[0.06] p-4 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[var(--glow-primary)]"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Complete your profile</p>
                <p className="font-mono text-xs text-muted-foreground">
                  Add a username{!profile?.team_number ? " and your FRC team number" : ""} to
                  show up on the leaderboard.
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>
      )}

      {/* ============================ INVITE / REFERRALS ============================ */}
      {profile?.username && (
        <Reveal>
          <InviteCard username={profile.username} count={referralCount} />
        </Reveal>
      )}

      {/* ============================ STAT CARDS ============================ */}
      <Reveal className="mt-8" delay={0.04}>
        <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-accent">
          <span aria-hidden className="h-px w-6 bg-gradient-to-r from-accent to-transparent" />
          system metrics
        </span>
      </Reveal>
      <Stagger className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <StaggerItem key={s.label}>
            <div className="group relative h-full overflow-hidden rounded-xl border border-border bg-card/60 p-4 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--glow-primary)]">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-[0.14] blur-2xl transition-opacity duration-300 group-hover:opacity-30"
                style={{ background: s.accent }}
              />
              <div
                className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border"
                style={{
                  borderColor: `color-mix(in srgb, ${s.accent} 38%, var(--border))`,
                  background: `color-mix(in srgb, ${s.accent} 12%, transparent)`,
                  color: s.accent,
                }}
              >
                <s.icon className="h-4.5 w-4.5" />
              </div>
              <div className="font-display text-2xl font-bold tracking-tight tabular-nums">
                <NeonCounter to={s.value} />
              </div>
              <div className="mt-0.5 font-mono text-[11px] uppercase leading-tight tracking-wider text-muted-foreground">
                {s.label}
              </div>
              <span
                aria-hidden
                className="mt-2.5 block h-0.5 w-6 rounded-full"
                style={{ background: s.accent, boxShadow: `0 0 10px ${s.accent}` }}
              />
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      {/* ============================ CONTINUE LEARNING ============================ */}
      {continueLesson && cm && (
        <Reveal className="mt-8">
          <Link
            href={`/guides/${continueLesson.deptSlug}/${continueLesson.moduleSlug}/${continueLesson.lessonSlug}`}
            className="group relative block overflow-hidden rounded-3xl border border-border p-px shadow-[var(--shadow-md)] transition-transform duration-300 hover:-translate-y-1"
          >
            {/* gradient frame */}
            <div
              aria-hidden
              className="absolute inset-0 -z-10 opacity-90"
              style={{ backgroundImage: `linear-gradient(120deg, ${cm.color}, ${cm.to})` }}
            />
            <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-card p-6 sm:p-8">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-35"
                style={{ background: cm.color }}
              />
              <p className="font-mono text-xs text-muted-foreground">
                ~/learnfrc ${" "}
                <span style={{ color: cm.color }}>
                  {continueLesson.fresh ? "begin" : "resume"} --dept {continueLesson.deptSlug}
                </span>
              </p>
              <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <span
                    className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider"
                    style={{ color: cm.color }}
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    {continueLesson.fresh ? "Start learning" : "Continue learning"}
                  </span>
                  <h2 className="mt-2 text-balance text-xl font-bold tracking-tight sm:text-2xl">
                    {continueLesson.lessonTitle}
                  </h2>
                  <p className="mt-1 font-mono text-sm text-muted-foreground">
                    {continueLesson.deptName} · {continueLesson.moduleTitle}
                  </p>
                  {!continueLesson.fresh && (
                    <div className="mt-4 max-w-sm">
                      <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
                        <span>{continueLesson.deptName} progress</span>
                        <span className="font-medium text-foreground">
                          {continueLesson.pct}%
                        </span>
                      </div>
                      <Progress
                        value={continueLesson.pct}
                        style={{ background: `linear-gradient(90deg, ${cm.color}, ${cm.to})` }}
                      />
                    </div>
                  )}
                </div>
                <Button
                  size="lg"
                  className="shrink-0 self-start border-0 text-primary-foreground shadow-[var(--shadow-md)] sm:self-center"
                  style={{ backgroundImage: `linear-gradient(135deg, ${cm.color}, ${cm.to})` }}
                  asChild
                >
                  <span>
                    {continueLesson.fresh ? "Begin" : "Resume"}
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </Button>
              </div>
            </div>
          </Link>
        </Reveal>
      )}

      {/* ============================ YOUR DEPARTMENTS ============================ */}
      <section className="mt-12">
        <Reveal>
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-accent">
                <span aria-hidden className="h-px w-6 bg-gradient-to-r from-accent to-transparent" />
                system map · {departments.length} tracks
              </span>
              <h2 className="mt-2 text-2xl font-bold tracking-tight">Your departments</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick up where you left off across every track.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href="/guides">
                All guides <ArrowRight className="h-4 w-4" />
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
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center font-mono text-sm text-muted-foreground">
              // departments loading — check back in a moment, or{" "}
              <Link href="/guides" className="text-primary underline-offset-4 hover:underline">
                browse the guides
              </Link>
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
                <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-accent">
                  <span aria-hidden className="h-px w-6 bg-gradient-to-r from-accent to-transparent" />
                  unlocks
                </span>
                <h2 className="mt-2 text-2xl font-bold tracking-tight">Achievements</h2>
                <p className="mt-1 font-mono text-sm text-muted-foreground">
                  {achievementsEarned > 0
                    ? `${achievementsEarned} of ${achievements.length} unlocked — keep going`
                    : `// complete lessons to unlock all ${achievements.length} badges`}
                </p>
              </div>
              <StatusPill tone="primary" pulse={achievementsEarned > 0} className="shrink-0">
                {achievementsEarned}/{achievements.length} unlocked
              </StatusPill>
            </div>
          </Reveal>

          <Reveal delay={0.05} className="mt-4">
            <Progress
              value={clampPct((achievementsEarned / achievements.length) * 100)}
              className="h-2.5"
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
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card/60 p-8 text-center backdrop-blur">
            <div aria-hidden className="absolute inset-0 -z-10 bg-dots opacity-40" />
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-[var(--glow-primary)]">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Complete your first lesson</h3>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
              Mark a lesson complete to earn XP, start your streak, and unlock your
              first achievement.
            </p>
            <Button asChild variant="brand" size="lg" className="mt-6">
              <Link href="/guides/getting-started">
                Start with the basics <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Reveal>
      )}
    </div>
  );
}
