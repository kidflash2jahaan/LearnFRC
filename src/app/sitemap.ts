import type { MetadataRoute } from "next";
import { getAllDepartmentSlugs, getDepartmentBySlug } from "@/lib/queries";
import { getArticles } from "@/lib/queries";
import { PATHS } from "@/lib/paths-data";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Public, non-catalog routes. Home is top priority; legal pages are indexable
  // but low priority.
  const staticRoutes: MetadataRoute.Sitemap = [
    { path: "", priority: 1, freq: "weekly" as const },
    { path: "/guides", priority: 0.9, freq: "weekly" as const },
    { path: "/paths", priority: 0.7, freq: "weekly" as const },
    { path: "/glossary", priority: 0.7, freq: "monthly" as const },
    { path: "/resources", priority: 0.6, freq: "monthly" as const },
    { path: "/tools", priority: 0.8, freq: "monthly" as const },
    { path: "/tools/frc-budget-calculator", priority: 0.8, freq: "monthly" as const },
    { path: "/tools/frc-wire-gauge-calculator", priority: 0.8, freq: "monthly" as const },
    { path: "/tools/frc-tipping-calculator", priority: 0.8, freq: "monthly" as const },
    { path: "/tools/frc-current-budget", priority: 0.8, freq: "monthly" as const },
    { path: "/leaderboard", priority: 0.5, freq: "daily" as const },
    { path: "/blog", priority: 0.8, freq: "weekly" as const },
    { path: "/for-teams", priority: 0.7, freq: "monthly" as const },
    { path: "/contributions", priority: 0.4, freq: "daily" as const },
    { path: "/terms", priority: 0.2, freq: "yearly" as const },
    { path: "/privacy", priority: 0.2, freq: "yearly" as const },
  ].map((r) => ({
    url: `${SITE}${r.path}`,
    lastModified: now,
    changeFrequency: r.freq,
    priority: r.priority,
  }));

  const blogRoutes: MetadataRoute.Sitemap = (await getArticles()).map((a) => ({
    url: `${SITE}/blog/${a.slug}`,
    lastModified: new Date(`${a.date}T12:00:00`),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const pathRoutes: MetadataRoute.Sitemap = PATHS.map((p) => ({
    url: `${SITE}/paths/${p.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  try {
    // Reuse the durably-cached content-layer functions (anon public client, no
    // cookies) so the sitemap never adds fresh DB egress on the hot path.
    const slugs = await getAllDepartmentSlugs();
    const depts = await Promise.all(
      slugs.map((s) => getDepartmentBySlug(s).catch(() => null))
    );

    const deptRoutes: MetadataRoute.Sitemap = slugs.map((slug) => ({
      url: `${SITE}/guides/${slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    const lessonRoutes: MetadataRoute.Sitemap = [];
    for (const d of depts) {
      if (!d) continue;
      for (const m of d.modules) {
        for (const l of m.lessons) {
          lessonRoutes.push({
            url: `${SITE}/guides/${d.slug}/${m.slug}/${l.slug}`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.6,
          });
        }
      }
    }

    return [
      ...staticRoutes,
      ...blogRoutes,
      ...pathRoutes,
      ...deptRoutes,
      ...lessonRoutes,
    ];
  } catch {
    return [...staticRoutes, ...blogRoutes, ...pathRoutes];
  }
}
