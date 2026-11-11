"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SETUP_SKIP_COOKIE, SETUP_SKIP_MAX_AGE } from "@/lib/onboarding";
import {
  deleteAccountData,
  saveProfileSetupFields,
  setEmailChoice,
  updateProfileFields,
} from "@/lib/app/profile";
import { clientsFor } from "@/lib/app/result";
import { safeNextPath } from "@/lib/safe-next";

/*
 * The website's doors onto profile changes. The rules (rate limits, username
 * normalisation, uniqueness, profanity, team-number limits, the service-role
 * writes scoped to the verified user, revalidation) live in
 * src/lib/app/profile.ts, shared with the app's /api/app/* routes, so the two
 * can't drift. These functions only read the form and the cookie session.
 */

export type ProfileState =
  | {
      error?: string;
      success?: boolean;
      /** Where the username step goes after saving: a same-site path. */
      next?: string;
    }
  | undefined;

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const result = await updateProfileFields(user, clientsFor(supabase), {
    fullName: String(formData.get("full_name") || ""),
    bio: String(formData.get("bio") || ""),
    avatarUrl: String(formData.get("avatar_url") || ""),
    username: String(formData.get("username") || ""),
    teamNumber: String(formData.get("team_number") || ""),
    role: String(formData.get("role") || "student"),
  });
  if (!result.ok) return { error: result.error };
  return { success: true };
}

/**
 * The username step (/account/username) and the dashboard's team-number card.
 *
 * Google sign-in collects only name/email/avatar, so those accounts arrive
 * with a generated username and, for 70% of them, no team number, which keeps
 * them out of team clustering entirely.
 *
 * For a generated username, "Keep @handle" (`keep`) keeps it and a new name
 * replaces it; both clear the flag. A handle the person chose is left alone,
 * so this is not a back door around Settings for renames. The rules are
 * saveProfileSetupFields (src/lib/app/profile.ts), shared with the app. `next`
 * comes back on success, only as a same-site path, for the step to go to.
 */
export async function saveProfileSetup(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const result = await saveProfileSetupFields(user, clientsFor(supabase), {
    username: String(formData.get("username") || ""),
    teamNumber: String(formData.get("team_number") || ""),
    keep: formData.get("keep") === "1",
  });
  if (!result.ok) return { error: result.error };
  return { success: true, next: safeNextPath(String(formData.get("next") || "")) };
}

/**
 * Dismiss the setup prompt. Deliberately a short-lived cookie rather than a
 * profile flag: the ask is optional and must never block reading, but a
 * permanent dismissal would strand the account outside team clustering
 * forever, so it returns after two weeks.
 */
export async function skipProfileSetup(): Promise<void> {
  const jar = await cookies();
  jar.set(SETUP_SKIP_COOKIE, "1", {
    maxAge: SETUP_SKIP_MAX_AGE,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/", "layout");
}

/**
 * Turn learning-reminder emails on or off for the signed-in user. Opt-in since
 * 2026-10-12; the rule and its write live in setEmailChoice
 * (src/lib/app/profile.ts), shared with the app.
 */
export async function setEmailOptIn(
  optIn: boolean
): Promise<{ error?: string; optIn?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const result = await setEmailChoice(user, clientsFor(supabase), optIn);
  if (!result.ok) return { error: result.error };
  return { optIn: result.optIn };
}

/**
 * Permanently delete the signed-in user's own account and all their data
 * (deleteAccountData in src/lib/app/profile.ts, shared with the app), then sign
 * this browser out.
 */
export async function deleteAccount(): Promise<{ error?: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const result = await deleteAccountData(user, clientsFor(supabase));
  if (!result.ok) return { error: result.error };

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
