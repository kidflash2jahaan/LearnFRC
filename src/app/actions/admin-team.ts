"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getSession, isOwnerEmail } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { teamRoleLabel } from "@/lib/team-roles";
import {
  sendEmail,
  adminNotifyHtml,
  applicationReceivedHtml,
  applicationDecisionHtml,
} from "@/lib/email";

/**
 * The admin team: applying to join it, and running it.
 *
 * Every function here is a public "use server" endpoint, so each one re-checks
 * the caller's role from the session before touching anything. The UI hiding
 * a button is not authorisation.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";
const MIN_CHARS = 40;
const MAX_CHARS = 3000;

/**
 * The refusal both super-admin actions give. One string, so the two cannot
 * drift apart, and it names the likely cause: the controls are only rendered
 * for a super admin, so somebody reading this has almost certainly been signed
 * out under a page that was open. It says what to do about that.
 */
const NOT_SUPER_ADMIN =
  "Only a super admin can do that. Try reloading the page and signing in again.";

export type ApplyState = { error?: string; success?: boolean } | undefined;
export type ReviewState =
  | {
      error?: string;
      /** Which control the error is about, when it is about one. Lets the
          review form mark the right field invalid instead of stamping the
          note red for "that one has already been decided". */
      field?: "note";
      success?: boolean;
    }
  | undefined;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function field(formData: FormData, name: string) {
  return String(formData.get(name) || "").trim();
}

/** Email on file for an account. Used only to send mail, never displayed. */
async function emailFor(userId: string): Promise<string | null> {
  const { data } = await createAdminClient().auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

/**
 * Send after the response, and say so in the logs when it fails.
 *
 * A bare `void sendEmail(...)` is not safe here. The serverless instance can be
 * frozen the moment the action's response is flushed, so a promise nobody is
 * holding may never finish, and `sendEmail` resolves to `{ ok: false }` rather
 * than throwing, so a rejected key or an unverified sender would be silent
 * either way. These are the emails the product promises out loud: /apply says
 * "You'll get an email either way" and the review desk says the same. `after`
 * keeps the instance alive for the send, and the log is the only place a
 * failure can surface, because the applicant by definition sees nothing.
 */
function mail(what: string, message: Parameters<typeof sendEmail>[0]) {
  after(async () => {
    const res = await sendEmail(message);
    if (!res.ok) console.error(`admin-team email failed (${what}):`, res.error);
  });
}

function revalidateTeamPages() {
  revalidatePath("/apply");
  revalidatePath("/admin");
  revalidatePath("/admin/team");
}

/* ── Applying ─────────────────────────────────────────────────────── */

export async function submitAdminApplication(
  _prev: ApplyState,
  formData: FormData
): Promise<ApplyState> {
  const { user, profile, isAdmin } = await getSession();
  if (!user) return { error: "Sign in first, then apply." };
  if (isAdmin) return { error: "You're already on the team." };

  const experience = field(formData, "experience");
  const why = field(formData, "why");
  const availability = field(formData, "availability");

  if (experience.length < MIN_CHARS)
    return { error: "Say a bit more about your FRC experience (a few sentences)." };
  if (why.length < MIN_CHARS)
    return { error: "Say a bit more about why you want to help (a few sentences)." };
  if (experience.length > MAX_CHARS || why.length > MAX_CHARS)
    return { error: "That's longer than it needs to be. Keep each answer under 3000 characters." };
  if (availability.length > 200)
    return { error: "Keep availability to a line." };

  // Keyed on the ACCOUNT, the way every other signed-in action in this repo
  // keys its bucket. An IP-only bucket would give a whole school or shop behind
  // one NAT three applications a day between everybody, and this audience is
  // FRC teams, who share exactly that. The looser IP bucket under it is still
  // worth having against somebody cycling throwaway accounts.
  if (
    !(await rateLimit("admin-apply", 3, 86400, user.id)) ||
    !(await rateLimit("admin-apply-ip", 25, 86400))
  )
    return { error: "That's a lot of applications today. Try again tomorrow." };

  const admin = createAdminClient();
  const { data: open } = await admin
    .from("admin_applications")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (open) return { error: "You already have an application waiting. Sit tight." };

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
      return { error: "You already have an application waiting. Sit tight." };
    return { error: "Couldn't save that. Please try again." };
  }

  // The row is the record and the mail is a courtesy, but it is a courtesy this
  // page promises out loud, so both sends run in `after` and log their failure.
  const username = profile?.username ?? null;
  if (user.email) {
    mail("receipt", {
      to: user.email,
      subject: "Your LearnFRC application is in",
      html: applicationReceivedHtml(username),
    });
  }
  const ownerEmail = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim();
  if (ownerEmail) {
    mail("owner notification", {
      to: ownerEmail,
      subject: `LearnFRC: admin application from ${username ? "@" + username : "a member"}`,
      html: adminNotifyHtml({
        heading: "Someone applied to join the admin team",
        rows: [
          { label: "Handle", value: username ? `@${username}` : "no username yet" },
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
  return { success: true };
}

export async function withdrawAdminApplication(
  _prev: ApplyState,
  _formData: FormData
): Promise<ApplyState> {
  const { user } = await getSession();
  if (!user) return { error: "Sign in first." };
  const { data, error } = await createAdminClient()
    .from("admin_applications")
    .update({ status: "withdrawn", reviewed_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("status", "pending")
    .select("id");
  if (error) return { error: "Couldn't withdraw it. Please try again." };
  if (!data || data.length === 0)
    return { error: "There's no open application to withdraw." };
  revalidateTeamPages();
  return { success: true };
}

/* ── Reviewing (super admin only) ─────────────────────────────────── */

export async function reviewAdminApplication(
  _prev: ReviewState,
  formData: FormData
): Promise<ReviewState> {
  const { user, isSuperAdmin } = await getSession();
  if (!user || !isSuperAdmin) return { error: NOT_SUPER_ADMIN };

  const id = field(formData, "id");
  const decision = field(formData, "decision");
  const note = field(formData, "note");
  if (!id) return { error: "Missing application id." };
  if (decision !== "accept" && decision !== "reject")
    return { error: "Pick accept or reject." };
  if (note.length > 1000)
    return { error: "Keep the note under 1000 characters.", field: "note" };

  const admin = createAdminClient();
  const { data: app } = await admin
    .from("admin_applications")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!app) return { error: "That application no longer exists." };
  if (app.status !== "pending")
    return { error: "That one has already been decided." };

  const accepted = decision === "accept";
  const now = new Date().toISOString();

  // THE STATUS CHANGE IS THE GATE, and it runs before the grant. The read above
  // is a courtesy that gives the common case a better message; it cannot decide
  // anything, because two requests can both pass it. `.eq("status", "pending")`
  // plus a returned row means exactly one of them wins, so a retry after a
  // timeout, or a second super admin with the drawer open, gets "already
  // decided" instead of a second email. Granting first would be worse than
  // duplicate mail: an Accept and a Reject racing would leave an account that
  // can open /admin holding an application that reads "rejected".
  const { data: won, error: updErr } = await admin
    .from("admin_applications")
    .update({
      status: accepted ? "accepted" : "rejected",
      reviewed_at: now,
      reviewed_by: user.id,
      review_note: note || null,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (updErr) return { error: "Couldn't record the decision. Please try again." };
  if (!won || won.length === 0)
    return { error: "That one has already been decided." };

  if (accepted) {
    const { error: grantErr } = await admin.from("site_admins").upsert(
      {
        user_id: app.user_id as string,
        role: "admin",
        granted_by: user.id,
        granted_at: now,
        note: note || "accepted application",
      },
      { onConflict: "user_id" }
    );
    if (grantErr) {
      // Put the application back on the desk. Without this the row reads
      // "accepted" while the account holds no admin record, every retry is
      // refused as already decided, and nothing on the page shows the split.
      await admin
        .from("admin_applications")
        .update({
          status: "pending",
          reviewed_at: null,
          reviewed_by: null,
          review_note: null,
        })
        .eq("id", id);
      return {
        error: "Couldn't add them to the team, so nothing was decided. Try again.",
      };
    }
  }

  const to = await emailFor(app.user_id as string);
  if (to) {
    const { data: prof } = await admin
      .from("profiles")
      .select("username")
      .eq("id", app.user_id as string)
      .maybeSingle();
    mail("decision", {
      to,
      subject: accepted
        ? "You're on the LearnFRC admin team"
        : "About your LearnFRC application",
      html: applicationDecisionHtml({
        accepted,
        note: note || null,
        username: (prof?.username as string | null) ?? null,
      }),
    });
  }

  revalidateTeamPages();
  return { success: true };
}

/* ── Managing the team (super admin only) ─────────────────────────── */

export async function setAdminRole(
  _prev: ReviewState,
  formData: FormData
): Promise<ReviewState> {
  const { user, isSuperAdmin } = await getSession();
  if (!user || !isSuperAdmin) return { error: NOT_SUPER_ADMIN };

  const userId = field(formData, "userId");
  const role = field(formData, "role");
  if (!userId) return { error: "Missing user." };
  if (role !== "admin" && role !== "superadmin" && role !== "remove")
    return { error: "Pick a role." };
  // The page hides the controls on your own row, so this is only reachable by
  // a stale page or a hand-made request. It states the rule and stops, rather
  // than sending somebody to ask a second super admin who may not exist.
  if (userId === user.id)
    return { error: "You can't change your own role from here. Another super admin has to do it." };

  // Owners are super admins by configuration; the panel can't touch them.
  const targetEmail = await emailFor(userId);
  if (isOwnerEmail(targetEmail))
    return { error: "That account is a site owner and can't be changed here." };

  const admin = createAdminClient();
  if (role === "remove") {
    const { error } = await admin.from("site_admins").delete().eq("user_id", userId);
    if (error) return { error: "Couldn't remove them. Please try again." };
  } else {
    // UPDATE FIRST, INSERT ONLY IF THERE WAS NOTHING TO UPDATE. An upsert
    // carrying `granted_at` rewrites it on every role change, and PostgREST
    // turns that into `ON CONFLICT DO UPDATE SET` over every column in the
    // payload. /admin/team prints that date as the person's tenure and orders
    // the list by it, so promoting a January admin in September would move
    // their row and lose the real date with nothing to recover it from. On a
    // first grant the column default covers it.
    const { data: changed, error: updErr } = await admin
      .from("site_admins")
      .update({ role, granted_by: user.id })
      .eq("user_id", userId)
      .select("user_id");
    if (updErr) return { error: "Couldn't change the role. Please try again." };
    if (!changed || changed.length === 0) {
      const { error: insErr } = await admin
        .from("site_admins")
        .insert({ user_id: userId, role, granted_by: user.id });
      if (insErr) return { error: "Couldn't change the role. Please try again." };
    }
  }

  revalidateTeamPages();
  return { success: true };
}
