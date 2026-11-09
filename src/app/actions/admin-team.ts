"use server";

import { createClient } from "@/lib/supabase/server";
import { NOT_SUPER_ADMIN } from "@/lib/app/admin-access";
import { decideApplication, setAdminRoleFor } from "@/lib/app/admin-team-desk";

/**
 * The website's door onto /admin/team: the admin team, and old applications
 * from before /apply closed (reject only). Teacher applications have their
 * own desk and actions (src/app/actions/class-teachers.ts).
 *
 * The rules themselves (role checks, the status-gated decision, owner and
 * self protection, the email and revalidation) live in
 * src/lib/app/admin-team-desk.ts, shared with the app's /api/app/admin/*
 * routes, so the two doors can't drift. Each shared function re-checks the
 * caller's site role itself: a "use server" function is a public endpoint and
 * the UI hiding a button is not authorisation.
 */

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

function field(formData: FormData, name: string) {
  return String(formData.get(name) || "").trim();
}

/** The cookie session's verified user, or null. */
async function sessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/* ── Old applications (super admin only, reject only) ─────────────── */

export async function reviewAdminApplication(
  _prev: ReviewState,
  formData: FormData
): Promise<ReviewState> {
  const user = await sessionUser();
  if (!user) return { error: NOT_SUPER_ADMIN };
  const result = await decideApplication(user, {
    id: field(formData, "id"),
    decision: field(formData, "decision"),
    note: field(formData, "note"),
  });
  if (result.ok) return { success: true };
  return result.field === "note" ? { error: result.error, field: "note" } : { error: result.error };
}

/* ── Managing the admin team (super admin only) ───────────────────── */

export async function setAdminRole(
  _prev: ReviewState,
  formData: FormData
): Promise<ReviewState> {
  const user = await sessionUser();
  if (!user) return { error: NOT_SUPER_ADMIN };
  const result = await setAdminRoleFor(user, {
    userId: field(formData, "userId"),
    role: field(formData, "role"),
  });
  return result.ok ? { success: true } : { error: result.error };
}
