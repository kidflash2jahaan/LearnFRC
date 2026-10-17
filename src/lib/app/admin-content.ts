import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/app/http";
import { toIso } from "@/lib/app/format";
import { BAD_REQUEST, requireSiteRole } from "@/lib/app/admin-access";
import { fail, type AppUser, type Result } from "@/lib/app/result";

/**
 * The verified mark on a lesson, shared by the lesson page's control (the
 * setLessonVerified Server Action) and the app's
 * PUT /api/app/admin/lessons/{lessonId}/verified.
 *
 * The admin gate is checked here and not inherited from whatever rendered the
 * button. Both doors are public endpoints, and this one writes a public claim
 * about accuracy onto the site, so it has to prove the caller rather than
 * trust that the button was only shown to the right person.
 */

export async function setLessonVerifiedAs(
  user: AppUser,
  input: { lessonId: unknown; verified: unknown }
): Promise<Result<{ lessonId: string; verifiedAt: string | null }>> {
  const gate = await requireSiteRole(user, "admin", "not authorised");
  if (!gate.ok) return gate;

  if (typeof input.verified !== "boolean" || typeof input.lessonId !== "string")
    return fail("validation", BAD_REQUEST);
  const lessonId = input.lessonId;
  if (!isUuid(lessonId)) return fail("not_found", "That lesson no longer exists.");
  const verified = input.verified;

  const supabase = createAdminClient();
  // Who did the check, by public handle. `/fact-check` promises "by whom", and
  // the mark used to be written with nobody on it. Taking the mark off clears
  // the name with it, so a removed check never reads as somebody's.
  let verifiedBy: string | null = null;
  if (verified) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    verifiedBy = (prof?.username as string | null) ?? null;
  }

  const { data, error } = await supabase
    .from("lessons")
    .update({
      verified_at: verified ? new Date().toISOString() : null,
      verified_by: verifiedBy,
    })
    .eq("id", lessonId)
    .select("id, slug, verified_at, modules(slug, departments(slug))")
    .maybeSingle();

  if (error) return fail("server", "something went wrong on our side, try again");
  // An id that matches no lesson used to answer ok with a null date, which
  // reads as "mark removed" for a lesson that does not exist.
  if (!data) return fail("not_found", "That lesson no longer exists.");

  // Two caches, and clearing only one is a silent failure: the write lands but
  // the lesson keeps showing the old state for a day, which looks like it
  // worked. The tags drop the cached QUERY, revalidatePath drops the cached
  // RENDER of the page built from it.
  revalidateTag("lessons", "max");
  revalidateTag("catalog", "max");
  revalidatePath("/fact-check");

  const row = data as unknown as {
    id: string;
    slug: string;
    verified_at: string | null;
    modules: { slug: string; departments: { slug: string } | null } | null;
  };
  const dept = row.modules?.departments?.slug;
  const mod = row.modules?.slug;
  if (dept && mod && row.slug) revalidatePath(`/guides/${dept}/${mod}/${row.slug}`);

  return { ok: true, lessonId: row.id, verifiedAt: toIso(row.verified_at) };
}
