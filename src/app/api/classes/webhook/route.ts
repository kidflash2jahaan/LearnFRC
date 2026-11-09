import { after } from "next/server";
import { receiveWebhook } from "@/lib/classes/webhook";

/**
 * POST /api/classes/webhook: RealtimeKit's webhook (classes-design.md 6.8).
 *
 * Everything is in src/lib/classes/webhook.ts: the signature check on the raw
 * body, the sanity checks, freshness and the dedupe answer here (401 for a
 * bad signature, 500 only when the event couldn't be stored, so Cloudflare
 * retries), and the handlers run after the response.
 *
 * Left out of the middleware matcher (src/middleware.ts), so a delivery never
 * waits on the Supabase session refresh. No session is read here: the
 * signature and the meeting lookup are the only ways in.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request): Promise<Response> {
  const { response, work } = await receiveWebhook(req);
  if (work) after(work);
  return response;
}
