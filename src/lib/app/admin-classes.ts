import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/app/http";
import { fail, type AppUser, type Failure, type Result } from "@/lib/app/result";
import {
  canSeeRestricted,
  requireClassReviewer,
  safetyLeadCandidateError,
  type ClassReviewerRole,
} from "@/lib/app/class-reviewers";
import { endClass, participantMinutesSoFar, setJoinsPaused } from "@/lib/app/classes-room";
import { revokeParentConsentBy } from "@/lib/app/class-consent";
import { refreshClassesOnStaticPages } from "@/lib/classes/static-pages";
import {
  SITE_URL,
  adminClassUrl,
  classSwitches,
  classesConfigured,
  classesDevSwitches,
  getClassSettings,
  rtkApp,
} from "@/lib/classes/config";
import { classEmailHtml, sendClassEmail } from "@/lib/classes/emails";
import { holdClass, releaseHold } from "@/lib/classes/holds";
import { clock, type CodeFlag } from "@/lib/classes/code-flags";
import { reconcileClass, type ReconcileReport } from "@/lib/classes/reconcile";
import {
  codeFlagsFor,
  loadReviewFacts,
  minutesWithoutFlagged,
  type ReviewReport,
  type ReviewTopic,
} from "@/lib/classes/review";
import type { StoredModelFlag } from "@/lib/classes/review-prompt";
import type {
  AgeBand,
  ClassReviewRow,
  ClassRole,
  ClassStatus,
  ParentConsentStatus,
  ReviewStatus,
  ReviewVerdict,
  RtkApp,
} from "@/lib/classes/types";

/**
 * /admin/classes and /admin/classes/[id] as data (classes-design.md 7.6), and
 * every decision made there. The pages render from these and the actions in
 * src/app/actions/class-admin.ts call them.
 *
 * WHO. A super admin or the safety lead (class_settings.safety_lead_user_id),
 * through requireClassReviewer (src/lib/app/class-reviewers.ts). The safety
 * lead gets these pages and nothing else in /admin. Restricted reviews
 * (grooming, sexual content, sextortion, signs of abuse, a refusal, a
 * student's camera or screen share, a class report of sexual content, which
 * restricts the class before the review runs) show their notes,
 * transcript, chat and recording only to someone canSeeRestricted allows (the
 * safety lead); everyone else sees "Dhiren is handling this one" until he
 * releases it. Settings and visibility are a super admin's.
 *
 * Every exported "...As" function takes a ClassReviewer, which only
 * reviewerFor() hands out after the access check. The pages and actions get
 * one that way; tests build one by hand.
 */

export type ClassReviewer = {
  userId: string;
  role: ClassReviewerRole;
  /** Restricted reviews are readable (the safety lead). */
  canSeeRestricted: boolean;
};

/** The access check. Everything below takes what this returns. */
export async function reviewerFor(user: AppUser): Promise<{ ok: true; reviewer: ClassReviewer } | Failure> {
  const gate = await requireClassReviewer(user);
  if (!gate.ok) return gate;
  return { ok: true, reviewer: { userId: user.id, role: gate.role, canSeeRestricted: await canSeeRestricted(user) } };
}

export const HANDLING_LINE = "Dhiren is handling this one.";
const NOT_SUPER = "Only a super admin can change this.";
const NOT_FOUND = "That class doesn't exist.";
const OTHER_APP = "That class belongs to the other RealtimeKit app, so this server can't manage it.";
const RESTRICTED = `This review is restricted. ${HANDLING_LINE}`;

const nowIso = () => new Date().toISOString();

async function usernames(ids: (string | null | undefined)[]): Promise<Map<string, string | null>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const out = new Map<string, string | null>();
  if (!unique.length) return out;
  const { data } = await createAdminClient().from("profiles").select("id, username").in("id", unique);
  for (const p of data ?? []) out.set(p.id as string, (p.username as string | null) || null);
  return out;
}

/* ── The desk (/admin/classes) ─────────────────────────────────────── */

export type DeskClass = {
  id: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  hardEndAt: string;
  status: ClassStatus;
  endedAt: string | null;
  endReason: string | null;
  teacherId: string | null;
  teacherUsername: string | null;
  firstClass: boolean;
  enrolled: number;
  presentNow: number;
  reviewStatus: ReviewStatus | null;
  verdict: ReviewVerdict | null;
  restricted: boolean;
  creditedMinutes: number | null;
  creditedMinutesComputed: number | null;
};

export type ClassesDesk = {
  role: ClassReviewerRole;
  canSeeRestricted: boolean;
  isSuperAdmin: boolean;
  app: RtkApp;
  configured: boolean;
  switches: {
    envVisible: boolean;
    dbVisible: boolean;
    visible: boolean;
    joinsPaused: boolean;
    pausedReason: string | null;
    devOverride: boolean;
  };
  settings: {
    monthlyMinuteCap: number;
    maxLiveClasses: number;
    minStudentAccountDays: number;
    safetyLead: { userId: string; username: string | null } | null;
  };
  minutesThisMonth: number;
  capPercent: number;
  emailFailures: { at: string; what: string; error: string; classId: string | null }[];
  unknownMeetings: { at: string; meetingId: string; event: string }[];
  live: DeskClass[];
  waiting: DeskClass[];
  upcoming: DeskClass[];
  decided: DeskClass[];
};

const VERDICT_ORDER: Record<string, number> = { urgent: 0, needs_review: 1, looks_fine: 2 };

/**
 * The review queue's order (section 7.6): urgent first, then teachers' first
 * classes, then the oldest.
 */
export function compareWaiting(a: DeskClass, b: DeskClass): number {
  const urgent = (c: DeskClass) => (c.verdict === "urgent" ? 0 : 1);
  if (urgent(a) !== urgent(b)) return urgent(a) - urgent(b);
  const first = (c: DeskClass) => (c.firstClass ? 0 : 1);
  if (first(a) !== first(b)) return first(a) - first(b);
  const when = (c: DeskClass) => Date.parse(c.endedAt ?? c.hardEndAt);
  return when(a) - when(b) || (VERDICT_ORDER[a.verdict ?? ""] ?? 3) - (VERDICT_ORDER[b.verdict ?? ""] ?? 3);
}

/**
 * Participant-minutes so far this month (UTC), the cap's own measure
 * (participantMinutesSoFar in classes-room.ts, staff included, since
 * Cloudflare bills them), so the desk's figure is the number joinClass checks.
 */
export async function participantMinutesThisMonth(now: Date = new Date()): Promise<number> {
  return participantMinutesSoFar(now);
}

export async function loadClassesDeskAs(r: ClassReviewer, now: Date = new Date()): Promise<ClassesDesk> {
  const admin = createAdminClient();
  const app = rtkApp();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const cols =
    "id, title, starts_at, duration_minutes, hard_end_at, status, ended_at, end_reason, teacher_id, credited_minutes, credited_minutes_computed";

  const [settings, switches, live, waiting, upcoming, decided, failures, unknown, minutes] = await Promise.all([
    getClassSettings(),
    classSwitches(),
    admin.from("classes").select(cols).eq("rtk_app", app).eq("status", "live").order("starts_at"),
    admin.from("classes").select(cols).eq("rtk_app", app).in("status", ["ended", "in_review"]).order("hard_end_at").limit(200),
    admin
      .from("classes")
      .select(cols)
      .eq("rtk_app", app)
      .eq("status", "scheduled")
      .gte("hard_end_at", now.toISOString())
      .order("starts_at")
      .limit(50),
    admin
      .from("classes")
      .select(cols)
      .eq("rtk_app", app)
      .in("status", ["approved", "rejected", "canceled"])
      .gte("updated_at", monthAgo)
      .order("updated_at", { ascending: false })
      .limit(30),
    admin
      .from("class_events")
      .select("class_id, detail, created_at")
      .eq("kind", "email_failed")
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("class_events")
      .select("detail, created_at")
      .eq("kind", "unknown_meeting")
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(20),
    participantMinutesThisMonth(now),
  ]);

  type Row = {
    id: string;
    title: string;
    starts_at: string;
    duration_minutes: number;
    hard_end_at: string;
    status: ClassStatus;
    ended_at: string | null;
    end_reason: string | null;
    teacher_id: string | null;
    credited_minutes: number | null;
    credited_minutes_computed: number | null;
  };
  const all = [live, waiting, upcoming, decided].flatMap((q) => (q.data ?? []) as Row[]);
  const ids = all.map((c) => c.id);
  const teacherIds = [...new Set(all.map((c) => c.teacher_id).filter((x): x is string => !!x))];
  const [names, reviews, enrolled, present, approvedBefore] = await Promise.all([
    usernames([...teacherIds, settings.safety_lead_user_id]),
    ids.length ? admin.from("class_reviews").select("class_id, status, verdict, restricted").in("class_id", ids) : Promise.resolve({ data: [] }),
    ids.length
      ? admin.from("class_enrollments").select("class_id").in("class_id", ids).eq("status", "enrolled")
      : Promise.resolve({ data: [] }),
    (live.data ?? []).length
      ? admin
          .from("class_attendance")
          .select("class_id, user_id")
          .in("class_id", (live.data ?? []).map((c) => c.id as string))
          .is("left_at", null)
      : Promise.resolve({ data: [] }),
    teacherIds.length
      ? admin.from("classes").select("teacher_id, starts_at").in("teacher_id", teacherIds).eq("status", "approved")
      : Promise.resolve({ data: [] }),
  ]);
  const reviewBy = new Map(((reviews.data ?? []) as { class_id: string; status: ReviewStatus; verdict: ReviewVerdict | null; restricted: boolean }[]).map((x) => [x.class_id, x]));
  const count = (rows: { class_id: string }[]) => {
    const m = new Map<string, Set<string>>();
    for (const r of rows as { class_id: string; user_id?: string }[]) {
      const s = m.get(r.class_id) ?? new Set<string>();
      s.add(r.user_id ?? `${s.size}`);
      m.set(r.class_id, s);
    }
    return m;
  };
  const enrolledBy = count((enrolled.data ?? []) as { class_id: string }[]);
  const presentBy = count((present.data ?? []) as { class_id: string }[]);
  const approved = (approvedBefore.data ?? []) as { teacher_id: string; starts_at: string }[];

  const toDesk = (c: Row): DeskClass => {
    const rev = reviewBy.get(c.id);
    return {
      id: c.id,
      title: c.title,
      startsAt: c.starts_at,
      durationMinutes: c.duration_minutes,
      hardEndAt: c.hard_end_at,
      status: c.status,
      endedAt: c.ended_at,
      endReason: c.end_reason,
      teacherId: c.teacher_id,
      teacherUsername: c.teacher_id ? (names.get(c.teacher_id) ?? null) : null,
      firstClass:
        !!c.teacher_id && !approved.some((a) => a.teacher_id === c.teacher_id && Date.parse(a.starts_at) < Date.parse(c.starts_at)),
      enrolled: enrolledBy.get(c.id)?.size ?? 0,
      presentNow: presentBy.get(c.id)?.size ?? 0,
      reviewStatus: rev?.status ?? null,
      verdict: rev?.verdict ?? null,
      restricted: !!rev?.restricted,
      creditedMinutes: c.credited_minutes,
      creditedMinutesComputed: c.credited_minutes_computed,
    };
  };

  const detail = (d: unknown) => (d && typeof d === "object" ? (d as Record<string, unknown>) : {});
  return {
    role: r.role,
    canSeeRestricted: r.canSeeRestricted,
    isSuperAdmin: r.role === "superadmin",
    app,
    configured: classesConfigured(),
    switches: {
      envVisible: process.env.CLASSES_VISIBLE === "1",
      dbVisible: settings.classes_visible,
      visible: switches.visible,
      joinsPaused: switches.joinsPaused,
      pausedReason: settings.paused_reason,
      devOverride: classesDevSwitches(),
    },
    settings: {
      monthlyMinuteCap: settings.monthly_minute_cap,
      maxLiveClasses: settings.max_live_classes,
      minStudentAccountDays: settings.min_student_account_days,
      safetyLead: settings.safety_lead_user_id
        ? { userId: settings.safety_lead_user_id, username: names.get(settings.safety_lead_user_id) ?? null }
        : null,
    },
    minutesThisMonth: minutes,
    capPercent: settings.monthly_minute_cap > 0 ? Math.min(100, Math.round((minutes / settings.monthly_minute_cap) * 100)) : 0,
    emailFailures: (failures.data ?? []).map((e) => ({
      at: e.created_at as string,
      what: String(detail(e.detail).what ?? "an email"),
      error: String(detail(e.detail).error ?? ""),
      classId: (e.class_id as string | null) ?? null,
    })),
    unknownMeetings: (unknown.data ?? []).map((e) => ({
      at: e.created_at as string,
      meetingId: String(detail(e.detail).meetingId ?? ""),
      event: String(detail(e.detail).event ?? ""),
    })),
    live: ((live.data ?? []) as Row[]).map(toDesk),
    waiting: ((waiting.data ?? []) as Row[]).map(toDesk).sort(compareWaiting),
    upcoming: ((upcoming.data ?? []) as Row[]).map(toDesk),
    decided: ((decided.data ?? []) as Row[]).map(toDesk),
  };
}

export async function loadClassesDesk(user: AppUser): Promise<Result<{ desk: ClassesDesk }>> {
  const g = await reviewerFor(user);
  if (!g.ok) return g;
  return { ok: true, desk: await loadClassesDeskAs(g.reviewer) };
}

/** Classes waiting on a decision, for /admin's "what wants a person" card. */
export async function pendingClassReviewCount(): Promise<number> {
  const { count } = await createAdminClient()
    .from("classes")
    .select("id", { count: "exact", head: true })
    .eq("rtk_app", rtkApp())
    .in("status", ["ended", "in_review"]);
  return count ?? 0;
}

/* ── One class (/admin/classes/[id]) ───────────────────────────────── */

export type ReviewPageAttendance = {
  userId: string | null;
  username: string | null;
  role: ClassRole;
  ageBand: AgeBand | null;
  /**
   * A student's parent or guardian's email, from their newest agreed parent
   * OK: what the playbook sends the safety lead here for. Null for anyone
   * else, and behind the same restricted gate as the transcript.
   */
  parentEmail: string | null;
  accountAgeDays: number | null;
  joinedAt: string;
  leftAt: string | null;
  minutes: number;
  source: string;
};

export type ReviewPage = {
  reviewer: { role: ClassReviewerRole; canSeeRestricted: boolean };
  id: string;
  title: string;
  description: string | null;
  topic: ReviewTopic;
  teacherId: string | null;
  teacherUsername: string | null;
  startsAt: string;
  durationMinutes: number;
  hardEndAt: string;
  liveStartedAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  status: ClassStatus;
  app: RtkApp;
  firstClass: boolean;
  keepEvidence: boolean;
  decision: { decidedAt: string | null; decidedBy: string | null; note: string | null; creditedMinutes: number | null };
  canDecide: boolean;
  /** Restricted and this reviewer can't see it: only the header and HANDLING_LINE show. */
  hidden: boolean;
  restricted: boolean;
  review: {
    status: ReviewStatus;
    verdict: ReviewVerdict | null;
    lessonMatch: string | null;
    summaryMd: string | null;
    flags: StoredModelFlag[];
    codeFlags: CodeFlag[];
    model: string | null;
    promptVersion: string | null;
    attempts: number;
    error: string | null;
    refusalCategory: string | null;
    emailedAt: string | null;
    updatedAt: string;
  } | null;
  attendance: ReviewPageAttendance[];
  minutes: {
    computed: number;
    withoutFlagged: number;
    excluded: { userId: string; username: string | null }[];
    oneOnOne: number;
    camera: { username: string | null; minutes: number; role: ClassRole | null }[];
    screenshare: { username: string | null; minutes: number; role: ClassRole | null }[];
  };
  transcript: { atSeconds: number; clock: string; label: string; role: ClassRole | null; text: string }[];
  chat: { id: number; atSeconds: number; clock: string; username: string; role: ClassRole; status: "shown" | "blocked"; kinds: string[]; body: string }[];
  recordings: { sessionId: string; url: string | null; expiresAt: string | null; available: boolean }[];
  reports: (ReviewReport & { reporterUsername: string | null })[];
  events: { kind: string; at: string; actorUsername: string | null; detail: Record<string, unknown> }[];
  holds: number;
};

export async function loadClassReviewAs(
  r: ClassReviewer,
  classId: string,
  now: Date = new Date()
): Promise<Result<{ page: ReviewPage }>> {
  if (!isUuid(classId)) return fail("not_found", NOT_FOUND);
  const facts = await loadReviewFacts(classId);
  if (!facts || facts.cls.rtk_app !== rtkApp()) return fail("not_found", NOT_FOUND);
  const admin = createAdminClient();
  const studentIds = [
    ...new Set(facts.attendance.filter((a) => a.role === "student" && a.user_id).map((a) => a.user_id as string)),
  ];
  const [reviewQ, eventsQ, holdsQ, parentsQ] = await Promise.all([
    admin.from("class_reviews").select("*").eq("class_id", classId).maybeSingle(),
    admin.from("class_events").select("kind, actor_id, detail, created_at").eq("class_id", classId).order("created_at", { ascending: true }).limit(200),
    admin.from("class_safety_holds").select("id", { count: "exact", head: true }).eq("class_id", classId),
    studentIds.length
      ? admin
          .from("class_parent_consents")
          .select("student_id, parent_email, decided_at")
          .in("student_id", studentIds)
          .eq("status", "agreed")
          .order("decided_at", { ascending: false })
      : Promise.resolve({ data: [] as { student_id: string; parent_email: string; decided_at: string | null }[] }),
  ]);
  const review = reviewQ.data as ClassReviewRow | null;
  const restricted = !!review?.restricted;
  const hidden = restricted && !r.canSeeRestricted;
  // Newest agreed parent OK per student (the query is newest first).
  const parentEmailOf = new Map<string, string>();
  for (const p of (parentsQ.data ?? []) as { student_id: string; parent_email: string }[]) {
    if (!parentEmailOf.has(p.student_id)) parentEmailOf.set(p.student_id, p.parent_email);
  }
  const c = facts.cls;
  const name = (id: string | null | undefined) => (id ? (facts.usernames.get(id) ?? null) : null);
  const roleOf = new Map(facts.people.map((p) => [p.userId, p]));

  const codeFlags = review?.code_flags?.length
    ? (review.code_flags as CodeFlag[])
    : codeFlagsFor(facts, { noTranscriptDue: facts.transcriptSessions === 0 && now.getTime() - facts.endedMs >= 30 * 60_000 });
  const without = minutesWithoutFlagged(facts, codeFlags);
  const events = (eventsQ.data ?? []) as { kind: string; actor_id: string | null; detail: Record<string, unknown>; created_at: string }[];
  const extraNames = await usernames([
    ...events.map((e) => e.actor_id),
    ...facts.reports.map((x) => x.reporterId),
    c.decided_by,
  ]);
  const anyName = (id: string | null | undefined) => (id ? (name(id) ?? extraNames.get(id) ?? null) : null);

  const page: ReviewPage = {
    reviewer: { role: r.role, canSeeRestricted: r.canSeeRestricted },
    id: c.id,
    title: c.title,
    description: c.description,
    topic: facts.topic,
    teacherId: c.teacher_id,
    teacherUsername: name(c.teacher_id),
    startsAt: c.starts_at,
    durationMinutes: c.duration_minutes,
    hardEndAt: c.hard_end_at,
    liveStartedAt: c.live_started_at,
    endedAt: c.ended_at,
    endReason: c.end_reason,
    status: c.status,
    app: c.rtk_app,
    firstClass: facts.firstClass,
    keepEvidence: c.keep_evidence,
    decision: {
      decidedAt: c.decided_at,
      decidedBy: anyName(c.decided_by),
      note: c.decision_note,
      creditedMinutes: c.credited_minutes,
    },
    canDecide: !hidden && (c.status === "ended" || c.status === "in_review"),
    hidden,
    restricted,
    review: review
      ? {
          status: review.status,
          verdict: hidden ? null : review.verdict,
          lessonMatch: hidden ? null : review.lesson_match,
          summaryMd: hidden ? null : review.summary_md,
          flags: hidden ? [] : ((review.flags ?? []) as StoredModelFlag[]),
          codeFlags: hidden ? [] : codeFlags,
          model: review.model,
          promptVersion: review.prompt_version,
          attempts: review.attempts,
          error: review.error,
          refusalCategory: hidden ? null : review.refusal_category,
          emailedAt: review.emailed_at,
          updatedAt: review.updated_at,
        }
      : null,
    attendance: hidden
      ? []
      : facts.attendance.map((a) => {
          const p = a.user_id ? roleOf.get(a.user_id) : undefined;
          const end = a.left_at ? Date.parse(a.left_at) : Math.min(facts.endedMs, Date.parse(c.hard_end_at), now.getTime());
          return {
            userId: a.user_id,
            username: name(a.user_id),
            role: a.role,
            ageBand: p?.ageBand ?? null,
            parentEmail: a.role === "student" && a.user_id ? (parentEmailOf.get(a.user_id) ?? null) : null,
            accountAgeDays: a.account_age_days,
            joinedAt: a.joined_at,
            leftAt: a.left_at,
            minutes: Math.max(0, Math.floor((end - Date.parse(a.joined_at)) / 60_000)),
            source: a.source,
          };
        }),
    minutes: {
      computed: facts.teacherMinutes,
      withoutFlagged: without.minutes,
      excluded: without.excluded.map((id) => ({ userId: id, username: name(id) })),
      oneOnOne: facts.oneOnOneMinutes,
      camera: Object.entries(facts.media.camera).map(([id, minutes]) => ({ username: name(id), minutes, role: roleOf.get(id)?.role ?? null })),
      screenshare: Object.entries(facts.media.screenshare).map(([id, minutes]) => ({ username: name(id), minutes, role: roleOf.get(id)?.role ?? null })),
    },
    transcript: hidden
      ? []
      : facts.transcript.map((l) => ({ atSeconds: l.atSeconds, clock: clock(l.atSeconds), label: l.label, role: l.role, text: l.text })),
    chat: hidden
      ? []
      : facts.chat.map((m) => ({
          id: m.id,
          atSeconds: m.atSeconds,
          clock: clock(m.atSeconds),
          username: m.username,
          role: m.role,
          status: m.status,
          kinds: m.blockedKinds,
          body: m.body,
        })),
    recordings: hidden
      ? []
      : facts.sessions.map((s) => {
          const available = !!s.recording_url && (!s.recording_expires_at || Date.parse(s.recording_expires_at) > now.getTime());
          return { sessionId: s.id, url: available ? s.recording_url : null, expiresAt: s.recording_expires_at, available };
        }),
    // What reporters wrote is for the safety lead: a super admin answers
    // reports on /admin/reports, which leaves out the restricted ones.
    reports: facts.reports.map((x) => ({
      ...x,
      details: r.canSeeRestricted ? x.details : null,
      reporterUsername: anyName(x.reporterId),
    })),
    events: hidden
      ? []
      : events.map((e) => ({ kind: e.kind, at: e.created_at, actorUsername: anyName(e.actor_id), detail: e.detail ?? {} })),
    holds: holdsQ.count ?? 0,
  };
  return { ok: true, page };
}

export async function loadClassReview(user: AppUser, classId: string): Promise<Result<{ page: ReviewPage }>> {
  const g = await reviewerFor(user);
  if (!g.ok) return g;
  return loadClassReviewAs(g.reviewer, classId);
}

/* ── Deciding ──────────────────────────────────────────────────────── */

export type DecideInput = {
  classId: string;
  decision: "approve" | "reject";
  /** Approve: a different number of minutes (a note is required). */
  minutesOverride?: number | null;
  /** Approve: leave out the flagged students (shared network, parent same network). */
  excludeFlagged?: boolean;
  note?: string | null;
  /** Reject: email the teacher the note. */
  tellTeacher?: boolean;
  /** Reject: for safety, which takes an evidence hold. */
  forSafety?: boolean;
};

async function classForAction(r: ClassReviewer, classId: string) {
  if (!isUuid(classId)) return { ok: false as const, error: fail("not_found", NOT_FOUND) };
  const admin = createAdminClient();
  const [{ data: cls }, { data: rev }] = await Promise.all([
    admin
      .from("classes")
      .select("id, title, status, rtk_app, teacher_id, starts_at, duration_minutes")
      .eq("id", classId)
      .maybeSingle(),
    admin.from("class_reviews").select("restricted").eq("class_id", classId).maybeSingle(),
  ]);
  if (!cls) return { ok: false as const, error: fail("not_found", NOT_FOUND) };
  if (cls.rtk_app !== rtkApp()) return { ok: false as const, error: fail("forbidden", OTHER_APP) };
  if (rev?.restricted && !r.canSeeRestricted) return { ok: false as const, error: fail("forbidden", RESTRICTED) };
  return {
    ok: true as const,
    cls: cls as {
      id: string;
      title: string;
      status: ClassStatus;
      rtk_app: RtkApp;
      teacher_id: string | null;
      starts_at: string;
      duration_minutes: number;
    },
  };
}

async function emailTeacher(classId: string, teacherId: string | null, subject: string, heading: string, intro: string, note: string | null) {
  if (!teacherId) return;
  const { data } = await createAdminClient().auth.admin.getUserById(teacherId);
  const to = data?.user?.email;
  if (!to) return;
  await sendClassEmail("teacher decision", classId, {
    to,
    subject,
    html: classEmailHtml({
      heading,
      intro,
      rows: note ? [{ label: "Note from LearnFRC", value: note }] : [],
      buttons: [{ text: "Your classes", url: `${SITE_URL}/classes/teaching` }],
    }),
  });
}

/**
 * Approve or reject an ended class (section 7.6). Approving freezes the
 * teacher's minutes (classes.credited_minutes), which only approved classes
 * count toward hours letters; rejecting gives 0, keeps the evidence, and
 * "for safety" also takes a hold.
 */
export async function decideClassAs(r: ClassReviewer, input: DecideInput): Promise<Result<{ message: string; minutes: number }>> {
  const found = await classForAction(r, input.classId);
  if (!found.ok) return found.error;
  const cls = found.cls;
  if (cls.status !== "ended" && cls.status !== "in_review") {
    return fail("conflict", cls.status === "approved" || cls.status === "rejected" ? "This class was already decided." : "This class hasn't ended yet.");
  }
  const note = (input.note ?? "").trim();
  if (note.length > 1000) return { ...fail("validation", "Keep the note under 1,000 characters."), field: "note" };
  const admin = createAdminClient();
  const stamp = nowIso();

  if (input.decision === "approve") {
    const facts = await loadReviewFacts(cls.id);
    if (!facts) return fail("not_found", NOT_FOUND);
    const { data: rev } = await admin.from("class_reviews").select("code_flags").eq("class_id", cls.id).maybeSingle();
    const flags = (rev?.code_flags as CodeFlag[] | undefined)?.length ? (rev!.code_flags as CodeFlag[]) : codeFlagsFor(facts, { noTranscriptDue: false });
    const without = minutesWithoutFlagged(facts, flags);
    let minutes = input.excludeFlagged ? without.minutes : facts.teacherMinutes;
    let fullNote = note;
    if (input.minutesOverride != null) {
      const max = cls.duration_minutes + 45;
      if (!Number.isInteger(input.minutesOverride) || input.minutesOverride < 0 || input.minutesOverride > max) {
        return { ...fail("validation", `Minutes must be a whole number from 0 to ${max}.`), field: "minutes" };
      }
      if (!note) return { ...fail("validation", "Changing the minutes needs a note saying why."), field: "note" };
      minutes = input.minutesOverride;
    } else if (input.excludeFlagged && without.excluded.length) {
      const names = without.excluded.map((id) => (facts.usernames.get(id) ? `@${facts.usernames.get(id)}` : "a student")).join(", ");
      fullNote = [note, `Left out flagged students: ${names}.`].filter(Boolean).join(" ");
    }
    const { data: updated, error } = await admin
      .from("classes")
      .update({
        status: "approved",
        credited_minutes: minutes,
        credited_minutes_computed: facts.teacherMinutes,
        decided_at: stamp,
        decided_by: r.userId,
        decision_note: fullNote || null,
        updated_at: stamp,
      })
      .eq("id", cls.id)
      .in("status", ["ended", "in_review"])
      .select("id");
    if (error) return fail("server", "Couldn't save that. Try again.");
    if (!updated?.length) return fail("conflict", "This class was already decided.");
    await admin.from("class_events").insert({
      class_id: cls.id,
      actor_id: r.userId,
      kind: "approved",
      detail: { minutes, computed: facts.teacherMinutes, override: input.minutesOverride ?? null, excluded: input.excludeFlagged ? without.excluded : [] },
    });
    await emailTeacher(
      cls.id,
      cls.teacher_id,
      `Your LearnFRC class was approved: ${cls.title}`,
      `"${cls.title}" was approved.`,
      `${minutes} ${minutes === 1 ? "minute" : "minutes"} of teaching time count toward your hours. Thanks for teaching.`,
      null
    );
    return { ok: true, message: `Approved, ${minutes} minutes credited.`, minutes };
  }

  if (!note) return { ...fail("validation", "Write a note saying why it's rejected."), field: "note" };
  const { data: updated, error } = await admin
    .from("classes")
    .update({
      status: "rejected",
      credited_minutes: 0,
      keep_evidence: true,
      decided_at: stamp,
      decided_by: r.userId,
      decision_note: note,
      updated_at: stamp,
    })
    .eq("id", cls.id)
    .in("status", ["ended", "in_review"])
    .select("id");
  if (error) return fail("server", "Couldn't save that. Try again.");
  if (!updated?.length) return fail("conflict", "This class was already decided.");
  await admin.from("class_events").insert({
    class_id: cls.id,
    actor_id: r.userId,
    kind: "rejected",
    detail: { forSafety: !!input.forSafety, toldTeacher: !!input.tellTeacher },
  });
  if (input.forSafety) {
    const held = await holdClass(cls.id, { reason: "reject_safety", createdBy: r.userId, notes: note });
    if (!held.ok) console.error("decideClass: hold failed", held.error);
  }
  if (input.tellTeacher) {
    await emailTeacher(
      cls.id,
      cls.teacher_id,
      `About your LearnFRC class: ${cls.title}`,
      `"${cls.title}" wasn't approved.`,
      "Its minutes don't count toward your hours. Here's why:",
      note
    );
  }
  return { ok: true, message: input.forSafety ? "Rejected for safety. A hold was taken." : "Rejected.", minutes: 0 };
}

export async function decideClass(user: AppUser, input: DecideInput) {
  const g = await reviewerFor(user);
  if (!g.ok) return g;
  return decideClassAs(g.reviewer, input);
}

/* ── Tools on the review page ──────────────────────────────────────── */

/** Checks a "Rerun notes" request; the caller runs runClassReview(id, { force: true }) after the response. */
export async function checkRerunAs(r: ClassReviewer, classId: string): Promise<Result> {
  const found = await classForAction(r, classId);
  if (!found.ok) return found.error;
  if (!["ended", "in_review", "approved", "rejected"].includes(found.cls.status)) {
    return fail("conflict", "Notes come after the class ends.");
  }
  return { ok: true };
}

/** "Pull from Cloudflare": reconcile now. */
export async function pullFromCloudflareAs(r: ClassReviewer, classId: string): Promise<Result<{ report: ReconcileReport; message: string }>> {
  const found = await classForAction(r, classId);
  if (!found.ok) return found.error;
  const res = await reconcileClass(classId);
  if (!res.ok) return res;
  const { ok: _ok, ...report } = res;
  void _ok;
  const message =
    report.cloudflare === "not_configured"
      ? "Cloudflare isn't set up on this server, so only the minutes were recomputed."
      : `Pulled ${report.sessions} ${report.sessions === 1 ? "session" : "sessions"}: ${report.attendanceAdded} joins added, ${report.attendanceClosed} closed, ${report.transcriptsStored} transcripts stored.${report.transcriptsWaiting ? ` ${report.transcriptsWaiting} not ready at Cloudflare yet.` : ""}${report.errors.length ? ` ${report.errors.length} problems: ${report.errors.slice(0, 2).join("; ")}` : ""}`;
  return { ok: true, report, message };
}

/** "Hold this class" by hand. */
export async function holdByHandAs(r: ClassReviewer, classId: string, note: string | null): Promise<Result<{ message: string }>> {
  const found = await classForAction(r, classId);
  if (!found.ok) return found.error;
  const held = await holdClass(classId, { reason: "manual", createdBy: r.userId, notes: note?.trim() || null });
  if (!held.ok) return held;
  await createAdminClient().from("classes").update({ keep_evidence: true, updated_at: nowIso() }).eq("id", classId);
  return { ok: true, message: "Held. The evidence is kept for a year." };
}

/** "Release to reviewers": the safety lead lifts a restriction. */
export async function releaseReviewAs(r: ClassReviewer, classId: string): Promise<Result<{ message: string }>> {
  if (r.role !== "safety_lead" || !r.canSeeRestricted) return fail("forbidden", "Only the safety lead can release a restricted review.");
  const found = await classForAction(r, classId);
  if (!found.ok) return found.error;
  const admin = createAdminClient();
  const { data } = await admin
    .from("class_reviews")
    .update({ restricted: false, updated_at: nowIso() })
    .eq("class_id", classId)
    .eq("restricted", true)
    .select("class_id");
  if (!data?.length) return fail("conflict", "This review isn't restricted.");
  await admin.from("class_events").insert({ class_id: classId, actor_id: r.userId, kind: "review_released", detail: {} });
  return { ok: true, message: "Released to reviewers." };
}

/**
 * "Release to reviewers" on the review page: lifts the review's restriction
 * and releases the class's unreleased holds with it (releaseHold), so the
 * review and its holds never disagree about who may see the material.
 */
export async function releaseReview(user: AppUser, classId: string): Promise<Result<{ message: string }>> {
  const g = await reviewerFor(user);
  if (!g.ok) return g;
  const res = await releaseReviewAs(g.reviewer, classId);
  if (!res.ok) return res;
  const { count } = await createAdminClient()
    .from("class_safety_holds")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId)
    .is("released_at", null);
  if (!count) return res;
  const held = await releaseHold(user, { classId });
  if (!held.ok) return { ok: true, message: `Released the review, but not its holds: ${held.error}` };
  return { ok: true, message: `Released to reviewers, with ${held.released === 1 ? "its hold" : `its ${held.released} holds`}.` };
}

/** "End" on a live class, as staff. */
export async function endLiveClass(user: AppUser, classId: string): Promise<Result> {
  const g = await reviewerFor(user);
  if (!g.ok) return g;
  if (!isUuid(classId)) return fail("not_found", NOT_FOUND);
  return endClass(user, { classId, reason: "admin" });
}

/** The pause switch (setJoinsPaused checks its own rights). */
export async function setPause(user: AppUser, paused: boolean, reason: string | null): Promise<Result> {
  const g = await reviewerFor(user);
  if (!g.ok) return g;
  return setJoinsPaused(user, { paused, reason });
}

/* ── Settings (super admin) ────────────────────────────────────────── */

export const SETTING_BOUNDS = {
  monthlyMinuteCap: [1_000, 1_000_000],
  maxLiveClasses: [1, 20],
  minStudentAccountDays: [0, 60],
} as const;

export async function updateClassSettingsAs(
  r: ClassReviewer,
  input: { monthlyMinuteCap: number; maxLiveClasses: number; minStudentAccountDays: number }
): Promise<Result<{ message: string }>> {
  if (r.role !== "superadmin") return fail("forbidden", NOT_SUPER);
  for (const [k, [lo, hi]] of Object.entries(SETTING_BOUNDS)) {
    const v = input[k as keyof typeof input];
    if (!Number.isInteger(v) || v < lo || v > hi) {
      return { ...fail("validation", `That number has to be a whole number from ${lo.toLocaleString("en-US")} to ${hi.toLocaleString("en-US")}.`), field: k };
    }
  }
  const { error } = await createAdminClient()
    .from("class_settings")
    .update({
      monthly_minute_cap: input.monthlyMinuteCap,
      max_live_classes: input.maxLiveClasses,
      min_student_account_days: input.minStudentAccountDays,
      updated_at: nowIso(),
      updated_by: r.userId,
    })
    .eq("id", true);
  if (error) return fail("server", "Couldn't save that. Try again.");
  return { ok: true, message: "Settings saved." };
}

/** The database half of the visibility switch (CLASSES_VISIBLE is the other half). */
export async function setClassesVisibleAs(r: ClassReviewer, visible: boolean): Promise<Result<{ message: string }>> {
  if (r.role !== "superadmin") return fail("forbidden", NOT_SUPER);
  const { error } = await createAdminClient()
    .from("class_settings")
    .update({ classes_visible: visible, updated_at: nowIso(), updated_by: r.userId })
    .eq("id", true);
  if (error) return fail("server", "Couldn't save that. Try again.");
  // The cached pages (nav, footer, homepage, legal pages, sitemap) follow the
  // switch on their next visit rather than at the daily refresh.
  try {
    refreshClassesOnStaticPages();
  } catch (e) {
    // Outside a request (a script) there's no cache to expire.
    console.warn("setClassesVisible: page refresh skipped:", (e as Error).message);
  }
  return {
    ok: true,
    message: visible
      ? process.env.CLASSES_VISIBLE === "1"
        ? "Classes are visible."
        : "Saved. Classes also need CLASSES_VISIBLE=1 on Vercel before they show."
      : "Classes are hidden.",
  };
}

/** Sets (or clears, with an empty handle) the safety lead's account. */
export async function setSafetyLeadAs(r: ClassReviewer, handle: string): Promise<Result<{ message: string }>> {
  if (r.role !== "superadmin") return fail("forbidden", NOT_SUPER);
  const clean = handle.trim().replace(/^@/, "");
  const admin = createAdminClient();
  let userId: string | null = null;
  let username: string | null = null;
  if (clean) {
    if (!/^[a-zA-Z0-9_]{1,40}$/.test(clean)) return { ...fail("validation", "That isn't a username."), field: "handle" };
    // Exact match: usernames are stored lowercase, and in ILIKE "_" matches
    // any character, so "dhiren_p" would also find "dhirenxp".
    const { data } = await admin.from("profiles").select("id, username").eq("username", clean.toLowerCase()).maybeSingle();
    if (!data) return { ...fail("not_found", `No account has the username @${clean.toLowerCase()}.`), field: "handle" };
    userId = data.id as string;
    username = (data.username as string | null) ?? clean.toLowerCase();
    const refusal = await safetyLeadCandidateError(userId);
    if (refusal) return { ...fail("validation", refusal), field: "handle" };
  }
  const { error } = await admin
    .from("class_settings")
    .update({ safety_lead_user_id: userId, updated_at: nowIso(), updated_by: r.userId })
    .eq("id", true);
  if (error) return fail("server", "Couldn't save that. Try again.");
  return { ok: true, message: userId ? `@${username} is the safety lead.` : "No safety lead is set." };
}

/* ── Parent consents (lookup and revoke) ───────────────────────────── */

export type ConsentLookupRow = {
  id: string;
  studentHandle: string;
  studentId: string | null;
  status: ParentConsentStatus;
  parentEmail: string;
  parentName: string | null;
  sentAt: string;
  decidedAt: string | null;
  sameNetwork: boolean;
  revokedAt: string | null;
};

export async function findParentConsentsAs(r: ClassReviewer, handle: string): Promise<Result<{ rows: ConsentLookupRow[] }>> {
  void r;
  const clean = handle.trim().replace(/^@/, "");
  if (!/^[a-zA-Z0-9_]{1,40}$/.test(clean)) return { ...fail("validation", "Type a username."), field: "handle" };
  const admin = createAdminClient();
  // Exact matches: usernames and handle snapshots are lowercase, and in ILIKE
  // "_" matches any character, so a lookup could return someone else's rows.
  const handleLower = clean.toLowerCase();
  const { data: prof } = await admin.from("profiles").select("id").eq("username", handleLower).maybeSingle();
  let q = admin
    .from("class_parent_consents")
    .select("id, student_id, student_handle, status, parent_email, parent_name, sent_at, decided_at, same_network, revoked_at")
    .order("sent_at", { ascending: false })
    .limit(20);
  q = prof ? q.or(`student_id.eq.${prof.id},student_handle.eq.${handleLower}`) : q.eq("student_handle", handleLower);
  const { data, error } = await q;
  if (error) return fail("server", "Couldn't look that up. Try again.");
  return {
    ok: true,
    rows: (data ?? []).map((c) => ({
      id: c.id as string,
      studentHandle: c.student_handle as string,
      studentId: c.student_id as string | null,
      status: c.status as ParentConsentStatus,
      parentEmail: c.parent_email as string,
      parentName: c.parent_name as string | null,
      sentAt: c.sent_at as string,
      decidedAt: c.decided_at as string | null,
      sameNetwork: !!c.same_network,
      revokedAt: c.revoked_at as string | null,
    })),
  };
}

/** Revokes a parent OK, which blocks the student's future joins at once. */
export async function revokeParentConsentAs(r: ClassReviewer, consentId: string): Promise<Result<{ message: string }>> {
  // The rule (and the student's email) is the consent package's.
  const res = await revokeParentConsentBy(r.userId, consentId);
  if (!res.ok) return res;
  return {
    ok: true,
    message: res.studentHandle
      ? `Revoked. @${res.studentHandle} can't join classes until a parent says OK again.`
      : "Revoked. That student can't join classes until a parent says OK again.",
  };
}

/** The review page's URL, for the actions' redirects and emails. */
export { adminClassUrl };
