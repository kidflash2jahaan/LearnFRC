import { timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import { runSweep } from "@/lib/classes/reconcile";

/**
 * GET /api/classes/sweep: the live-classes sweep (classes-design.md 6.9).
 *
 * Supabase Cron calls it every 5 minutes once the release-day migration
 * schedules it (classes_sweep_tick reads the URL and the secret from Vault),
 * and vercel.json's daily entry is the backstop. It answers 202 at once and
 * does the work after the response: hard ends, teacher gone, empty rooms,
 * reviews due, RealtimeKit cleanup, and once a day, retention.
 *
 * Guarded by `Authorization: Bearer <CRON_SECRET>`. With no CRON_SECRET set it
 * refuses everyone: the sweep ends classes, so it's never open.
 *
 * Outside production builds it also takes:
 *   ?classId=<id>   act on that one class (a package's test sweeps its own
 *                   lftest class without touching anyone else's rows);
 *   ?wait=1         run inline and answer 200 with the report, so a test can
 *                   read what happened.
 * Production ignores both.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: Request): Promise<Response> {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const testing = process.env.NODE_ENV !== "production";
  const params = new URL(req.url).searchParams;
  const classId = testing ? params.get("classId") : null;
  if (testing && params.get("wait") === "1") {
    const report = await runSweep({ classId });
    return NextResponse.json({ ok: true, report }, { headers: { "Cache-Control": "no-store" } });
  }
  after(async () => {
    try {
      const report = await runSweep({ classId });
      if (report.errors.length) console.error("classes sweep:", report.errors.join("; "));
    } catch (e) {
      console.error("classes sweep failed:", e);
    }
  });
  return NextResponse.json({ ok: true, accepted: true }, { status: 202, headers: { "Cache-Control": "no-store" } });
}
