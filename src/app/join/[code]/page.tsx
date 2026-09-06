import { redirect } from "next/navigation";

/**
 * /join/<code>, the catcher for invite links that predate auto-grouping.
 *
 * Nothing on the site has generated one of these since manual join codes were
 * removed in favour of grouping members by team number. Search `src/` and the
 * only surviving mentions are this file, a Disallow line in robots.ts, and two
 * comments. The live invite is a plain referral link built by
 * `teamInviteUrl`, and /teams is where it is handed out.
 *
 * So this route has no page of its own to draw, and it should not grow one.
 * What it catches is history: codes pasted into team Discords in 2025, codes
 * printed on a sheet still pinned to somebody's shop wall, codes sitting in a
 * group chat nobody has scrolled back through. Those links cannot be recalled,
 * so the route stays and forwards them to the surface that replaced it.
 *
 * The code in the URL is deliberately dropped rather than looked up. There is
 * no table left to look it up in, and inventing a "that invite expired" screen
 * would be a whole page built to apologise for a feature that no longer
 * exists. /teams answers the question the person actually arrived with, which
 * is how they get in with the rest of their team.
 *
 * WORTH KNOWING BEFORE CHANGING ANYTHING HERE. A signed-out visitor holding an
 * old link is bounced twice, /join/<code> to /teams to /login?next=/teams, and
 * lands on sign IN rather than sign UP with no mention of the team that
 * invited them. That is the weakest link in the invite path, but the fix
 * belongs on the pages that own those two redirects, not in a stub that is
 * doing the one job it has correctly.
 */
export default function JoinRedirect() {
  redirect("/teams");
}
