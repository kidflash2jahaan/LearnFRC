"use server";

import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

/**
 * A signed-in user proposes a NEW lesson (into an existing module, or a new
 * module they name). Stored pending; the scheduled moderation routine reviews
 * the queue through /api/moderation and the result shows up on /contributions.
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
