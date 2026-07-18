import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

// CRON_SECRET-gated cache buster. Lets us surface content inserted straight into
// the DB (e.g. an article batch) without a full redeploy — same auth shape as
// the lifecycle-email cron. Accepts ?tags=catalog,articles (defaults to both).
function authed(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  return (
    req.headers.get("authorization") === `Bearer ${secret}` ||
    url.searchParams.get("secret") === secret ||
    req.headers.get("x-cron-secret") === secret
  );
}

async function run(req: Request) {
  if (!authed(req)) return new NextResponse("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  const tags = (url.searchParams.get("tags") || "catalog,articles")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  // Optional full-route revalidation (e.g. the ISR sitemap, which tag-based
  // revalidation doesn't reach). Empty by default.
  const paths = (url.searchParams.get("paths") || "")
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.startsWith("/"));
  // The custom Next fork's revalidateTag takes a profile as the 2nd arg.
  for (const t of tags) revalidateTag(t, "max");
  for (const p of paths) revalidatePath(p);
  return NextResponse.json({
    revalidated: tags,
    paths,
    at: new Date().toISOString(),
  });
}

export const GET = run;
export const POST = run;
