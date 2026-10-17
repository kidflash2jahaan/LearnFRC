import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, feedbackReplyHtml } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/app/http";
import {
  getFeedback,
  getFeedbackCounts,
  toFeedbackItem,
  type FeedbackItem,
} from "@/lib/feedback";
import { BAD_REQUEST, NOT_ADMIN, requireSiteRole, textField } from "@/lib/app/admin-access";
import { fail, type AppUser, type Result } from "@/lib/app/result";

/**
 * The feedback inbox, shared by /admin's Feedback drawer (the replyToFeedback
 * Server Action) and the app's /api/app/admin/feedback routes.
 *
 * `feedback` is RLS-locked, so every read is service role, after the caller's
 * site role is checked here. The sender's address is read only inside
 * `replyToFeedbackAs`, by the id it is handed, and never returned.
 */

export const FEEDBACK_PAGE_DEFAULT = 40;
export const FEEDBACK_PAGE_MAX = 100;
const REPLY_MIN = 2;
const REPLY_MAX = 4000;
/** Per admin. Resend's free tier is 100 emails a day for the whole site. */
const REPLY_LIMIT = 30;
const REPLY_WINDOW = 3600;

export type FeedbackPage = {
  items: FeedbackItem[];
  /** Messages not yet answered, over the whole table. */
  openCount: number;
  /** Every message ever received. */
  total: number;
};

/** The latest `limit` messages (1 to 100, default 40), newest first, plus exact counts. */
export async function listFeedback(
  user: AppUser,
  { limit = FEEDBACK_PAGE_DEFAULT }: { limit?: number } = {}
): Promise<Result<FeedbackPage>> {
  const gate = await requireSiteRole(user, "admin", NOT_ADMIN);
  if (!gate.ok) return gate;
  const n = Math.min(FEEDBACK_PAGE_MAX, Math.max(1, Math.floor(limit) || FEEDBACK_PAGE_DEFAULT));
  const [items, counts] = await Promise.all([getFeedback(n), getFeedbackCounts()]);
  return { ok: true, items, ...counts };
}

/**
 * Admin-only: reply to a stored feedback submission. Emails the sender from the
 * verified LearnFRC domain and marks the item replied.
 *
 * THE STATUS CHANGE IS THE GATE, and it runs before the email. Two admins with
 * the drawer open, or a double tap on a phone, used to send two emails, because
 * the old order was read, send, then write. Now the row is claimed with
 * `status <> 'replied'` and a returned row, so exactly one request sends; if
 * the email then fails, the claim is rolled back and the row is open again.
 */
export async function replyToFeedbackAs(
  user: AppUser,
  input: { id: unknown; reply: unknown }
): Promise<Result<{ item: FeedbackItem }>> {
  const gate = await requireSiteRole(user, "admin", "Not authorized.");
  if (!gate.ok) return gate;

  const id = textField(input.id);
  const body = textField(input.reply);
  if (id === null || body === null) return fail("validation", BAD_REQUEST);
  if (!id) return fail("validation", "Missing message id.");
  if (body.length < REPLY_MIN) return fail("validation", "Write a reply first.");
  if (body.length > REPLY_MAX) return fail("validation", "That reply is too long.");
  if (!isUuid(id)) return fail("not_found", "That message no longer exists.");

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("feedback")
    .select("id, message, page, from_email, status, reply_body, replied_at, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!row) return fail("not_found", "That message no longer exists.");
  if (!row.from_email)
    return fail("validation", "No reply address was left on this message.");
  if (row.status === "replied") return fail("conflict", "That one has already been answered.");

  if (!(await rateLimit("feedback-reply", REPLY_LIMIT, REPLY_WINDOW, user.id)))
    return fail(
      "rate_limited",
      "That's a lot of replies in an hour. Give it a little while, then try again.",
      REPLY_WINDOW
    );

  const repliedAt = new Date().toISOString();
  const { data: claimed, error: claimErr } = await admin
    .from("feedback")
    .update({ status: "replied", reply_body: body, replied_at: repliedAt })
    .eq("id", id)
    .neq("status", "replied")
    .select("id");
  if (claimErr) return fail("server", "Couldn't send the reply. Try again.");
  if (!claimed || claimed.length === 0)
    return fail("conflict", "That one has already been answered.");

  const res = await sendEmail({
    to: row.from_email as string,
    subject: "Re: your message to LearnFRC",
    html: feedbackReplyHtml({
      reply: body,
      original: (row.message as string) || null,
    }),
  });
  if (!res.ok) {
    // Put the row back exactly as it was, so it reads open and can be retried.
    await admin
      .from("feedback")
      .update({
        status: (row.status as string) ?? "open",
        reply_body: (row.reply_body as string | null) ?? null,
        replied_at: (row.replied_at as string | null) ?? null,
      })
      .eq("id", id);
    return fail("server", "Couldn't send the reply. Try again.");
  }

  revalidatePath("/admin");
  return {
    ok: true,
    item: toFeedbackItem({ ...row, status: "replied", reply_body: body, replied_at: repliedAt }),
  };
}
