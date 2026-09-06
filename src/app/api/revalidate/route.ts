import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

/**
 * CRON_SECRET-gated cache buster. It surfaces content that went straight into
 * the database, like a batch of articles, without a redeploy. Same auth shape as
 * the lifecycle-email cron.
 *
 *   ?tags=catalog,articles   which cache tags to bust, defaults to both
 *   ?paths=/sitemap.xml      optional full route revalidation, empty by default
 */
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
  // Full route revalidation, for the routes tag-based revalidation does not
  // reach, like the ISR sitemap.
  const paths = (url.searchParams.get("paths") || "")
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.startsWith("/"));
  // The custom Next fork's revalidateTag takes a profile as its second argument.
  for (const t of tags) revalidateTag(t, "max");
  for (const p of paths) revalidatePath(p);

  // IndexNow: tell Bing about the refreshed URLs straight away instead of
  // waiting for a recrawl. Bing also feeds Copilot and ChatGPT search, which is
  // already a converting channel here. The key file is served from /public.
  // Best effort only, a failure never fails the revalidation.
  let indexnow = "skipped";
  const urlList = [
    ...paths.map((p) => `https://learnfrc.com${p}`),
    "https://learnfrc.com/sitemap.xml",
  ];
  try {
    const res = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: "learnfrc.com",
        key: "4b7943d207e8cc0430ce5784a7114824",
        keyLocation:
          "https://learnfrc.com/4b7943d207e8cc0430ce5784a7114824.txt",
        urlList,
      }),
    });
    indexnow = `HTTP ${res.status}`;
  } catch {
    indexnow = "failed";
  }

  return NextResponse.json({
    revalidated: tags,
    paths,
    indexnow,
    at: new Date().toISOString(),
  });
}

export const GET = run;
export const POST = run;
