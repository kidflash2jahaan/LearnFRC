import "server-only";
import type { LanguageModel } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/app/http";
import { fail, type Result } from "@/lib/app/result";
import {
  SITE_URL,
  adminClassUrl,
  getClassSettings,
  ownerEmail,
  playbookUrl,
  reviewModel,
  rtkApp,
  safetyEmail,
} from "@/lib/classes/config";
import { classEmailHtml, emailListHtml, escapeHtml, pacificTime, sendClassEmail } from "@/lib/classes/emails";
import { ageBandOn } from "@/lib/classes/age";
import { creditedMinutes, toMs, type AttendanceSpan } from "@/lib/classes/minutes";
import {
  codeVerdict,
  computeCodeFlags,
  flaggedStudentIds,
  mediaMinutesFromEvents,
  oneOnOneMs,
  stricterVerdict,
  sumMinutes,
  type CodeFlag,
  type MediaMinutes,
  type ReviewChatLine,
  type ReviewPerson,
  type ReviewTranscriptLine,
} from "@/lib/classes/code-flags";
import {
  REVIEW_PROMPT_VERSION,
  buildReviewPrompt,
  callReviewModel,
  isRestrictedReview,
  modelVerdict,
  parseModelReview,
  type StoredModelFlag,
} from "@/lib/classes/review-prompt";
import { reviewMails, reviewRestricted, type ReviewAudience, type ReviewMail } from "@/lib/classes/safety-routing";
import { holdClass } from "@/lib/classes/holds";
import { allClassRows } from "@/lib/classes/paged";
import type {
  ClassAttendanceRow,
  ClassChatMessageRow,
  ClassReviewRow,
  ClassRole,
  ClassSessionRow,
  ClassStatus,
  ReviewStatus,
  ReviewVerdict,
  RtkApp,
  TranscriptLine,
} from "@/lib/classes/types";

/**
 * The AI notes for a class (classes-design.md section 7): code flags, then
 * Claude through Vercel's AI Gateway, then routing, the evidence hold for an
 * urgent class, and the emails.
 *
 *   runClassReview(classId)       the webhook (when every transcript is in),
 *                                 reconcile, the sweep (30 minutes after the
 *                                 end, with whatever transcripts exist) and
 *                                 "Rerun notes" ({ force: true }) call it.
 *   loadReviewFacts(classId)      everything a review knows about a class;
 *                                 /admin/classes/[id] renders from it too.
 *
 * Never throws: a failure is stored as `failed` and the sweep retries it, up
 * to 3 attempts, 30 minutes apart. A refusal is not a failure: it's stored as
 * `refused`, restricted and urgent, a hold is taken, and the safety lead gets
 * it (section 7.5). Every model request asks the gateway for zero data
 * retention (review-prompt.ts).
 *
 * Emails go out once per review (class_reviews.emailed_at). A forced rerun
 * mails again only when it raises the verdict to urgent.
 */

/* ── The facts ─────────────────────────────────────────────────────── */

export type ReviewClass = {
  id: string;
  title: string;
  description: string | null;
  teacher_id: string | null;
  starts_at: string;
  duration_minutes: number;
  hard_end_at: string;
  capacity: number;
  status: ClassStatus;
  rtk_app: RtkApp;
  rtk_meeting_id: string | null;
  live_started_at: string | null;
  ended_at: string | null;
  end_reason: string | null;
  credited_minutes: number | null;
  credited_minutes_computed: number | null;
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
  keep_evidence: boolean;
  lesson_id: string | null;
  module_id: string | null;
};

export const REVIEW_CLASS_COLUMNS =
  "id, title, description, teacher_id, starts_at, duration_minutes, hard_end_at, capacity, status, rtk_app, " +
  "rtk_meeting_id, live_started_at, ended_at, end_reason, credited_minutes, credited_minutes_computed, " +
  "decided_at, decided_by, decision_note, keep_evidence, lesson_id, module_id";

export type ReviewTopic = { kind: "lesson" | "module"; title: string; url: string } | null;

/** A transcript line on the class's timeline, with the label the page shows. */
export type TimedTranscriptLine = ReviewTranscriptLine & { sessionId: string; label: string };
export type TimedChatLine = ReviewChatLine & { id: number; username: string; sentAt: string };

export type ReviewReport = {
  id: string;
  reporterId: string | null;
  reportedUserId: string | null;
  reportedUsername: string | null;
  reason: string;
  status: string;
  createdAt: string;
  /** What the reporter wrote. The review page shows it to the safety lead only. */
  details: string | null;
};

export type ReviewFacts = {
  cls: ReviewClass;
  topic: ReviewTopic;
  minStudentAccountDays: number;
  sessions: ClassSessionRow[];
  attendance: ClassAttendanceRow[];
  spans: AttendanceSpan[];
  /** Everyone known in the class: teacher first, students by first join, staff. */
  people: ReviewPerson[];
  usernames: Map<string, string | null>;
  /** The class's timeline starts here (the first session's start). */
  refMs: number;
  /** When the class ended, for the 30-minute rule: ended_at, the last session's end, or the hard end. */
  endedMs: number;
  transcript: TimedTranscriptLine[];
  transcriptSessions: number;
  wordCount: number;
  chat: TimedChatLine[];
  media: MediaMinutes;
  duplicatePeerUserIds: string[];
  removedUserIds: string[];
  reports: ReviewReport[];
  networkHashes: { userId: string; ipHash: string }[];
  parentSameNetworkUserIds: string[];
  firstClass: boolean;
  staffPresent: boolean;
  teacherMinutes: number;
  oneOnOneMinutes: number;
};

type TopicJoin = {
  lesson: { title: string; slug: string; modules: { slug: string; departments: { slug: string } | null } | null } | null;
  module: { title: string; slug: string; departments: { slug: string } | null } | null;
};

const TOPIC_SELECT =
  "lesson:lessons!classes_lesson_id_fkey(title, slug, modules(slug, departments(slug))), " +
  "module:modules!classes_module_id_fkey(title, slug, departments(slug))";

function topicFrom(j: TopicJoin | null): ReviewTopic {
  const l = j?.lesson;
  if (l?.modules?.departments) {
    return { kind: "lesson", title: l.title, url: `${SITE_URL}/guides/${l.modules.departments.slug}/${l.modules.slug}/${l.slug}` };
  }
  const m = j?.module;
  if (m?.departments) return { kind: "module", title: m.title, url: `${SITE_URL}/guides/${m.departments.slug}/${m.slug}` };
  return null;
}

/** A user id from class_events detail, whatever the writer called it. */
function detailUserId(detail: unknown): string | null {
  if (!detail || typeof detail !== "object") return null;
  const d = detail as Record<string, unknown>;
  for (const k of ["userId", "user_id", "subjectUserId", "removedUserId"]) {
    if (isUuid(d[k])) return d[k] as string;
  }
  return null;
}

/** Loads one class's review facts. Null when the class doesn't exist. */
export async function loadReviewFacts(classId: string): Promise<ReviewFacts | null> {
  if (!isUuid(classId)) return null;
  const admin = createAdminClient();
  const { data: clsRow } = await admin
    .from("classes")
    .select(`${REVIEW_CLASS_COLUMNS}, ${TOPIC_SELECT}`)
    .eq("id", classId)
    .maybeSingle();
  if (!clsRow) return null;
  const cls = clsRow as unknown as ReviewClass & TopicJoin;

  const [settings, sessionsQ, attendanceQ, participantsQ, chatQ, transcriptsQ, mediaQ, eventsQ, reportsQ, consentsQ, priorQ] =
    await Promise.all([
      getClassSettings(),
      admin.from("class_sessions").select("*").eq("class_id", classId).order("started_at", { ascending: true }),
      admin.from("class_attendance").select("*").eq("class_id", classId).order("joined_at", { ascending: true }),
      admin.from("class_participants").select("user_id, role, first_joined_at").eq("class_id", classId),
      // Paged: production answers at most 1000 rows a request, and a long
      // chat's latest messages (blocked ones included) must reach the review.
      allClassRows<ClassChatMessageRow>(admin, "class_chat_messages", "*", classId).then((data) => ({ data })),
      admin.from("class_transcripts").select("session_id, lines, word_count").eq("class_id", classId),
      allClassRows<{ id: number; subject_user_id: string | null; kind: "camera" | "screenshare"; is_on: boolean; at: string; reported_by: string | null }>(
        admin,
        "class_media_events",
        "id, subject_user_id, kind, is_on, at, reported_by",
        classId
      ).then((data) => ({ data })),
      admin.from("class_events").select("kind, detail").eq("class_id", classId).in("kind", ["duplicate_peer", "removed_participant"]),
      admin
        .from("user_reports")
        .select("id, reporter_id, reported_user_id, reported_username, reason, status, created_at, details")
        .eq("content_kind", "class")
        .eq("content_id", classId)
        .order("created_at", { ascending: true }),
      admin
        .from("class_consents")
        .select("user_id, ip_hash")
        .eq("class_id", classId)
        .eq("kind", "recording_notice")
        .not("ip_hash", "is", null),
      cls.teacher_id
        ? admin
            .from("classes")
            .select("id", { count: "exact", head: true })
            .eq("teacher_id", cls.teacher_id)
            .eq("status", "approved")
            .lt("starts_at", cls.starts_at)
            .neq("id", classId)
        : Promise.resolve({ count: 0 }),
    ]);

  const sessions = (sessionsQ.data ?? []) as ClassSessionRow[];
  const attendance = (attendanceQ.data ?? []) as ClassAttendanceRow[];
  const participants = (participantsQ.data ?? []) as { user_id: string; role: ClassRole; first_joined_at: string }[];
  const chatRows = (chatQ.data ?? []) as ClassChatMessageRow[];
  const transcripts = (transcriptsQ.data ?? []) as { session_id: string; lines: TranscriptLine[]; word_count: number }[];

  const startsMs = toMs(cls.starts_at);
  const sessionStarts = sessions.map((s) => (s.started_at ? toMs(s.started_at) : NaN)).filter(Number.isFinite);
  const firstJoin = attendance.length ? Math.min(...attendance.map((a) => toMs(a.joined_at))) : NaN;
  const refMs = sessionStarts.length ? Math.min(...sessionStarts) : Number.isFinite(firstJoin) ? firstJoin : startsMs;
  const sessionEnds = sessions.map((s) => (s.ended_at ? toMs(s.ended_at) : NaN)).filter(Number.isFinite);
  const endedMs = cls.ended_at
    ? toMs(cls.ended_at)
    : sessionEnds.length
      ? Math.max(...sessionEnds)
      : toMs(cls.hard_end_at);
  const sessionEnd = new Map(sessions.map((s) => [s.id, s.ended_at]));
  const sessionStart = new Map(sessions.map((s) => [s.id, s.started_at ? toMs(s.started_at) : null]));

  // Who's who: roles from attendance, then participants, then the class.
  const role = new Map<string, ClassRole>();
  const firstSeen = new Map<string, number>();
  const seen = (id: string | null, r: ClassRole, at: number) => {
    if (!id) return;
    if (!role.has(id) || (role.get(id) !== "teacher" && r === "teacher")) role.set(id, r);
    firstSeen.set(id, Math.min(firstSeen.get(id) ?? Infinity, at));
  };
  if (cls.teacher_id) seen(cls.teacher_id, "teacher", -Infinity);
  for (const a of attendance) seen(a.user_id, a.role, toMs(a.joined_at));
  for (const p of participants) seen(p.user_id, p.role, toMs(p.first_joined_at));
  for (const c of chatRows) seen(c.sender_id, c.sender_role, toMs(c.sent_at));

  const ids = [...role.keys()];
  const [profilesQ, agesQ, parentsQ] = await Promise.all([
    ids.length ? admin.from("profiles").select("id, username").in("id", ids) : Promise.resolve({ data: [] }),
    ids.length ? admin.from("class_age_checks").select("user_id, birth_year, birth_month").in("user_id", ids) : Promise.resolve({ data: [] }),
    ids.length
      ? admin
          .from("class_parent_consents")
          .select("student_id")
          .in("student_id", ids)
          .eq("status", "agreed")
          .eq("same_network", true)
      : Promise.resolve({ data: [] }),
  ]);
  const usernames = new Map<string, string | null>(ids.map((id) => [id, null]));
  for (const p of (profilesQ.data ?? []) as { id: string; username: string | null }[]) usernames.set(p.id, p.username || null);
  const classDate = new Date(startsMs);
  const bands = new Map<string, ReviewPerson["ageBand"]>();
  for (const a of (agesQ.data ?? []) as { user_id: string; birth_year: number; birth_month: number }[]) {
    bands.set(a.user_id, ageBandOn(classDate, a.birth_year, a.birth_month));
  }
  const accountAge = new Map<string, number>();
  for (const a of attendance) {
    if (a.user_id && a.account_age_days != null) {
      accountAge.set(a.user_id, Math.min(accountAge.get(a.user_id) ?? Infinity, a.account_age_days));
    }
  }
  const order: Record<ClassRole, number> = { teacher: 0, student: 1, staff: 2 };
  const people: ReviewPerson[] = ids
    .map((id) => ({
      userId: id,
      username: usernames.get(id) ?? null,
      role: role.get(id)!,
      ageBand: role.get(id) === "staff" ? null : (bands.get(id) ?? null),
      accountAgeDays: accountAge.get(id) ?? null,
    }))
    .sort((a, b) => order[a.role] - order[b.role] || (firstSeen.get(a.userId) ?? 0) - (firstSeen.get(b.userId) ?? 0));

  const spans: AttendanceSpan[] = attendance.map((a) => ({
    userId: a.user_id,
    role: a.role,
    joinedAt: a.joined_at,
    leftAt: a.left_at,
    accountAgeDays: a.account_age_days,
    sessionEndedAt: sessionEnd.get(a.session_id) ?? null,
  }));

  const transcript: TimedTranscriptLine[] = [];
  let words = 0;
  for (const t of transcripts) {
    const offset = ((sessionStart.get(t.session_id) ?? refMs) - refMs) / 1000;
    words += t.word_count ?? 0;
    for (const l of Array.isArray(t.lines) ? t.lines : []) {
      transcript.push({
        atSeconds: offset + (Number(l.t0) || 0),
        userId: l.userId ?? null,
        role: l.role ?? (l.userId ? (role.get(l.userId) ?? null) : null),
        text: String(l.text ?? ""),
        sessionId: t.session_id,
        label: l.label || "unknown speaker",
      });
    }
  }
  transcript.sort((a, b) => a.atSeconds - b.atSeconds);

  const chat: TimedChatLine[] = chatRows.map((c) => ({
    id: c.id,
    atSeconds: (toMs(c.sent_at) - refMs) / 1000,
    userId: c.sender_id,
    role: c.sender_role,
    status: c.status,
    blockedKinds: c.blocked_kinds ?? [],
    body: c.body,
    username: c.sender_username,
    sentAt: c.sent_at,
  }));

  const closeAt = Math.min(endedMs, toMs(cls.hard_end_at));
  const media = mediaMinutesFromEvents(
    ((mediaQ.data ?? []) as { subject_user_id: string | null; kind: "camera" | "screenshare"; is_on: boolean; at: string; reported_by: string | null }[]).map(
      (e) => ({ subjectUserId: e.subject_user_id, kind: e.kind, isOn: e.is_on, at: e.at, reportedBy: e.reported_by })
    ),
    closeAt
  );

  const events = (eventsQ.data ?? []) as { kind: string; detail: unknown }[];
  const reports: ReviewReport[] = ((reportsQ.data ?? []) as Record<string, string | null>[]).map((r) => ({
    id: r.id as string,
    reporterId: r.reporter_id,
    reportedUserId: r.reported_user_id,
    reportedUsername: r.reported_username,
    reason: r.reason as string,
    status: r.status as string,
    createdAt: r.created_at as string,
    details: r.details ?? null,
  }));

  return {
    cls,
    topic: topicFrom(cls),
    minStudentAccountDays: settings.min_student_account_days,
    sessions,
    attendance,
    spans,
    people,
    usernames,
    refMs,
    endedMs,
    transcript,
    transcriptSessions: transcripts.length,
    wordCount: words,
    chat,
    media,
    duplicatePeerUserIds: events.filter((e) => e.kind === "duplicate_peer").map((e) => detailUserId(e.detail)).filter((x): x is string => !!x),
    removedUserIds: events.filter((e) => e.kind === "removed_participant").map((e) => detailUserId(e.detail)).filter((x): x is string => !!x),
    reports,
    networkHashes: ((consentsQ.data ?? []) as { user_id: string | null; ip_hash: string }[])
      .filter((c) => c.user_id)
      .map((c) => ({ userId: c.user_id as string, ipHash: c.ip_hash })),
    parentSameNetworkUserIds: ((parentsQ.data ?? []) as { student_id: string }[]).map((p) => p.student_id),
    firstClass: !!cls.teacher_id && (priorQ.count ?? 0) === 0,
    staffPresent: attendance.some((a) => a.role === "staff"),
    teacherMinutes: creditedMinutes({
      attendance: spans,
      startsAt: cls.starts_at,
      hardEndAt: cls.hard_end_at,
      minStudentAccountDays: settings.min_student_account_days,
    }),
    oneOnOneMinutes: Math.floor(oneOnOneMs(spans, cls.hard_end_at) / 60_000),
  };
}

/** The code flags for a set of facts. */
export function codeFlagsFor(f: ReviewFacts, opts: { noTranscriptDue: boolean }): CodeFlag[] {
  return computeCodeFlags({
    people: f.people,
    attendance: f.spans,
    startsAt: f.cls.starts_at,
    hardEndAt: f.cls.hard_end_at,
    durationMinutes: f.cls.duration_minutes,
    transcript: f.transcript,
    hasTranscript: f.transcriptSessions > 0,
    noTranscriptDue: opts.noTranscriptDue,
    wordCount: f.wordCount,
    chat: f.chat,
    media: f.media,
    duplicatePeerUserIds: f.duplicatePeerUserIds,
    removedUserIds: f.removedUserIds,
    reports: f.reports.map((r) => ({ reportedUserId: r.reportedUserId, reportedUsername: r.reportedUsername, reason: r.reason })),
    networkHashes: f.networkHashes,
    parentSameNetworkUserIds: f.parentSameNetworkUserIds,
    minStudentAccountDays: f.minStudentAccountDays,
  });
}

/** Teacher minutes without the flagged students (the one-click exclusion). */
export function minutesWithoutFlagged(f: ReviewFacts, flags: readonly CodeFlag[]): { minutes: number; excluded: string[] } {
  const excluded = flaggedStudentIds(flags, f.people);
  return {
    excluded,
    minutes: creditedMinutes({
      attendance: f.spans,
      startsAt: f.cls.starts_at,
      hardEndAt: f.cls.hard_end_at,
      minStudentAccountDays: f.minStudentAccountDays,
      excludeUserIds: excluded,
    }),
  };
}

/* ── Email ─────────────────────────────────────────────────────────── */

/**
 * Where each audience's mail goes. The safety lead's is safetyEmail(), which
 * falls back to Dhiren's address in production (config.ts), never the owner's.
 */
export function addressFor(audience: ReviewAudience): string | null {
  return audience === "owner" ? ownerEmail() : safetyEmail();
}

/** A ReviewMail in the classes email layout. Every string is escaped here. */
export function renderClassMail(mail: ReviewMail): string {
  const sections = mail.sections
    .map(
      (s) =>
        `<p style="margin:18px 0 4px;font-weight:700;color:#16181B">${escapeHtml(s.title)}</p>${emailListHtml(s.lines.map(escapeHtml))}`
    )
    .join("");
  const notes = mail.notes.map((n) => `<p style="margin:12px 0 0;color:#565C60;font-size:14px">${escapeHtml(n)}</p>`).join("");
  return classEmailHtml({
    heading: mail.heading,
    intro: mail.intro ?? undefined,
    rows: mail.rows,
    bodyHtml: sections + notes,
    buttons: mail.buttons,
  });
}

/** Sends ReviewMails now (the caller is already running after the response). */
export async function sendClassMails(what: string, classId: string | null, mails: readonly ReviewMail[]): Promise<number> {
  let sent = 0;
  for (const mail of mails) {
    const to = addressFor(mail.audience);
    if (!to) {
      console.warn(`classes email (${what}): no address for the ${mail.audience}`);
      continue;
    }
    const res = await sendClassEmail(what, classId, { to, subject: mail.subject, html: renderClassMail(mail) });
    if (res.ok) sent++;
  }
  return sent;
}

function coverage(f: ReviewFacts): string {
  if (f.transcriptSessions === 0) return "none";
  const s = f.sessions.length || f.transcriptSessions;
  return `${f.transcriptSessions} of ${s} ${s === 1 ? "session" : "sessions"}, ${f.wordCount.toLocaleString("en-US")} words`;
}

function datePacific(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function mailsFor(
  f: ReviewFacts,
  r: {
    status: "ready" | "refused" | "no_transcript";
    verdict: ReviewVerdict;
    restricted: boolean;
    summary: string[];
    oneLine: string;
    codeFlags: CodeFlag[];
    modelFlags: StoredModelFlag[];
  }
): ReviewMail[] {
  const name = (id: string) => f.usernames.get(id) ?? null;
  const students = new Set(f.attendance.filter((a) => a.role === "student" && a.user_id).map((a) => a.user_id as string));
  return reviewMails({
    classId: f.cls.id,
    title: f.cls.title,
    whenPacific: pacificTime(f.cls.starts_at),
    datePacific: datePacific(f.cls.starts_at),
    teacherUsername: f.cls.teacher_id ? name(f.cls.teacher_id) : null,
    firstClass: f.firstClass,
    studentsJoined: students.size,
    teacherMinutes: f.teacherMinutes,
    transcriptCoverage: coverage(f),
    camera: Object.entries(f.media.camera).map(([id, minutes]) => ({ username: name(id), minutes })),
    screenshare: Object.entries(f.media.screenshare).map(([id, minutes]) => ({ username: name(id), minutes })),
    chatBlockedCount: f.chat.filter((c) => c.status === "blocked").length,
    status: r.status,
    verdict: r.verdict,
    restricted: r.restricted,
    summary: r.summary,
    oneLine: r.oneLine,
    codeFlags: r.codeFlags,
    modelFlags: r.modelFlags,
    reviewUrl: adminClassUrl(f.cls.id),
    playbookUrl: playbookUrl(),
  });
}

/* ── The run ───────────────────────────────────────────────────────── */

/** The model's id for class_reviews.model. */
function modelName(model: LanguageModel | undefined): string {
  if (!model) return reviewModel();
  if (typeof model === "string") return model;
  const m = model as { provider?: string; modelId?: string };
  return [m.provider, m.modelId].filter(Boolean).join("/") || "custom";
}

/** class_reviews.error while a run holds the row. */
const RUNNING = "running";
const RUN_LEASE_MS = 6 * 60_000;
const DONE: ReadonlySet<ReviewStatus> = new Set(["ready", "refused", "no_transcript"]);
const NO_TRANSCRIPT_AFTER_MS = 30 * 60_000;

export type RunReviewOptions = {
  /** Rerun even when notes exist ("Rerun notes"). */
  force?: boolean;
  /** Tests pass a mock model (MockLanguageModelV4); otherwise the gateway id from config. */
  model?: LanguageModel;
  now?: Date;
};

/**
 * Runs (or reruns, with `force`) the review for an ended class and stores it
 * in class_reviews. Idempotent: a class already `ready` is left alone unless
 * forced. Never throws; a failure is stored as `failed` for the sweep to retry.
 */
export async function runClassReview(
  classId: string,
  opts: RunReviewOptions = {}
): Promise<Result<{ status: ReviewStatus }>> {
  try {
    return await run(classId, opts);
  } catch (e) {
    console.error("runClassReview:", e);
    try {
      await createAdminClient()
        .from("class_reviews")
        .update({ status: "failed", error: String((e as Error)?.message ?? e).slice(0, 500), updated_at: new Date().toISOString() })
        .eq("class_id", classId);
    } catch {
      // nothing more to do; the sweep will look again
    }
    return { ok: true, status: "failed" };
  }
}

async function run(classId: string, opts: RunReviewOptions): Promise<Result<{ status: ReviewStatus }>> {
  if (!isUuid(classId)) return fail("not_found", "That class doesn't exist.");
  const now = opts.now ?? new Date();
  const admin = createAdminClient();
  const { data: cls } = await admin.from("classes").select("id, status, rtk_app").eq("id", classId).maybeSingle();
  if (!cls) return fail("not_found", "That class doesn't exist.");
  if (cls.rtk_app !== rtkApp()) return fail("forbidden", "That class belongs to the other RealtimeKit app.");

  const { data: existingRow } = await admin.from("class_reviews").select("*").eq("class_id", classId).maybeSingle();
  const existing = existingRow as ClassReviewRow | null;
  const status = cls.status as ClassStatus;
  const reviewable = status === "ended" || status === "in_review" || (opts.force && (status === "approved" || status === "rejected"));
  if (!reviewable) return { ok: true, status: existing?.status ?? "pending" };
  if (!opts.force && existing && DONE.has(existing.status)) return { ok: true, status: existing.status };
  if (existing?.error === RUNNING && now.getTime() - Date.parse(existing.updated_at) < RUN_LEASE_MS) {
    return { ok: true, status: existing.status };
  }
  if (!opts.force && existing?.status === "failed" && existing.attempts >= 3) return { ok: true, status: "failed" };

  const facts = await loadReviewFacts(classId);
  if (!facts) return fail("not_found", "That class doesn't exist.");
  const hasTranscript = facts.transcriptSessions > 0;
  const allTranscripts = facts.sessions.length > 0 && facts.sessions.every((s) => s.transcript_status === "stored");
  const waited = now.getTime() - facts.endedMs >= NO_TRANSCRIPT_AFTER_MS;
  if (!opts.force && !allTranscripts && !waited) {
    // Not due yet: transcripts are still coming. The webhook or the sweep comes back.
    if (!existing) await admin.from("class_reviews").upsert({ class_id: classId }, { onConflict: "class_id", ignoreDuplicates: true });
    return { ok: true, status: existing?.status ?? "pending" };
  }

  // Claim the row (compare-and-swap on attempts), so the webhook and the
  // sweep never run the same review twice at once.
  if (!existing) {
    await admin.from("class_reviews").upsert({ class_id: classId }, { onConflict: "class_id", ignoreDuplicates: true });
  }
  const { data: fresh } = await admin
    .from("class_reviews")
    .select("attempts, verdict, emailed_at, status, restricted")
    .eq("class_id", classId)
    .maybeSingle();
  const attempts = (fresh?.attempts as number | undefined) ?? 0;
  const { data: claimed } = await admin
    .from("class_reviews")
    .update({ attempts: attempts + 1, error: RUNNING, updated_at: now.toISOString() })
    .eq("class_id", classId)
    .eq("attempts", attempts)
    .select("class_id");
  if (!claimed?.length) return { ok: true, status: (fresh?.status as ReviewStatus | undefined) ?? "pending" };
  const previousVerdict = (fresh?.verdict as ReviewVerdict | null | undefined) ?? null;
  const previouslyEmailed = !!fresh?.emailed_at;

  const codeFlags = codeFlagsFor(facts, { noTranscriptDue: !hasTranscript });
  const base = {
    code_flags: codeFlags,
    one_on_one_minutes: facts.oneOnOneMinutes,
    camera_minutes: sumMinutes(facts.media.camera),
    screenshare_minutes: sumMinutes(facts.media.screenshare),
    chat_blocked_count: facts.chat.filter((c) => c.status === "blocked").length,
    prompt_version: REVIEW_PROMPT_VERSION,
  };

  let outcome: {
    status: "ready" | "refused" | "no_transcript";
    verdict: ReviewVerdict;
    restricted: boolean;
    summary: string[];
    oneLine: string;
    lessonMatch: string | null;
    modelFlags: StoredModelFlag[];
    refusalCategory: string | null;
    model: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
  };

  // A class nobody ever joined (the sweep ended it with no session) has
  // nothing to review and nobody to warn: it's stored quietly, unless someone
  // reported it.
  const neverStarted = facts.sessions.length === 0 && facts.attendance.length === 0 && facts.reports.length === 0;

  if (neverStarted) {
    outcome = {
      status: "no_transcript",
      verdict: "looks_fine",
      restricted: false,
      summary: [],
      oneLine: "Nobody joined this class, so there's nothing to review.",
      lessonMatch: null,
      modelFlags: [],
      refusalCategory: null,
      model: null,
      inputTokens: null,
      outputTokens: null,
    };
    codeFlags.length = 0;
  } else if (!hasTranscript) {
    outcome = {
      status: "no_transcript",
      verdict: stricterVerdict("needs_review", codeVerdict(codeFlags)),
      restricted: false,
      summary: [],
      oneLine: "",
      lessonMatch: null,
      modelFlags: [],
      refusalCategory: null,
      model: null,
      inputTokens: null,
      outputTokens: null,
    };
  } else {
    const modelId = modelName(opts.model);
    const { prompt, labels } = buildReviewPrompt({
      title: facts.cls.title,
      topic: facts.topic,
      startsAtPacific: pacificTime(facts.cls.starts_at),
      durationMinutes: facts.cls.duration_minutes,
      firstClass: facts.firstClass,
      staffPresent: facts.staffPresent,
      people: facts.people,
      teacherMinutes: facts.teacherMinutes,
      oneOnOneMinutes: facts.oneOnOneMinutes,
      camera: facts.media.camera,
      screenshare: facts.media.screenshare,
      codeFlags,
      transcript: facts.transcript,
      chat: facts.chat,
    });
    const res = await callReviewModel({ model: opts.model ?? reviewModel(), prompt });
    if (res.kind === "error") {
      await admin
        .from("class_reviews")
        .update({ ...base, status: "failed", model: modelId, error: res.error, updated_at: new Date().toISOString() })
        .eq("class_id", classId);
      return { ok: true, status: "failed" };
    }
    if (res.kind === "refused") {
      outcome = {
        status: "refused",
        verdict: "urgent",
        restricted: true,
        summary: [],
        oneLine: "",
        lessonMatch: null,
        modelFlags: [],
        refusalCategory: res.category,
        model: modelId,
        inputTokens: res.inputTokens,
        outputTokens: res.outputTokens,
      };
    } else {
      const parsed = parseModelReview(res.output, labels, facts.people);
      if (!parsed) {
        await admin
          .from("class_reviews")
          .update({ ...base, status: "failed", model: modelId, error: "The model's answer wasn't usable.", updated_at: new Date().toISOString() })
          .eq("class_id", classId);
        return { ok: true, status: "failed" };
      }
      outcome = {
        status: "ready",
        verdict: stricterVerdict(modelVerdict(parsed), codeVerdict(codeFlags)),
        restricted: isRestrictedReview(parsed.flags, false),
        summary: parsed.summary,
        oneLine: parsed.oneLine,
        lessonMatch: parsed.lessonMatch,
        modelFlags: parsed.flags,
        refusalCategory: null,
        model: modelId,
        inputTokens: res.inputTokens,
        outputTokens: res.outputTokens,
      };
    }
  }

  // Restricted (the safety lead only) when the model or a refusal says so,
  // when a student had a camera or screen share on (the AI can't see video,
  // and that's the sextortion signal), or when it already was: a class report
  // with reason `sexual` restricts the class at once (reports.ts), and a
  // forced rerun never lifts a restriction. Only releaseReview and
  // releaseHold lower it.
  const restricted = reviewRestricted({
    runRestricted: outcome.restricted,
    codeFlags,
    alreadyRestricted: fresh?.restricted === true,
  });

  const summaryMd = outcome.summary.length || outcome.oneLine
    ? [outcome.oneLine, outcome.summary.map((s) => `- ${s}`).join("\n")].filter(Boolean).join("\n\n")
    : null;
  const { error: saveError } = await admin
    .from("class_reviews")
    .update({
      ...base,
      status: outcome.status,
      model: outcome.model,
      verdict: outcome.verdict,
      lesson_match: outcome.lessonMatch,
      summary_md: summaryMd,
      flags: outcome.modelFlags,
      refusal_category: outcome.refusalCategory,
      // Only ever raised here, so a report that restricts the class while
      // this run is going isn't undone by it.
      ...(restricted ? { restricted: true } : {}),
      input_tokens: outcome.inputTokens,
      output_tokens: outcome.outputTokens,
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("class_id", classId);
  if (saveError) throw new Error(`saving the review: ${saveError.message}`);

  // The class moves to review, and its computed minutes are current.
  await admin
    .from("classes")
    .update({ status: "in_review", updated_at: new Date().toISOString() })
    .eq("id", classId)
    .eq("status", "ended");
  if (status === "ended" || status === "in_review") {
    await admin.from("classes").update({ credited_minutes_computed: facts.teacherMinutes }).eq("id", classId).in("status", ["ended", "in_review"]);
  }

  // Urgent: keep the evidence (section 8.2), once per escalation.
  const escalated = outcome.verdict === "urgent" && previousVerdict !== "urgent";
  if (escalated) {
    const subjects = new Set<string>();
    for (const f of outcome.modelFlags) if (f.severity === "urgent" && f.speakerUserId) subjects.add(f.speakerUserId);
    for (const f of codeFlags) if (f.severity === "urgent" && f.userId) subjects.add(f.userId);
    const reason = outcome.status === "refused" ? "refusal" : "urgent_flag";
    const list = subjects.size ? [...subjects].slice(0, 5) : [null];
    for (const subjectUserId of list) {
      const held = await holdClass(classId, { reason, subjectUserId, createdBy: null });
      if (!held.ok) console.error("runClassReview: hold failed", held.error);
    }
  }

  if (!neverStarted && (!previouslyEmailed || escalated)) {
    const mails = mailsFor(facts, {
      status: outcome.status,
      verdict: outcome.verdict,
      restricted,
      summary: outcome.summary,
      oneLine: outcome.oneLine,
      codeFlags,
      modelFlags: outcome.modelFlags,
    });
    await sendClassMails(outcome.verdict === "urgent" ? "urgent review" : "review notes", classId, mails);
    await admin.from("class_reviews").update({ emailed_at: new Date().toISOString() }).eq("class_id", classId);
  }

  return { ok: true, status: outcome.status };
}
