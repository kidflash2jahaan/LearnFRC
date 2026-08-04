import type { MetadataRoute } from "next";
import type { DeptWithModules } from "@/lib/queries";
import { getAllDepartmentSlugs, getDepartmentBySlug } from "@/lib/queries";
import { getArticles } from "@/lib/queries";
import { PATHS } from "@/lib/paths-data";
import { GLOSSARY, glossarySlug } from "@/lib/glossary-data";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

// ISR: regenerate daily as a slow background floor. New DB content is pushed
// into the sitemap immediately on publish via /api/revalidate?paths=/sitemap.xml,
// so the interval only needs to be a safety net — hourly was needless ISR churn.
export const revalidate = 86400;

// ─── lastmod ───────────────────────────────────────────────────────────────
// `lastmod` is only worth emitting if it's honest. Stamping `new Date()` on
// every URL made the whole sitemap look like it changed on every regeneration,
// which teaches crawlers to ignore the field entirely. Catalog URLs now carry
// their real row timestamp; everything hand-authored carries a fixed date that
// only moves when a human bumps the constant below.

/** Site launch — the floor for any URL with no real per-row timestamp. */
const LAUNCH = new Date("2026-06-20T00:00:00Z");

// Bump these by hand when that section's content actually changes. They are
// deliberately coarse: one date per group of hand-authored pages.
const STATIC_UPDATED = new Date("2026-08-03T00:00:00Z");
const TOOLS_UPDATED = new Date("2026-08-03T00:00:00Z");
const PATHS_UPDATED = new Date("2026-08-03T00:00:00Z");
const GLOSSARY_UPDATED = new Date("2026-08-03T00:00:00Z");

/** A DB timestamp, or the launch date if the row somehow has none. */
function rowDate(ts?: string | null): Date {
  if (!ts) return LAUNCH;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? LAUNCH : d;
}

/**
 * A department page lists its modules and lessons, so it's genuinely modified
 * whenever any of them is added — take the newest timestamp in the subtree.
 */
function deptLastModified(d: DeptWithModules): Date {
  let newest = rowDate(d.created_at).getTime();
  for (const m of d.modules) {
    newest = Math.max(newest, rowDate(m.created_at).getTime());
    for (const l of m.lessons) {
      newest = Math.max(newest, rowDate(l.created_at).getTime());
    }
  }
  return new Date(newest);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Public, non-catalog routes. `changeFrequency` and `priority` are omitted
  // throughout — Google ignores both.
  const staticRoutes: MetadataRoute.Sitemap = [
    { path: "", lastModified: STATIC_UPDATED },
    { path: "/guides", lastModified: STATIC_UPDATED },
    { path: "/paths", lastModified: PATHS_UPDATED },
    { path: "/glossary", lastModified: GLOSSARY_UPDATED },
    { path: "/resources", lastModified: STATIC_UPDATED },
    { path: "/tools", lastModified: TOOLS_UPDATED },
    { path: "/tools/frc-budget-calculator", lastModified: TOOLS_UPDATED },
    { path: "/tools/frc-wire-gauge-calculator", lastModified: TOOLS_UPDATED },
    { path: "/tools/frc-tipping-calculator", lastModified: TOOLS_UPDATED },
    { path: "/tools/frc-current-budget", lastModified: TOOLS_UPDATED },
    { path: "/tools/frc-deflection-calculator", lastModified: TOOLS_UPDATED },
    { path: "/leaderboard", lastModified: STATIC_UPDATED },
    { path: "/blog", lastModified: STATIC_UPDATED },
    { path: "/for-teams", lastModified: STATIC_UPDATED },
    { path: "/contributions", lastModified: STATIC_UPDATED },
    { path: "/terms", lastModified: LAUNCH },
    { path: "/privacy", lastModified: LAUNCH },
  ].map((r) => ({
    url: `${SITE}${r.path}`,
    lastModified: r.lastModified,
  }));

  const blogRoutes: MetadataRoute.Sitemap = (await getArticles()).map((a) => ({
    url: `${SITE}/blog/${a.slug}`,
    lastModified: new Date(`${a.date}T12:00:00`),
  }));

  const pathRoutes: MetadataRoute.Sitemap = PATHS.map((p) => ({
    url: `${SITE}/paths/${p.slug}`,
    lastModified: PATHS_UPDATED,
  }));

  // Per-term glossary pages — one indexable URL per defined term.
  const glossaryRoutes: MetadataRoute.Sitemap = GLOSSARY.map((t) => ({
    url: `${SITE}/glossary/${glossarySlug(t.term)}`,
    lastModified: GLOSSARY_UPDATED,
  }));

  try {
    // Reuse the durably-cached content-layer functions (anon public client, no
    // cookies) so the sitemap never adds fresh DB egress on the hot path.
    const slugs = await getAllDepartmentSlugs();
    const depts = await Promise.all(
      slugs.map((s) => getDepartmentBySlug(s).catch(() => null))
    );

    // Index-aligned with `slugs`, so a department that failed to load still
    // gets its URL — just with the launch-date floor instead of a real one.
    const deptRoutes: MetadataRoute.Sitemap = slugs.map((slug, i) => {
      const d = depts[i];
      return {
        url: `${SITE}/guides/${slug}`,
        lastModified: d ? deptLastModified(d) : LAUNCH,
      };
    });

    const lessonRoutes: MetadataRoute.Sitemap = [];
    for (const d of depts) {
      if (!d) continue;
      for (const m of d.modules) {
        for (const l of m.lessons) {
          lessonRoutes.push({
            url: `${SITE}/guides/${d.slug}/${m.slug}/${l.slug}`,
            lastModified: rowDate(l.created_at),
          });
        }
      }
    }

    return [
      ...staticRoutes,
      ...blogRoutes,
      ...pathRoutes,
      ...glossaryRoutes,
      ...deptRoutes,
      ...lessonRoutes,
    ];
  } catch {
    return [...staticRoutes, ...blogRoutes, ...pathRoutes, ...glossaryRoutes];
  }
}
