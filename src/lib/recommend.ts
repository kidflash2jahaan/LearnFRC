import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  getDepartments,
  getDepartmentBySlug,
  getLessonContent,
  type DeptWithModules,
} from "@/lib/queries";
import { getPathBySlug } from "@/lib/paths-data";
import { deptMeta } from "@/lib/departments";

/**
 * FIRST-RUN RECOMMENDATION ENGINE
 * ==============================
 *
 * Turns "394 lessons across 11 departments" into ONE named next lesson plus a
 * five-lesson plan, chosen by a single question the learner answers once.
 *
 * WHY THIS SHAPE — every number below is measured, not assumed:
 *
 *  - 45% of accounts (156 of 347) never complete a single lesson, and the
 *    completion step itself is 97.7%. Everything is lost BEFORE the quiz, on
 *    the choosing. The fix is therefore not more content or an easier quiz, it
 *    is removing the choice.
 *
 *  - The magic number is FIVE lessons in the first seven days: 21.4% of
 *    learners who reach 5 are still completing lessons on days 8-28, against
 *    3.7% of those who do not (Fisher p=5.2e-5), and d21 survival is 32% vs 6%
 *    (5.1x). Critically, 1-4 lessons is worth NOTHING over zero — d21 survival
 *    is 6% / 4% / 8% / 5% for 0 / 1 / 2 / 3-4 lessons, then jumps to 35% at
 *    5-9. The curve is a step function, so the plan is exactly five long. Not
 *    three, not ten. See STARTER_TARGET.
 *
 *  - Landing on a lesson page produces a median of 22 lessons completed
 *    against 1 for landing on the dashboard, so the goal answer routes
 *    straight into a lesson rather than into another chooser.
 *
 * WHAT THE ANSWER ACTUALLY CHANGES. Every curated path in `paths-data.ts`
 * opens on `getting-started` (deliberately — that department's entry lesson
 * activates at 70.6% and is the most-viewed page on the site), so lesson 1 is
 * the same whoever you are. The answer changes lessons 2-5: the plan takes the
 * first lesson from each stop on the chosen route in turn, so a programmer is
 * inside Programming by lesson 2 instead of lesson 29. That matters most for
 * the channel that converts worst — Chief Delphi is the largest identified
 * source (61 confirmed users) at 59% activation and a median of 3 lessons;
 * those are people with existing FRC context who do not need five straight
 * lessons of "what is FIRST".
 *
 * NO PARALLEL TAXONOMY. The five goals map 1:1 onto the five existing
 * `LearningPath`s. This module adds no new tracks, no new ordering concept and
 * no new content — it reads `PATHS` and resolves it down to lessons, which is
 * the one thing the /paths feature never did (every step there links to a
 * department index, so following a path still lands you on a chooser).
 */

/** Cookie holding the answered goal id. Server-read only, so the rendered tree
 *  never depends on client storage (hydration contract). */
export const START_GOAL_COOKIE = "lf_goal";

/** A season is ~5 months; a year keeps the answer through one whole cycle. */
export const START_GOAL_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The plan is FIVE lessons because five is the measured retention threshold
 * (21.4% vs 3.7% for days 8-28; 5.1x d21 survival). Shortening it to three
 * would celebrate a milestone the data says is worthless; lengthening it puts
 * the finish line past where the population dies.
 */
export const STARTER_TARGET = 5;

/* ------------------------------------------------------------------ */
/*  The one question                                                    */
/* ------------------------------------------------------------------ */

export type StartGoal = {
  id: string;
  /** What the learner DOES on their team — not the path's marketing name. */
  label: string;
  blurb: string;
  /** Key into the ICONS map in @/lib/icon-map (never pass a component). */
  iconName: string;
  /** The curated path in @/lib/paths-data this answer resolves to. */
  pathSlug: string;
};

/**
 * Five answers, one per curated path. "Brand new" leads because it is both the
 * modal answer for this audience and the safe default — 328 of 347 accounts are
 * role=student and all 156 dead accounts are students.
 */
export const START_GOALS: StartGoal[] = [
  {
    id: "new",
    label: "I'm brand new",
    blurb: "Rookie, or still working out where you fit.",
    iconName: "Rocket",
    pathSlug: "new-member-onboarding",
  },
  {
    id: "code",
    label: "Programming & controls",
    blurb: "Robot code, sensors, autonomous.",
    iconName: "Code2",
    pathSlug: "become-a-robot-programmer",
  },
  {
    id: "build",
    label: "Build, CAD & electrical",
    blurb: "Designing, fabricating and wiring the robot.",
    iconName: "Wrench",
    pathSlug: "build-and-design-track",
  },
  {
    id: "impact",
    label: "Business, media & outreach",
    blurb: "Sponsors, storytelling, the Impact Award.",
    iconName: "Trophy",
    pathSlug: "win-the-impact-award",
  },
  {
    id: "gameday",
    label: "Scouting, strategy & drive team",
    blurb: "Everything that happens at the competition.",
    iconName: "Gamepad2",
    pathSlug: "game-day-ready",
  },
];

export const DEFAULT_GOAL_ID = "new";

export function goalById(id: string | null | undefined): StartGoal | null {
  if (!id) return null;
  return START_GOALS.find((g) => g.id === id) ?? null;
}

/** The answer, or null if this learner has never been asked. */
export async function readStartGoalId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(START_GOAL_COOKIE)?.value;
  return goalById(raw)?.id ?? null;
}

/* ------------------------------------------------------------------ */
/*  Route + plan shapes (all plain data — safe to hand to any child)    */
/* ------------------------------------------------------------------ */

/** One department stop on a route, with the real department name. */
export type RouteStop = {
  slug: string;
  name: string;
  /** Neon accent from @/lib/departments — the site-wide department identity. */
  accent: string;
  iconName: string;
  /** The curated one-line reason this stop is on the route. */
  label: string;
};

export type GoalOption = StartGoal & {
  pathTitle: string;
  pathColor: string;
  pathIconName: string;
  /** First declared outcome of the path — the concrete payoff. */
  outcome: string;
  route: RouteStop[];
};

export type PlanLesson = {
  id: string;
  title: string;
  href: string;
  deptSlug: string;
  deptName: string;
  accent: string;
  done: boolean;
};

export type StarterPlan = {
  goalId: string;
  goalLabel: string;
  pathSlug: string;
  pathTitle: string;
  pathColor: string;
  pathIconName: string;
  route: RouteStop[];
  /** Exactly STARTER_TARGET lessons (fewer only if the catalogue is smaller). */
  lessons: PlanLesson[];
  /** The single next action. Null only when the whole plan is finished. */
  next: {
    title: string;
    href: string;
    deptName: string;
    accent: string;
    /** Real read time from the word count — see the note in resolveReadMins. */
    readMins: number;
    /** 1-based position within the plan. */
    step: number;
  } | null;
  doneCount: number;
  /** False when the learner has not answered the question yet (default plan). */
  tailored: boolean;
};

/* ------------------------------------------------------------------ */
/*  Data                                                                */
/* ------------------------------------------------------------------ */

type OrderedLesson = {
  id: string;
  title: string;
  href: string;
  deptSlug: string;
  deptName: string;
  accent: string;
};

/** Modules and lessons already arrive sorted from getDepartmentBySlug(). */
function orderedLessons(dept: DeptWithModules): OrderedLesson[] {
  const accent = deptMeta(dept.slug).color;
  const out: OrderedLesson[] = [];
  for (const m of dept.modules) {
    for (const l of m.lessons) {
      out.push({
        id: l.id,
        title: l.title,
        href: `/guides/${dept.slug}/${m.slug}/${l.slug}`,
        deptSlug: dept.slug,
        deptName: dept.name,
        accent,
      });
    }
  }
  return out;
}

/**
 * Completed lesson ids for one learner.
 *
 * PAGED, not a plain .select(): PostgREST caps a response at 1000 rows and
 * truncates SILENTLY. A single learner is bounded by the 394-lesson catalogue
 * today (the deepest account sits at 257 rows), so this cannot truncate yet —
 * but a truncated read here would mark finished lessons as unfinished and send
 * a veteran back to lesson one, and that bug has already shipped twice in this
 * codebase. Same loop as getWeeklyLeaderboard / getTeamByNumber in queries.ts.
 */
async function completedLessonIdsPaged(userId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const out = new Set<string>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", userId)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    const chunk = (data ?? []) as { lesson_id: string }[];
    for (const r of chunk) out.add(r.lesson_id);
    if (chunk.length < PAGE) break;
  }
  return out;
}

/**
 * The five goal tiles, with each route's real department names.
 *
 * One cached catalogue query (`getDepartments`) supplies the names — the goal
 * screen never loads a department tree, so it stays cheap enough to be the
 * post-signup landing page.
 */
export async function getGoalOptions(): Promise<GoalOption[]> {
  const departments = await getDepartments().catch(() => []);
  const nameBySlug = new Map(departments.map((d) => [d.slug, d.name]));

  return START_GOALS.flatMap((goal) => {
    const path = getPathBySlug(goal.pathSlug);
    if (!path) return [];
    const seen = new Set<string>();
    const route: RouteStop[] = [];
    for (const step of path.steps) {
      if (seen.has(step.deptSlug)) continue;
      seen.add(step.deptSlug);
      const meta = deptMeta(step.deptSlug);
      route.push({
        slug: step.deptSlug,
        name: nameBySlug.get(step.deptSlug) ?? step.label,
        accent: meta.color,
        iconName: meta.icon,
        label: step.label,
      });
    }
    return [
      {
        ...goal,
        pathTitle: path.title,
        pathColor: path.color,
        pathIconName: path.icon,
        outcome: path.outcomes[0] ?? path.description,
        route,
      },
    ];
  });
}

/**
 * The declared `estimated_minutes` column is inflated roughly 14x against the
 * real text (the first lesson a rookie meets claims 25 minutes for a ~2-minute
 * read), and a 25-minute price tag at the decision point is a reason to leave.
 * Derive from the word count instead, using the exact formula the lesson page
 * prints, so the number on the card is the number on the page.
 */
async function resolveReadMins(lessonId: string): Promise<number> {
  const body = await getLessonContent(lessonId).catch(() => null);
  const words = body?.content?.split(/\s+/).length ?? 0;
  return Math.max(1, Math.round(words / 200));
}

/**
 * Build the five-lesson plan for one learner and one answer.
 *
 * SELECTION RULE: walk the route's departments in the curated order, taking one
 * lesson from each in turn, and repeat until the plan holds five. Pass one
 * therefore gives one lesson per stop — the whole route sampled inside the
 * first five lessons, which is what makes answering the question visibly worth
 * it. Four-stop paths (Impact, Game Day) fill the fifth slot from the second
 * pass, which lands back on the fundamentals.
 *
 * Completed lessons stay in the plan as ticked rows rather than being replaced:
 * a plan that silently reshuffles under you never reads as progress, and the
 * five ticks are the whole point.
 */
export async function getStarterPlan(
  userId: string | null,
  goalId: string | null
): Promise<StarterPlan | null> {
  const goal = goalById(goalId) ?? goalById(DEFAULT_GOAL_ID);
  if (!goal) return null;
  const path = getPathBySlug(goal.pathSlug);
  if (!path) return null;

  const routeSlugs = [...new Set(path.steps.map((s) => s.deptSlug))];
  const [depts, completed] = await Promise.all([
    Promise.all(
      routeSlugs.map((s) => getDepartmentBySlug(s).catch(() => null))
    ),
    userId ? completedLessonIdsPaged(userId) : Promise.resolve(new Set<string>()),
  ]);

  const live = depts.filter((d): d is DeptWithModules => !!d);
  if (!live.length) return null;

  const nameBySlug = new Map(live.map((d) => [d.slug, d.name]));
  const route: RouteStop[] = routeSlugs.flatMap((slug) => {
    const name = nameBySlug.get(slug);
    if (!name) return [];
    const step = path.steps.find((s) => s.deptSlug === slug);
    const meta = deptMeta(slug);
    return [
      {
        slug,
        name,
        accent: meta.color,
        iconName: meta.icon,
        label: step?.label ?? name,
      },
    ];
  });

  // Queues in route order; `live` follows routeSlugs order because Promise.all
  // preserves it and only nulls are dropped.
  const queues = live.map(orderedLessons);
  const picked: OrderedLesson[] = [];
  for (let round = 0; picked.length < STARTER_TARGET; round++) {
    let advanced = false;
    for (const q of queues) {
      if (picked.length >= STARTER_TARGET) break;
      const l = q[round];
      if (!l) continue;
      advanced = true;
      picked.push(l);
    }
    if (!advanced) break; // every queue is exhausted — catalogue is smaller than 5
  }

  const lessons: PlanLesson[] = picked.map((l) => ({
    ...l,
    done: completed.has(l.id),
  }));

  // The single next action: the first unticked row of the plan. If the plan is
  // fully ticked, continue down the route rather than dead-ending.
  let nextIndex = lessons.findIndex((l) => !l.done);
  let nextLesson: OrderedLesson | null =
    nextIndex >= 0 ? picked[nextIndex] : null;
  if (!nextLesson) {
    const pickedIds = new Set(picked.map((l) => l.id));
    for (const q of queues) {
      const found = q.find((l) => !completed.has(l.id) && !pickedIds.has(l.id));
      if (found) {
        nextLesson = found;
        nextIndex = lessons.length; // past the plan
        break;
      }
    }
  }

  return {
    goalId: goal.id,
    goalLabel: goal.label,
    pathSlug: path.slug,
    pathTitle: path.title,
    pathColor: path.color,
    pathIconName: path.icon,
    route,
    lessons,
    next: nextLesson
      ? {
          title: nextLesson.title,
          href: nextLesson.href,
          deptName: nextLesson.deptName,
          accent: nextLesson.accent,
          readMins: await resolveReadMins(nextLesson.id),
          step: nextIndex + 1,
        }
      : null,
    doneCount: lessons.filter((l) => l.done).length,
    tailored: !!goalById(goalId),
  };
}
