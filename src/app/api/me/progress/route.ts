import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getBookmarkedLessonIds, isEmailSubscribed } from "@/lib/queries";
import type { Rhythm } from "@/lib/streaks";
import {
  readCompletions,
  readNextUnlock,
  rhythmFromCompletions,
  type NextUnlockPayload,
} from "@/lib/app/progress";

export const dynamic = "force-dynamic";

/**
 * Everything the signed-in layer of the guides needs, in one request.
 *
 * The department and lesson pages render their full content statically so
 * crawlers see it. The per-reader layer, the completed ticks, continue and next
 * state, mastery rings, bookmarks, the completion card, hydrates from here after
 * mount. It is the same client-fetch pattern the navbar already uses through
 * /api/me. Everything here is session scoped and never cached.
 *
 * THE CLOCK LIVES HERE. This route is also where the week rhythm, five lessons
 * in seven days, is computed, and that is not a convenience. Every surface that
 * renders the rhythm, the department page card and the lesson reading rail, is a
 * STATIC page whose HTML is shared by every visitor and every crawler. There is
 * no per-reader server render to compute "days since" in. So computeRhythm is
 * called here, on the server, with the SERVER's Date.now(), and the finished
 * plain object ships to the client. The components never touch a clock, they
 * render a prop. See the hydration note in src/lib/streaks.ts.
 */

/*
 * The reads and the rhythm math are shared with the app's
 * GET /api/app/me/progress (src/lib/app/progress.ts), so the app's week strip,
 * streak and next unlock are the same numbers this route sends the site.
 */

export type { NextUnlockPayload };

export type MyProgressPayload = {
  authed: boolean;
  completedLessonIds: string[];
  bookmarkedLessonIds: string[];
  username: string | null;
  subscribed: boolean;
  /** Server-computed week rhythm. Null for a signed-out reader. */
  rhythm: Rhythm | null;
  nextUnlock: NextUnlockPayload | null;
};

const SIGNED_OUT: MyProgressPayload = {
  authed: false,
  completedLessonIds: [],
  bookmarkedLessonIds: [],
  username: null,
  subscribed: false,
  rhythm: null,
  nextUnlock: null,
};

export async function GET() {
  const { user, profile } = await getSession();
  if (!user) {
    return NextResponse.json(SIGNED_OUT, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const supabase = await createClient();
  const [rows, bookmarks, subscribed] = await Promise.all([
    readCompletions(supabase, user.id),
    getBookmarkedLessonIds(user.id),
    user.email ? isEmailSubscribed(user.email) : Promise.resolve(false),
  ]);

  // One read, two derivations: the id set the ticks need, and the timestamps the
  // rhythm needs. Server clock, once, here. Never in a component.
  const { completed, rhythm } = rhythmFromCompletions(
    rows,
    profile?.created_at ?? null,
    Date.now()
  );

  const payload: MyProgressPayload = {
    authed: true,
    // The global completion set. has() covers per-department lookups, and the
    // pages derive per-department counts from the lesson ids already on page.
    completedLessonIds: [...completed],
    bookmarkedLessonIds: [...bookmarks],
    username: profile?.username ?? null,
    subscribed,
    rhythm,
    nextUnlock: await readNextUnlock(supabase, user.id, completed.size),
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
