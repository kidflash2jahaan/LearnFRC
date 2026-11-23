/**
 * PROFILE PICTURES ARE INITIALS ONLY (owner, 2026-11-23).
 *
 * Google sign-in used to copy the account's Google photo into
 * `profiles.avatar_url` (the handle_new_user trigger). On Nov 23, 390 of 965
 * profiles had one: 375 Google photos their owners never chose to make public,
 * and 15 links to other sites typed into Settings. So:
 *
 *   - Nothing reads the column for display. The site's Avatar
 *     (src/components/ui/avatar.tsx) draws initials and nothing else.
 *   - Every /api/app response keeps its `avatarUrl` field, because installed
 *     copies of the app decode it, and sends NO_AVATAR_URL. The app already
 *     draws initials when it's null.
 *   - Settings can't save a link any more, but it can delete the stored one
 *     (photoLinkEdit below): the website's Settings shows a delete box while
 *     one is stored, and PATCH /api/app/profile deletes it on a null or blank
 *     `avatarUrl`.
 *   - New sign-ups don't get one
 *     (supabase/migrations/20261123120000_no_google_avatar_copy.sql).
 *
 * Stored values stay until their owner deletes them (or the account).
 *
 * Pure and client-safe. avatar.test.ts checks the rule holds across src/.
 */

/** The avatar URL every page and /api/app response shows: none. */
export const NO_AVATAR_URL = null;

/**
 * What a photo link sent with a Settings save does to the stored one:
 *
 *   - not sent: nothing.
 *   - null or blank: deletes the stored link. The website's delete box sends
 *     blank; so does an installed app whose Avatar image URL field is cleared.
 *   - the stored link, sent back unchanged: nothing. An installed app fills
 *     that field from its cached /me, and once /me says null the stale link
 *     rides along with an unrelated edit; refusing it would block that edit.
 *   - anything else: refused with PHOTO_LINK_REFUSED, so a link someone typed
 *     isn't dropped while the app says "Profile saved".
 */
export type PhotoLinkEdit = "keep" | "delete" | "refuse";

export function photoLinkEdit(
  sent: string | null | undefined,
  stored: string | null
): PhotoLinkEdit {
  if (sent === undefined) return "keep";
  const link = (sent ?? "").trim();
  if (!link) return "delete";
  if (link === (stored ?? "").trim()) return "keep";
  return "refuse";
}

/** The 400 for a new photo link. Names the installed app's field. */
export const PHOTO_LINK_REFUSED =
  "Profile pictures are initials only now, so LearnFRC can't save an avatar image URL. Clear that field and save again.";
