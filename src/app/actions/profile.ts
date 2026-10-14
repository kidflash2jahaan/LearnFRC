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

/*
 * The website's doors onto profile changes. The rules (rate limits, username
 * normalisation, uniqueness, profanity, team-number limits, the service-role
 * writes scoped to the verified user, revalidation) live in
 * src/lib/app/profile.ts, shared with the app's /api/app/* routes, so the two
 * can't drift. These functions only read the form and the cookie session.
 */

export type ProfileState = { error?: string; success?: boolean } | undefined;

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
 * Finish the profile of an account that never saw the signup form.
 *
 * Google sign-in collects only name/email/avatar, so those profiles land with
 * no username (rendering as "Learner" everywhere) and, for 70% of them, no
 * team number, which keeps them out of team clustering entirely.
 *
 * Writes the username only when the account has none or is still carrying a
 * machine-minted placeholder; a handle the user actually chose is left alone,
 * so this is not a back door around Settings for renames. Validation is
 * identical to signup: lowercased to a–z/0–9/_, ≥3 chars, the same profanity
 * filter, and a uniqueness check backed by the unique index.
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
  });
  if (!result.ok) return { error: result.error };
  return { success: true };
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
