"use server";

import { createClient } from "@/lib/supabase/server";
import { NOT_SUPER_ADMIN } from "@/lib/app/admin-access";
import {
  TEACHER_SENTENCES,
  agreeToTeacherCode,
  changeLetterName,
  decideTeacherApplication,
  submitTeacherApplication,
  suspendTeacher,
  unsuspendTeacher,
  withdrawTeacherApplication,
} from "@/lib/app/class-teachers";

/**
 * The website's door onto teachers: applying on /apply/teach, agreeing to a
 * new teacher code, and the desk on /admin/classes/teachers. Every rule lives
 * in src/lib/app/class-teachers.ts, which re-checks the caller itself: a
 * "use server" function is a public endpoint, and a hidden button isn't
 * authorization.
 */

export type TeachFormState =
  | {
      error?: string;
      /** The field the error is about, so the form can mark it. */
      field?: string;
      success?: boolean;
    }
  | undefined;

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

/** The cookie session's verified user, or null. */
async function sessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

const done = (r: { ok: true } | { ok: false; error: string; field?: string }): TeachFormState =>
  r.ok ? { success: true } : { error: r.error, ...(r.field ? { field: r.field } : {}) };

/* ── Applying ─────────────────────────────────────────────────────── */

export async function applyToTeach(_prev: TeachFormState, formData: FormData): Promise<TeachFormState> {
  const user = await sessionUser();
  if (!user) return { error: TEACHER_SENTENCES.signIn };
  return done(
    await submitTeacherApplication(user, {
      legalName: field(formData, "legalName"),
      topics: field(formData, "topics"),
      topicIds: formData.getAll("topicIds").map((v) => String(v)),
      experience: field(formData, "experience"),
      samplePlan: field(formData, "samplePlan"),
      availability: field(formData, "availability"),
      referenceName: field(formData, "referenceName"),
      referenceEmail: field(formData, "referenceEmail"),
      code: field(formData, "code"),
    })
  );
}

/** Used with useActionState, which passes (state, formData); neither is needed. */
export async function withdrawTeachApplication(): Promise<TeachFormState> {
  const user = await sessionUser();
  if (!user) return { error: "Sign in first." };
  return done(await withdrawTeacherApplication(user));
}

export async function agreeTeacherCode(_prev: TeachFormState, formData: FormData): Promise<TeachFormState> {
  const user = await sessionUser();
  if (!user) return { error: "Sign in first." };
  return done(await agreeToTeacherCode(user, { code: field(formData, "code") }));
}

/* ── The desk ─────────────────────────────────────────────────────── */

export async function decideTeacherApplicationAction(
  _prev: TeachFormState,
  formData: FormData
): Promise<TeachFormState> {
  const user = await sessionUser();
  if (!user) return { error: NOT_SUPER_ADMIN };
  return done(
    await decideTeacherApplication(user, {
      id: field(formData, "id"),
      decision: field(formData, "decision"),
      note: field(formData, "note"),
    })
  );
}

export async function suspendTeacherAction(_prev: TeachFormState, formData: FormData): Promise<TeachFormState> {
  const user = await sessionUser();
  if (!user) return { error: TEACHER_SENTENCES.notStaff };
  return done(
    await suspendTeacher(user, { userId: field(formData, "userId"), reason: field(formData, "reason") })
  );
}

export async function unsuspendTeacherAction(_prev: TeachFormState, formData: FormData): Promise<TeachFormState> {
  const user = await sessionUser();
  if (!user) return { error: TEACHER_SENTENCES.notStaff };
  return done(await unsuspendTeacher(user, { userId: field(formData, "userId") }));
}

export async function changeLetterNameAction(_prev: TeachFormState, formData: FormData): Promise<TeachFormState> {
  const user = await sessionUser();
  if (!user) return { error: NOT_SUPER_ADMIN };
  return done(
    await changeLetterName(user, {
      userId: field(formData, "userId"),
      letterName: field(formData, "letterName"),
      note: field(formData, "note"),
    })
  );
}
