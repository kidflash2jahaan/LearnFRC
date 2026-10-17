import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/queries";
import { rateLimit } from "@/lib/rate-limit";
import { teamRoleLabel } from "@/lib/team-roles";
import { adminNotifyHtml, applicationReceivedHtml } from "@/lib/email";
import { getMyApplication } from "@/lib/admin-team";
import {
  APPLICATIONS_OPEN,
  APPLY_LIMITS,
  HEADS,
  JOBS,
  type ApplyMode,
} from "@/lib/applications";
import { toIso } from "@/lib/app/format";
import { BAD_REQUEST, siteRoleFor, textField } from "@/lib/app/admin-access";
import { mailAfter, revalidateTeamPages } from "@/lib/app/admin-notify";
import { fail, type AppUser, type Result } from "@/lib/app/result";

/**
 * Applying to help run LearnFRC, shared by /apply (its page and the
 * submitAdminApplication / withdrawAdminApplication Server Actions) and the
 * app's GET, POST and DELETE /api/app/apply.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";
const { minChars: MIN_CHARS, maxChars: MAX_CHARS, availabilityMax: AVAIL_MAX } = APPLY_LIMITS;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Where a signed-in account stands on /apply. ("signed-out" is the page's own.) */
export type SignedInApplyMode = Exclude<ApplyMode, "signed-out">;

export type ApplyState = {
  applicationsOpen: boolean;
  mode: SignedInApplyMode;
  heading: { title: string; slug: string };
  /** What the reviewer would see: a handle, a team number, a role word. */
  record: { username: string | null; teamNumber: number | null; teamRoleLabel: string | null };
  /**
   * The account's latest application when it still says something: pending,
   * turned down or withdrawn. An accepted one whose account is no longer on
   * the team is treated as none at all (they were removed, and the old
   * acceptance is not an answer to "can I apply"). Always null for an admin.
   */
  application: {
    status: "pending" | "rejected" | "withdrawn";
    createdAt: string;
    reviewedAt: string | null;
    reviewNote: string | null;
  } | null;
  jobs: { slug: string; text: string }[];
  limits: typeof APPLY_LIMITS;
};

export async function loadApplyState(user: AppUser): Promise<Result<ApplyState>> {
  const [role, profile] = await Promise.all([siteRoleFor(user), getProfile(user.id)]);
  const isAdmin = role !== "member";
  // Only fetched when it can change what renders: an admin has nothing to
  // apply for.
  const latest = isAdmin ? null : await getMyApplication(user.id);
  const application =
    latest && (latest.status === "pending" || latest.status === "rejected" || latest.status === "withdrawn")
      ? {
          status: latest.status,
          createdAt: toIso(latest.createdAt) ?? latest.createdAt,
          reviewedAt: toIso(latest.reviewedAt),
          reviewNote: latest.reviewNote,
        }
      : null;

  // A handle is the only thing on an application that identifies a person, so
  // the page asks for one before the form rather than warning beside it.
  const handle = profile?.username ?? null;
  const open = application?.status === "pending";
  const mode: SignedInApplyMode = isAdmin
    ? "on-the-team"
    : open
      ? "pending"
      : !handle
        ? "no-handle"
        : application
          ? "again"
          : "new";

  return {
    ok: true,
    applicationsOpen: APPLICATIONS_OPEN,
    mode,
    heading: { ...HEADS[mode] },
    record: {
      username: handle,
      teamNumber: profile?.team_number ?? null,
      // The word, not the stored slug: `profiles.role` holds `other` for a
      // fifth of accounts, and nobody calls themselves that.
      teamRoleLabel: profile?.role ? teamRoleLabel(profile.role) : null,
    },
    application,
    jobs: JOBS,
    limits: APPLY_LIMITS,
  };
}

export async function submitApplication(
  user: AppUser,
  input: { experience: unknown; why: unknown; availability?: unknown }
): Promise<Result> {
  const [role, profile] = await Promise.all([siteRoleFor(user), getProfile(user.id)]);
  if (role !== "member") return fail("conflict", "You're already on the team.");
  if (!APPLICATIONS_OPEN)
    return fail("conflict", "Applications are closed for now. Check back later.");

  const experience = textField(input.experience);
  const why = textField(input.why);
  const availability = textField(input.availability);
  if (experience === null || why === null || availability === null)
    return fail("validation", BAD_REQUEST);

  // The page shows the "Pick a handle first" state instead of the form, and
  // this is the same rule on the server, so no door can file an application
  // that reaches the desk with nothing on it to identify anybody.
  const username = profile?.username ?? null;
  if (!username)
    return fail("validation", "Pick a handle on your settings page first, then apply.");

  if (experience.length < MIN_CHARS)
    return fail("validation", "Say a bit more about your FRC experience (a few sentences).");
  if (why.length < MIN_CHARS)
    return fail("validation", "Say a bit more about why you want to help (a few sentences).");
  if (experience.length > MAX_CHARS || why.length > MAX_CHARS)
    return fail(
      "validation",
      "That's longer than it needs to be. Keep each answer under 3000 characters."
    );
  if (availability.length > AVAIL_MAX) return fail("validation", "Keep availability to a line.");

  // Keyed on the ACCOUNT, the way every other signed-in action in this repo
  // keys its bucket. An IP-only bucket would give a whole school or shop behind
  // one NAT three applications a day between everybody, and this audience is
  // FRC teams, who share exactly that. The looser IP bucket under it is still
  // worth having against somebody cycling throwaway accounts.
  if (
    !(await rateLimit("admin-apply", 3, 86400, user.id)) ||
    !(await rateLimit("admin-apply-ip", 25, 86400))
  )
    return fail("rate_limited", "That's a lot of applications today. Try again tomorrow.", 86400);

  const admin = createAdminClient();
  const { data: open } = await admin
    .from("admin_applications")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (open) return fail("conflict", "You already have an application waiting. Sit tight.");

  const { error } = await admin.from("admin_applications").insert({
    user_id: user.id,
    team_number: profile?.team_number ?? null,
    team_role: profile?.role ?? null,
    experience,
    why,
    availability: availability || null,
  });
  if (error) {
    // The partial unique index catches a double submit that raced the check.
    if (error.code === "23505")
      return fail("conflict", "You already have an application waiting. Sit tight.");
    return fail("server", "Couldn't save that. Please try again.");
  }

  // The row is the record and the mail is a courtesy, but it is a courtesy the
  // page promises out loud, so both sends run in `after` and log their failure.
  if (user.email) {
    mailAfter("receipt", {
      to: user.email,
      subject: "Your LearnFRC application is in",
      html: applicationReceivedHtml(username),
    });
  }
  const ownerEmail = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim();
  if (ownerEmail) {
    mailAfter("owner notification", {
      to: ownerEmail,
      subject: `LearnFRC: admin application from @${username}`,
      html: adminNotifyHtml({
        heading: "Someone applied to join the admin team",
        rows: [
          { label: "Handle", value: `@${username}` },
          { label: "Team", value: profile?.team_number ? String(profile.team_number) : "not given" },
          { label: "Team role", value: teamRoleLabel(profile?.role) },
          { label: "Availability", value: availability || "not given" },
        ],
        bodyHtml: `
          <p style="margin:14px 0 4px;font-weight:700">FRC experience</p>
          <p style="margin:0 0 10px;white-space:pre-wrap">${esc(experience)}</p>
          <p style="margin:14px 0 4px;font-weight:700">Why they want to help</p>
          <p style="margin:0;white-space:pre-wrap">${esc(why)}</p>`,
        ctaText: "Review it",
        ctaUrl: `${SITE}/admin/team`,
        note: "Accepting gives them the admin panel: site numbers (no names or emails), the feedback inbox, edit review, and the verified mark.",
      }),
    });
  }

  revalidateTeamPages();
  return { ok: true };
}

export async function withdrawApplication(user: AppUser): Promise<Result> {
  const { data, error } = await createAdminClient()
    .from("admin_applications")
    .update({ status: "withdrawn", reviewed_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("status", "pending")
    .select("id");
  if (error) return fail("server", "Couldn't withdraw it. Please try again.");
  if (!data || data.length === 0)
    return fail("not_found", "There's no open application to withdraw.");
  revalidateTeamPages();
  return { ok: true };
}
