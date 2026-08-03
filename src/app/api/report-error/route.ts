import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Error emails are DISABLED (they were noisy). The endpoint is kept as a
 * silent no-op so cached clients from older deploys that still POST here get
 * a clean 204 instead of a 404.
 */
export async function POST() {
  return new NextResponse(null, { status: 204 });
}
