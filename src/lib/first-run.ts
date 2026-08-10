/**
 * POST-AUTH ROUTING — where a just-authenticated browser is sent.
 *
 * WHY THIS MODULE EXISTS. The whole first-run build (`/start`, the goal picker,
 * the five-lesson plan) shipped with no entry point: every auth path landed on
 * `/dashboard`, so the route was reachable only by typing it. This is the one
 * place that decides otherwise, shared by BOTH auth routes so the Google path
 * and the email path cannot drift — the last time those two files disagreed
 * about what a fresh signup was, referrals were silently dead for 24 days.
 *
 * THE TWO RULES, kept deliberately small:
 *
 *  1. "New" means the account was created moments ago. That is the rule
 *     `/auth/callback` already used to gate signup attribution, lifted here
 *     verbatim rather than replaced — there is exactly one definition of a
 *     fresh signup in this codebase and `isFreshSignup` is it.
 *
 *  2. Only the DEFAULT destination is overridden. Both auth routes resolve
 *     `?next=` to `/dashboard` when it is absent or unsafe, and every caller
 *     that means something specific — a team invite (`/join/space?t=…`), a
 *     password reset (`/account/password`), a tool or lesson a signed-out
 *     visitor was reading — passes that path explicitly. Swapping only the
 *     literal `/dashboard` therefore cannot eat an invite: the invite carries
 *     its own path and comes back out untouched.
 *
 * WHAT IT IS NOT. This is not a gate. Nothing redirects INTO `/start` except
 * these two one-shot post-auth hops, `/start` itself always renders a way out,
 * and no page redirects back to it — so there is no cycle to get caught in.
 */

/** The generic signed-in landing page — the destination this module replaces. */
export const DEFAULT_SIGNED_IN_PATH = "/dashboard";

/** The first-run route. */
export const FIRST_RUN_PATH = "/start";

/**
 * OAuth returns within seconds of account creation, so a tight window is both
 * sufficient and safe. Shared with signup attribution in `/auth/callback`,
 * which has used this exact value since 2026-08-10 — changing it changes who
 * gets attributed, so it stays 5 minutes.
 */
export const FRESH_SIGNUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * The email path inserts a human between account creation and the redirect:
 * the account exists the moment the form is submitted, but the confirmation
 * link is clicked whenever the inbox is next read. Same rule (account created
 * recently, never used), longer allowance — a 5-minute window would send most
 * email signups to the dashboard purely because they read their mail slowly.
 *
 * Safe to be generous because the caller additionally requires a `signup`
 * token, which exists exactly once per account and is consumed on use.
 */
export const CONFIRMED_SIGNUP_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Was this account created inside `windowMs`?
 *
 * Tolerant of every shape Supabase can hand back (`undefined`, an unparseable
 * string, a clock-skewed future timestamp) and answers `false` for all of them
 * — the failure mode is "returning user goes to the dashboard", which is
 * exactly today's behaviour, never a misrouted veteran.
 */
export function isFreshSignup(
  createdAt: string | null | undefined,
  windowMs: number = FRESH_SIGNUP_WINDOW_MS
): boolean {
  if (!createdAt) return false;
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return false;
  const age = Date.now() - created;
  // Negative age = clock skew between Supabase and this server; treat a
  // just-in-the-future timestamp as fresh rather than as a returning user.
  return age < windowMs && age > -windowMs;
}

/**
 * The final redirect target for a just-authenticated user.
 *
 * `next` is the ALREADY-SANITISED destination the auth route resolved (each
 * route validates it is a same-origin relative path first — this function does
 * no validation of its own and must never be handed raw user input).
 */
export function postAuthDestination(next: string, isNewUser: boolean): string {
  return isNewUser && next === DEFAULT_SIGNED_IN_PATH ? FIRST_RUN_PATH : next;
}
