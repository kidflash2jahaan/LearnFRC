import "server-only";
import { stubCalled } from "@/lib/classes/stub";
import { fail, type AppUser, type Result } from "@/lib/app/result";
import type { SystemActor } from "@/lib/classes/types";

/**
 * Scheduling and cancelling classes (section 11, /classes/teaching). Owned by
 * the pages package, which replaces these stub bodies and keeps the
 * signatures (suspendTeacher and account deletion call
 * cancelTeacherClasses).
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

/**
 * Schedules a class: every refusal (timing, overlap, the per-teacher and
 * site-wide caps, profanity and contact details in the title, description or
 * bio) runs before the RealtimeKit meeting is created in this deployment's
 * app, and the class records that app (classes.rtk_app).
 */
export async function scheduleClass(
  user: AppUser,
  input: ScheduleClassInput
): Promise<Result<{ classId: string }>> {
  stubCalled("scheduleClass", { title: input.title });
  return fail("server", "Scheduling isn't built yet.");
}

/** Cancels one class and emails its enrolled students. The teacher or staff. */
export async function cancelClass(
  actor: AppUser | SystemActor,
  input: { classId: string; reason: string }
): Promise<Result> {
  stubCalled("cancelClass", { classId: input.classId });
  return { ok: true };
}

/**
 * Cancels every upcoming class a teacher has (suspension, account deletion),
 * emailing enrolled students. Never throws.
 */
export async function cancelTeacherClasses(
  teacherId: string,
  reason: string
): Promise<{ canceled: number }> {
  stubCalled("cancelTeacherClasses", { teacherId, reason });
  return { canceled: 0 };
}
