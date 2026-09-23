import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * One filed message, as the admin inbox is allowed to see it.
 *
 * There is no address on this type, on purpose. An admin needs to know whether
 * a message CAN be answered, not who sent it, and `replyToFeedback` looks the
 * address up again from the row id it is handed, so the panel never has to
 * carry one. `hasReplyAddress` is that whole question, answered on the server
 * and reduced to a boolean before anything is serialised to the browser.
 */
export type FeedbackItem = {
  id: string;
  message: string;
  page: string | null;
  /** True when the row carries an address the reply action can send to. */
  hasReplyAddress: boolean;
  status: string;
  replyBody: string | null;
  repliedAt: string | null;
  createdAt: string;
};

/** Recent feedback submissions for the admin inbox (service-role, RLS-locked). */
export async function getFeedback(limit = 40): Promise<FeedbackItem[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("feedback")
    .select(
      "id, message, page, from_email, status, reply_body, replied_at, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    id: r.id as string,
    message: (r.message as string) ?? "",
    page: (r.page as string) ?? null,
    // Read here, thrown away here. This is the last line of code that holds
    // the sender's address; everything downstream gets the boolean.
    hasReplyAddress: !!r.from_email,
    status: (r.status as string) ?? "open",
    replyBody: (r.reply_body as string) ?? null,
    repliedAt: (r.replied_at as string) ?? null,
    createdAt: r.created_at as string,
  }));
}
