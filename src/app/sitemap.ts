import type { MetadataRoute } from "next";
import type { DeptWithModules, ModuleRow } from "@/lib/queries";
import { getAllDepartmentSlugs, getDepartmentBySlug } from "@/lib/queries";
import { getArticles } from "@/lib/queries";
import { PATHS } from "@/lib/paths-data";
import { GLOSSARY, glossarySlug, hasGlossaryDepth } from "@/lib/glossary-data";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

// ISR: hourly. revalidatePath('/sitemap.xml') does NOT invalidate this route in
// this Next fork (metadata routes aren't matched by path revalidation), which
// silently left newly published articles out of the sitemap. An hourly floor is
// the reliable fix and costs one small route regeneration per hour; fast
// discovery is already handled by the IndexNow ping in /api/revalidate.
export const revalidate = 3600;

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
    newest = Math.max(newest, moduleLastModified(m).getTime());
  }
  return new Date(newest);
}

/**
 * Same idea one level down: a module hub page (/guides/<dept>/<module>) renders
 * its own overview plus the title + summary of every lesson it contains, so it
 * is genuinely modified whenever any of those rows is.
 */
function moduleLastModified(m: ModuleRow): Date {
  let newest = rowDate(m.created_at).getTime();
  for (const l of m.lessons ?? []) {
    newest = Math.max(newest, rowDate(l.created_at).getTime());
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
    { path: "/blog", lastModified: STATIC_UPDATED },
    // Orphan rescue. /about is a 200, index/follow, self-canonical page, but
    // the only references to it anywhere in the rendered HTML are
    // `<link rel="author">` and the JSON-LD `Person.url` — not one crawlable
    // <a href> on any of the 683 sitemap pages. Without this entry Google has
    // no ordinary path to the page that says who writes this site and how it's
    // reviewed, which is the exact signal an authority-starved domain needs.
    { path: "/about", lastModified: STATIC_UPDATED },
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
  //
  // /glossary/[term] serves `robots: { index: false }` to any term that fails
  // `hasGlossaryDepth` (no hand-written "in a match" section). Listing such a
  // term here would ask Google to spend a crawl on a URL we then refuse to
  // index — the purest form of wasted crawl budget. All 70 terms pass today,
  // so this filter removes nothing right now; it exists so that adding a
  // stub term can never silently reintroduce that waste.
  const glossaryRoutes: MetadataRoute.Sitemap = GLOSSARY.filter(
    hasGlossaryDepth
  ).map((t) => ({
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

    // The middle tier: one hub per department+module. Every lesson URL already
    // contained this path segment, but the segment had no page until now — so
    // these ~100 URLs are brand new to crawlers and belong in the sitemap.
    const moduleRoutes: MetadataRoute.Sitemap = [];
    const lessonRoutes: MetadataRoute.Sitemap = [];
    for (const d of depts) {
      if (!d) continue;
      for (const m of d.modules) {
        moduleRoutes.push({
          url: `${SITE}/guides/${d.slug}/${m.slug}`,
          lastModified: moduleLastModified(m),
        });
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
      ...moduleRoutes,
      ...lessonRoutes,
    ];
  } catch {
    return [...staticRoutes, ...blogRoutes, ...pathRoutes, ...glossaryRoutes];
  }
}
