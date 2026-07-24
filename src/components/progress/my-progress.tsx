"use client";

import * as React from "react";

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
 */
export type MyProgress = {
  /** True once the API responded (used to avoid layout thrash if ever needed). */
  loaded: boolean;
  authed: boolean;
  completed: Set<string>;
  bookmarked: Set<string>;
  username: string | null;
  subscribed: boolean;
  /** Optimistically reflect a completion the user just toggled (authed only). */
  setCompleted: (lessonId: string, done: boolean) => void;
  /** Optimistically reflect a bookmark toggle. */
  setBookmarked: (lessonId: string, saved: boolean) => void;
};

const noop = () => {};

const DEFAULT: MyProgress = {
  loaded: false,
  authed: false,
  completed: new Set<string>(),
  bookmarked: new Set<string>(),
  username: null,
  subscribed: false,
  setCompleted: noop,
  setBookmarked: noop,
};

const Ctx = React.createContext<MyProgress>(DEFAULT);

export function useMyProgress(): MyProgress {
  return React.useContext(Ctx);
}

type State = {
  loaded: boolean;
  authed: boolean;
  completed: Set<string>;
  bookmarked: Set<string>;
  username: string | null;
  subscribed: boolean;
};

export function MyProgressProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<State>({
    loaded: false,
    authed: false,
    completed: new Set<string>(),
    bookmarked: new Set<string>(),
    username: null,
    subscribed: false,
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
          completed: new Set<string>(d.completedLessonIds ?? []),
          bookmarked: new Set<string>(d.bookmarkedLessonIds ?? []),
          username: d.username ?? null,
          subscribed: !!d.subscribed,
        });
      })
      .catch(() => {
        if (alive) setState((s) => ({ ...s, loaded: true }));
      });
    return () => {
      alive = false;
    };
  }, []);

  const setCompleted = React.useCallback((lessonId: string, done: boolean) => {
    setState((s) => {
      const next = new Set(s.completed);
      if (done) next.add(lessonId);
      else next.delete(lessonId);
      return { ...s, completed: next };
    });
  }, []);

  const setBookmarked = React.useCallback((lessonId: string, saved: boolean) => {
    setState((s) => {
      const next = new Set(s.bookmarked);
      if (saved) next.add(lessonId);
      else next.delete(lessonId);
      return { ...s, bookmarked: next };
    });
  }, []);

  const value = React.useMemo<MyProgress>(
    () => ({ ...state, setCompleted, setBookmarked }),
    [state, setCompleted, setBookmarked]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
