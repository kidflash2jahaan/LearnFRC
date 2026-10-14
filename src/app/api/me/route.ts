import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { shouldAskAboutEmail } from "@/lib/app/profile";

export const dynamic = "force-dynamic";

/**
 * A small session probe, so the navbar can find out who is signed in from the
 * client instead of forcing every page that renders the layout to go dynamic.
 *
 * Never cached. The answer is different for every reader and stale auth state in
 * the navbar is the kind of bug that looks like a logout.
 */
export async function GET() {
  const { user, profile, role, isAdmin, isSuperAdmin } = await getSession();
  return NextResponse.json(
    {
      authed: !!user,
      email: user?.email ?? null,
      profile,
      role,
      isAdmin,
      isSuperAdmin,
      // Ask about reminder emails until the member has answered once (signup
      // box, Settings, the prompt, or an unsubscribe link). Not while they're
      // still on the username step. Shared with the app's GET /api/app/me.
      emailPrompt: shouldAskAboutEmail(profile),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
