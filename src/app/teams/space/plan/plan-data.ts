import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyTeamSpace } from "@/lib/team-space";
import { getDepartments } from "@/lib/queries";
import { getPathBySlug, PATHS } from "@/lib/paths-data";

/**
 * TRAINING PLANS — the read side.
 *
 * WHAT A PLAN IS. A lead picks one of the curated routes from /paths (or hand-
 * picks departments), optionally attaches a target date, and that becomes a
 * SUGGESTION visible to everyone in their team space. It is stored as rows in
 * `team_space_plan_items` — a department id, a path slug and a date, nothing
 * else. There is no title, no note and no per-item text anywhere in this
 * feature, because a plan is the one channel where an adult's words would
 * arrive on a minor's dashboard wearing the site's branding.
 *
 * WHAT A PLAN IS NOT. It changes nothing. Assigning one does not touch anyone's
 * lesson_progress, XP, achievements or streak; it does not lock, hide or gate a
 * single lesson; it sends no email and fires no notification. Every function in
 * this file is a READ. The only writes in the feature are in ./actions.ts and
 * they touch exactly two tables: team_space_plan_items and the audit log.
 *
 * AUTHORISATION. Every export re-derives the caller from auth.getUser() through
 * getMyTeamSpace() and reads only that space. No function here accepts a space
 * id, a member key or a role from a caller, so there is no id to tamper with —
 * a user who is in no space simply gets null.
 */

/** Whole-space plans only in v1 — see the note on getActivePlan(). */
const WHOLE_SPACE = null;

/** Paths top out at 5 steps; the hand-picked mix gets the same ceiling + 1. */
export const MAX_PLAN_DEPARTMENTS = 6;

/**
 * How far ahead a target date may sit. Two competition seasons is already more
 * runway than any real team plans with, and a bound keeps the date field from
 * being used as a scratchpad. Shared by the date input's `max` and the server
 * action's validation so the UI can never offer a value the action rejects.
 */
export const MAX_DUE_DAYS = 180;

export type PlanDept = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  lessonCount: number;
  /** Copy from the curated route explaining why this stop is on the route. */
  note: string | null;
  /** The route's own label for this stop, when the plan came from a path. */
  label: string | null;
};

export type PlanPath = {
  slug: string;
  title: string;
  description: string;
  icon: string;
  color: string;
};

export type ActivePlan = {
  /** Display-only. Derived name, never anything a human typed. */
  teamName: string;
  teamNumber: number;
  /** The viewer's own standing — decides whether the editor renders at all. */
  myRole: "lead" | "member";
  /** null when the lead hand-picked departments rather than a curated route. */
  path: PlanPath | null;
  departments: PlanDept[];
  /** ISO date (YYYY-MM-DD) or null. A TARGET, never a deadline. */
  dueOn: string | null;
  /**
   * The same date, formatted here on the server. Both surfaces that render it
   * are downstream of a client boundary, and a locale-dependent format run
   * during hydration is a mismatch waiting to happen — so it is formatted once,
   * with an explicit locale, and travels as a plain string.
   */
  dueLabel: string | null;
  /** Purely informational: the UI de-escalates when true, it never escalates. */
  dueIsPast: boolean;
  assignedAt: string;
  /**
   * Changes whenever the plan changes, so a member who dismissed the last plan
   * still meets the next one. Deliberately id-free: it is written to
   * localStorage, and no space id, user id or member key may ever live there.
   */
  stamp: string;
};

/** Today in UTC as YYYY-MM-DD — the same shape `due_on` comes back in. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** `todayIso()` shifted by whole days. Used for the date input's min/max. */
export function isoDayFromNow(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Explicit "en-US" and midday UTC. The locale is pinned so the string is
 * identical wherever it is produced, and midday sidesteps the classic date-only
 * timezone rollover that renders "Nov 3" as "Nov 2" west of Greenwich.
 */
export function formatPlanDue(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** The viewer's own space, plus whether they can edit the plan. */
export type PlanContext = {
  teamName: string;
  teamNumber: number;
  myRole: "lead" | "member";
};

export async function getPlanContext(): Promise<PlanContext | null> {
  const space = await getMyTeamSpace();
  if (!space) return null;
  return {
    teamName: space.name,
    teamNumber: space.teamNumber,
    myRole: space.myRole,
  };
}

/**
 * The space's current plan, or null.
 *
 * v1 reads WHOLE-SPACE items only (`user_id is null`). The table supports
 * per-member items and the schema keeps that door open, but singling one member
 * out is the point at which a suggestion starts to read as an instruction
 * aimed at a specific child, so no UI writes them and this read ignores them.
 */
export async function getActivePlan(): Promise<ActivePlan | null> {
  const space = await getMyTeamSpace();
  if (!space) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("team_space_plan_items")
    // Explicit column list, hand-mapped below. Never select('*') and never
    // spread a row: the admin client bypasses the column grants that keep
    // private fields off client surfaces.
    .select("id, department_id, path_slug, due_on, assigned_at")
    .eq("space_id", space.id)
    .is("user_id", WHOLE_SPACE)
    .order("assigned_at", { ascending: true });

  const rows = (data ?? []) as {
    id: string;
    department_id: string;
    path_slug: string | null;
    due_on: string | null;
    assigned_at: string;
  }[];
  if (rows.length === 0) return null;

  const departments = await getDepartments().catch(() => []);
  const byId = new Map(departments.map((d) => [d.id, d]));

  // A plan is written in one statement, so every row carries the same slug and
  // date. Reading the first non-null of each is resilient to a partial write.
  const pathSlug = rows.find((r) => r.path_slug)?.path_slug ?? null;
  const dueOn = rows.find((r) => r.due_on)?.due_on ?? null;
  const assignedAt = rows.reduce(
    (acc, r) => (r.assigned_at > acc ? r.assigned_at : acc),
    rows[0].assigned_at
  );

  const path = pathSlug ? getPathBySlug(pathSlug) : undefined;

  // Ordering. A curated route is a JOURNEY, so its own step order is the only
  // correct one. A hand-picked mix has no inherent order, so it falls back to
  // the catalog's sort_order (getDepartments is already ordered) — which is
  // deterministic, unlike assigned_at, which is identical across a single
  // INSERT.
  const stepIndex = new Map<string, number>();
  path?.steps.forEach((s, i) => stepIndex.set(s.deptSlug, i));
  const catalogIndex = new Map(departments.map((d, i) => [d.id, i]));

  const items: PlanDept[] = rows
    .map((r) => {
      const d = byId.get(r.department_id);
      if (!d) return null;
      const step = path?.steps.find((s) => s.deptSlug === d.slug);
      return {
        id: d.id,
        slug: d.slug,
        name: d.name,
        tagline: d.tagline,
        lessonCount: d.lessonCount,
        note: step?.note ?? null,
        label: step?.label ?? null,
      };
    })
    .filter((d): d is PlanDept => d !== null)
    .sort((a, b) => {
      const ai = stepIndex.get(a.slug);
      const bi = stepIndex.get(b.slug);
      if (ai !== undefined && bi !== undefined) return ai - bi;
      return (catalogIndex.get(a.id) ?? 0) - (catalogIndex.get(b.id) ?? 0);
    });

  if (items.length === 0) return null;

  return {
    teamName: space.name,
    teamNumber: space.teamNumber,
    myRole: space.myRole,
    path: path
      ? {
          slug: path.slug,
          title: path.title,
          description: path.description,
          icon: path.icon,
          color: path.color,
        }
      : null,
    departments: items,
    dueOn,
    dueLabel: dueOn ? formatPlanDue(dueOn) : null,
    dueIsPast: dueOn ? dueOn < todayIso() : false,
    assignedAt,
    stamp: `${assignedAt}~${dueOn ?? "-"}~${pathSlug ?? "custom"}~${items.length}`,
  };
}

/**
 * The CALLER'S OWN per-department completion. Read under the caller's own RLS
 * with their own session — never the admin client, and never for anyone else.
 * This is what lets a member see how far along the suggestion they are without
 * anybody else's progress entering the page.
 */
export async function getMyDeptProgress(): Promise<
  Record<string, { done: number; total: number }>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const [lessonsRes, doneRes] = await Promise.all([
    supabase.from("lessons").select("id, modules(department_id)"),
    supabase.from("lesson_progress").select("lesson_id").eq("user_id", user.id),
  ]);

  const completed = new Set(
    ((doneRes.data ?? []) as { lesson_id: string }[]).map((r) => r.lesson_id)
  );
  const out: Record<string, { done: number; total: number }> = {};
  for (const l of (lessonsRes.data ?? []) as {
    id: string;
    modules: { department_id?: string } | null;
  }[]) {
    const dept = l.modules?.department_id;
    if (!dept) continue;
    out[dept] ??= { done: 0, total: 0 };
    out[dept].total += 1;
    if (completed.has(l.id)) out[dept].done += 1;
  }
  return out;
}

/** The five curated routes, shaped for the picker. Pure catalog, no user data. */
export function planPathOptions(): (PlanPath & {
  steps: { slug: string; label: string }[];
  outcomes: string[];
})[] {
  return PATHS.map((p) => ({
    slug: p.slug,
    title: p.title,
    description: p.description,
    icon: p.icon,
    color: p.color,
    steps: p.steps.map((s) => ({ slug: s.deptSlug, label: s.label })),
    outcomes: p.outcomes,
  }));
}
