/**
 * Post-signup profile completion.
 *
 * WHY THIS EXISTS: Google sign-in (shipped 2026-07-23) never shows the signup
 * form, so `handle_new_user` inserts the profile with `username = null` and
 * `team_number = null` — Google only supplies name/email/avatar. Measured
 * 2026-08-10 across all 347 accounts:
 *
 *   Google: 40 accounts — 8 with no username at all, 22 carrying a placeholder
 *           handle, and 28 (70%) with NO team number.
 *   Email:  307 accounts — 0 placeholders, 83 (27%) with no team number.
 *
 * Google is now 31 of the last 57 signups (54%), so the majority of new
 * accounts were landing with no team number. `team_number` is what powers the
 * team clustering that 83% of new signups rely on to find their teammates, so
 * an account without one is invisible to that whole motion.
 *
 * Keep this module CLIENT-SAFE — the prompt's form imports its types. Anything
 * needing `cookies()` or other request APIs belongs in `onboarding-server.ts`.
 */

/**
 * The 22 placeholder handles were written by a one-off backfill on 2026-08-04
 * (every row shares the same `updated_at` to the microsecond); the generator
 * is not in the codebase, so the words themselves are the only record of it.
 * Both lists are the EXACT distinct token sets recovered from those rows, not
 * a guess — matching on the shape `word_word_NN` alone would sweep up real
 * handles that people deliberately chose.
 */
const PLACEHOLDER_ADJECTIVES = new Set([
  "atomic",
  "blazing",
  "cosmic",
  "crimson",
  "delta",
  "iron",
  "lucky",
  "neon",
  "quantum",
  "silent",
  "solid",
  "swift",
  "turbo",
]);

const PLACEHOLDER_NOUNS = new Set([
  "builder",
  "driver",
  "fabricator",
  "gearhead",
  "machinist",
  "navigator",
  "operator",
  "roboteer",
  "rookie",
  "scout",
  "strategist",
]);

/**
 * True for a machine-minted handle like `neon_roboteer_85` — a name the user
 * never chose and which reads as generated, which is precisely the impression
 * the site cannot afford to give. Deliberately conservative: both halves must
 * come from the known generator vocabulary AND end in exactly two digits.
 */
export function isPlaceholderUsername(
  username: string | null | undefined
): boolean {
  if (!username) return false;
  const m = /^([a-z]+)_([a-z]+)_(\d{2})$/.exec(username);
  return (
    !!m && PLACEHOLDER_ADJECTIVES.has(m[1]) && PLACEHOLDER_NOUNS.has(m[2])
  );
}

/** Cookie recording that the learner dismissed the prompt. */
export const SETUP_SKIP_COOKIE = "lf_setup_skipped";

/**
 * Skipping hides the prompt for two weeks rather than forever. The ask is
 * genuinely optional, so it must never become nagging — but a permanent
 * dismissal would strand the account outside team clustering for good.
 */
export const SETUP_SKIP_MAX_AGE = 60 * 60 * 24 * 14;

export type ProfileSetupMode = "username" | "team";

export type ProfileSetupState =
  | { show: false; mode: null }
  | { show: true; mode: ProfileSetupMode };

/**
 * A starting point for the username field, derived from the Google account so
 * the field is never an empty box. Runs the same normalisation the server
 * enforces; returns undefined when nothing usable survives it (the server is
 * still the authority — this is only a prefill).
 */
export function suggestUsername(
  email: string | null | undefined
): string | undefined {
  const base = (email ?? "")
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
  return base.length >= 3 ? base : undefined;
}
