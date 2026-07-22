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

  // Generous cap — a real browsing session legitimately hits many pages.
  const ok = await rateLimit("page-view", 600, 3600);
  if (!ok) return new NextResponse(null, { status: 204 });

  await createAdminClient().from("page_views").insert({ path, visitor });
  return new NextResponse(null, { status: 204 });
}
