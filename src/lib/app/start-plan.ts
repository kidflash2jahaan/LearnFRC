import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_GOAL_ID,
  goalById,
  getStarterPlan,
  resolveReadMins,
  STARTER_TARGET,
  type StartGoal,
} from "@/lib/recommend";
import { fail, type Result } from "@/lib/app/result";

/**
 * The first-run plan for GET /api/app/start-plan: one answer to "what do you do
 * on your team?" turned into the five lessons that get someone started.
 *
 * Not a second copy of the rule. The five lessons come from getStarterPlan in
 * src/lib/recommend.ts, the same call /start and the dashboard's plan card
 * make, so the app and the site hand the same learner the same five lessons in
 * the same order. This file only reshapes that plan into the app's JSON.
 *
 * Finished lessons stay in the plan as ticked rows (`done: true`), exactly like
 * the site: a plan that reshuffles under you never reads as progress. `next`
 * is the first unticked row, or once all five are ticked, the next unfinished
 * lesson further down the same route (then `step` is past `target`).
 *
 * The answer itself is not stored here. The site keeps it in a one-year cookie
 * (`lf_goal`), so the app keeps it on the device for a year and sends it as
 * `goal`. An unknown or missing goal gets the default plan ("new"), like the
 * site, and `tailored` says so.
 */

export type StartPlanLesson = {
  lessonId: string;
  title: string;
  departmentSlug: string;
  departmentName: string;
  moduleSlug: string;
  slug: string;
  /** Real read time from the word count, the same number the lesson page prints. */
  minutes: number;
  /** Finished by the signed-in account. Always false without a token. */
  done: boolean;
};

export type StartPlanPayload = {
  goal: Pick<StartGoal, "id" | "label" | "blurb" | "pathSlug" | "iconName">;
  /** False when `goal` was missing or unknown and the default plan was used. */
  tailored: boolean;
  pathSlug: string;
  pathTitle: string;
  /** How long the plan is meant to be: 5, the measured retention threshold. */
  target: number;
  lessons: StartPlanLesson[];
  doneCount: number;
  /** The single next action. Null only when the whole route is finished. */
  next: (StartPlanLesson & { step: number }) | null;
};

/** The learner whose finished lessons get ticked, verified by the caller. */
export type StartPlanViewer = {
  userId: string;
  /** Acts as that learner under RLS (cookie or Bearer-token client). */
  supabase: SupabaseClient;
};

export async function loadStartPlan(
  goalId: string | null,
  viewer: StartPlanViewer | null
): Promise<Result<{ plan: StartPlanPayload }>> {
  const plan = await getStarterPlan(viewer?.userId ?? null, goalId, viewer?.supabase);
  // Same goal resolution getStarterPlan just used, so `goal` always names the
  // plan that was actually built.
  const goal = goalById(plan?.goalId) ?? goalById(DEFAULT_GOAL_ID);
  if (!plan || !goal)
    return fail("server", "Something went wrong on our side. Try again in a moment.");

  // The site prints a read time on the next lesson only (getStarterPlan works
  // it out as `next.readMins`); the app shows one on every row, worked out the
  // same way. Cached catalogue reads, the same ones the lesson pages use.
  const mins = new Map(
    await Promise.all(
      plan.lessons.map(async (l) => [l.id, await resolveReadMins(l.id)] as const)
    )
  );

  const lessons: StartPlanLesson[] = plan.lessons.map((l) => ({
    lessonId: l.id,
    title: l.title,
    departmentSlug: l.deptSlug,
    departmentName: l.deptName,
    moduleSlug: l.moduleSlug,
    slug: l.slug,
    minutes: mins.get(l.id) ?? 1,
    done: l.done,
  }));

  const next = plan.next
    ? {
        lessonId: plan.next.id,
        title: plan.next.title,
        departmentSlug: plan.next.deptSlug,
        departmentName: plan.next.deptName,
        moduleSlug: plan.next.moduleSlug,
        slug: plan.next.slug,
        minutes: plan.next.readMins,
        done: false,
        step: plan.next.step,
      }
    : null;

  return {
    ok: true,
    plan: {
      goal: {
        id: goal.id,
        label: goal.label,
        blurb: goal.blurb,
        pathSlug: goal.pathSlug,
        iconName: goal.iconName,
      },
      tailored: plan.tailored,
      pathSlug: plan.pathSlug,
      pathTitle: plan.pathTitle,
      target: STARTER_TARGET,
      lessons,
      doneCount: plan.doneCount,
      next,
    },
  };
}
