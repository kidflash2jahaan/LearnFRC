import "server-only";
import { createPrivateKey, sign } from "node:crypto";
import type { User, UserIdentity } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sign in with Apple's server half, shared by the website and the app.
 *
 * Supabase's Apple provider does the signing in: the website's OAuth redirect
 * (src/components/auth/apple-button.tsx, then /auth/callback) and the app's
 * native sign-in (an Apple ID token handed to Supabase's signInWithIdToken).
 * What Supabase doesn't do is the thing Apple requires of any app that lets
 * people delete their account: revoke that person's Apple tokens through
 * Apple's REST API (App Store guideline 5.1.1(v)), so LearnFRC disappears from
 * "Sign in with Apple" in their Apple ID settings.
 *
 * Revoking needs a token, and Apple only hands one out at sign-in, so this
 * file keeps a refresh token per account and Apple client:
 *
 *  - Website. Supabase passes Apple's refresh token back from its own token
 *    exchange as `session.provider_refresh_token`, which /auth/callback hands
 *    to completeOAuthSignIn. Client id: the Services ID (APPLE_SERVICES_ID).
 *  - App. The app sends the one-time authorization code from its
 *    ASAuthorizationAppleIDCredential to POST /api/app/auth/oauth-complete,
 *    and it's traded here for a refresh token. Client id: the app's bundle id
 *    (APPLE_APP_BUNDLE_ID).
 *
 * deleteAccountData (src/lib/app/profile.ts), which the website's Settings and
 * the app's DELETE /api/app/account both call, runs revokeAppleSignIn first.
 *
 * Tokens live in `apple_sign_in_tokens` (service role only, RLS on with no
 * policies, rows cascade with the auth user). Every function here is best
 * effort and never throws: Apple trouble must never block a sign-in, and must
 * never trap someone in an account they asked to delete. Failures are logged
 * loudly instead, because nobody else will ever see them.
 *
 * Nothing here runs for an account without an Apple identity, so it's inert
 * until Sign in with Apple is switched on.
 */

const APPLE_ISSUER = "https://appleid.apple.com";
const TOKEN_URL = "https://appleid.apple.com/auth/token";
const REVOKE_URL = "https://appleid.apple.com/auth/revoke";
const TABLE = "apple_sign_in_tokens";

/* ------------------------------------------------------------------ */
/*  Keys and clients                                                   */
/* ------------------------------------------------------------------ */

type AppleKeys = { teamId: string; keyId: string; privateKey: string };

/**
 * The Sign in with Apple key (a .p8 from the Apple Developer account), or null
 * while it isn't configured. The private key is the whole PEM; Vercel stores a
 * multi-line value fine, and a value pasted with literal "\n"s works too.
 */
function appleKeys(): AppleKeys | null {
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const keyId = process.env.APPLE_SIGNIN_KEY_ID?.trim();
  const raw = process.env.APPLE_SIGNIN_PRIVATE_KEY;
  if (!teamId || !keyId || !raw?.trim()) return null;
  return { teamId, keyId, privateKey: raw.replace(/\\n/g, "\n").trim() };
}

/** The website's Apple client: the Services ID Supabase's Apple provider uses. */
function webClientId(): string | null {
  return process.env.APPLE_SERVICES_ID?.trim() || null;
}

/** The app's Apple client: its bundle id. */
function appClientId(): string {
  return process.env.APPLE_APP_BUNDLE_ID?.trim() || "com.learnfrc.app";
}

/**
 * The client secret Apple's token and revoke endpoints take: a short-lived
 * ES256 JWT signed with the Sign in with Apple key, naming the client (`sub`)
 * the token was issued to. Made fresh for each call, so nothing here expires
 * (the long-lived secret in Supabase's Apple provider settings is separate and
 * does, every six months).
 */
function clientSecret(clientId: string, keys: AppleKeys): string {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const input = `${encode({ alg: "ES256", kid: keys.keyId })}.${encode({
    iss: keys.teamId,
    iat: now,
    exp: now + 300,
    aud: APPLE_ISSUER,
    sub: clientId,
  })}`;
  const signature = sign("sha256", Buffer.from(input), {
    key: createPrivateKey(keys.privateKey),
    dsaEncoding: "ieee-p1363",
  });
  return `${input}.${signature.toString("base64url")}`;
}

async function postForm(url: string, form: Record<string, string>): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
}

/** Apple's `error` from a failed call, for the log. Never includes a token. */
async function appleError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    return `${res.status} ${typeof body.error === "string" ? body.error : ""}`.trim();
  } catch {
    return String(res.status);
  }
}

/* ------------------------------------------------------------------ */
/*  Who has Apple                                                      */
/* ------------------------------------------------------------------ */

/** The account's Apple identity, or null. */
export function appleIdentity(
  user: Partial<Pick<User, "identities">> | null | undefined
): UserIdentity | null {
  return user?.identities?.find((i) => i.provider === "apple") ?? null;
}

/** Apple's stable user id (`sub`) for an Apple identity. */
function appleSubject(identity: UserIdentity): string | null {
  const sub = identity.identity_data?.sub;
  return typeof sub === "string" && sub ? sub : identity.id || null;
}

/**
 * The `sub` claim of an ID token that came straight back from Apple's token
 * endpoint over TLS. Read, not verified: it's only used to check the code
 * belonged to the same Apple ID as the account.
 */
function idTokenSubject(idToken: unknown): string | null {
  if (typeof idToken !== "string") return null;
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: unknown;
    };
    return typeof claims.sub === "string" ? claims.sub : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Keeping a token at sign-in                                         */
/* ------------------------------------------------------------------ */

async function saveRefreshToken(
  userId: string,
  clientId: string,
  refreshToken: string
): Promise<void> {
  const { error } = await createAdminClient()
    .from(TABLE)
    .upsert(
      {
        user_id: userId,
        client_id: clientId,
        refresh_token: refreshToken,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,client_id" }
    );
  if (error) console.error("apple sign-in: couldn't keep the refresh token:", error.message);
}

/**
 * Website: keep the refresh token Supabase passed back from Apple, so the
 * account can be revoked when it's deleted. Only for an account with an Apple
 * identity.
 */
export async function keepAppleRefreshToken(
  user: Pick<User, "id"> & Partial<Pick<User, "identities">>,
  refreshToken: string
): Promise<void> {
  try {
    if (!appleIdentity(user)) return;
    const clientId = webClientId();
    if (!clientId) {
      console.error("apple sign-in: APPLE_SERVICES_ID isn't set, so this account can't be revoked later");
      return;
    }
    await saveRefreshToken(user.id, clientId, refreshToken);
  } catch (e) {
    console.error("apple sign-in: keeping the website's token failed:", e);
  }
}

/**
 * App: trade the one-time authorization code from the app's Sign in with Apple
 * for a refresh token, and keep it. Apple's codes last five minutes and work
 * once, so this runs straight after the sign-in (POST
 * /api/app/auth/oauth-complete). The code has to belong to the same Apple ID
 * as the account's Apple identity, so nobody can attach another person's
 * Apple authorization to their own account.
 */
export async function keepAppleTokenFromCode(
  user: Pick<User, "id"> & Partial<Pick<User, "identities">>,
  authorizationCode: string
): Promise<void> {
  try {
    const identity = appleIdentity(user);
    if (!identity) return;
    const keys = appleKeys();
    if (!keys) {
      console.error("apple sign-in: the Sign in with Apple key isn't configured, so this account can't be revoked later");
      return;
    }
    const clientId = appClientId();
    const res = await postForm(TOKEN_URL, {
      client_id: clientId,
      client_secret: clientSecret(clientId, keys),
      code: authorizationCode,
      grant_type: "authorization_code",
    });
    if (!res.ok) {
      console.error("apple sign-in: Apple refused the app's authorization code:", await appleError(res));
      return;
    }
    const body = (await res.json()) as { refresh_token?: unknown; id_token?: unknown };
    const sub = idTokenSubject(body.id_token);
    if (!sub || sub !== appleSubject(identity)) {
      console.error("apple sign-in: the app's authorization code belongs to a different Apple ID; not kept");
      return;
    }
    if (typeof body.refresh_token !== "string" || !body.refresh_token) {
      console.error("apple sign-in: Apple sent no refresh token for the app's code");
      return;
    }
    await saveRefreshToken(user.id, clientId, body.refresh_token);
  } catch (e) {
    console.error("apple sign-in: trading the app's authorization code failed:", e);
  }
}

/* ------------------------------------------------------------------ */
/*  Revoking at account deletion                                       */
/* ------------------------------------------------------------------ */

async function revokeOne(clientId: string, refreshToken: string, keys: AppleKeys): Promise<boolean> {
  // One retry for a network blip or an Apple 5xx; a 4xx won't change.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await postForm(REVOKE_URL, {
        client_id: clientId,
        client_secret: clientSecret(clientId, keys),
        token: refreshToken,
        token_type_hint: "refresh_token",
      });
      if (res.ok) return true;
      const why = await appleError(res);
      if (res.status < 500) {
        console.error(`apple sign-in: Apple refused to revoke (${clientId}):`, why);
        return false;
      }
      console.error(`apple sign-in: revoke failed (${clientId}), attempt ${attempt + 1}:`, why);
    } catch (e) {
      console.error(`apple sign-in: revoke failed (${clientId}), attempt ${attempt + 1}:`, e);
    }
  }
  return false;
}

/**
 * Revoke every Apple token kept for an account, as Apple requires when an
 * account that signed in with Apple is deleted. Call it BEFORE the auth user
 * is deleted: the tokens cascade away with it, and the identity check reads
 * the auth user.
 *
 * Does nothing for an account without an Apple identity (most of them, and
 * every one until Sign in with Apple is switched on). Never throws and never
 * blocks the deletion: a person who asked to be deleted gets deleted, and a
 * failure here is logged for a manual revoke.
 */
export async function revokeAppleSignIn(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(userId);
    if (!appleIdentity(data?.user)) return;

    const { data: rows, error } = await admin
      .from(TABLE)
      .select("client_id, refresh_token")
      .eq("user_id", userId);
    if (error) {
      console.error("apple sign-in: couldn't read the account's Apple tokens:", error.message);
      return;
    }
    const tokens = (rows ?? []) as { client_id: string; refresh_token: string }[];
    if (tokens.length === 0) {
      console.error(`apple sign-in: account ${userId.slice(0, 8)} has an Apple identity but no token on file; not revoked`);
      return;
    }
    const keys = appleKeys();
    if (!keys) {
      console.error("apple sign-in: the Sign in with Apple key isn't configured; Apple tokens not revoked");
      return;
    }
    const results = await Promise.all(
      tokens.map((t) => revokeOne(t.client_id, t.refresh_token, keys))
    );
    if (results.some((revoked) => !revoked))
      console.error(`apple sign-in: account ${userId.slice(0, 8)}: not every Apple token was revoked`);
  } catch (e) {
    console.error("apple sign-in: revoking failed:", e);
  }
}
