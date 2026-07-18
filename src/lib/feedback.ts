import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type FeedbackItem = {
  id: string;
  message: string;
  page: string | null;
  fromEmail: string | null;
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
    fromEmail: (r.from_email as string) ?? null,
    status: (r.status as string) ?? "open",
    replyBody: (r.reply_body as string) ?? null,
    repliedAt: (r.replied_at as string) ?? null,
    createdAt: r.created_at as string,
  }));
}
