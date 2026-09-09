"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Mark the lesson you are reading as verified, or take the mark back off.
 *
 * Called from the control that sits on the lesson page itself, because that is
 * where the work happens: you verify a lesson by reading it, so the button
 * belongs at the bottom of the thing you just read rather than on a list
 * somewhere else.
 *
 * The admin gate is re-checked here and not inherited from whatever rendered
 * the button. A Server Action is a public endpoint, and this one writes a
 * public claim about accuracy onto the site, so it has to prove the caller
 * rather than trust that the button was only shown to the right person.
 */
export async function setLessonVerified(lessonId: string, verified: boolean) {
  const { isAdmin } = await getSession();
  if (!isAdmin) return { ok: false as const, error: "not authorised" };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("lessons")
    .update({ verified_at: verified ? new Date().toISOString() : null })
    .eq("id", lessonId)
    .select("slug, verified_at, modules(slug, departments(slug))")
    .maybeSingle();

  if (error) return { ok: false as const, error: error.message };

  // Two caches, and clearing only one is a silent failure: the write lands but
  // the lesson keeps showing the old state for a day, which looks like it
  // worked. The tags drop the cached QUERY, revalidatePath drops the cached
  // RENDER of the page built from it.
  revalidateTag("lessons", "max");
  revalidateTag("catalog", "max");
  revalidatePath("/fact-check");

  const row = data as unknown as
    | {
        slug: string;
        verified_at: string | null;
        modules: { slug: string; departments: { slug: string } | null } | null;
      }
    | null;
  const dept = row?.modules?.departments?.slug;
  const mod = row?.modules?.slug;
  if (dept && mod && row?.slug) revalidatePath(`/guides/${dept}/${mod}/${row.slug}`);

  return { ok: true as const, verifiedAt: row?.verified_at ?? null };
}
