import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";

/**
 * Local, no-API profanity check. One shared matcher built from Obscenity's
 * curated English dataset (profanity + slurs) with the recommended transformers,
 * which catch obfuscation — leetspeak (`f4ck`), spacing (`f u c k`), repeated
 * chars (`fuuuck`) — while avoiding the classic false positives ("assessment",
 * "Scunthorpe", "class"). Runs synchronously on the server at account creation
 * and profile edits, so nothing offensive is ever stored in the first place —
 * no scheduled AI pass required.
 */
const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

/** True if the text contains profanity or a slur (obfuscation-aware). */
export function isProfane(text: string | null | undefined): boolean {
  if (!text) return false;
  if (matcher.hasMatch(text)) return true;
  // Also catch separator-obfuscation the matcher misses, e.g. "f u c k",
  // "f.u.c.k", "f-u-c-k" → collapse spaces/dots/dashes/stars and re-check.
  const collapsed = text.replace(/[\s._*\-]+/g, "");
  return collapsed.length > 2 && collapsed !== text && matcher.hasMatch(collapsed);
}

/**
 * Check several user-supplied fields at once. Returns the first field name that
 * trips the filter (for a targeted error message), or null if all are clean.
 * A username is also checked with separators stripped so `f_u_c_k` can't slip
 * past by hiding behind underscores.
 */
export function firstProfaneField(
  fields: Record<string, string | null | undefined>
): string | null {
  for (const [name, value] of Object.entries(fields)) {
    if (isProfane(value)) return name;
    if (name === "username" && value && isProfane(value.replace(/[_\d]/g, ""))) {
      return name;
    }
  }
  return null;
}
