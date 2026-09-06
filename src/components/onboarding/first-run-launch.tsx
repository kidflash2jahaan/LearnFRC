import { getStarterPlan, readStartGoalId } from "@/lib/recommend";
import { FirstRunPlan } from "@/components/onboarding/first-run-plan";

/**
 * THE DASHBOARD DROP-IN for an account with nothing ticked off yet.
 *
 * This file draws nothing. It resolves a plan and hands it to `FirstRunPlan`,
 * which is the card that gets drawn: a checklist taped inside the binder
 * cover, one obvious next lesson, and a finish line five rows down.
 *
 * SELF-CONTAINED ON PURPOSE. It reads the answered goal off the cookie and
 * resolves its own plan, so the only thing the dashboard has to know is the
 * signed-in user id. That keeps the call site in src/app/dashboard/page.tsx to
 * a single block, and it kept this component clear of the Team Mode work
 * happening on that same file at the time.
 *
 * COST. One cookie read, one paged `lesson_progress` read for this learner, up
 * to five `getDepartmentBySlug` calls and one `getLessonContent` call. All of
 * those are `unstable_cache`d catalogue reads shared with the department,
 * lesson and /paths pages, so in practice they are already warm.
 *
 * It renders nothing at all when there is no plan left worth showing, meaning
 * the catalogue is empty or the learner has finished every lesson on their
 * route, so it is always safe to mount.
 */
export async function FirstRunLaunch({ userId }: { userId: string }) {
  const goalId = await readStartGoalId();
  const plan = await getStarterPlan(userId, goalId);
  if (!plan || !plan.next) return null;
  return <FirstRunPlan plan={plan} compact />;
}
