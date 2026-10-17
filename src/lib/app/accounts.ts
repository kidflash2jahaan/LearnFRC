import "server-only";
import { headers } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { firstProfaneField } from "@/lib/profanity";
import { hookSourceFor } from "@/lib/signup-source";
import {
  attributeSignup,
  normalizeVia,
  payReferralReward,
} from "@/lib/signup-attribution";
import { isFreshSignup } from "@/lib/first-run";
import { normalizeUsername } from "@/lib/app/profile";
import { fail, type Result } from "@/lib/app/result";

/**
 * Sign-in lookup and sign-up rules, shared by the website's signIn / signUp
 * Server Actions (src/app/actions/auth.ts) and the app's
 * POST /api/app/auth/sign-in and POST /api/app/auth/sign-up. The post-sign-in
 * work for Google (and any other OAuth provider) is here too, shared by the
 * website's /auth/callback and the app's POST /api/app/auth/oauth-complete.
 */

/** The client's IP as Vercel forwards it, or null. */
export async function requestIp(): Promise<string | null> {
  const hdrs = await headers();
  return (
    (hdrs.get("x-forwarded-for") || "").split(",")[0].trim() ||
    hdrs.get("x-real-ip") ||
    null
  );
}

/* ------------------------------------------------------------------ */
/*  Sign in with an email OR a username                                */
/* ------------------------------------------------------------------ */

/**
 * The email to sign in with. An identifier containing "@" is already one; any
 * other identifier is a username, resolved with the service role because the
 * caller is signed OUT and the anon role can't SELECT `profiles`. Single-row
 * lookup by exact username, `id` only: it resolves one handle the user already
 * typed, so it can't be walked into a roster. The email never leaves the
 * server through the app's route.
 */
export async function resolveSignInEmail(
  identifier: string
): Promise<Result<{ email: string }>> {
  if (identifier.includes("@")) return { ok: true, email: identifier };

  const uname = normalizeUsername(identifier);
  const admin = createAdminClient();
  const { data: prof } = await admin
    .from("profiles")
    .select("id")
    .eq("username", uname)
    .maybeSingle();
  if (!prof) return fail("unauthorized", "No account found with that username.");
  const { data: u } = await admin.auth.admin.getUserById(prof.id as string);
  const email = u?.user?.email ?? "";
  if (!email) return fail("unauthorized", "Couldn't sign you in. Try your email instead.");
  return { ok: true, email };
}

/* ------------------------------------------------------------------ */
/*  Sign up                                                            */
/* ------------------------------------------------------------------ */

/** Every sign-up field as raw text, the way the website's form submits it. */
export type SignUpFields = {
  email: string;
  password: string;
  fullName: string;
  username: string;
  teamNumber: string;
  /** Reminder emails are opt-in: only an explicit yes turns them on. */
  emailOptIn: boolean;
  /** A referrer's username, or a conversion-hook token. */
  ref: string;
  /** Which share surface produced a referral. Allow-listed. */
  via: string;
};

export type SignUpContext = {
  /** A client with no session (the anon role) that performs auth.signUp. */
  auth: SupabaseClient;
  /** Where the confirmation link's fallback redirect points. */
  emailRedirectTo: string;
  signupIp: string | null;
  /** First-touch acquisition source (the website's `lf_src` cookie). */
  srcCookie: string | null;
};

export type SignUpOutcome = {
  /**
   * `confirm_email`: a new account was created and a confirmation email sent.
   * `exists`: that email is already registered. Supabase deliberately reports
   * success here without sending anything, so the person should sign in.
   */
  status: "confirm_email" | "exists";
};

export async function registerAccount(
  fields: SignUpFields,
  ctx: SignUpContext
): Promise<Result<SignUpOutcome>> {
  const email = fields.email.trim();
  const password = fields.password;
  const fullName = fields.fullName.trim();
  const usernameRaw = fields.username.trim();
  const teamNumber = fields.teamNumber.trim();
  // A `ref` is normally a referrer's username. Conversion hooks (lesson/article
  // signup CTAs) instead pass a known hook token that names the surface. Those
  // are recorded as a last-touch `source`, not treated as a referral.
  const rawRef = fields.ref.trim().toLowerCase();
  const hookSource = hookSourceFor(rawRef);
  const ref = hookSource ? "" : rawRef.replace(/[^a-z0-9_]/g, "");
  // Allow-listed, never free text.
  const via = normalizeVia(fields.via);

  if (!email || !password) return fail("validation", "Email and password are required.");
  if (password.length < 8)
    return fail("validation", "Password must be at least 8 characters.");

  const username = normalizeUsername(usernameRaw);
  if (!username || username.length < 3)
    return fail(
      "validation",
      "Choose a username: at least 3 characters (letters, numbers, _)."
    );

  // Block offensive usernames / names at creation time (local, no AI).
  const badField = firstProfaneField({ username, full_name: fullName });
  if (badField)
    return fail(
      "validation",
      badField === "username"
        ? "That username isn't allowed. Please choose another."
        : "That name isn't allowed. Please use a different one."
    );

  let teamNum: number | null = null;
  if (teamNumber) {
    teamNum = parseInt(teamNumber, 10);
    if (Number.isNaN(teamNum) || teamNum < 1 || teamNum > 99999)
      return fail("validation", "Enter a valid FRC team number.");
  }

  // Ban list: reject banned emails or banned IPs with a generic message.
  const admin = createAdminClient();
  {
    const [{ data: bannedEmail }, { data: bannedIp }] = await Promise.all([
      admin.from("banned_emails").select("email").eq("email", email.toLowerCase()).maybeSingle(),
      ctx.signupIp
        ? admin.from("banned_ips").select("ip").eq("ip", ctx.signupIp).maybeSingle()
        : Promise.resolve({ data: null as { ip: string } | null }),
    ]);
    if (bannedEmail || bannedIp)
      return fail(
        "validation",
        "This account can't be created. If you believe this is a mistake, contact support."
      );
  }

  // Friendly pre-check for username collision (avoids a cryptic DB error).
  // Exact match, `id` only: a taken/not-taken answer for one handle, which the
  // unique index would give away on submit anyway.
  {
    const { data: taken } = await admin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (taken) return fail("conflict", "That username is already taken.");
  }

  const { data, error } = await ctx.auth.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: ctx.emailRedirectTo,
      data: {
        full_name: fullName || null,
        username: username || null,
        team_number: teamNum !== null ? String(teamNum) : null,
      },
    },
  });
  if (error)
    return error.status === 429
      ? fail("rate_limited", error.message, 60)
      : fail("validation", error.message);

  // Supabase's signUp deliberately succeeds (no error, no email) when the email
  // is already registered. It returns a user with an EMPTY identities array to
  // avoid leaking which emails exist. Skip everything below so the existing
  // account's source and settings are left alone.
  const alreadyRegistered =
    !!data.user &&
    Array.isArray(data.user.identities) &&
    data.user.identities.length === 0;
  if (alreadyRegistered) return { ok: true, status: "exists" };

  if (data.user) {
    // The profile row comes from the handle_new_user trigger with the column
    // default, email_opt_in = false (opt-in since 2026-10-12). Only an explicit
    // yes turns reminders on. Either way they saw the question, so the choice
    // is recorded and the one-time prompt won't ask again.
    //
    // Only for an account this request actually created, and only if it has
    // never answered: Supabase hands back the existing user's id when someone
    // signs up again with a registered but unconfirmed email, and without both
    // guards a stranger could tick the box on somebody else's account.
    if (isFreshSignup(data.user.created_at)) {
      await admin
        .from("profiles")
        .update({ email_opt_in: fields.emailOptIn, email_choice_at: new Date().toISOString() })
        .eq("id", data.user.id)
        .is("email_choice_at", null);
    }

    // Shared with the Google/OAuth path (/auth/callback); see
    // src/lib/signup-attribution.ts. The referral reward itself is paid later,
    // on email confirmation, which is what keeps it farm-resistant.
    await attributeSignup({
      userId: data.user.id,
      ref,
      via,
      srcCookie: ctx.srcCookie,
      signupIp: ctx.signupIp,
      hookSource,
    });
  }

  return { ok: true, status: "confirm_email" };
}

/* ------------------------------------------------------------------ */
/*  Where an app signup came from                                      */
/* ------------------------------------------------------------------ */

/** The acquisition source an app signup is recorded under (profiles.source). */
const APP_PLATFORM_SOURCE: Record<string, string> = {
  ios: "iOS app",
  ipados: "iPad app",
  macos: "Mac app",
};

/**
 * `profiles.source` for an account created from the app, by the `platform`
 * the app sends (`ios`, `ipados`, `macos`). Anything else is "LearnFRC app".
 * It stands in for the website's first-touch `lf_src` cookie, so a referral
 * link or a conversion hook still wins over it (see attributeSignup). Used by
 * POST /api/app/auth/sign-up and POST /api/app/auth/oauth-complete.
 */
export function appSignupSource(platform: string): string {
  return APP_PLATFORM_SOURCE[platform.toLowerCase()] ?? "LearnFRC app";
}

/* ------------------------------------------------------------------ */
/*  After an OAuth sign-in (Google)                                    */
/* ------------------------------------------------------------------ */

export type OAuthSignInContext = {
  /** A referrer's username from the invite link (`?ref=`), unsanitised. */
  ref: string | null;
  /** Which share surface produced the referral (`?via=`). Allow-listed later. */
  via: string | null;
  /** First-touch source: the site's `lf_src` cookie, or the app's platform source. */
  srcCookie: string | null;
  signupIp: string | null;
  /** Names the door in the error log, e.g. "auth/callback". */
  door: string;
};

/**
 * The work that runs once an OAuth provider has signed someone in, for the
 * website's /auth/callback (after it trades the code for a session) and the
 * app's POST /api/app/auth/oauth-complete (after the app's own Google sign-in).
 *
 * Only a brand-new account (isFreshSignup, the one definition of "new" in this
 * codebase) is attributed: someone signing back in keeps the source they first
 * arrived with, and attributeSignup also refuses to overwrite a source that is
 * already set. Google has already verified the address, so a referral reward
 * is paid straight away; payReferralReward pays at most once per account, so
 * calling this on every sign-in is safe.
 *
 * Never fails. Analytics must never block a sign-in, so an attribution error
 * is logged loudly (a silent failure here is how the last gap went unnoticed
 * for three weeks) and the answer still comes back.
 */
export async function completeOAuthSignIn(
  user: Pick<User, "id" | "created_at"> | null | undefined,
  ctx: OAuthSignInContext
): Promise<{ isNewAccount: boolean }> {
  const isNewAccount = isFreshSignup(user?.created_at);

  if (user && isNewAccount) {
    try {
      const { referredBy } = await attributeSignup({
        userId: user.id,
        ref: ctx.ref,
        via: ctx.via,
        srcCookie: ctx.srcCookie,
        signupIp: ctx.signupIp,
      });
      // Google has already verified the address, so the reward is safe to pay
      // now. Waiting on a confirmation click would wait forever: this flow
      // never produces one.
      if (referredBy) await payReferralReward(user.id);
    } catch (e) {
      console.error(`${ctx.door} attribution failed:`, e);
    }
  }

  return { isNewAccount };
}
