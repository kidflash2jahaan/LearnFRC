import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOwnerEmail } from "@/lib/auth";
import { firstProfaneField } from "@/lib/profanity";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { teamRoleLabel } from "@/lib/team-roles";
import { PUBLIC_CONTACT_EMAIL } from "@/lib/email";
import { isUuid } from "@/lib/app/http";
import { toIso } from "@/lib/app/format";
import { BAD_REQUEST, NOT_SUPER_ADMIN, requireSiteRole, siteRoleFor, textField } from "@/lib/app/admin-access";
import { emailFor } from "@/lib/app/admin-notify";
import { CLASS_SENTENCES, classEligibilityDetail, type EligibilityDetail } from "@/lib/app/classes";
import { requireClassReviewer, type ClassReviewerRole } from "@/lib/app/class-reviewers";
import { cancelTeacherClasses } from "@/lib/app/classes-teaching";
import {
  auditSalt,
  classesVisible,
  getClassSettings,
  noLetterUserIds,
  ownerEmail,
  teachUrl,
} from "@/lib/classes/config";
import { ageBand, ageOn } from "@/lib/classes/age";
import { findContactPatterns } from "@/lib/classes/contact-patterns";
import { TEACHER_CODE_VERSION } from "@/lib/classes/notice";
import {
  TEACHER_APPLY_LIMITS,
  checkTeacherApplication,
  letterNameProblem,
  lettersBlockedFor,
  normalizeName,
  parentStepFor,
  parentStepFromRows,
  teachApplyMode,
  type ParentStep,
  type TeachApplyMode,
  type TeacherApplicationStatus,
} from "@/lib/classes/teacher-rules";
import {
  letterNameChangedMail,
  mailTeacher,
  teacherAcceptedMail,
  teacherApplicationNotifyMail,
  teacherApplicationReceivedMail,
  teacherRejectedMail,
  teacherUnsuspendedMail,
} from "@/lib/classes/emails-teacher";
import { fail, type AppUser, type Failure, type Result } from "@/lib/app/result";
import type { AgeBand, ClassStatus, ClassTeacherRow, SystemActor } from "@/lib/classes/types";

/**
 * Teachers (classes-design.md sections 3.1, 7.6, 9.1 and 11): applying on
 * /apply/teach, the desk on /admin/classes/teachers (accept, reject, suspend,
 * unsuspend, the locked letter name), and the teacher record every other
 * classes package reads (getTeacher, teachingGate).
 *
 * Every read and write is service role, scoped by the id auth.getUser()
 * verified. The rules (limits, the apply state machine, who gets
 * letters_blocked) are pure functions in src/lib/classes/teacher-rules.ts.
 *
 * Who may do what:
 * - Applying: a signed-in account with a handle, an age answer of 13 to 17,
 *   not on an under-13 device, whose parent hasn't said no, that agrees to
 *   the current teacher code. The parent OK can come later; scheduling waits
 *   for it (teachingGate).
 * - Accept, reject and "Change letter name": super admins (Jahaan decides).
 * - Suspend and unsuspend: super admins and the safety lead, plus the system
 *   (the room's auto-end on two reports).
 *
 * The letter name is copied from the application's legal_name on accept and
 * locked. Nothing here lets a teacher change it; only changeLetterName does,
 * for a super admin, with a note.
 */

/* ── Sentences ─────────────────────────────────────────────────────── */

/*
 * The four shared sentences are getters, read when used rather than when this
 * module loads: classes.ts imports classes-teaching.ts, which may import this
 * file, so CLASS_SENTENCES can still be uninitialized at load time.
 */
export const TEACHER_SENTENCES = {
  get hidden() {
    return CLASS_SENTENCES.hidden;
  },
  get deviceBlocked() {
    return CLASS_SENTENCES.deviceBlocked;
  },
  get adult() {
    return CLASS_SENTENCES.adult;
  },
  get parentDeclined() {
    return CLASS_SENTENCES.parentDeclined;
  },
  signIn: "Sign in first, then apply.",
  noHandle: "Pick a username in Settings first, then apply.",
  needsAge: "Answer one quick question first, then apply.",
  code: "Read the teacher code and tick the box to agree to it.",
  already: "You're already a teacher.",
  suspended: `Your teaching is paused, so there's nothing to apply for right now. If you have questions, write to ${PUBLIC_CONTACT_EMAIL}.`,
  pending: "You already have an application waiting. Sit tight.",
  noPending: "There's no open application to withdraw.",
  rate: "That's a lot of applications today. Try again tomorrow.",
  save: "Couldn't save that. Please try again.",
  topics: "One of the picked topics isn't on LearnFRC.",
  profaneName: "That name won't work on a letter. Use the name your school knows you by.",
  notTeacher: "Apply to teach first.",
  teachSuspended: `Your teaching is paused. If you have questions, write to ${PUBLIC_CONTACT_EMAIL}.`,
  codeOutdated: "The teacher code changed. Read it and agree again on the teaching application page.",
  teachNeedsParent: "Your parent or guardian needs to say OK before you teach a class.",
  noLongerTeacher: "That account isn't a teacher.",
  notStaff: "Only LearnFRC's super admins and the safety lead can do that.",
} as const;

/* ── Small helpers ─────────────────────────────────────────────────── */

const LOG = "class-teachers";

/** HMAC of the caller's IP (CLASSES_AUDIT_SALT) and the user agent, for consent rows. */
async function requestFacts(): Promise<{ ipHash: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "";
    return {
      ipHash: ip ? createHmac("sha256", auditSalt()).update(ip).digest("hex") : null,
      userAgent: h.get("user-agent")?.slice(0, 300) || null,
    };
  } catch {
    // Outside a request (scripts): nothing to record.
    return { ipHash: null, userAgent: null };
  }
}

/** The pages that print teachers and applications. Never throws. */
function revalidateTeacherPages() {
  for (const path of ["/apply", "/apply/teach", "/admin/classes/teachers", "/classes/teaching"]) {
    try {
      revalidatePath(path);
    } catch {
      // Outside a request (scripts and checks), there's no cache to refresh.
    }
  }
}

/** An audit row in class_events (no class). Never throws. */
async function logTeacherEvent(actorId: string, kind: string, detail: Record<string, unknown>) {
  try {
    await createAdminClient().from("class_events").insert({ class_id: null, actor_id: actorId, kind, detail });
  } catch (e) {
    console.error(`${LOG}: event ${kind}:`, e);
  }
}

function ageBandFrom(row: { birth_year: number; birth_month: number } | null | undefined, now = new Date()) {
  return row ? ageBand(ageOn(now, row.birth_year, row.birth_month)) : null;
}

/** Topic titles for lesson or module ids, in the order given. Unknown ids are left out. */
async function topicTitles(ids: string[]): Promise<Map<string, { title: string; kind: "lesson" | "module" }>> {
  const out = new Map<string, { title: string; kind: "lesson" | "module" }>();
  const unique = [...new Set(ids.filter(isUuid))];
  if (unique.length === 0) return out;
  const admin = createAdminClient();
  const [{ data: lessons }, { data: modules }] = await Promise.all([
    admin.from("lessons").select("id, title").in("id", unique),
    admin.from("modules").select("id, title").in("id", unique),
  ]);
  for (const m of modules ?? []) out.set(m.id as string, { title: m.title as string, kind: "module" });
  for (const l of lessons ?? []) out.set(l.id as string, { title: l.title as string, kind: "lesson" });
  return out;
}

/**
 * A super admin, or the safety lead (requireClassReviewer, from the
 * safety-holds package). The super-admin check runs first, so the desk works
 * for Jahaan whatever state that check is in.
 */
async function requireTeacherStaff(
  user: AppUser
): Promise<{ ok: true; role: ClassReviewerRole } | Failure> {
  if ((await siteRoleFor(user)) === "superadmin") return { ok: true, role: "superadmin" };
  const gate = await requireClassReviewer(user);
  if (!gate.ok) return gate;
  return { ok: true, role: gate.role };
}

/* ── The teacher record ────────────────────────────────────────────── */

/** The class_teachers row for an account, or null when they aren't a teacher. */
export async function getTeacher(userId: string): Promise<ClassTeacherRow | null> {
  if (!isUuid(userId)) return null;
  const { data, error } = await createAdminClient()
    .from("class_teachers")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error(`${LOG}: getTeacher:`, error.message);
    return null;
  }
  return (data as ClassTeacherRow | null) ?? null;
}

/**
 * Whether someone can teach right now (section 4): classes visible, `ready`
 * (13 to 17 with a parent OK), and a class_teachers row that isn't suspended
 * and has the current teacher code. Scheduling and joining as the teacher
 * check this; the sentence is what the page shows.
 */
export async function teachingGate(
  user: AppUser | null
): Promise<Result<{ teacher: ClassTeacherRow; eligibility: EligibilityDetail }>> {
  const detail = await classEligibilityDetail(user);
  if (detail.state === "hidden") return fail("forbidden", TEACHER_SENTENCES.hidden);
  if (!user || detail.state === "signed_out") return fail("unauthorized", CLASS_SENTENCES.signedOut);
  const teacher = await getTeacher(user.id);
  switch (detail.state) {
    case "needs_handle":
      return fail("forbidden", CLASS_SENTENCES.needsHandle);
    case "device_blocked":
      return fail("forbidden", CLASS_SENTENCES.deviceBlocked);
    case "needs_age":
      return fail("forbidden", CLASS_SENTENCES.needsAge);
    case "adult":
      return fail("forbidden", CLASS_SENTENCES.adult);
  }
  if (!teacher) return fail("forbidden", TEACHER_SENTENCES.notTeacher);
  if (teacher.suspended_at) return fail("forbidden", TEACHER_SENTENCES.teachSuspended);
  if (teacher.code_version !== TEACHER_CODE_VERSION) return fail("forbidden", TEACHER_SENTENCES.codeOutdated);
  if (detail.state === "parent_declined") return fail("forbidden", CLASS_SENTENCES.parentDeclined);
  if (detail.state !== "ready") return fail("forbidden", TEACHER_SENTENCES.teachNeedsParent);
  return { ok: true, teacher, eligibility: detail };
}

/* ── Where someone stands on /apply/teach ──────────────────────────── */

type ProfileFacts = { username: string | null; team_number: number | null; role: string | null; bio: string | null };

type TeachFacts = {
  mode: TeachApplyMode;
  detail: EligibilityDetail;
  profile: ProfileFacts | null;
  teacher: ClassTeacherRow | null;
  latest: {
    id: string;
    status: TeacherApplicationStatus;
    created_at: string;
    reviewed_at: string | null;
    review_note: string | null;
  } | null;
};

async function teachFacts(user: AppUser | null, opts: { deviceBlocked?: boolean } = {}): Promise<TeachFacts> {
  const detail = await classEligibilityDetail(user, opts);
  if (!user || detail.state === "hidden" || detail.state === "signed_out") {
    return { mode: detail.state === "hidden" ? "hidden" : "signed-out", detail, profile: null, teacher: null, latest: null };
  }
  const admin = createAdminClient();
  const [{ data: profile }, teacher, { data: latest }] = await Promise.all([
    admin.from("profiles").select("username, team_number, role, bio").eq("id", user.id).maybeSingle(),
    getTeacher(user.id),
    admin
      .from("teacher_applications")
      .select("id, status, created_at, reviewed_at, review_note")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const mode = teachApplyMode({
    eligibility: detail.state,
    teacher: teacher
      ? { suspended: !!teacher.suspended_at, codeCurrent: teacher.code_version === TEACHER_CODE_VERSION }
      : null,
    latest: (latest?.status as TeacherApplicationStatus | undefined) ?? null,
  });
  return {
    mode,
    detail,
    profile: (profile as ProfileFacts | null) ?? null,
    teacher,
    latest: (latest as TeachFacts["latest"]) ?? null,
  };
}

/** What /apply/teach renders from. */
export type TeachApplyState = {
  mode: TeachApplyMode;
  username: string | null;
  teamNumber: number | null;
  teamRoleLabel: string | null;
  /** Null until the age question is answered. */
  ageBand: AgeBand | null;
  /** Where the parent OK stands, for 13 to 17 year olds. */
  parentStep: ParentStep | null;
  /** The latest application when it still says something to the applicant. */
  application: {
    status: "pending" | "rejected" | "withdrawn";
    createdAt: string;
    reviewedAt: string | null;
    reviewNote: string | null;
  } | null;
  /** The teacher record, for teachers (suspended or not). */
  teacher: {
    letterName: string;
    since: string;
    suspended: boolean;
    codeVersion: string | null;
  } | null;
  /** The profile bio has contact details, which blocks scheduling (section 11). */
  bioHasContact: boolean;
  /** The teacher code version the form agrees to. */
  codeVersion: string;
};

export async function loadTeachApplyState(
  user: AppUser | null,
  opts: { deviceBlocked?: boolean } = {}
): Promise<TeachApplyState> {
  const f = await teachFacts(user, opts);
  const latest = f.latest;
  const application =
    latest && (latest.status === "pending" || latest.status === "rejected" || latest.status === "withdrawn")
      ? {
          status: latest.status,
          createdAt: toIso(latest.created_at) ?? latest.created_at,
          reviewedAt: toIso(latest.reviewed_at),
          reviewNote: latest.review_note,
        }
      : null;
  return {
    mode: f.mode,
    username: f.profile?.username?.trim() || null,
    teamNumber: f.profile?.team_number ?? null,
    teamRoleLabel: f.profile?.role ? teamRoleLabel(f.profile.role) : null,
    ageBand: f.detail.ageBand,
    parentStep: parentStepFor(f.detail.state),
    application: f.teacher ? null : application,
    teacher: f.teacher
      ? {
          letterName: f.teacher.letter_name,
          since: toIso(f.teacher.granted_at) ?? f.teacher.granted_at,
          suspended: !!f.teacher.suspended_at,
          codeVersion: f.teacher.code_version,
        }
      : null,
    bioHasContact: findContactPatterns(f.profile?.bio ?? "").length > 0,
    codeVersion: TEACHER_CODE_VERSION,
  };
}

/**
 * The teacher entry in GET /api/app/apply's `roles` (section 14). Null while
 * classes are hidden, so nothing about classes reaches the app before launch.
 * `status` is the /apply/teach mode.
 */
export async function teacherApplyRole(user: AppUser | null): Promise<{
  id: "teacher";
  title: string;
  url: string;
  open: boolean;
  status: TeachApplyMode;
} | null> {
  if (!(await classesVisible())) return null;
  // The app has no device cookie; the website's /apply has its own.
  const { mode } = await teachFacts(user);
  if (mode === "hidden") return null;
  return { id: "teacher", title: "Teach a live class", url: teachUrl(), open: true, status: mode };
}

/* ── Applying ──────────────────────────────────────────────────────── */

/** The refusal for each mode that can't submit. Null when the form is open. */
function modeRefusal(mode: TeachApplyMode): Failure | null {
  switch (mode) {
    case "hidden":
      return fail("forbidden", TEACHER_SENTENCES.hidden);
    case "signed-out":
      return fail("unauthorized", TEACHER_SENTENCES.signIn);
    case "no-handle":
      return { ...fail("validation", TEACHER_SENTENCES.noHandle), field: "username" };
    case "needs-age":
      return fail("validation", TEACHER_SENTENCES.needsAge);
    case "device-blocked":
      return fail("forbidden", TEACHER_SENTENCES.deviceBlocked);
    case "adult":
      return fail("forbidden", TEACHER_SENTENCES.adult);
    case "parent-declined":
      return fail("forbidden", TEACHER_SENTENCES.parentDeclined);
    case "suspended":
      return fail("conflict", TEACHER_SENTENCES.suspended);
    case "teacher":
    case "code-outdated":
      return fail("conflict", TEACHER_SENTENCES.already);
    case "pending":
      return fail("conflict", TEACHER_SENTENCES.pending);
    case "new":
    case "again":
      return null;
  }
}

export type TeacherApplicationFields = {
  legalName?: unknown;
  topics?: unknown;
  topicIds?: unknown;
  experience?: unknown;
  samplePlan?: unknown;
  availability?: unknown;
  referenceName?: unknown;
  referenceEmail?: unknown;
  /** The TEACHER_CODE_VERSION the form showed, sent only when the box is ticked. */
  code?: unknown;
};

/**
 * Files a teacher application: the account's state first (a handle, an age
 * answer of 13 to 17, no parent refusal, not already a teacher, one pending
 * at a time), then the teacher code, then the fields, then the rate limits.
 * Writes the application and a `teacher_code` consent row, emails the
 * applicant and the owner.
 */
export async function submitTeacherApplication(
  user: AppUser,
  input: TeacherApplicationFields
): Promise<Result> {
  const f = await teachFacts(user);
  const refusal = modeRefusal(f.mode);
  if (refusal) return refusal;
  const username = f.profile?.username?.trim();
  if (!username) return { ...fail("validation", TEACHER_SENTENCES.noHandle), field: "username" };

  if (textField(input.code) !== TEACHER_CODE_VERSION)
    return { ...fail("validation", TEACHER_SENTENCES.code), field: "code" };

  const checked = checkTeacherApplication(input);
  if (!checked.ok) return { ...fail("validation", checked.error), field: checked.field };
  const v = checked.value;
  if (firstProfaneField({ legalName: v.legalName }))
    return { ...fail("validation", TEACHER_SENTENCES.profaneName), field: "legalName" };

  const titles = await topicTitles(v.topicIds);
  if (titles.size !== v.topicIds.length)
    return { ...fail("validation", TEACHER_SENTENCES.topics), field: "topicIds" };

  // Per account first (it follows them onto any network), then a looser one
  // per network against someone cycling throwaway accounts.
  if (
    !(await rateLimitKey("teacher-apply", 3, 86400, user.id)) ||
    !(await rateLimit("teacher-apply-ip", 25, 86400))
  )
    return fail("rate_limited", TEACHER_SENTENCES.rate, 86400);

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("teacher_applications")
    .insert({
      user_id: user.id,
      team_number: f.profile?.team_number ?? null,
      team_role: f.profile?.role ?? null,
      legal_name: v.legalName,
      topics: v.topics,
      topic_ids: v.topicIds,
      experience: v.experience,
      sample_plan: v.samplePlan,
      availability: v.availability,
      reference_name: v.referenceName,
      reference_email: v.referenceEmail,
      code_version: TEACHER_CODE_VERSION,
    })
    .select("id")
    .single();
  if (error || !row) {
    // The one-pending-per-user index catches a double submit that raced the check.
    if (error?.code === "23505") return fail("conflict", TEACHER_SENTENCES.pending);
    console.error(`${LOG}: insert application:`, error?.message);
    return fail("server", TEACHER_SENTENCES.save);
  }

  // The consent record for the code they just agreed to. Without it the
  // application isn't kept: agreeing is part of applying.
  const facts = await requestFacts();
  const { error: consentErr } = await admin.from("class_consents").insert({
    user_id: user.id,
    user_handle: username,
    user_birth_year: f.detail.birthYear,
    class_id: null,
    kind: "teacher_code",
    version: TEACHER_CODE_VERSION,
    ip_hash: facts.ipHash,
    user_agent: facts.userAgent,
  });
  if (consentErr) {
    console.error(`${LOG}: consent:`, consentErr.message);
    await admin.from("teacher_applications").delete().eq("id", row.id as string);
    return fail("server", TEACHER_SENTENCES.save);
  }

  const parentStep = parentStepFor(f.detail.state);
  if (user.email) {
    await mailTeacher(
      "teacher application receipt",
      teacherApplicationReceivedMail({ to: user.email, username, parentStep })
    );
  }
  const owner = ownerEmail();
  if (owner) {
    await mailTeacher(
      "teacher application notification",
      teacherApplicationNotifyMail({
        to: owner,
        username,
        ageBand: f.detail.ageBand,
        parentStep,
        sameNetwork: f.detail.consent?.same_network === true,
        teamNumber: f.profile?.team_number ?? null,
        teamRoleLabel: teamRoleLabel(f.profile?.role),
        topics: v.topics,
        topicTitles: v.topicIds.map((id) => titles.get(id)?.title).filter((t): t is string => !!t),
      })
    );
  }

  revalidateTeacherPages();
  return { ok: true };
}

export async function withdrawTeacherApplication(user: AppUser): Promise<Result> {
  const { data, error } = await createAdminClient()
    .from("teacher_applications")
    .update({ status: "withdrawn", reviewed_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("status", "pending")
    .select("id");
  if (error) return fail("server", "Couldn't withdraw it. Please try again.");
  if (!data || data.length === 0) return fail("not_found", TEACHER_SENTENCES.noPending);
  revalidateTeacherPages();
  return { ok: true };
}

/**
 * A teacher agrees to a new TEACHER_CODE_VERSION (the code changed after
 * they were accepted). Scheduling waits for it (teachingGate).
 */
export async function agreeToTeacherCode(user: AppUser, input: { code?: unknown }): Promise<Result> {
  if (!(await classesVisible())) return fail("forbidden", TEACHER_SENTENCES.hidden);
  if (textField(input.code) !== TEACHER_CODE_VERSION)
    return { ...fail("validation", TEACHER_SENTENCES.code), field: "code" };
  const teacher = await getTeacher(user.id);
  if (!teacher) return fail("forbidden", TEACHER_SENTENCES.notTeacher);
  if (teacher.code_version === TEACHER_CODE_VERSION) return { ok: true };

  const admin = createAdminClient();
  const [{ data: profile }, { data: ageRow }] = await Promise.all([
    admin.from("profiles").select("username").eq("id", user.id).maybeSingle(),
    admin.from("class_age_checks").select("birth_year").eq("user_id", user.id).maybeSingle(),
  ]);
  const handle = (profile?.username as string | null)?.trim();
  if (!handle) return { ...fail("validation", TEACHER_SENTENCES.noHandle), field: "username" };

  const facts = await requestFacts();
  const { error: consentErr } = await admin.from("class_consents").insert({
    user_id: user.id,
    user_handle: handle,
    user_birth_year: (ageRow?.birth_year as number | undefined) ?? null,
    class_id: null,
    kind: "teacher_code",
    version: TEACHER_CODE_VERSION,
    ip_hash: facts.ipHash,
    user_agent: facts.userAgent,
  });
  if (consentErr) {
    console.error(`${LOG}: code consent:`, consentErr.message);
    return fail("server", TEACHER_SENTENCES.save);
  }
  const { error } = await admin
    .from("class_teachers")
    .update({ code_version: TEACHER_CODE_VERSION, code_agreed_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) return fail("server", TEACHER_SENTENCES.save);
  revalidateTeacherPages();
  return { ok: true };
}

/* ── The desk (/admin/classes/teachers) ────────────────────────────── */

export const DESK_PENDING_PAGE = 60;
export const DESK_DECIDED_PAGE = 30;
export const DESK_TEACHERS_PAGE = 300;

export type DeskTeacherApplication = {
  id: string;
  userId: string;
  username: string | null;
  teamNumber: number | null;
  teamRoleLabel: string;
  ageBand: AgeBand | null;
  parentStep: ParentStep;
  /** The parent decided from the student's own network (section 5.1). */
  parentSameNetwork: boolean;
  /** "Name as your school knows it": copied to the letter name on accept. */
  legalName: string;
  topics: string;
  pickedTopics: { id: string; title: string; kind: "lesson" | "module" }[];
  experience: string;
  samplePlan: string;
  availability: string | null;
  referenceName: string | null;
  referenceEmail: string | null;
  codeVersion: string;
  codeCurrent: boolean;
  /** Their bio has contact details (they'll be asked to remove them to schedule). */
  bioHasContact: boolean;
  createdAt: string;
};

export type DeskTeacher = {
  userId: string;
  username: string | null;
  ageBand: AgeBand | null;
  letterName: string;
  /** The last super-admin change to the letter name, if any. */
  letterNameChange: { at: string; note: string | null } | null;
  lettersBlocked: boolean;
  grantedAt: string;
  codeCurrent: boolean;
  suspendedAt: string | null;
  suspendedReason: string | null;
  upcomingClasses: number;
  totalClasses: number;
  approvedClasses: number;
  approvedMinutes: number;
};

export type DeskTeacherDecision = {
  id: string;
  username: string | null;
  status: "accepted" | "rejected" | "withdrawn";
  statusWord: "accepted" | "turned down" | "withdrawn";
  reviewedAt: string | null;
  createdAt: string;
  reviewNote: string | null;
};

export type TeacherDesk = {
  role: ClassReviewerRole;
  /** Accept, reject and the letter name: super admins only. */
  canDecide: boolean;
  pending: DeskTeacherApplication[];
  pendingTruncated: boolean;
  teachers: DeskTeacher[];
  decided: DeskTeacherDecision[];
};

const isoOr = (v: string) => toIso(v) ?? v;

export async function loadTeacherDesk(user: AppUser): Promise<Result<TeacherDesk>> {
  const gate = await requireTeacherStaff(user);
  if (!gate.ok) return gate;
  const admin = createAdminClient();
  const now = new Date();

  const [{ data: pendingRows }, { data: teacherRows }, { data: decidedRows }] = await Promise.all([
    admin
      .from("teacher_applications")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(DESK_PENDING_PAGE),
    admin
      .from("class_teachers")
      .select("*")
      .order("granted_at", { ascending: false })
      .limit(DESK_TEACHERS_PAGE),
    admin
      .from("teacher_applications")
      .select("id, user_id, status, created_at, reviewed_at, review_note")
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false, nullsFirst: false })
      .limit(DESK_DECIDED_PAGE),
  ]);
  const pending = (pendingRows ?? []) as Record<string, unknown>[];
  const teachers = (teacherRows ?? []) as ClassTeacherRow[];
  const decided = (decidedRows ?? []) as Record<string, unknown>[];

  const userIds = [
    ...new Set([
      ...pending.map((r) => r.user_id as string),
      ...teachers.map((t) => t.user_id),
      ...decided.map((r) => r.user_id as string),
    ]),
  ];
  const teacherIds = teachers.map((t) => t.user_id);
  const applicantIds = [...new Set(pending.map((r) => r.user_id as string))];
  const ageIds = [...new Set([...applicantIds, ...teacherIds])];

  const [profiles, ages, consents, classRows, titles] = await Promise.all([
    userIds.length
      ? admin.from("profiles").select("id, username, bio").in("id", userIds).then((r) => r.data ?? [])
      : Promise.resolve([]),
    ageIds.length
      ? admin
          .from("class_age_checks")
          .select("user_id, birth_year, birth_month")
          .in("user_id", ageIds)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    applicantIds.length
      ? admin
          .from("class_parent_consents")
          .select("student_id, status, expires_at, same_network, sent_at")
          .in("student_id", applicantIds)
          .order("sent_at", { ascending: false })
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    teacherIds.length
      ? admin
          .from("classes")
          .select("teacher_id, status, starts_at, credited_minutes")
          .in("teacher_id", teacherIds)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    topicTitles(pending.flatMap((r) => (r.topic_ids as string[] | null) ?? [])),
  ]);

  const profileById = new Map(profiles.map((p) => [p.id as string, p]));
  const ageById = new Map(
    ages.map((a) => [a.user_id as string, { birth_year: a.birth_year as number, birth_month: a.birth_month as number }])
  );
  const consentsById = new Map<string, { status: string; expires_at: string; same_network: boolean }[]>();
  for (const c of consents) {
    const id = c.student_id as string;
    const list = consentsById.get(id) ?? [];
    list.push({ status: c.status as string, expires_at: c.expires_at as string, same_network: !!c.same_network });
    consentsById.set(id, list);
  }
  const classStats = new Map<string, { upcoming: number; total: number; approved: number; minutes: number }>();
  for (const c of classRows) {
    const id = c.teacher_id as string;
    const s = classStats.get(id) ?? { upcoming: 0, total: 0, approved: 0, minutes: 0 };
    const status = c.status as ClassStatus;
    if (status !== "canceled") s.total += 1;
    if ((status === "scheduled" || status === "live") && Date.parse(c.starts_at as string) > now.getTime() - 3 * 3600_000)
      s.upcoming += 1;
    if (status === "approved") {
      s.approved += 1;
      s.minutes += (c.credited_minutes as number | null) ?? 0;
    }
    classStats.set(id, s);
  }
  const username = (id: string) => ((profileById.get(id)?.username as string | null) ?? null) || null;

  return {
    ok: true,
    role: gate.role,
    canDecide: gate.role === "superadmin",
    pending: pending.map((r) => {
      const uid = r.user_id as string;
      const rows = consentsById.get(uid) ?? [];
      const codeVersion = r.code_version as string;
      return {
        id: r.id as string,
        userId: uid,
        username: username(uid),
        teamNumber: (r.team_number as number | null) ?? null,
        teamRoleLabel: teamRoleLabel(r.team_role as string | null),
        ageBand: ageBandFrom(ageById.get(uid), now),
        parentStep: parentStepFromRows(rows, now),
        parentSameNetwork: rows.some((c) => c.status === "agreed" && c.same_network),
        legalName: r.legal_name as string,
        topics: r.topics as string,
        pickedTopics: ((r.topic_ids as string[] | null) ?? [])
          .map((id) => ({ id, ...(titles.get(id) ?? { title: "", kind: "lesson" as const }) }))
          .filter((t) => t.title),
        experience: r.experience as string,
        samplePlan: r.sample_plan as string,
        availability: (r.availability as string | null) ?? null,
        referenceName: (r.reference_name as string | null) ?? null,
        referenceEmail: (r.reference_email as string | null) ?? null,
        codeVersion,
        codeCurrent: codeVersion === TEACHER_CODE_VERSION,
        bioHasContact: findContactPatterns((profileById.get(uid)?.bio as string | null) ?? "").length > 0,
        createdAt: isoOr(r.created_at as string),
      };
    }),
    pendingTruncated: pending.length === DESK_PENDING_PAGE,
    teachers: teachers.map((t) => {
      const s = classStats.get(t.user_id) ?? { upcoming: 0, total: 0, approved: 0, minutes: 0 };
      return {
        userId: t.user_id,
        username: username(t.user_id),
        ageBand: ageBandFrom(ageById.get(t.user_id), now),
        letterName: t.letter_name,
        letterNameChange: t.letter_name_changed_at
          ? { at: isoOr(t.letter_name_changed_at), note: t.letter_name_change_note }
          : null,
        lettersBlocked: t.letters_blocked,
        grantedAt: isoOr(t.granted_at),
        codeCurrent: t.code_version === TEACHER_CODE_VERSION,
        suspendedAt: toIso(t.suspended_at),
        suspendedReason: t.suspended_reason,
        upcomingClasses: s.upcoming,
        totalClasses: s.total,
        approvedClasses: s.approved,
        approvedMinutes: s.minutes,
      };
    }),
    decided: decided.map((r) => {
      const status = r.status as DeskTeacherDecision["status"];
      return {
        id: r.id as string,
        username: username(r.user_id as string),
        status,
        statusWord: status === "rejected" ? "turned down" : status,
        reviewedAt: toIso(r.reviewed_at as string | null),
        createdAt: isoOr(r.created_at as string),
        reviewNote: (r.review_note as string | null) ?? null,
      };
    }),
  };
}

/* ── Accept and reject (super admins) ──────────────────────────────── */

/** Owner and staff accounts never get letters (section 9.1). */
async function lettersBlockedForUser(userId: string, email: string | null): Promise<boolean> {
  const [{ count }, settings] = await Promise.all([
    createAdminClient().from("site_admins").select("user_id", { count: "exact", head: true }).eq("user_id", userId),
    getClassSettings(),
  ]);
  return lettersBlockedFor({
    ownerEmail: isOwnerEmail(email),
    siteAdmin: (count ?? 0) > 0,
    safetyLead: settings.safety_lead_user_id === userId,
    noLetterId: noLetterUserIds().has(userId),
  });
}

/**
 * Accepts or rejects a pending application. Accepting copies legal_name to
 * the locked class_teachers.letter_name, records the code version they
 * agreed to, and sets letters_blocked for owner and staff accounts. The
 * status change is the gate (`.eq("status", "pending")`), so two clicks can't
 * both win.
 */
export async function decideTeacherApplication(
  user: AppUser,
  input: { id: unknown; decision: unknown; note?: unknown }
): Promise<Result<{ status: "accepted" | "rejected" }>> {
  const gate = await requireSiteRole(user, "superadmin", NOT_SUPER_ADMIN);
  if (!gate.ok) return gate;

  const id = textField(input.id);
  const decision = textField(input.decision);
  const note = textField(input.note);
  if (id === null || decision === null || note === null) return fail("validation", BAD_REQUEST);
  if (decision !== "accept" && decision !== "reject") return fail("validation", "Pick accept or reject.");
  if (note.length > TEACHER_APPLY_LIMITS.reviewNoteMax)
    return { ...fail("validation", "Keep the note under 1000 characters."), field: "note" };
  if (!isUuid(id)) return fail("not_found", "That application no longer exists.");

  const admin = createAdminClient();
  const { data: app } = await admin
    .from("teacher_applications")
    .select("id, user_id, status, legal_name, code_version")
    .eq("id", id)
    .maybeSingle();
  if (!app) return fail("not_found", "That application no longer exists.");
  if (app.status !== "pending") return fail("conflict", "That one has already been decided.");
  const applicantId = app.user_id as string;
  const accepted = decision === "accept";

  let band: AgeBand | null = null;
  let parentStep: ParentStep | null = null;
  if (accepted) {
    const [{ data: ageRow }, { data: consentRows }, existing] = await Promise.all([
      admin.from("class_age_checks").select("birth_year, birth_month").eq("user_id", applicantId).maybeSingle(),
      admin
        .from("class_parent_consents")
        .select("status, expires_at")
        .eq("student_id", applicantId)
        .order("sent_at", { ascending: false })
        .limit(20),
      getTeacher(applicantId),
    ]);
    band = ageBandFrom(ageRow as { birth_year: number; birth_month: number } | null);
    if (band === "18+")
      return fail("conflict", "They've turned 18, so they can't teach. Reject it with a note instead.");
    if (band !== "13-15" && band !== "16-17")
      return fail("conflict", "They haven't answered the age question, so they can't be accepted.");
    if (existing) return fail("conflict", "They're already a teacher. Reject this one with a note.");
    parentStep = parentStepFromRows((consentRows ?? []) as { status: string; expires_at: string }[]);
  }

  const now = new Date().toISOString();
  const { data: won, error: updErr } = await admin
    .from("teacher_applications")
    .update({
      status: accepted ? "accepted" : "rejected",
      reviewed_at: now,
      reviewed_by: user.id,
      review_note: note || null,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (updErr) return fail("server", "Couldn't record the decision. Please try again.");
  if (!won || won.length === 0) return fail("conflict", "That one has already been decided.");

  const to = await emailFor(applicantId);
  const letterName = normalizeName(app.legal_name as string);
  if (accepted) {
    const { error: insErr } = await admin.from("class_teachers").insert({
      user_id: applicantId,
      application_id: id,
      granted_by: user.id,
      granted_at: now,
      letter_name: letterName,
      letters_blocked: await lettersBlockedForUser(applicantId, to),
      code_version: app.code_version as string,
      code_agreed_at: now,
    });
    if (insErr) {
      // Put it back on the desk: an application that reads "accepted" with no
      // teacher row would refuse every retry as already decided.
      await admin
        .from("teacher_applications")
        .update({ status: "pending", reviewed_at: null, reviewed_by: null, review_note: null })
        .eq("id", id);
      console.error(`${LOG}: grant:`, insErr.message);
      return fail("server", "Couldn't make them a teacher, so nothing was decided. Try again.");
    }
  }

  await logTeacherEvent(user.id, accepted ? "teacher_accepted" : "teacher_rejected", {
    teacherId: applicantId,
    applicationId: id,
  });

  if (to) {
    const { data: prof } = await admin.from("profiles").select("username").eq("id", applicantId).maybeSingle();
    const username = (prof?.username as string | null) ?? null;
    await mailTeacher(
      accepted ? "teacher accepted" : "teacher rejected",
      accepted
        ? teacherAcceptedMail({
            to,
            username,
            letterName,
            note: note || null,
            needsParent: parentStep !== "agreed",
            codeOutdated: (app.code_version as string) !== TEACHER_CODE_VERSION,
          })
        : teacherRejectedMail({ to, username, note: note || null })
    );
  }

  revalidateTeacherPages();
  return { ok: true, status: accepted ? "accepted" : "rejected" };
}

/* ── Suspend and unsuspend (super admins, the safety lead, the system) ─ */

/** What students are told when a suspension cancels their class. Never the reason. */
const SUSPENDED_CLASS_REASON = "The teacher can't teach this class anymore.";

/**
 * Suspends a teacher: sets suspended_at and the reason, then cancels their
 * upcoming classes (cancelTeacherClasses, which emails enrolled students
 * with a neutral line, never the reason). A super admin, the safety lead, or
 * the system (auto-end on two reports). Suspending someone already suspended
 * keeps the first time and reason, and still cancels anything upcoming.
 *
 * No email to the teacher: the playbook acts before anyone is confronted
 * (section 8.4). Their teaching page shows that teaching is paused.
 */
export async function suspendTeacher(
  actor: AppUser | SystemActor,
  input: { userId: string; reason: string }
): Promise<Result> {
  const system = "system" in actor && actor.system === true;
  if (!system) {
    const gate = await requireTeacherStaff(actor as AppUser);
    if (!gate.ok) return gate;
  }
  const userId = textField(input.userId);
  const given = textField(input.reason);
  if (userId === null || given === null) return fail("validation", BAD_REQUEST);
  if (!isUuid(userId)) return fail("not_found", TEACHER_SENTENCES.noLongerTeacher);
  const reason = given || (system ? (actor as SystemActor).reason?.trim() || "suspended automatically" : "");
  if (!reason) return { ...fail("validation", "Say why, in a few words. Only staff see it."), field: "reason" };
  if (reason.length > TEACHER_APPLY_LIMITS.suspendReasonMax)
    return { ...fail("validation", "Keep the reason under 500 characters."), field: "reason" };

  const admin = createAdminClient();
  const { data: changed, error } = await admin
    .from("class_teachers")
    .update({ suspended_at: new Date().toISOString(), suspended_reason: reason })
    .eq("user_id", userId)
    .is("suspended_at", null)
    .select("user_id");
  if (error) return fail("server", "Couldn't suspend them. Please try again.");
  if (!changed || changed.length === 0) {
    const existing = await getTeacher(userId);
    if (!existing) return fail("not_found", TEACHER_SENTENCES.noLongerTeacher);
  }

  if (!system) {
    await logTeacherEvent((actor as AppUser).id, "teacher_suspended", { teacherId: userId, reason });
  }
  // The pages package's function: cancels and emails, never throws.
  await cancelTeacherClasses(userId, SUSPENDED_CLASS_REASON);
  revalidateTeacherPages();
  return { ok: true };
}

/** Turns teaching back on. A super admin or the safety lead. */
export async function unsuspendTeacher(user: AppUser, input: { userId: unknown }): Promise<Result> {
  const gate = await requireTeacherStaff(user);
  if (!gate.ok) return gate;
  const userId = textField(input.userId);
  if (userId === null || !userId) return fail("validation", BAD_REQUEST);
  if (!isUuid(userId)) return fail("not_found", TEACHER_SENTENCES.noLongerTeacher);

  const admin = createAdminClient();
  const { data: changed, error } = await admin
    .from("class_teachers")
    .update({ suspended_at: null, suspended_reason: null })
    .eq("user_id", userId)
    .not("suspended_at", "is", null)
    .select("user_id");
  if (error) return fail("server", "Couldn't turn their teaching back on. Please try again.");
  if (!changed || changed.length === 0) {
    const existing = await getTeacher(userId);
    if (!existing) return fail("not_found", TEACHER_SENTENCES.noLongerTeacher);
    return { ok: true };
  }

  await logTeacherEvent(user.id, "teacher_unsuspended", { teacherId: userId });
  const to = await emailFor(userId);
  if (to) {
    const { data: prof } = await admin.from("profiles").select("username").eq("id", userId).maybeSingle();
    await mailTeacher(
      "teacher unsuspended",
      teacherUnsuspendedMail({ to, username: (prof?.username as string | null) ?? null })
    );
  }
  revalidateTeacherPages();
  return { ok: true };
}

/* ── The letter name (super admins, with a note) ───────────────────── */

/**
 * Changes the locked name on a teacher's hours letters. Super admins only,
 * with a note saying why (kept on the row). The teacher can't do this from
 * any page: there's no other function that writes letter_name.
 */
export async function changeLetterName(
  user: AppUser,
  input: { userId: unknown; letterName: unknown; note: unknown }
): Promise<Result> {
  const gate = await requireSiteRole(user, "superadmin", NOT_SUPER_ADMIN);
  if (!gate.ok) return gate;
  const userId = textField(input.userId);
  const raw = textField(input.letterName);
  const note = textField(input.note);
  if (userId === null || raw === null || note === null) return fail("validation", BAD_REQUEST);
  if (!isUuid(userId)) return fail("not_found", TEACHER_SENTENCES.noLongerTeacher);

  const letterName = normalizeName(raw);
  const problem = letterNameProblem(letterName);
  if (problem) return { ...fail("validation", problem), field: "letterName" };
  if (firstProfaneField({ letterName }))
    return { ...fail("validation", TEACHER_SENTENCES.profaneName), field: "letterName" };
  if (note.length < TEACHER_APPLY_LIMITS.letterNoteMin)
    return { ...fail("validation", "Say why the name changed. The note stays on their record."), field: "note" };
  if (note.length > TEACHER_APPLY_LIMITS.letterNoteMax)
    return { ...fail("validation", "Keep the note under 1000 characters."), field: "note" };

  const existing = await getTeacher(userId);
  if (!existing) return fail("not_found", TEACHER_SENTENCES.noLongerTeacher);
  if (existing.letter_name === letterName)
    return { ...fail("validation", "That's already the name on their letters."), field: "letterName" };

  const { error } = await createAdminClient()
    .from("class_teachers")
    .update({
      letter_name: letterName,
      letter_name_changed_by: user.id,
      letter_name_changed_at: new Date().toISOString(),
      letter_name_change_note: note,
    })
    .eq("user_id", userId);
  if (error) return fail("server", "Couldn't change the name. Please try again.");

  await logTeacherEvent(user.id, "letter_name_changed", { teacherId: userId, from: existing.letter_name, to: letterName });
  const to = await emailFor(userId);
  if (to) {
    const { data: prof } = await createAdminClient()
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle();
    await mailTeacher(
      "letter name changed",
      letterNameChangedMail({ to, username: (prof?.username as string | null) ?? null, letterName })
    );
  }
  revalidateTeacherPages();
  return { ok: true };
}
