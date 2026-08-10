"use client";

import * as React from "react";

const COOKIE_NAME = "lf_src";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 days

const HOST_MAP: [string, string][] = [
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

type Landing = { search: string; referrer: string };

let landing: Landing | null = null;

/**
 * The *landing* document's query string and referrer, memoised on first read in
 * the browser.
 *
 * This has to be memoised rather than read live: the App Router never remounts
 * the root layout, so a client-side navigation mutates `location.search` while
 * leaving this module loaded. Reading it live from a later call would attribute
 * a visitor to whatever URL they happened to be on when the cookie was finally
 * written, which is not first-touch. `document.referrer` is already stable
 * across client navigations, but it is captured here too so the pair is
 * consistent.
 */
function getLanding(): Landing | null {
  if (typeof window === "undefined") return null;
  if (!landing) {
    landing = { search: window.location.search, referrer: document.referrer };
  }
  return landing;
}

/**
 * Classify a landing into an acquisition source, or null when there is nothing
 * trustworthy to record (internal navigation, unparseable referrer). Returning
 * null deliberately leaves the cookie unset so a later, real first touch can
 * still claim it — locking in a wrong value is worse than locking in none.
 */
function classify(l: Landing): string | null {
  const params = new URLSearchParams(l.search);

  if (params.get("ref")) return "Referral";

  const utm = params.get("utm_source")?.trim();
  if (utm) return utm;

  const r = l.referrer;
  if (!r) return "Direct";

  let host = "";
  try {
    host = new URL(r).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    host = "";
  }
  if (!host || host.includes("learnfrc")) return null; // internal nav

  if (host === "x.com" || host.endsWith(".x.com")) return "Twitter";
  return HOST_MAP.find(([k]) => host.includes(k))?.[1] ?? "Other";
}

/**
 * Write the first-touch acquisition cookie if it does not already exist.
 *
 * Idempotent and **synchronous** — that second property is the whole point.
 * `<PageViewBeacon/>` calls this immediately before it reports, so the very
 * first pageview of a new visitor (the one that actually carries the
 * acquisition source) leaves the browser with `lf_src` already in the jar.
 * `document.cookie` is applied to the cookie store synchronously, so a
 * `sendBeacon`/`fetch` later in the same task includes it.
 *
 * Before this existed the cookie was only written from `<SourceCapture/>`'s
 * effect. React flushes sibling passive effects in mount order, and the beacon
 * was mounted first, so the first request of every new visitor went out
 * cookie-less and was stored with `source = NULL`. That silently discarded the
 * acquisition source for ~12% of visitors — permanently for the ~800 who only
 * ever viewed one page.
 */
export function ensureSourceCookie(): void {
  if (typeof document === "undefined") return;
  if (document.cookie.includes(`${COOKIE_NAME}=`)) return; // first-touch only

  const l = getLanding();
  if (!l) return;

  const src = classify(l);
  if (!src) return;

  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
    src.slice(0, 40)
  )}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}

/**
 * First-touch acquisition attribution. On a visitor's first landing (no cookie
 * yet) it classifies where they came from — referral link, UTM, or the
 * referring domain — and stores it in a 90-day cookie. The signup action reads
 * that cookie and saves it as the user's `source`, and /api/page-view reads it
 * off the request to attribute traffic; both power the admin breakdown.
 *
 * The work itself lives in `ensureSourceCookie()` so it can also be invoked
 * directly by the pageview beacon, which must not depend on this component's
 * effect having run first. Keeping the component mounted still guarantees the
 * cookie gets written on routes where the beacon bails out early (/admin).
 */
export function SourceCapture() {
  React.useEffect(() => {
    ensureSourceCookie();
  }, []);

  return null;
}
