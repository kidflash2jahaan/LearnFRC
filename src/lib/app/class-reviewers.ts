import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOwnerEmail } from "@/lib/auth";
import { siteRoleFor } from "@/lib/app/admin-access";
import { fail, type AppUser, type Failure } from "@/lib/app/result";
import { getClassSettings } from "@/lib/classes/config";
import { COORDINATOR } from "@/lib/classes/coordinator";
import { ageOn } from "@/lib/classes/age";

/**
 * Who may review classes (classes-design.md sections 7.6 and 8.1): a super
 * admin, or the account set as class_settings.safety_lead_user_id (Dhiren).
 *
 * The safety lead isn't on the admin team: he has no site_admins row, so
 * /admin, /admin/reports and /admin/team stay locked for him (they check the
 * site role), while every /admin/classes page checks requireClassReviewer and
 * lets him in. That's "the class pages and nothing else in /admin".
 *
 * Restricted material (a review flagged for grooming, sexual content,
 * sextortion or signs of abuse, one the AI refused, one where a student had a
 * camera or screen share on, a class reported for sexual content, and the
 * holds that go with them) is the safety lead's alone. Super admins see RESTRICTED_PLACEHOLDER until he
 * releases it (releaseHold in src/lib/classes/holds.ts). Jahaan is a minor,
 * and he isn't the one who reads or watches that material.
 *
 * Every check reads the settings row the server's own way. A read error gives
 * the defaults (no safety lead), so a database hiccup can only shut someone
 * out, never let them in.
 */

export type ClassReviewerRole = "superadmin" | "safety_lead";

export type ClassReviewer = {
  ok: true;
  /** "safety_lead" when the caller is the safety lead (even if also a super admin). */
  role: ClassReviewerRole;
  superAdmin: boolean;
  safetyLead: boolean;
};

export const NOT_CLASS_REVIEWER =
  "Class reviews are open to LearnFRC's super admins and the safety lead only.";

/** What a super admin sees in place of restricted material. */
export const RESTRICTED_PLACEHOLDER = `${COORDINATOR.name.split(" ")[0]} is handling this one.`;

/** The safety lead's account id, or null when none is set. */
export async function safetyLeadUserId(): Promise<string | null> {
  const s = await getClassSettings();
  return s.safety_lead_user_id ?? null;
}

/** True when `user` is the account set as the safety lead. */
export async function isSafetyLead(user: Pick<AppUser, "id">): Promise<boolean> {
  const lead = await safetyLeadUserId();
  return !!lead && lead === user.id;
}

export async function requireClassReviewer(user: AppUser): Promise<ClassReviewer | Failure> {
  const [role, safetyLead] = await Promise.all([siteRoleFor(user), isSafetyLead(user)]);
  const superAdmin = role === "superadmin";
  if (safetyLead) return { ok: true, role: "safety_lead", superAdmin, safetyLead: true };
  if (superAdmin) return { ok: true, role: "superadmin", superAdmin: true, safetyLead: false };
  return fail("forbidden", NOT_CLASS_REVIEWER);
}

/**
 * True only for the safety lead. Callers show restricted material (a
 * restricted review's transcript, quotes, chat and recording, and restricted
 * holds) only when this is true, until he releases it.
 */
export async function canSeeRestricted(user: AppUser): Promise<boolean> {
  return isSafetyLead(user);
}

/**
 * Whether an account may be set as the safety lead (for the settings form on
 * /admin/classes). The point of the role is an adult reading what a minor
 * shouldn't, so it refuses an owner account (Jahaan's, in ADMIN_EMAILS), and
 * it needs a classes age answer that says 18 or older by the conservative
 * rule (ageOn): an account that never answered isn't known to be an adult,
 * and most accounts on the site are teens. The safety lead answers the age
 * screen on /classes/ready once, as 18 or older, which writes that row.
 * Returns the refusal, or null.
 */
export async function safetyLeadCandidateError(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const [{ data: authUser }, { data: age }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("class_age_checks").select("birth_year, birth_month").eq("user_id", userId).maybeSingle(),
  ]);
  if (!authUser?.user) return "That account doesn't exist.";
  if (isOwnerEmail(authUser.user.email))
    return "The site owner's account can't be the safety lead. Restricted material is for an adult volunteer.";
  if (!age)
    return "The safety lead has to be an adult. Have them sign in and answer the age question on /classes/ready first, then set them here.";
  if (ageOn(new Date(), age.birth_year as number, age.birth_month as number) < 18)
    return "The safety lead has to be an adult.";
  return null;
}
