import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteRole } from "@/lib/auth";
import { isUuid } from "@/lib/app/http";
import { toIso } from "@/lib/app/format";
import {
  BAD_REQUEST,
  NOT_ADMIN,
  NOT_SUPER_ADMIN,
  requireSiteRole,
  textField,
  type StaffRole,
} from "@/lib/app/admin-access";
import { deleteAccountData } from "@/lib/app/profile";
import { contentKindLabel, reasonLabel, type ReportContentKind } from "@/lib/app/reports";
import { fail, type AppUser, type Result } from "@/lib/app/result";

/**
 * The reports desk: what members reported and what was done about it. Shared
 * by /admin/reports (its page and Server Actions) and the app's
 * /api/app/admin/reports routes.
 *
 * Three answers to a report, each closing it and logging to moderation_log:
 *   - resolve: looked at, nothing to take down (admins);
 *   - remove the content: a profile's bio and picture are cleared, and the
 *     handle replaced with a `memberNNNNNN` one when it was the problem (the
 *     old handle goes to name_moderation_log, as the name scan does); an
 *     edit's note, or a proposal's title and note, are cleared and a pending
 *     one is turned down (admins);
 *   - ban the account: the site's existing ban (the email on banned_emails
 *     with its signup IP, and the IP on banned_ips once a second banned
 *     account shares it), then the account is deleted with the same function
 *     as "Delete account" (super admins only, because it can't be undone).
 *
 * Privacy: handles only. No real names and no email addresses, and the
 * reporter's handle is shown only here, to the people who answer reports.
 */

/** Reports are answered within this long of being filed. */
export const ANSWER_WITHIN_HOURS = 24;
const OPEN_PAGE = 100;
const CLOSED_PAGE = 20;
const NOTE_MAX = 1000;

export type ReportStatus = "open" | "resolved" | "removed" | "banned";

export type DeskReport = {
  id: string;
  status: ReportStatus;
  /** "closed, nothing removed", "content removed", "account banned", or "open". */
  statusWord: string;
  reason: string;
  reasonLabel: string;
  contentKind: ReportContentKind;
  contentKindLabel: string;
  contentId: string | null;
  /** The handle when it was reported. */
  reportedUsername: string | null;
  /** The handle now, or null when the account is gone (banned or deleted). */
  currentUsername: string | null;
  accountExists: boolean;
  reporterUsername: string | null;
  /** Public fields as they stood when it was reported. */
  snapshot: {
    username: string | null;
    avatarUrl: string | null;
    bio: string | null;
    teamNumber: number | null;
    title: string | null;
    note: string | null;
    target: string | null;
    newModuleTitle: string | null;
  };
  details: string | null;
  surface: string | null;
  platform: string | null;
  createdAt: string | null;
  /** createdAt plus 24 hours. */
  answerBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  /** Open reports about the same account, this one included. */
  openAboutAccount: number;
};

export type ReportsDesk = {
  role: StaffRole;
  /** Ban is a super admin's call. */
  canBan: boolean;
  answerWithinHours: number;
  /** Oldest first: the one closest to its 24 hours is on top. */
  open: DeskReport[];
  openCount: number;
  /** The latest closed ones, newest first. */
  closed: DeskReport[];
};

const STATUS_WORD: Record<ReportStatus, string> = {
  open: "open",
  resolved: "closed, nothing removed",
  removed: "content removed",
  banned: "account banned",
};

type Row = {
  id: string;
  reporter_id: string | null;
  reported_user_id: string | null;
  reported_username: string | null;
  content_kind: string;
  content_id: string | null;
  content_snapshot: Record<string, unknown> | null;
  surface: string | null;
  platform: string | null;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
};

const ROW_COLS =
  "id, reporter_id, reported_user_id, reported_username, content_kind, content_id, content_snapshot, surface, platform, reason, details, status, created_at, resolved_at, resolution_note";

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v : null;
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function toDesk(
  r: Row,
  handles: Map<string, string | null>,
  openByAccount: Map<string, number>
): DeskReport {
  const status = (["open", "resolved", "removed", "banned"].includes(r.status)
    ? r.status
    : "open") as ReportStatus;
  const kind = (["profile", "edit", "submission"].includes(r.content_kind)
    ? r.content_kind
    : "profile") as ReportContentKind;
  const snap = r.content_snapshot ?? {};
  const created = toIso(r.created_at);
  const exists = !!r.reported_user_id && handles.has(r.reported_user_id);
  return {
    id: r.id,
    status,
    statusWord: STATUS_WORD[status],
    reason: r.reason,
    reasonLabel: reasonLabel(r.reason),
    contentKind: kind,
    contentKindLabel: contentKindLabel(kind),
    contentId: r.content_id,
    reportedUsername: r.reported_username,
    currentUsername: exists ? (handles.get(r.reported_user_id!) ?? null) : null,
    accountExists: exists,
    reporterUsername: r.reporter_id ? (handles.get(r.reporter_id) ?? null) : null,
    snapshot: {
      username: str(snap.username),
      avatarUrl: str(snap.avatarUrl),
      bio: str(snap.bio),
      teamNumber: num(snap.teamNumber),
      title: str(snap.title),
      note: str(snap.note),
      target: str(snap.target),
      newModuleTitle: str(snap.newModuleTitle),
    },
    details: r.details,
    surface: r.surface,
    platform: r.platform,
    createdAt: created,
    answerBy: created
      ? new Date(Date.parse(created) + ANSWER_WITHIN_HOURS * 3600_000).toISOString()
      : null,
    resolvedAt: toIso(r.resolved_at),
    resolutionNote: r.resolution_note,
    openAboutAccount: r.reported_user_id ? (openByAccount.get(r.reported_user_id) ?? 0) : 0,
  };
}

/** Exact count of reports waiting on a person. 0 on any error (the badge never breaks /admin). */
export async function openReportCount(): Promise<number> {
  try {
    const { count, error } = await createAdminClient()
      .from("user_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open");
    return error ? 0 : (count ?? 0);
  } catch {
    return 0;
  }
}

export async function loadReportsDesk(user: AppUser): Promise<Result<ReportsDesk>> {
  const gate = await requireSiteRole(user, "admin", NOT_ADMIN);
  if (!gate.ok) return gate;

  const admin = createAdminClient();
  const [openRes, closedRes, countRes] = await Promise.all([
    admin
      .from("user_reports")
      .select(ROW_COLS)
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(OPEN_PAGE),
    admin
      .from("user_reports")
      .select(ROW_COLS)
      .neq("status", "open")
      .order("resolved_at", { ascending: false, nullsFirst: false })
      .limit(CLOSED_PAGE),
    admin.from("user_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  if (openRes.error || closedRes.error)
    return fail("server", "Couldn't load the reports. Try again in a moment.");

  const open = (openRes.data ?? []) as Row[];
  const closed = (closedRes.data ?? []) as Row[];

  // Handles for everyone named, in one read. Explicit column list (service role).
  const ids = new Set<string>();
  for (const r of [...open, ...closed]) {
    if (r.reporter_id) ids.add(r.reporter_id);
    if (r.reported_user_id) ids.add(r.reported_user_id);
  }
  const handles = new Map<string, string | null>();
  if (ids.size) {
    const { data: profs } = await admin.from("profiles").select("id, username").in("id", [...ids]);
    for (const p of profs ?? []) handles.set(p.id as string, (p.username as string | null) ?? null);
  }

  const openByAccount = new Map<string, number>();
  for (const r of open)
    if (r.reported_user_id)
      openByAccount.set(r.reported_user_id, (openByAccount.get(r.reported_user_id) ?? 0) + 1);

  return {
    ok: true,
    role: gate.role,
    canBan: gate.role === "superadmin",
    answerWithinHours: ANSWER_WITHIN_HOURS,
    open: open.map((r) => toDesk(r, handles, openByAccount)),
    openCount: countRes.count ?? open.length,
    closed: closed.map((r) => toDesk(r, handles, openByAccount)),
  };
}

/* ── Answering ────────────────────────────────────────────────────── */

const ALREADY = "That report has already been answered.";
const GONE = "That report no longer exists.";

async function readReport(id: string): Promise<Row | null> {
  const { data } = await createAdminClient()
    .from("user_reports")
    .select(ROW_COLS)
    .eq("id", id)
    .maybeSingle();
  return (data as Row | null) ?? null;
}

/**
 * Closes this report, plus (with `alsoMatching`) every other open report
 * about the same content, or every open report about the account for a ban.
 * Status-gated, so two people answering at once close it exactly once:
 * returns null when this report was no longer open, else the close's stamp.
 */
async function closeReports(
  row: Row,
  status: Exclude<ReportStatus, "open">,
  by: string,
  note: string | null,
  scope: "this" | "content" | "account"
): Promise<string | null> {
  const admin = createAdminClient();
  const stamp = new Date().toISOString();
  const patch = {
    status,
    resolved_at: stamp,
    resolved_by: by,
    resolution_note: note,
  };
  const { data: claimed, error } = await admin
    .from("user_reports")
    .update(patch)
    .eq("id", row.id)
    .eq("status", "open")
    .select("id");
  if (error || !claimed || claimed.length === 0) return null;

  if (scope !== "this" && row.reported_user_id) {
    let q = admin
      .from("user_reports")
      .update(patch)
      .eq("status", "open")
      .eq("reported_user_id", row.reported_user_id);
    if (scope === "content") {
      q = q.eq("content_kind", row.content_kind);
      q = row.content_id ? q.eq("content_id", row.content_id) : q.is("content_id", null);
    }
    await q;
  }
  return stamp;
}

/** Puts back every report one `closeReports` call closed (the ban failed). */
async function reopen(row: Row, stamp: string) {
  const admin = createAdminClient();
  const back = { status: "open", resolved_at: null, resolved_by: null, resolution_note: null };
  await admin.from("user_reports").update(back).eq("id", row.id);
  if (row.reported_user_id)
    await admin
      .from("user_reports")
      .update(back)
      .eq("reported_user_id", row.reported_user_id)
      .eq("resolved_at", stamp);
}

async function logDecision(row: Row, decision: "resolved" | "removed" | "banned", note: string | null) {
  const { error } = await createAdminClient()
    .from("moderation_log")
    .insert({
      kind: "report",
      ref_id: row.id,
      title: row.reported_username ? `@${row.reported_username}` : contentKindLabel(row.content_kind),
      decision,
      reason: note || reasonLabel(row.reason),
      sources: [],
    });
  if (error) console.error("report moderation_log:", error.message);
}

/** Boards, the change log and profile pages show what moderation just changed straight away. */
function refreshPublicPages(username: string | null) {
  revalidateTag("leaderboard", { expire: 0 });
  revalidateTag("contributions", { expire: 0 });
  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  if (username) revalidatePath(`/u/${username}`);
}

function parseIdAndNote(input: { id: unknown; note?: unknown }) {
  const id = textField(input.id);
  const note = textField(input.note);
  if (id === null || note === null) return { bad: true as const };
  return { bad: false as const, id, note };
}

/** Looked at, nothing to take down. Closes this report only. */
export async function resolveReport(
  user: AppUser,
  input: { id: unknown; note?: unknown }
): Promise<Result<{ status: ReportStatus }>> {
  const gate = await requireSiteRole(user, "admin", NOT_ADMIN);
  if (!gate.ok) return gate;
  const p = parseIdAndNote(input);
  if (p.bad) return fail("validation", BAD_REQUEST);
  if (p.note.length > NOTE_MAX)
    return { ...fail("validation", `Keep the note under ${NOTE_MAX} characters.`), field: "note" };
  if (!isUuid(p.id)) return fail("not_found", GONE);

  const row = await readReport(p.id);
  if (!row) return fail("not_found", GONE);
  if (row.status !== "open") return fail("conflict", ALREADY);

  if (!(await closeReports(row, "resolved", user.id, p.note || null, "this")))
    return fail("conflict", ALREADY);
  await logDecision(row, "resolved", p.note || null);
  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  return { ok: true, status: "resolved" };
}

/** A free `memberNNNNNN` handle (the same shape the name scan uses). */
async function placeholderHandle(): Promise<string> {
  const admin = createAdminClient();
  for (let i = 0; i < 20; i++) {
    const candidate = "member" + Math.floor(100000 + Math.random() * 899999).toString();
    const { data } = await admin.from("profiles").select("id").eq("username", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return "member" + Date.now().toString().slice(-8);
}

/**
 * Takes the reported content down and closes every open report about it.
 * For a profile, `replaceUsername` also swaps the handle for a placeholder
 * (reversible from name_moderation_log); the bio and picture always go.
 */
export async function removeReportedContent(
  user: AppUser,
  input: { id: unknown; note?: unknown; replaceUsername?: unknown }
): Promise<Result<{ status: ReportStatus; newUsername: string | null }>> {
  const gate = await requireSiteRole(user, "admin", NOT_ADMIN);
  if (!gate.ok) return gate;
  const p = parseIdAndNote(input);
  if (p.bad) return fail("validation", BAD_REQUEST);
  if (input.replaceUsername !== undefined && input.replaceUsername !== null && typeof input.replaceUsername !== "boolean")
    return fail("validation", BAD_REQUEST);
  const replaceUsername = input.replaceUsername === true;
  if (p.note.length > NOTE_MAX)
    return { ...fail("validation", `Keep the note under ${NOTE_MAX} characters.`), field: "note" };
  if (!isUuid(p.id)) return fail("not_found", GONE);

  const row = await readReport(p.id);
  if (!row) return fail("not_found", GONE);
  if (row.status !== "open") return fail("conflict", ALREADY);

  const admin = createAdminClient();
  const note = p.note || null;
  let newUsername: string | null = null;
  let currentHandle: string | null = null;

  let prof: { id: string; username: string | null; full_name: string | null } | null = null;
  if (row.content_kind === "profile") {
    const gone = "That account is already gone. Close the report instead.";
    if (!row.reported_user_id) return fail("conflict", gone);
    const { data } = await admin
      .from("profiles")
      .select("id, username, full_name")
      .eq("id", row.reported_user_id)
      .maybeSingle();
    if (!data) return fail("conflict", gone);
    prof = {
      id: data.id as string,
      username: (data.username as string | null) ?? null,
      full_name: (data.full_name as string | null) ?? null,
    };
    currentHandle = prof.username;
  }

  // Claim first: two people answering at once take it down once.
  const stamp = await closeReports(row, "removed", user.id, note, "content");
  if (!stamp) return fail("conflict", ALREADY);
  const failed = async (what: string, message?: string) => {
    if (message) console.error(`removeReportedContent ${what}:`, message);
    await reopen(row, stamp);
    return fail("server", "Couldn't take that down. Try again.");
  };

  if (prof) {
    const update: { bio: null; avatar_url: null; username?: string } = { bio: null, avatar_url: null };
    if (replaceUsername) {
      newUsername = await placeholderHandle();
      update.username = newUsername;
    }
    const { error } = await admin.from("profiles").update(update).eq("id", prof.id);
    if (error) return failed("profile", error.message);
    if (newUsername) {
      // Same record the name scan keeps, so a rename can be reversed.
      await admin.from("name_moderation_log").insert({
        user_id: prof.id,
        old_username: prof.username,
        new_username: newUsername,
        old_full_name: prof.full_name,
        new_full_name: prof.full_name,
        reason: `report: ${reasonLabel(row.reason)}${note ? ` (${note})` : ""}`,
      });
    }
  } else if (row.content_kind === "edit" && row.content_id) {
    const { data: edit } = await admin.from("content_edits").select("id, status").eq("id", row.content_id).maybeSingle();
    if (edit) {
      const patch: Record<string, unknown> = { note: null };
      if (edit.status === "pending") {
        patch.status = "rejected";
        patch.reviewed_at = new Date().toISOString();
        patch.reviewed_by = user.id;
      }
      const { error } = await admin.from("content_edits").update(patch).eq("id", edit.id as string);
      if (error) return failed("edit", error.message);
    }
  } else if (row.content_kind === "submission" && row.content_id) {
    const { data: sub } = await admin
      .from("content_submissions")
      .select("id, status")
      .eq("id", row.content_id)
      .maybeSingle();
    if (sub) {
      // The title is the proposer's own words and /contributions prints it, so
      // it goes too. A proposal already turned into a lesson keeps the lesson.
      const patch: Record<string, unknown> = {
        title: "Removed by a moderator",
        note: null,
        new_module_title: null,
      };
      if (sub.status === "pending") {
        patch.status = "rejected";
        patch.reviewed_at = new Date().toISOString();
        patch.reviewed_by = user.id;
      }
      const { error } = await admin.from("content_submissions").update(patch).eq("id", sub.id as string);
      if (error) return failed("submission", error.message);
    }
  }

  await logDecision(row, "removed", note);
  refreshPublicPages(currentHandle);
  return { ok: true, status: "removed", newUsername };
}

/**
 * Bans the reported account with the site's existing ban, deletes it, and
 * closes every open report about it. Super admins only.
 */
export async function banReportedAccount(
  user: AppUser,
  input: { id: unknown; note?: unknown }
): Promise<Result<{ status: ReportStatus }>> {
  const gate = await requireSiteRole(user, "superadmin", NOT_SUPER_ADMIN);
  if (!gate.ok) return gate;
  const p = parseIdAndNote(input);
  if (p.bad) return fail("validation", BAD_REQUEST);
  if (p.note.length > NOTE_MAX)
    return { ...fail("validation", `Keep the note under ${NOTE_MAX} characters.`), field: "note" };
  if (!isUuid(p.id)) return fail("not_found", GONE);

  const row = await readReport(p.id);
  if (!row) return fail("not_found", GONE);
  if (row.status !== "open") return fail("conflict", ALREADY);
  const targetId = row.reported_user_id;
  if (!targetId) return fail("conflict", "That account is already gone. Close the report instead.");
  if (targetId === user.id) return fail("validation", "You can't ban your own account.");

  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(targetId);
  const email = authUser?.user?.email ?? null;
  if (!authUser?.user) return fail("conflict", "That account is already gone. Close the report instead.");
  if ((await getSiteRole(targetId, email)) !== "member")
    return fail(
      "validation",
      "That account is on the admin team. Take it off the team on /admin/team first."
    );

  const { data: prof } = await admin
    .from("profiles")
    .select("username, signup_ip")
    .eq("id", targetId)
    .maybeSingle();
  const handle = (prof?.username as string | null) ?? row.reported_username;
  const ip = (prof?.signup_ip as string | null) ?? null;

  // Claim every open report about the account first, so a second click or a
  // second admin can't run the ban twice. Put back if the ban fails.
  const note = p.note || null;
  const stamp = await closeReports(row, "banned", user.id, note, "account");
  if (!stamp) return fail("conflict", ALREADY);

  const reason = `report: ${reasonLabel(row.reason)}${note ? ` (${note})` : ""}`;
  if (email) {
    const { error: banErr } = await admin
      .from("banned_emails")
      .upsert({ email: email.toLowerCase(), reason, banned_ip: ip }, { onConflict: "email", ignoreDuplicates: true });
    if (banErr) {
      console.error("banReportedAccount banned_emails:", banErr.message);
      await reopen(row, stamp);
      return fail("server", "Couldn't ban that account. Try again.");
    }
    // The progress scan's rule: a second banned account from the same signup
    // IP bans the IP too.
    if (ip) {
      const { count } = await admin
        .from("banned_emails")
        .select("email", { count: "exact", head: true })
        .eq("banned_ip", ip);
      if ((count ?? 0) >= 2)
        await admin
          .from("banned_ips")
          .upsert(
            { ip, reason: "multiple banned accounts from this IP/device" },
            { onConflict: "ip", ignoreDuplicates: true }
          );
    }
  }

  const deleted = await deleteAccountData(
    { id: targetId, email: email ?? undefined, created_at: authUser.user.created_at },
    { supabase: admin, admin }
  );
  if (!deleted.ok) {
    await reopen(row, stamp);
    return fail("server", "The email is banned, but the account couldn't be deleted. Try again.");
  }

  await logDecision(row, "banned", note);
  refreshPublicPages(handle);
  return { ok: true, status: "banned" };
}
