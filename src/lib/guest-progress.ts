/**
 * Guest (no-account) lesson progress — the client half.
 *
 * A visitor can complete lessons without signing up. Their completions live in
 * two places:
 *
 *   1. `localStorage["lf_guest_lessons"]` — instant, offline, survives reloads.
 *   2. `guest_progress` on the server, keyed to the anonymous visitor id
 *      (`lf_vid`, the same id the pageview beacon uses). Written by
 *      POST /api/guest-progress, read back by GET /api/guest-progress.
 *
 * The SERVER copy is the one that migrates into a real account at signup
 * (/api/migrate-guest), because it is the only copy the server can trust — a
 * client-supplied list of lesson ids would let any signed-in user mint
 * completions and XP for lessons they never took. That makes the round-trip
 * load-bearing rather than a nice-to-have, so a write that does not reach the
 * server is parked in a PENDING queue and retried on the next page load. If we
 * are going to promise "sign up and you keep everything", the queue is what
 * makes the promise true.
 *
 * Everything here is browser-only and must be called from an effect / event
 * handler — never during render (localStorage during render breaks hydration).
 */

const GUEST_KEY = "lf_guest_lessons";
const PENDING_KEY = "lf_guest_pending";
const VISITOR_KEY = "lf_vid";
/** lessonId -> how many times a migration has tried and failed to get this
 *  completion onto the server. Bounds the retry budget; never a reason to
 *  delete the completion. */
const UNMIGRATED_KEY = "lf_guest_unmigrated";

/** After this many refused re-posts we stop asking on every session. The local
 *  claim is still KEPT — the cap only stops one permanently-unverifiable lesson
 *  from firing a request on every page load forever. */
const MAX_RECOVERY_ATTEMPTS = 3;

const LOG = "[guest-progress]";

/** Fired on the window whenever the local guest set changes, so every surface
 *  (lesson chip, contents dots, reading rail, mastery ring, signup ask) can
 *  re-read without polling or the old document-wide click listener. */
export const GUEST_PROGRESS_EVENT = "lf:guest-progress";

function readMap(key: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, boolean>;
  } catch {
    // Storage blocked (private mode / third-party restrictions) or corrupt.
    return {};
  }
}

/** Attempt counters (see UNMIGRATED_KEY). Same tolerant parse as readMap. */
function readCounts(key: string): Record<string, number> {
  const out: Record<string, number> = {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return out;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return out;
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>))
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  } catch {
    /* storage blocked or corrupt — start the budget over */
  }
  return out;
}

function writeMap(key: string, map: Record<string, unknown>) {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* storage blocked — in-memory state still reflects the completion */
  }
}

/** The anonymous visitor id shared with the pageview beacon. Creates one if
 *  this browser doesn't have it yet. Returns "" when storage is blocked, in
 *  which case guest progress is session-only and cannot be migrated. */
export function getVisitorId(): string {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    return "";
  }
}

/** Lesson ids this browser has completed as a guest. */
export function readGuestLessons(): Set<string> {
  const out = new Set<string>();
  for (const [id, done] of Object.entries(readMap(GUEST_KEY)))
    if (done) out.add(id);
  return out;
}

export function guestLessonCount(): number {
  return readGuestLessons().size;
}

function emit() {
  try {
    window.dispatchEvent(new Event(GUEST_PROGRESS_EVENT));
  } catch {
    /* SSR / no window */
  }
}

/** Subscribe to guest-set changes: local writes, other tabs, and tab focus
 *  (a completion made in another tab while this one was hidden). Returns an
 *  unsubscribe function. */
export function subscribeGuestProgress(onChange: () => void): () => void {
  window.addEventListener(GUEST_PROGRESS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener(GUEST_PROGRESS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
    window.removeEventListener("focus", onChange);
  };
}

function setPending(lessonId: string, pending: boolean) {
  const map = readMap(PENDING_KEY);
  if (pending) map[lessonId] = true;
  else delete map[lessonId];
  writeMap(PENDING_KEY, map);
}

/**
 * Record (or clear) a guest completion locally, then mirror it to the server.
 * Resolves true when the server confirmed the write. On any failure the lesson
 * is parked in the pending queue and `flushPendingGuestProgress()` retries it
 * later, so a dropped request never quietly costs the reader a lesson.
 */
export async function saveGuestLesson(
  lessonId: string,
  done: boolean,
  answers?: number[]
): Promise<boolean> {
  const map = readMap(GUEST_KEY);
  if (done) map[lessonId] = true;
  else delete map[lessonId];
  writeMap(GUEST_KEY, map);
  emit();

  const visitorId = getVisitorId();
  if (!visitorId) return false;

  // Park it first: if the tab closes mid-request we retry rather than lose it.
  if (done) setPending(lessonId, true);

  const res = await postGuestProgress(visitorId, lessonId, done, answers);
  if (done && res === "ok") setPending(lessonId, false);
  return res === "ok";
}

/**
 * "ok"       — the server holds the row.
 * "rejected" — the server looked at it and said no (bad lesson id, unverifiable
 *              quiz). Retrying will never change the answer.
 * "retry"    — offline, throttled (429) or a server fault. The claim is still
 *              good; it just hasn't landed yet.
 *
 * The three are kept apart because the caller DELETES local progress on a
 * rejection, and a 429 or a dropped connection must never be mistaken for one.
 */
type PostResult = "ok" | "rejected" | "retry";

async function postGuestProgress(
  visitorId: string,
  lessonId: string,
  complete: boolean,
  answers?: number[]
): Promise<PostResult> {
  try {
    const r = await fetch("/api/guest-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, lessonId, complete, answers }),
      keepalive: true,
    });
    if (r.ok) return "ok";
    // 429 is the rate limiter, not a verdict on the lesson; 5xx is our fault.
    if (r.status === 429 || r.status >= 500) return "retry";
    return "rejected";
  } catch {
    return "retry";
  }
}

/**
 * Retry guest completions that never reached the server (rate limit, offline,
 * tab closed mid-flight). Called once per page load from the progress store.
 *
 * Retries carry no answers, so the server re-derives the pass from the lesson's
 * quiz: a retried row is accepted only if the lesson has no quiz, or if the
 * server already holds a verified row for it. Anything it cannot verify is
 * dropped from the queue instead of being retried forever.
 *
 * `keepRejected` is for the signup migration. A rejection normally drops the
 * local claim too (below), but at signup the local copy can be the ONLY
 * surviving record that the reader did the lesson, and deleting it there —
 * inside the flow whose entire promise is "keep your progress" — is the worst
 * possible moment to be wrong. With `keepRejected` the entry leaves the retry
 * queue but stays in the completed map, and the caller reports it.
 */
export async function flushPendingGuestProgress(
  opts: { keepRejected?: boolean } = {}
): Promise<void> {
  const pending = Object.keys(readMap(PENDING_KEY));
  if (!pending.length) return;
  const visitorId = getVisitorId();
  if (!visitorId) return;

  // Anything already on the server is settled — no need to re-post it.
  const onServer = await fetchServerGuestLessons(visitorId);
  for (const id of pending) {
    if (onServer.has(id)) {
      setPending(id, false);
      continue;
    }
    const res = await postGuestProgress(visitorId, id, true);
    // "retry" means offline / throttled / server fault — LEAVE IT QUEUED. The
    // previous version cleared the queue and deleted the local completion on
    // any non-2xx, so a reader who finished a lesson on a flaky connection, or
    // a class behind one school NAT that tripped the per-IP rate limit, watched
    // finished lessons disappear from their own browser on the next page load.
    if (res === "retry") continue;
    // Settled either way: stop retrying on every navigation forever.
    setPending(id, false);
    if (res === "rejected") {
      if (opts.keepRejected) {
        console.warn(
          `${LOG} server refused to re-save lesson ${id} (unverified quiz or unknown lesson). Keeping this browser's copy — it may be the only record of it.`
        );
        continue;
      }
      // The server looked at it and refused, so it can never migrate. Drop the
      // local claim rather than show progress we know we cannot keep.
      const map = readMap(GUEST_KEY);
      if (map[id]) {
        delete map[id];
        writeMap(GUEST_KEY, map);
        emit();
        // Never silent: this deletes something the reader believes they did.
        console.warn(
          `${LOG} server refused lesson ${id} and it cannot migrate, so it was removed from this browser's progress.`
        );
      }
    }
  }
}

/** The server's copy of this visitor's guest completions — the set that will
 *  actually migrate at signup. */
export async function fetchServerGuestLessons(
  visitorId: string
): Promise<Set<string>> {
  if (!visitorId) return new Set();
  try {
    const r = await fetch(
      `/api/guest-progress?visitorId=${encodeURIComponent(visitorId)}`,
      { headers: { accept: "application/json" } }
    );
    if (!r.ok) return new Set();
    const d = (await r.json()) as { lessonIds?: unknown };
    if (!Array.isArray(d.lessonIds)) return new Set();
    return new Set(d.lessonIds.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

/** Fold the server's copy back into localStorage. Recovers guest progress made
 *  before a local wipe, and keeps the two copies from drifting apart. */
export function mergeServerGuestLessons(ids: Set<string>): boolean {
  if (!ids.size) return false;
  const map = readMap(GUEST_KEY);
  let changed = false;
  for (const id of ids)
    if (!map[id]) {
      map[id] = true;
      changed = true;
    }
  if (changed) {
    writeMap(GUEST_KEY, map);
    emit();
  }
  return changed;
}

/**
 * Drop this browser's guest state wholesale. Only safe once every local
 * completion is known to live in the account — use `clearMigratedGuestLessons`,
 * which calls this only when nothing is left over.
 */
export function clearGuestLessons() {
  try {
    localStorage.removeItem(GUEST_KEY);
    localStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(UNMIGRATED_KEY);
  } catch {
    /* ignore */
  }
  emit();
}

/**
 * Clear ONLY the local completions the account provably owns now, and return
 * the ids that are still unaccounted for.
 *
 * This replaces `if (migrated > 0 || hadLocal) clearGuestLessons()`, which
 * wiped the whole map whenever the browser held anything at all — including
 * when the server migrated NOTHING. Any completion whose server row was missing
 * (written by an older code path, or lost because the POST never landed) was
 * destroyed at the exact moment the reader signed up to keep it. Deleting a
 * lesson someone actually did is strictly worse than carrying a redundant
 * localStorage key, so the burden of proof now runs the other way: an id is
 * removed only if it is in `owned`, and everything else stays.
 */
export function clearMigratedGuestLessons(owned: Set<string>): string[] {
  const map = readMap(GUEST_KEY);
  const kept: string[] = [];
  let changed = false;
  // Object.entries snapshots, so deleting inside the loop is safe.
  for (const [id, done] of Object.entries(map)) {
    if (!done) {
      delete map[id]; // a false/0 entry is not a completion, just noise
      changed = true;
    } else if (owned.has(id)) {
      delete map[id];
      changed = true;
    } else {
      kept.push(id);
    }
  }

  if (!kept.length) {
    // Everything this browser held is in the account: the old wholesale clear
    // is correct here, and only here.
    clearGuestLessons();
    return [];
  }

  if (changed) {
    writeMap(GUEST_KEY, map);
    emit();
  }
  // The retry queue and the attempt counters can only be about lessons we still
  // hold; anything that migrated is settled forever.
  const pending = readMap(PENDING_KEY);
  let prunedPending = false;
  for (const id of Object.keys(pending))
    if (!map[id]) {
      delete pending[id];
      prunedPending = true;
    }
  if (prunedPending) writeMap(PENDING_KEY, pending);

  const attempts = readCounts(UNMIGRATED_KEY);
  let prunedAttempts = false;
  for (const id of Object.keys(attempts))
    if (!map[id]) {
      delete attempts[id];
      prunedAttempts = true;
    }
  if (prunedAttempts) writeMap(UNMIGRATED_KEY, attempts);

  return kept;
}

/**
 * Re-post completions that a migration could not carry into the account,
 * so the next migration pass has a server row to move.
 *
 * Unlike `flushPendingGuestProgress` this NEVER deletes the local claim: the
 * reader has an account now, the guest row is gone, and this map is the last
 * copy of work they actually did. A refusal is recorded against a small attempt
 * budget and shouted about, not acted on.
 */
export async function recoverUnmigratedGuestLessons(ids: string[]): Promise<{
  /** Now on the server — a second migration pass can carry these. */
  requeued: string[];
  /** The server refused. Kept locally, counted against the budget. */
  blocked: string[];
  /** Not attempted this pass (offline, or out of attempts). Kept locally. */
  deferred: string[];
}> {
  const requeued: string[] = [];
  const blocked: string[] = [];
  const deferred: string[] = [];
  const visitorId = getVisitorId();
  if (!visitorId || !ids.length) return { requeued, blocked, deferred };

  const attempts = readCounts(UNMIGRATED_KEY);
  let changed = false;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if ((attempts[id] ?? 0) >= MAX_RECOVERY_ATTEMPTS) {
      deferred.push(id);
      continue;
    }
    const res = await postGuestProgress(visitorId, id, true);
    if (res === "ok") {
      requeued.push(id);
      if (attempts[id] !== undefined) {
        delete attempts[id];
        changed = true;
      }
      continue;
    }
    if (res === "retry") {
      // Offline / throttled — not a verdict on the lesson, and every further
      // POST this pass hits the same wall. Stop without spending the budget.
      deferred.push(...ids.slice(i));
      break;
    }
    attempts[id] = (attempts[id] ?? 0) + 1;
    changed = true;
    blocked.push(id);
  }
  if (changed) writeMap(UNMIGRATED_KEY, attempts);
  return { requeued, blocked, deferred };
}
