import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { migrateGuestProgress } from "@/lib/app/guest";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Carries a guest's lesson completions into the account they just made. The
 * whole migration (server-held rows only, original dates, trigger-owned XP,
 * achievements, the rate limit and the threat model for the unbound visitor
 * id) lives in src/lib/app/guest.ts, shared with the app's
 * POST /api/app/migrate-guest. This route only reads the cookie session and
 * the body.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // The body is optional. visitorId is the only thing read out of it.
  }

  const result = await migrateGuestProgress(user, body?.visitorId);
  if (result.status === "rate_limited")
    return NextResponse.json(
      { migrated: 0, xp: 0, lessonIds: [] },
      { status: 429, headers: NO_STORE }
    );
  if (result.status === "error")
    return NextResponse.json(
      { migrated: 0, xp: 0, lessonIds: [] },
      { status: 500, headers: NO_STORE }
    );

  return NextResponse.json(
    { migrated: result.migrated, xp: result.xp, lessonIds: result.lessonIds },
    { headers: NO_STORE }
  );
}
