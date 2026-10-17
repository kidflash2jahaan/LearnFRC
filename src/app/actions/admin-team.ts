"use server";

import { createClient } from "@/lib/supabase/server";
import { NOT_SUPER_ADMIN } from "@/lib/app/admin-access";
import { decideApplication, setAdminRoleFor } from "@/lib/app/admin-team-desk";
import { submitApplication, withdrawApplication } from "@/lib/app/admin-apply";

/**
 * The website's door onto the admin team: applying to join it, and running it.
 *
 * The rules themselves (role checks, limits, the status-gated decision, the
 * grant rollback, owner and self protection, the emails and revalidation) live
 * in src/lib/app/admin-team-desk.ts and src/lib/app/admin-apply.ts, shared with
 * the app's /api/app/admin/* and /api/app/apply routes, so the two doors can't
 * drift. Each shared function re-checks the caller's site role itself: a
 * "use server" function is a public endpoint and the UI hiding a button is not
 * authorisation.
 */

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

/* ── Applying ─────────────────────────────────────────────────────── */

export async function submitAdminApplication(
  _prev: ApplyState,
  formData: FormData
): Promise<ApplyState> {
  const user = await sessionUser();
  if (!user) return { error: "Sign in first, then apply." };
  const result = await submitApplication(user, {
    experience: field(formData, "experience"),
    why: field(formData, "why"),
    availability: field(formData, "availability"),
  });
  return result.ok ? { success: true } : { error: result.error };
}

/** Used with useActionState, which passes (state, formData); neither is needed. */
export async function withdrawAdminApplication(): Promise<ApplyState> {
  const user = await sessionUser();
  if (!user) return { error: "Sign in first." };
  const result = await withdrawApplication(user);
  return result.ok ? { success: true } : { error: result.error };
}

/* ── Reviewing (super admin only) ─────────────────────────────────── */

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

/* ── Managing the team (super admin only) ─────────────────────────── */

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
