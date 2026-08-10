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

/** The nearest reachable badge, as `/api/me/progress` sends it. */
export type NextUnlockData = {
  name: string;
  description: string;
  icon: string;
  progress: { current: number; target: number; unit: string };
};

/**
 * Client-side progress store for the static/ISR guides pages.
 *
 * The department + lesson pages are statically rendered (content cached for
 * everyone / crawlers). The per-user progress UI — completed checkmarks,
 * continue state, mastery rings, bookmarks, the completion card — hydrates from
 * `GET /api/me/progress` after mount, exactly like the Navbar hydrates auth from
 * `/api/me`. Before the fetch resolves (and for logged-out visitors) the store
 * holds the empty/logged-out defaults, so the server-rendered HTML matches what
 * a logged-out visitor already sees today.
 *
 * GUESTS ARE FIRST-CLASS HERE. A visitor can complete lessons without an
 * account, and those completions are folded into the same `completed` set that
 * signed-in progress uses — so the mastery ring, the department percentages,
 * the contents checkmarks, the reading rail and the "Continue" CTA all light up
 * for them too, with no per-surface special casing. Before this, a guest could
 * finish twelve lessons and every progress surface on the site still read zero;
 * there was nothing on screen that looked worth saving, which is a strange way
 * to run up to an ask that is entirely about not losing your progress.
 *
 * `authed` still means "has an account". `guest` means "no account, but has
 * real progress in this browser" — surfaces use it to swap the copy (this
 * browser vs every device) without pretending the two are the same thing.
 */
export type MyProgress = {
  /** True once the API responded (used to avoid layout thrash if ever needed). */
  loaded: boolean;
  authed: boolean;
  /** No account, but has completed at least one lesson in this browser. */
  guest: boolean;
  /** How many lessons this browser has completed without an account. */
  guestCount: number;
  /** Completed lessons — account rows for a signed-in reader, this browser's
   *  guest completions for everyone else. */
  completed: Set<string>;
  bookmarked: Set<string>;
  username: string | null;
  subscribed: boolean;
  /**
   * The signed-in learner's five-lessons-a-week rhythm, or null.
   *
   * COMPUTED ON THE SERVER, in /api/me/progress, from the server's clock — see
   * the hydration contract at the top of src/lib/streaks.ts. Every surface that
   * renders it (the department page, the lesson reading rail) is a static/ISR
   * page whose HTML is shared by everyone, so there is no per-user server
   * render to derive "today" in, and deriving it from the browser's clock
   * during render would make the first client paint disagree with the shipped
   * HTML. It starts null, which is what the server rendered, and only becomes
   * an object after the fetch resolves in an effect — so first paint matches by
   * construction and there is nothing for React to reconcile.
   *
   * Null for guests: a rhythm needs completion timestamps the account owns.
   */
  rhythm: Rhythm | null;
  /** Nearest reachable badge. Null when everything's earned or nothing fits. */
  nextUnlock: NextUnlockData | null;
  /** Optimistically reflect a completion the user just toggled (authed only). */
  setCompleted: (lessonId: string, done: boolean) => void;
  /** Optimistically reflect a bookmark toggle. */
  setBookmarked: (lessonId: string, saved: boolean) => void;
};

const noop = () => {};

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

/** Per-tab guard for the one guest/server reconcile — see the effect below. */
const RECONCILED_KEY = "lf_guest_reconciled";

const Ctx = React.createContext<MyProgress>(DEFAULT);

export function useMyProgress(): MyProgress {
  return React.useContext(Ctx);
}

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

function sameSet(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export function MyProgressProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<State>({
    loaded: false,
    authed: false,
    guestCount: 0,
    completed: new Set<string>(),
    bookmarked: new Set<string>(),
    username: null,
    subscribed: false,
    rhythm: null,
    nextUnlock: null,
  });

  React.useEffect(() => {
    let alive = true;
    fetch("/api/me/progress", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        setState({
          loaded: true,
          authed: !!d.authed,
          guestCount: 0,
          completed: new Set<string>(d.completedLessonIds ?? []),
          bookmarked: new Set<string>(d.bookmarkedLessonIds ?? []),
          username: d.username ?? null,
          subscribed: !!d.subscribed,
          // Already-computed plain objects from the server. Stored as-is and
          // never recomputed on this side — the moment a client derived a day
          // boundary itself, the two clocks could disagree.
          rhythm: (d.rhythm as Rhythm | null) ?? null,
          nextUnlock: (d.nextUnlock as NextUnlockData | null) ?? null,
        });
      })
      .catch(() => {
        if (alive) setState((s) => ({ ...s, loaded: true }));
      });
    return () => {
      alive = false;
    };
  }, []);

  // ---- Guest progress ----------------------------------------------------
  // Only once auth is known and the reader is NOT signed in: reading the guest
  // bucket for a signed-in reader would briefly show them someone else's local
  // completions (a shared school laptop is the normal case here, not the edge).
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

    // Live updates: a completion in this tab, another tab, or on refocus.
    const unsubscribe = subscribeGuestProgress(readLocal);

    // Reconcile with the server copy — the one that actually migrates at
    // signup. Recovers progress if the local map was lost, and retries any
    // completion that never reached the server so the migration promise holds.
    // Once per tab, not once per lesson page: localStorage is the fast path and
    // the server copy only has to be right by the time someone signs up.
    (async () => {
      try {
        if (sessionStorage.getItem(RECONCILED_KEY)) return;
        sessionStorage.setItem(RECONCILED_KEY, "1");
      } catch {
        /* storage blocked — reconcile on every mount instead */
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

  // Re-ask the SERVER for the rhythm after a completion lands.
  //
  // The obvious shortcut — bump `windowCount` locally — is the one thing this
  // module must not do: "which day does this lesson land on" is a clock
  // question, and answering it in the browser reintroduces exactly the
  // server/client disagreement the whole design avoids (a learner finishing a
  // lesson at 11:58pm in a timezone behind the server would draw it on the
  // wrong square, and their strip would then disagree with the next page load).
  // So the day strip filling in is a round trip. It is one small request, on an
  // action that already made a server call, and it is always right.
  const refreshRhythm = React.useCallback(async (minLifetime: number) => {
    // `onCompletedChange` fires OPTIMISTICALLY — LessonActions calls it before
    // it awaits the server action that writes the row — so the first read here
    // can legitimately beat the write and come back one lesson short. Retry
    // while the answer is still stale, twice, then accept whatever we got: a
    // strip that is briefly one square behind is a much smaller problem than a
    // request storm, and the next page load settles it regardless.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 900));
      let payload: { authed?: boolean; rhythm?: Rhythm; nextUnlock?: NextUnlockData } | null;
      try {
        const res = await fetch("/api/me/progress", {
          headers: { accept: "application/json" },
        });
        payload = res.ok ? await res.json() : null;
      } catch {
        return; // offline / navigated away — leave the strip as it was
      }
      if (!payload?.authed) return;
      const nextRhythm = payload.rhythm ?? null;
      if (nextRhythm && nextRhythm.lifetime < minLifetime && attempt < 2) continue;
      const nextUnlock = payload.nextUnlock ?? null;
      setState((s) => ({
        ...s,
        // Only the server-derived fields. `completed` / `bookmarked` are owned
        // by the optimistic path here and must not be rolled back by a
        // response that raced the write.
        rhythm: nextRhythm ?? s.rhythm,
        nextUnlock,
      }));
      return;
    }
  }, []);

  const setCompleted = React.useCallback(
    (lessonId: string, done: boolean) => {
      setState((s) => {
        const next = new Set(s.completed);
        if (done) next.add(lessonId);
        else next.delete(lessonId);
        return { ...s, completed: next };
      });
      // Guests have no rhythm to refresh (and no session for the route to
      // answer with), so they never pay for this request.
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
      {/* Guests who sign up from a lesson are sent back to that lesson, never
          to /dashboard — so the migration has to be able to run here. */}
      <GuestMigration enabled={state.loaded && state.authed} />
      {children}
    </Ctx.Provider>
  );
}
