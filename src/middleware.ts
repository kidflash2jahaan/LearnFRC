import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * The old staging host. Its links are burned into Chief Delphi threads the
 * owner can no longer edit, so instead of Vercel's domain-level 308 (which
 * loses attribution whenever the browser strips the Referer) the app handles
 * the redirect itself and STAMPS the acquisition source into the target URL.
 */
const LEGACY_HOSTS = new Set([
  "learnfrc.systemerr.com",
  "www.learnfrc.systemerr.com",
]);

/** Map a Referer header to the same source labels SourceCapture derives.
    No referrer defaults to Chief Delphi — the legacy links live almost
    exclusively in CD threads. */
function referrerSource(referer: string | null): string {
  if (!referer) return "Chief Delphi";
  let host = "";
  try {
    host = new URL(referer).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "Chief Delphi";
  }
  if (host.includes("learnfrc")) return "Chief Delphi";
  if (host.includes("chiefdelphi")) return "Chief Delphi";
  if (host === "x.com" || host.endsWith(".x.com") || host === "t.co" || host.includes("twitter"))
    return "Twitter";
  const map: [string, string][] = [
    ["google", "Google"],
    ["reddit", "Reddit"],
    ["youtu", "YouTube"],
    ["bing", "Bing"],
    ["duckduckgo", "DuckDuckGo"],
    ["facebook", "Facebook"],
    ["discord", "Discord"],
    ["instagram", "Instagram"],
    ["linkedin", "LinkedIn"],
  ];
  return map.find(([k]) => host.includes(k))?.[1] ?? "Other";
}

/**
 * Hosts allowed to be indexed. Every other host that serves this app — the
 * *.vercel.app production alias and every preview deployment — serves the exact
 * same pages and would be crawled as duplicate content, so those get
 * `X-Robots-Tag: noindex, nofollow`. Local hosts are allow-listed so dev and
 * Playwright QA see the same headers as production.
 */
const INDEXABLE_HOSTS = new Set([
  "learnfrc.com",
  "www.learnfrc.com",
  "localhost",
  "127.0.0.1",
  "[::1]",
]);

function requestHostname(request: NextRequest): string {
  const host = request.headers.get("host");
  if (!host) return request.nextUrl.hostname.toLowerCase();
  try {
    // URL parsing strips the port and normalizes IPv6 ("[::1]:3000" -> "[::1]").
    return new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return request.nextUrl.hostname.toLowerCase();
  }
}

export async function middleware(request: NextRequest) {
  // Legacy staging host -> apex, same path/query, 308 (permanent, so the link
  // equity transfers).
  //
  // Attribution rides in the lf_src COOKIE, not a utm_ query param, and that
  // distinction matters more than it looks: Search Console shows 34 of this
  // site's 38 external backlinks pointing at this legacy host — it is by far
  // the most valuable inbound path we have. Redirecting those links to a
  // parameterised URL would hand every crawler a non-canonical destination and
  // muddy the consolidation of the one authority signal that counts. The
  // cookie keeps first-touch attribution working (the page-view beacon and the
  // signup action both read lf_src server-side) while crawlers and humans land
  // on the clean canonical URL.
  const hostname = requestHostname(request);
  if (LEGACY_HOSTS.has(hostname)) {
    const url = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      "https://learnfrc.com"
    );
    const res = NextResponse.redirect(url, 308);
    // Never overwrite an existing first-touch source, and let an explicit
    // ?ref= referral win — SourceCapture treats that as "Referral".
    if (!request.cookies.get("lf_src") && !url.searchParams.has("ref")) {
      res.cookies.set("lf_src", referrerSource(request.headers.get("referer")), {
        path: "/",
        maxAge: 60 * 60 * 24 * 90,
        sameSite: "lax",
        // readable by SourceCapture, which short-circuits when it is present
        httpOnly: false,
      });
    }
    return res;
  }

  const response = await updateSession(request);

  // Never redirect — previews have to stay usable — just mark them noindex.
  if (!INDEXABLE_HOSTS.has(requestHostname(request))) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets:
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
