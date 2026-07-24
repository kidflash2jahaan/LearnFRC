import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getCompletedLessonIds,
  getBookmarkedLessonIds,
  isEmailSubscribed,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

// Per-user progress for the (now static/ISR) guides pages. The department and
// lesson pages render their full content statically for crawlers; the signed-in
// progress UI — completed checkmarks, continue/next state, mastery rings,
// bookmarks, the completion card — hydrates from this route after mount (the
// same client-fetch pattern the Navbar already uses via /api/me). Everything
// here is session-scoped and never cached.
export async function GET() {
  const { user, profile } = await getSession();
  if (!user) {
    return NextResponse.json(
      {
        authed: false,
        completedLessonIds: [],
        bookmarkedLessonIds: [],
        username: null,
        subscribed: false,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
  const [completed, bookmarks, subscribed] = await Promise.all([
    getCompletedLessonIds(user.id),
    getBookmarkedLessonIds(user.id),
    user.email ? isEmailSubscribed(user.email) : Promise.resolve(false),
  ]);
  return NextResponse.json(
    {
      authed: true,
      // Global completion set — `has()` covers per-department lookups, and the
      // pages derive per-department counts from the lesson ids already on page.
      completedLessonIds: [...completed],
      bookmarkedLessonIds: [...bookmarks],
      username: profile?.username ?? null,
      subscribed,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
