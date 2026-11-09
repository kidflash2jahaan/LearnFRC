import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimitKey } from "@/lib/rate-limit";
import { firstProfaneField } from "@/lib/profanity";
import { isUuid } from "@/lib/app/http";
import { fail, type AppUser, type Failure, type Result } from "@/lib/app/result";
import { emailFor } from "@/lib/app/admin-notify";
import { getTeacher } from "@/lib/app/class-teachers";
import { requireClassReviewer } from "@/lib/app/class-reviewers";
import { endClass } from "@/lib/app/classes-room";
import { CLASS_SENTENCES, classEligibility, eligibilitySentence } from "@/lib/app/classes";
import {
  CLASS_LIMITS,
  classesConfigured,
  classesDevAllowSoon,
  classesVisible,
  getClassSettings,
  hardEndFor,
  ownerEmail,
  rtkApp,
} from "@/lib/classes/config";
import { hasContactPatterns } from "@/lib/classes/contact-patterns";
import { TEACHER_CODE_VERSION } from "@/lib/classes/notice";
import { createMeeting, meetingConfigFor, setMeetingStatus } from "@/lib/classes/realtimekit";
import {
  SCHEDULE_SENTENCES,
  classWindow,
  overlapsOwnClass,
  parseScheduleInput,
  siteFull,
  timingRefusal,
  tooManyUpcoming,
  transcriptionKeywords,
  type ScheduleField,
} from "@/lib/classes/schedule";
import {
  classCanceledEmail,
  deliverClassMail,
  scheduledFyiEmail,
  type CanceledBy,
} from "@/lib/classes/emails-enroll";
import type { ClassStatus, ClassTeacherRow, Eligibility, RtkApp, SystemActor } from "@/lib/classes/types";

/**
 * Scheduling and cancelling classes (classes-design.md section 11,
 * /classes/teaching), plus what the teaching page reads.
 *
 * One door for every caller: the teaching page's Server Actions, the
 * teachers package's suspendTeacher and account deletion
 * (beforeAccountDeleted) call these, so the rules can't drift.
 *
 * ORDER MATTERS in scheduleClass. Every refusal (the teacher gate, the form,
 * profanity and contact details in the title, description and bio, the lead
 * time, overlap with the teacher's own classes, the per-teacher cap and the
 * site-wide cap) runs before the one RealtimeKit call, so all of them hold
 * on a dev server with no Cloudflare keys. Only then does it check
 * classesConfigured() and create the meeting in this deployment's app.
 *
 * A first class schedules exactly like any other (section 8.3): the same lead
 * time, up to 15 seats, no host step. The only difference is Jahaan's FYI,
 * which says so.
 *
 * Every read and write is service role, scoped by the id auth.getUser()
 * verified. Classes of the other RealtimeKit app (dev rows in the shared
 * database) never count toward this deployment's caps and can't be managed
 * from here.
 */

export type ScheduleClassInput = {
  title: string;
  description?: string | null;
  /** Exactly one of lessonId and moduleId. */
  lessonId?: string | null;
  moduleId?: string | null;
  /** ISO 8601 with a zone (the form converts local time). */
  startsAt: string;
  durationMinutes: number;
  /** Seats, 2 to 15 (default 15). */
  capacity?: number;
};

/** Where to send someone who can't schedule yet. */
export type TeachingNext = "apply" | "ready" | "settings" | "contact" | null;

type Gate =
  | { ok: true; teacher: ClassTeacherRow }
  | (Failure & { next: TeachingNext; eligibility?: Eligibility });

const UPCOMING: ClassStatus[] = ["scheduled", "live"];

function isSystem(actor: AppUser | SystemActor): actor is SystemActor {
  return (actor as SystemActor).system === true;
}

/* ── Who may schedule (section 4) ──────────────────────────────────── */

/**
 * Teaching needs a class_teachers row that isn't suspended and has agreed to
 * the current teacher code, plus `ready` (13 to 17 with a parent's OK).
 */
async function teachingGate(user: AppUser, known?: ClassTeacherRow | null): Promise<Gate> {
  const teacher = known === undefined ? await getTeacher(user.id) : known;
  if (!teacher) return { ...fail("forbidden", SCHEDULE_SENTENCES.notTeacher), next: "apply" };
  if (teacher.suspended_at) return { ...fail("forbidden", SCHEDULE_SENTENCES.suspended), next: "contact" };
  if (teacher.code_version !== TEACHER_CODE_VERSION)
    return { ...fail("forbidden", SCHEDULE_SENTENCES.codeUpdate), next: "apply" };
  const state = await classEligibility(user);
  if (state !== "ready") {
    const next: TeachingNext =
      state === "needs_handle"
        ? "settings"
        : state === "needs_age" || state === "needs_parent" || state === "waiting_parent"
          ? "ready"
          : null;
    return {
      ...fail(state === "signed_out" ? "unauthorized" : "forbidden", eligibilitySentence(state) || CLASS_SENTENCES.hidden),
      next,
      eligibility: state,
    };
  }
  return { ok: true, teacher };
}

function refuse(code: Failure["code"], error: string, field?: ScheduleField | "bio"): Failure {
  return field ? { ...fail(code, error), field } : fail(code, error);
}

/* ── Topics ────────────────────────────────────────────────────────── */

type TopicRow = { kind: "lesson" | "module"; id: string; title: string };

async function topicFor(lessonId: string | null, moduleId: string | null): Promise<TopicRow | null> {
  const admin = createAdminClient();
  if (lessonId) {
    const { data } = await admin.from("lessons").select("id, title").eq("id", lessonId).maybeSingle();
    return data ? { kind: "lesson", id: data.id as string, title: data.title as string } : null;
  }
  if (moduleId) {
    const { data } = await admin.from("modules").select("id, title").eq("id", moduleId).maybeSingle();
    return data ? { kind: "module", id: data.id as string, title: data.title as string } : null;
  }
  return null;
}

export type TopicGroup = {
  department: string;
  modules: { id: string; title: string; lessons: { id: string; title: string }[] }[];
};

/** Every lesson and module, by department, for the schedule form's picker. */
export async function scheduleTopicOptions(): Promise<TopicGroup[]> {
  const { data, error } = await createAdminClient()
    .from("departments")
    .select("name, sort_order, modules(id, title, sort_order, is_prerequisite, lessons(id, title, sort_order))")
    .order("sort_order");
  if (error || !data) return [];
  type L = { id: string; title: string; sort_order: number };
  type M = { id: string; title: string; sort_order: number; is_prerequisite: boolean | null; lessons: L[] | null };
  return (data as unknown as { name: string; modules: M[] | null }[]).map((d) => ({
    department: d.name,
    modules: [...(d.modules ?? [])]
      .sort((a, b) => (a.is_prerequisite ? 0 : 1) - (b.is_prerequisite ? 0 : 1) || a.sort_order - b.sort_order)
      .map((m) => ({
        id: m.id,
        title: m.title,
        lessons: [...(m.lessons ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((l) => ({ id: l.id, title: l.title })),
      })),
  }));
}

/* ── First class (section 8.3: computed, no column) ────────────────── */

/**
 * A teacher's first class: they have no approved class yet, and no other
 * class still on the books that starts before this one.
 */
async function firstClassFacts(
  teacherId: string,
  startsAt: Date,
  exceptId: string | null
): Promise<{ firstClass: boolean; approvedBefore: number }> {
  const admin = createAdminClient();
  const [{ count: approved }, { data: earlier }] = await Promise.all([
    admin
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", teacherId)
      .eq("status", "approved"),
    admin
      .from("classes")
      .select("id")
      .eq("teacher_id", teacherId)
      .neq("status", "canceled")
      .lt("starts_at", startsAt.toISOString())
      .limit(5),
  ]);
  const others = (earlier ?? []).filter((r) => r.id !== exceptId);
  return { firstClass: (approved ?? 0) === 0 && others.length === 0, approvedBefore: approved ?? 0 };
}

/* ── Schedule ──────────────────────────────────────────────────────── */

/**
 * Schedules a class: every refusal (timing, overlap, the per-teacher and
 * site-wide caps, profanity and contact details in the title, description or
 * bio) runs before the RealtimeKit meeting is created in this deployment's
 * app, and the class records that app (classes.rtk_app).
 */
export async function scheduleClass(
  user: AppUser,
  input: ScheduleClassInput & { topic?: string }
): Promise<Result<{ classId: string }>> {
  if (!(await classesVisible())) return fail("forbidden", CLASS_SENTENCES.hidden);

  const gate = await teachingGate(user);
  if (!gate.ok) return fail(gate.code, gate.error);

  const parsed = parseScheduleInput(input);
  if (!parsed.ok) return refuse("validation", parsed.error, parsed.field);
  const v = parsed.value;

  // What students read on the listing: no profanity, no contact details.
  const profane = firstProfaneField({ title: v.title, description: v.description });
  if (profane === "title") return refuse("validation", SCHEDULE_SENTENCES.profaneTitle, "title");
  if (profane === "description") return refuse("validation", SCHEDULE_SENTENCES.profaneDescription, "description");
  if (hasContactPatterns(v.title)) return refuse("validation", SCHEDULE_SENTENCES.contactTitle, "title");
  if (hasContactPatterns(v.description)) return refuse("validation", SCHEDULE_SENTENCES.contactDescription, "description");

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("username, bio").eq("id", user.id).maybeSingle();
  if (hasContactPatterns((profile?.bio as string | null) ?? null))
    return refuse("validation", SCHEDULE_SENTENCES.bio, "bio");

  const now = new Date();
  const timing = timingRefusal(v.startsAt, now, { allowSoon: classesDevAllowSoon() });
  if (timing === "too_soon") return refuse("validation", SCHEDULE_SENTENCES.tooSoon, "startsAt");
  if (timing === "too_far") return refuse("validation", SCHEDULE_SENTENCES.tooFar, "startsAt");

  const topic = await topicFor(v.lessonId, v.moduleId);
  if (!topic) return refuse("validation", SCHEDULE_SENTENCES.topicMissing, "topic");

  const app = rtkApp();
  const slot = classWindow(v.startsAt, v.durationMinutes);
  const hardEnd = hardEndFor(v.startsAt, v.durationMinutes);

  // The teacher's own upcoming classes: overlap and the per-teacher cap.
  const { data: own, error: ownError } = await admin
    .from("classes")
    .select("id, starts_at, duration_minutes")
    .eq("teacher_id", user.id)
    .eq("rtk_app", app)
    .in("status", UPCOMING)
    .gt("hard_end_at", now.toISOString());
  if (ownError) {
    console.error("scheduleClass own classes:", ownError.message);
    return fail("server", SCHEDULE_SENTENCES.save);
  }
  const ownClasses = (own ?? []).map((r) => ({
    startsAt: new Date(r.starts_at as string),
    durationMinutes: r.duration_minutes as number,
  }));
  if (overlapsOwnClass({ startsAt: v.startsAt, durationMinutes: v.durationMinutes }, ownClasses))
    return refuse("conflict", SCHEDULE_SENTENCES.overlap, "startsAt");
  if (tooManyUpcoming(ownClasses.length)) return refuse("conflict", SCHEDULE_SENTENCES.tooMany);

  // Site-wide: no more than max_live_classes running at any one moment,
  // counting this app's classes only, so a dev test class in the shared
  // database can never block a real teacher in production.
  const [settings, { data: around, error: aroundError }] = await Promise.all([
    getClassSettings(),
    admin
      .from("classes")
      .select("starts_at, hard_end_at")
      .eq("rtk_app", app)
      .in("status", UPCOMING)
      .lt("starts_at", hardEnd.toISOString())
      .gt("hard_end_at", v.startsAt.toISOString()),
  ]);
  if (aroundError) {
    console.error("scheduleClass site cap:", aroundError.message);
    return fail("server", SCHEDULE_SENTENCES.save);
  }
  const others = (around ?? []).map((r) => ({
    start: Date.parse(r.starts_at as string),
    end: Date.parse(r.hard_end_at as string),
  }));
  if (siteFull(slot, others, settings.max_live_classes))
    return refuse("conflict", SCHEDULE_SENTENCES.siteFull, "startsAt");

  if (!(await rateLimitKey("class-schedule", 12, 3600, user.id)))
    return fail("rate_limited", SCHEDULE_SENTENCES.rate, 3600);

  // Every refusal above holds without keys. Only now does Cloudflare matter.
  if (!classesConfigured()) return fail("conflict", SCHEDULE_SENTENCES.notConfigured);

  // The id goes into the meeting's title and recording prefix, so it's made
  // here; the meeting carries no class title or handle (Cloudflare keeps
  // meeting records indefinitely).
  const classId = crypto.randomUUID();
  const meeting = await createMeeting(
    meetingConfigFor({
      classId,
      durationMinutes: v.durationMinutes,
      keywords: transcriptionKeywords(topic.title, v.title),
    })
  );
  if (!meeting.ok || !meeting.data?.id) {
    console.error("scheduleClass createMeeting:", meeting.ok ? "no id" : `${meeting.status} ${meeting.error}`);
    return fail("server", SCHEDULE_SENTENCES.meeting);
  }

  const { error: insertError } = await admin.from("classes").insert({
    id: classId,
    teacher_id: user.id,
    title: v.title,
    description: v.description,
    lesson_id: topic.kind === "lesson" ? topic.id : null,
    module_id: topic.kind === "module" ? topic.id : null,
    starts_at: v.startsAt.toISOString(),
    duration_minutes: v.durationMinutes,
    hard_end_at: hardEnd.toISOString(),
    capacity: v.capacity,
    status: "scheduled",
    rtk_meeting_id: meeting.data.id,
    rtk_app: app,
  });
  if (insertError) {
    console.error("scheduleClass insert:", insertError.message);
    // An idle meeting costs nothing, but close it so nothing can join it.
    await setMeetingStatus(meeting.data.id, "INACTIVE", { app });
    return fail("server", SCHEDULE_SENTENCES.save);
  }

  const facts = await firstClassFacts(user.id, v.startsAt, classId);
  await admin.from("class_events").insert({
    class_id: classId,
    actor_id: user.id,
    kind: "scheduled",
    detail: {
      first_class: facts.firstClass,
      capacity: v.capacity,
      duration_minutes: v.durationMinutes,
      rtk_app: app,
    },
  });

  const owner = ownerEmail();
  if (owner) {
    await deliverClassMail(
      "scheduled fyi",
      classId,
      scheduledFyiEmail(
        {
          classId,
          title: v.title,
          description: v.description,
          topicTitle: topic.title,
          teacherUsername: (profile?.username as string | null) ?? null,
          startsAt: v.startsAt.toISOString(),
          durationMinutes: v.durationMinutes,
          capacity: v.capacity,
          firstClass: facts.firstClass,
          approvedBefore: facts.approvedBefore,
        },
        owner
      )
    );
  }

  return { ok: true, classId };
}

/* ── Cancel ────────────────────────────────────────────────────────── */

// No CLASS_SENTENCES in here: classes.ts imports this file (account deletion
// calls cancelTeacherClasses), so its exports aren't ready while this module
// loads. Read them inside functions only.
const CANCEL_SENTENCES = {
  forbidden: "Only the class's teacher or LearnFRC staff can cancel it.",
  live: "This class is live. End it from the room instead.",
  over: "This class already happened, so it can't be canceled.",
} as const;

type CancelRow = {
  id: string;
  teacher_id: string | null;
  title: string;
  starts_at: string;
  status: ClassStatus;
  rtk_meeting_id: string | null;
  rtk_app: RtkApp;
};

/** Emails every enrolled student their own copy. Never throws. */
async function mailStudentsCanceled(row: CancelRow, by: CanceledBy): Promise<number> {
  try {
    const { data } = await createAdminClient()
      .from("class_enrollments")
      .select("user_id")
      .eq("class_id", row.id)
      .eq("status", "enrolled");
    let sent = 0;
    for (const e of data ?? []) {
      const to = await emailFor(e.user_id as string);
      if (!to) continue;
      await deliverClassMail(
        "class canceled",
        row.id,
        classCanceledEmail({ title: row.title, startsAt: row.starts_at, by }, to)
      );
      sent++;
    }
    return sent;
  } catch (e) {
    console.error("cancelClass emails:", e);
    return 0;
  }
}

/** Cancels one scheduled class (no checks on who). Idempotent. */
async function cancelRow(row: CancelRow, actorId: string | null, by: CanceledBy, reason: string): Promise<Result> {
  if (row.status === "canceled") return { ok: true };
  if (row.status === "live") return fail("conflict", CANCEL_SENTENCES.live);
  if (row.status !== "scheduled") return fail("conflict", CANCEL_SENTENCES.over);

  const stamp = new Date().toISOString();
  const { data: updated, error } = await createAdminClient()
    .from("classes")
    .update({
      status: "canceled",
      canceled_at: stamp,
      canceled_by: actorId,
      cancel_reason: reason.slice(0, 300) || null,
      updated_at: stamp,
    })
    .eq("id", row.id)
    .eq("status", "scheduled")
    .select("id");
  if (error) {
    console.error("cancelClass update:", error.message);
    return fail("server", CLASS_SENTENCES.save);
  }
  // Someone else changed it first (it went live, or was canceled already).
  if (!updated || updated.length === 0) return { ok: true };

  // Close the meeting so no old token can open a room. Best effort: only this
  // deployment's app, and nothing joins a canceled class anyway.
  if (row.rtk_meeting_id && row.rtk_app === rtkApp()) {
    const r = await setMeetingStatus(row.rtk_meeting_id, "INACTIVE", { app: row.rtk_app });
    if (!r.ok && r.error !== "not_configured") console.error("cancelClass meeting:", r.status, r.error);
  }

  const students = await mailStudentsCanceled(row, by);
  await createAdminClient()
    .from("class_events")
    .insert({
      class_id: row.id,
      actor_id: actorId,
      kind: "canceled",
      detail: { by, reason: reason.slice(0, 300), students_emailed: students },
    });
  return { ok: true };
}

async function loadCancelRow(classId: string): Promise<CancelRow | null> {
  const { data } = await createAdminClient()
    .from("classes")
    .select("id, teacher_id, title, starts_at, status, rtk_meeting_id, rtk_app")
    .eq("id", classId)
    .maybeSingle();
  return (data as CancelRow | null) ?? null;
}

/** Cancels one class and emails its enrolled students. The teacher or staff. */
export async function cancelClass(
  actor: AppUser | SystemActor,
  input: { classId: string; reason: string }
): Promise<Result> {
  if (!isUuid(input.classId)) return fail("not_found", CLASS_SENTENCES.notFound);
  const row = await loadCancelRow(input.classId);
  if (!row) return fail("not_found", CLASS_SENTENCES.notFound);
  const reason = (input.reason ?? "").trim();

  if (isSystem(actor)) return cancelRow(row, null, "system", reason || actor.reason || "system");

  if (row.teacher_id === actor.id) {
    // A teacher manages only this deployment's classes.
    if (row.rtk_app !== rtkApp()) return fail("not_found", CLASS_SENTENCES.notFound);
    if (!(await classesVisible())) return fail("forbidden", CLASS_SENTENCES.hidden);
    return cancelRow(row, actor.id, "teacher", reason || "Canceled by the teacher.");
  }
  const staff = await requireClassReviewer(actor);
  if (!staff.ok) return fail("forbidden", CANCEL_SENTENCES.forbidden);
  return cancelRow(row, actor.id, "staff", reason || "Canceled by LearnFRC staff.");
}

/**
 * Cancels every upcoming class a teacher has (suspension, account deletion),
 * emailing enrolled students. A class that's live right now is ended
 * instead (endClass). Never throws.
 */
export async function cancelTeacherClasses(
  teacherId: string,
  reason: string
): Promise<{ canceled: number }> {
  let canceled = 0;
  try {
    if (!isUuid(teacherId)) return { canceled };
    const { data, error } = await createAdminClient()
      .from("classes")
      .select("id, teacher_id, title, starts_at, status, rtk_meeting_id, rtk_app")
      .eq("teacher_id", teacherId)
      .in("status", UPCOMING);
    if (error) {
      console.error("cancelTeacherClasses:", error.message);
      return { canceled };
    }
    for (const row of (data ?? []) as CancelRow[]) {
      try {
        if (row.status === "live") {
          await endClass({ system: true, reason }, { classId: row.id, reason: "admin" });
          continue;
        }
        const r = await cancelRow(row, null, "system", reason);
        if (r.ok) canceled++;
      } catch (e) {
        console.error("cancelTeacherClasses class:", row.id, e);
      }
    }
  } catch (e) {
    console.error("cancelTeacherClasses:", e);
  }
  return { canceled };
}

/* ── The teaching page (/classes/teaching) ─────────────────────────── */

export type TeachingClass = {
  id: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  status: ClassStatus;
  capacity: number;
  enrolled: number;
  /** Frozen minutes once approved. */
  creditedMinutes: number | null;
  /** What the minutes rule computed when the class ended, before review. */
  computedMinutes: number | null;
  topicTitle: string | null;
};

export type TeachingDesk = {
  visible: boolean;
  /** This deployment can make RealtimeKit meetings (keys are in). */
  configured: boolean;
  isTeacher: boolean;
  letterName: string | null;
  canSchedule: { ok: true } | { ok: false; reason: string; next: TeachingNext };
  upcoming: TeachingClass[];
  past: TeachingClass[];
  approvedMinutes: number;
  approvedCount: number;
  /** How many more classes the teacher may schedule right now. */
  slotsLeft: number;
};

type DeskRow = {
  id: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  status: ClassStatus;
  capacity: number;
  credited_minutes: number | null;
  credited_minutes_computed: number | null;
  hard_end_at: string;
  lesson: { title: string } | null;
  module: { title: string } | null;
};

/** Everything /classes/teaching shows for one account. */
export async function loadTeachingDesk(user: AppUser): Promise<TeachingDesk> {
  const empty: TeachingDesk = {
    visible: false,
    configured: classesConfigured(),
    isTeacher: false,
    letterName: null,
    canSchedule: { ok: false, reason: CLASS_SENTENCES.hidden, next: null },
    upcoming: [],
    past: [],
    approvedMinutes: 0,
    approvedCount: 0,
    slotsLeft: 0,
  };
  if (!(await classesVisible())) return empty;

  const teacher = await getTeacher(user.id);
  const gate = await teachingGate(user, teacher);
  const admin = createAdminClient();
  const app = rtkApp();
  const { data, error } = await admin
    .from("classes")
    .select(
      "id, title, starts_at, duration_minutes, status, capacity, credited_minutes, credited_minutes_computed, hard_end_at, " +
        "lesson:lessons!classes_lesson_id_fkey(title), module:modules!classes_module_id_fkey(title)"
    )
    .eq("teacher_id", user.id)
    .eq("rtk_app", app)
    .order("starts_at", { ascending: false })
    .limit(200);
  if (error) console.error("loadTeachingDesk:", error.message);
  const rows = (data ?? []) as unknown as DeskRow[];

  const now = Date.now();
  const isUpcoming = (r: DeskRow) => UPCOMING.includes(r.status) && Date.parse(r.hard_end_at) > now;
  const upcomingIds = rows.filter(isUpcoming).map((r) => r.id);
  const taken = new Map<string, number>();
  if (upcomingIds.length) {
    const { data: enr } = await admin
      .from("class_enrollments")
      .select("class_id")
      .in("class_id", upcomingIds)
      .eq("status", "enrolled");
    for (const e of enr ?? []) taken.set(e.class_id as string, (taken.get(e.class_id as string) ?? 0) + 1);
  }

  const toClass = (r: DeskRow): TeachingClass => ({
    id: r.id,
    title: r.title,
    startsAt: new Date(r.starts_at).toISOString(),
    durationMinutes: r.duration_minutes,
    status: r.status,
    capacity: r.capacity,
    enrolled: taken.get(r.id) ?? 0,
    creditedMinutes: r.credited_minutes,
    computedMinutes: r.credited_minutes_computed,
    topicTitle: r.lesson?.title ?? r.module?.title ?? null,
  });

  const upcoming = rows.filter(isUpcoming).map(toClass).reverse();
  const past = rows.filter((r) => !isUpcoming(r)).map(toClass);
  const approved = rows.filter((r) => r.status === "approved");

  return {
    visible: true,
    configured: classesConfigured(),
    isTeacher: !!teacher,
    letterName: teacher?.letter_name ?? null,
    canSchedule: gate.ok ? { ok: true } : { ok: false, reason: gate.error, next: gate.next },
    upcoming,
    past,
    approvedMinutes: approved.reduce((s, r) => s + (r.credited_minutes ?? 0), 0),
    approvedCount: approved.length,
    slotsLeft: Math.max(0, CLASS_LIMITS.maxUpcomingPerTeacher - upcoming.length),
  };
}
