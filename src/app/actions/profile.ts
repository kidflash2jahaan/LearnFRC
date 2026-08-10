"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { firstProfaneField } from "@/lib/profanity";
import {
  isPlaceholderUsername,
  SETUP_SKIP_COOKIE,
  SETUP_SKIP_MAX_AGE,
} from "@/lib/onboarding";

export type ProfileState = { error?: string; success?: boolean } | undefined;

const ROLES = ["student", "mentor", "alum", "coach", "other"];

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const full_name = String(formData.get("full_name") || "").trim() || null;
  const bio = String(formData.get("bio") || "").trim() || null;
  const avatar_url = String(formData.get("avatar_url") || "").trim() || null;
  if (avatar_url && !/^https?:\/\//i.test(avatar_url))
    return { error: "Avatar URL must start with http:// or https://" };
  const usernameRaw = String(formData.get("username") || "").trim();
  const teamStr = String(formData.get("team_number") || "").trim();
  const roleRaw = String(formData.get("role") || "student");

  let team_number: number | null = null;
  if (teamStr) {
    team_number = parseInt(teamStr, 10);
    if (Number.isNaN(team_number) || team_number < 1 || team_number > 99999)
      return { error: "Enter a valid FRC team number." };
  }

  let username: string | null = null;
  if (usernameRaw) {
    username = usernameRaw.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (username.length < 3)
      return { error: "Username must be at least 3 characters (a–z, 0–9, _)." };
    const { data: taken } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .neq("id", user.id)
      .maybeSingle();
    if (taken) return { error: "That username is already taken." };
  }

  const role = ROLES.includes(roleRaw) ? roleRaw : "student";

  // Block offensive username / name / bio on edit (local, no AI).
  const badField = firstProfaneField({
    username: username ?? "",
    full_name: full_name ?? "",
    bio: bio ?? "",
  });
  if (badField)
    return {
      error:
        badField === "username"
          ? "That username isn't allowed — please choose another."
          : badField === "full_name"
            ? "That name isn't allowed — please use a different one."
            : "Please remove the inappropriate language from your bio.",
    };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name, bio, username, team_number, role, avatar_url })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Finish the profile of an account that never saw the signup form.
 *
 * Google sign-in collects only name/email/avatar, so those profiles land with
 * no username (rendering as "Learner" everywhere) and — for 70% of them — no
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

  const { data: current } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  const currentUsername: string | null = current?.username ?? null;
  const wantsUsername =
    !currentUsername || isPlaceholderUsername(currentUsername);

  const teamStr = String(formData.get("team_number") || "").trim();
  let team_number: number | null = null;
  if (teamStr) {
    team_number = parseInt(teamStr, 10);
    if (Number.isNaN(team_number) || team_number < 1 || team_number > 99999)
      return { error: "Enter a valid FRC team number." };
  }

  const payload: { username?: string; team_number?: number } = {};

  if (wantsUsername) {
    const raw = String(formData.get("username") || "").trim();
    const username = raw.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (username.length < 3)
      return { error: "Username must be at least 3 characters (a–z, 0–9, _)." };
    if (firstProfaneField({ username }))
      return { error: "That username isn't allowed — please choose another." };

    if (username !== currentUsername) {
      const { data: taken } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .neq("id", user.id)
        .maybeSingle();
      if (taken) return { error: "That username is already taken." };
      payload.username = username;
    }
  }

  if (team_number !== null) payload.team_number = team_number;

  // Nothing to write: either a team-only ask left blank, or a placeholder
  // handle resubmitted unchanged. Say so rather than reporting a silent
  // success that leaves the same card sitting there.
  if (Object.keys(payload).length === 0)
    return {
      error: wantsUsername
        ? "Nothing to save — choose a different username, add your team number, or Skip for now."
        : "Enter your team number, or choose Skip for now.",
    };

  // Guard the username write against a race: only overwrite the exact value we
  // decided was fair game (null, or the placeholder we just read).
  let q = supabase.from("profiles").update(payload).eq("id", user.id);
  if (payload.username !== undefined)
    q = currentUsername === null
      ? q.is("username", null)
      : q.eq("username", currentUsername);

  const { data: updated, error } = await q.select("id").maybeSingle();
  if (error)
    // Unique-index race (someone grabbed it between check and write).
    return error.code === "23505"
      ? { error: "That username is already taken." }
      : { error: error.message };
  if (!updated)
    return { error: "Your profile changed in another tab — reload and retry." };

  revalidatePath("/", "layout");
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
 * Permanently delete the signed-in user's own account and all their data.
 * Deletes child rows explicitly (no cascade FK to auth.users), then the auth user.
 */
export async function deleteAccount(): Promise<{ error?: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const uid = user.id;
  const admin = createAdminClient();
  // Remove all of the user's data first so nothing is orphaned.
  await admin.from("lesson_progress").delete().eq("user_id", uid);
  await admin.from("bookmarks").delete().eq("user_id", uid);
  await admin.from("user_achievements").delete().eq("user_id", uid);
  await admin.from("profiles").delete().eq("id", uid);
  const { error } = await admin.auth.admin.deleteUser(uid);
  if (error) return { error: error.message };

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
