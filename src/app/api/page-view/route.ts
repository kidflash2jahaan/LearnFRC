import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Site-wide pageview counter. Mirrors /api/article-view: anonymous (real readers
 * count), rate-limited per IP, service-role insert. Bot exclusion is automatic
 * because only client JS ever calls this. /admin + /api are dropped.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  let path = typeof body.path === "string" ? body.path : "";
  if (!path.startsWith("/") || path.length > 512)
    return new NextResponse(null, { status: 400 });
  path = path.split(/[?#]/)[0]; // strip query/hash so pages aggregate cleanly
  if (/^\/(admin|api)(\/|$)/.test(path))
    return new NextResponse(null, { status: 204 });

  const visitor =
    typeof body.visitorId === "string" && body.visitorId.length <= 64
      ? body.visitorId
      : null;

  // First-touch acquisition source — the beacon's request carries the lf_src
  // cookie (set by <SourceCapture/>), so we read it here without any client work.
  let source: string | null = null;
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)lf_src=([^;]+)/);
  if (m) {
    try {
      source = decodeURIComponent(m[1]).slice(0, 40);
    } catch {
      source = m[1].slice(0, 40);
    }
  }

  // Generous cap — a real browsing session legitimately hits many pages.
  // Measured 2026-08-10: the busiest IP bucket in the retained window was 67
  // hits, so this is ~9x headroom and is not currently dropping events. Note it
  // is per-IP, so a whole team behind one school NAT shares the budget.
  const ok = await rateLimit("page-view", 600, 3600);
  if (!ok) return new NextResponse(null, { status: 204 });

  const { error } = await createAdminClient()
    .from("page_views")
    .insert({ path, visitor, source });
  // The response is a 204 either way (nothing useful for the client to do with
  // a failure), but an unlogged insert error would mean traffic analytics
  // silently going to zero with no signal anywhere. Surface it in the server
  // logs at least.
  if (error) {
    console.error("[page-view] insert failed:", error.message);
  }
  return new NextResponse(null, { status: 204 });
}
