import "server-only";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { fail, type Failure } from "@/lib/app/result";

/**
 * Rate limits for signing in, signing up and resending the confirmation
 * email, in one place so the website and the app can't drift. The website's
 * actions (src/app/actions/auth.ts) and the app's /api/app/auth routes reach
 * them through checkSignIn and registerAccount (src/lib/app/accounts.ts).
 *
 * Two kinds of limit:
 *   - network: the visitor's public IP, from the header Vercel sets itself
 *     (it overwrites anything the visitor sends, so it can't be faked). A
 *     whole school shares one IP, so these fit a few classes (about 100
 *     people) signing in or up within a few minutes.
 *   - account: one email address. These stay low, because they're what stops
 *     someone guessing a password.
 *
 * Each check counts one try, and a blocked try isn't counted. The window
 * slides: a try stops counting `seconds` after it was made. Supabase Auth has
 * its own limits on top of these.
 */
export const AUTH_LIMITS = {
  // sign in, per network: a few classes at once
  signInNetwork: { max: 300, seconds: 300 },
  // sign in, per network over an hour, so one IP can't spray guesses all day
  signInNetworkHour: { max: 1000, seconds: 3600 },
  // sign in, per account from one network: plenty for typos, too few for guessing
  signInAccount: { max: 10, seconds: 300 },
  // sign in, per account from every network together, so more IPs don't help
  signInAccountAnywhere: { max: 30, seconds: 900 },
  // sign up, per network, failed tries included (a taken username, say)
  signUpNetwork: { max: 300, seconds: 3600 },
  // confirmation email resends, per network and per address
  resendNetwork: { max: 60, seconds: 3600 },
  resendEmail: { max: 3, seconds: 3600 },
} as const;

type Limit = { max: number; seconds: number };

const SIGN_IN_BUSY = "Too many sign-in attempts. Wait a few minutes and try again.";
const SIGN_UP_BUSY = "Too many sign-ups from this network. Try again in a bit.";
const RESEND_BUSY =
  "That's a lot of resends. Check spam and any Promotions tab, then try again in an hour.";

/** What both doors say when Supabase Auth's own sign-in limit answers 429. */
export const SUPABASE_SIGN_IN_BUSY = "Too many attempts. Wait a minute and try again.";

/** One try from this network (and account, if given). Null while there's room. */
async function perNetwork(
  bucket: string,
  limit: Limit,
  message: string,
  account?: string
): Promise<Failure | null> {
  const allowed = await rateLimit(bucket, limit.max, limit.seconds, account);
  return allowed ? null : fail("rate_limited", message, limit.seconds);
}

/** One try on this account, from any network. Null while there's room. */
async function perAccount(
  bucket: string,
  limit: Limit,
  message: string,
  account: string
): Promise<Failure | null> {
  const allowed = await rateLimitKey(bucket, limit.max, limit.seconds, account);
  return allowed ? null : fail("rate_limited", message, limit.seconds);
}

/** Sign-in limits for this network. Checked before the username lookup. */
export async function checkSignInNetwork(): Promise<Failure | null> {
  const L = AUTH_LIMITS;
  return (
    (await perNetwork("sign-in", L.signInNetwork, SIGN_IN_BUSY)) ??
    (await perNetwork("sign-in-hour", L.signInNetworkHour, SIGN_IN_BUSY))
  );
}

/**
 * Sign-in limits for one account. Keyed on the account's email, so typing the
 * username or the email counts against the same budget.
 */
export async function checkSignInAccount(email: string): Promise<Failure | null> {
  const L = AUTH_LIMITS;
  const key = email.trim().toLowerCase().slice(0, 254);
  return (
    (await perNetwork("sign-in-account", L.signInAccount, SIGN_IN_BUSY, key)) ??
    (await perAccount("sign-in-account-any", L.signInAccountAnywhere, SIGN_IN_BUSY, key))
  );
}

/** The sign-up limit for this network. */
export async function checkSignUp(): Promise<Failure | null> {
  return perNetwork("sign-up", AUTH_LIMITS.signUpNetwork, SIGN_UP_BUSY);
}

/** Resend limits for this network and this address. */
export async function checkResend(email: string): Promise<Failure | null> {
  const L = AUTH_LIMITS;
  return (
    (await perNetwork("resend-confirm", L.resendNetwork, RESEND_BUSY)) ??
    (await perNetwork("resend-confirm-email", L.resendEmail, RESEND_BUSY, email))
  );
}
