import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Auth-gated / private / non-content routes. Public profiles (/u/*) and
        // the public catalog stay crawlable.
        disallow: [
          "/admin",
          "/dashboard",
          "/settings",
          "/profile",
          "/bookmarks",
          "/certificate",
          "/teams",
          "/join",
          "/api/",
          // Password/e-mail plumbing. Every one of these is `noindex` already
          // and none is linked from a crawlable page, so blocking them costs
          // nothing and keeps one-time token URLs out of the crawl entirely.
          "/auth/",
          "/account/",
          "/forgot-password",
          "/unsubscribe",
          // ── The single largest crawl-budget sink on this domain ──
          // Sign-in CTAs carry the current page in `?next=` (and sometimes
          // `&ref=`), so /login and /signup fan out into ONE UNIQUE URL PER
          // PAGE: 394 distinct /login?… and 976 distinct /signup?… were
          // measured across the 683 sitemap pages. Every one returns 200 with
          // `noindex` and no canonical, so Google spends crawls on ~1,370
          // URLs — twice the size of the entire sitemap — that can never be
          // indexed. That is crawl budget stolen from lesson pages.
          //
          // Only the PARAMETERISED forms are blocked. Bare /login and /signup
          // stay crawlable on purpose: a disallowed URL can't be fetched, so
          // Google would never see their `noindex` and could still surface a
          // URL-only result. Leaving the two canonical entry points open keeps
          // that meta tag readable while the 1,370 dead ends disappear.
          "/login?",
          "/signup?",
        ],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
