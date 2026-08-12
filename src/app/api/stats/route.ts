import { NextResponse } from "next/server";
import { getSocialProofStats } from "@/lib/social-proof-stats";

/**
 * The three public counters under the home page's "Who uses it" section.
 *
 * WHY THIS EXISTS
 * ---------------
 * The home page is statically rendered, and its data cache is deliberately set
 * to 24h (see SOCIAL_PROOF_TTL) because Next takes the MINIMUM revalidate
 * across everything a page reads, so a short window there would rebuild the
 * site's highest-traffic page constantly. The admin panel is live only because
 * it calls getSession(), which reads cookies and makes that whole route
 * dynamic. Doing the same to `/` would throw away its caching entirely.
 *
 * So the page ships the cached numbers in its HTML (correct without JS, no
 * layout shift, indexable) and the client refreshes them from here on mount.
 *
 * These three counts are already printed on the home page, so this exposes
 * nothing new. It returns aggregates only: no per-user row, no username, no id.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await getSocialProofStats();
    return NextResponse.json(stats, {
      headers: {
        // Let a CDN absorb bursts without making the numbers feel stale. 60s
        // fresh, and a stale copy may be served for 5 minutes while a fresh
        // one is fetched, so a spike never lands on the database.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (e) {
    // Never invent a number. The client keeps whatever the server rendered.
    console.error("api/stats:", e);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
