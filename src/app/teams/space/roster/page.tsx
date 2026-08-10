import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getMyTeamSpace } from "@/lib/team-space";
import { Glow } from "@/components/motion/primitives";
import { TeamRosterView } from "@/components/team/roster-view";

/**
 * /teams/space/roster — the lead's progress view.
 *
 * SPLIT FROM /teams/space ON PURPOSE. That page is the management surface:
 * who is in, the invite link, the danger zone. This one is the read a mentor
 * actually opens the product for — how much of the curriculum the team has
 * covered, where the holes are, and who has stalled. Keeping them apart means
 * per-member progress is not sitting on the same screen as the invite token,
 * and it gives this view its own uncached, membership-gated entry point.
 *
 * THIN BY DESIGN. Everything that renders lives in
 * src/components/team/roster-view.tsx as a self-contained async Server
 * Component, so it can be dropped into a different shell without moving markup.
 *
 * NEVER CACHED. force-dynamic because the entire body is one team's per-member
 * progress; an ISR entry or a CDN copy keyed on the path alone would hand one
 * space's roster to the next visitor. Nothing on this path is wrapped in
 * unstable_cache either.
 *
 * NOTHING HERE IS KEYED ON ANYTHING A CALLER SUPPLIES. The space is resolved
 * from the signed-in user's own membership row — there is no `?team=` to widen
 * and no id to swap, so the classic "type someone else's team number" attack
 * that the old /teams page allowed has no surface at all.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team progress · LearnFRC",
  description: "How much of the curriculum your team has covered.",
  // Never indexable: usernames and study progress of minors. robots.txt is not
  // a security control — the real gate is auth plus a lead membership row —
  // but a page like this should never be one leaked link away from a crawler.
  robots: { index: false, follow: false },
};

export default async function TeamRosterPage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login?next=/teams/space/roster");

  // Reads only the caller's own membership row. Null for everyone who has not
  // joined a space, which is most of the platform.
  const space = await getMyTeamSpace();
  if (!space) redirect("/teams/space/new");

  // Per-member progress is the lead's read alone. A member is legitimately in
  // the space, so they get sent to their own view rather than a 404 — and that
  // page does not redirect back here, so there is no loop.
  if (space.myRole !== "lead") redirect("/teams/space");

  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          {
            size: "600px",
            pos: { left: "-170px", top: "-200px" },
            color: "#8bbcff",
            opacity: 0.6,
          },
          {
            size: "520px",
            pos: { right: "-150px", top: "-120px" },
            color: "#6ff0ea",
            opacity: 0.45,
            delay: 2,
          },
        ]}
      />

      <div className="mx-auto max-w-5xl px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        <TeamRosterView
          spaceId={space.id}
          viewerUsername={profile?.username ?? null}
        />
      </div>
    </div>
  );
}
