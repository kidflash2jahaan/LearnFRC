import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { classesDevSwitches, classesVisible, evaluateSwitches } from "@/lib/classes/config";
import { listUpcomingClasses } from "@/lib/app/classes";
import type { ClassListing } from "@/lib/classes/types";

/**
 * Live classes on the site's statically cached pages: the root layout (nav and
 * footer), the homepage, the privacy policy, the terms and the sitemap
 * (classes-design.md section 11).
 *
 * Those pages are prerendered and served from the cache, so they can't call
 * classesVisible() on every request the way /classes does. Instead:
 *
 * - While the CLASSES_VISIBLE env var is off (production today, and any
 *   release that ships without classes), nothing here touches the database or
 *   the data cache, so the pages render exactly as they do without classes.
 * - Once it's on, the database switch (class_settings.classes_visible) is read
 *   through unstable_cache under CLASSES_VISIBILITY_TAG. Its daily floor
 *   matches the catalog cache every page already carries through the footer,
 *   so it adds no page regeneration. The homepage's three classes are cached
 *   for LISTING_SECONDS under CLASSES_LISTING_TAG.
 * - Whatever writes the switch (the /admin/classes visibility toggle) calls
 *   refreshClassesOnStaticPages() right after, so every cached page follows
 *   the switch on its next visit instead of at the next deploy or daily
 *   refresh. Without it, release day's "turn visibility on" (15.4 step 8)
 *   would leave the nav and homepage without classes for up to a day.
 *
 * Dev servers with CLASSES_DEV_SWITCHES=1 skip the cache: classes show.
 */

/** Tag on every page that shows the nav, the footer or the legal pages' classes sections. */
export const CLASSES_VISIBILITY_TAG = "classes-visibility";
/** Tag on the homepage's list of upcoming classes. */
export const CLASSES_LISTING_TAG = "classes-listing";

/** How often the homepage's classes refresh at most (seats left, live now). */
const LISTING_SECONDS = 600;
/** The visibility switch's floor, the same day the catalog cache uses. */
const VISIBILITY_SECONDS = 86400;
/** How many classes the homepage shows. */
export const HOME_CLASS_COUNT = 3;

/**
 * Whether this deployment's environment lets classes show at all, before the
 * database switch is read: CLASSES_VISIBLE=1, or CLASSES_DEV_SWITCHES=1 on a
 * dev server. The Foundation's evaluateSwitches decides, with the database
 * side assumed on. Reads only env vars, so it costs nothing.
 */
export function classesEnvAllows(): boolean {
  return evaluateSwitches({
    nodeEnv: process.env.NODE_ENV,
    devSwitches: process.env.CLASSES_DEV_SWITCHES,
    envVisible: process.env.CLASSES_VISIBLE,
    dbVisible: true,
    dbJoinsPaused: true,
  }).visible;
}

const visibleCached = unstable_cache(async () => classesVisible(), ["classes-static-visible", "v1"], {
  revalidate: VISIBILITY_SECONDS,
  tags: [CLASSES_VISIBILITY_TAG],
});

/**
 * classesVisible() for cached pages: both switches on. False without a
 * database read while the env switch is off, and false if the read fails
 * (classes can only fail closed).
 */
export async function classesVisibleOnStaticPages(): Promise<boolean> {
  if (!classesEnvAllows()) return false;
  if (classesDevSwitches()) return true;
  try {
    return await visibleCached();
  } catch (e) {
    console.error("classesVisibleOnStaticPages:", (e as Error).message);
    return false;
  }
}

const homeClassesCached = unstable_cache(
  async () => {
    const r = await listUpcomingClasses({ limit: HOME_CLASS_COUNT });
    return { visible: r.visible, classes: r.classes };
  },
  ["classes-static-home", "v1"],
  { revalidate: LISTING_SECONDS, tags: [CLASSES_LISTING_TAG, CLASSES_VISIBILITY_TAG] }
);

/**
 * The homepage's next classes, the same listing /classes and the app use
 * (listUpcomingClasses, soonest first, this deployment's app only), read
 * signed out: `teacher` is always null, so the cached HTML never carries a
 * handle. Null when classes aren't visible; an empty list is the empty state.
 */
export async function homeClasses(): Promise<ClassListing[] | null> {
  if (!classesEnvAllows()) return null;
  try {
    const r = classesDevSwitches()
      ? await listUpcomingClasses({ limit: HOME_CLASS_COUNT })
      : await homeClassesCached();
    if (!r.visible) return null;
    // Belt and braces: a signed-out read has no teacher, but the homepage is
    // cached for everyone, so it never keeps one.
    return r.classes.slice(0, HOME_CLASS_COUNT).map((c) => ({ ...c, teacher: null, enrolled: null }));
  } catch (e) {
    console.error("homeClasses:", (e as Error).message);
    return null;
  }
}

/**
 * Call after writing class_settings.classes_visible (the /admin/classes
 * toggle), from a Server Action or Route Handler. Expires both tags at once,
 * so the next visit to any page renders with the new switch: the nav entry,
 * the footer link, the homepage section and hero line, the legal pages'
 * classes sections and the sitemap entries all follow it.
 */
export function refreshClassesOnStaticPages(): void {
  revalidateTag(CLASSES_VISIBILITY_TAG, { expire: 0 });
  revalidateTag(CLASSES_LISTING_TAG, { expire: 0 });
}

/**
 * Optional, after scheduling, canceling or ending a class: marks the
 * homepage's list stale so it refreshes on its next visit rather than within
 * LISTING_SECONDS. Doesn't touch any other page.
 */
export function refreshHomeClassListing(): void {
  revalidateTag(CLASSES_LISTING_TAG, "max");
}
