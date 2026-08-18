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
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { DepartmentCard } from "@/components/department-card";
import { InviteCard } from "@/components/leaderboard/invite-card";
import { FirstRunGuide } from "@/components/dashboard/first-run-guide";
import { FirstRunLaunch } from "@/components/onboarding/first-run-launch";
import { readStartGoalId } from "@/lib/recommend";
import { GuestMigration } from "@/components/guest-migration";
import { ProfileSetupForm } from "@/components/onboarding/profile-setup-form";
import {
  Reveal,
  RevealGroup,
  RevealItem,
  RiseGroup,
  RiseItem,
  Hover,
  Glow,
} from "@/components/motion/primitives";
import { AnimatedCounter } from "@/components/animated-counter";
import {
  AchievementBadge,
  type AchievementView,
} from "@/components/dashboard/achievement-badge";
import { getSession } from "@/lib/auth";
import { getDepartments, getDepartmentBySlug, getReferralCount } from "@/lib/queries";
import { suggestUsername } from "@/lib/onboarding";
import { getProfileSetupState, needsUsernameSetup } from "@/lib/onboarding-server";
import { createClient } from "@/lib/supabase/server";
import { deptMeta, inkFor } from "@/lib/departments";
import { clampPct, pluralize } from "@/lib/utils";
import type { Achievement } from "@/lib/types";
import { InstrumentPanel } from "./_instrument-panel";
import { WhatsNew } from "./_whats-new";

export const metadata: Metadata = {
  title: "Dashboard · LearnFRC",
  description: "Your progress, streak, and achievements across every FRC department.",
  robots: { index: false, follow: false },
};

const XP_PER_LEVEL = 100;

/** Consecutive local calendar days of activity, counted back from today. */
function streakFromDates(timestamps: string[]): number {
  const keyOf = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  const days = new Set<string>();
  for (const ts of timestamps) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) continue;
    days.add(keyOf(d));
  }
  if (days.size === 0) return 0;

  const dayMs = 86_400_000;
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

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

// shared blue→cyan progress fill
const XP_BAR_STYLE = {
  background: "linear-gradient(90deg,var(--primary),var(--accent))",
} as const;

export default async function DashboardPage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login?next=/dashboard");

  // Google sign-ins never see the signup form, so they arrive with no handle
  // and (70% of them) no team number. Ask once, here, where OAuth lands them.
  const setup = await getProfileSetupState(profile);

  // A handle is required, so this is a hard stop rather than a banner they can
  // scroll past. Email signup cannot mint an account without one; Google
  // sign-in skips that form, and letting the ask be dismissed left 26 accounts
  // with no handle, no profile URL, and a bare "Learner" on the leaderboard.
  // Returning before the dashboard's queries also means we do not spend them.
  if (needsUsernameSetup(profile)) {
    return (
      <div className="relative overflow-x-clip">
        <Glow
          blobs={[
            { size: "560px", pos: { left: "-160px", top: "-180px" }, color: "#8bbcff", opacity: 0.55 },
            { size: "520px", pos: { right: "-170px", top: "40px" }, color: "#6ff0ea", opacity: 0.4, delay: 2.5 },
          ]}
        />
        <div className="mx-auto max-w-xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
          <Reveal>
            <ProfileSetupForm
              mode="username"
              suggested={suggestUsername(user.email)}
              required
            />
          </Reveal>
        </div>
      </div>
    );
  }

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
  // Which starter goal this learner picked on /start, if any. Only read for a
  // zero-progress learner — it decides between showing their five-lesson plan
  // and offering the question that produces one.
  const startGoalId = completedCount === 0 ? await readStartGoalId() : null;
  const streak = streakFromDates(progressRows.map((r) => r.completed_at));
  // Lesson XP = 10 + 1 per streak-day, capped at 20 (max 2x). Show the multiplier.
  const xpMultiplier = (1 + Math.min(10, Math.max(0, streak - 1)) / 10).toFixed(1);

  // "Streak at risk": has an active streak but hasn't done a lesson today yet —
  // one lesson before midnight keeps it alive. Drives a return nudge.
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const todayKey = dayKey(new Date());
  const didToday = progressRows.some((r) => {
    const d = new Date(r.completed_at);
    return !Number.isNaN(d.getTime()) && dayKey(d) === todayKey;
  });
  const streakAtRisk = streak > 0 && !didToday;

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
  const nextLevel = level + 1;

  const displayName =
    profile?.full_name || profile?.username || user.email?.split("@")[0] || "there";
  const firstName = displayName.split(" ")[0];

  const referralCount = profile?.username ? await getReferralCount(user.id) : 0;

  // ── Invite: ask in proportion to what the learner has actually done ──
  // Referral converts far better than any other channel precisely because the
  // sender has context to lend — they can vouch for the thing. So the ask is
  // only worth making once there is something to vouch FOR.
  //
  // Threshold picked from production (Aug 2026, 186 learners with any
  // progress). There is a steep trial cliff in the first few lessons —
  // 34 learners stop at 1, 29 at 2, 14 at 3, 6 at 4 — and then a stable tail:
  // 103 learners have cleared 5 or more, and the median among learners with
  // any progress at all is 8. Five is the first point where someone has worked
  // through a real chunk of a module rather than sampled the site, so five is
  // where the ask is earned. Below it the card still exists, just far down the
  // page where only someone deliberately looking for it will meet it.
  const INVITE_EARNED_AT = 5;
  const inviteEarned = completedCount >= INVITE_EARNED_AT;

  // Framing reflects what they've done. No urgency, no guilt — for someone who
  // has already referred people, the honest encouragement is that it worked.
  // The card itself already prints the referral count twice (chip + body), so
  // the lead-in acknowledges it qualitatively instead of stating it a third
  // time, and spends its words on the only new thing: it worked, do it again.
  const inviteLead =
    referralCount > 0
      ? `${
          referralCount === 1 ? "A teammate is" : "Teammates are"
        } already learning here because you sent them the link. If there's someone else on your team who'd use it, it's the same link below.`
      : `You've cleared ${pluralize(completedCount, "lesson")}${
          streak > 1 ? `, ${streak} days running` : ""
        }${
          departmentsCompleted > 0
            ? ` and finished ${pluralize(departmentsCompleted, "department")}`
            : ""
        }. If someone on your team asks how you learned this, the link below is the short answer.`;

  // One card, one anchor (#invite-card is the target of the What's New CTA) —
  // only ever rendered in a single slot, chosen by engagement below.
  const inviteNode = profile?.username ? (
    <div id="invite-card" className="scroll-mt-28">
      {inviteEarned && (
        <p className="mb-3 max-w-2xl text-[15px] leading-relaxed text-foreground/70">
          {inviteLead}
        </p>
      )}
      <InviteCard
        username={profile.username}
        count={referralCount}
        via="dashboard"
      />
    </div>
  ) : null;

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
      const fresh = !inProgressSorted[0]?.dept;
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
    { icon: Zap, label: "Total XP", value: xp, accent: "#7c5cff" },
  ];

  const cm = continueLesson ? deptMeta(continueLesson.deptSlug) : null;

  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "560px", pos: { left: "-160px", top: "-180px" }, color: "#8bbcff", opacity: 0.55 },
          { size: "520px", pos: { right: "-170px", top: "40px" }, color: "#6ff0ea", opacity: 0.4, delay: 2.5 },
          { size: "480px", pos: { left: "38%", top: "620px" }, color: "#c8b6ff", opacity: 0.32, delay: 5 },
        ]}
      />

      <div className="mx-auto max-w-7xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
        {/* Migrate any guest (pre-signup) progress into this account, once. */}
        <GuestMigration />
        {/* Google sign-ins have no handle and usually no team — ask once here,
            skippable, top of the page. */}
        {setup.show && (
          <Reveal className="mb-8">
            <ProfileSetupForm
              mode={setup.mode}
              suggested={suggestUsername(user.email)}
              required={setup.required}
            />
          </Reveal>
        )}
        {/* FIRST RUN — the only surface a zero-progress learner sees here.
            45% of accounts never finish a single lesson, and the loss is
            entirely upstream of the content: they land on a dashboard built for
            someone with a history and are handed 394 lessons across 11
            departments with no default.

            FirstRunLaunch renders the goal-aware five-lesson plan when the
            learner has answered the one question on /start, so returning here
            shows their plan rather than resetting them. With no answer stored
            it falls back to the generic next-lesson card, and the banner below
            offers the question — the email confirmation link cannot reliably
            route people to /start (Supabase's template hardcodes its own
            destination), so the dashboard has to be a real entry point rather
            than a backstop. */}
        {completedCount === 0 && (
          <Reveal className="mb-8">
            <div className="space-y-4">
              {startGoalId ? (
                <FirstRunLaunch userId={user.id} />
              ) : (
                <>
                  {continueLesson && cm && (
                    <FirstRunGuide
                      href={`/guides/${continueLesson.deptSlug}/${continueLesson.moduleSlug}/${continueLesson.lessonSlug}`}
                      lessonTitle={continueLesson.lessonTitle}
                      deptName={continueLesson.deptName}
                    />
                  )}
                  <Link
                    href="/start"
                    className="ac-tile flex items-center justify-between gap-3 p-3.5 text-left transition-colors hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    style={{ "--a": "#2560e6" } as CSSProperties}
                  >
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold text-foreground">
                        Not sure where to start?
                      </span>
                      <span className="mt-0.5 block text-sm leading-snug text-foreground/70">
                        Answer one question and we&apos;ll lay out your first
                        five lessons.
                      </span>
                    </span>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-primary"
                      aria-hidden
                    />
                  </Link>
                </>
              )}
            </div>
          </Reveal>
        )}

        {/* ============================ HERO — SIGNATURE INSTRUMENT ============================ */}
        <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <RiseGroup>
            <RiseItem>
              <span className="ac-chip inline-flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
                <span className="ac-eyebrow">Your telemetry</span>
              </span>
            </RiseItem>

            <RiseItem>
              <div className="mt-5 flex items-center gap-4">
                <Avatar
                  name={displayName}
                  src={profile?.avatar_url}
                  seed={user.id}
                  className="h-16 w-16 shrink-0 shadow-[0_10px_26px_rgba(38,78,150,0.22),inset_0_1px_0_rgba(255,255,255,0.9)] ring-2 ring-white/80"
                />
                <div className="min-w-0">
                  <h1 className="truncate text-balance font-display text-4xl font-extrabold leading-tight sm:text-5xl">
                    Hey, <span style={BRAND_GRADIENT}>{firstName}</span>
                  </h1>
                  <p className="mt-1 text-[15px] leading-relaxed text-foreground/70">
                    {completedCount > 0
                      ? `${pluralize(completedCount, "lesson")} cleared${
                          streak > 1 ? ` · ${streak}-day streak (${xpMultiplier}× XP)` : ""
                        }`
                      : "Fresh start — pick a department and begin your build season."}
                  </p>
                </div>
              </div>
            </RiseItem>

            <RiseItem>
              <div className="mt-6 flex flex-wrap items-center gap-2.5 text-sm">
                <span className="ac-chip inline-flex items-center gap-1.5 font-semibold">
                  <Zap className="h-3.5 w-3.5 text-primary" aria-hidden />
                  Level {level}
                </span>
                <span className="ac-chip inline-flex items-center gap-1.5 font-semibold">
                  <AnimatedCounter value={xp} /> XP total
                </span>
                {streak > 0 && (
                  <span className="ac-chip inline-flex items-center gap-1.5 font-semibold">
                    <Flame className="h-3.5 w-3.5" style={{ color: "#c2410c" }} aria-hidden />
                    {streak}-day streak
                  </span>
                )}
              </div>
            </RiseItem>

            <RiseItem>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                {continueLesson && cm ? (
                  <Link
                    href={`/guides/${continueLesson.deptSlug}/${continueLesson.moduleSlug}/${continueLesson.lessonSlug}`}
                    className="ac-btn text-sm"
                  >
                    <Play className="h-4 w-4 fill-current" aria-hidden />
                    {continueLesson.fresh ? "Start learning" : "Continue learning"}
                  </Link>
                ) : (
                  <Link href="/guides" className="ac-btn text-sm">
                    <Play className="h-4 w-4 fill-current" aria-hidden />
                    Browse the guides
                  </Link>
                )}
                <Link href="/leaderboard" className="ac-btn-ghost text-sm">
                  <Trophy className="h-4 w-4" aria-hidden />
                  Leaderboard
                </Link>
              </div>
            </RiseItem>
          </RiseGroup>

          <InstrumentPanel
            level={level}
            levelPct={levelPct}
            xpToNext={xpToNext}
            xp={xp}
            xpIntoLevel={xpIntoLevel}
            streak={streak}
            xpMultiplier={xpMultiplier}
            nextLevel={nextLevel}
          />
        </section>

        {/* ============================ STREAK AT RISK ============================ */}
        {streakAtRisk && continueLesson && cm && (
          <Reveal className="mt-8">
            <Hover lift={-3} className="block">
              <Link
                href={`/guides/${continueLesson.deptSlug}/${continueLesson.moduleSlug}/${continueLesson.lessonSlug}`}
                className="ac-tile group flex items-center justify-between gap-4 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-5"
                style={{ "--a": "#ff8a3d" } as CSSProperties}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="ac-badge flex h-11 w-11 shrink-0 items-center justify-center"
                    style={{ "--a": "#ff8a3d" } as CSSProperties}
                  >
                    <Flame className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    {/* States the fact, not a countdown. "Keep your streak
                        alive… it resets at midnight" is a manufactured deadline
                        pointed at a teenager, and it makes a missed evening feel
                        like losing something. The streak is real and it does
                        lapse, so we say what it IS and what today's lesson adds
                        — and a lapsed streak just starts again, which is worth
                        knowing and is the opposite of a threat. */}
                    <p className="text-[15px] font-bold text-foreground">
                      {streak} days running 🔥
                    </p>
                    <p className="text-sm leading-snug text-foreground/70">
                      A lesson today makes it {streak + 1} — and back-to-back
                      days earn bonus XP. Next up:{" "}
                      <span className="font-semibold text-foreground">
                        {continueLesson.lessonTitle}
                      </span>
                      .
                    </p>
                  </div>
                </div>
                <span className="ac-btn inline-flex shrink-0 self-center text-sm">
                  <Play className="h-4 w-4 fill-current" aria-hidden />
                  <span className="hidden sm:inline">1 lesson</span>
                </span>
              </Link>
            </Hover>
          </Reveal>
        )}

        {/* ============================ WHAT'S NEW ============================ */}
        <WhatsNew
          inviteHref={profile?.username ? "#invite-card" : "/settings"}
          className="mt-8"
        />

        {/* ============================ PROFILE NUDGE ============================ */}
        {/* Fallback nudge for the team gap. Suppressed while the setup card is
            up top, which already asks for it inline — and kept for learners who
            skipped that card, so the ask survives without repeating itself. */}
        {!setup.show && profile?.username && !profile?.team_number && (
          <Reveal className="mt-8">
            <Hover lift={-3}>
              <Link
                href="/settings"
                className="ac-card group flex items-center justify-between gap-4 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="ac-badge flex h-11 w-11 shrink-0 items-center justify-center"
                    style={{ "--a": "#2560e6" } as CSSProperties}
                  >
                    <Sparkles className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-foreground">
                      Complete your profile
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Add your FRC team number to rep your team on the
                      leaderboard.
                    </p>
                  </div>
                </div>
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-1"
                  aria-hidden
                />
              </Link>
            </Hover>
          </Reveal>
        )}

        {/* ============================ CONTINUE LEARNING ============================ */}
        {/* Learning comes first: this used to sit below the stat grid and the
            invite ask. It is the reason the page exists, so it leads. */}
        {continueLesson && cm && (
          <Reveal className="mt-8">
            <Hover lift={-3} className="block">
              <Link
                href={`/guides/${continueLesson.deptSlug}/${continueLesson.moduleSlug}/${continueLesson.lessonSlug}`}
                className="ac-tile group block p-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-8"
                style={{ "--a": cm.color } as CSSProperties}
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground/75">
                      <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                      {continueLesson.fresh ? "Start learning" : "Continue learning"}
                    </span>
                    <h2 className="mt-2 text-balance font-display text-2xl font-bold leading-tight text-foreground sm:text-3xl">
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
                          barClassName="bg-[color-mix(in_srgb,var(--a)_78%,#141f2c)]"
                        />
                      </div>
                    )}
                  </div>
                  <span className="ac-btn inline-flex shrink-0 self-start text-sm sm:self-center">
                    {continueLesson.fresh ? "Begin" : "Resume"}
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                      aria-hidden
                    />
                  </span>
                </div>
              </Link>
            </Hover>
          </Reveal>
        )}

        {/* ============================ INVITE — EARNED SLOT ============================ */}
        {/* Directly after the lesson they're mid-way through: the one moment on
            this page where "you actually use this" is self-evident. */}
        {inviteNode && inviteEarned && (
          <Reveal className="mt-8">{inviteNode}</Reveal>
        )}

        {/* ============================ MISSION READOUT — STAT CARDS ============================ */}
        <Reveal className="mt-12" delay={0.04}>
          <p className="ac-eyebrow">Mission readout</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-foreground">
            Every gauge on the board
          </h2>
        </Reveal>
        <RevealGroup className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {stats.map((s) => (
            <RevealItem key={s.label}>
              <Hover lift={-4} className="h-full">
                <div className="ac-card group h-full p-4">
                  <span
                    className="ac-badge mb-3 flex h-10 w-10 items-center justify-center transition-transform duration-300 group-hover:scale-110"
                    style={{ "--a": s.accent } as CSSProperties}
                  >
                    <s.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div
                    className="font-display text-3xl font-bold tabular-nums"
                    style={{ color: inkFor(s.accent) }}
                  >
                    <AnimatedCounter value={s.value} />
                  </div>
                  <div className="mt-1 text-[13px] font-medium leading-snug text-muted-foreground">
                    {s.label}
                  </div>
                </div>
              </Hover>
            </RevealItem>
          ))}
        </RevealGroup>

        {/* ============================ YOUR DEPARTMENTS ============================ */}
        <section className="mt-14">
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="ac-eyebrow">{departments.length} departments</p>
                <h2 className="mt-2 font-display text-2xl font-bold text-foreground sm:text-3xl">
                  Your departments
                </h2>
                <p className="mt-1.5 text-[15px] text-muted-foreground">
                  Pick up where you left off across every track.
                </p>
              </div>
              <Link
                href="/guides"
                className="group inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-primary"
              >
                All guides
                <ArrowUpRight
                  className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </div>
          </Reveal>

          {deptProgress.length > 0 ? (
            <RevealGroup className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {deptProgress.map(({ dept, pct }, i) => (
                <RevealItem key={dept.slug}>
                  <DepartmentCard
                    slug={dept.slug}
                    name={dept.name}
                    tagline={dept.tagline}
                    moduleCount={dept.moduleCount}
                    lessonCount={dept.lessonCount}
                    progressPct={pct}
                    index={i + 1}
                  />
                </RevealItem>
              ))}
            </RevealGroup>
          ) : (
            <Reveal className="mt-6">
              <div className="ac-card p-10 text-center text-[15px] text-muted-foreground">
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

        {/* ============================ INVITE — QUIET SLOT ============================ */}
        {/* 1–4 lessons in: still deciding whether they like this. The card stays
            reachable (and keeps #invite-card anchored for the What's New CTA)
            but carries no personalised prompt and sits below the learning. */}
        {inviteNode && !inviteEarned && completedCount > 0 && (
          <Reveal className="mt-14">{inviteNode}</Reveal>
        )}

        {/* ============================ ACHIEVEMENTS ============================ */}
        {achievements.length > 0 && (
          <section className="mt-14">
            <Reveal>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="ac-eyebrow">Unlocks</p>
                  <h2 className="mt-2 font-display text-2xl font-bold text-foreground sm:text-3xl">
                    Achievements
                  </h2>
                  <p className="mt-1.5 text-[15px] text-muted-foreground">
                    {achievementsEarned > 0
                      ? `${achievementsEarned} of ${achievements.length} unlocked — keep going.`
                      : `Complete lessons to unlock all ${achievements.length} badges.`}
                  </p>
                </div>
                <span className="ac-chip shrink-0 text-xs font-semibold">
                  {achievementsEarned}/{achievements.length} unlocked
                </span>
              </div>
            </Reveal>

            <Reveal delay={0.05} className="mt-4">
              <Progress
                value={clampPct((achievementsEarned / achievements.length) * 100)}
                className="h-2.5 bg-white/55"
                barClassName="bg-[linear-gradient(90deg,var(--primary),var(--accent))]"
                style={XP_BAR_STYLE}
              />
            </Reveal>

            <RevealGroup className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {achievements.map((a) => (
                <RevealItem key={a.slug}>
                  <AchievementBadge achievement={a} />
                </RevealItem>
              ))}
            </RevealGroup>
          </section>
        )}

        {/* ============================ ZERO STATE ENCOURAGEMENT ============================ */}
        {completedCount === 0 && (
          <Reveal className="mt-14">
            <div className="ac-glass relative overflow-hidden p-8 text-center sm:p-10">
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[-30%] h-56 w-72 -translate-x-1/2 rounded-full opacity-40 blur-3xl"
                style={{ background: "radial-gradient(circle,rgba(37,96,230,0.3),transparent 70%)" }}
              />
              <span
                className="ac-badge relative mx-auto flex h-16 w-16 items-center justify-center"
                style={{ "--a": "#2560e6" } as CSSProperties}
              >
                <CheckCircle2 className="h-8 w-8" aria-hidden />
              </span>
              <h2 className="mt-5 font-display text-2xl font-bold text-foreground">
                Complete your first lesson
              </h2>
              <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-foreground/70">
                Mark a lesson complete to earn XP, start your streak, and unlock your
                first achievement. Gracious professionalism starts with rep one.
              </p>
              <div className="mt-6 flex justify-center">
                <Link href="/guides/getting-started" className="ac-btn text-sm">
                  Start with the basics <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </Reveal>
        )}

        {/* ============================ INVITE — DORMANT SLOT ============================ */}
        {/* Zero lessons: nothing to vouch for yet, so nobody is asked to
            recommend anything. The card renders last, purely so the What's New
            "Invite teammates" link still has somewhere to land for a learner
            who deliberately goes looking for it. */}
        {inviteNode && completedCount === 0 && (
          <Reveal className="mt-14">{inviteNode}</Reveal>
        )}
      </div>
    </div>
  );
}
