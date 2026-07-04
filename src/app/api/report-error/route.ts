import { NextResponse } from "next/server";
import { sendEmail, errorEmailHtml } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Only accept reports fired by our own pages in a browser. Real error
// boundaries send an Origin (or at least a same-site Referer) automatically;
// scripted junk (e.g. a `node` POST pasting the Bee Movie script into the
// admin inbox) does not. This is the cheap, effective gate against abuse of
// what is otherwise an unauthenticated "email the admin" endpoint.
const ALLOWED_HOSTS = new Set([
  "learnfrc.systemerr.com",
  "www.learnfrc.systemerr.com",
  "localhost:3000",
]);

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const raw = origin || referer;
  if (!raw) return false;
  try {
    return ALLOWED_HOSTS.has(new URL(raw).host);
  } catch {
    return false;
  }
}

// Lightweight built-in error monitor: client/server error boundaries POST here,
// and we email the site admin. Rate-limited so one bad bug can't flood the inbox.
export async function POST(req: Request) {
  const admin = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim();
  if (!admin) return new NextResponse(null, { status: 204 });

  // Drop anything not fired from our own origin in a real browser.
  if (!sameOrigin(req)) return new NextResponse(null, { status: 204 });

  // Cap to a few alerts/hour per IP, and globally, to avoid email storms.
  const ok =
    (await rateLimit("error-report", 6, 3600)) &&
    (await rateLimit("error-report-global", 30, 3600, "all"));
  if (!ok) return new NextResponse(null, { status: 204 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const message = String(body.message || "Unknown error").slice(0, 500);
  const stack = body.stack ? String(body.stack).slice(0, 6000) : undefined;
  const url = body.url ? String(body.url).slice(0, 300) : undefined;
  const kind = body.kind ? String(body.kind).slice(0, 40) : "Client error";
  const digest = body.digest ? String(body.digest).slice(0, 80) : undefined;
  const userAgent = req.headers.get("user-agent")?.slice(0, 200) || undefined;

  await sendEmail({
    to: admin,
    subject: `⚠️ LearnFRC ${kind}: ${message.slice(0, 80)}`,
    html: errorEmailHtml({ message, stack, url, kind, digest, userAgent }),
  });

  return new NextResponse(null, { status: 204 });
}
