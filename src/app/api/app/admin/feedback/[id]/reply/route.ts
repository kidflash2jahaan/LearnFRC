import { replyToFeedbackAs } from "@/lib/app/admin-feedback";
import {
  badJson,
  fromFailure,
  guarded,
  ok,
  readJsonObject,
  requireAppUser,
} from "@/lib/app/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/app/admin/feedback/{id}/reply { reply }
 *
 * Emails the sender and marks the message replied, through replyToFeedbackAs
 * (src/lib/app/admin-feedback.ts), the function /admin's Reply form calls:
 * the admin check, the already-answered guard (409), the reply rate limit
 * (30 an hour per admin) and the copy are the site's. Responds with the
 * updated item.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const body = await readJsonObject(req);
    if (!body) return badJson();
    const { id } = await params;
    const result = await replyToFeedbackAs(auth.user, { id, reply: body.reply });
    if (!result.ok) return fromFailure(result);
    return ok({ ok: true, item: result.item });
  });
}
