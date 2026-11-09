import "server-only";
import { stubCalled } from "@/lib/classes/stub";
import type { ClassEndReason, SystemActor } from "@/lib/classes/types";
import type { AppUser, Result } from "@/lib/app/result";

/**
 * The room's server rules (sections 6.4 and 6.6): joining, removing, ending
 * and pausing. Owned by the room-and-chat package, which adds joinClass here
 * and replaces these stub bodies, keeping the signatures (other packages call
 * them: the sweep and auto-end call endClass, the report desk calls
 * removeFromClass, /admin/classes calls setJoinsPaused).
 */

/**
 * Ends a class for everyone: kick-all, the meeting INACTIVE, status `ended`.
 * Allowed for the teacher, staff, the system (sweep, auto-end), or any
 * participant once now >= hard_end_at. Idempotent.
 */
export async function endClass(
  actor: AppUser | SystemActor,
  input: { classId: string; reason: ClassEndReason }
): Promise<Result> {
  stubCalled("endClass", { classId: input.classId, reason: input.reason, system: "system" in actor });
  return { ok: true };
}

/**
 * Removes someone from a class for good: deletes their RealtimeKit
 * participant, sets the enrollment to `removed`, revokes their
 * class_participants row (which also ends their chat access), logs it and
 * emails the owner. The class's teacher or staff only; the teacher can't be
 * removed this way.
 */
export async function removeFromClass(
  user: AppUser,
  input: { classId: string; userId: string; reason?: string | null }
): Promise<Result> {
  stubCalled("removeFromClass", { classId: input.classId });
  return { ok: true };
}

/**
 * Pauses or unpauses every join (class_settings.joins_paused). Pausing also
 * ends every live class (end_reason `paused`): the emergency stop. Super admin
 * or the safety lead.
 */
export async function setJoinsPaused(
  user: AppUser,
  input: { paused: boolean; reason?: string | null }
): Promise<Result> {
  stubCalled("setJoinsPaused", { paused: input.paused });
  return { ok: true };
}
