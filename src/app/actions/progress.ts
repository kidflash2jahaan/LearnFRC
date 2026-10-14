"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { completeLesson, uncompleteLesson } from "@/lib/app/progress";
import { clientsFor } from "@/lib/app/result";

/**
 * The website's door onto lesson completion. The rules themselves (quiz gate,
 * rate limits, the service-role insert, achievements, funnel events,
 * revalidation) live in src/lib/app/progress.ts, shared with the app's
 * /api/app/progress/complete route, so the two can't drift.
 */
export async function setLessonComplete(
  lessonId: string,
  deptSlug: string,
  completed: boolean,
  answers?: number[]
): Promise<{ ok?: boolean; error?: string; completed?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const clients = clientsFor(supabase);
  const result = completed
    ? await completeLesson(user, clients, { lessonId, answers, deptSlug })
    : await uncompleteLesson(user, clients, { lessonId, deptSlug });
  if (!result.ok) return { error: result.error };
  return { ok: true, completed };
}

export async function toggleBookmark(
  lessonId: string,
  bookmarked: boolean
): Promise<{ ok?: boolean; error?: string; bookmarked?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  if (bookmarked) {
    const { error } = await supabase
      .from("bookmarks")
      .upsert(
        { user_id: user.id, lesson_id: lessonId },
        { onConflict: "user_id,lesson_id", ignoreDuplicates: true }
      );
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("user_id", user.id)
      .eq("lesson_id", lessonId);
    if (error) return { error: error.message };
  }
  revalidatePath("/bookmarks");
  return { ok: true, bookmarked };
}
