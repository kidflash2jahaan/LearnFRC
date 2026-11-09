/**
 * The teacher application's draft on this device (teacher-application-spec.md
 * section 3.7): one localStorage key per account, written by the form on
 * /apply/teach. It never holds the name, the reference or the ticked boxes,
 * but it does hold seasons and written answers, and family computers are
 * shared, so it goes away when the application is sent, when the form isn't
 * open to that account any more, on sign-out and on account deletion.
 *
 * Pure (no `@/` imports): the page builds the key on the server, and the
 * browser-only helpers are called from effects and event handlers, never
 * during render. Blocked storage just means there's no draft.
 */

export const TEACH_DRAFT_PREFIX = "lf-teach-draft:";

/** The draft's key for one account. */
export const teachDraftKey = (userId: string): string => `${TEACH_DRAFT_PREFIX}v2:${userId}`;

/** An unsent draft older than this is dropped instead of restored. */
export const TEACH_DRAFT_MAX_AGE_MS = 60 * 86_400_000;

/** Deletes one account's draft on this device. */
export function dropTeachDraft(userId: string): void {
  try {
    window.localStorage.removeItem(teachDraftKey(userId));
  } catch {
    /* storage blocked: nothing was saved */
  }
}

/** Deletes every teacher draft on this device, whichever account wrote it. */
export function dropAllTeachDrafts(): void {
  try {
    const ls = window.localStorage;
    const keys: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k?.startsWith(TEACH_DRAFT_PREFIX)) keys.push(k);
    }
    for (const k of keys) ls.removeItem(k);
  } catch {
    /* storage blocked: nothing was saved */
  }
}
