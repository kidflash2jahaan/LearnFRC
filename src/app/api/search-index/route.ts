import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * The flat index the site search reads: every department, and every lesson with
 * the department and module it sits in.
 *
 * Public, identical for everyone, and derived from published content only, so it
 * is cached hard and regenerated every 10 minutes. It uses the anon key with no
 * session persistence, which keeps it out of the cookie path entirely and lets
 * the whole response sit on the CDN.
 *
 * Lessons whose module or department did not resolve are dropped rather than
 * shipped with empty slugs, because a search hit that cannot build a URL is
 * worse than no hit at all.
 */
export const revalidate = 600;

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const [{ data: departments }, { data: lessons }] = await Promise.all([
    supabase
      .from("departments")
      .select("slug,name,tagline,icon,accent,difficulty")
      .order("sort_order"),
    supabase
      .from("lessons")
      .select("slug,title,summary, modules(slug, departments(slug,name))"),
  ]);

  const flatLessons = (lessons ?? [])
    .map((l: Record<string, unknown>) => {
      const m = l.modules as
        | { slug?: string; departments?: { slug?: string; name?: string } }
        | null;
      return {
        slug: l.slug as string,
        title: l.title as string,
        summary: (l.summary as string) ?? "",
        moduleSlug: m?.slug ?? "",
        deptSlug: m?.departments?.slug ?? "",
        deptName: m?.departments?.name ?? "",
      };
    })
    .filter((l) => l.deptSlug && l.moduleSlug);

  return NextResponse.json(
    { departments: departments ?? [], lessons: flatLessons },
    {
      headers: {
        "Cache-Control":
          "public, max-age=300, s-maxage=600, stale-while-revalidate=86400",
      },
    }
  );
}
