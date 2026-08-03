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

  // IndexNow: tell Bing (which also feeds Copilot + ChatGPT search — already a
  // converting channel) about the refreshed URLs immediately instead of
  // waiting for a recrawl. Key file is served from /public. Best-effort only.
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
