import "server-only";
import { stubCalled } from "@/lib/classes/stub";
import type { HoldReason } from "@/lib/classes/types";
import type { Result } from "@/lib/app/result";

/**
 * Evidence holds (section 8.2). Owned by the safety-holds package, which adds
 * releaseHold and extendHold here and replaces these stub bodies, keeping the
 * signatures (reports, the review, the room's auto-end, the report desk's ban
 * and account deletion call them).
 */

export type HoldInput = {
  reason: HoldReason;
  /** The person the hold is about, when there is one. */
  subjectUserId?: string | null;
  /** Who took it; null for the system. */
  createdBy?: string | null;
  notes?: string | null;
};

/**
 * Holds a class: one class_safety_holds row per subject, with the email and
 * handle (read before anything is deleted), peer reports, the transcript and
 * the chat (blocked messages included), and starts the recording copy to R2.
 * Also sets classes.keep_evidence. Never throws.
 */
export async function holdClass(
  classId: string,
  input: HoldInput
): Promise<Result<{ holdIds: string[] }>> {
  stubCalled("holdClass", { classId, reason: input.reason });
  return { ok: true, holdIds: [] };
}

/**
 * Holds an account before it's deleted (a ban, or a self-delete with an open
 * case): the account plus every class it was in during the last 90 days.
 * Never throws.
 */
export async function holdAccount(
  userId: string,
  input: Omit<HoldInput, "subjectUserId">
): Promise<Result<{ holdIds: string[] }>> {
  stubCalled("holdAccount", { userId, reason: input.reason });
  return { ok: true, holdIds: [] };
}
