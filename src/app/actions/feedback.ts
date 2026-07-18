"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { sendEmail, feedbackEmailHtml, feedbackReplyHtml } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

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
      error: "That email doesn't look right — leave it blank or fix it.",
    };

  if (!(await rateLimit("feedback", 8, 3600)))
    return { error: "Too many messages — please try again later." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Prefer the signed-in email; otherwise use whatever they typed so we can
  // reply. Either may be null (a truly anonymous note) — that's fine.
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
    subject: "LearnFRC — feedback / topic request",
    html: feedbackEmailHtml({
      message,
      fromEmail: fromEmail || undefined,
      page,
    }),
    replyTo: fromEmail || undefined,
  });
  if (!res.ok) return { error: "Couldn't send right now — please try again." };
  return { success: true };
}

/**
 * Admin-only: reply to a stored feedback submission. Emails the sender from the
 * verified LearnFRC domain and marks the item replied. Gated on isAdmin — this
 * is a public "use server" endpoint, so the authorization check is mandatory.
 */
export async function replyToFeedback(
  _prev: ReplyState,
  formData: FormData
): Promise<ReplyState> {
  const { isAdmin } = await getSession();
  if (!isAdmin) return { error: "Not authorized." };

  const id = String(formData.get("id") || "");
  const body = String(formData.get("reply") || "").trim();
  if (!id) return { error: "Missing message id." };
  if (body.length < 2) return { error: "Write a reply first." };
  if (body.length > 4000) return { error: "That reply is too long." };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("feedback")
    .select("id, from_email, message")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { error: "That message no longer exists." };
  if (!row.from_email)
    return { error: "No reply address was left on this message." };

  const res = await sendEmail({
    to: row.from_email as string,
    subject: "Re: your message to LearnFRC",
    html: feedbackReplyHtml({
      reply: body,
      original: (row.message as string) || null,
    }),
  });
  if (!res.ok) return { error: "Couldn't send the reply — try again." };

  await admin
    .from("feedback")
    .update({
      status: "replied",
      reply_body: body,
      replied_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/admin");
  return { success: true };
}
