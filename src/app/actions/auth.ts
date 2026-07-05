"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuthState = { error?: string } | undefined;

/** Only allow same-origin relative paths (blocks //evil.com, /\evil.com). */
function safeNext(n: string): string {
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\")
    ? n
    : "/dashboard";
}

export async function signIn(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const identifier = String(
    formData.get("identifier") || formData.get("email") || ""
  ).trim();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/dashboard");

  if (!identifier || !password)
    return { error: "Please enter your email or username and password." };

  const supabase = await createClient();

  // Allow logging in with a username instead of an email.
  let email = identifier;
  if (!identifier.includes("@")) {
    const uname = identifier.toLowerCase().replace(/[^a-z0-9_]/g, "");
    const { data: prof } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", uname)
      .maybeSingle();
    if (!prof) return { error: "No account found with that username." };
    const admin = createAdminClient();
    const { data: u } = await admin.auth.admin.getUserById(prof.id as string);
    email = u?.user?.email ?? "";
    if (!email) return { error: "Couldn't sign you in — try your email." };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect(safeNext(next));
}

export async function signUp(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const fullName = String(formData.get("full_name") || "").trim();
  const usernameRaw = String(formData.get("username") || "").trim();
  const teamNumber = String(formData.get("team_number") || "").trim();
  const next = String(formData.get("next") || "/dashboard");
  const ref = String(formData.get("ref") || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");

  if (!email || !password)
    return { error: "Email and password are required." };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };

  const username = usernameRaw.toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!username || username.length < 3)
    return {
      error: "Choose a username — at least 3 characters (letters, numbers, _).",
    };

  let teamNum: number | null = null;
  if (teamNumber) {
    teamNum = parseInt(teamNumber, 10);
    if (Number.isNaN(teamNum) || teamNum < 1 || teamNum > 99999)
      return { error: "Enter a valid FRC team number." };
  }

  const supabase = await createClient();

  // Friendly pre-check for username collision (avoids cryptic DB error)
  if (username) {
    const { data: taken } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (taken) return { error: "That username is already taken." };
  }

  const dest = safeNext(next);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(dest)}`,
      data: {
        full_name: fullName || null,
        username: username || null,
        team_number: teamNum !== null ? String(teamNum) : null,
      },
    },
  });
  if (error) return { error: error.message };

  // Supabase's signUp deliberately succeeds (no error, no email) when the email
  // is already registered — it returns a user with an EMPTY identities array to
  // avoid leaking which emails exist. Without this check the user is sent to a
  // dead "check your inbox" screen for an email that never arrives. Detect it
  // and route them to log in instead. Skip the profile update below so we don't
  // clobber the existing account's source/settings.
  const alreadyRegistered =
    !!data.user &&
    Array.isArray(data.user.identities) &&
    data.user.identities.length === 0;
  if (alreadyRegistered) {
    redirect(`/login?notice=exists&email=${encodeURIComponent(email)}`);
  }

  // Record acquisition source (first-touch cookie set by <SourceCapture/>) and,
  // if they came via a referral link, who referred them. The XP referral reward
  // is still paid out only on email verification (see /auth/confirm).
  // The profile row is created by a trigger. Self-referrals are blocked.
  if (data.user) {
    const admin = createAdminClient();
    const cookieStore = await cookies();
    const source = (
      ref ? "Referral" : cookieStore.get("lf_src")?.value || "Direct"
    ).slice(0, 40);
    const update: { source: string; referred_by?: string } = { source };
    if (ref) {
      const { data: referrer } = await admin
        .from("profiles")
        .select("id")
        .eq("username", ref)
        .maybeSingle();
      if (referrer && referrer.id !== data.user.id) {
        update.referred_by = referrer.id;
      }
    }
    await admin.from("profiles").update(update).eq("id", data.user.id);
  }

  // Email confirmation is required — send them to a "check your inbox" screen.
  redirect(`/auth/verify-email?email=${encodeURIComponent(email)}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function resendConfirmation(
  email: string
): Promise<{ error?: string; success?: boolean }> {
  if (!email) return { error: "Missing email." };
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${siteUrl}/auth/callback?next=/dashboard` },
  });
  if (error) return { error: error.message };
  return { success: true };
}
