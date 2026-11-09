/**
 * Teacher applications and the teacher record: the limits and the pure rules
 * (classes-design.md sections 3.1, 9.1 and 11).
 *
 * No `@/` imports and no `server-only`, so /apply/teach's form can show the
 * same limits the server enforces, and `node --test` runs the checks
 * (teacher-rules.test.ts). The server side is src/lib/app/class-teachers.ts.
 */

import type { Eligibility } from "./types.ts";

export const TEACHER_APPLY_LIMITS = {
  /** teacher_applications.legal_name and class_teachers.letter_name checks. */
  legalNameMin: 2,
  legalNameMax: 80,
  /** "Which topics you'd teach", in their words. */
  topicsMin: 3,
  topicsMax: 300,
  /** Picked lessons or modules (teacher_applications.topic_ids). */
  maxTopicIds: 5,
  /** Experience and the sample plan, like /apply's long answers. */
  longMin: 40,
  longMax: 3000,
  availabilityMax: 200,
  referenceNameMax: 80,
  referenceEmailMax: 254,
  /** teacher_applications.review_note check. */
  reviewNoteMax: 1000,
  suspendReasonMax: 500,
  /** A super admin's note when changing a letter name. */
  letterNoteMin: 3,
  letterNoteMax: 1000,
} as const;

const L = TEACHER_APPLY_LIMITS;

/** What a valid application holds, trimmed and ready to insert. */
export type TeacherApplicationInput = {
  legalName: string;
  topics: string;
  topicIds: string[];
  experience: string;
  samplePlan: string;
  availability: string | null;
  referenceName: string | null;
  referenceEmail: string | null;
};

export type FieldCheck<T> = { ok: true; value: T } | { ok: false; field: string; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Trims and collapses inner whitespace, so "  Maya   Chen " is "Maya Chen". */
export function normalizeName(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * The name that goes on hours letters, as the school knows the person.
 * Letters, spaces, hyphens, apostrophes and periods: no digits, no @, no
 * links, since it's printed under "This letter confirms that".
 */
export function letterNameProblem(raw: string): string | null {
  const name = normalizeName(raw);
  const sentence = `Write the name your school knows you by, ${L.legalNameMin} to ${L.legalNameMax} characters.`;
  if (name.length < L.legalNameMin || name.length > L.legalNameMax) return sentence;
  if (!/\p{L}/u.test(name)) return sentence;
  if (/[0-9@<>{}[\]\\/|_=+*#$%^&~`]/.test(name) || /https?:|www\./i.test(name))
    return "Use only letters, spaces, hyphens, apostrophes and periods in your name.";
  return null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Checks an application's fields. `raw` is whatever the form or a request
 * sent; anything that isn't a string counts as empty. Returns the first
 * problem with the field it's about, so the form can mark it.
 */
export function checkTeacherApplication(raw: {
  legalName?: unknown;
  topics?: unknown;
  topicIds?: unknown;
  experience?: unknown;
  samplePlan?: unknown;
  availability?: unknown;
  referenceName?: unknown;
  referenceEmail?: unknown;
}): FieldCheck<TeacherApplicationInput> {
  const legalName = normalizeName(str(raw.legalName));
  const nameProblem = letterNameProblem(legalName);
  if (nameProblem) return { ok: false, field: "legalName", error: nameProblem };

  const topics = str(raw.topics);
  if (topics.length < L.topicsMin)
    return { ok: false, field: "topics", error: "Say which topics you'd teach." };
  if (topics.length > L.topicsMax)
    return { ok: false, field: "topics", error: `Keep the topics under ${L.topicsMax} characters.` };

  const ids = Array.isArray(raw.topicIds) ? raw.topicIds : raw.topicIds == null ? [] : [raw.topicIds];
  const topicIds = [...new Set(ids.map((x) => str(x)).filter(Boolean))];
  if (topicIds.some((id) => !UUID.test(id)))
    return { ok: false, field: "topicIds", error: "One of the picked topics isn't on LearnFRC." };
  if (topicIds.length > L.maxTopicIds)
    return { ok: false, field: "topicIds", error: `Pick up to ${L.maxTopicIds} topics.` };

  const experience = str(raw.experience);
  if (experience.length < L.longMin)
    return { ok: false, field: "experience", error: "Say a bit more about your FRC experience (a few sentences)." };
  if (experience.length > L.longMax)
    return { ok: false, field: "experience", error: `Keep your experience under ${L.longMax} characters.` };

  const samplePlan = str(raw.samplePlan);
  if (samplePlan.length < L.longMin)
    return { ok: false, field: "samplePlan", error: "Say a bit more about how you'd teach one lesson (a few sentences)." };
  if (samplePlan.length > L.longMax)
    return { ok: false, field: "samplePlan", error: `Keep the plan under ${L.longMax} characters.` };

  const availability = str(raw.availability);
  if (availability.length > L.availabilityMax)
    return { ok: false, field: "availability", error: "Keep availability to a line." };

  const referenceName = normalizeName(str(raw.referenceName));
  if (referenceName.length > L.referenceNameMax)
    return { ok: false, field: "referenceName", error: `Keep the name under ${L.referenceNameMax} characters.` };

  const referenceEmail = str(raw.referenceEmail).toLowerCase();
  if (referenceEmail && (referenceEmail.length > L.referenceEmailMax || !EMAIL.test(referenceEmail)))
    return { ok: false, field: "referenceEmail", error: "That email address doesn't look right." };

  return {
    ok: true,
    value: {
      legalName,
      topics,
      topicIds,
      experience,
      samplePlan,
      availability: availability || null,
      referenceName: referenceName || null,
      referenceEmail: referenceEmail || null,
    },
  };
}

/**
 * Owner and staff accounts never get an hours letter (section 9.1): an owner
 * email, any site_admins row, the safety lead, or an id in
 * CLASSES_NO_LETTER_USER_IDS. Accepting such an account as a teacher sets
 * class_teachers.letters_blocked.
 */
export function lettersBlockedFor(facts: {
  ownerEmail: boolean;
  siteAdmin: boolean;
  safetyLead: boolean;
  noLetterId: boolean;
}): boolean {
  return facts.ownerEmail || facts.siteAdmin || facts.safetyLead || facts.noLetterId;
}

/* ── Where someone stands on /apply/teach ──────────────────────────── */

/**
 * The state /apply/teach renders and the app's GET /api/app/apply reports as
 * the teacher role's `status`. Add values, never rename them: installed app
 * copies read this string.
 */
export type TeachApplyMode =
  | "hidden"
  | "signed-out"
  | "no-handle"
  | "device-blocked"
  | "needs-age"
  | "adult"
  | "parent-declined"
  | "suspended"
  | "code-outdated"
  | "teacher"
  | "pending"
  | "again"
  | "new";

export type TeacherApplicationStatus = "pending" | "accepted" | "rejected" | "withdrawn";

/**
 * The mode, from the facts. Eligibility first (section 4): someone hidden,
 * signed out, without a handle or an age answer, on a blocked device or 18+
 * can't apply or teach. Then an existing teacher row (suspended, an old code
 * version, or teaching). Then a parent who said no. Then the application.
 *
 * Applying is open in needs_parent, waiting_parent and ready: the parent OK
 * can come after the application, but scheduling waits for it.
 */
export function teachApplyMode(input: {
  eligibility: Eligibility;
  teacher: { suspended: boolean; codeCurrent: boolean } | null;
  latest: TeacherApplicationStatus | null;
}): TeachApplyMode {
  switch (input.eligibility) {
    case "hidden":
      return "hidden";
    case "signed_out":
      return "signed-out";
    case "needs_handle":
      return "no-handle";
    case "device_blocked":
      return "device-blocked";
    case "needs_age":
      return "needs-age";
    case "adult":
      return "adult";
  }
  if (input.teacher) {
    if (input.teacher.suspended) return "suspended";
    if (!input.teacher.codeCurrent) return "code-outdated";
    return "teacher";
  }
  if (input.eligibility === "parent_declined") return "parent-declined";
  if (input.latest === "pending") return "pending";
  if (input.latest === "rejected" || input.latest === "withdrawn") return "again";
  return "new";
}

/** The modes that show the application form. */
export function canApplyIn(mode: TeachApplyMode): boolean {
  return mode === "new" || mode === "again";
}

/** The parent step, as the desk and the apply page word it. */
export type ParentStep = "agreed" | "waiting" | "not_asked" | "declined";

export function parentStepFor(eligibility: Eligibility): ParentStep | null {
  switch (eligibility) {
    case "ready":
      return "agreed";
    case "waiting_parent":
      return "waiting";
    case "needs_parent":
      return "not_asked";
    case "parent_declined":
      return "declined";
    default:
      return null;
  }
}

/** The latest parent OK row's status, as a step (for the desk, which reads rows). */
export function parentStepFromRows(
  rows: { status: string; expires_at: string }[],
  now: Date = new Date()
): ParentStep {
  if (rows.some((r) => r.status === "agreed")) return "agreed";
  const latest = rows[0];
  if (!latest) return "not_asked";
  if (latest.status === "sent" && Date.parse(latest.expires_at) > now.getTime()) return "waiting";
  if (latest.status === "declined" || latest.status === "revoked") return "declined";
  return "not_asked";
}

export const PARENT_STEP_WORDS: Record<ParentStep, string> = {
  agreed: "parent OK given",
  waiting: "parent OK requested, not answered",
  not_asked: "parent OK not asked yet",
  declined: "parent said no",
};
