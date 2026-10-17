import { getAppUser } from "@/lib/app/auth";
import { loadStartPlan, type StartPlanViewer } from "@/lib/app/start-plan";
import { fromFailure, guarded, ok, unauthorized } from "@/lib/app/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/app/start-plan?goal=<goalId>
 *
 * The site's first-run plan (/start): the five lessons one answer to "what do
 * you do on your team?" resolves to, from getStarterPlan, the same function
 * /start calls (see src/lib/app/start-plan.ts). Unknown or missing `goal` gets
 * the default plan ("new"), like the site.
 *
 * Bearer optional. Without a token every row is unticked. With one, the
 * account's finished lessons are ticked exactly as on /start. A token that is
 * sent but no longer valid is a 401, never a quiet fall back to the signed-out
 * plan, so the app refreshes the session instead of showing finished lessons
 * as unfinished. Always `no-store`: the same URL answers per account.
 */
export async function GET(req: Request) {
  return guarded(async () => {
    let viewer: StartPlanViewer | null = null;
    if (req.headers.has("authorization")) {
      const session = await getAppUser(req);
      if (!session) return unauthorized();
      viewer = { userId: session.user.id, supabase: session.supabase };
    }

    const goal = new URL(req.url).searchParams.get("goal");
    const result = await loadStartPlan(goal, viewer);
    if (!result.ok) return fromFailure(result);
    return ok(result.plan);
  });
}
