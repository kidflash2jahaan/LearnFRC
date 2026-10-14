import "server-only";
import { createHash } from "node:crypto";
import {
  GLOSSARY,
  GLOSSARY_CATEGORIES,
  glossarySlug,
  type GlossaryTerm,
} from "@/lib/glossary-data";
import { PATHS, type LearningPath } from "@/lib/paths-data";
import { LESSON_BRIDGE } from "@/lib/lesson-bridge";
import { START_GOALS, type StartGoal } from "@/lib/recommend";

/**
 * Reference data that lives in the site's TypeScript rather than the database,
 * served to the app by GET /api/app/reference. Built straight from the same
 * modules the site renders from, so editing the glossary, a learning path, a
 * lesson's "read next" articles or the start goals on the site updates the app
 * on its next refresh, with no app release.
 */

export type ReferencePayload = {
  /** The site's glossary terms, each with the slug its /glossary page uses. */
  glossary: (GlossaryTerm & { slug: string })[];
  glossaryCategories: string[];
  paths: LearningPath[];
  /** Lesson id to the slugs of the articles worth reading next, in order. */
  lessonBridge: Record<string, string[]>;
  startGoals: StartGoal[];
  /** Changes whenever anything above changes. */
  version: string;
};

let cached: ReferencePayload | null = null;

/** Built once per server instance: the inputs are compiled into the bundle. */
export function buildReference(): ReferencePayload {
  if (cached) return cached;

  const lessonBridge: Record<string, string[]> = {};
  for (const [lessonId, articles] of Object.entries(LESSON_BRIDGE)) {
    const slugs = articles
      .map((a) => /^\/blog\/([^/?#]+)/.exec(a.href)?.[1])
      .filter((s): s is string => !!s);
    if (slugs.length) lessonBridge[lessonId] = slugs;
  }

  const body = {
    glossary: GLOSSARY.map((t) => ({ ...t, slug: glossarySlug(t.term) })),
    glossaryCategories: [...GLOSSARY_CATEGORIES],
    paths: PATHS,
    lessonBridge,
    startGoals: START_GOALS,
  };
  const version = createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex")
    .slice(0, 16);

  cached = { ...body, version };
  return cached;
}
