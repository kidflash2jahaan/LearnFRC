"use client";

import * as React from "react";

/**
 * First-touch acquisition attribution. On a visitor's first landing (no cookie
 * yet) it classifies where they came from — referral link, UTM, or the
 * referring domain — and stores it in a 90-day cookie. The signup action reads
 * that cookie and saves it as the user's `source`, powering the admin pie chart.
 */
export function SourceCapture() {
  React.useEffect(() => {
    if (document.cookie.includes("lf_src=")) return; // first-touch only

    const params = new URLSearchParams(window.location.search);
    let src = "";

    if (params.get("ref")) {
      src = "Referral";
    } else if (params.get("utm_source")) {
      src = params.get("utm_source")!;
    } else {
      const r = document.referrer;
      if (!r) {
        src = "Direct";
      } else {
        let host = "";
        try {
          host = new URL(r).hostname.replace(/^www\./, "").toLowerCase();
        } catch {
          host = "";
        }
        if (!host || host.includes("learnfrc")) return; // internal nav — don't lock in
        if (host === "x.com" || host.endsWith(".x.com")) {
          src = "Twitter";
        } else {
          const map: [string, string][] = [
            ["google", "Google"],
            ["reddit", "Reddit"],
            ["chiefdelphi", "Chief Delphi"],
            ["youtu", "YouTube"],
            ["instagram", "Instagram"],
            ["t.co", "Twitter"],
            ["twitter", "Twitter"],
            ["discord", "Discord"],
            ["bing", "Bing"],
            ["duckduckgo", "DuckDuckGo"],
            ["facebook", "Facebook"],
            ["linkedin", "LinkedIn"],
          ];
          src = map.find(([k]) => host.includes(k))?.[1] ?? "Other";
        }
      }
    }

    if (!src) return;
    src = src.slice(0, 40);
    document.cookie = `lf_src=${encodeURIComponent(src)}; path=/; max-age=${60 * 60 * 24 * 90}; SameSite=Lax`;
  }, []);

  return null;
}
