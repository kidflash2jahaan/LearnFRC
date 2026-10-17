import "server-only";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

/**
 * The side effects the admin-team functions share: the emails they promise
 * and the pages they refresh.
 */

/** Email on file for an account. Used only to send mail, never displayed. */
export async function emailFor(userId: string): Promise<string | null> {
  const { data } = await createAdminClient().auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

/**
 * Send after the response, and say so in the logs when it fails.
 *
 * A bare `void sendEmail(...)` is not safe here. The serverless instance can be
 * frozen the moment the response is flushed, so a promise nobody is holding may
 * never finish, and `sendEmail` resolves to `{ ok: false }` rather than
 * throwing, so a rejected key or an unverified sender would be silent either
 * way. These are the emails the product promises out loud: /apply says "You'll
 * get an email either way" and the review desk says the same. `after` keeps the
 * instance alive for the send, and the log is the only place a failure can
 * surface, because the applicant by definition sees nothing.
 */
export function mailAfter(what: string, message: Parameters<typeof sendEmail>[0]) {
  after(async () => {
    const res = await sendEmail(message);
    if (!res.ok) console.error(`admin-team email failed (${what}):`, res.error);
  });
}

/** The three pages that print the team and its applications. */
export function revalidateTeamPages() {
  revalidatePath("/apply");
  revalidatePath("/admin");
  revalidatePath("/admin/team");
}
