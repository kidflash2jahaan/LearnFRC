import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { needsUsernameSetup } from "@/lib/onboarding-server";
import { getSession } from "@/lib/auth";
import { FirstRunGoalPicker } from "@/components/onboarding/first-run-goal-picker";
import { FirstRunPlan } from "@/components/onboarding/first-run-plan";
import {
  getGoalOptions,
  getStarterPlan,
  readStartGoalId,
  STARTER_TARGET,
} from "@/lib/recommend";

/**
 * /start, the first-run route.
 *
 * THE PROBLEM THIS EXISTS FOR: 45% of accounts (156 of 347) have never
 * completed a single lesson, and the loss is not the content or the quiz.
 * 95.7% of people who spend a minute on a lesson page finish it, and the
 * completion step of the funnel is 97.7%. Everything is lost upstream, on the
 * choosing. A brand-new account today lands on /dashboard, where it is shown
 * five competing calls to action pointing at four destinations, six gauges
 * reading zero, eleven department cards at 0% and eleven locked badges. 43% of
 * new accounts land there and complete a median of ONE lesson; the handful who
 * land directly on a lesson page complete a median of 22.
 *
 * THE SHAPE: one question, then one plan, then one button into one lesson.
 * Nothing else is on this page: no stats, no catalogue, no leaderboard, no
 * badges. Every other choice is deferred until after lesson one.
 *
 * WHY IT IS DRAWN AS ONE NARROW COLUMN: every other page in this section of the
 * binder is a spread, two columns of different weights with something taped to
 * one of them. This one is a worksheet clipped to the front cover, so it gets a
 * single measure and no second thing to look at. The design argument and the
 * product argument are the same argument here, and any furniture added to make
 * the page look busier would be furniture competing with the question.
 *
 * HOW LEARNERS GET HERE (all one-shot, nothing redirects into this page
 * repeatedly, so it cannot become a wall):
 *   - straight after account creation, from `/auth/callback` (Google, and the
 *     emailed confirmation link) and `/auth/confirm` (token-hash confirmation),
 *     but only when the destination would otherwise have been the generic
 *     dashboard. An invite or any explicit `?next=` still wins. See
 *     `src/lib/first-run.ts`.
 *   - from the guides index, for the 156 existing accounts that never completed
 *     a lesson and so never saw this page.
 *   - from the plan itself (`/start?change=1`) when someone picked wrong.
 *
 * ALWAYS SKIPPABLE. Every branch below renders at least one way out to somewhere
 * that works, the dashboard or the full catalogue, and no page in the app
 * redirects back to /start, so there is no cycle to be caught in. The two
 * `redirect("/dashboard")` guards exist for the same reason: a version of this
 * page with no action on it is strictly worse than the dashboard it replaces.
 */

export const metadata: Metadata = {
  title: "Start here · LearnFRC",
  description:
    "Answer one question and we'll turn 394 lessons into the five that get you started.",
  // Signed-in only, and a thin router. Keep it out of the index entirely so it
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
  // Required handle first: OAuth lands here, and the setup step lives on the
  // dashboard, so send them there until they have one.
  if (needsUsernameSetup(profile)) redirect("/dashboard");

  const { change } = await searchParams;
  const goalId = await readStartGoalId();
  // `?change=1` is the only way back to the question once it is answered, so a
  // wrong tap is never permanent, but the default is always to move forward.
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
  // Both branches are covered: the picker with no answers to offer is just as
  // dead as a plan with no lessons in it, and this page is now the first thing
  // a brand-new account sees, so neither may ever render empty.
  if (!showPicker && !plan) redirect("/dashboard");
  if (showPicker && goals.length === 0) redirect("/dashboard");

  return (
    <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)] pt-[clamp(2.2rem,5vw,4rem)]">
      {/* One measure for the whole page. Wide enough for the three-column log
          line the picker draws, narrow enough that the question is never
          competing with anything to its right. */}
      <div className="max-w-[58rem]">
        {showPicker ? (
          <>
            <p className="nb-marker">one question / then you are in</p>

            <h1 className="max-w-[16ch]">
              What do you do on your team{firstName ? `, ${firstName}` : ""}?
            </h1>

            <p className="nb-lede mt-[clamp(1rem,2vw,1.5rem)]">
              Pick the closest one. It turns 394 lessons across 11 departments
              into the {STARTER_TARGET} that get you moving, and you can change
              it any time.
            </p>

            <p className="nb-pen mt-4 rotate-[-1.1deg]">
              one tap, then you are reading
            </p>

            <FirstRunGoalPicker goals={goals} />

            {/* The way out. Deliberately quiet, but present and unambiguous,
                because a first-run screen you cannot leave is a trap, and a
                learner who bounces off one is not coming back for the plan.
                It is a margin note rather than a third button: two buttons of
                equal weight beside five answers is a sixth and seventh answer. */}
            <div className="nb-note mt-[clamp(1.6rem,3.4vw,2.4rem)] max-w-[46rem]">
              <p className="nb-slug">not ready to choose</p>
              <p className="mt-1.5 text-[0.95rem] leading-[1.5]">
                The first answer is the safe one. It starts with how FRC works
                and covers everything a new member needs.
              </p>
              <p className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1">
                <Link href="/guides" className="nb-link text-[0.92rem]">
                  Browse all 11 departments
                </Link>
                <Link href="/dashboard" className="nb-link text-[0.92rem]">
                  Skip for now
                </Link>
              </p>
            </div>
          </>
        ) : (
          plan && (
            <>
              <p className="nb-marker">
                your route / {plan.pathSlug}
              </p>

              <h1 className="max-w-[14ch]">
                {firstName ? `You're set, ${firstName}.` : "You're set."}
              </h1>

              <p className="nb-lede mt-[clamp(1rem,2vw,1.5rem)]">
                Everything below follows the {plan.pathTitle} route. Start at
                the top and work down, that is the whole plan.
              </p>

              <div className="mt-[clamp(1.6rem,3.4vw,2.4rem)]">
                <FirstRunPlan plan={plan} />
              </div>

              <p className="mt-[clamp(1.2rem,2.6vw,1.8rem)] max-w-[52ch] text-[0.92rem] leading-[1.5] text-graphite">
                Your dashboard is waiting when you want it. Stats, streak,
                achievements and the leaderboard all fill in as you go.{" "}
                <Link href="/dashboard" className="nb-link">
                  Go to dashboard
                </Link>
              </p>
            </>
          )
        )}
      </div>
    </section>
  );
}
