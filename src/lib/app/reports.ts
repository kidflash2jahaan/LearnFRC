import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminNotifyHtml } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/app/http";
import { normalizeUsername } from "@/lib/app/profile";
import { textField } from "@/lib/app/admin-access";
import { mailAfter } from "@/lib/app/admin-notify";
import { fail, type AppUser, type Result } from "@/lib/app/result";
import { endClassForReports } from "@/lib/app/classes-room";
import { holdClass } from "@/lib/classes/holds";
import { adminClassUrl, ownerEmail, safetyEmail } from "@/lib/classes/config";
import { classEmailHtml, escapeHtml, mailClass, pacificTime } from "@/lib/classes/emails";
import { isLiveNow, withinReportWindow } from "@/lib/classes/room-rules";
import { OWNER_RESTRICTED_LINE } from "@/lib/classes/safety-routing";
import {
  CLASS_ONLY_REPORT_REASONS,
  CLASS_REPORT_REASONS,
  REPORT_REASONS,
  reasonLabel,
} from "@/lib/report-reasons";

/**
 * Reporting what another member made, shared by the website (the report
 * control on /u/<username> and on /contributions) and the app's
 * POST /api/app/reports.
 *
 * WHAT CAN BE REPORTED. Everything one member can put in front of another:
 *   - `profile`: the handle, the avatar, the bio and the team number, as shown
 *     on /u/<username>, the leaderboards and the team sheet;
 *   - `edit`: the note on a suggested edit, quoted on /contributions;
 *   - `submission`: the title and note on a lesson proposal, same page;
 *   - `class`: someone in a live class (classes-design.md section 10.2): its
 *     teacher (anyone signed in can report them, from the class's listing,
 *     page or room, on the site or in the app), or anyone else who was in it
 *     (only by someone who was in the class too, within 30 days). contentId
 *     is the class; the person is `userId` when it's sent (the website's
 *     class report panel and room controls send it), else `username` (the
 *     app). By id, a report still finds the right person after they're
 *     renamed mid-class. Class reports take three more reasons, keep the
 *     class's evidence (keep_evidence and a hold), go to the safety lead as
 *     well as the owner, say LIVE CLASS when the class is on now, and two
 *     different people from a live class reporting its teacher end the class.
 *
 * A report is a row in `user_reports` (service role only: a reporter never
 * reads it back, and the person reported can never find out who filed it)
 * plus an email to the owner, so it can be answered within 24 hours. The desk
 * that answers it is src/lib/app/admin-reports.ts.
 */

// The reason lists live in src/lib/report-reasons.ts (no imports, so the
// report form and the class report panel can list them); re-exported here.
export { CLASS_ONLY_REPORT_REASONS, CLASS_REPORT_REASONS, REPORT_REASONS, reasonLabel };
export type { ClassReportReason, ReportReason } from "@/lib/report-reasons";
export type ReportContentKind = "profile" | "edit" | "submission" | "class";

const CONTENT_KINDS: readonly ReportContentKind[] = ["profile", "edit", "submission", "class"];
/** Where the reporter was. Allow-listed; anything else is stored as null. */
const SURFACES = ["profile", "leaderboard", "team", "contributions", "class", "classes_list"] as const;
const PLATFORMS = ["web", "ios", "ipados", "macos"] as const;

export const REPORT_DETAILS_MAX = 1000;
/** Per account. A real report is rare; a burst of them is someone using it as a weapon. */
const REPORT_RATE_MAX = 10;
const REPORT_RATE_WINDOW = 3600;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

export function contentKindLabel(kind: string | null | undefined): string {
  if (kind === "edit") return "Suggested edit";
  if (kind === "submission") return "Lesson proposal";
  if (kind === "class") return "Live class";
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
  noClass: "That class doesn't exist.",
  notInClass: "That person wasn't in this class.",
  needsClass: "You can report this class's teacher, or anyone from a class you were in.",
  classWindow: "Reports from a class stay open for 30 days after it.",
  classOver: "This class is over, so only people who were in it can report it now.",
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
  /**
   * A class report only: the person's account id (from the class roster).
   * Takes the place of `username` when sent, so a rename between the roster
   * being read and the report being sent can't miss them, or name someone
   * who took the old name. Ignored for every other kind.
   */
  userId?: unknown;
  /** `profile` (default), `edit`, `submission` or `class`. */
  contentKind?: unknown;
  /** The edit's or proposal's id, or the class's. */
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
  /** A class report: the class and the reported person's place in it. */
  cls?: ClassTarget;
};

type ClassTarget = {
  id: string;
  title: string;
  startsAt: string;
  teacherId: string | null;
  role: "teacher" | "student" | "staff";
  liveNow: boolean;
};

type ClassRefusal = "noClass" | "noPerson" | "notInClass" | "needsClass" | "classWindow" | "classOver";

/**
 * The person reported from a class (section 10.2), resolved from the class
 * id and their account id (or their username, when no id is sent): its
 * teacher, whom anyone signed in may report while the class is scheduled or
 * on, and anyone who was in it within 30 days after; or someone with a
 * class_participants row in it, whom only someone who was in the class too
 * (or teaches it) may report, within 30 days of it.
 * Every class report keeps the class's evidence and alerts the safety lead,
 * so nobody outside a class can keep reporting it once it's over.
 */
async function classTarget(
  reporterId: string,
  classId: string,
  who: { userId: string | null; username: string }
): Promise<Target | { refusal: ClassRefusal }> {
  const admin = createAdminClient();
  const { data: cls } = await admin
    .from("classes")
    .select("id, title, starts_at, hard_end_at, status, teacher_id")
    .eq("id", classId)
    .maybeSingle();
  if (!cls) return { refusal: "noClass" };
  let prof: { id: unknown; username: unknown } | null = null;
  if (who.userId) {
    ({ data: prof } = await admin.from("profiles").select("id, username").eq("id", who.userId).maybeSingle());
  } else {
    const username = normalizeUsername(who.username);
    if (!username) return { refusal: "noPerson" };
    ({ data: prof } = await admin.from("profiles").select("id, username").eq("username", username).maybeSingle());
  }
  if (!prof) return { refusal: "noPerson" };
  const userId = prof.id as string;

  let role: ClassTarget["role"];
  if (userId === cls.teacher_id) {
    role = "teacher";
    const { data: mine } = await admin
      .from("class_participants")
      .select("role")
      .eq("class_id", classId)
      .eq("user_id", reporterId)
      .maybeSingle();
    if (mine) {
      if (!withinReportWindow(cls.hard_end_at as string)) return { refusal: "classWindow" };
    } else {
      const open =
        (cls.status === "scheduled" || cls.status === "live") && Date.now() < Date.parse(cls.hard_end_at as string);
      if (!open) return { refusal: "classOver" };
    }
  } else {
    const [{ data: theirs }, { data: mine }] = await Promise.all([
      admin.from("class_participants").select("role").eq("class_id", classId).eq("user_id", userId).maybeSingle(),
      admin.from("class_participants").select("role").eq("class_id", classId).eq("user_id", reporterId).maybeSingle(),
    ]);
    if (!theirs) return { refusal: "notInClass" };
    if (!mine && reporterId !== cls.teacher_id) return { refusal: "needsClass" };
    if (!withinReportWindow(cls.hard_end_at as string)) return { refusal: "classWindow" };
    role = theirs.role as ClassTarget["role"];
  }

  const target: ClassTarget = {
    id: cls.id as string,
    title: cls.title as string,
    startsAt: new Date(cls.starts_at as string).toISOString(),
    teacherId: (cls.teacher_id as string | null) ?? null,
    role,
    liveNow: isLiveNow({
      status: cls.status as string,
      starts_at: cls.starts_at as string,
      hard_end_at: cls.hard_end_at as string,
    }),
  };
  return {
    userId,
    username: (prof.username as string | null) ?? null,
    snapshot: {
      classId: target.id,
      classTitle: target.title,
      startsAt: target.startsAt,
      role,
      liveNow: target.liveNow,
    },
    cls: target,
  };
}

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
  const userIdRaw = textField(input.userId);
  const contentIdRaw = textField(input.contentId);
  const surfaceRaw = textField(input.surface);
  const platformRaw = textField(input.platform);
  if (
    kindRaw === null ||
    reasonRaw === null ||
    details === null ||
    usernameRaw === null ||
    userIdRaw === null ||
    contentIdRaw === null ||
    surfaceRaw === null ||
    platformRaw === null
  )
    return fail("validation", REPORT_SENTENCES.bad);

  const kind = (kindRaw || "profile") as ReportContentKind;
  if (!CONTENT_KINDS.includes(kind)) return fail("validation", REPORT_SENTENCES.bad);
  // The class-only reasons are accepted for a class report only.
  const reasons: readonly { id: string }[] = kind === "class" ? CLASS_REPORT_REASONS : REPORT_REASONS;
  const reason = reasons.find((r) => r.id === reasonRaw)?.id;
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
  } else if (kind === "class") {
    if (!isUuid(contentIdRaw)) return fail("not_found", REPORT_SENTENCES.noClass);
    if (userIdRaw && !isUuid(userIdRaw)) return fail("not_found", REPORT_SENTENCES.noPerson);
    if (!userIdRaw && !usernameRaw) return fail("validation", REPORT_SENTENCES.noPerson);
    const found = await classTarget(user.id, contentIdRaw.toLowerCase(), {
      userId: userIdRaw ? userIdRaw.toLowerCase() : null,
      username: usernameRaw,
    });
    if ("refusal" in found) {
      const code =
        found.refusal === "needsClass" || found.refusal === "classWindow" || found.refusal === "classOver"
          ? "forbidden"
          : "not_found";
      return fail(code, REPORT_SENTENCES[found.refusal]);
    }
    target = found;
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

  if (target.cls) {
    await afterClassReport(user, {
      reportId: row.id as string,
      reason,
      details,
      surface,
      target: { userId: target.userId, username: target.username },
      cls: target.cls,
    });
    return {
      ok: true,
      reportId: row.id as string,
      alreadyReported: false,
      message: reportThanks(target.username, false),
    };
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

/* ── After a class report (section 10.2) ───────────────────────────── */

/**
 * Class report reasons that make the class restricted at once (the safety
 * lead only, section 8.1), before any AI review: Jahaan is a minor, and a
 * report of sexual content, or of someone asking a student to talk privately
 * or meet up (the reported form of grooming), is what he must not read or
 * watch. "I feel unsafe" isn't here: it covers too much to lock every such
 * class away from the owner, and the review still restricts what it finds.
 */
export const RESTRICTING_CLASS_REPORT_REASONS: ReadonlySet<string> = new Set(["sexual", "private_contact"]);

/**
 * Everything a class report sets off once its row is stored: a report of
 * sexual content or private contact restricts the class first
 * (class_reviews.restricted, which
 * hides its transcript, chat, recording and holds from everyone but the
 * safety lead), then the class keeps its evidence (keep_evidence, and a hold
 * on the person reported), its audit trail gets a `reported` row, and the
 * report goes to the safety lead and the owner, as "LIVE CLASS:" with a
 * button to the class's review page when it's on now. For a restricting
 * report, the owner gets only the one line and the details go to the safety
 * lead alone. Then the two-reporter check: a second different person from
 * the class reporting its teacher while it's live ends it
 * (endClassForReports in src/lib/app/classes-room.ts). Each step stands
 * alone, and none can lose the report, which is already saved.
 */
async function afterClassReport(
  reporter: AppUser,
  input: {
    reportId: string;
    reason: string;
    details: string;
    surface: string | null;
    target: { userId: string; username: string | null };
    cls: ClassTarget;
  }
) {
  const admin = createAdminClient();
  const { cls, target } = input;
  const restricting = RESTRICTING_CLASS_REPORT_REASONS.has(input.reason);

  // First, before the hold or any email: the review row (made now if the
  // review hasn't run) is restricted, and a later review run never lowers it.
  if (restricting) {
    const { error } = await admin
      .from("class_reviews")
      .upsert({ class_id: cls.id, restricted: true, updated_at: new Date().toISOString() }, { onConflict: "class_id" });
    if (error) console.error("class report restrict:", error.message);
  }

  const { error: keepErr } = await admin.from("classes").update({ keep_evidence: true }).eq("id", cls.id);
  if (keepErr) console.error("class report keep_evidence:", keepErr.message);
  const { error: eventErr } = await admin.from("class_events").insert({
    class_id: cls.id,
    actor_id: reporter.id,
    kind: "reported",
    detail: {
      reportId: input.reportId,
      reason: input.reason,
      reportedUserId: target.userId,
      role: cls.role,
      liveNow: cls.liveNow,
      surface: input.surface,
    },
  });
  if (eventErr) console.error("class report event:", eventErr.message);
  try {
    await holdClass(cls.id, { reason: "class_report", subjectUserId: target.userId, createdBy: null });
  } catch (e) {
    console.error("class report hold:", e);
  }

  const owner = ownerEmail();
  const safety = safetyEmail();
  // A restricting report's details go to the safety lead alone; the owner
  // gets the one line (unless the two addresses are the same, on a dev server).
  const ownerOneLine = restricting && !!owner && owner !== safety;
  if (ownerOneLine) {
    mailClass("class report (restricted)", cls.id, {
      to: [owner],
      subject: cls.liveNow
        ? "LIVE CLASS: a class that's on now needs a safety review"
        : "LearnFRC safety: a class needs a safety review",
      html: classEmailHtml({
        heading: OWNER_RESTRICTED_LINE,
        buttons: [{ text: "Open the class page", url: adminClassUrl(cls.id) }],
        note: cls.liveNow
          ? "The class is on now. You or Dhiren can end it from the classes desk. The report itself went to Dhiren."
          : "The report itself went to Dhiren. Nothing from it is in this email.",
      }),
    });
  }
  const to = [...new Set([ownerOneLine ? null : owner, safety].filter((x): x is string => !!x))];
  if (to.length) {
    const { data: me } = await admin.from("profiles").select("username").eq("id", reporter.id).maybeSingle();
    const from = (me?.username as string | null) ?? null;
    const who = target.username ? `@${target.username}` : "someone";
    const place = cls.role === "teacher" ? "the teacher" : cls.role === "staff" ? "LearnFRC staff" : "a student";
    mailClass("class report", cls.id, {
      to,
      subject: cls.liveNow ? `LIVE CLASS: report about ${who} in ${cls.title}` : `LearnFRC: class report about ${who}`,
      html: classEmailHtml({
        heading: cls.liveNow ? `Someone reported ${who} in a class that's on now.` : `Someone reported ${who} from a class.`,
        rows: [
          { label: "Reason", value: reasonLabel(input.reason) },
          { label: "Class", value: `${cls.title}, ${pacificTime(cls.startsAt)}` },
          { label: "Their place in it", value: place },
          { label: "From", value: from ? `@${from}` : "a member with no username" },
        ],
        bodyHtml: input.details
          ? `<p style="margin:14px 0 4px;font-weight:700">What they wrote</p><p style="margin:0;white-space:pre-wrap">${escapeHtml(input.details)}</p>`
          : "",
        buttons: [
          { text: cls.liveNow ? "Open the class now" : "Open the class", url: adminClassUrl(cls.id) },
          { text: "The reports desk", url: `${SITE}/admin/reports`, tone: "plain" },
        ],
        note: "The class's recording, transcript and chat are being kept. The person reported is never told who filed it.",
      }),
    });
  } else {
    console.error("[reports] No owner or safety address is set. Class report stored, nobody notified.");
  }

  // Two different people from the class reporting its teacher while it's live.
  if (cls.role !== "teacher" || !cls.liveNow || !cls.teacherId) return;
  try {
    const { data: open } = await admin
      .from("user_reports")
      .select("reporter_id")
      .eq("content_kind", "class")
      .eq("content_id", cls.id)
      .eq("reported_user_id", cls.teacherId)
      .eq("status", "open");
    const reporters = [
      ...new Set((open ?? []).map((r) => r.reporter_id as string | null).filter((x): x is string => !!x)),
    ];
    if (reporters.length < 2) return;
    // Only people who were in the class count, so nobody outside it can end
    // a class by reporting it from its listing.
    const { data: inClass } = await admin
      .from("class_participants")
      .select("user_id")
      .eq("class_id", cls.id)
      .in("user_id", reporters);
    const counted = (inClass ?? []).length;
    if (counted >= 2) await endClassForReports(cls.id, { teacherId: cls.teacherId, reporters: counted });
  } catch (e) {
    console.error("class report auto-end:", e);
  }
}
