"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Tick or untick a lesson as verified.
 *
 * The date is stamped here rather than asked for, so verifying stays one click
 * and the badge still carries something a reader can weigh.
 *
 * Re-checks the admin gate on the server. The page already gates, but a Server
 * Action is a public endpoint: anything that trusts the page having rendered is
 * trusting the caller, and this one writes a claim of accuracy onto the site.
 */
export async function setLessonVerified(lessonId: string, verified: boolean) {
  const { isAdmin } = await getSession();
  if (!isAdmin) return { ok: false as const, error: "not authorised" };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("lessons")
    .update({ verified_at: verified ? new Date().toISOString() : null })
    .eq("id", lessonId)
    .select("slug, modules(slug, departments(slug))")
    .maybeSingle();

  if (error) return { ok: false as const, error: error.message };

  // Two different caches have to be cleared, and clearing only the first is a
  // silent failure: the tick saves, the admin count moves, and the lesson page
  // keeps saying "not verified yet" for a day. Tags drop the cached QUERY;
  // revalidatePath drops the cached RENDER of the page built from it.
  revalidateTag("lessons", "max");
  revalidateTag("catalog", "max");
  revalidatePath("/fact-check");

  const row = data as unknown as
    | { slug: string; modules: { slug: string; departments: { slug: string } | null } | null }
    | null;
  const dept = row?.modules?.departments?.slug;
  const mod = row?.modules?.slug;
  if (dept && mod && row?.slug) {
    revalidatePath(`/guides/${dept}/${mod}/${row.slug}`);
  }

  return { ok: true as const };
}
