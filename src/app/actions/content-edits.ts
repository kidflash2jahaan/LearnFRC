"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

/**
 * A signed-in user proposes a new version of a lesson's markdown. Stored as a
 * pending suggestion; the admin is emailed and reviews it in /admin.
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

/** Admin-only: accept (apply to the lesson) or reject a suggested edit. */
export async function reviewContentEdit(
  editId: string,
  decision: "accepted" | "rejected",
  overrideContent?: string
): Promise<{ ok?: boolean; error?: string }> {
  const { user, isAdmin } = await getSession();
  if (!isAdmin) return { error: "Not authorized." };

  const admin = createAdminClient();
  const { data: edit } = await admin
    .from("content_edits")
    .select("id, content_type, lesson_id, article_id, proposed_content, status")
    .eq("id", editId)
    .maybeSingle();
  if (!edit) return { error: "Suggestion not found." };
  if (edit.status !== "pending") return { error: "This suggestion was already reviewed." };

  if (decision === "accepted") {
    const isArticle = edit.content_type === "article";
    // The admin can tweak the proposed content before publishing it
    // (edit-before-accept). Fall back to the submitter's version if untouched.
    const content =
      typeof overrideContent === "string" && overrideContent.trim().length
        ? overrideContent
        : (edit.proposed_content as string);
    if (content.trim().length < 20)
      return { error: "The edited content is too short to publish." };
    const { error } = await admin
      .from(isArticle ? "articles" : "lessons")
      .update({ content })
      .eq("id", (isArticle ? edit.article_id : edit.lesson_id) as string);
    if (error) return { error: error.message };
    // Bust the cached content layer so the change goes live (this fork's
    // revalidateTag takes a stale-while-revalidate window; "max" per docs).
    revalidateTag("catalog", "max");
  }

  await admin
    .from("content_edits")
    .update({
      status: decision,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id ?? null,
    })
    .eq("id", editId);

  revalidatePath("/admin");
  return { ok: true };
}
