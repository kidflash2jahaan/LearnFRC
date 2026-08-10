"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { ensureSourceCookie } from "@/components/source-capture";

/**
 * Site-wide pageview beacon. Mounted once at the body level (next to
 * PresenceBeacon), so — unlike the per-article ArticleViewBeacon — it must key
 * its effect on usePathname() to re-fire on client-side (App Router) navigation,
 * since the root layout never remounts.
 *
 * Bot-safe by construction: it's client JS, so crawlers that don't run scripts
 * never count. /admin and /api are excluded from public traffic stats.
 */
export function PageViewBeacon() {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (/^\/(admin|api)(\/|$)/.test(pathname)) return;
    // Dedupe rapid duplicates (strict-mode double-mount / double-render); a real
    // later navigation back to the same path still counts.
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;

    // Persistent first-party visitor id (no PII) for unique-visitor counts.
    let visitorId: string | null = null;
    try {
      visitorId = localStorage.getItem("lf_vid");
      if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem("lf_vid", visitorId);
      }
    } catch {
      /* storage blocked — still count the pageview, just without an id */
    }

    // Write the first-touch acquisition cookie BEFORE reporting. /api/page-view
    // reads `lf_src` off this very request, so if the cookie does not exist yet
    // the visitor's first pageview — the only one that carries the acquisition
    // source — is stored with source NULL.
    //
    // Ordering <SourceCapture/> ahead of this component in the layout is not
    // enough on its own to rely on: it makes the fix depend on React's sibling
    // effect-flush order and on nobody ever reordering that JSX. This call is
    // synchronous and idempotent, so the cookie is in the jar by the time
    // sendBeacon runs a few lines below, regardless of mount order.
    ensureSourceCookie();

    const body = JSON.stringify({ path: pathname, visitorId });
    let sent = false;
    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        sent = navigator.sendBeacon(
          "/api/page-view",
          new Blob([body], { type: "application/json" })
        );
      }
    } catch {
      sent = false;
    }
    if (!sent) {
      fetch("/api/page-view", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  }, [pathname]);

  return null;
}
