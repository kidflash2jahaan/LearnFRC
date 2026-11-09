// Test double for src/lib/app/class-reviewers.ts, used only by
// room-and-chat.check.ts while that file is still the Foundation's stub
// (which denies everyone until the safety-holds package replaces it).
//
// It implements the rule the stub documents: a super admin, or the account
// set as class_settings.safety_lead_user_id. The room's staff paths (joining
// as staff, removing, ending, pausing, the desk's class Remove) are tested
// against this; integration runs them against the real file.

import { getSiteRole } from "../../../../src/lib/auth.ts";
import { getClassSettings } from "../../../../src/lib/classes/config.ts";
import { fail, type AppUser, type Failure } from "../../../../src/lib/app/result.ts";

export type ClassReviewerRole = "superadmin" | "safety_lead";

export const NOT_CLASS_REVIEWER =
  "Class reviews are open to LearnFRC's super admins and the safety lead only.";

export async function requireClassReviewer(
  user: AppUser
): Promise<{ ok: true; role: ClassReviewerRole } | Failure> {
  if ((await getSiteRole(user.id, user.email ?? null)) === "superadmin") return { ok: true, role: "superadmin" };
  const s = await getClassSettings();
  if (s.safety_lead_user_id && s.safety_lead_user_id === user.id) return { ok: true, role: "safety_lead" };
  return fail("forbidden", NOT_CLASS_REVIEWER);
}

export async function canSeeRestricted(user: AppUser): Promise<boolean> {
  const s = await getClassSettings();
  return !!s.safety_lead_user_id && s.safety_lead_user_id === user.id;
}
