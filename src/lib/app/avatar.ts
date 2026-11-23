/**
 * PROFILE PICTURES ARE INITIALS ONLY (owner, 2026-11-23).
 *
 * Google sign-in used to copy the account's Google photo into
 * `profiles.avatar_url` (the handle_new_user trigger). On Nov 23, 390 of 965
 * profiles had one: 375 Google photos their owners never chose to make public,
 * and 15 links to other sites typed into Settings. So:
 *
 *   - Nothing reads the column for display. No select lists it, and the site's
 *     Avatar (src/components/ui/avatar.tsx) draws initials and nothing else.
 *   - Every /api/app response keeps its `avatarUrl` field, because installed
 *     copies of the app decode it, and sends NO_AVATAR_URL. The app already
 *     draws initials when it's null.
 *   - Settings no longer saves one. PATCH /api/app/profile still accepts
 *     `avatarUrl` from installed copies and ignores it.
 *   - New sign-ups don't get one
 *     (supabase/migrations/20261123120000_no_google_avatar_copy.sql).
 *
 * The stored values are left alone; nothing deletes them.
 *
 * Pure and client-safe. avatar.test.ts checks the rule holds across src/.
 */

/** The avatar URL every page and /api/app response shows: none. */
export const NO_AVATAR_URL = null;
