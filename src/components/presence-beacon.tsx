"use client";

import * as React from "react";

/**
 * Says "still here" every 60 seconds so the admin panel can show who is on the
 * site right now. Renders null.
 *
 * It only runs when a Supabase auth cookie (sb-*) is in the jar, so a signed-out
 * reader never pings and the online count only ever counts accounts. The
 * visibility listener catches the case where a tab was backgrounded long enough
 * for the interval to be throttled: coming back into view pings immediately
 * rather than waiting out the rest of the minute.
 */
export function PresenceBeacon() {
  React.useEffect(() => {
    const signedIn = () => document.cookie.includes("sb-");
    if (!signedIn()) return;

    const ping = () => {
      if (!signedIn()) return;
      fetch("/api/presence", { method: "POST", keepalive: true }).catch(() => {});
    };

    ping();
    const id = setInterval(ping, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
