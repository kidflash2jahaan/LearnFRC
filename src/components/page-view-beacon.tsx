"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { ensureSourceCookie } from "@/components/source-capture";

/**
 * Counts one pageview anywhere on the site. Renders null, like every beacon.
 *
 * It is mounted once in the root layout, next to PresenceBeacon, and the root
 * layout never remounts. So unlike the per-article beacon it has to key its
 * effect on usePathname() to fire again on a client side navigation.
 *
 * Crawlers are excluded by construction: this is client JavaScript, so anything
 * that does not run scripts never counts. /admin and /api are dropped because
 * they are not public traffic.
 */
export function PageViewBeacon() {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (/^\/(admin|api)(\/|$)/.test(pathname)) return;
    // Collapse rapid duplicates (a strict-mode double mount, a double render).
    // A real later navigation back to the same path still counts.
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;

    // First-party visitor id, no personal data in it, so unique visitors can be
    // counted without tracking anyone across sites.
    let visitorId: string | null = null;
    try {
      visitorId = localStorage.getItem("lf_vid");
      if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem("lf_vid", visitorId);
      }
    } catch {
      // Storage blocked. Still count the view, just without an id.
    }

    // Write the first-touch acquisition cookie BEFORE reporting. /api/page-view
    // reads lf_src off this very request, so if the cookie is not in the jar yet
    // the visitor's first pageview, the only one that carries the acquisition
    // source, gets stored with source NULL.
    //
    // Ordering <SourceCapture/> ahead of this component in the layout is not
    // enough to rely on: that makes correctness depend on React's sibling effect
    // flush order and on nobody ever reordering the JSX. This call is
    // synchronous and idempotent, so the cookie is set by the time sendBeacon
    // runs a few lines below, whatever the mount order.
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
