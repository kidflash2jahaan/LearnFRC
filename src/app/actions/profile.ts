"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const hide_name = String(formData.get("hide_name") || "") === "true";
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

  const { error } = await supabase
    .from("profiles")
    .update({ full_name, bio, username, team_number, role, avatar_url, hide_name })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { success: true };
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
