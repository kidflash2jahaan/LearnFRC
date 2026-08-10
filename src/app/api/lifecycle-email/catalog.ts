import "server-only";
import { getDepartments, getDepartmentBySlug } from "@/lib/queries";
import type { CatalogLesson } from "./segments";

/**
 * Flat, ordered list of every lesson (dept -> module -> lesson order) plus the
 * department each one belongs to, so the job can name a learner's next lesson
 * inside the department they were actually working in.
 *
 * Uses the durably cached content functions, so it adds no real DB egress on a
 * cron run. Kept apart from ./segments.ts so that the policy module stays pure
 * and importable from the founder-facing retention panel.
 */
export async function orderedLessons(): Promise<CatalogLesson[]> {
  const depts = await getDepartments().catch(() => []);
  const out: CatalogLesson[] = [];
  for (const d of depts) {
    const full = await getDepartmentBySlug(d.slug).catch(() => null);
    if (!full) continue;
    for (const m of full.modules) {
      for (const l of m.lessons) {
        out.push({
          id: l.id,
          title: l.title,
          summary: l.summary,
          href: `/guides/${full.slug}/${m.slug}/${l.slug}`,
          departmentSlug: full.slug,
          departmentName: full.name,
        });
      }
    }
  }
  return out;
}
