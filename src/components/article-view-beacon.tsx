"use client";

import { useEffect } from "react";

/**
 * Fire-and-forget view counter for a blog article. Renders NOTHING (returns
 * null) so it can never affect layout or hydration.
 *
 * On mount it POSTs the slug to `/api/article-view` at most once per browser
 * session per article, guarded by a `sessionStorage` flag. The guard is written
 * *before* the request is sent, so a React strict-mode double-mount (dev) and a
 * page reload in the same tab both dedupe to a single beacon.
 *
 * Uses `navigator.sendBeacon` (survives navigation/unload) with a `fetch`
 * fallback for browsers where the beacon is unavailable or refused.
 */
export function ArticleViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    if (!slug) return;

    const key = `lf_av_${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      // Claim the guard synchronously so a double-invoke can't double-count.
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage blocked (private mode / disabled). Without a guard we
      // can't dedupe, so bail rather than risk inflating counts on reload.
      return;
    }

    const body = JSON.stringify({ slug });
    let sent = false;
    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        sent = navigator.sendBeacon(
          "/api/article-view",
          new Blob([body], { type: "application/json" })
        );
      }
    } catch {
      sent = false;
    }

    if (!sent) {
      fetch("/api/article-view", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  }, [slug]);

  return null;
}
