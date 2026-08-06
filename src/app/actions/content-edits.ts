"use server";

import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

/**
 * A signed-in user proposes a new version of a lesson's or article's markdown.
 * Stored as a pending suggestion; the scheduled moderation routine reviews the
 * queue through /api/moderation and the result shows up on /contributions.
 */
export async function submitContentEdit(input: {
  contentType?: "lesson" | "article";
  targetId: string;
  title: string;
  path: string;
  proposedContent: string;
  note?: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const contentType = input.contentType ?? "lesson";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in to suggest an edit." };

  const proposed = (input.proposedContent || "").trim();
  if (proposed.length < 20) return { error: "The edited content looks too short." };
  if (proposed.length > 100_000) return { error: "That edit is too large to submit." };

  if (!(await rateLimit("suggest-edit", 8, 3600, user.id)))
    return { error: "You've submitted several edits recently — try again in a bit." };

  // Snapshot the current content so the admin sees a true diff.
  const { data: current } = await supabase
    .from(contentType === "article" ? "articles" : "lessons")
    .select("content")
    .eq("id", input.targetId)
    .maybeSingle();
  if (!current) return { error: `${contentType === "article" ? "Article" : "Lesson"} not found.` };
  if (proposed === ((current.content as string) ?? "").trim())
    return { error: "This is identical to the current version — nothing to submit." };

  const { error } = await supabase.from("content_edits").insert({
    content_type: contentType,
    lesson_id: contentType === "lesson" ? input.targetId : null,
    article_id: contentType === "article" ? input.targetId : null,
    editor_id: user.id,
    original_content: (current.content as string) ?? "",
    proposed_content: proposed,
    note: input.note?.slice(0, 1000) || null,
  });
  if (error) return { error: error.message };

  // No admin notification on submit — the daily moderation routine reviews the
  // queue and emails a digest only when it actually acts on something.
  return { ok: true };
}
