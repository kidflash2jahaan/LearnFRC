import { getStarterPlan, readStartGoalId } from "@/lib/recommend";
import { FirstRunPlan } from "@/components/onboarding/first-run-plan";

/**
 * DASHBOARD DROP-IN — the zero-progress first-run block.
 *
 * Self-contained on purpose: it reads the answered goal from the cookie and
 * resolves its own plan, so the only thing the dashboard has to know is the
 * signed-in user id. That keeps the insertion into `src/app/dashboard/page.tsx`
 * to a single block (see the findings for the exact snippet) and keeps this
 * component out of the way of the concurrent Team Mode work on that file.
 *
 * COST: one cookie read, one paged `lesson_progress` read for this learner, up
 * to five `getDepartmentBySlug` calls and one `getLessonContent` call — all of
 * which are `unstable_cache`d catalogue reads shared with the department,
 * lesson and /paths pages, so in practice they are warm.
 *
 * Renders nothing when there is no plan left to show (catalogue empty, or the
 * learner has finished every lesson on their route), so it is always safe to
 * mount.
 */
export async function FirstRunLaunch({ userId }: { userId: string }) {
  const goalId = await readStartGoalId();
  const plan = await getStarterPlan(userId, goalId);
  if (!plan || !plan.next) return null;
  return <FirstRunPlan plan={plan} compact />;
}
