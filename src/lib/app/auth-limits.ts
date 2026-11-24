import "server-only";
import { rateLimit, refundRateLimit } from "@/lib/rate-limit";
import { fail, type Failure } from "@/lib/app/result";

/**
 * Rate limits for signing in, signing up and resending the confirmation
 * email, in one place so the website and the app can't drift. The website's
 * actions (src/app/actions/auth.ts) and the app's /api/app/auth routes reach
 * them through passwordSignIn and registerAccount (src/lib/app/accounts.ts).
 *
 * They only cover the site's own doors. The app signs in with an email (and
 * with Google or Apple, resends and token refreshes) straight against
 * Supabase from the device, and anyone can do the same with the public key,
 * so none of these limits apply there. That path's only limit is Supabase's
 * own per-IP one (rate_limit_token_refresh).
 *
 * Two kinds of limit:
 *   - network: the visitor's public IP, from the header Vercel sets itself
 *     (it overwrites anything the visitor sends, so it can't be faked). A
 *     whole school shares one IP, so these fit a few classes (about 100
 *     people) signing in or up within a few minutes.
 *   - account on one network: failed sign-ins for one email from one IP. A
 *     successful one gives its try back (forgiveSignIn). It slows down
 *     someone guessing with only a username, which Supabase won't take.
 *
 * There's deliberately no limit on the account from every network together.
 * Usernames are public (the leaderboard), so anyone could keep that one full
 * from anywhere and lock the owner out for as long as they liked. The lockout
 * that's left: someone on the SAME network (one school's Wi-Fi) who knows the
 * username or email can keep that account's password sign-in blocked on the
 * website and the app's username sign-in, from that network only, for as long
 * as they keep sending about 2 wrong passwords a minute. Other networks, the
 * app's email sign-in, Google and Apple still work.
 *
 * Each check counts one try, and a blocked try isn't counted. The window
 * slides: a try stops counting `seconds` after it was made. Supabase Auth has
 * its own limits on top of these, and it sees Vercel's IP, shared by every
 * school, for every sign-in, sign-up and email confirmation made on the site.
 *
 * Email budget: nothing here makes room for email. An email sign-up costs two
 * emails (Supabase's confirmation, sent through Resend, then the welcome email
 * from /auth/confirm) and a resend costs one. Resend is on Pro (Nov 24):
 * 50,000 a month, no daily cap, $0.90 per extra 1,000. Supabase's
 * rate_limit_email_sent (500 an hour, whole site) is the cap that bites
 * first, and it also bounds what abuse can cost.
 */
export const AUTH_LIMITS = {
  // sign in, per network: a few classes at once
  signInNetwork: { max: 300, seconds: 300 },
  // sign in, per network over an hour, so one IP can't spray guesses all day
  signInNetworkHour: { max: 1000, seconds: 3600 },
  // failed sign-ins, per account from one network: plenty for typos, too few for guessing
  signInAccount: { max: 10, seconds: 300 },
  // sign up, per network, failed tries included (a taken username, say)
  signUpNetwork: { max: 300, seconds: 3600 },
  // confirmation email resends, per network: room for a class whose school
  // mail is slow, still well under Supabase's 500 emails an hour
  resendNetwork: { max: 30, seconds: 3600 },
  // confirmation email resends, per address
  resendEmail: { max: 3, seconds: 3600 },
} as const;

type Limit = { max: number; seconds: number };

const SIGN_IN_BUSY = "Too many sign-in attempts. Wait a few minutes and try again.";
const ACCOUNT_BUSY = "Too many tries for this account. Wait a few minutes and try again.";
const SIGN_UP_BUSY = "Too many sign-ups from this network. Try again in a bit.";
const RESEND_BUSY =
  "That's a lot of resends. Check spam and any Promotions tab, then try again in an hour.";

// Supabase Auth's own 429s
const SUPABASE_BUSY = "Too many attempts. Wait a minute and try again.";
const SUPABASE_EMAIL_BUSY =
  "LearnFRC can't send any more emails right now. Try again in an hour, or continue with Google.";

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

/** The account limit's key: the email, so the username and the email share one budget. */
function accountKey(email: string): string {
  return email.trim().toLowerCase().slice(0, 254);
}

/** Sign-in limits for this network. Checked before the username lookup. */
export async function checkSignInNetwork(): Promise<Failure | null> {
  const L = AUTH_LIMITS;
  return (
    (await perNetwork("sign-in", L.signInNetwork, SIGN_IN_BUSY)) ??
    (await perNetwork("sign-in-hour", L.signInNetworkHour, SIGN_IN_BUSY))
  );
}

/** The account limit on this network. Counts the try; forgiveSignIn gives it back. */
export async function checkSignInAccount(email: string): Promise<Failure | null> {
  return perNetwork("sign-in-account", AUTH_LIMITS.signInAccount, ACCOUNT_BUSY, accountKey(email));
}

/** After a successful sign-in: its try comes off the account limit, so only failed ones count. */
export async function forgiveSignIn(email: string): Promise<void> {
  await refundRateLimit("sign-in-account", accountKey(email));
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

/**
 * A 429 from Supabase Auth itself, worded for people, with how long to wait.
 * Its request limits (per IP, refilled every few seconds) get a minute. Its
 * email limit has two cases: one address asked again too soon (Supabase says
 * how many seconds), or the site's hourly email budget is spent, which only
 * frees up when Supabase's hour turns over.
 */
export function supabaseBusy(error: { code?: string; message: string }): Failure {
  if (error.code === "over_email_send_rate_limit") {
    // "For security purposes, you can only request this after 42 seconds."
    const soon = /after (\d+) seconds?/i.exec(error.message);
    if (soon) {
      const seconds = Number(soon[1]);
      return fail(
        "rate_limited",
        `We just sent an email to that address. Try again in ${seconds} seconds.`,
        seconds
      );
    }
    return fail("rate_limited", SUPABASE_EMAIL_BUSY, 3600);
  }
  return fail("rate_limited", SUPABASE_BUSY, 60);
}
