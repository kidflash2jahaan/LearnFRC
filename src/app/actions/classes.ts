"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { enrollInClass, leaveClass } from "@/lib/app/classes";
import { cancelClass, scheduleClass } from "@/lib/app/classes-teaching";
import { confirmEnrollment } from "@/lib/classes/emails-enroll";

/**
 * The website's door onto live classes: enrolling, leaving, scheduling and
 * cancelling (classes-design.md section 11).
 *
 * Every rule lives in src/lib/app/classes.ts (eligibility, blocks, the bio
 * rule, the seat-safe enroll) and src/lib/app/classes-teaching.ts (the
 * scheduling rules, cancelling), shared with the app's routes and the other
 * classes packages, so the doors can't drift. A "use server" function is a
 * public endpoint: each one reads the verified session itself and each
 * shared function checks the caller again.
 */

export type ClassFormState =
  | {
      error?: string;
      /** The control the error is about, when it's about one. */
      field?: string;
      message?: string;
      ok?: boolean;
      classId?: string;
    }
  | undefined;

function text(formData: FormData, name: string): string {
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

/* ── Students ──────────────────────────────────────────────────────── */

export async function enrollAction(_prev: ClassFormState, formData: FormData): Promise<ClassFormState> {
  const user = await sessionUser();
  if (!user) return { error: "Sign in to join a class." };
  const classId = text(formData, "classId");
  const r = await enrollInClass(user, { classId });
  if (!r.ok) return { error: r.error, field: r.field };
  if (r.status === "enrolled") await confirmEnrollment(user, classId);
  refresh();
  return { ok: true, message: "You're in." };
}

export async function leaveAction(_prev: ClassFormState, formData: FormData): Promise<ClassFormState> {
  const user = await sessionUser();
  if (!user) return { error: "Sign in first." };
  const r = await leaveClass(user, { classId: text(formData, "classId") });
  if (!r.ok) return { error: r.error };
  refresh();
  return { ok: true, message: "You left the class. Your seat is open for someone else." };
}

/* ── Teachers ──────────────────────────────────────────────────────── */

export async function scheduleAction(_prev: ClassFormState, formData: FormData): Promise<ClassFormState> {
  const user = await sessionUser();
  if (!user) return { error: "Sign in first." };
  const r = await scheduleClass(user, {
    title: text(formData, "title"),
    description: text(formData, "description") || null,
    topic: text(formData, "topic"),
    startsAt: text(formData, "startsAt"),
    durationMinutes: Number(text(formData, "durationMinutes")),
    capacity: text(formData, "capacity") ? Number(text(formData, "capacity")) : undefined,
  });
  if (!r.ok) return { error: r.error, field: r.field };
  refresh();
  return { ok: true, classId: r.classId, message: "Scheduled. It's listed on the classes page now." };
}

export async function cancelClassAction(_prev: ClassFormState, formData: FormData): Promise<ClassFormState> {
  const user = await sessionUser();
  if (!user) return { error: "Sign in first." };
  const r = await cancelClass(user, { classId: text(formData, "classId"), reason: "" });
  if (!r.ok) return { error: r.error };
  refresh();
  return { ok: true, message: "Canceled. Everyone who signed up gets an email." };
}
