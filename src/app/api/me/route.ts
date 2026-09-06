import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * A small session probe, so the navbar can find out who is signed in from the
 * client instead of forcing every page that renders the layout to go dynamic.
 *
 * Never cached. The answer is different for every reader and stale auth state in
 * the navbar is the kind of bug that looks like a logout.
 */
export async function GET() {
  const { user, profile, isAdmin } = await getSession();
  return NextResponse.json(
    {
      authed: !!user,
      email: user?.email ?? null,
      profile,
      isAdmin,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
