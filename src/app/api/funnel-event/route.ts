import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isFunnelStep, recordFunnelEvent } from "@/lib/funnel";

export const dynamic = "force-dynamic";

/**
 * Activation-funnel milestone beacon. Deliberately shaped exactly like
 * /api/page-view — anonymous body, per-IP rate limit, service-role insert,
 * 204 no matter what — because that endpoint is already proven in production
 * and adding a second, different analytics shape is how instrumentation rots.
 *
 * What it stores: the step, ONE subject key, and a timestamp. Nothing else.
 * No path, no IP, no user agent, no referrer. The subject is the authenticated
 * account id when the request carries a session, and otherwise the anonymous
 * lf_vid — never both, so this endpoint cannot be used to link an account to
 * its pre-signup browsing. See src/lib/funnel.ts and the funnel_events
 * migration for the rules this is the front door to.
 *
 * Callers do not need to dedupe. Every step is once-per-subject-for-all-time,
 * enforced by a unique index, so firing on every lesson page view is fine —
 * the second and subsequent hits are no-ops.
 *
 * Server code should call recordFunnelEvent() directly instead of POSTing here
 * (a Server Action already knows the user id, and skipping the HTTP hop skips
 * the rate limit and the session round trip). This route exists for the steps
 * only the browser can observe: opening a lesson, attempting a quiz.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  // The step allow-list is the ONLY thing validated off the wire, and it is
  // also a CHECK constraint in the database — an unknown step is rejected here
  // rather than becoming a seventh, invisible bucket nobody ever charts.
  const step = body.step;
  if (!isFunnelStep(step)) return new NextResponse(null, { status: 400 });

  const visitor =
    typeof body.visitorId === "string" &&
    body.visitorId.length > 0 &&
    body.visitorId.length <= 64
      ? body.visitorId
      : null;

  // Same budget and window as /api/page-view. Funnel events are a strict
  // subset of the actions that already fire a pageview (at most one per lesson
  // page view, plus a handful of once-ever milestones), so a bucket that does
  // not currently drop pageviews cannot drop these either. It is per-IP, so a
  // whole team behind one school NAT shares it — which is why the budget is
  // generous rather than tight.
  const ok = await rateLimit("funnel-event", 600, 3600);
  if (!ok) return new NextResponse(null, { status: 204 });

  // Identify the subject SERVER-side. The client never says who it is: a
  // beacon body claiming a user id would let anyone forge another account's
  // funnel. sendBeacon sends same-origin cookies, so the session is here if
  // the reader has one. (Same shape as /api/presence.)
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // Auth unreachable — fall back to the anonymous key rather than losing the
    // event entirely. A misattributed-as-anonymous event is recoverable; a
    // dropped one is not.
    userId = null;
  }

  if (!userId && !visitor) return new NextResponse(null, { status: 400 });

  await recordFunnelEvent({ step, userId, visitor });
  return new NextResponse(null, { status: 204 });
}
