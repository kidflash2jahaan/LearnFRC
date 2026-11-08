import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";
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
import { deleteAccountData, normalizeUsername } from "@/lib/app/profile";
import {
  appleIdentity,
  keepAppleRefreshToken,
  keepAppleTokenFromCode,
} from "@/lib/app/apple-sign-in";
import { fail, type Result } from "@/lib/app/result";

/**
 * Sign-in lookup and sign-up rules, shared by the website's signIn / signUp
 * Server Actions (src/app/actions/auth.ts) and the app's
 * POST /api/app/auth/sign-in and POST /api/app/auth/sign-up. The post-sign-in
 * work for Google and Sign in with Apple is here too, shared by the website's
 * /auth/callback and the app's POST /api/app/auth/oauth-complete.
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
/*  The ban list                                                       */
/* ------------------------------------------------------------------ */

/**
 * What a banned email or IP is told, at every door that makes an account: the
 * sign-up form, the app's sign-up, and Google or Apple on either.
 */
export const BANNED_SIGNUP =
  "This account can't be created. If you believe this is a mistake, contact support.";

/**
 * Whether a new account's email or signup IP is on the ban list
 * (`banned_emails`, `banned_ips`; the report desk's ban and the progress scan
 * write them). A read error counts as not banned, as it always has: the ban
 * list must never lock everyone out.
 */
async function isOnBanList(
  email: string | null | undefined,
  ip: string | null | undefined
): Promise<boolean> {
  const address = email?.trim().toLowerCase() || null;
  if (!address && !ip) return false;
  const admin = createAdminClient();
  const [{ data: bannedEmail }, { data: bannedIp }] = await Promise.all([
    address
      ? admin.from("banned_emails").select("email").eq("email", address).maybeSingle()
      : Promise.resolve({ data: null as { email: string } | null }),
    ip
      ? admin.from("banned_ips").select("ip").eq("ip", ip).maybeSingle()
      : Promise.resolve({ data: null as { ip: string } | null }),
  ]);
  return !!bannedEmail || !!bannedIp;
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
  if (await isOnBanList(email, ctx.signupIp)) return fail("validation", BANNED_SIGNUP);

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
/*  After an OAuth sign-in (Google, Apple)                             */
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
  /**
   * The person's name as their provider gave it, when it doesn't arrive with
   * the account itself. Sign in with Apple in the app is that case: Apple sends
   * the name once, on the first sign-in, in the credential and not in the ID
   * token, so the app passes it along. The website's Apple sign-in doesn't
   * need it: Supabase reads the name from Apple's reply into the account, and
   * handle_new_user copies it to the profile.
   */
  fullName?: string | null;
  /**
   * What Sign in with Apple hands out for revoking the account later (see
   * src/lib/app/apple-sign-in.ts): the refresh token Supabase passed back on
   * the website, or the app's one-time authorization code. Ignored for an
   * account without an Apple identity.
   */
  apple?: { refreshToken?: string | null; authorizationCode?: string | null };
};

/** The account as both doors have it: Supabase's verified user. */
type OAuthUser = Pick<User, "id" | "created_at"> & Partial<Pick<User, "identities" | "email">>;

export type OAuthSignInOutcome = {
  isNewAccount: boolean;
  /**
   * The new account's email or signup IP is on the ban list, so the account
   * has just been deleted. The door signs out and shows BANNED_SIGNUP.
   */
  banned?: true;
};

/**
 * The work that runs once an OAuth provider has signed someone in, for the
 * website's /auth/callback (after it trades the code for a session) and the
 * app's POST /api/app/auth/oauth-complete (after the app's own Google or Apple
 * sign-in).
 *
 * Only a brand-new account (isFreshSignup, the one definition of "new" in this
 * codebase) is attributed: someone signing back in keeps the source they first
 * arrived with, and attributeSignup also refuses to overwrite a source that is
 * already set. Google and Apple have already verified the address, so a
 * referral reward is paid straight away; payReferralReward pays at most once
 * per account, so calling this on every sign-in is safe.
 *
 * For an account with an Apple identity it also keeps what's needed to revoke
 * its Apple tokens when the account is deleted, and saves the name Apple sent
 * if the profile has none yet.
 *
 * THE BAN LIST. A brand-new account gets the sign-up form's ban check (its
 * email, and the IP it signed up from). Google and Apple make the account
 * before LearnFRC hears about it, so on a hit the account is deleted on the
 * spot and the answer says `banned`: the door signs out and shows
 * BANNED_SIGNUP. Apple's Hide My Email address is the same every time for one
 * Apple ID and one app, so a banned Apple account matches too. The database
 * hook in supabase/migrations/20261108140000_ban_list_signup_hook.sql refuses
 * a banned email before the account exists, at every door, once it's
 * switched on; this check covers the IP and the time until then.
 *
 * Otherwise never fails. Analytics must never block a sign-in, so an
 * attribution error is logged loudly (a silent failure here is how the last
 * gap went unnoticed for three weeks) and the answer still comes back.
 */
export async function completeOAuthSignIn(
  user: OAuthUser | null | undefined,
  ctx: OAuthSignInContext
): Promise<OAuthSignInOutcome> {
  const isNewAccount = isFreshSignup(user?.created_at);

  if (user && isNewAccount && (await isOnBanList(user.email, ctx.signupIp))) {
    await removeBannedSignup(user, ctx);
    return { isNewAccount: false, banned: true };
  }

  if (user && isNewAccount) {
    try {
      const { referredBy } = await attributeSignup({
        userId: user.id,
        ref: ctx.ref,
        via: ctx.via,
        srcCookie: ctx.srcCookie,
        signupIp: ctx.signupIp,
      });
      // The provider has already verified the address, so the reward is safe
      // to pay now. Waiting on a confirmation click would wait forever: this
      // flow never produces one.
      if (referredBy) await payReferralReward(user.id);
    } catch (e) {
      console.error(`${ctx.door} attribution failed:`, e);
    }
  }

  if (user && appleIdentity(user)) {
    await saveProviderName(user.id, ctx.fullName, ctx.door);
    const refreshToken = ctx.apple?.refreshToken;
    if (refreshToken) await keepAppleRefreshToken(user, refreshToken);
    const code = ctx.apple?.authorizationCode;
    // A round trip to Apple nobody should wait on: it runs after the response,
    // with the instance kept alive for it. The code is good for five minutes.
    if (code) after(() => keepAppleTokenFromCode(user, code));
  }

  return { isNewAccount };
}

/**
 * Delete an account Google or Apple just made for someone on the ban list.
 * For Apple, the token Apple handed over at this sign-in is kept first, so the
 * deletion can revoke it and LearnFRC leaves their Apple ID's list as it
 * would for any deleted account. Never throws; a failure is logged.
 */
async function removeBannedSignup(user: OAuthUser, ctx: OAuthSignInContext): Promise<void> {
  try {
    if (appleIdentity(user)) {
      const refreshToken = ctx.apple?.refreshToken;
      if (refreshToken) await keepAppleRefreshToken(user, refreshToken);
      const code = ctx.apple?.authorizationCode;
      if (code) await keepAppleTokenFromCode(user, code);
    }
    const admin = createAdminClient();
    const deleted = await deleteAccountData(
      { id: user.id, email: user.email, created_at: user.created_at },
      { supabase: admin, admin }
    );
    if (!deleted.ok)
      console.error(`${ctx.door}: a banned sign-up (${user.id.slice(0, 8)}) couldn't be deleted`);
  } catch (e) {
    console.error(`${ctx.door}: removing a banned sign-up failed:`, e);
  }
}

/** The longest name kept from a provider. */
const PROVIDER_NAME_MAX = 100;

/**
 * Save the name Sign in with Apple sent (first sign-in only) as the profile's
 * full name, the private name on certificates. Only fills an empty name, so a
 * name someone typed or edited is never overwritten, and the signup form's
 * profanity rule applies. Never fails.
 */
async function saveProviderName(
  userId: string,
  fullName: string | null | undefined,
  door: string
): Promise<void> {
  const name = (fullName ?? "").replace(/\s+/g, " ").trim().slice(0, PROVIDER_NAME_MAX).trim();
  if (!name || firstProfaneField({ full_name: name })) return;
  try {
    const { error } = await createAdminClient()
      .from("profiles")
      .update({ full_name: name })
      .eq("id", userId)
      .is("full_name", null);
    if (error) console.error(`${door}: saving the provider's name failed:`, error.message);
  } catch (e) {
    console.error(`${door}: saving the provider's name failed:`, e);
  }
}
