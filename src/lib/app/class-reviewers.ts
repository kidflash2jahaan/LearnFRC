import "server-only";
import { stubCalled } from "@/lib/classes/stub";
import { fail, type AppUser, type Failure } from "@/lib/app/result";

/**
 * Who may review classes (section 7.6): a super admin, or the account set as
 * class_settings.safety_lead_user_id (Dhiren), who gets the class pages and
 * nothing else in /admin. Restricted reviews (grooming, sexual content,
 * sextortion, a refusal) are the safety lead's alone until he releases them.
 *
 * Owned by the safety-holds package, which replaces these stub bodies and
 * keeps the signatures. Until then the stubs deny: an access check that isn't
 * built must never let anyone in.
 */

export type ClassReviewerRole = "superadmin" | "safety_lead";

export const NOT_CLASS_REVIEWER =
  "Class reviews are open to LearnFRC's super admins and the safety lead only.";

export async function requireClassReviewer(
  user: AppUser
): Promise<{ ok: true; role: ClassReviewerRole } | Failure> {
  stubCalled("requireClassReviewer", { userId: user.id });
  return fail("forbidden", NOT_CLASS_REVIEWER);
}

/** True only for the safety lead (and only until a hold is released, per review). */
export async function canSeeRestricted(user: AppUser): Promise<boolean> {
  stubCalled("canSeeRestricted", { userId: user.id });
  return false;
}
