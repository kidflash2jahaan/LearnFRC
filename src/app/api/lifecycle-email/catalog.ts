import "server-only";
import { getDepartments, getDepartmentBySlug } from "@/lib/queries";
import type { CatalogLesson } from "./segments";

/**
 * Every lesson in the binder, flattened into one ordered list, department then
 * module then lesson, with the department each one belongs to carried along. The
 * order is what lets the job name a learner's next lesson inside the department
 * they were actually working in, rather than the first one in the catalogue.
 *
 * It reads through the durably cached content functions, so a cron run adds no
 * real database egress. It lives apart from ./segments.ts so the policy module
 * stays pure and can be imported by the founder-facing retention panel.
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
