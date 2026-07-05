"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
      html: `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;color:#182338">
        <h2 style="margin:0 0 12px;font-size:18px">New suggested edit</h2>
        <p style="margin:6px 0"><strong>Lesson:</strong> ${esc(input.lessonTitle)}</p>
        <p style="margin:6px 0"><strong>From:</strong> ${esc(user.email || "a signed-in user")}</p>
        ${input.note ? `<p style="margin:6px 0"><strong>Note:</strong> ${esc(input.note)}</p>` : ""}
        <p style="margin:18px 0 6px"><a href="${site}/admin#suggested-edits" style="background:#2560e6;color:#fff;text-decoration:none;padding:10px 18px;border-radius:12px;display:inline-block">Review it in the admin panel →</a></p>
        <p style="margin:16px 0 0;font-size:13px;color:#4d5b78">You can accept or reject it there; nothing changes on the site until you accept.</p>
      </div>`,
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
