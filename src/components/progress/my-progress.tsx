"use client";

import * as React from "react";
import { GuestMigration } from "@/components/guest-migration";
import {
  fetchServerGuestLessons,
  flushPendingGuestProgress,
  getVisitorId,
  mergeServerGuestLessons,
  readGuestLessons,
  subscribeGuestProgress,
} from "@/lib/guest-progress";
import type { Rhythm } from "@/lib/streaks";

/* ==================================================================== */
/*  MY PROGRESS                                                         */
/*                                                                      */
/*  One store, holding everything the guides pages know about the       */
/*  person reading them: which lessons are ticked, which are saved,     */
/*  the week's rhythm, and the next badge within reach.                 */
/*                                                                      */
/*  WHY IT IS A CLIENT STORE AND NOT A SERVER READ. The department and  */
/*  lesson pages are statically rendered, so one copy of that HTML is   */
/*  shipped to every reader and every crawler. There is no per-user     */
/*  server render to put a tick in. So the page arrives blank of        */
/*  progress and this store fills it in after mount from               */
/*  GET /api/me/progress, the same way the navbar fills in the account  */
/*  menu from /api/me. Until that request lands, and forever for a      */
/*  signed-out reader with no history, the store holds the empty        */
/*  defaults, which is exactly what the shipped HTML already shows.     */
/*  First paint and hydration agree by construction.                    */
/*                                                                      */
/*  GUESTS COUNT HERE. A visitor can finish lessons without an account, */
/*  and those completions land in the same `completed` set an account   */
/*  uses. The ring, the department percentages, the contents ticks, the */
/*  reading rail and the continue button all light up for them, with no */
/*  per-surface special casing. The old behaviour was worse than dull:  */
/*  a guest could finish twelve lessons, watch every progress surface   */
/*  read zero, and then get asked to sign up so they would not lose     */
/*  the progress none of those surfaces admitted existed.               */
/*                                                                      */
/*  `authed` means the reader has an account. `guest` means no account  */
/*  but real progress in this browser. Surfaces read both, because the  */
/*  honest sentence is "this browser" in one case and "every device" in */
/*  the other, and pretending they are the same thing is how you lose   */
/*  someone's work.                                                     */
/* ==================================================================== */

/* ---- 1. The wire ------------------------------------------------- */

/** The nearest reachable badge, as `/api/me/progress` sends it. */
export type NextUnlockData = {
  name: string;
  description: string;
  icon: string;
  progress: { current: number; target: number; unit: string };
};

/**
 * The `/api/me/progress` body, every field optional.
 *
 * It is network JSON, so it is described rather than trusted: an older
 * deployment still answering a warm tab, or a proxy that mangles a response,
 * hands back an object missing half of this. Each field is defaulted at the
 * point it is read, so a short payload degrades to the signed-out state
 * instead of throwing inside an effect nobody is watching.
 */
type ProgressWire = {
  authed?: boolean;
  completedLessonIds?: string[];
  bookmarkedLessonIds?: string[];
  username?: string | null;
  subscribed?: boolean;
  rhythm?: Rhythm | null;
  nextUnlock?: NextUnlockData | null;
};

/* ---- 2. What a consumer sees ------------------------------------- */

export type MyProgress = {
  /** True once the request settled, either way. Surfaces that would flash a
   *  wrong answer wait on this instead of guessing from an empty set. */
  loaded: boolean;
  /** The reader has an account. */
  authed: boolean;
  /** No account, but at least one lesson finished in this browser. */
  guest: boolean;
  /** How many lessons this browser has finished without an account. */
  guestCount: number;
  /** Finished lessons: the account's rows when signed in, this browser's
   *  guest completions otherwise. */
  completed: Set<string>;
  bookmarked: Set<string>;
  username: string | null;
  subscribed: boolean;
  /**
   * The signed-in reader's five-lessons-a-week rhythm, or null.
   *
   * THE CLOCK IS THE SERVER'S. This object arrives already computed from
   * /api/me/progress, and nothing on this side ever recomputes it. See the
   * hydration contract at the top of src/lib/streaks.ts. "Which day did that
   * lesson land on" is a clock question, and the pages asking it are static,
   * so there is no per-user server render to answer it in. If the browser
   * answered instead, someone finishing a lesson at 11:58pm in a timezone
   * behind the server would get it drawn on the wrong square, and the strip
   * would then disagree with itself on the next page load.
   *
   * Null for guests: a rhythm needs the completion timestamps the account owns.
   */
  rhythm: Rhythm | null;
  /** Nearest reachable badge. Null when everything is earned or nothing fits. */
  nextUnlock: NextUnlockData | null;
  /** Reflect a completion the reader just toggled, before the server agrees. */
  setCompleted: (lessonId: string, done: boolean) => void;
  /** Reflect a bookmark the reader just toggled. */
  setBookmarked: (lessonId: string, saved: boolean) => void;
};

const noop = () => {};

/**
 * The signed-out, nothing-loaded store.
 *
 * This is also what the static HTML was built against, so it is the only
 * correct value for the first client render.
 */
const DEFAULT: MyProgress = {
  loaded: false,
  authed: false,
  guest: false,
  guestCount: 0,
  completed: new Set<string>(),
  bookmarked: new Set<string>(),
  username: null,
  subscribed: false,
  rhythm: null,
  nextUnlock: null,
  setCompleted: noop,
  setBookmarked: noop,
};

const Ctx = React.createContext<MyProgress>(DEFAULT);

export function useMyProgress(): MyProgress {
  return React.useContext(Ctx);
}

/* ---- 3. Internals ------------------------------------------------ */

/** Per-tab guard for the one guest reconcile. See section 5. */
const RECONCILED_KEY = "lf_guest_reconciled";

/** Everything the provider owns. `guest` is derived, so it is not in here. */
type State = {
  loaded: boolean;
  authed: boolean;
  guestCount: number;
  completed: Set<string>;
  bookmarked: Set<string>;
  username: string | null;
  subscribed: boolean;
  rhythm: Rhythm | null;
  nextUnlock: NextUnlockData | null;
};

const EMPTY: State = {
  loaded: false,
  authed: false,
  guestCount: 0,
  completed: new Set<string>(),
  bookmarked: new Set<string>(),
  username: null,
  subscribed: false,
  rhythm: null,
  nextUnlock: null,
};

/**
 * Set equality, so a guest re-read that found nothing new keeps the old
 * reference. The guest bucket is re-read on every focus and every storage
 * event, and a fresh Set each time would re-render every consumer for nothing.
 */
function sameSet(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export function MyProgressProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<State>(EMPTY);

  /* ---- 4. Hydrate ------------------------------------------------ */
  // One request, on mount. `loaded` flips either way, including on a failure,
  // because a surface waiting on it forever is worse than one that shows the
  // signed-out state.
  React.useEffect(() => {
    let alive = true;
    fetch("/api/me/progress", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? (r.json() as Promise<ProgressWire>) : null))
      .then((d) => {
        if (!alive || !d) return;
        setState({
          loaded: true,
          authed: !!d.authed,
          // Filled in by the guest effect below, and only for a reader who
          // turns out not to have an account.
          guestCount: 0,
          completed: new Set<string>(d.completedLessonIds ?? []),
          bookmarked: new Set<string>(d.bookmarkedLessonIds ?? []),
          username: d.username ?? null,
          subscribed: !!d.subscribed,
          // Stored exactly as the server computed them, and never recomputed.
          rhythm: d.rhythm ?? null,
          nextUnlock: d.nextUnlock ?? null,
        });
      })
      .catch(() => {
        if (alive) setState((s) => ({ ...s, loaded: true }));
      });
    return () => {
      alive = false;
    };
  }, []);

  /* ---- 5. Guest progress ----------------------------------------- */
  // Gated on auth being KNOWN and the answer being "no account". Reading the
  // guest bucket for a signed-in reader would show them somebody else's local
  // completions, and a shared school laptop is the normal case here, not the
  // edge.
  const isGuest = state.loaded && !state.authed;

  React.useEffect(() => {
    if (!isGuest) return;
    let alive = true;

    const apply = (ids: Set<string>) => {
      if (!alive) return;
      setState((s) =>
        sameSet(s.completed, ids)
          ? s
          : { ...s, completed: ids, guestCount: ids.size }
      );
    };

    const readLocal = () => apply(readGuestLessons());
    readLocal();

    // Live updates: a completion in this tab, in another tab, or on refocus.
    const unsubscribe = subscribeGuestProgress(readLocal);

    // Reconcile with the server's copy, which is the one that actually
    // migrates at signup. This recovers progress if the local map was cleared,
    // and retries any completion that never reached the server, so the promise
    // made at the signup prompt holds. Once per tab, not once per lesson page:
    // localStorage is the fast path, and the server copy only has to be right
    // by the time somebody signs up.
    void (async () => {
      try {
        if (sessionStorage.getItem(RECONCILED_KEY)) return;
        sessionStorage.setItem(RECONCILED_KEY, "1");
      } catch {
        /* storage blocked, so reconcile on every mount instead */
      }
      const visitorId = getVisitorId();
      if (!visitorId) return;
      await flushPendingGuestProgress();
      if (!alive) return;
      const server = await fetchServerGuestLessons(visitorId);
      if (!alive) return;
      mergeServerGuestLessons(server);
      readLocal();
    })();

    return () => {
      alive = false;
      unsubscribe();
    };
  }, [isGuest]);

  /* ---- 6. Re-ask the server for the rhythm ----------------------- */
  /**
   * Called after a completion lands, to refill the day strip.
   *
   * The obvious shortcut, adding one to `windowCount` here, is the single
   * thing this module must not do: see the clock note on `rhythm` above. So
   * the strip filling in costs a round trip. It is one small request, on an
   * action that already made a server call, and it is always right.
   *
   * The retry exists because `onCompletedChange` fires optimistically:
   * LessonActions calls it before it awaits the server action that writes the
   * row, so the first read here can legitimately beat the write and come back
   * one lesson short. Retry while the answer is still stale, twice, then take
   * whatever arrived. A strip that is briefly one square behind is a much
   * smaller problem than a request storm, and the next page load settles it.
   */
  const refreshRhythm = React.useCallback(async (minLifetime: number) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 900));
      let payload: ProgressWire | null;
      try {
        const res = await fetch("/api/me/progress", {
          headers: { accept: "application/json" },
        });
        payload = res.ok ? ((await res.json()) as ProgressWire) : null;
      } catch {
        return; // offline, or navigated away. Leave the strip as it was.
      }
      if (!payload?.authed) return;
      const nextRhythm = payload.rhythm ?? null;
      if (nextRhythm && nextRhythm.lifetime < minLifetime && attempt < 2) continue;
      const nextUnlock = payload.nextUnlock ?? null;
      setState((s) => ({
        ...s,
        // Server-derived fields only. `completed` and `bookmarked` are owned by
        // the optimistic path below, and a response that raced the write must
        // not be allowed to roll them back.
        rhythm: nextRhythm ?? s.rhythm,
        nextUnlock,
      }));
      return;
    }
  }, []);

  /* ---- 7. Optimistic toggles ------------------------------------- */

  const setCompleted = React.useCallback(
    (lessonId: string, done: boolean) => {
      setState((s) => {
        const next = new Set(s.completed);
        if (done) next.add(lessonId);
        else next.delete(lessonId);
        return { ...s, completed: next };
      });
      // A guest has no rhythm to refresh, and no session for the route to
      // answer with, so they never pay for this request.
      if (done && state.authed)
        void refreshRhythm((state.rhythm?.lifetime ?? 0) + 1);
    },
    [refreshRhythm, state.authed, state.rhythm]
  );

  const setBookmarked = React.useCallback((lessonId: string, saved: boolean) => {
    setState((s) => {
      const next = new Set(s.bookmarked);
      if (saved) next.add(lessonId);
      else next.delete(lessonId);
      return { ...s, bookmarked: next };
    });
  }, []);

  /* ---- 8. Publish ------------------------------------------------ */

  const value = React.useMemo<MyProgress>(
    () => ({
      ...state,
      guest: isGuest && state.guestCount > 0,
      setCompleted,
      setBookmarked,
    }),
    [state, isGuest, setCompleted, setBookmarked]
  );

  return (
    <Ctx.Provider value={value}>
      {/* A guest who signs up from a lesson is sent back to that lesson, never
          to /dashboard, so the migration has to be able to run from here. */}
      <GuestMigration enabled={state.loaded && state.authed} />
      {children}
    </Ctx.Provider>
  );
}
