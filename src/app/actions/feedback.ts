"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, feedbackEmailHtml } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { replyToFeedbackAs } from "@/lib/app/admin-feedback";

export type FeedbackState = { error?: string; success?: boolean } | undefined;
export type ReplyState = { error?: string; success?: boolean } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendFeedback(
  _prev: FeedbackState,
  formData: FormData
): Promise<FeedbackState> {
  const message = String(formData.get("message") || "").trim();
  const page = String(formData.get("page") || "");
  const emailRaw = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  if (message.length < 5) return { error: "Please add a little more detail." };
  if (message.length > 4000)
    return { error: "That message is a bit too long." };
  if (emailRaw && !EMAIL_RE.test(emailRaw))
    return {
      error: "That email doesn't look right. Leave it blank, or fix it.",
    };

  if (!(await rateLimit("feedback", 8, 3600)))
    return { error: "Too many messages. Please try again later." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Prefer the signed-in email; otherwise use whatever they typed so we can
  // reply. Either may be null (a truly anonymous note), and that's fine.
  const fromEmail = user?.email || emailRaw || null;

  // Persist for the admin inbox / reply system. Service-role client because
  // feedback is RLS-locked to admins. Best-effort: a storage hiccup must never
  // stop the email below, which is the real delivery path.
  try {
    const admin = createAdminClient();
    await admin.from("feedback").insert({
      message,
      page: page || null,
      from_email: fromEmail,
      user_id: user?.id ?? null,
    });
  } catch {
    /* non-fatal */
  }

  const adminEmail = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim();
  if (!adminEmail) return { success: true }; // nowhere to send, but don't error

  const res = await sendEmail({
    to: adminEmail,
    subject: "LearnFRC: feedback / topic request",
    html: feedbackEmailHtml({
      message,
      fromEmail: fromEmail || undefined,
      page,
    }),
    replyTo: fromEmail || undefined,
  });
  if (!res.ok) return { error: "Couldn't send right now. Please try again." };
  return { success: true };
}

/**
 * Admin-only: reply to a stored feedback submission. The website's door onto
 * replyToFeedbackAs (src/lib/app/admin-feedback.ts), shared with the app's
 * POST /api/app/admin/feedback/{id}/reply: the admin check, the
 * already-answered guard, the reply rate limit, the email and the write all
 * live there, so the two doors can't drift.
 */
export async function replyToFeedback(
  _prev: ReplyState,
  formData: FormData
): Promise<ReplyState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authorized." };

  const result = await replyToFeedbackAs(user, {
    id: String(formData.get("id") || ""),
    reply: String(formData.get("reply") || ""),
  });
  return result.ok ? { success: true } : { error: result.error };
}
