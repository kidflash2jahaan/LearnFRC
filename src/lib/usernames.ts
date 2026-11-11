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

/**
 * Staff words a name can't start or end with, so nobody can pass as the
 * site's staff: `admin_team`, `mod1`, `support_sam` and `lf_admin` are all
 * refused, while `admins_fan`, `modular` and `stafford` are fine. A word at
 * the start counts when it's followed by `_`, a digit or nothing; at the end,
 * when `_` comes before it. Mirrored in the migration's `username_is_reserved`.
 */
export const RESERVED_STAFF_WORDS: readonly string[] = [
  "admin",
  "administrator",
  "mod",
  "moderator",
  "staff",
  "official",
  "support",
  "safety",
  "security",
];

const RESERVED = new Set(RESERVED_USERNAMES);
const STAFF_AT_START = RESERVED_STAFF_WORDS.map((w) => new RegExp(`^${w}([_0-9]|$)`));
const STAFF_AT_END = RESERVED_STAFF_WORDS.map((w) => `_${w}`);

/** True for a reserved name, prefix or staff word. Expects a normalized username. */
export function isReservedUsername(u: string): boolean {
  return (
    RESERVED.has(u) ||
    RESERVED_USERNAME_PREFIXES.some((p) => u.startsWith(p)) ||
    STAFF_AT_START.some((re) => re.test(u)) ||
    STAFF_AT_END.some((end) => u.endsWith(end))
  );
}

/**
 * The words the database's `generate_username` builds handles from, each
 * followed by `_` and four digits. Mirrored in the migration (a test checks
 * both lists match) and used only by tests here: handles are made in SQL.
 * Plain robot parts only: no word that's also slang or a brand.
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
  "spline",
  "caster",
  "collar",
  "spacer",
  "turret",
  "hopper",
  "climber",
  "solder",
];

/**
 * A generated handle's four digits (1000 to 9999) never contain one of these:
 * sexual and hate number codes (88 also covers 1488 and 8814). The profanity
 * filter ignores digits, so this list is the only thing that keeps them off a
 * handle the site hands a 13 year old. Mirrored in the migration's
 * `username_number_denied` (a test checks both lists match).
 */
export const GENERATED_USERNAME_DENIED_DIGITS: readonly string[] = [
  "69",
  "88",
  "420",
  "666",
  "1312",
  "8008",
];

/** True when a generated handle may not use this number. */
export function generatedNumberDenied(n: number | string): boolean {
  const digits = String(n);
  return GENERATED_USERNAME_DENIED_DIGITS.some((d) => digits.includes(d));
}

/** The sentences a refused username gets, on the site and through the app's routes. */
export const USERNAME_SENTENCES = {
  blank: "Choose a username: at least 3 characters (letters, numbers, _).",
  tooShort: "Username must be at least 3 characters (a–z, 0–9, _).",
  tooLong: "Usernames can be up to 20 characters.",
  reserved: "That username isn't available. Please choose another.",
  /**
   * Everyone in a live class sees each other's username, so a new one can't
   * be a standing way to reach someone ("snapchat_maya", seven or more digits
   * in a row).
   */
  contact:
    "Usernames can't include contact details like app names or long numbers. Please choose another.",
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
 * Everything about a submitted username that needs no database: the shape
 * rules (chosenUsernameShapeError) and, for a changed name, contact details.
 * `hasContact` is usernameHasContact from src/lib/classes/contact-patterns.ts,
 * passed in so this file stays import-free for the client components that
 * load it. Keeping the name you already have skips the contact check: the few
 * older names it would catch keep working until they're changed, and live
 * classes refuse them at enrolling and joining anyway.
 */
export function chosenUsernameError(
  normalized: string,
  currentUsername: string | null | undefined,
  hasContact: (username: string) => boolean
): string | null {
  const shape = chosenUsernameShapeError(normalized, currentUsername);
  if (shape) return shape;
  if (normalized !== currentUsername && hasContact(normalized)) return USERNAME_SENTENCES.contact;
  return null;
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

/**
 * The username live classes may show to classmates, a teacher and a parent's
 * consent email: one the person chose or knowingly kept. Null for a generated
 * handle still waiting on the username step, or a missing one, so a class gate
 * sends the person to the step first (`needs_handle`) rather than showing a
 * name they've never seen.
 *
 * Fails closed: a row read without `username_generated` counts as not ready,
 * so a gate that forgets to select the column blocks everyone instead of
 * waving generated handles through. Class gates must use this, never a bare
 * `!username`, which no account matches since every one has a username.
 */
export function handleReadyForClasses(
  p: { username?: string | null; username_generated?: boolean | null } | null | undefined
): string | null {
  if (!p || p.username_generated !== false) return null;
  return p.username?.trim() || null;
}

/** The one place the username step lives. */
export const USERNAME_STEP_PATH = "/account/username";

/** The username step, coming back to `next` (a same-site path) afterwards. */
export function usernameStepHref(next: string): string {
  return `${USERNAME_STEP_PATH}?next=${encodeURIComponent(next)}`;
}
