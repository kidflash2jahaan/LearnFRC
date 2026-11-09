import "server-only";
import { stubCalled } from "@/lib/classes/stub";
import type { ClassTeacherRow, SystemActor } from "@/lib/classes/types";
import type { AppUser, Result } from "@/lib/app/result";

/**
 * Teachers (section 3.1): applications, accept and reject, the locked letter
 * name, suspend and unsuspend. Owned by the teachers package, which adds the
 * application functions here and replaces these stub bodies, keeping the
 * signatures (the room's auto-end calls suspendTeacher; pages, the room and
 * letters call getTeacher).
 */

/**
 * Suspends a teacher: sets suspended_at and the reason, then cancels their
 * upcoming classes (cancelTeacherClasses, which emails enrolled students).
 * A super admin, the safety lead, or the system (auto-end on two reports).
 */
export async function suspendTeacher(
  actor: AppUser | SystemActor,
  input: { userId: string; reason: string }
): Promise<Result> {
  stubCalled("suspendTeacher", { userId: input.userId, system: "system" in actor });
  return { ok: true };
}

/** The class_teachers row for an account, or null when they aren't a teacher. */
export async function getTeacher(userId: string): Promise<ClassTeacherRow | null> {
  stubCalled("getTeacher", { userId });
  return null;
}
