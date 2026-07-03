import { NextResponse } from "next/server";
import { ARTICLES } from "@/lib/blog-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Anonymous readers count, so this endpoint takes no auth. Validate the slug
// against the real article list up front so junk/unknown slugs never create
// rows. Insert with the service-role client, which bypasses the (policy-less)
// RLS on `article_views`.
const SLUGS = new Set(ARTICLES.map((a) => a.slug));

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug : "";
  if (!SLUGS.has(slug)) {
    return new NextResponse(null, { status: 400 });
  }

  // Generous per-IP cap so a single client can't spam rows; fails open on
  // infra errors so real readers are never blocked. A rate-limited request is
  // silently dropped (the client has already set its once-per-session guard).
  const ok = await rateLimit("article-view", 60, 3600);
  if (!ok) return new NextResponse(null, { status: 204 });

  const admin = createAdminClient();
  await admin.from("article_views").insert({ slug });

  return new NextResponse(null, { status: 204 });
}
