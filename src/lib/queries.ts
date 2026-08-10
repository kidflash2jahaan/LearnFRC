import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Department,
  Module,
  Lesson,
  Profile,
  FlatLesson,
  TeamMemberProgress,
  Resource,
} from "@/lib/types";
import type { Article } from "@/lib/blog-data";

/**
 * Catalog rows as Postgres returns them. The shared content types are the
 * render-facing shape and omit `created_at`, but `departments` / `modules` /
 * `lessons` all have one — the sitemap needs it to emit a real `<lastmod>` that
 * doesn't move on every regeneration.
 */
export type LessonRow = Lesson & { created_at?: string };
export type ModuleRow = Omit<Module, "lessons"> & {
  created_at?: string;
  lessons: LessonRow[];
};
export type DeptWithModules = Department & {
  created_at?: string;
  modules: ModuleRow[];
};

// Revalidation windows (seconds). The catalog (departments / modules / lessons)
// changes only via the admin panel, so an hour is plenty; the leaderboard is a
// live-ish aggregate that's identical for every anonymous viewer, so a short
// window keeps it fresh without re-querying every profile on every page view.
const CATALOG_TTL = 86400; // 24h — content edits push live on-demand via /api/revalidate (revalidateTag), so this is only a slow background floor. Was 1h, which forced hourly page ISR-writes + DB refetches for content that rarely changes.
const LEADERBOARD_TTL = 300; // 5 minutes

// Explicit column lists — never `select("*")`. List views in particular must
// never pull `lessons.content` (the heavy per-lesson markdown).
// `created_at` rides along on all three catalog tables: it's the only real
// per-row timestamp they carry, and the sitemap uses it for `<lastmod>`.
const DEPT_COLS =
  "id, slug, name, tagline, description, difficulty, estimated_hours, what_youll_learn, prerequisites, tools, sources, accent, icon, sort_order, created_at";
const MODULE_COLS =
  "id, department_id, slug, title, overview, sort_order, is_prerequisite, created_at";
// Lessons WITHOUT `content` / `key_takeaways` / `resources` / `quiz` — enough to
// render module/lesson lists and build lesson navigation. The heavy fields are
// fetched per-lesson on demand via getLessonContent().
const LESSON_LIST_COLS =
  "id, module_id, slug, title, summary, estimated_minutes, sort_order, created_at";
// Profile columns needed by the leaderboard/podium (drops the free-text `bio`).
// No `full_name`: the board shows usernames only, and full_name is PII the
// public/anon API role can no longer read anyway.
const PROFILE_BOARD_COLS =
  "id, username, avatar_url, team_number, role, xp, hide_name, created_at";

function sortModules(modules: ModuleRow[]): ModuleRow[] {
  return [...(modules ?? [])]
    .sort((a, b) => {
      // Prerequisite modules always come first.
      const ap = a.is_prerequisite ? 0 : 1;
      const bp = b.is_prerequisite ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return a.sort_order - b.sort_order;
    })
    .map((m) => ({
      ...m,
      lessons: [...(m.lessons ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    }));
}

export function flattenLessons(dept: DeptWithModules): FlatLesson[] {
  const out: FlatLesson[] = [];
  for (const m of dept.modules) {
    for (const l of m.lessons) {
      out.push({
        ...l,
        moduleTitle: m.title,
        moduleSlug: m.slug,
        departmentSlug: dept.slug,
        departmentName: dept.name,
      });
    }
  }
  return out;
}

export type DepartmentSummary = Department & {
  moduleCount: number;
  lessonCount: number;
};

/**
 * Department cards for every list view (home, guides index, paths, for-teams).
 * Durably cached — the catalog is the same for everyone and rarely changes.
 * Only pulls department fields + module/lesson IDs for the counts (no content).
 */
export const getDepartments = unstable_cache(
  async (): Promise<DepartmentSummary[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("departments")
      .select(`${DEPT_COLS}, modules(id, lessons(id))`)
      .order("sort_order");
    if (error) throw error;
    return (data ?? []).map((d: Record<string, unknown>) => {
      const modules = (d.modules as { lessons?: unknown[] }[]) ?? [];
      const moduleCount = modules.length;
      const lessonCount = modules.reduce(
        (s, m) => s + (m.lessons?.length ?? 0),
        0
      );
      const rest = { ...d };
      delete rest.modules;
      return { ...(rest as unknown as Department), moduleCount, lessonCount };
    });
  },
  ["departments-summary"],
  { revalidate: CATALOG_TTL, tags: ["catalog", "departments"] }
);

/**
 * All blog articles, newest first — now sourced from the DB (so they can be
 * edited via the same review flow as lessons) but returned in the exact
 * `Article` shape the blog pages already expect, so rendering + SEO are
 * unchanged. Cached under the `catalog` tag; accepting an article edit
 * revalidates it.
 */
export const getArticles = unstable_cache(
  async (): Promise<Article[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("articles")
      .select("id, slug, title, description, keywords, date, read_mins, content")
      .order("date", { ascending: false })
      .order("sort_order", { ascending: true });
    type Row = {
      id: string;
      slug: string;
      title: string;
      description: string;
      keywords: string[] | null;
      date: string;
      read_mins: number;
      content: string;
    };
    return ((data as unknown as Row[]) ?? []).map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      description: a.description,
      keywords: a.keywords ?? [],
      date: a.date,
      readMins: a.read_mins,
      content: a.content,
    }));
  },
  ["articles-all"],
  { revalidate: CATALOG_TTL, tags: ["catalog", "articles"] }
);

/**
 * A department with its modules and lessons — WITHOUT lesson content. Powers
 * the department page (module/lesson listing) and lesson-page navigation.
 * Durably cached per slug. The heavy lesson body is loaded via
 * getLessonContent() only on the lesson page that actually renders it.
 */
export const getDepartmentBySlug = cache(
  unstable_cache(
    async (slug: string): Promise<DeptWithModules | null> => {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from("departments")
        .select(`${DEPT_COLS}, modules(${MODULE_COLS}, lessons(${LESSON_LIST_COLS}))`)
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...(data as unknown as Department & { created_at?: string }),
        modules: sortModules(
          (data as unknown as { modules: ModuleRow[] }).modules ?? []
        ),
      };
    },
    ["department-by-slug"],
    { revalidate: CATALOG_TTL, tags: ["catalog", "departments"] }
  )
);

/**
 * The heavy body of a single lesson (markdown content, takeaways, resources,
 * quiz). Fetched only on the lesson page, keyed and cached per lesson id so the
 * full-content query runs at most once per lesson per revalidation window.
 */
export type LessonContent = Pick<
  Lesson,
  "id" | "content" | "key_takeaways" | "resources" | "quiz"
>;

export const getLessonContent = unstable_cache(
  async (lessonId: string): Promise<LessonContent | null> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("lessons")
      .select("id, content, key_takeaways, resources, quiz")
      .eq("id", lessonId)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as LessonContent) ?? null;
  },
  ["lesson-content"],
  { revalidate: CATALOG_TTL, tags: ["catalog", "lessons"] }
);

/** Per-department cited sources for the /resources page. Cached — public data. */
export type DepartmentSources = { name: string; slug: string; sources: Resource[] };

export const getDepartmentSources = unstable_cache(
  async (): Promise<DepartmentSources[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("departments")
      .select("name, slug, sources")
      .order("sort_order");
    return (data ?? []).map((d) => ({
      name: d.name as string,
      slug: d.slug as string,
      sources: (d.sources as Resource[]) ?? [],
    }));
  },
  ["department-sources"],
  { revalidate: CATALOG_TTL, tags: ["catalog", "departments"] }
);

export const getAllDepartmentSlugs = unstable_cache(
  async (): Promise<string[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase.from("departments").select("slug");
    return (data ?? []).map((d) => d.slug as string);
  },
  ["department-slugs"],
  { revalidate: CATALOG_TTL, tags: ["catalog", "departments"] }
);

// ─── Per-user reads — always fresh, never cached (tiny, session-scoped) ───

export async function getCompletedLessonIds(
  userId: string
): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_progress")
    .select("lesson_id")
    .eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.lesson_id as string));
}

export async function getBookmarkedLessonIds(
  userId: string
): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookmarks")
    .select("lesson_id")
    .eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.lesson_id as string));
}

export async function getProfile(userId: string): Promise<Profile | null> {
  // Own-profile loader (getSession passes the signed-in user's own id). Uses the
  // service-role client because `full_name` is now readable only server-side —
  // the anon/authenticated API roles are barred from SELECTing it (PII lockdown).
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, username, full_name, avatar_url, team_number, bio, role, xp, hide_name, created_at"
    )
    .eq("id", userId)
    .maybeSingle();
  return (data as Profile) ?? null;
}

/** Site-wide catalog counts for the home hero. Count-only (no row egress), cached. */
export const getOverviewStats = unstable_cache(
  async () => {
    const supabase = createPublicClient();
    const [depts, modules, lessons, learners] = await Promise.all([
      supabase.from("departments").select("*", { count: "exact", head: true }),
      supabase.from("modules").select("*", { count: "exact", head: true }),
      supabase.from("lessons").select("*", { count: "exact", head: true }),
      // count only (no full_name egress; "*" would touch the now-restricted column)
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);
    return {
      deptCount: depts.count ?? 0,
      moduleCount: modules.count ?? 0,
      lessonCount: lessons.count ?? 0,
      learners: learners.count ?? 0,
    };
  },
  ["overview-stats"],
  { revalidate: CATALOG_TTL, tags: ["catalog"] }
);

/**
 * All-time leaderboard — same for every viewer, so it's cached briefly. The
 * page applies per-user "you" highlighting afterward from the (uncached)
 * session, so caching the aggregate is safe.
 */
export const getLeaderboard = unstable_cache(
  async (limit = 25): Promise<(Profile & { lessons: number })[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("profiles")
      .select(PROFILE_BOARD_COLS)
      .order("xp", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(limit);
    const profs = (data as Profile[]) ?? [];
    if (!profs.length) return [];
    // XP no longer equals lessons*10 (streak multiplier), so count real
    // completions. lesson_progress is per-user RLS-locked → use the admin client.
    const admin = createAdminClient();
    // lesson_progress holds one row per completed lesson, but the table can
    // exceed PostgREST's 1000-row response cap — a plain .select() silently
    // truncates and undercounts, which is what made the all-time board show
    // FEWER lessons than the weekly board. Page through in 1000-row windows
    // (stable-ordered by id) and count DISTINCT lessons per user.
    const ids = profs.map((p) => p.id);
    const lessonsByUser: Record<string, Set<string>> = {};
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data: lp } = await admin
        .from("lesson_progress")
        .select("user_id, lesson_id")
        .in("user_id", ids)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      const chunk = (lp ?? []) as { user_id: string; lesson_id: string }[];
      for (const r of chunk)
        (lessonsByUser[r.user_id] ??= new Set<string>()).add(r.lesson_id);
      if (chunk.length < PAGE) break;
    }
    return profs.map((p) => ({ ...p, lessons: lessonsByUser[p.id]?.size ?? 0 }));
  },
  ["leaderboard-all-time"],
  { revalidate: LEADERBOARD_TTL, tags: ["leaderboard"] }
);

export type WeeklyEntry = Profile & { weeklyXp: number; weeklyLessons: number };

/** Leaderboard by XP earned in the last 7 days — always gives newcomers a shot. */
export const getWeeklyLeaderboard = unstable_cache(
  async (limit = 50): Promise<WeeklyEntry[]> => {
    // lesson_progress is RLS-protected per-user (lp_select_own), so a normal
    // client would only count the current user. Use the service-role client to
    // aggregate everyone's recent activity for the public weekly ranking.
    const supabase = createAdminClient();
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    // Same 1000-row cap applies to a busy week, so page through here too and
    // count DISTINCT lessons per user (XP is the sum of awards, which can span
    // multiple rows legitimately).
    const lessonsByUser: Record<string, Set<string>> = {};
    const xpByUser: Record<string, number> = {};
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data: lp } = await supabase
        .from("lesson_progress")
        .select("user_id, lesson_id, xp_awarded")
        .gte("completed_at", since)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      const chunk = (lp ?? []) as {
        user_id: string;
        lesson_id: string;
        xp_awarded: number | null;
      }[];
      for (const r of chunk) {
        (lessonsByUser[r.user_id] ??= new Set<string>()).add(r.lesson_id);
        xpByUser[r.user_id] = (xpByUser[r.user_id] || 0) + (r.xp_awarded ?? 10);
      }
      if (chunk.length < PAGE) break;
    }
    const ids = Object.keys(lessonsByUser);
    if (!ids.length) return [];
    const { data: profs } = await supabase
      .from("profiles")
      .select(PROFILE_BOARD_COLS)
      .in("id", ids);
    return ((profs as Profile[]) ?? [])
      .map((p) => ({
        ...p,
        weeklyLessons: lessonsByUser[p.id]?.size ?? 0,
        weeklyXp: xpByUser[p.id] ?? 0,
      }))
      .sort((a, b) => b.weeklyXp - a.weeklyXp || b.xp - a.xp)
      .slice(0, limit);
  },
  ["leaderboard-weekly"],
  { revalidate: LEADERBOARD_TTL, tags: ["leaderboard"] }
);

export type TeamEntry = {
  team_number: number;
  totalXp: number;
  members: number;
};

/** Leaderboard of teams ranked by their members' combined XP. Cached briefly. */
export const getTeamLeaderboard = unstable_cache(
  async (limit = 50): Promise<TeamEntry[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("profiles")
      .select("team_number, xp")
      .not("team_number", "is", null);
    const teams: Record<number, TeamEntry> = {};
    for (const p of (data ?? []) as { team_number: number; xp: number }[]) {
      const t = p.team_number;
      if (t == null) continue;
      teams[t] = teams[t] || { team_number: t, totalXp: 0, members: 0 };
      teams[t].totalXp += p.xp || 0;
      teams[t].members += 1;
    }
    return Object.values(teams)
      .sort((a, b) => b.totalXp - a.totalXp || b.members - a.members)
      .slice(0, limit);
  },
  ["leaderboard-teams"],
  { revalidate: LEADERBOARD_TTL, tags: ["leaderboard"] }
);

/**
 * Auto-team view: everyone who signed up with the same FRC team number, plus
 * each member's progress. Uses the service-role client because lesson_progress
 * is per-user RLS-locked. By design, teammates can see each other's progress
 * (disclosed in the Privacy Policy); members are shown by username only — no
 * real names are ever exposed on public surfaces.
 *
 * Left uncached: it shows live per-member progress and isn't on the hot public
 * catalog path.
 */
export async function getTeamByNumber(
  teamNumber: number
): Promise<{ teamNumber: number; totalLessons: number; members: TeamMemberProgress[] }> {
  const admin = createAdminClient();
  const [{ count: totalLessons }, { data: profs }] = await Promise.all([
    admin.from("lessons").select("*", { count: "exact", head: true }),
    admin
      .from("profiles")
      // Admin client bypasses RLS *and* the column grants that keep `full_name`
      // off public surfaces, so this select must never ask for it. `full_name`
      // and `hide_name` were fetched here but never read — one careless
      // `{...p}` spread below would have leaked real names for a whole team.
      .select("id, username, avatar_url, xp, created_at")
      .eq("team_number", teamNumber),
  ]);
  const rows = (profs as Profile[]) ?? [];
  const ids = rows.map((p) => p.id);
  const counts: Record<string, number> = {};
  const last: Record<string, string> = {};
  if (ids.length) {
    // PAGED, not a plain .select(): PostgREST caps a response at 1000 rows and
    // truncates SILENTLY. Team 447 is already at 826 lesson_progress rows across
    // 15 members, so a single read starts dropping completions the moment that
    // team crosses the cap — and it would drop MORE as the team did more work,
    // which is the exact inversion this page exists to show. Same trap the
    // all-time leaderboard above already documents.
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data: lp } = await admin
        .from("lesson_progress")
        .select("user_id, completed_at")
        .in("user_id", ids)
        .order("id")
        .range(from, from + PAGE - 1);
      const chunk = (lp ?? []) as { user_id: string; completed_at: string }[];
      for (const r of chunk) {
        counts[r.user_id] = (counts[r.user_id] ?? 0) + 1;
        if (!last[r.user_id] || r.completed_at > last[r.user_id])
          last[r.user_id] = r.completed_at;
      }
      if (chunk.length < PAGE) break;
    }
  }
  const members: TeamMemberProgress[] = rows
    .map((p) => ({
      userId: p.id,
      name: p.username || "Member",
      username: p.username,
      avatarUrl: p.avatar_url,
      role: "member",
      xp: p.xp ?? 0,
      completed: counts[p.id] ?? 0,
      lastActive: last[p.id] ?? null,
      joinedAt: p.created_at,
    }))
    .sort((a, b) => b.completed - a.completed || b.xp - a.xp);
  return { teamNumber, totalLessons: totalLessons ?? 0, members };
}

// ── Public contributions feed ────────────────────────────────────────────────
// A read-only, public view of community edit/lesson suggestions — what's open
// and what's been resolved — so anyone can see what's being improved (no more
// "black box"). Contributors are shown by USERNAME only, never real names.
export type PublicContribution = {
  id: string;
  kind: "edit" | "submission";
  targetTitle: string;
  targetPath: string | null;
  byUsername: string | null;
  note: string | null;
  date: string;
  status: "open" | "merged" | "declined";
};

type CEditRow = {
  id: string;
  content_type: string | null;
  lesson_id: string | null;
  article_id: string | null;
  editor_id: string;
  note: string | null;
  created_at: string;
  reviewed_at: string | null;
  status: string;
};
type CSubRow = {
  id: string;
  submitter_id: string;
  department_id: string;
  new_module_title: string | null;
  title: string;
  note: string | null;
  created_at: string;
  reviewed_at: string | null;
  status: string;
};
type LessonJoin = {
  id: string;
  slug: string;
  title: string;
  modules: { slug: string; departments: { slug: string } | null } | null;
};

const EDIT_FEED_COLS =
  "id, content_type, lesson_id, article_id, editor_id, note, created_at, reviewed_at, status";
const SUB_FEED_COLS =
  "id, submitter_id, department_id, new_module_title, title, note, created_at, reviewed_at, status";

function statusOf(s: string): PublicContribution["status"] {
  return s === "pending" ? "open" : s === "accepted" ? "merged" : "declined";
}

export const getPublicContributions = unstable_cache(
  async (): Promise<{ open: PublicContribution[]; resolved: PublicContribution[] }> => {
    const admin = createAdminClient();
    const [openEdits, openSubs, doneEdits, doneSubs] = await Promise.all([
      admin.from("content_edits").select(EDIT_FEED_COLS).eq("status", "pending").order("created_at", { ascending: false }).limit(60),
      admin.from("content_submissions").select(SUB_FEED_COLS).eq("status", "pending").order("created_at", { ascending: false }).limit(60),
      admin.from("content_edits").select(EDIT_FEED_COLS).in("status", ["accepted", "rejected"]).order("reviewed_at", { ascending: false }).limit(12),
      admin.from("content_submissions").select(SUB_FEED_COLS).in("status", ["accepted", "rejected"]).order("reviewed_at", { ascending: false }).limit(12),
    ]);

    const editRows = [
      ...((openEdits.data as unknown as CEditRow[]) ?? []),
      ...((doneEdits.data as unknown as CEditRow[]) ?? []),
    ];
    const subRows = [
      ...((openSubs.data as unknown as CSubRow[]) ?? []),
      ...((doneSubs.data as unknown as CSubRow[]) ?? []),
    ];

    const lessonIds = [...new Set(editRows.map((e) => e.lesson_id).filter(Boolean))] as string[];
    const articleIds = [...new Set(editRows.map((e) => e.article_id).filter(Boolean))] as string[];
    const userIds = [
      ...new Set([...editRows.map((e) => e.editor_id), ...subRows.map((s) => s.submitter_id)].filter(Boolean)),
    ] as string[];

    const [lz, az, uz] = await Promise.all([
      lessonIds.length
        ? admin.from("lessons").select("id, slug, title, modules(slug, departments(slug))").in("id", lessonIds)
        : Promise.resolve({ data: [] }),
      articleIds.length
        ? admin.from("articles").select("id, slug, title").in("id", articleIds)
        : Promise.resolve({ data: [] as { id: string; slug: string; title: string }[] }),
      userIds.length
        ? admin.from("profiles").select("id, username").in("id", userIds)
        : Promise.resolve({ data: [] as { id: string; username: string | null }[] }),
    ]);

    const lById = new Map(((lz.data as unknown as LessonJoin[]) ?? []).map((l) => [l.id, l]));
    const aById = new Map(
      ((az.data as { id: string; slug: string; title: string }[]) ?? []).map((a) => [a.id, a])
    );
    const uById = new Map(
      ((uz.data as { id: string; username: string | null }[]) ?? []).map((u) => [u.id, u.username])
    );

    const mapEdit = (e: CEditRow): PublicContribution => {
      let targetTitle = "content";
      let targetPath: string | null = null;
      if (e.content_type === "article") {
        const a = aById.get(e.article_id as string);
        targetTitle = a?.title ?? "an article";
        targetPath = a ? `/blog/${a.slug}` : null;
      } else {
        const l = lById.get(e.lesson_id as string);
        targetTitle = l?.title ?? "a lesson";
        const ds = l?.modules?.departments?.slug;
        const ms = l?.modules?.slug;
        targetPath = l && ds && ms ? `/guides/${ds}/${ms}/${l.slug}` : null;
      }
      return {
        id: e.id,
        kind: "edit",
        targetTitle,
        targetPath,
        byUsername: uById.get(e.editor_id) ?? null,
        note: e.note,
        date: (e.status === "pending" ? e.created_at : e.reviewed_at) ?? e.created_at,
        status: statusOf(e.status),
      };
    };
    const mapSub = (s: CSubRow): PublicContribution => ({
      id: s.id,
      kind: "submission",
      targetTitle: s.title,
      targetPath: null,
      byUsername: uById.get(s.submitter_id) ?? null,
      note: s.note ?? (s.new_module_title ? `Proposes a new module: ${s.new_module_title}` : null),
      date: (s.status === "pending" ? s.created_at : s.reviewed_at) ?? s.created_at,
      status: statusOf(s.status),
    });

    const byDateDesc = (a: PublicContribution, b: PublicContribution) => (a.date < b.date ? 1 : -1);
    const open = [
      ...((openEdits.data as unknown as CEditRow[]) ?? []).map(mapEdit),
      ...((openSubs.data as unknown as CSubRow[]) ?? []).map(mapSub),
    ].sort(byDateDesc);
    const resolved = [
      ...((doneEdits.data as unknown as CEditRow[]) ?? []).map(mapEdit),
      ...((doneSubs.data as unknown as CSubRow[]) ?? []).map(mapSub),
    ]
      .sort(byDateDesc)
      .slice(0, 15);

    return { open, resolved };
  },
  ["public-contributions"],
  { revalidate: 60, tags: ["contributions"] }
);

/** How many people a given user has referred. Per-user, uncached. */
export async function getReferralCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("referred_by", userId);
  return count ?? 0;
}

/**
 * Is this email already on the newsletter list? Uncached, head/count-only
 * (no rows fetched) so egress stays tiny — used to skip the post-lesson
 * newsletter prompt for people who already subscribed.
 */
export async function isEmailSubscribed(email: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("subscribers")
    .select("email", { count: "exact", head: true })
    .eq("email", email.trim().toLowerCase());
  return (count ?? 0) > 0;
}

/**
 * Site-wide XP totals for the leaderboard header — counts ALL learners, not
 * just the top 50 shown, so the numbers match the admin panel exactly. Same for
 * every viewer, so cached on the short leaderboard window.
 */
export const getXpTotals = unstable_cache(
  async (): Promise<{ learners: number; totalXp: number }> => {
    const supabase = createPublicClient();
    const { data } = await supabase.from("profiles").select("xp").gt("xp", 0);
    const rows = (data as { xp: number }[]) ?? [];
    return {
      learners: rows.length,
      totalXp: rows.reduce((s, r) => s + (r.xp || 0), 0),
    };
  },
  ["xp-totals"],
  { revalidate: LEADERBOARD_TTL, tags: ["leaderboard"] }
);

// ── Subteam (department) coverage ────────────────────────────────────────────
// FRC teams are split into subteams — mechanical, programming, electrical,
// business, drive team — and so is this site's catalog: one department per
// subteam. That makes department coverage the one team statistic a member can
// act on: "nobody on our team has touched Electrical" is a specific person to
// go ask, not a vague "invite your friends".
//
// PRIVACY: this path reads `lesson_progress` only (user_id + lesson_id) and the
// public catalog. It never touches `profiles`, so there is no way for it to leak
// `full_name` or an email — the caller joins these counts against the roster it
// already has from getTeamByNumber(), which is username/avatar only.

/**
 * Catalog index: which department every lesson belongs to, plus each
 * department's lesson count. ~394 entries, identical for every viewer, and only
 * changes when the catalog changes — so it rides the same `catalog` tag the
 * department list already invalidates on.
 */
const getLessonDeptIndex = unstable_cache(
  async (): Promise<{
    departments: {
      id: string;
      slug: string;
      name: string;
      accent: string;
      icon: string;
    }[];
    /** lesson id → department id */
    lessonDept: Record<string, string>;
    /** department id → lesson count */
    lessonCounts: Record<string, number>;
  }> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("departments")
      .select("id, slug, name, accent, icon, modules(id, lessons(id))")
      .order("sort_order");
    if (error) throw error;

    const departments: {
      id: string;
      slug: string;
      name: string;
      accent: string;
      icon: string;
    }[] = [];
    const lessonDept: Record<string, string> = {};
    const lessonCounts: Record<string, number> = {};

    for (const row of (data ?? []) as unknown as {
      id: string;
      slug: string;
      name: string;
      accent: string;
      icon: string;
      modules?: { id: string; lessons?: { id: string }[] }[];
    }[]) {
      departments.push({
        id: row.id,
        slug: row.slug,
        name: row.name,
        accent: row.accent,
        icon: row.icon,
      });
      let count = 0;
      for (const m of row.modules ?? []) {
        for (const l of m.lessons ?? []) {
          lessonDept[l.id] = row.id;
          count++;
        }
      }
      lessonCounts[row.id] = count;
    }
    return { departments, lessonDept, lessonCounts };
  },
  ["lesson-dept-index"],
  { revalidate: CATALOG_TTL, tags: ["catalog", "departments"] }
);

/** One subteam's coverage across a whole FRC team. */
export type SubteamCoverage = {
  slug: string;
  name: string;
  accent: string;
  icon: string;
  lessonCount: number;
  /** Distinct lessons finished by ANYONE on the team (not a sum — no double count). */
  teamCompleted: number;
  /** Members with ≥1 lesson finished here, most first. IDs only; join to the roster. */
  members: { userId: string; completed: number }[];
};

/**
 * How much of each subteam the given members cover between them.
 *
 * Takes user IDs rather than a team number so it composes with the roster
 * getTeamByNumber() already returned — one profiles read per page, not two —
 * and so this function never has any reason to open the profiles table.
 *
 * Uncached: per-team and it must move the moment a teammate finishes a lesson,
 * which is exactly the moment that makes the page worth reloading. The
 * expensive half (the catalog index) IS cached.
 */
export async function getTeamSubteamCoverage(
  userIds: string[]
): Promise<SubteamCoverage[]> {
  const { departments, lessonDept, lessonCounts } = await getLessonDeptIndex();

  // dept id → distinct lesson ids finished by the team
  const teamDone: Record<string, Set<string>> = {};
  // dept id → user id → lessons finished
  const perMember: Record<string, Record<string, number>> = {};

  // Bounded defensively: the largest real team is 15, but `.in()` builds a URL.
  const ids = userIds.slice(0, 200);
  if (ids.length) {
    // Cross-user read: lesson_progress is RLS-locked to its owner, so this has
    // to be the service-role client. Two columns, no PII.
    //
    // MUST page: PostgREST caps a response at 1000 rows and truncates silently.
    // A whole team's rows blow past that — the busiest team already sits at 826
    // of 394 lessons x 15 members — and a truncated read would quietly report
    // subteams as uncovered that the team has actually finished, which is the
    // exact opposite of what this board is for. Same trap documented on the
    // all-time leaderboard above.
    const admin = createAdminClient();
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data } = await admin
        .from("lesson_progress")
        .select("user_id, lesson_id")
        .in("user_id", ids)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      const chunk = (data ?? []) as { user_id: string; lesson_id: string }[];
      for (const r of chunk) {
        const deptId = lessonDept[r.lesson_id];
        // Lesson deleted, or the cached index is behind a brand-new lesson.
        if (!deptId) continue;
        const set = teamDone[deptId] || (teamDone[deptId] = new Set());
        set.add(r.lesson_id);
        const byUser = perMember[deptId] || (perMember[deptId] = {});
        byUser[r.user_id] = (byUser[r.user_id] ?? 0) + 1;
      }
      if (chunk.length < PAGE) break;
    }
  }

  return departments.map((d) => ({
    slug: d.slug,
    name: d.name,
    accent: d.accent,
    icon: d.icon,
    lessonCount: lessonCounts[d.id] ?? 0,
    teamCompleted: teamDone[d.id]?.size ?? 0,
    members: Object.entries(perMember[d.id] ?? {})
      .map(([userId, completed]) => ({ userId, completed }))
      .sort((a, b) => b.completed - a.completed),
  }));
}
