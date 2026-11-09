import "server-only";
import { randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOwnerEmail } from "@/lib/auth";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { isUuid } from "@/lib/app/http";
import { fail, type AppUser, type Failure, type Result } from "@/lib/app/result";
import { getTeacher } from "@/lib/app/class-teachers";
import {
  canSeeRestricted,
  requireClassReviewer,
  type ClassReviewerRole,
} from "@/lib/app/class-reviewers";
import { PUBLIC_CONTACT_EMAIL } from "@/lib/email";
import { COORDINATOR } from "@/lib/classes/coordinator";
import { LETTER_LIMITS, classesVisible, getClassSettings, noLetterUserIds, rtkApp } from "@/lib/classes/config";
import {
  checkLetterPeriod,
  classesForLetter,
  defaultLetterPeriod,
  letterTotals,
  makeLetterCode,
  normalizeLetterCode,
  pacificDate,
  snapshotDrift,
  type CurrentClass,
  type LetterSourceClass,
} from "@/lib/classes/letter-rules";
import {
  letterDeclinedEmail,
  letterIssuedEmail,
  letterRequestEmail,
  letterRevokedEmail,
  letterSignerAddress,
  sendLetterMail,
} from "@/lib/classes/emails-letters";
import type {
  ClassTeacherRow,
  HoursLetterClass,
  HoursLetterRow,
  LetterStatus,
  ReviewVerdict,
} from "@/lib/classes/types";

/**
 * Hours letters (classes-design.md section 9): a teacher asks for a letter
 * covering their approved classes, Dhiren (the safety lead) or a super admin
 * signs or declines it, and a signed letter gets a code, a printable page
 * (/letters/[code]) and a public verify page (/verify/[code]).
 *
 * The rules, once, for every door:
 * - Only approved classes the person taught, in this deployment's
 *   RealtimeKit app, using the frozen credited_minutes (letter-rules.ts).
 * - Never for Jahaan or other staff: an owner email, any site_admins row, an
 *   id in CLASSES_NO_LETTER_USER_IDS, or class_teachers.letters_blocked.
 *   Checked when asking and again when signing.
 * - The name is class_teachers.letter_name, locked when the teacher was
 *   accepted. Nothing here takes a name from the teacher.
 * - The code exists only once the letter is signed. A request is only a
 *   snapshot waiting for the safety lead.
 * - Only the safety lead signs (approves), because every letter carries his
 *   signature and says the signer reviewed it. Super admins can see the
 *   desk, decline a request and withdraw a signed letter.
 *
 * Every read and write is service role. Teachers act through getTeacher
 * (the teachers package), reviewers through requireClassReviewer (the
 * safety-holds package), so those two rules live in one place each.
 */

/* ── Sentences ─────────────────────────────────────────────────────── */

export const LETTER_SENTENCES = {
  hidden: "Live classes aren't open yet.",
  notTeacher: "Hours letters are for LearnFRC teachers. Apply to teach a class first.",
  noLetters: `Letters are signed by ${COORDINATOR.name}, who can't sign for you. Your classes still count on the site. Ask your school's service coordinator who can verify them.`,
  tooManyOpen: `You have ${LETTER_LIMITS.maxOpenRequests} requests waiting already. ${COORDINATOR.name.split(" ")[0]} will answer them soon.`,
  tooManyToday: "That's a lot of requests for one day. Try again tomorrow.",
  noClasses: "No approved classes fall in those dates yet.",
  notFound: "That letter doesn't exist.",
  answered: "That request has already been answered. Reload the page to see it.",
  notIssued: "Only a signed letter can be withdrawn.",
  ownLetter: "You can't sign your own letter.",
  signerOnly: `Only ${COORDINATOR.name}, as the safety lead, can sign letters, since they carry his signature. You can decline a request or withdraw a signed letter.`,
  blockedAccount:
    "This account can't get a letter (an owner or staff account, or one on the no-letters list). Decline it.",
  nameChanged: "The name on file changed after this request. Decline it, and the teacher can ask again.",
  notTeacherNow: "This account isn't a teacher any more, so the letter can't be signed. Decline it.",
  drifted: "Some of these classes changed after the request. Decline it, and the teacher can ask again.",
  reason: "Write a short reason. The teacher sees it.",
  reasonLong: "Keep the reason under 500 characters.",
  save: "Couldn't save that. Try again.",
  load: "Couldn't load the letters just now. Reload the page to try again.",
  rate: "Too many letter checks from here. Try again in an hour.",
} as const;

/** "Wrong? Write to us" on the request page. */
export const NAME_HELP_EMAIL = PUBLIC_CONTACT_EMAIL;

/* ── Who can never get a letter (section 9.1) ──────────────────────── */

/**
 * True for accounts Dhiren can't sign for: an owner email, any site_admins
 * row, an id in CLASSES_NO_LETTER_USER_IDS (Jahaan's other accounts, such as
 * a Sign in with Apple relay address), or a teacher row with letters_blocked.
 */
export async function lettersBlockedFor(
  userId: string,
  email: string | null | undefined,
  teacher: Pick<ClassTeacherRow, "letters_blocked"> | null
): Promise<boolean> {
  if (isOwnerEmail(email)) return true;
  if (noLetterUserIds().has(userId)) return true;
  if (teacher?.letters_blocked) return true;
  const { data, error } = await createAdminClient()
    .from("site_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  // A failed read refuses: a letter is a signature, so doubt says no.
  if (error) return true;
  return !!data;
}

async function emailOf(userId: string): Promise<string | null> {
  try {
    const { data } = await createAdminClient().auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

async function handlesFor(ids: (string | null)[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (unique.length === 0) return out;
  const { data } = await createAdminClient().from("profiles").select("id, username").in("id", unique);
  for (const p of data ?? []) if (p.username) out.set(p.id as string, p.username as string);
  return out;
}

async function logLetterEvent(kind: string, actorId: string | null, detail: Record<string, unknown>) {
  try {
    await createAdminClient().from("class_events").insert({ class_id: null, actor_id: actorId, kind, detail });
  } catch (e) {
    console.error(`letters: ${kind} event not logged:`, e);
  }
}

/**
 * The signer: the account set as class_settings.safety_lead_user_id
 * (Dhiren). A super admin is a class reviewer too, but can't sign.
 */
export async function isLetterSigner(userId: string): Promise<boolean> {
  const settings = await getClassSettings();
  return !!settings.safety_lead_user_id && settings.safety_lead_user_id === userId;
}

/* ── The classes a letter can count ────────────────────────────────── */

type ClassQueryRow = {
  id: string;
  title: string;
  starts_at: string;
  status: string;
  teacher_id: string | null;
  rtk_app: string;
  credited_minutes: number | null;
  lesson: { title: string } | null;
  module: { title: string } | null;
};

const CLASS_SELECT =
  "id, title, starts_at, status, teacher_id, rtk_app, credited_minutes, " +
  "lesson:lessons!classes_lesson_id_fkey(title), module:modules!classes_module_id_fkey(title)";

function toSource(r: ClassQueryRow): LetterSourceClass {
  return {
    id: r.id,
    teacherId: r.teacher_id,
    status: r.status,
    rtkApp: r.rtk_app,
    startsAt: r.starts_at,
    creditedMinutes: r.credited_minutes,
    title: r.title,
    topic: r.lesson?.title ?? r.module?.title ?? null,
  };
}

/** Every class that can count toward this teacher's letters, any date, oldest first. */
async function countableClasses(teacherId: string): Promise<LetterSourceClass[]> {
  const { data, error } = await createAdminClient()
    .from("classes")
    .select(CLASS_SELECT)
    .eq("teacher_id", teacherId)
    .eq("status", "approved")
    .eq("rtk_app", rtkApp())
    .gt("credited_minutes", 0)
    .order("starts_at", { ascending: true })
    .limit(2000);
  if (error) throw new Error(`letters: classes: ${error.message}`);
  return ((data ?? []) as unknown as ClassQueryRow[]).map(toSource);
}

const EVERY_DATE = { start: "2000-01-01", end: "2100-12-31" } as const;

/* ── The teacher's page (/classes/teaching/letter) ─────────────────── */

/** One of the teacher's own letters, as their page lists it. */
export type TeacherLetter = Pick<
  HoursLetterRow,
  | "id"
  | "code"
  | "status"
  | "period_start"
  | "period_end"
  | "total_minutes"
  | "class_count"
  | "requested_at"
  | "issued_at"
  | "decline_reason"
  | "revoked_at"
  | "revoked_reason"
>;

export type TeacherLetterDesk = {
  /** The locked name (class_teachers.letter_name). */
  letterName: string;
  /** Owner, staff or listed: the page shows LETTER_SENTENCES.noLetters instead of the form. */
  blocked: boolean;
  /** Every approved class with minutes, any date, for the form's live preview. */
  classes: HoursLetterClass[];
  defaultPeriod: { start: string; end: string };
  /** Pacific today: the latest end date the form allows. */
  today: string;
  openRequests: number;
  maxOpenRequests: number;
  letters: TeacherLetter[];
};

const TEACHER_LETTER_SELECT =
  "id, code, status, period_start, period_end, total_minutes, class_count, requested_at, issued_at, decline_reason, revoked_at, revoked_reason";

export async function loadTeacherLetterDesk(
  user: AppUser,
  opts: { now?: Date } = {}
): Promise<Result<{ desk: TeacherLetterDesk }>> {
  if (!(await classesVisible())) return fail("forbidden", LETTER_SENTENCES.hidden);
  const teacher = await getTeacher(user.id);
  if (!teacher) return fail("forbidden", LETTER_SENTENCES.notTeacher);
  const now = opts.now ?? new Date();
  let blocked: boolean;
  let source: LetterSourceClass[];
  let own: TeacherLetter[];
  try {
    const [b, s, letters] = await Promise.all([
      lettersBlockedFor(user.id, user.email, teacher),
      countableClasses(user.id),
      createAdminClient()
        .from("hours_letters")
        .select(TEACHER_LETTER_SELECT)
        .eq("teacher_id", user.id)
        .order("requested_at", { ascending: false })
        .limit(50),
    ]);
    if (letters.error) throw new Error(letters.error.message);
    blocked = b;
    source = s;
    own = (letters.data ?? []) as TeacherLetter[];
  } catch (e) {
    console.error("loadTeacherLetterDesk:", (e as Error).message);
    return fail("server", LETTER_SENTENCES.load);
  }
  return {
    ok: true,
    desk: {
      letterName: teacher.letter_name,
      blocked,
      classes: classesForLetter(source, { teacherId: user.id, app: rtkApp(), ...EVERY_DATE }),
      defaultPeriod: defaultLetterPeriod(now),
      today: pacificDate(now),
      openRequests: own.filter((l) => l.status === "requested").length,
      maxOpenRequests: LETTER_LIMITS.maxOpenRequests,
      letters: own,
    },
  };
}

/* ── Asking (section 9.2 step 1) ───────────────────────────────────── */

/**
 * Snapshots the teacher's approved classes in the range into a `requested`
 * row and emails the safety lead. There's no name in the input on purpose:
 * the letter carries the locked class_teachers.letter_name, and anything
 * else a caller sends is ignored.
 */
export async function requestHoursLetter(
  user: AppUser,
  input: { start: unknown; end: unknown },
  opts: { now?: Date } = {}
): Promise<Result<{ id: string; classCount: number; totalMinutes: number }>> {
  if (!(await classesVisible())) return fail("forbidden", LETTER_SENTENCES.hidden);
  const teacher = await getTeacher(user.id);
  if (!teacher) return fail("forbidden", LETTER_SENTENCES.notTeacher);
  if (await lettersBlockedFor(user.id, user.email, teacher)) return fail("forbidden", LETTER_SENTENCES.noLetters);

  const now = opts.now ?? new Date();
  const period = checkLetterPeriod(input.start, input.end, pacificDate(now));
  if (!period.ok) return { ...fail("validation", period.error), field: period.field };

  const admin = createAdminClient();
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();
  const [open, today] = await Promise.all([
    admin
      .from("hours_letters")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", user.id)
      .eq("status", "requested"),
    admin
      .from("hours_letters")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", user.id)
      .gte("requested_at", dayAgo),
  ]);
  if (open.error || today.error) return fail("server", LETTER_SENTENCES.save);
  if ((open.count ?? 0) >= LETTER_LIMITS.maxOpenRequests) return fail("conflict", LETTER_SENTENCES.tooManyOpen);
  if ((today.count ?? 0) >= LETTER_LIMITS.requestsPerDay)
    return fail("rate_limited", LETTER_SENTENCES.tooManyToday, 86_400);

  let source: LetterSourceClass[];
  try {
    source = await countableClasses(user.id);
  } catch (e) {
    console.error("requestHoursLetter:", (e as Error).message);
    return fail("server", LETTER_SENTENCES.save);
  }
  const classes = classesForLetter(source, {
    teacherId: user.id,
    app: rtkApp(),
    start: period.start,
    end: period.end,
  });
  if (classes.length === 0) return { ...fail("validation", LETTER_SENTENCES.noClasses), field: "start" };
  const totals = letterTotals(classes);

  const { data: row, error } = await admin
    .from("hours_letters")
    .insert({
      teacher_id: user.id,
      letter_name: teacher.letter_name,
      period_start: period.start,
      period_end: period.end,
      total_minutes: totals.totalMinutes,
      class_count: totals.classCount,
      classes,
      coordinator_name: COORDINATOR.name,
      coordinator_email: COORDINATOR.email,
      status: "requested",
    })
    .select("id")
    .single();
  if (error || !row) {
    console.error("requestHoursLetter:", error?.message);
    return fail("server", LETTER_SENTENCES.save);
  }
  const id = row.id as string;
  await logLetterEvent("letter_requested", user.id, {
    letterId: id,
    teacherId: user.id,
    classCount: totals.classCount,
    totalMinutes: totals.totalMinutes,
  });

  const to = letterSignerAddress();
  if (to) {
    const handle = (await handlesFor([user.id])).get(user.id) ?? null;
    await sendLetterMail(
      "letter request",
      letterRequestEmail({
        to,
        teacherHandle: handle,
        letterName: teacher.letter_name,
        start: period.start,
        end: period.end,
        classCount: totals.classCount,
        totalMinutes: totals.totalMinutes,
        classes,
      })
    );
  }
  return { ok: true, id, ...totals };
}

/* ── The signing desk (/admin/classes/letters) ─────────────────────── */

/** One class on a request, with what the reviewer should know about it. */
export type DeskClass = HoursLetterClass & {
  /** /admin/classes/[id] */
  reviewPath: string;
  /** The class's status now. */
  currentStatus: string | null;
  verdict: ReviewVerdict | null;
  /** Model flags plus code flags. */
  flagCount: number;
  chatBlocked: number;
  /** A restricted safety review this viewer can't open. */
  restrictedHidden: boolean;
  restricted: boolean;
  /** Reports filed about this class. */
  reports: number;
  /** "Credited 40 of 52 computed minutes: <note>" when the reviewer overrode it. */
  minutesNote: string | null;
};

export type DeskLetter = {
  id: string;
  status: LetterStatus;
  code: string | null;
  teacherId: string;
  teacherHandle: string | null;
  letterName: string;
  /** The locked name now, when it differs from the one on the request. */
  currentLetterName: string | null;
  start: string;
  end: string;
  totalMinutes: number;
  classCount: number;
  classes: DeskClass[];
  requestedAt: string;
  issuedAt: string | null;
  decidedByHandle: string | null;
  declineReason: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  /** An owner, staff or listed account: can't be signed. */
  blocked: boolean;
  /** What changed since the request (requests only). */
  drift: string[];
};

export type LettersDesk = {
  role: ClassReviewerRole;
  /** The viewer is the safety lead, the only one who can sign. */
  canSign: boolean;
  requests: DeskLetter[];
  issued: DeskLetter[];
  closed: DeskLetter[];
};

const DESK_SELECT =
  "id, code, teacher_id, letter_name, period_start, period_end, total_minutes, class_count, classes, status, requested_at, approved_by, issued_at, decline_reason, revoked_at, revoked_reason";

type DeskRow = Pick<
  HoursLetterRow,
  | "id"
  | "code"
  | "teacher_id"
  | "letter_name"
  | "period_start"
  | "period_end"
  | "total_minutes"
  | "class_count"
  | "classes"
  | "status"
  | "requested_at"
  | "approved_by"
  | "issued_at"
  | "decline_reason"
  | "revoked_at"
  | "revoked_reason"
>;

type CurrentClassRow = {
  id: string;
  status: string;
  teacher_id: string | null;
  rtk_app: string;
  credited_minutes: number | null;
  credited_minutes_computed: number | null;
  decision_note: string | null;
};

async function currentClasses(ids: string[]): Promise<Map<string, CurrentClassRow>> {
  const out = new Map<string, CurrentClassRow>();
  const unique = [...new Set(ids.filter(isUuid))];
  for (let i = 0; i < unique.length; i += 200) {
    const { data, error } = await createAdminClient()
      .from("classes")
      .select("id, status, teacher_id, rtk_app, credited_minutes, credited_minutes_computed, decision_note")
      .in("id", unique.slice(i, i + 200));
    if (error) throw new Error(`letters: current classes: ${error.message}`);
    for (const r of (data ?? []) as CurrentClassRow[]) out.set(r.id, r);
  }
  return out;
}

const asCurrent = (r: CurrentClassRow): CurrentClass => ({
  teacherId: r.teacher_id,
  status: r.status,
  rtkApp: r.rtk_app,
  creditedMinutes: r.credited_minutes,
});

function driftFor(letter: Pick<DeskRow, "classes" | "teacher_id">, current: Map<string, CurrentClassRow>): string[] {
  const asMap = new Map<string, CurrentClass>();
  for (const [id, r] of current) asMap.set(id, asCurrent(r));
  return snapshotDrift(letter.classes ?? [], asMap, letter.teacher_id, rtkApp());
}

/**
 * Everything the signing desk shows: requests waiting (oldest first, each
 * class with its review flags), recently signed letters, and recently
 * declined or withdrawn ones. Super admins and the safety lead only.
 */
export async function loadLettersDesk(user: AppUser): Promise<Result<{ desk: LettersDesk }>> {
  const access = await requireClassReviewer(user);
  if (!access.ok) return access;
  const admin = createAdminClient();
  const [requested, issued, closed] = await Promise.all([
    admin.from("hours_letters").select(DESK_SELECT).eq("status", "requested").order("requested_at", { ascending: true }).limit(100),
    admin.from("hours_letters").select(DESK_SELECT).eq("status", "issued").order("issued_at", { ascending: false }).limit(100),
    admin
      .from("hours_letters")
      .select(DESK_SELECT)
      .in("status", ["declined", "revoked"])
      .order("requested_at", { ascending: false })
      .limit(30),
  ]);
  if (requested.error || issued.error || closed.error) return fail("server", LETTER_SENTENCES.save);
  const reqRows = (requested.data ?? []) as DeskRow[];
  const allRows = [...reqRows, ...((issued.data ?? []) as DeskRow[]), ...((closed.data ?? []) as DeskRow[])];

  const teacherIds = [...new Set(allRows.map((r) => r.teacher_id))];
  const classIds = [...new Set(reqRows.flatMap((r) => (r.classes ?? []).map((c) => c.classId)).filter(isUuid))];
  const none = Promise.resolve({ data: [] as Record<string, unknown>[] });
  let enriched;
  try {
    enriched = await Promise.all([
      handlesFor([...teacherIds, ...allRows.map((r) => r.approved_by)]),
      teacherIds.length
        ? admin
            .from("class_teachers")
            .select("user_id, letter_name, letters_blocked, suspended_at, suspended_reason")
            .in("user_id", teacherIds)
        : none,
      currentClasses(classIds),
      classIds.length
        ? admin
            .from("class_reviews")
            .select("class_id, verdict, flags, code_flags, restricted, chat_blocked_count")
            .in("class_id", classIds)
        : none,
      classIds.length
        ? admin.from("user_reports").select("content_id").eq("content_kind", "class").in("content_id", classIds)
        : none,
      canSeeRestricted(user),
      // Only requests can still be signed, so only their teachers need the check.
      Promise.all(
        [...new Set(reqRows.map((r) => r.teacher_id))].map(async (id) => {
          const t = await getTeacher(id);
          return (await lettersBlockedFor(id, await emailOf(id), t)) ? id : null;
        })
      ),
      isLetterSigner(user.id),
    ]);
  } catch (e) {
    console.error("loadLettersDesk:", (e as Error).message);
    return fail("server", LETTER_SENTENCES.load);
  }
  const [handles, teacherRows, current, reviews, reports, seeRestricted, blockedIds, canSign] = enriched;

  const teachers = new Map<string, Record<string, unknown>>();
  for (const t of teacherRows.data ?? []) teachers.set(t.user_id as string, t);
  const reviewOf = new Map<string, Record<string, unknown>>();
  for (const r of reviews.data ?? []) reviewOf.set(r.class_id as string, r);
  const reportCount = new Map<string, number>();
  for (const r of reports.data ?? []) {
    const id = r.content_id as string;
    reportCount.set(id, (reportCount.get(id) ?? 0) + 1);
  }
  const blocked = new Set(blockedIds.filter((x): x is string => !!x));

  const toDesk = (r: DeskRow, withClasses: boolean): DeskLetter => {
    const t = teachers.get(r.teacher_id);
    const nowName = (t?.letter_name as string | undefined) ?? null;
    const classes: DeskClass[] = (r.classes ?? []).map((c) => {
      const cur = current.get(c.classId);
      const rev = reviewOf.get(c.classId);
      const restricted = !!rev?.restricted;
      const flags = Array.isArray(rev?.flags) ? (rev.flags as unknown[]).length : 0;
      const codeFlags = Array.isArray(rev?.code_flags) ? (rev.code_flags as unknown[]).length : 0;
      const computed = cur?.credited_minutes_computed ?? null;
      const credited = cur?.credited_minutes ?? null;
      return {
        ...c,
        reviewPath: `/admin/classes/${c.classId}`,
        currentStatus: withClasses ? (cur?.status ?? null) : null,
        verdict: withClasses ? ((rev?.verdict as ReviewVerdict | null | undefined) ?? null) : null,
        flagCount: withClasses ? flags + codeFlags : 0,
        chatBlocked: withClasses ? Number(rev?.chat_blocked_count ?? 0) : 0,
        restricted: withClasses && restricted,
        restrictedHidden: withClasses && restricted && !seeRestricted,
        reports: withClasses ? (reportCount.get(c.classId) ?? 0) : 0,
        minutesNote:
          withClasses && credited !== null && computed !== null && credited !== computed
            ? `Credited ${credited} of ${computed} computed minutes${cur?.decision_note ? `: ${cur.decision_note}` : ""}`
            : null,
      };
    });
    return {
      id: r.id,
      status: r.status,
      code: r.code,
      teacherId: r.teacher_id,
      teacherHandle: handles.get(r.teacher_id) ?? null,
      letterName: r.letter_name,
      currentLetterName: nowName && nowName !== r.letter_name ? nowName : null,
      start: r.period_start,
      end: r.period_end,
      totalMinutes: r.total_minutes,
      classCount: r.class_count,
      classes,
      requestedAt: r.requested_at,
      issuedAt: r.issued_at,
      decidedByHandle: r.approved_by ? (handles.get(r.approved_by) ?? null) : null,
      declineReason: r.decline_reason,
      revokedAt: r.revoked_at,
      revokedReason: r.revoked_reason,
      suspendedAt: (t?.suspended_at as string | null | undefined) ?? null,
      suspendedReason: (t?.suspended_reason as string | null | undefined) ?? null,
      blocked: withClasses && blocked.has(r.teacher_id),
      drift: withClasses ? driftFor(r, current) : [],
    };
  };

  return {
    ok: true,
    desk: {
      role: access.role,
      canSign,
      requests: reqRows.map((r) => toDesk(r, true)),
      issued: ((issued.data ?? []) as DeskRow[]).map((r) => toDesk(r, false)),
      closed: ((closed.data ?? []) as DeskRow[]).map((r) => toDesk(r, false)),
    },
  };
}

/* ── Signing, declining, withdrawing (section 9.2 steps 2 and 6) ───── */

async function letterById(id: unknown): Promise<DeskRow | null> {
  if (!isUuid(id)) return null;
  const { data } = await createAdminClient().from("hours_letters").select(DESK_SELECT).eq("id", id).maybeSingle();
  return (data as DeskRow | null) ?? null;
}

function checkReason(raw: unknown): { ok: true; reason: string } | Failure {
  const reason = typeof raw === "string" ? raw.trim() : "";
  if (reason.length < 3) return { ...fail("validation", LETTER_SENTENCES.reason), field: "reason" };
  if (reason.length > 500) return { ...fail("validation", LETTER_SENTENCES.reasonLong), field: "reason" };
  return { ok: true, reason };
}

/**
 * "Approve and sign": checks the request against the records once more
 * (still not an owner or staff account, the same locked name, every class
 * still approved for the same minutes), then issues it with a new code and
 * emails the teacher. The code doesn't exist before this.
 */
export async function approveHoursLetter(
  user: AppUser,
  input: { id: unknown }
): Promise<Result<{ code: string }>> {
  const access = await requireClassReviewer(user);
  if (!access.ok) return access;
  if (!(await isLetterSigner(user.id))) return fail("forbidden", LETTER_SENTENCES.signerOnly);
  const letter = await letterById(input.id);
  if (!letter) return fail("not_found", LETTER_SENTENCES.notFound);
  if (letter.status !== "requested") return fail("conflict", LETTER_SENTENCES.answered);
  if (letter.teacher_id === user.id) return fail("forbidden", LETTER_SENTENCES.ownLetter);

  const teacherEmail = await emailOf(letter.teacher_id);
  const teacher = await getTeacher(letter.teacher_id);
  if (await lettersBlockedFor(letter.teacher_id, teacherEmail, teacher))
    return fail("forbidden", LETTER_SENTENCES.blockedAccount);
  if (!teacher) return fail("conflict", LETTER_SENTENCES.notTeacherNow);
  if (teacher.letter_name !== letter.letter_name) return fail("conflict", LETTER_SENTENCES.nameChanged);
  const drift = driftFor(letter, await currentClasses((letter.classes ?? []).map((c) => c.classId)));
  if (drift.length > 0) return fail("conflict", `${LETTER_SENTENCES.drifted} ${drift.join(" ")}`);

  const admin = createAdminClient();
  let code: string | null = null;
  for (let attempt = 0; attempt < 5 && !code; attempt++) {
    const candidate = makeLetterCode((n) => randomInt(n));
    const { data, error } = await admin
      .from("hours_letters")
      .update({
        status: "issued",
        code: candidate,
        approved_by: user.id,
        issued_at: new Date().toISOString(),
      })
      .eq("id", letter.id)
      .eq("status", "requested")
      .select("id");
    if (error) {
      // 23505: the code is taken (the unique index). Draw another.
      if (error.code === "23505") continue;
      console.error("approveHoursLetter:", error.message);
      return fail("server", LETTER_SENTENCES.save);
    }
    if (!data || data.length === 0) return fail("conflict", LETTER_SENTENCES.answered);
    code = candidate;
  }
  if (!code) return fail("server", LETTER_SENTENCES.save);

  await logLetterEvent("letter_issued", user.id, { letterId: letter.id, teacherId: letter.teacher_id, code });
  if (teacherEmail) {
    await sendLetterMail(
      "letter issued",
      letterIssuedEmail({
        to: teacherEmail,
        letterName: letter.letter_name,
        code,
        classCount: letter.class_count,
        totalMinutes: letter.total_minutes,
      })
    );
  }
  return { ok: true, code };
}

/**
 * "Decline": a request that won't be signed, with a reason the teacher
 * reads. Any class reviewer can decline, since a refusal signs nothing.
 */
export async function declineHoursLetter(user: AppUser, input: { id: unknown; reason: unknown }): Promise<Result> {
  const access = await requireClassReviewer(user);
  if (!access.ok) return access;
  const reason = checkReason(input.reason);
  if (!reason.ok) return reason;
  const letter = await letterById(input.id);
  if (!letter) return fail("not_found", LETTER_SENTENCES.notFound);
  if (letter.status !== "requested") return fail("conflict", LETTER_SENTENCES.answered);

  // approved_by is the table's one "who decided" column: on a declined row it
  // names who declined it.
  const { data, error } = await createAdminClient()
    .from("hours_letters")
    .update({ status: "declined", decline_reason: reason.reason, approved_by: user.id })
    .eq("id", letter.id)
    .eq("status", "requested")
    .select("id");
  if (error) {
    console.error("declineHoursLetter:", error.message);
    return fail("server", LETTER_SENTENCES.save);
  }
  if (!data || data.length === 0) return fail("conflict", LETTER_SENTENCES.answered);

  await logLetterEvent("letter_declined", user.id, { letterId: letter.id, teacherId: letter.teacher_id });
  const to = await emailOf(letter.teacher_id);
  if (to) await sendLetterMail("letter declined", letterDeclinedEmail({ to, reason: reason.reason }));
  return { ok: true };
}

/** Withdraws a signed letter. Its verify page says so from then on. */
export async function revokeHoursLetter(user: AppUser, input: { id: unknown; reason: unknown }): Promise<Result> {
  const access = await requireClassReviewer(user);
  if (!access.ok) return access;
  const reason = checkReason(input.reason);
  if (!reason.ok) return reason;
  const letter = await letterById(input.id);
  if (!letter) return fail("not_found", LETTER_SENTENCES.notFound);
  if (letter.status !== "issued" || !letter.code) return fail("conflict", LETTER_SENTENCES.notIssued);

  const { data, error } = await createAdminClient()
    .from("hours_letters")
    .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_reason: reason.reason })
    .eq("id", letter.id)
    .eq("status", "issued")
    .select("id");
  if (error) {
    console.error("revokeHoursLetter:", error.message);
    return fail("server", LETTER_SENTENCES.save);
  }
  if (!data || data.length === 0) return fail("conflict", LETTER_SENTENCES.notIssued);

  await logLetterEvent("letter_revoked", user.id, { letterId: letter.id, teacherId: letter.teacher_id, code: letter.code });
  const to = await emailOf(letter.teacher_id);
  if (to) await sendLetterMail("letter revoked", letterRevokedEmail({ to, code: letter.code, reason: reason.reason }));
  return { ok: true };
}

/* ── Reading a signed letter ───────────────────────────────────────── */

/** A signed (or withdrawn) letter, everything the letter page prints. */
export type SignedLetter = {
  id: string;
  code: string;
  status: "issued" | "revoked";
  letterName: string;
  start: string;
  end: string;
  totalMinutes: number;
  classCount: number;
  classes: HoursLetterClass[];
  coordinatorName: string;
  coordinatorEmail: string;
  /** Pacific date it was signed. */
  issuedOn: string;
  revokedOn: string | null;
  revokedReason: string | null;
};

const SIGNED_SELECT =
  "id, code, teacher_id, status, letter_name, period_start, period_end, total_minutes, class_count, classes, coordinator_name, coordinator_email, issued_at, revoked_at, revoked_reason";

type SignedRow = Pick<
  HoursLetterRow,
  | "id"
  | "code"
  | "teacher_id"
  | "status"
  | "letter_name"
  | "period_start"
  | "period_end"
  | "total_minutes"
  | "class_count"
  | "classes"
  | "coordinator_name"
  | "coordinator_email"
  | "issued_at"
  | "revoked_at"
  | "revoked_reason"
>;

async function signedByCode(code: string): Promise<SignedRow | null> {
  const { data } = await createAdminClient()
    .from("hours_letters")
    .select(SIGNED_SELECT)
    .eq("code", code)
    .in("status", ["issued", "revoked"])
    .maybeSingle();
  const row = (data as SignedRow | null) ?? null;
  if (!row || !row.code || !row.issued_at) return null;
  return (await fromThisApp(row)) ? row : null;
}

/**
 * Dev and prod share one database, so a letter signed on a dev server (only
 * ever test data) mustn't verify on learnfrc.com, and the other way round.
 * A letter only counts classes of one app, so its first class says which.
 */
async function fromThisApp(row: Pick<SignedRow, "classes">): Promise<boolean> {
  const first = (row.classes ?? []).find((c) => isUuid(c.classId));
  if (!first) return true;
  const { data } = await createAdminClient().from("classes").select("rtk_app").eq("id", first.classId).maybeSingle();
  return !data || data.rtk_app === rtkApp();
}

function toSigned(row: SignedRow): SignedLetter {
  return {
    id: row.id,
    code: row.code as string,
    status: row.status === "revoked" ? "revoked" : "issued",
    letterName: row.letter_name,
    start: row.period_start,
    end: row.period_end,
    totalMinutes: row.total_minutes,
    classCount: row.class_count,
    classes: row.classes ?? [],
    coordinatorName: row.coordinator_name,
    coordinatorEmail: row.coordinator_email,
    issuedOn: pacificDate(row.issued_at as string),
    revokedOn: row.revoked_at ? pacificDate(row.revoked_at) : null,
    revokedReason: row.revoked_reason,
  };
}

/**
 * The printable letter, for its teacher, the safety lead and super admins
 * only. Anyone else gets null, the same as a code that doesn't exist, so
 * the page never says whether a letter is there.
 */
export async function getLetterForViewer(
  user: AppUser | null,
  rawCode: unknown
): Promise<{ letter: SignedLetter; viewer: "owner" | ClassReviewerRole } | null> {
  if (!user) return null;
  const code = normalizeLetterCode(rawCode);
  if (!code) return null;
  const row = await signedByCode(code);
  if (!row) return null;
  if (row.teacher_id === user.id) return { letter: toSigned(row), viewer: "owner" };
  const access = await requireClassReviewer(user);
  if (!access.ok) return null;
  return { letter: toSigned(row), viewer: access.role };
}

/* ── The public verify page (section 9.2 step 5) ───────────────────── */

export type VerifyResult =
  | { state: "valid"; letter: Omit<SignedLetter, "id" | "revokedOn" | "revokedReason"> }
  | { state: "withdrawn"; code: string; revokedOn: string }
  | { state: "not_found" }
  | { state: "rate_limited" };

/** rateLimit("verify-letter", 30, 3600): 30 checks an hour per address. */
export const VERIFY_LIMIT = { max: 30, windowSeconds: 3600 } as const;

/**
 * What the verify page shows for a code: a valid letter's facts, the date it
 * was withdrawn, or nothing. Rate-limited per IP; `opts.rateKey` keys the
 * limit on something else instead (scripts and tests, which have no request).
 */
export async function verifyHoursLetter(rawCode: unknown, opts: { rateKey?: string } = {}): Promise<VerifyResult> {
  const allowed = opts.rateKey
    ? await rateLimitKey("verify-letter", VERIFY_LIMIT.max, VERIFY_LIMIT.windowSeconds, opts.rateKey)
    : await rateLimit("verify-letter", VERIFY_LIMIT.max, VERIFY_LIMIT.windowSeconds);
  if (!allowed) return { state: "rate_limited" };
  const code = normalizeLetterCode(rawCode);
  if (!code) return { state: "not_found" };
  const row = await signedByCode(code);
  if (!row) return { state: "not_found" };
  const letter = toSigned(row);
  if (letter.status === "revoked") return { state: "withdrawn", code: letter.code, revokedOn: letter.revokedOn ?? letter.issuedOn };
  return {
    state: "valid",
    letter: {
      code: letter.code,
      status: letter.status,
      letterName: letter.letterName,
      start: letter.start,
      end: letter.end,
      totalMinutes: letter.totalMinutes,
      classCount: letter.classCount,
      classes: letter.classes,
      coordinatorName: letter.coordinatorName,
      coordinatorEmail: letter.coordinatorEmail,
      issuedOn: letter.issuedOn,
    },
  };
}
