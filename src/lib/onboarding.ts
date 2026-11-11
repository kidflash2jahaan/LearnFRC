/**
 * Post-signup profile completion.
 *
 * WHY THIS EXISTS: Google sign-in (shipped 2026-07-23) never shows the signup
 * form, so Google supplies only a name, email and avatar. Measured 2026-08-10
 * across all 347 accounts, 28 of 40 Google accounts (70%) had no team number,
 * against 27% of email accounts. `team_number` is what powers the team
 * clustering most new signups rely on to find their teammates, so an account
 * without one is invisible to that whole motion.
 *
 * Usernames are no longer this module's business. Since 2026-11-11 the
 * database gives every account a username (a generated one when it arrives
 * without), and the one-time "keep it or pick your own" step lives at
 * /account/username, driven by `needsUsernameStep` in src/lib/usernames.ts.
 * What's left here is the skippable team-number ask.
 *
 * Keep this module CLIENT-SAFE: the prompt's form imports its types. Anything
 * needing `cookies()` or other request APIs belongs in `onboarding-server.ts`.
 */

/** Cookie recording that the learner dismissed the prompt. */
export const SETUP_SKIP_COOKIE = "lf_setup_skipped";

/**
 * Skipping hides the prompt for two weeks rather than forever. The ask is
 * genuinely optional, so it must never become nagging, but a permanent
 * dismissal would strand the account outside team clustering for good.
 */
export const SETUP_SKIP_MAX_AGE = 60 * 60 * 24 * 14;

/**
 * What the setup form asks for. `choose` is the username step on
 * /account/username (required, with the optional team number); `team` is the
 * skippable team-number card on the dashboard.
 */
export type ProfileSetupMode = "choose" | "team";

export type ProfileSetupState =
  | { show: false; mode: null }
  | { show: true; mode: "team" };
