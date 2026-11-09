/**
 * The URL scrubber behind <SiteAnalytics />'s `beforeSend` (classes-design.md
 * section 11, Vercel's `beforeSend` [S47]). No imports, so `node --test` runs
 * it (site-analytics.test.ts).
 *
 * Some pages carry something private in their path: a parent's decision page
 * under /classes/parent/, an hours letter at /letters/<code> and its public
 * check at /verify/<code>. Vercel Web Analytics records each page view's URL
 * and Speed Insights each vital's, so before either leaves the browser any URL
 * under those prefixes is cut back to the bare prefix, with no query string or
 * fragment. The parent link's route handler already keeps its token out of
 * page URLs (it sets a cookie and redirects); this is the backstop.
 */

/** Paths whose rest is never sent, each with its trailing slash. */
export const REDACTED_PATH_PREFIXES = ["/classes/parent/", "/letters/", "/verify/"] as const;

/** The prefix `pathname` falls under, or null. Case-insensitive, like a typo'd link. */
function redactedPrefixFor(pathname: string): string | null {
  const p = pathname.toLowerCase();
  for (const prefix of REDACTED_PATH_PREFIXES) {
    // "/verify/abc" and "/verify" both count; "/verifying" doesn't.
    if (p.startsWith(prefix) || p === prefix.slice(0, -1)) return prefix;
  }
  return null;
}

/**
 * `url` unchanged, or cut back to its origin plus the redacted prefix:
 *   https://learnfrc.com/verify/LF-ABCDE-12345?x=1  ->  https://learnfrc.com/verify/
 * Works on absolute URLs (what both libraries send) and on bare paths.
 */
export function redactAnalyticsUrl(url: string): string {
  if (typeof url !== "string" || url === "") return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // A path with no origin: match on the path part alone.
    const path = url.split(/[?#]/, 1)[0];
    const prefix = redactedPrefixFor(path);
    return prefix ?? url;
  }
  const prefix = redactedPrefixFor(parsed.pathname);
  return prefix ? `${parsed.origin}${prefix}` : url;
}

/**
 * The `beforeSend` both <Analytics /> and <SpeedInsights /> get. Every event
 * goes out, with its URL scrubbed; nothing else about it changes.
 */
export function analyticsBeforeSend<T extends { url: string }>(event: T): T {
  const url = redactAnalyticsUrl(event.url);
  return url === event.url ? event : { ...event, url };
}
