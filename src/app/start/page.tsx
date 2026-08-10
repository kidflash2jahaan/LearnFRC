import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, LayoutGrid, Sparkles } from "lucide-react";
import { getSession } from "@/lib/auth";
import { Glow, Reveal, Rise } from "@/components/motion/primitives";
import { FirstRunGoalPicker } from "@/components/onboarding/first-run-goal-picker";
import { FirstRunPlan } from "@/components/onboarding/first-run-plan";
import {
  getGoalOptions,
  getStarterPlan,
  readStartGoalId,
  STARTER_TARGET,
} from "@/lib/recommend";

/**
 * /start — the first-run route.
 *
 * THE PROBLEM THIS EXISTS FOR: 45% of accounts (156 of 347) have never
 * completed a single lesson, and the loss is not the content or the quiz —
 * 95.7% of people who spend a minute on a lesson page finish it, and the
 * completion step of the funnel is 97.7%. Everything is lost upstream, on the
 * choosing. A brand-new account today lands on /dashboard, where it is shown
 * five competing calls to action pointing at four destinations, six gauges
 * reading zero, eleven department cards at 0% and eleven locked badges. 43% of
 * new accounts land there and complete a median of ONE lesson; the handful who
 * land directly on a lesson page complete a median of 22.
 *
 * THE SHAPE: one question, then one plan, then one button into one lesson.
 * Nothing else is on this page — no stats, no catalogue, no leaderboard, no
 * badges. Every other choice is deferred until after lesson one.
 *
 * HOW LEARNERS GET HERE (all one-shot — nothing redirects into this page
 * repeatedly, so it cannot become a wall):
 *   - straight after account creation, from `/auth/callback` (Google, and the
 *     emailed confirmation link) and `/auth/confirm` (token-hash confirmation),
 *     but only when the destination would otherwise have been the generic
 *     dashboard — an invite or any explicit `?next=` still wins. See
 *     `src/lib/first-run.ts`.
 *   - from the guides index, for the 156 existing accounts that never completed
 *     a lesson and so never saw this page.
 *   - from the plan itself (`/start?change=1`) when someone picked wrong.
 *
 * ALWAYS SKIPPABLE. Every branch below renders at least one way out to somewhere
 * that works — the dashboard, or the full catalogue — and no page in the app
 * redirects back to /start, so there is no cycle to be caught in. The two
 * `redirect("/dashboard")` guards exist for the same reason: a version of this
 * page with no action on it is strictly worse than the dashboard it replaces.
 */

export const metadata: Metadata = {
  title: "Start here · LearnFRC",
  description:
    "Answer one question and we'll turn 394 lessons into the five that get you started.",
  // Signed-in only, and a thin router — keep it out of the index entirely so it
  // never competes with the guides for crawl budget.
  robots: { index: false, follow: false },
};

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ change?: string }>;
}) {
  const { user, profile } = await getSession();
  if (!user) redirect("/login?next=/start");

  const { change } = await searchParams;
  const goalId = await readStartGoalId();
  // `?change=1` is the only way back to the question once it is answered, so a
  // wrong tap is never permanent — but the default is always to move forward.
  const showPicker = !goalId || change === "1";

  const displayName =
    profile?.full_name || profile?.username || user.email?.split("@")[0] || "";
  const firstName = displayName.split(" ")[0];

  const [goals, plan] = await Promise.all([
    showPicker ? getGoalOptions() : Promise.resolve([]),
    showPicker ? Promise.resolve(null) : getStarterPlan(user.id, goalId),
  ]);

  // Defensive: a missing catalogue would leave this page with no action at all,
  // and a dead end here is strictly worse than the dashboard we are replacing.
  // Both branches are covered — the picker with no answers to offer is just as
  // dead as a plan with no lessons in it, and this page is now the first thing
  // a brand-new account sees, so neither may ever render empty.
  if (!showPicker && !plan) redirect("/dashboard");
  if (showPicker && goals.length === 0) redirect("/dashboard");

  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          {
            size: "540px",
            pos: { left: "-170px", top: "-180px" },
            color: "#8bbcff",
            opacity: 0.5,
          },
          {
            size: "480px",
            pos: { right: "-150px", top: "80px" },
            color: "#6ff0ea",
            opacity: 0.36,
            delay: 2.5,
          },
        ]}
      />

      <div className="mx-auto max-w-3xl px-4 pt-28 pb-24 sm:px-6">
        {showPicker ? (
          <>
            <Rise>
              <span className="ac-chip inline-flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
                <span className="ac-eyebrow">
                  One question · then you&apos;re in
                </span>
              </span>

              <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                What do you do on your team{firstName ? `, ${firstName}` : ""}?
              </h1>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-foreground/70">
                Pick the closest one. We&apos;ll turn 394 lessons across 11
                departments into the {STARTER_TARGET} that get you moving — and
                you can change it any time.
              </p>
            </Rise>

            <FirstRunGoalPicker goals={goals} />

            {/* The way out. Deliberately quiet — but present and unambiguous,
                because a first-run screen you cannot leave is a trap, and a
                learner who bounces off one is not coming back for the plan. */}
            <Reveal className="mt-8">
              <p className="text-xs text-muted-foreground">
                Not ready to choose? The first answer is the safe one — it
                starts with how FRC works and covers everything a new member
                needs.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                <Link
                  href="/guides"
                  className="inline-flex items-center gap-1 font-semibold text-foreground/70 hover:text-foreground hover:underline"
                >
                  <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
                  Browse all 11 departments
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
                >
                  Skip for now
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </Reveal>
          </>
        ) : (
          plan && (
            <>
              <Rise>
                <span className="ac-chip inline-flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
                  <span className="ac-eyebrow">
                    {plan.goalLabel}
                  </span>
                </span>

                <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                  {firstName ? `You're set, ${firstName}.` : "You're set."}
                </h1>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-foreground/70">
                  Everything below follows the{" "}
                  <span
                    className="font-semibold"
                    style={{ color: "var(--primary)" } as CSSProperties}
                  >
                    {plan.pathTitle}
                  </span>{" "}
                  route. Start at the top and work down — that is the whole
                  plan.
                </p>
              </Rise>

              <Reveal className="mt-8">
                <FirstRunPlan plan={plan} />
              </Reveal>

              <Reveal className="mt-6">
                <p className="text-xs text-muted-foreground">
                  Your dashboard is waiting when you want it — stats, streak,
                  achievements and the leaderboard all fill in as you go.{" "}
                  <Link
                    href="/dashboard"
                    className="font-semibold text-foreground/70 hover:text-foreground hover:underline"
                  >
                    Go to dashboard
                  </Link>
                </p>
              </Reveal>
            </>
          )
        )}
      </div>
    </div>
  );
}
