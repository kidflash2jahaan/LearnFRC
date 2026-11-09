import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOwnerEmail } from "@/lib/auth";
import { CLOSED_GRANTS } from "@/lib/applications";
import { teamRoleLabel } from "@/lib/team-roles";
import { applicationDecisionHtml } from "@/lib/email";
import {
  getAdminTeam,
  getApplications,
  getDecidedApplications,
  type ApplicationStatus,
} from "@/lib/admin-team";
import { isUuid } from "@/lib/app/http";
import { toIso } from "@/lib/app/format";
import {
  BAD_REQUEST,
  NOT_SUPER_ADMIN,
  requireSiteRole,
  textField,
  type StaffRole,
} from "@/lib/app/admin-access";
import { emailFor, mailAfter, revalidateTeamPages } from "@/lib/app/admin-notify";
import { fail, type AppUser, type Result } from "@/lib/app/result";

/**
 * The super admin's team desk: the admin team, and any application left from
 * before applying closed (reject only). Shared by /admin/team (its page and
 * the reviewAdminApplication / setAdminRole Server Actions) and the app's
 * /api/app/admin/team and /api/app/admin/applications/{id}/decision routes.
 *
 * /apply took applications for a marketing role until 2026-11-09, when the
 * role was removed (it may come back; git history has it). Nothing here
 * grants anything any more: accepting refuses, and turning one down sends a
 * short email. No application ever opened /admin. The admin team is listed
 * and managed here, by role changes, outside applications. Teacher
 * applications are decided on /admin/classes/teachers.
 *
 * Nothing here returns a real name or an email address. Handles and team
 * numbers only, and user ids only to super admins (the controls need them, as
 * on the site).
 */

/** Pending applications are read in pages of this many. */
export const PENDING_PAGE = 60;
/** The decision log prints this many. */
export const DECIDED_PAGE = 30;

export type DeskApplication = {
  id: string;
  username: string | null;
  teamNumber: number | null;
  teamRole: string | null;
  /** The role as a word ("team member" for `other`, "not given" for none). */
  teamRoleLabel: string;
  experience: string;
  why: string;
  availability: string | null;
  createdAt: string;
};

export type DeskMember = {
  userId: string;
  username: string | null;
  teamNumber: number | null;
  role: StaffRole;
  roleWord: "owner" | "super admin" | "admin";
  grantedAt: string;
  note: string | null;
  /** Listed in ADMIN_EMAILS: a super admin by configuration, never changed here. */
  isOwner: boolean;
  isYou: boolean;
  /** False for owners and your own row: no controls, as on the site. */
  canChange: boolean;
};

export type DeskDecision = {
  id: string;
  username: string | null;
  status: Exclude<ApplicationStatus, "pending">;
  /** `rejected` is worded "turned down" everywhere a person reads it. */
  statusWord: "accepted" | "turned down" | "withdrawn";
  reviewedAt: string | null;
  createdAt: string;
  reviewNote: string | null;
};

export type AdminTeamDesk = {
  grants: { label: string; hint: string }[];
  pending: DeskApplication[];
  /** True when the pending list is a full page (60) and more may be waiting. */
  pendingTruncated: boolean;
  /**
   * Always empty. The marketing role was removed before release; the key
   * stays so nothing reading the desk breaks.
   */
  marketers: never[];
  /** The admin team (`site_admins` plus the owners). */
  team: DeskMember[];
  decided: DeskDecision[];
  /** True when the log is a full page (30); older decisions are on file. */
  decidedTruncated: boolean;
};

/** Authority as a word. There is no colour chip for a role in this system. */
function roleWord(m: { isOwner: boolean; role: StaffRole }): DeskMember["roleWord"] {
  if (m.isOwner) return "owner";
  return m.role === "superadmin" ? "super admin" : "admin";
}

/**
 * The decision, worded the way the rest of the site words it. The column holds
 * `rejected`, and every other surface in this feature says "turned down".
 */
function statusWord(s: DeskDecision["status"]): DeskDecision["statusWord"] {
  return s === "rejected" ? "turned down" : s;
}

const iso = (v: string | null) => toIso(v);
const isoOr = (v: string) => toIso(v) ?? v;

export async function loadAdminTeamDesk(user: AppUser): Promise<Result<AdminTeamDesk>> {
  const gate = await requireSiteRole(user, "superadmin", NOT_SUPER_ADMIN);
  if (!gate.ok) return gate;

  const [pending, team, decided] = await Promise.all([
    getApplications("pending", PENDING_PAGE),
    getAdminTeam(),
    // Its own read, ordered and cut by `reviewed_at`. Taking a window of
    // everything by arrival order and re-sorting it by decision order loses
    // rows: decisions made on an old backlog sit past the window and never
    // reach the page at all.
    getDecidedApplications(DECIDED_PAGE),
  ]);

  return {
    ok: true,
    grants: CLOSED_GRANTS,
    pending: pending.map((a) => ({
      id: a.id,
      username: a.username,
      teamNumber: a.teamNumber,
      teamRole: a.teamRole,
      teamRoleLabel: teamRoleLabel(a.teamRole),
      experience: a.experience,
      why: a.why,
      availability: a.availability,
      createdAt: isoOr(a.createdAt),
    })),
    pendingTruncated: pending.length === PENDING_PAGE,
    marketers: [],
    team: team.map((m) => {
      const isYou = m.userId === user.id;
      return {
        userId: m.userId,
        username: m.username,
        teamNumber: m.teamNumber,
        role: m.role,
        roleWord: roleWord(m),
        grantedAt: isoOr(m.grantedAt),
        note: m.note,
        isOwner: m.isOwner,
        isYou,
        canChange: !m.isOwner && !isYou,
      };
    }),
    decided: decided.map((a) => {
      const status = a.status === "pending" ? "withdrawn" : a.status;
      return {
        id: a.id,
        username: a.username,
        status,
        statusWord: statusWord(status),
        reviewedAt: iso(a.reviewedAt),
        createdAt: isoOr(a.createdAt),
        reviewNote: a.reviewNote,
      };
    }),
    decidedTruncated: decided.length === DECIDED_PAGE,
  };
}

/* ── Deciding an application ──────────────────────────────────────── */

/**
 * Turns down an application left from before applying closed. Accepting
 * refuses: the role it was for is gone. The route and the decision log keep
 * their shape for installed app copies.
 */
export async function decideApplication(
  user: AppUser,
  input: { id: unknown; decision: unknown; note?: unknown }
): Promise<Result<{ status: "accepted" | "rejected" }>> {
  const gate = await requireSiteRole(user, "superadmin", NOT_SUPER_ADMIN);
  if (!gate.ok) return gate;

  const id = textField(input.id);
  const decision = textField(input.decision);
  const note = textField(input.note);
  if (id === null || decision === null || note === null) return fail("validation", BAD_REQUEST);
  if (!id) return fail("validation", "Missing application id.");
  if (decision !== "accept" && decision !== "reject")
    return fail("validation", "Pick accept or reject.");
  if (note.length > 1000)
    return { ...fail("validation", "Keep the note under 1000 characters."), field: "note" };
  if (!isUuid(id)) return fail("not_found", "That application no longer exists.");
  if (decision === "accept")
    return fail("conflict", "This role is closed, so old applications can only be turned down.");

  const admin = createAdminClient();
  const { data: app } = await admin
    .from("admin_applications")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!app) return fail("not_found", "That application no longer exists.");
  if (app.status !== "pending") return fail("conflict", "That one has already been decided.");

  // THE STATUS CHANGE IS THE GATE. The read above is a courtesy that gives the
  // common case a better message; it cannot decide anything, because two
  // requests can both pass it. `.eq("status", "pending")` plus a returned row
  // means exactly one of them wins, so a retry after a timeout, or a second
  // super admin with the drawer open, gets "already decided" instead of a
  // second email.
  const { data: won, error: updErr } = await admin
    .from("admin_applications")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      review_note: note || null,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (updErr) return fail("server", "Couldn't record the decision. Please try again.");
  if (!won || won.length === 0) return fail("conflict", "That one has already been decided.");

  const to = await emailFor(app.user_id as string);
  if (to) {
    const { data: prof } = await admin
      .from("profiles")
      .select("username")
      .eq("id", app.user_id as string)
      .maybeSingle();
    mailAfter("decision", {
      to,
      subject: "About your LearnFRC application",
      html: applicationDecisionHtml({ note: note || null, username: (prof?.username as string | null) ?? null }),
    });
  }

  revalidateTeamPages();
  return { ok: true, status: "rejected" };
}

/* ── Managing the team ────────────────────────────────────────────── */

export async function setAdminRoleFor(
  user: AppUser,
  input: { userId: unknown; role: unknown }
): Promise<Result> {
  const gate = await requireSiteRole(user, "superadmin", NOT_SUPER_ADMIN);
  if (!gate.ok) return gate;

  const userId = textField(input.userId);
  const role = textField(input.role);
  if (userId === null || role === null) return fail("validation", BAD_REQUEST);
  if (!userId) return fail("validation", "Missing user.");
  if (role !== "admin" && role !== "superadmin" && role !== "remove")
    return fail("validation", "Pick a role.");
  if (!isUuid(userId)) return fail("validation", BAD_REQUEST);
  // The page hides the controls on your own row, so this is only reachable by
  // a stale screen or a hand-made request. It states the rule and stops, rather
  // than sending somebody to ask a second super admin who may not exist.
  if (userId === user.id)
    return fail(
      "validation",
      "You can't change your own role from here. Another super admin has to do it."
    );

  // Owners are super admins by configuration; the panel can't touch them.
  if (isOwnerEmail(await emailFor(userId)))
    return fail("validation", "That account is a site owner and can't be changed here.");

  const admin = createAdminClient();
  if (role === "remove") {
    const { error } = await admin.from("site_admins").delete().eq("user_id", userId);
    if (error) return fail("server", "Couldn't remove them. Please try again.");
  } else {
    // UPDATE FIRST, INSERT ONLY IF THERE WAS NOTHING TO UPDATE. An upsert
    // carrying `granted_at` rewrites it on every role change, and PostgREST
    // turns that into `ON CONFLICT DO UPDATE SET` over every column in the
    // payload. /admin/team prints that date as the person's tenure and orders
    // the list by it, so promoting a January admin in September would move
    // their row and lose the real date with nothing to recover it from. On a
    // first grant the column default covers it.
    const { data: changed, error: updErr } = await admin
      .from("site_admins")
      .update({ role, granted_by: user.id })
      .eq("user_id", userId)
      .select("user_id");
    if (updErr) return fail("server", "Couldn't change the role. Please try again.");
    if (!changed || changed.length === 0) {
      const { error: insErr } = await admin
        .from("site_admins")
        .insert({ user_id: userId, role, granted_by: user.id });
      if (insErr) return fail("server", "Couldn't change the role. Please try again.");
    }
  }

  revalidateTeamPages();
  return { ok: true };
}
