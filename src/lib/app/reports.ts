import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminNotifyHtml } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/app/http";
import { normalizeUsername } from "@/lib/app/profile";
import { textField } from "@/lib/app/admin-access";
import { mailAfter } from "@/lib/app/admin-notify";
import { fail, type AppUser, type Result } from "@/lib/app/result";

/**
 * Reporting what another member made, shared by the website (the report
 * control on /u/<username> and on /contributions) and the app's
 * POST /api/app/reports.
 *
 * WHAT CAN BE REPORTED. Everything one member can put in front of another:
 *   - `profile`: the handle, the avatar, the bio and the team number, as shown
 *     on /u/<username>, the leaderboards and the team sheet;
 *   - `edit`: the note on a suggested edit, quoted on /contributions;
 *   - `submission`: the title and note on a lesson proposal, same page.
 *
 * A report is a row in `user_reports` (service role only: a reporter never
 * reads it back, and the person reported can never find out who filed it)
 * plus an email to the owner, so it can be answered within 24 hours. The desk
 * that answers it is src/lib/app/admin-reports.ts.
 */

export const REPORT_REASONS = [
  { id: "harassment", label: "Bullying or harassment" },
  { id: "offensive", label: "Offensive or inappropriate" },
  { id: "personal_info", label: "Sharing someone's personal information" },
  { id: "impersonation", label: "Pretending to be someone else" },
  { id: "spam", label: "Spam or cheating" },
  { id: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["id"];
export type ReportContentKind = "profile" | "edit" | "submission";

const CONTENT_KINDS: readonly ReportContentKind[] = ["profile", "edit", "submission"];
/** Where the reporter was. Allow-listed; anything else is stored as null. */
const SURFACES = ["profile", "leaderboard", "team", "contributions"] as const;
const PLATFORMS = ["web", "ios", "ipados", "macos"] as const;

export const REPORT_DETAILS_MAX = 1000;
/** Per account. A real report is rare; a burst of them is someone using it as a weapon. */
const REPORT_RATE_MAX = 10;
const REPORT_RATE_WINDOW = 3600;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

export function reasonLabel(id: string | null | undefined): string {
  return REPORT_REASONS.find((r) => r.id === id)?.label ?? "Something else";
}

export function contentKindLabel(kind: string | null | undefined): string {
  if (kind === "edit") return "Suggested edit";
  if (kind === "submission") return "Lesson proposal";
  return "Profile";
}

export const REPORT_SENTENCES = {
  bad: "That request wasn't in the format we expected.",
  reason: "Pick a reason.",
  otherDetails: "Tell us a little about what's wrong.",
  tooLong: `Keep it under ${REPORT_DETAILS_MAX} characters.`,
  self: "You can't report yourself.",
  noPerson: "There's no learner with that username.",
  noContent: "That suggestion no longer exists.",
  rate: "That's a lot of reports in an hour. Try again in a bit, or write to us from the contact page.",
  save: "Couldn't send that report. Try again.",
} as const;

/** What the reporter is told, on the site and in the app. */
export function reportThanks(username: string | null, alreadyReported: boolean): string {
  const who = username ? `@${username}` : "They";
  if (alreadyReported)
    return `You've already reported this, and it's still waiting on a person. Every report is read within 24 hours. ${who} isn't told who sent it.`;
  return `Thanks. Your report went to the LearnFRC team, and every report is read within 24 hours. ${who} isn't told who sent it.`;
}

export type ReportInput = {
  /** The person reported. Required for a profile; ignored for an edit or a
      proposal, whose author is read from the row itself. */
  username?: unknown;
  /** `profile` (default), `edit` or `submission`. */
  contentKind?: unknown;
  /** The edit's or proposal's id. */
  contentId?: unknown;
  reason: unknown;
  details?: unknown;
  surface?: unknown;
  platform?: unknown;
};

export type ReportFiled = {
  reportId: string | null;
  /** True when this person already had an open report about the same thing. */
  alreadyReported: boolean;
  /** The sentence to show the reporter. */
  message: string;
};

type Target = {
  userId: string;
  username: string | null;
  snapshot: Record<string, unknown>;
};

/** The reported account and what it showed, for a profile report. */
async function profileTarget(rawUsername: string): Promise<Target | null> {
  const username = normalizeUsername(rawUsername);
  if (!username) return null;
  // Explicit, public columns only (see src/lib/app/public-profile.ts).
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, username, avatar_url, bio, team_number")
    .eq("username", username)
    .maybeSingle();
  if (!data) return null;
  return {
    userId: data.id as string,
    username: (data.username as string | null) ?? null,
    snapshot: {
      username: data.username ?? null,
      avatarUrl: data.avatar_url ?? null,
      bio: data.bio ?? null,
      teamNumber: data.team_number ?? null,
    },
  };
}

/** The author of an edit or a proposal and what /contributions showed of it. */
async function contributionTarget(kind: "edit" | "submission", id: string): Promise<Target | null> {
  const admin = createAdminClient();
  let authorId: string | null = null;
  let snapshot: Record<string, unknown> = {};
  if (kind === "edit") {
    const { data } = await admin
      .from("content_edits")
      .select("id, editor_id, content_type, lesson_id, article_id, note, status")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    authorId = data.editor_id as string;
    let target: string | null = null;
    if (data.content_type === "article" && data.article_id) {
      const { data: a } = await admin.from("articles").select("title").eq("id", data.article_id).maybeSingle();
      target = (a?.title as string | undefined) ?? null;
    } else if (data.lesson_id) {
      const { data: l } = await admin.from("lessons").select("title").eq("id", data.lesson_id).maybeSingle();
      target = (l?.title as string | undefined) ?? null;
    }
    snapshot = { note: data.note ?? null, target, status: data.status ?? null };
  } else {
    const { data } = await admin
      .from("content_submissions")
      .select("id, submitter_id, title, note, new_module_title, status")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    authorId = data.submitter_id as string;
    snapshot = {
      title: data.title ?? null,
      note: data.note ?? null,
      newModuleTitle: data.new_module_title ?? null,
      status: data.status ?? null,
    };
  }
  if (!authorId) return null;
  const { data: prof } = await admin.from("profiles").select("username").eq("id", authorId).maybeSingle();
  return { userId: authorId, username: (prof?.username as string | null) ?? null, snapshot };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The snapshot as labelled lines for the owner's email. */
function snapshotHtml(kind: ReportContentKind, snap: Record<string, unknown>): string {
  const lines: [string, unknown][] =
    kind === "profile"
      ? [
          ["Bio", snap.bio],
          ["Avatar", snap.avatarUrl],
          ["Team", snap.teamNumber],
        ]
      : kind === "edit"
        ? [
            ["On", snap.target],
            ["Their note", snap.note],
            ["Status", snap.status],
          ]
        : [
            ["Title", snap.title],
            ["New module", snap.newModuleTitle],
            ["Their note", snap.note],
            ["Status", snap.status],
          ];
  const shown = lines.filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "");
  if (shown.length === 0) return "";
  return `
    <p style="margin:14px 0 4px;font-weight:700">What it showed when it was reported</p>
    ${shown
      .map(
        ([label, v]) =>
          `<p style="margin:4px 0;white-space:pre-wrap"><strong>${esc(label)}:</strong> ${esc(String(v)).slice(0, 1200)}</p>`
      )
      .join("")}`;
}

/**
 * File a report. A second report from the same person about the same thing,
 * while the first is still open, is the same report: it answers success with
 * `alreadyReported` and sends no second email.
 */
export async function fileReport(user: AppUser, input: ReportInput): Promise<Result<ReportFiled>> {
  const kindRaw = textField(input.contentKind);
  const reasonRaw = textField(input.reason);
  const details = textField(input.details);
  const usernameRaw = textField(input.username);
  const contentIdRaw = textField(input.contentId);
  const surfaceRaw = textField(input.surface);
  const platformRaw = textField(input.platform);
  if (
    kindRaw === null ||
    reasonRaw === null ||
    details === null ||
    usernameRaw === null ||
    contentIdRaw === null ||
    surfaceRaw === null ||
    platformRaw === null
  )
    return fail("validation", REPORT_SENTENCES.bad);

  const kind = (kindRaw || "profile") as ReportContentKind;
  if (!CONTENT_KINDS.includes(kind)) return fail("validation", REPORT_SENTENCES.bad);
  const reason = REPORT_REASONS.find((r) => r.id === reasonRaw)?.id;
  if (!reason) return { ...fail("validation", REPORT_SENTENCES.reason), field: "reason" };
  if (details.length > REPORT_DETAILS_MAX)
    return { ...fail("validation", REPORT_SENTENCES.tooLong), field: "details" };
  if (reason === "other" && details.length < 5)
    return { ...fail("validation", REPORT_SENTENCES.otherDetails), field: "details" };

  let target: Target | null;
  if (kind === "profile") {
    if (!usernameRaw) return fail("validation", REPORT_SENTENCES.noPerson);
    target = await profileTarget(usernameRaw);
    if (!target) return fail("not_found", REPORT_SENTENCES.noPerson);
  } else {
    if (!isUuid(contentIdRaw)) return fail("not_found", REPORT_SENTENCES.noContent);
    target = await contributionTarget(kind, contentIdRaw.toLowerCase());
    if (!target) return fail("not_found", REPORT_SENTENCES.noContent);
  }
  if (target.userId === user.id) return fail("validation", REPORT_SENTENCES.self);

  const contentId = kind === "profile" ? null : contentIdRaw.toLowerCase();
  const admin = createAdminClient();

  // An open report from this person about this thing is the same report.
  // Checked before the rate limit, so a double tap never costs a slot.
  {
    let q = admin
      .from("user_reports")
      .select("id")
      .eq("reporter_id", user.id)
      .eq("reported_user_id", target.userId)
      .eq("content_kind", kind)
      .eq("status", "open");
    q = contentId ? q.eq("content_id", contentId) : q.is("content_id", null);
    const { data: open } = await q.limit(1).maybeSingle();
    if (open)
      return {
        ok: true,
        reportId: open.id as string,
        alreadyReported: true,
        message: reportThanks(target.username, true),
      };
  }

  if (!(await rateLimit("report", REPORT_RATE_MAX, REPORT_RATE_WINDOW, user.id)))
    return fail("rate_limited", REPORT_SENTENCES.rate, REPORT_RATE_WINDOW);

  const surface = (SURFACES as readonly string[]).includes(surfaceRaw) ? surfaceRaw : null;
  const platform = (PLATFORMS as readonly string[]).includes(platformRaw.toLowerCase())
    ? platformRaw.toLowerCase()
    : null;

  const { data: row, error } = await admin
    .from("user_reports")
    .insert({
      reporter_id: user.id,
      reported_user_id: target.userId,
      reported_username: target.username,
      content_kind: kind,
      content_id: contentId,
      content_snapshot: target.snapshot,
      surface,
      platform,
      reason,
      details: details || null,
    })
    .select("id, created_at")
    .single();
  if (error || !row) {
    // The partial unique index caught a double submit that raced the check.
    if (error?.code === "23505")
      return {
        ok: true,
        reportId: null,
        alreadyReported: true,
        message: reportThanks(target.username, true),
      };
    console.error("fileReport:", error?.message);
    return fail("server", REPORT_SENTENCES.save);
  }

  // The row is the record; the email is how it reaches a person in time.
  const ownerEmail = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim();
  if (ownerEmail) {
    const { data: me } = await admin.from("profiles").select("username").eq("id", user.id).maybeSingle();
    const reporter = (me?.username as string | null) ?? null;
    const who = target.username ? `@${target.username}` : "a member";
    mailAfter("report notification", {
      to: ownerEmail,
      subject: `LearnFRC: report about ${who}`,
      html: adminNotifyHtml({
        heading: `Someone reported ${who}`,
        rows: [
          { label: "Reason", value: reasonLabel(reason) },
          { label: "What", value: contentKindLabel(kind) },
          { label: "Where", value: [surface ?? "unknown", platform ?? "unknown"].join(" / ") },
          { label: "From", value: reporter ? `@${reporter}` : "a member with no username" },
        ],
        bodyHtml: `${
          details
            ? `<p style="margin:14px 0 4px;font-weight:700">What they wrote</p>
          <p style="margin:0;white-space:pre-wrap">${esc(details)}</p>`
            : ""
        }${snapshotHtml(kind, target.snapshot)}`,
        ctaText: "Open the reports desk",
        ctaUrl: `${SITE}/admin/reports`,
        note: "Every report gets an answer within 24 hours. From the desk you can close it, remove the content, or ban the account. The person reported is never told who filed it.",
      }),
    });
  } else {
    console.error("[reports] ADMIN_EMAILS is unset. Report stored, nobody notified.");
  }

  return {
    ok: true,
    reportId: row.id as string,
    alreadyReported: false,
    message: reportThanks(target.username, false),
  };
}
