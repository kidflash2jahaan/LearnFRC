import type { NextRequest } from "next/server";
import { FEEDBACK_PAGE_DEFAULT, listFeedback } from "@/lib/app/admin-feedback";
import { fromFailure, guarded, ok, requireAppUser } from "@/lib/app/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/app/admin/feedback?limit=40: the feedback inbox, newest first, with
 * exact open and total counts (listFeedback in src/lib/app/admin-feedback.ts,
 * the reads /admin's Feedback drawer uses). `limit` is 1 to 100, default 40.
 * No sender addresses, only whether a reply can be sent. Admins only.
 */
export async function GET(req: NextRequest) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const raw = req.nextUrl.searchParams.get("limit");
    const limit = raw ? Number.parseInt(raw, 10) : FEEDBACK_PAGE_DEFAULT;
    const result = await listFeedback(auth.user, {
      limit: Number.isFinite(limit) ? limit : FEEDBACK_PAGE_DEFAULT,
    });
    if (!result.ok) return fromFailure(result);
    return ok({ items: result.items, openCount: result.openCount, total: result.total });
  });
}
