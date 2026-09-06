"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Silently re-runs the admin server components on an interval so every figure
 * (online count, signups, completions, chart, tables) stays current without a
 * manual refresh. `router.refresh()` preserves client state, so open drawers
 * and scroll position survive. Pauses while the tab is hidden, and catches up
 * the moment it comes back, because a background tab polling every 30 seconds
 * is just a bill.
 *
 * The old version was a pill with a dot pulsing forever. This system bans idle
 * motion: nothing loops, nothing breathes. A reading taken automatically is
 * still a reading, so it is stamped like one, in mono, with the interval
 * printed. `role="status"` keeps the announcement without needing the dot.
 */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();

  React.useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(refreshIfVisible, seconds * 1000);
    // Also refresh immediately when the tab is re-focused after being away.
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [router, seconds]);

  return (
    <span
      role="status"
      className="nb-slug inline-flex items-center gap-2 whitespace-nowrap"
    >
      {/* A clock drawn in ink rather than pulled from an icon set, at the
          same weight as the rules around it. */}
      <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true" focusable="false">
        <circle cx="6.5" cy="6.5" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M6.5 2.2v4.5l3 1.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      re-read every {seconds}s
    </span>
  );
}
