import "server-only";
import { stubCalled } from "@/lib/classes/stub";
import type { ReviewStatus } from "@/lib/classes/types";
import type { Result } from "@/lib/app/result";

/**
 * The AI notes for a class (section 7): code flags, then Claude through
 * Vercel's AI Gateway, then routing and the emails. Owned by the
 * webhooks-and-review package, which replaces this stub body and keeps the
 * signature (the webhook, reconcile, the sweep and "Rerun notes" call it).
 */

/**
 * Runs (or reruns, with `force`) the review for an ended class and stores it
 * in class_reviews. Idempotent: a class already `ready` is left alone unless
 * forced. Never throws; a failure is stored as `failed` for the sweep to retry.
 */
export async function runClassReview(
  classId: string,
  opts: { force?: boolean } = {}
): Promise<Result<{ status: ReviewStatus }>> {
  stubCalled("runClassReview", { classId, force: !!opts.force });
  return { ok: true, status: "pending" };
}
