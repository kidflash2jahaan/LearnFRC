import {
  appSignupSource,
  BANNED_SIGNUP,
  completeOAuthSignIn,
  requestIp,
} from "@/lib/app/accounts";
import { apiError, badJson, guarded, ok, requireAppUser } from "@/lib/app/http";

export const dynamic = "force-dynamic";

const TEXT_KEYS = ["ref", "via", "platform", "fullName", "appleAuthorizationCode"] as const;

/** Apple's authorization codes are well under this; anything longer isn't one. */
const MAX_CODE_LENGTH = 4096;

/**
 * POST /api/app/auth/oauth-complete   (Bearer)
 *   {} or { ref?, via?, platform?, fullName?, appleAuthorizationCode? }
 *
 * The app's half of the website's /auth/callback. On the site, Google and
 * Apple land on that route, which records where a brand-new account came from
 * and pays a pending referral reward. The app's own Google and Apple sign-ins
 * never pass through it, so the app calls this straight after every OAuth
 * sign-in instead. Both doors run completeOAuthSignIn
 * (src/lib/app/accounts.ts): the same freshness test, the same attribution and
 * the same reward.
 *
 * `ref` and `via` come from the invite link the app was opened with, like the
 * site's `?ref=` and `?via=`. `platform` (`ios`, `ipados`, `macos`) records the
 * source the way POST /api/app/auth/sign-up does.
 *
 * Sign in with Apple only: `fullName` is the name Apple put in the credential
 * (first sign-in only), saved if the profile has no name yet, and
 * `appleAuthorizationCode` is the credential's one-time code, traded for the
 * refresh token account deletion revokes (src/lib/app/apple-sign-in.ts). Both
 * are ignored for an account without an Apple identity.
 *
 * All optional; no body at all is the same as {}.
 *
 * Responds { isNewAccount }. Idempotent: an account older than a few minutes
 * gets `false` and nothing is attributed, and the reward is paid at most once.
 * Attribution and Apple trouble never fail the call. The ban list does: a
 * brand-new account whose email or signup IP is banned is deleted, and the
 * answer is 403 `forbidden` with the sign-up form's sentence.
 */
export async function POST(req: Request) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;

    let body: Record<string, unknown> = {};
    const raw = await req.text();
    if (raw.trim()) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return badJson();
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return badJson();
      body = parsed as Record<string, unknown>;
    }
    for (const k of TEXT_KEYS)
      if (k in body && body[k] !== null && typeof body[k] !== "string") return badJson();
    const text = (k: (typeof TEXT_KEYS)[number]) =>
      typeof body[k] === "string" ? (body[k] as string) : null;

    const code = text("appleAuthorizationCode")?.trim() || null;
    const { isNewAccount, banned } = await completeOAuthSignIn(auth.user, {
      ref: text("ref"),
      via: text("via"),
      srcCookie: appSignupSource(text("platform") ?? ""),
      signupIp: await requestIp(),
      door: "api/app/auth/oauth-complete",
      fullName: text("fullName"),
      apple: {
        authorizationCode: code && code.length <= MAX_CODE_LENGTH ? code : null,
      },
    });
    // On the ban list: the account is already deleted. The app signs out and
    // shows the sentence; an older app gets 401 on its next call instead.
    if (banned) return apiError("forbidden", BANNED_SIGNUP);
    return ok({ isNewAccount });
  });
}
