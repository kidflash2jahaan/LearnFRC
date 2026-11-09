import { createClient } from "@/lib/supabase/server";
import { logMediaEvents } from "@/lib/app/classes-room";
import { apiError, fromFailure, readJsonObject } from "@/lib/app/http";

/**
 * POST /api/classes/[id]/media-log { events: [{ subject, kind, on, at }] }
 *
 * Every browser in a class room posts the camera and screen-share changes it
 * sees here, every 15 seconds and on pagehide (with keepalive), from
 * src/app/classes/[id]/room/_media-log.tsx. The rules (a member of the class
 * posting about people who were in it, the class's time window, the rate
 * limit) are in logMediaEvents (src/lib/app/classes-room.ts). The rows feed
 * the review's camera and screen-share minutes (src/lib/classes/media.ts).
 *
 * Cookie session only; 204 on success.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("unauthorized", "Sign in again to keep going.");
    const body = await readJsonObject(req);
    if (!body) return apiError("validation", "That request wasn't in the format we expected.");
    const result = await logMediaEvents(user, { classId: id, body });
    if (!result.ok) return fromFailure(result);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[media-log]", (e as Error)?.message ?? e);
    return apiError("server", "Something went wrong on our side.");
  }
}
