"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Silently re-runs the admin server components on an interval so every metric
 * (online count, signups, completions, chart, tables) stays current without a
 * manual page refresh. `router.refresh()` preserves client state — open panels
 * and scroll position are kept, and the counters animate to their new values.
 * Pauses while the tab is hidden to avoid pointless background fetches.
 */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();

  React.useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, seconds * 1000);
    // Refresh immediately when the tab is re-focused after being away.
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, seconds]);

  return (
    <span className="aq-chip inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-primary">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      Live · auto-updating
    </span>
  );
}
