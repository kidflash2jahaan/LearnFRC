"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type TeamState =
  | { error?: string; success?: boolean }
  | undefined;

function cleanCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Create a team (caller becomes the owner). One team per user. */
export async function createTeam(
  _prev: TeamState,
  formData: FormData
): Promise<TeamState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Team name is required." };
  if (name.length > 80) return { error: "Team name is too long." };

  const teamStr = String(formData.get("team_number") || "").trim();
  let team_number: number | null = null;
  if (teamStr) {
    team_number = parseInt(teamStr, 10);
    if (Number.isNaN(team_number) || team_number < 1 || team_number > 99999)
      return { error: "Enter a valid FRC team number." };
  }

  const { error } = await supabase.rpc("create_team", {
    p_name: name,
    p_team_number: team_number,
  });
  if (error) return { error: error.message };

  revalidatePath("/teams");
  revalidatePath("/", "layout");
  return { success: true };
}

/** Join a team by its share code (works for existing accounts — progress kept). */
export async function joinTeam(
  _prev: TeamState,
  formData: FormData
): Promise<TeamState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const code = cleanCode(String(formData.get("code") || ""));
  if (!code) return { error: "Enter a join code." };

  const { error } = await supabase.rpc("join_team", { p_code: code });
  if (error) return { error: error.message };

  revalidatePath("/teams");
  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Join by code from a link (used by /join/[code]). Returns an error string or
 * null on success; the caller handles the redirect.
 */
export async function joinTeamByCode(code: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "You must be signed in.";
  const clean = cleanCode(code);
  if (!clean) return "Invalid join code.";
  const { error } = await supabase.rpc("join_team", { p_code: clean });
  if (error) return error.message;
  revalidatePath("/teams");
  revalidatePath("/", "layout");
  return null;
}

/** Leave the team you're currently in (deletes your membership only). */
export async function leaveTeam(): Promise<TeamState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("team_memberships")
    .delete()
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/teams");
  revalidatePath("/", "layout");
  return { success: true };
}

/** Owner-only: rotate the team's join code. */
export async function regenerateCode(
  _prev: TeamState,
  formData: FormData
): Promise<TeamState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const teamId = String(formData.get("team_id") || "");
  if (!teamId) return { error: "Missing team." };

  const { error } = await supabase.rpc("regenerate_join_code", {
    p_team: teamId,
  });
  if (error) return { error: error.message };

  revalidatePath("/teams");
  return { success: true };
}
