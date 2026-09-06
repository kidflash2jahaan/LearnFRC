"use client";

import * as React from "react";

const COOKIE_NAME = "lf_src";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 days

/** Referring hosts worth naming. Anything else lands in "Other". */
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
 * The query string and referrer of the document the visitor actually LANDED on,
 * memoised the first time it is read in the browser.
 *
 * Memoising is the whole point, not an optimisation. The App Router never
 * remounts the root layout, so a client side navigation rewrites
 * location.search while this module stays loaded. Reading it live later would
 * credit the visitor to whatever URL they happened to be on when the cookie was
 * finally written, which is not first touch. document.referrer is already
 * stable across client navigations, but it is captured here too so the pair
 * always describes the same moment.
 */
function getLanding(): Landing | null {
  if (typeof window === "undefined") return null;
  if (!landing) {
    landing = { search: window.location.search, referrer: document.referrer };
  }
  return landing;
}

/**
 * Turn a landing into an acquisition source, or null when there is nothing
 * trustworthy to record, like an internal navigation or a referrer that will
 * not parse. Returning null leaves the cookie unset on purpose so a later, real
 * first touch can still claim it. Locking in a wrong value is worse than
 * locking in none.
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
  if (!host || host.includes("learnfrc")) return null; // internal navigation

  if (host === "x.com" || host.endsWith(".x.com")) return "Twitter";
  return HOST_MAP.find(([k]) => host.includes(k))?.[1] ?? "Other";
}

/**
 * Write the first-touch acquisition cookie if it is not already there.
 *
 * Idempotent, and SYNCHRONOUS, which is the property that matters.
 * <PageViewBeacon/> calls this immediately before it reports, so a new
 * visitor's very first pageview, the one that carries the acquisition source,
 * already has lf_src in the jar. document.cookie is applied to the cookie store
 * synchronously, so a sendBeacon or fetch later in the same task includes it.
 *
 * Before this function existed the cookie was only written from
 * <SourceCapture/>'s effect. React flushes sibling passive effects in mount
 * order and the beacon was mounted first, so the first request of every new
 * visitor went out with no cookie and was stored with source NULL. That threw
 * away the acquisition source for roughly 12% of visitors, permanently for the
 * ~800 who only ever viewed one page.
 */
export function ensureSourceCookie(): void {
  if (typeof document === "undefined") return;
  if (document.cookie.includes(`${COOKIE_NAME}=`)) return; // first touch only

  const l = getLanding();
  if (!l) return;

  const src = classify(l);
  if (!src) return;

  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
    src.slice(0, 40)
  )}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}

/**
 * First-touch acquisition attribution. Renders null.
 *
 * On a visitor's first landing, with no cookie yet, it works out where they
 * came from, a referral link, a UTM tag, or the referring domain, and stores
 * that in a 90 day cookie. The signup action reads the cookie and saves it as
 * the account's source, and /api/page-view reads it off the request to
 * attribute traffic. Both feed the admin breakdown.
 *
 * The work lives in ensureSourceCookie() so the pageview beacon can call it
 * directly instead of depending on this component's effect having run first.
 * Keeping the component mounted still covers the routes where the beacon bails
 * out early, like /admin.
 */
export function SourceCapture() {
  React.useEffect(() => {
    ensureSourceCookie();
  }, []);

  return null;
}
