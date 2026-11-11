/**
 * Username rules shared by the website, the app's /api/app/* routes and the
 * database migration that guarantees every account has one
 * (supabase/migrations/20261111120000_usernames_always_set.sql).
 *
 * Client-safe and import-free, so client components, server code and the
 * node test runner can all load it.
 *
 * Since 2026-11-11 the database never leaves a profile without a username: a
 * trigger gives an account that arrives without one (Google or Apple sign-in,
 * a direct Supabase Auth call) a neutral generated handle like `gearbox_4821`,
 * and sets `profiles.username_generated`. That flag is what asks the person,
 * once, to keep the handle or pick their own (`needsUsernameStep`).
 */

export const USERNAME_MIN = 3;
/** New choices only. A few older usernames are longer and keep working. */
export const USERNAME_MAX = 20;

/** Username rule shared by signup, settings and setup: a-z, 0-9 and _ only. */
export function normalizeUsername(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

/**
 * Names nobody can choose, mirrored in the migration's
 * `username_is_reserved` (a test checks both lists match). The two hook
 * tokens are the `?ref=` values the lesson and article sign-up links carry,
 * so a member named one of them could never be credited as a referrer.
 */
export const RESERVED_USERNAMES: readonly string[] = [
  "lessonhook",
  "articlehook",
  "admin",
  "administrator",
  "mod",
  "moderator",
  "staff",
  "support",
  "help",
  "official",
  "system",
  "safety",
  "security",
  "owner",
  "root",
  "member",
  "someone",
  "nobody",
  "unknown",
  "anonymous",
  "deleted",
  "null",
  "undefined",
  "teacher",
  "student",
  "parent",
  "guardian",
];

/** Anything starting with these reads as the site itself. */
export const RESERVED_USERNAME_PREFIXES: readonly string[] = ["learner", "learnfrc"];

const RESERVED = new Set(RESERVED_USERNAMES);

/** True for a reserved name or prefix. Expects a normalized username. */
export function isReservedUsername(u: string): boolean {
  return RESERVED.has(u) || RESERVED_USERNAME_PREFIXES.some((p) => u.startsWith(p));
}

/**
 * The words the database's `generate_username` builds handles from, each
 * followed by `_` and four digits. Mirrored in the migration (a test checks
 * both lists match) and used only by tests here: handles are made in SQL.
 */
export const GENERATED_USERNAME_WORDS: readonly string[] = [
  "gearbox",
  "bumper",
  "encoder",
  "chassis",
  "gyro",
  "servo",
  "sprocket",
  "pulley",
  "axle",
  "winch",
  "rivet",
  "gusset",
  "bracket",
  "flywheel",
  "intake",
  "roller",
  "ratchet",
  "spline",
  "caster",
  "hinge",
  "collar",
  "spacer",
  "turret",
  "hopper",
  "climber",
  "solder",
];

/** The sentences a refused username gets, on the site and through the app's routes. */
export const USERNAME_SENTENCES = {
  blank: "Choose a username: at least 3 characters (letters, numbers, _).",
  tooShort: "Username must be at least 3 characters (a–z, 0–9, _).",
  tooLong: "Usernames can be up to 20 characters.",
  reserved: "That username isn't available. Please choose another.",
} as const;

/**
 * Why a new username can't be used, or null when its shape is fine. Expects a
 * normalized username. Taken and profanity checks happen on the server
 * (`validateChosenUsername` in src/lib/app/profile.ts).
 */
export function usernameShapeError(u: string): string | null {
  if (!u) return USERNAME_SENTENCES.blank;
  if (u.length < USERNAME_MIN) return USERNAME_SENTENCES.tooShort;
  if (u.length > USERNAME_MAX) return USERNAME_SENTENCES.tooLong;
  if (isReservedUsername(u)) return USERNAME_SENTENCES.reserved;
  return null;
}

/**
 * The shape check for a username someone submits for their own account.
 * Blank is always refused. Keeping the name they already have is always fine,
 * so the few older names over 20 characters, or on today's reserved list,
 * can still save their other Settings fields. A changed name gets the full
 * `usernameShapeError`.
 */
export function chosenUsernameShapeError(
  normalized: string,
  currentUsername: string | null | undefined
): string | null {
  if (!normalized) return USERNAME_SENTENCES.blank;
  if (currentUsername && normalized === currentUsername) return null;
  return usernameShapeError(normalized);
}

/**
 * Does this account still have to choose or keep its username? True for a
 * handle the database generated (`username_generated`), and for a missing one
 * (which the database no longer allows, but an old row read mid-deploy could
 * still show).
 */
export function needsUsernameStep(
  p: { username?: string | null; username_generated?: boolean | null } | null | undefined
): boolean {
  return !!p && (!p.username || p.username_generated === true);
}

/** The one place the username step lives. */
export const USERNAME_STEP_PATH = "/account/username";

/** The username step, coming back to `next` (a same-site path) afterwards. */
export function usernameStepHref(next: string): string {
  return `${USERNAME_STEP_PATH}?next=${encodeURIComponent(next)}`;
}
