import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/queries";
import { teamRoleLabel } from "@/lib/team-roles";
import { getMyApplication } from "@/lib/admin-team";
import { APPLICATIONS_OPEN, APPLY_LIMITS, HEADS, type ApplyMode } from "@/lib/applications";
import { toIso } from "@/lib/app/format";
import { siteRoleFor } from "@/lib/app/admin-access";
import { revalidateTeamPages } from "@/lib/app/admin-notify";
import { fail, type AppUser, type Result } from "@/lib/app/result";
import { teacherApplyRole } from "@/lib/app/class-teachers";

/**
 * The closed /apply contract for installed app copies (GET, POST, DELETE
 * /api/app/apply). Applying here is closed; the only role is teaching, on
 * /apply/teach (src/lib/app/class-teachers.ts).
 *
 * The marketing role this used to take applications for was removed on
 * 2026-11-09 (it may come back; git history has it). The app copies already
 * on people's phones still call these routes and read every key, so every
 * key stays: `applicationsOpen` is false, `jobs` is empty (those copies then
 * show their own built-in list), `posting`, `rules` and `marketer` are always
 * empty, and `roles` lists only the teacher role while classes are visible.
 * The `admin_applications` table is kept: a pending row from before can
 * still be withdrawn from an installed copy, or turned down on /admin/team.
 */

/** Where a signed-in account stands on /apply. ("signed-out" is the page's own.) */
export type SignedInApplyMode = Exclude<ApplyMode, "signed-out">;

/**
 * One role someone can apply for, as GET /api/app/apply lists them (newer
 * than the app copies already installed, which ignore it). Only `teacher`
 * (/apply/teach), listed only while live classes are visible
 * (classes-design.md sections 1 and 14). `"marketing"` was retired before
 * release and never shipped. `status` is the TeachApplyMode
 * (src/lib/classes/teacher-rules.ts). Add roles and fields, never rename them.
 */
export type ApplyRole = {
  id: "teacher";
  title: string;
  /** The page that takes the application. */
  url: string;
  /** Whether the role takes applications right now. */
  open: boolean;
  status: string;
};

export type ApplyState = {
  /** Always false: applying here is closed. */
  applicationsOpen: boolean;
  mode: SignedInApplyMode;
  heading: { title: string; slug: string };
  /** What a reviewer would have seen: a handle, a team number, a role word. */
  record: { username: string | null; teamNumber: number | null; teamRoleLabel: string | null };
  /**
   * The account's latest application when it still says something: pending,
   * turned down or withdrawn. Always null for an admin.
   */
  application: {
    status: "pending" | "rejected" | "withdrawn";
    createdAt: string;
    reviewedAt: string | null;
    reviewNote: string | null;
  } | null;
  /** Always empty. Kept for installed copies, which fall back to their own list. */
  jobs: { slug: string; text: string }[];
  limits: typeof APPLY_LIMITS;
  /** Always "". Kept for installed copies. */
  posting: string;
  /** Always empty. Kept for installed copies. */
  rules: string[];
  /** Always null. Kept for installed copies. */
  marketer: null;
  /** The roles there are to apply for: the teacher role while classes are visible, else none. */
  roles: ApplyRole[];
};

export async function loadApplyState(user: AppUser): Promise<Result<ApplyState>> {
  const [role, profile, teacherRole] = await Promise.all([
    siteRoleFor(user),
    getProfile(user.id),
    // A classes problem must never take /api/app/apply down with it.
    teacherApplyRole(user).catch((e) => {
      console.error("loadApplyState: teacher role:", e);
      return null;
    }),
  ]);
  const isAdmin = role !== "member";
  // Only fetched when it can change what renders: an admin has nothing to
  // apply for.
  const latest = isAdmin ? null : await getMyApplication(user.id);
  const application =
    latest && (latest.status === "pending" || latest.status === "rejected" || latest.status === "withdrawn")
      ? {
          status: latest.status,
          createdAt: toIso(latest.createdAt) ?? latest.createdAt,
          reviewedAt: toIso(latest.reviewedAt),
          reviewNote: latest.reviewNote,
        }
      : null;

  const handle = profile?.username ?? null;
  const mode: SignedInApplyMode = isAdmin
    ? "on-the-team"
    : application?.status === "pending"
      ? "pending"
      : !handle
        ? "no-handle"
        : application
          ? "again"
          : "new";

  return {
    ok: true,
    applicationsOpen: APPLICATIONS_OPEN,
    mode,
    heading: { ...HEADS[mode] },
    record: {
      username: handle,
      teamNumber: profile?.team_number ?? null,
      // The word, not the stored slug: `profiles.role` holds `other` for a
      // fifth of accounts, and nobody calls themselves that.
      teamRoleLabel: profile?.role ? teamRoleLabel(profile.role) : null,
    },
    application,
    jobs: [],
    limits: APPLY_LIMITS,
    posting: "",
    rules: [],
    marketer: null,
    roles: teacherRole ? [teacherRole] : [],
  };
}

/**
 * POST /api/app/apply. Always refused: applying here is closed. The input is
 * still accepted so the route's contract doesn't change.
 */
export async function submitApplication(
  user: AppUser,
  input: { experience: unknown; why: unknown; availability?: unknown }
): Promise<Result> {
  void input;
  if ((await siteRoleFor(user)) !== "member") return fail("conflict", "You're already on the team.");
  return fail("conflict", "Applications are closed for now. Check back later.");
}

/** DELETE /api/app/apply: a pending application from before can still be pulled back. */
export async function withdrawApplication(user: AppUser): Promise<Result> {
  const { data, error } = await createAdminClient()
    .from("admin_applications")
    .update({ status: "withdrawn", reviewed_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("status", "pending")
    .select("id");
  if (error) return fail("server", "Couldn't withdraw it. Please try again.");
  if (!data || data.length === 0)
    return fail("not_found", "There's no open application to withdraw.");
  revalidateTeamPages();
  return { ok: true };
}
