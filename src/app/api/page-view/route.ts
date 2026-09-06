import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Site-wide pageview counter, shaped exactly like /api/article-view: anonymous,
 * because real readers count, rate limited per IP, service role insert.
 *
 * Bot exclusion is automatic. Only client JavaScript ever calls this, so a
 * crawler that does not run scripts cannot appear in the numbers. /admin and
 * /api are dropped because they are not public traffic.
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
  path = path.split(/[?#]/)[0]; // drop query and hash so pages aggregate cleanly
  if (/^\/(admin|api)(\/|$)/.test(path))
    return new NextResponse(null, { status: 204 });

  const visitor =
    typeof body.visitorId === "string" && body.visitorId.length <= 64
      ? body.visitorId
      : null;

  // First touch acquisition source. The beacon's request already carries the
  // lf_src cookie that <SourceCapture/> set, so it is read here with no extra
  // work on the client.
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

  // Generous cap, because a real browsing session legitimately hits many pages.
  // Measured 2026-08-10: the busiest IP bucket in the retained window was 67
  // hits, so this is roughly 9x headroom and is not dropping events today. It is
  // per IP, so a whole team behind one school NAT shares the budget, which is
  // why it is generous rather than tight.
  const ok = await rateLimit("page-view", 600, 3600);
  if (!ok) return new NextResponse(null, { status: 204 });

  const { error } = await createAdminClient()
    .from("page_views")
    .insert({ path, visitor, source });
  // The response is 204 either way, there is nothing the client could do with a
  // failure. But an unlogged insert error would mean traffic analytics quietly
  // going to zero with no signal anywhere, so it lands in the server logs.
  if (error) {
    console.error("[page-view] insert failed:", error.message);
  }
  return new NextResponse(null, { status: 204 });
}
