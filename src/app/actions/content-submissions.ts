"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "untitled";
}

/**
 * A signed-in user proposes a NEW lesson (into an existing module, or a new
 * module they name). Stored pending; the admin is emailed and reviews in /admin.
 */
export async function submitNewContent(input: {
  departmentId: string;
  moduleId?: string; // existing module, or omit to propose a new one
  newModuleTitle?: string;
  title: string;
  summary?: string;
  content: string;
  note?: string;
  departmentName?: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in to contribute a lesson." };

  const title = (input.title || "").trim();
  const content = (input.content || "").trim();
  if (title.length < 4) return { error: "Give the lesson a clear title." };
  if (content.length < 80) return { error: "Add more content before submitting (at least a few sentences)." };
  if (content.length > 100_000) return { error: "That lesson is too large to submit." };
  if (!input.moduleId && !(input.newModuleTitle || "").trim())
    return { error: "Pick a module, or name a new one." };

  if (!(await rateLimit("submit-content", 5, 3600, user.id)))
    return { error: "You've submitted a few lessons recently — try again in a bit." };

  const { error } = await supabase.from("content_submissions").insert({
    submitter_id: user.id,
    department_id: input.departmentId,
    module_id: input.moduleId || null,
    new_module_title: input.moduleId ? null : (input.newModuleTitle || "").trim() || null,
    title,
    summary: input.summary?.trim() || null,
    content,
    note: input.note?.slice(0, 1000) || null,
  });
  if (error) return { error: error.message };

  // No admin notification on submit — the daily moderation routine reviews the
  // queue and emails a digest only when it actually acts on something.
  return { ok: true };
}

/** Admin-only: accept (creates the module/lesson) or reject a submission. */
export async function reviewContentSubmission(
  submissionId: string,
  decision: "accepted" | "rejected"
): Promise<{ ok?: boolean; error?: string }> {
  const { user, isAdmin } = await getSession();
  if (!isAdmin) return { error: "Not authorized." };

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("content_submissions")
    .select("*")
    .eq("id", submissionId)
    .maybeSingle();
  if (!sub) return { error: "Submission not found." };
  if (sub.status !== "pending") return { error: "Already reviewed." };

  let createdLessonId: string | null = null;

  if (decision === "accepted") {
    // Resolve the target module: existing, or create the proposed one.
    let moduleId = sub.module_id as string | null;
    if (!moduleId) {
      const modTitle = (sub.new_module_title as string) || "Community Lessons";
      const { data: maxMod } = await admin
        .from("modules")
        .select("sort_order")
        .eq("department_id", sub.department_id as string)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextModOrder = ((maxMod?.sort_order as number) ?? 0) + 1;
      // unique module slug within the department
      let base = slugify(modTitle);
      let slug = base;
      for (let i = 2; ; i++) {
        const { data: clash } = await admin
          .from("modules")
          .select("id")
          .eq("department_id", sub.department_id as string)
          .eq("slug", slug)
          .maybeSingle();
        if (!clash) break;
        slug = `${base}-${i}`;
      }
      const { data: mod, error: modErr } = await admin
        .from("modules")
        .insert({
          department_id: sub.department_id as string,
          title: modTitle,
          slug,
          sort_order: nextModOrder,
        })
        .select("id")
        .single();
      if (modErr) return { error: modErr.message };
      moduleId = mod.id as string;
    }

    // Next lesson order + a unique slug within the module.
    const { data: maxLes } = await admin
      .from("lessons")
      .select("sort_order")
      .eq("module_id", moduleId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = ((maxLes?.sort_order as number) ?? 0) + 1;

    let base = slugify(sub.title as string);
    let slug = base;
    for (let i = 2; ; i++) {
      const { data: clash } = await admin
        .from("lessons")
        .select("id")
        .eq("module_id", moduleId)
        .eq("slug", slug)
        .maybeSingle();
      if (!clash) break;
      slug = `${base}-${i}`;
    }

    const words = (sub.content as string).split(/\s+/).length;
    const { data: lesson, error: lesErr } = await admin
      .from("lessons")
      .insert({
        module_id: moduleId,
        slug,
        title: sub.title as string,
        summary: (sub.summary as string) ?? null,
        content: sub.content as string,
        estimated_minutes: Math.max(1, Math.round(words / 200)),
        sort_order: nextOrder,
      })
      .select("id")
      .single();
    if (lesErr) return { error: lesErr.message };
    createdLessonId = lesson.id as string;
    revalidateTag("catalog", "max");
  }

  await admin
    .from("content_submissions")
    .update({
      status: decision,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id ?? null,
      created_lesson_id: createdLessonId,
    })
    .eq("id", submissionId);

  revalidatePath("/admin");
  return { ok: true };
}
