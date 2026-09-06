"use client";

import { useEffect } from "react";

/**
 * Counts one read of one article, then gets out of the way.
 *
 * It renders null on purpose. A view counter that puts a node in the tree can
 * shift layout or break hydration, and this one has no business doing either,
 * so it is a client leaf that only runs an effect.
 *
 * The count fires at most once per browser session per article. The
 * sessionStorage flag is claimed BEFORE the request goes out, so a strict-mode
 * double mount in dev and a reload in the same tab both collapse into a single
 * beacon. If sessionStorage is unavailable, in a private window or with storage
 * switched off, there is no way to dedupe, so the component sends nothing
 * rather than inflate the number on every reload.
 *
 * navigator.sendBeacon is the transport because it survives the navigation that
 * usually follows. fetch with keepalive is the fallback for browsers that
 * refuse or lack it.
 */
export function ArticleViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    if (!slug) return;

    const key = `lf_av_${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      // Claim the guard synchronously so a double invoke cannot double count.
      sessionStorage.setItem(key, "1");
    } catch {
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
