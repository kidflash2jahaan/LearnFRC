"use server";

import { createClient } from "@/lib/supabase/server";
import { setLessonVerifiedAs } from "@/lib/app/admin-content";

/**
 * Mark the lesson you are reading as verified, or take the mark back off.
 *
 * Called from the control that sits on the lesson page itself, because that is
 * where the work happens: you verify a lesson by reading it, so the button
 * belongs at the bottom of the thing you just read rather than on a list
 * somewhere else.
 *
 * The website's door onto setLessonVerifiedAs (src/lib/app/admin-content.ts),
 * shared with the app's PUT /api/app/admin/lessons/{lessonId}/verified. The
 * admin gate is re-checked there and not inherited from whatever rendered the
 * button: a Server Action is a public endpoint, and this one writes a public
 * claim about accuracy onto the site.
 */
export async function setLessonVerified(
  lessonId: string,
  verified: boolean
): Promise<{ ok: true; verifiedAt: string | null } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not authorised" };

  const result = await setLessonVerifiedAs(user, { lessonId, verified });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, verifiedAt: result.verifiedAt };
}
