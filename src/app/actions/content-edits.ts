"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { sendEmail, adminNotifyHtml } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

/**
 * A signed-in user proposes a new version of a lesson's markdown. Stored as a
 * pending suggestion; the admin is emailed and reviews it in /admin.
 */
export async function submitContentEdit(input: {
  lessonId: string;
  lessonTitle: string;
  lessonPath: string;
  proposedContent: string;
  note?: string;
}): Promise<{ ok?: boolean; error?: string }> {
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
  const { data: lesson } = await supabase
    .from("lessons")
    .select("content")
    .eq("id", input.lessonId)
    .maybeSingle();
  if (!lesson) return { error: "Lesson not found." };
  if (proposed === (lesson.content ?? "").trim())
    return { error: "This is identical to the current version — nothing to submit." };

  const { error } = await supabase.from("content_edits").insert({
    lesson_id: input.lessonId,
    editor_id: user.id,
    original_content: lesson.content ?? "",
    proposed_content: proposed,
    note: input.note?.slice(0, 1000) || null,
  });
  if (error) return { error: error.message };

  // Notify the admin (stored Resend key). Never blocks the user on email issues.
  const admin = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim();
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  if (admin) {
    await sendEmail({
      to: admin,
      subject: `✏️ Suggested edit: ${input.lessonTitle}`.slice(0, 120),
      replyTo: user.email || undefined,
      html: adminNotifyHtml({
        heading: "New suggested edit",
        rows: [
          { label: "Lesson", value: input.lessonTitle },
          { label: "From", value: user.email || "a signed-in user" },
          ...(input.note ? [{ label: "Note", value: input.note }] : []),
        ],
        ctaText: "Review in the admin panel",
        ctaUrl: `${site}/admin#contributions`,
        note: "Nothing changes on the site until you accept.",
      }),
    });
  }

  return { ok: true };
}

/** Admin-only: accept (apply to the lesson) or reject a suggested edit. */
export async function reviewContentEdit(
  editId: string,
  decision: "accepted" | "rejected"
): Promise<{ ok?: boolean; error?: string }> {
  const { user, isAdmin } = await getSession();
  if (!isAdmin) return { error: "Not authorized." };

  const admin = createAdminClient();
  const { data: edit } = await admin
    .from("content_edits")
    .select("id, lesson_id, proposed_content, status")
    .eq("id", editId)
    .maybeSingle();
  if (!edit) return { error: "Suggestion not found." };
  if (edit.status !== "pending") return { error: "This suggestion was already reviewed." };

  if (decision === "accepted") {
    const { error } = await admin
      .from("lessons")
      .update({ content: edit.proposed_content as string })
      .eq("id", edit.lesson_id as string);
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
