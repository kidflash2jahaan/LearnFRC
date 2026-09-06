import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { DepartmentCard } from "@/components/department-card";
import { TeamInvite } from "@/components/team/team-invite";
import { FirstRunGuide } from "@/components/dashboard/first-run-guide";
import { FirstRunLaunch } from "@/components/onboarding/first-run-launch";
import { ResumeCard } from "@/components/progress/resume-card";
import { readStartGoalId } from "@/lib/recommend";
import { GuestMigration } from "@/components/guest-migration";
import { ProfileSetupForm } from "@/components/onboarding/profile-setup-form";
import {
  AchievementBadge,
  type AchievementView,
} from "@/components/dashboard/achievement-badge";
import { getSession } from "@/lib/auth";
import {
  getDepartments,
  getDepartmentBySlug,
  getReferralCount,
  getTeamMemberCount,
} from "@/lib/queries";
import { suggestUsername } from "@/lib/onboarding";
import { getProfileSetupState, needsUsernameSetup } from "@/lib/onboarding-server";
import { createClient } from "@/lib/supabase/server";
import { clampPct, pluralize } from "@/lib/utils";
import type { Achievement } from "@/lib/types";
import { ProgressLedger } from "./_instrument-panel";
import { WhatsNew } from "./_whats-new";

/**
 * The dashboard, rebuilt as the working page of the binder.
 *
 * The page answers two questions in the order a learner actually asks them:
 * "what do I open next" and "how far along am I". So it runs top to bottom as
 * one sheet: a ruled masthead with the name, the tally block, the one lesson to
 * open, the departments wall, the badge drawer. Nothing is a floating panel and
 * nothing animates in as you scroll past it.
 *
 * WHAT WAS DELETED, on purpose:
 *  - Six identical stat cards. They are one ruled tally now, in `ProgressLedger`
 *    (see that file for the reasoning). Six boxes reading 0 is the shape a new
 *    account used to meet first.
 *  - The duplicate calls to action. A zero-progress learner used to be pointed
 *    at the same lesson three times: the first-run card, the "continue
 *    learning" card, and a "complete your first lesson" block at the bottom.
 *    The big resume card is now rendered only once there is something to
 *    resume; before that, the first-run card is the whole answer.
 *  - The separate "streak at risk" card, which linked to the lesson the resume
 *    card below it already linked to. The streak is a fact about today, so it
 *    is now a margin note ON that card rather than a second card with its own
 *    button.
 *
 * BEHAVIOUR IS UNCHANGED: the same session gate, the same five queries, the
 * same streak and level arithmetic, the same three invite slots keyed to the
 * same engagement threshold, and the same `#invite-card` anchor.
 */

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
      <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)] pt-[clamp(2.2rem,5vw,4rem)]">
        <div className="max-w-[38rem]">
          <p className="nb-marker">one thing first</p>
          <h1 className="text-[clamp(1.9rem,1.3rem+2vw,2.9rem)]">
            Pick the handle your team will see.
          </h1>
          <p className="nb-lede mt-[clamp(0.9rem,2vw,1.3rem)]">
            It becomes your profile address and the name on the leaderboard.
            Nothing else on the account works until it is set.
          </p>
          <div className="mt-[clamp(1.4rem,2.6vw,2rem)]">
            <ProfileSetupForm
              mode="username"
              suggested={suggestUsername(user.email)}
              required
            />
          </div>
        </div>
      </section>
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
  // zero-progress learner, where it decides between showing their five-lesson
  // plan and offering the question that produces one.
  const startGoalId = completedCount === 0 ? await readStartGoalId() : null;
  const streak = streakFromDates(progressRows.map((r) => r.completed_at));
  // Lesson XP = 10 + 1 per streak-day, capped at 20 (max 2x). Show the multiplier.
  const xpMultiplier = (1 + Math.min(10, Math.max(0, streak - 1)) / 10).toFixed(1);

  // "Streak at risk": has an active streak but hasn't done a lesson today yet, so
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
  const achievementsPct = achievements.length
    ? clampPct((achievementsEarned / achievements.length) * 100)
    : 0;

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
  // Tone for the invite below. 109 of 144 teams here are a single person, and
  // the solo copy is a materially different (and better) ask for them, so it is
  // worth one head-only count to get it right.
  const teamMemberCount =
    profile?.team_number != null
      ? await getTeamMemberCount(profile.team_number)
      : 1;

  // ── Invite: ask in proportion to what the learner has actually done ──
  // Referral converts far better than any other channel precisely because the
  // sender has context to lend; they can vouch for the thing. So the ask is
  // only worth making once there is something to vouch FOR.
  //
  // Threshold picked from production (Aug 2026, 186 learners with any
  // progress). There is a steep trial cliff in the first few lessons:
  // 34 learners stop at 1, 29 at 2, 14 at 3, 6 at 4. Then a stable tail:
  // 103 learners have cleared 5 or more, and the median among learners with
  // any progress at all is 8. Five is the first point where someone has worked
  // through a real chunk of a module rather than sampled the site, so five is
  // where the ask is earned. Below it the card still exists, just far down the
  // page where only someone deliberately looking for it will meet it.
  const INVITE_EARNED_AT = 5;
  const inviteEarned = completedCount >= INVITE_EARNED_AT;

  // Framing reflects what they've done. No urgency, no guilt: for someone who
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

  // One card, one anchor (#invite-card is the target of the What's New CTA),
  // so it is only ever rendered in a single slot, chosen by engagement below.
  const inviteNode = profile?.username ? (
    <div id="invite-card" className="scroll-mt-28">
      {inviteEarned && (
        <p className="nb-sub mb-4 max-w-[58ch]">{inviteLead}</p>
      )}
      <TeamInvite
        username={profile.username}
        teamNumber={profile.team_number ?? null}
        referralCount={referralCount}
        tone={teamMemberCount <= 1 ? "solo" : "crew"}
        via="team-invite-dashboard"
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

  const resumeHref = continueLesson
    ? `/guides/${continueLesson.deptSlug}/${continueLesson.moduleSlug}/${continueLesson.lessonSlug}`
    : null;
  // The big card is only worth drawing once there is something to RESUME. At
  // zero progress the first-run block above already points at this exact
  // lesson, and two cards for one link is how a page teaches people to ignore
  // its cards.
  const showResume = !!(continueLesson && resumeHref && completedCount > 0);
  const showProfileNudge =
    !setup.show && !!profile?.username && !profile?.team_number;

  return (
    <>
      {/* Migrate any guest (pre-signup) progress into this account, once. */}
      <GuestMigration />

      {/* ===================== ENTRY GATES =====================
          Only two things ever render here, and both are one-time: the OAuth
          profile ask, and the first-run block for an account with nothing
          ticked off yet. Neither is chrome a returning learner ever sees. */}
      {(setup.show || completedCount === 0) && (
        <section className="nb-wrap pt-[clamp(2.2rem,5vw,3.6rem)]">
          <div className="grid gap-[clamp(1rem,2.4vw,1.6rem)]">
            {/* Google sign-ins have no handle and usually no team. Ask once,
                here, skippable, before anything else on the page. */}
            {setup.show && (
              <ProfileSetupForm
                mode={setup.mode}
                suggested={suggestUsername(user.email)}
                required={setup.required}
              />
            )}

            {/* FIRST RUN. `FirstRunLaunch` renders the goal-aware five-lesson
                plan when the learner already answered the one question on
                /start, so coming back here shows their plan rather than
                resetting them. With no answer stored it falls back to the
                generic next-lesson card, and the row below offers the question:
                the email confirmation link cannot reliably route people to
                /start (Supabase's template hardcodes its own destination), so
                the dashboard has to be a real entry point, not a backstop. */}
            {completedCount === 0 &&
              (startGoalId ? (
                <FirstRunLaunch userId={user.id} />
              ) : (
                <>
                  {continueLesson && resumeHref && (
                    <FirstRunGuide
                      href={resumeHref}
                      lessonTitle={continueLesson.lessonTitle}
                      deptName={continueLesson.deptName}
                    />
                  )}
                  <Link
                    href="/start"
                    className="nb-box nb-lift flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-[clamp(0.95rem,2vw,1.3rem)]"
                  >
                    <span className="min-w-0">
                      <span className="nb-slug block">not sure where to start</span>
                      <span className="mt-1 block text-[1.02rem] font-bold leading-tight">
                        Answer one question, get five lessons.
                      </span>
                    </span>
                    <span className="nb-btn-ghost nb-btn-sm shrink-0">
                      Build my plan
                    </span>
                  </Link>
                </>
              ))}
          </div>
        </section>
      )}

      {/* ===================== MASTHEAD =====================
          The top of a shop-log page: who is writing, and what state the work is
          in. Nothing is boxed, because a masthead is written on the paper. */}
      <section className="nb-wrap pb-[clamp(1.4rem,3vw,2.2rem)] pt-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
          <div className="min-w-0">
            <p className="nb-marker">your binder</p>

            <div className="flex items-center gap-[clamp(0.9rem,2vw,1.3rem)]">
              <Avatar
                name={displayName}
                src={profile?.avatar_url}
                seed={user.id}
                className="h-16 w-16 text-[1.15rem]"
              />
              <h1 className="min-w-0 text-[clamp(2rem,1.3rem+2.4vw,3.4rem)]">
                Hey, {firstName}
              </h1>
            </div>

            <p className="nb-lede mt-[clamp(0.9rem,2vw,1.2rem)]">
              {completedCount > 0
                ? `${pluralize(completedCount, "lesson")} cleared, ${pluralize(
                    departmentsInProgress,
                    "department"
                  )} open${streak > 1 ? `, ${streak} days running` : ""}.`
                : "Nothing ticked off yet. Open one lesson and this page starts keeping score."}
            </p>

            <div className="mt-[clamp(1.2rem,2.4vw,1.7rem)] flex flex-wrap gap-3">
              {resumeHref ? (
                <Link href={resumeHref} className="nb-btn">
                  {continueLesson?.fresh ? "Start learning" : "Continue learning"}
                </Link>
              ) : (
                <Link href="/guides" className="nb-btn">
                  Browse the guides
                </Link>
              )}
              <Link href="/leaderboard" className="nb-btn-ghost">
                Leaderboard
              </Link>
            </div>
          </div>

          {/* One pen annotation on the page, and it says the thing the figures
              cannot: which number is the one that matters this week. */}
          <p className="nb-pen max-w-[20ch] rotate-[1.4deg] min-[900px]:text-right">
            {streak > 1
              ? "the streak is the multiplier, not the trophy"
              : "five in a week is where it starts to stick"}
          </p>
        </div>
      </section>

      {/* ===================== THE TALLY ===================== */}
      <section className="nb-wrap pb-[clamp(2rem,4vw,3.2rem)]">
        <div className="grid gap-[clamp(1rem,2.4vw,1.6rem)]">
          <ProgressLedger
            level={level}
            levelPct={levelPct}
            xpIntoLevel={xpIntoLevel}
            xpToNext={xpToNext}
            nextLevel={nextLevel}
            xp={xp}
            streak={streak}
            xpMultiplier={xpMultiplier}
            lessonsCompleted={completedCount}
            departmentsInProgress={departmentsInProgress}
            departmentsCompleted={departmentsCompleted}
            achievementsEarned={achievementsEarned}
            achievementsTotal={achievements.length}
          />

          <WhatsNew inviteHref={profile?.username ? "#invite-card" : "/settings"} />

          {/* Fallback nudge for the team gap. Suppressed while the setup card
              is up top, which already asks for it inline, and kept for learners
              who skipped that card so the ask survives without repeating. */}
          {showProfileNudge && (
            <Link
              href="/settings"
              className="nb-box nb-lift flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-[clamp(0.95rem,2vw,1.3rem)]"
            >
              <span className="min-w-0">
                <span className="nb-slug block">profile / team number</span>
                <span className="mt-1 block text-[1.02rem] font-bold leading-tight">
                  Add your team number.
                </span>
                <span className="mt-0.5 block text-[0.9rem] text-graphite">
                  It puts your team beside your name on the leaderboard.
                </span>
              </span>
              <span className="nb-btn-ghost nb-btn-sm shrink-0">Settings</span>
            </Link>
          )}
        </div>
      </section>

      {/* ===================== NEXT UP ===================== */}
      {showResume && continueLesson && resumeHref && (
        <section className="nb-wrap border-t-2 border-ink py-[clamp(2.2rem,4.5vw,3.6rem)]">
          <h2 className="text-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)]">Next up</h2>

          {/* The streak is a fact about today, so it is a note on the card
              rather than a second card with its own button. No countdown and no
              "expires at midnight": a lapsed streak just starts again, which is
              worth knowing and is the opposite of a threat. */}
          {streakAtRisk && (
            <div className="nb-note mt-[clamp(1rem,2.2vw,1.5rem)] max-w-[46rem]">
              <p className="nb-slug">{streak} days running</p>
              <p className="mt-1.5 text-[0.95rem] leading-snug">
                A lesson today makes it {streak + 1}, and back-to-back days pay{" "}
                {xpMultiplier}x XP. One lesson is enough.
              </p>
            </div>
          )}

          <ResumeCard
            className="mt-[clamp(1.2rem,2.6vw,1.8rem)]"
            variant="tile"
            href={resumeHref}
            lessonTitle={continueLesson.lessonTitle}
            deptName={continueLesson.deptName}
            deptSlug={continueLesson.deptSlug}
            moduleTitle={continueLesson.moduleTitle}
            pct={continueLesson.pct}
            fresh={continueLesson.fresh}
          />
        </section>
      )}

      {/* ===================== INVITE, EARNED SLOT =====================
          Directly after the lesson they are mid-way through: the one moment on
          this page where "you actually use this" is self-evident. */}
      {inviteNode && inviteEarned && (
        <section className="nb-wrap border-t-2 border-ink py-[clamp(2.2rem,4.5vw,3.6rem)]">
          {inviteNode}
        </section>
      )}

      {/* ===================== DEPARTMENTS ===================== */}
      <section className="nb-wrap border-t-2 border-ink py-[clamp(2.2rem,4.5vw,3.6rem)]">
        <div className="mb-[clamp(1.4rem,3vw,2.2rem)] flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <h2 className="text-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)]">
              Your {departments.length} departments
            </h2>
            <p className="nb-sub mt-3">
              Every card carries the percentage of its lessons you have ticked
              off. Open any of them in any order.
            </p>
          </div>
          <Link href="/guides" className="nb-btn-ghost nb-btn-sm shrink-0">
            The whole catalogue
          </Link>
        </div>

        {deptProgress.length > 0 ? (
          <div className="grid gap-[clamp(0.9rem,1.9vw,1.4rem)] min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
            {deptProgress.map(({ dept, pct }, i) => (
              <DepartmentCard
                key={dept.slug}
                slug={dept.slug}
                name={dept.name}
                tagline={dept.tagline}
                moduleCount={dept.moduleCount}
                lessonCount={dept.lessonCount}
                progressPct={pct}
                index={i}
              />
            ))}
          </div>
        ) : (
          <div className="nb-box max-w-[44rem] p-[clamp(1.2rem,2.6vw,1.9rem)]">
            <p className="nb-slug">departments</p>
            <p className="mt-2 text-[0.98rem] leading-snug text-graphite">
              The catalogue did not come back this time. Reload the page, or go
              straight to{" "}
              <Link href="/guides" className="nb-link">
                the guides
              </Link>
              .
            </p>
          </div>
        )}

        {/* At zero progress the departments wall IS the browse surface, so the
            only thing left to say is which tab to open when none of them
            obviously fits. That is a sentence, so it is written as one. */}
        {completedCount === 0 && (
          <p className="nb-sub mt-[clamp(1.4rem,3vw,2.2rem)]">
            None of them the obvious one? Open{" "}
            <Link href="/guides/getting-started" className="nb-link">
              Getting Started
            </Link>
            . It walks the whole map of what each department does in a season,
            and every other tab makes more sense afterwards.
          </p>
        )}
      </section>

      {/* ===================== INVITE, QUIET SLOT =====================
          One to four lessons in: still deciding whether they like this. The
          card stays reachable (and keeps #invite-card anchored for the What's
          New link) but carries no personalised prompt. */}
      {inviteNode && !inviteEarned && completedCount > 0 && (
        <section className="nb-wrap border-t-2 border-ink py-[clamp(2.2rem,4.5vw,3.6rem)]">
          {inviteNode}
        </section>
      )}

      {/* ===================== THE BADGE DRAWER ===================== */}
      {achievements.length > 0 && (
        <section className="nb-wrap border-t-2 border-ink py-[clamp(2.2rem,4.5vw,3.6rem)]">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div>
              <h2 className="text-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)]">
                Badges
              </h2>
              <p className="nb-sub mt-3">
                {achievementsEarned > 0
                  ? `${achievementsEarned} of ${achievements.length} earned. The locked ones print how far off they are.`
                  : `All ${achievements.length} of them unlock from lessons you were going to read anyway.`}
              </p>
            </div>
            <p className="nb-count shrink-0">
              {achievementsEarned}
              <small>of {achievements.length}</small>
            </p>
          </div>

          <div className="mt-[clamp(1rem,2.2vw,1.5rem)] max-w-[28rem]">
            <Progress
              value={achievementsPct}
              label={`${achievementsEarned} of ${achievements.length} badges earned`}
            />
          </div>

          <div className="mt-[clamp(1.2rem,2.6vw,1.8rem)] grid gap-[clamp(0.75rem,1.6vw,1.1rem)] min-[520px]:grid-cols-2 min-[860px]:grid-cols-3 min-[1120px]:grid-cols-4">
            {achievements.map((a) => (
              <AchievementBadge key={a.slug} achievement={a} />
            ))}
          </div>
        </section>
      )}

      {/* ===================== INVITE, DORMANT SLOT =====================
          Zero lessons: nothing to vouch for yet, so nobody is asked to
          recommend anything. The card renders last, purely so the What's New
          link still has somewhere to land for a learner who goes looking. */}
      {inviteNode && completedCount === 0 && (
        <section className="nb-wrap border-t-2 border-ink py-[clamp(2.2rem,4.5vw,3.6rem)]">
          {inviteNode}
        </section>
      )}

      {/* The page always ends on paper, never on a card butted against the
          footer's own rule. */}
      <div className="pb-[clamp(1.5rem,3vw,2.5rem)]" />
    </>
  );
}
