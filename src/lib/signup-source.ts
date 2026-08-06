/**
 * Conversion-hook `?ref=` values used by the in-lesson and in-article signup
 * hooks. These name the surface that drove the signup — they are NOT referral
 * usernames. The signup action records the label below as a last-touch
 * `profiles.source`, so hook conversions show up in the admin source breakdown
 * (alongside "Google", "Reddit", "Referral", …) without disturbing first-touch
 * attribution or the friend-referral system.
 *
 * Keyed by the ref value after the same `[^a-z0-9_]` sanitisation the signup
 * form and action apply, so "lesson-hook" and "lessonhook" both resolve.
 */
const HOOK_SOURCES: Record<string, string> = {
  lessonhook: "Lesson hook",
  articlehook: "Article hook",
};

/**
 * Resolve a raw or sanitised `?ref=` value to its hook source label, or null
 * when it is not a known conversion hook (i.e. treat it as a referral username).
 */
export function hookSourceFor(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const key = ref.toLowerCase().replace(/[^a-z0-9_]/g, "");
  return HOOK_SOURCES[key] ?? null;
}
