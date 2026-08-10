"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { getMyTeamSpace } from "@/lib/team-space";
import { getPathBySlug } from "@/lib/paths-data";
import { MAX_DUE_DAYS, MAX_PLAN_DEPARTMENTS } from "./plan-data";

/**
 * TRAINING PLANS — the only two writes in the feature.
 *
 * THE RULES THESE OBEY, and the reasons they exist:
 *
 *  1. NO SPACE ID CROSSES THE WIRE. Neither action takes a space id, a member
 *     key or a role. Authority is re-derived on every call from
 *     auth.getUser() → getMyTeamSpace() → myRole === "lead". Because a user can
 *     be an active member of at most one space (a DB-level partial unique
 *     index), "the caller's space" is unambiguous server-side, so there is
 *     simply no identifier for a caller to tamper with and no IDOR surface.
 *
 *  2. NOTHING IS READ OUT OF FormData. Inputs are a typed object of a closed
 *     shape: a slug from a fixed 5-item catalog, department UUIDs checked
 *     against the departments table, and a date. Every one is validated against
 *     a server-side source of truth before it reaches SQL.
 *
 *  3. NO FREE TEXT, EVER. There is no title, note, description, reason or
 *     message parameter here, and none may be added. `path_slug` is a key into
 *     src/lib/paths-data.ts, not a name someone typed, and a Postgres CHECK
 *     makes a sentence unrepresentable in the column.
 *
 *  4. THE ONLY TABLES TOUCHED ARE team_space_plan_items AND THE AUDIT LOG.
 *     A plan cannot modify another user's lesson_progress, XP, achievements,
 *     streak or profile — there is no code path from here to any of them. That
 *     is what makes this a suggestion rather than control.
 *
 *  5. FAILURES ARE A CLOSED UNION. The UI renders fixed, server-authored copy
 *     per case, so no input is ever echoed back to a screen.
 */

export type PlanActionError =
  | "unauthenticated"
  | "not_lead"
  | "rate_limited"
  | "invalid_plan"
  | "invalid_date"
  | "server_error";

export type PlanActionResult =
  | { ok: true }
  | { ok: false; error: PlanActionError };

/**
 * Strict YYYY-MM-DD, round-tripped through Date so 2026-02-31 is rejected, then
 * bounded. Yesterday is allowed so a lead in a behind-UTC timezone picking
 * "today" in their own calendar is never told their date is in the past.
 */
function parseDueOn(input: string | null | undefined): string | null | "invalid" {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return "invalid";
  const [y, m, d] = input.split("-").map(Number);
  const asDate = new Date(Date.UTC(y, m - 1, d));
  if (
    asDate.getUTCFullYear() !== y ||
    asDate.getUTCMonth() !== m - 1 ||
    asDate.getUTCDate() !== d
  )
    return "invalid";

  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const day = 86_400_000;
  if (asDate.getTime() < todayUTC - day) return "invalid";
  if (asDate.getTime() > todayUTC + MAX_DUE_DAYS * day) return "invalid";
  return input;
}

/** The caller's space, but only if they lead it. */
async function requireLeadSpace(): Promise<
  { id: string; userId: string } | PlanActionError
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "unauthenticated";
  const space = await getMyTeamSpace();
  // A member of someone else's space and a user with no space at all get the
  // same answer — a non-lead learns nothing about what exists.
  if (!space || space.myRole !== "lead") return "not_lead";
  return { id: space.id, userId: user.id };
}

/**
 * Replace the space's suggested plan.
 *
 * Replace, not append: a plan is a set, so re-assigning swaps the whole thing
 * rather than silently accumulating departments a lead can no longer see the
 * origin of. Implemented as delete-then-insert inside one action; there is no
 * upsert because the natural unit of change here is the whole plan.
 */
export async function assignPlan(input: {
  /** A slug from the 5 curated routes, or null when hand-picking. */
  pathSlug?: string | null;
  /** Department UUIDs. Ignored when pathSlug is given — the route defines them. */
  departmentIds?: string[];
  /** Optional TARGET date, YYYY-MM-DD. Never enforced against anybody. */
  dueOn?: string | null;
}): Promise<PlanActionResult> {
  const auth = await requireLeadSpace();
  if (typeof auth === "string") return { ok: false, error: auth };

  const dueOn = parseDueOn(input.dueOn);
  if (dueOn === "invalid") return { ok: false, error: "invalid_date" };

  if (!(await rateLimit("team-plan-set", 20, 3600, auth.userId)))
    return { ok: false, error: "rate_limited" };

  const admin = createAdminClient();

  // ── resolve the department set from a trusted source ──────────────────────
  let pathSlug: string | null = null;
  let wantedSlugs: string[] | null = null;
  let wantedIds: string[] | null = null;

  if (input.pathSlug) {
    // The slug is only ever used to LOOK UP a code constant. An unknown slug is
    // rejected outright, so nothing a caller sends can reach the column except
    // one of the five values compiled into the build.
    const path = getPathBySlug(input.pathSlug);
    if (!path) return { ok: false, error: "invalid_plan" };
    pathSlug = path.slug;
    wantedSlugs = [...new Set(path.steps.map((s) => s.deptSlug))];
  } else {
    const ids = Array.isArray(input.departmentIds) ? input.departmentIds : [];
    const unique = [...new Set(ids.filter((v) => typeof v === "string"))];
    if (unique.length === 0 || unique.length > MAX_PLAN_DEPARTMENTS)
      return { ok: false, error: "invalid_plan" };
    wantedIds = unique;
  }

  // Every department id written is one the DATABASE confirmed exists. Nothing
  // is trusted from the client, not even the shape of a UUID.
  const query = admin.from("departments").select("id");
  const { data: deptRows, error: deptErr } = wantedSlugs
    ? await query.in("slug", wantedSlugs)
    : await query.in("id", wantedIds as string[]);
  if (deptErr) return { ok: false, error: "server_error" };

  const deptIds = ((deptRows ?? []) as { id: string }[]).map((d) => d.id);
  if (deptIds.length === 0) return { ok: false, error: "invalid_plan" };
  // A hand-picked mix must resolve completely; a partial match means the client
  // sent something that is not in the catalog.
  if (wantedIds && deptIds.length !== wantedIds.length)
    return { ok: false, error: "invalid_plan" };

  // ── write ────────────────────────────────────────────────────────────────
  const { error: delErr } = await admin
    .from("team_space_plan_items")
    .delete()
    .eq("space_id", auth.id)
    .is("user_id", null);
  if (delErr) return { ok: false, error: "server_error" };

  const { error: insErr } = await admin.from("team_space_plan_items").insert(
    deptIds.map((department_id) => ({
      space_id: auth.id,
      user_id: null,
      department_id,
      assigned_by: auth.userId,
      path_slug: pathSlug,
      due_on: dueOn,
    }))
  );
  if (insErr) return { ok: false, error: "server_error" };

  await logPlanEvent(auth.id, auth.userId, "plan_set");
  revalidateSurfaces();
  return { ok: true };
}

/** Take the suggestion down. Touches nothing but the plan rows. */
export async function clearPlan(): Promise<PlanActionResult> {
  const auth = await requireLeadSpace();
  if (typeof auth === "string") return { ok: false, error: auth };

  const admin = createAdminClient();
  const { error } = await admin
    .from("team_space_plan_items")
    .delete()
    .eq("space_id", auth.id)
    .is("user_id", null);
  if (error) return { ok: false, error: "server_error" };

  await logPlanEvent(auth.id, auth.userId, "plan_clear");
  revalidateSurfaces();
  return { ok: true };
}

/**
 * Fixed-vocabulary audit entry — the record that lets a parent or a school be
 * answered later. There is no free-text column on this table by design, and an
 * audit failure must never fail the action it describes.
 */
async function logPlanEvent(
  spaceId: string,
  actorId: string,
  action: "plan_set" | "plan_clear"
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("team_space_events").insert({
      space_id: spaceId,
      actor_id: actorId,
      action,
      // Whole-space plans single nobody out, so there is no target to record.
      target_user_id: null,
    });
  } catch {
    /* never block the user's action on the audit log */
  }
}

function revalidateSurfaces(): void {
  revalidatePath("/teams/space/plan");
  revalidatePath("/dashboard");
}
