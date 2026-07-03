import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.systemerr.com";

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
        ],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
