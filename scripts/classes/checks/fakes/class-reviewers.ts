// Test stand-in for src/lib/app/class-reviewers.ts (the safety-holds
// package), loaded only by letters.check.ts in place of the Foundation's
// stub, which denies everyone until integration. Same signatures, and the
// design's rule (section 7.6): a super admin, or the account set as
// class_settings.safety_lead_user_id. Every call is recorded.

import { getSiteRole } from "@/lib/auth";
import { getClassSettings } from "@/lib/classes/config";
import { fail, type AppUser, type Failure } from "@/lib/app/result";

export type ClassReviewerRole = "superadmin" | "safety_lead";

export const NOT_CLASS_REVIEWER =
  "Class reviews are open to LearnFRC's super admins and the safety lead only.";

type Calls = { name: string; arg: unknown }[];
const g = globalThis as unknown as { __lettersFakeCalls?: Calls };
const calls: Calls = (g.__lettersFakeCalls ??= []);

export async function requireClassReviewer(
  user: AppUser
): Promise<{ ok: true; role: ClassReviewerRole } | Failure> {
  calls.push({ name: "requireClassReviewer", arg: user.id });
  const settings = await getClassSettings();
  if (settings.safety_lead_user_id === user.id) return { ok: true, role: "safety_lead" };
  if ((await getSiteRole(user.id, user.email)) === "superadmin") return { ok: true, role: "superadmin" };
  return fail("forbidden", NOT_CLASS_REVIEWER);
}

export async function canSeeRestricted(user: AppUser): Promise<boolean> {
  calls.push({ name: "canSeeRestricted", arg: user.id });
  return (await getClassSettings()).safety_lead_user_id === user.id;
}
