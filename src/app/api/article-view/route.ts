import { NextResponse } from "next/server";
import { getArticles } from "@/lib/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Records one read of one article.
 *
 * No auth, because anonymous readers are most of the readers and they count.
 * The slug is checked against the real article list, which is DB backed and
 * cached, before anything is written, so a junk or guessed slug can never
 * create a row. The insert uses the service role client because article_views
 * has RLS on and no public policies.
 *
 * Every path returns 204. There is nothing useful for the browser to do with a
 * failure, and the client has already set its once-per-session guard.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug : "";
  const slugs = new Set((await getArticles()).map((a) => a.slug));
  if (!slugs.has(slug)) {
    return new NextResponse(null, { status: 400 });
  }

  // Generous per-IP cap so one client cannot spam rows. It fails open on infra
  // errors, so a real reader is never blocked by a broken limiter.
  const ok = await rateLimit("article-view", 60, 3600);
  if (!ok) return new NextResponse(null, { status: 204 });

  const admin = createAdminClient();
  await admin.from("article_views").insert({ slug });

  return new NextResponse(null, { status: 204 });
}
