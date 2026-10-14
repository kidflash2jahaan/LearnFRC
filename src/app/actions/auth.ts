"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  registerAccount,
  requestIp,
  resolveSignInEmail,
} from "@/lib/app/accounts";

export type AuthState =
  | {
      error?: string;
      /** On success, the client performs a FULL page load to this path so
          every layout/navbar picks up the new auth cookies immediately
          (a soft client transition leaves "Log in" showing until refresh). */
      redirectTo?: string;
    }
  | undefined;

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

  // Allow logging in with a username instead of an email. Shared with the
  // app's POST /api/app/auth/sign-in (src/lib/app/accounts.ts).
  const resolved = await resolveSignInEmail(identifier);
  if (!resolved.ok) return { error: resolved.error };
  const { email } = resolved;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  // No revalidatePath here: it would rebuild /login inside the action
  // response, whose authed-redirect then soft-navigates and unmounts the form
  // before the client can run window.location.assign(redirectTo). The full
  // page load the client performs makes revalidation redundant anyway.
  return { redirectTo: safeNext(next) };
}

export async function signUp(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") || "").trim();
  const next = String(formData.get("next") || "/dashboard");
  const dest = safeNext(next);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  // The rules (ban list, profanity, username and team number, the
  // already-registered check, reminder-email consent, attribution) live in
  // src/lib/app/accounts.ts, shared with the app's POST /api/app/auth/sign-up.
  const cookieStore = await cookies();
  const result = await registerAccount(
    {
      email,
      password: String(formData.get("password") || ""),
      fullName: String(formData.get("full_name") || ""),
      username: String(formData.get("username") || ""),
      teamNumber: String(formData.get("team_number") || ""),
      // Reminder emails are opt-in: an unticked checkbox isn't submitted at all.
      emailOptIn: formData.get("email_opt_in") === "on",
      ref: String(formData.get("ref") || ""),
      via: String(formData.get("via") || ""),
    },
    {
      auth: await createClient(),
      emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(dest)}`,
      // Client IP (Vercel forwards it), used for the ban list and stored
      // per-account so a repeat offender's whole IP can be banned.
      signupIp: await requestIp(),
      // First-touch source cookie set by <SourceCapture/>.
      srcCookie: cookieStore.get("lf_src")?.value || null,
    }
  );
  if (!result.ok) return { error: result.error };

  // Supabase reports success without sending anything for an email that's
  // already registered. Send them to log in instead of a dead "check your
  // inbox" screen.
  if (result.status === "exists")
    redirect(`/login?notice=exists&email=${encodeURIComponent(email)}`);

  // Email confirmation is required, so send them to a "check your inbox" screen.
  redirect(`/auth/verify-email?email=${encodeURIComponent(email)}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // No redirect/revalidate here: callers do a FULL page load (window.location)
  // after this resolves, which re-renders everything with the cleared session.
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

export type ResetState = { error?: string; success?: boolean } | undefined;

/**
 * Step 1 of password reset: email the user a recovery link. The recovery email
 * template links to /auth/confirm?type=recovery (token-hash flow, cross-device
 * safe), which verifies and lands them on /account/password to set a new one.
 *
 * We ALWAYS report success (never reveal whether an email is registered) to
 * avoid account enumeration; genuine send errors are logged server-side.
 */
export async function requestPasswordReset(
  _prev: ResetState,
  formData: FormData
): Promise<ResetState> {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@"))
    return { error: "Enter the email address you signed up with." };

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/account/password`,
  });
  if (error) {
    // Rate-limit is the one case worth surfacing so a user isn't left waiting
    // on an email that was throttled; everything else stays anti-enumeration.
    if (error.status === 429)
      return { error: "Too many attempts. Wait a minute and try again." };
    console.error("requestPasswordReset:", error.message);
  }
  return { success: true };
}

/**
 * Step 2 of password reset: set the new password. Requires an active session
 * (the recovery session minted by /auth/confirm). No session ⇒ the link was
 * never followed or has expired.
 */
export async function updatePassword(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Those passwords don't match." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      error:
        "Your reset link has expired. Request a new one from the login page.",
    };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard?pw=updated");
}
