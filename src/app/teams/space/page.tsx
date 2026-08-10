import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  getMyTeamSpace,
  getSpaceOverview,
  getSpaceInvite,
} from "@/lib/team-space";
import { Glow } from "@/components/motion/primitives";
import { SpaceManage, type ManageMember } from "@/components/team/space-manage";
import { SpaceMemberView } from "@/components/team/space-manage-member";
// The single source of truth for what an invite URL looks like. Building the
// string here instead would let the thing that MINTS the link drift from the
// thing that READS it — and a lead has no way to tell a dead link from a live
// one until a teammate reports that joining did nothing.
import { inviteUrl } from "@/app/join/space/invite-link";

/**
 * THE TEAM SPACE HOME — management view for the lead, consent-and-leave view
 * for everyone else.
 *
 * `force-dynamic` is load-bearing, not habit. A lead's page carries their live
 * invite token, and every page carries a roster of minors. Neither may ever
 * land in a shared cache entry or be served by a CDN to a second viewer, so
 * there is no revalidate, no unstable_cache, and no fetch cache anywhere on
 * this path. Nothing here is keyed by anything a caller supplies: the space is
 * resolved from the signed-in user's own membership row, so there is no
 * `?team=` to widen and no id to swap.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team space · LearnFRC",
  description: "Your team's shared training space.",
  robots: { index: false, follow: false },
};

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

const PROGRAM_LABEL: Record<string, string> = {
  frc: "FIRST Robotics Competition",
  ftc: "FIRST Tech Challenge",
  fll: "FIRST LEGO League",
};

/**
 * Dates are formatted HERE, on the server, and shipped as finished strings.
 * Formatting inside a client component would render one value during SSR and
 * potentially another after hydration (different locale, different timezone,
 * a crossed day boundary) — the hydration contract on this codebase forbids
 * branching rendered text on client-only state. UTC is pinned for the same
 * reason.
 */
function joinedLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "recently";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function expiryLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "Expired";
  const days = Math.ceil(ms / 86_400_000);
  return days <= 1 ? "Expires within a day" : `Expires in ${days} days`;
}

export default async function TeamSpacePage() {
  const { user } = await getSession();
  if (!user) redirect("/login?next=/teams/space");

  const space = await getMyTeamSpace();
  if (!space) redirect("/teams/space/new");

  const overviewRes = await getSpaceOverview(space.id);
  // Only reachable if the membership disappeared between the two reads.
  if (!overviewRes.ok) redirect("/teams");
  const overview = overviewRes.data;

  const isLead = space.myRole === "lead";

  const members: ManageMember[] = overview.members.map((m) => ({
    memberKey: m.memberKey,
    username: m.username,
    avatarUrl: m.avatarUrl,
    isLead: m.isLead,
    isSelf: m.isSelf,
    joinedLabel: joinedLabel(m.joinedAt),
  }));

  const programLabel = PROGRAM_LABEL[space.program] ?? "FIRST";
  const invite = isLead ? await leadInvite(space.id) : null;

  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          {
            size: "620px",
            pos: { left: "-170px", top: "-200px" },
            color: "#8bbcff",
            opacity: 0.6,
          },
          {
            size: "540px",
            pos: { right: "-160px", top: "-120px" },
            color: "#6ff0ea",
            opacity: 0.45,
            delay: 2,
          },
        ]}
      />
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        {isLead ? (
          <SpaceManage
            teamNumber={space.teamNumber}
            programLabel={programLabel}
            members={members}
            memberCount={overview.memberCount}
            teamCompleted={overview.teamCompleted}
            totalLessons={overview.totalLessons}
            invite={invite}
          />
        ) : (
          <SpaceMemberView
            teamNumber={space.teamNumber}
            programLabel={programLabel}
            leadUsername={
              overview.members.find((m) => m.isLead)?.username ?? "your team lead"
            }
            members={members}
            memberCount={overview.memberCount}
            teamCompleted={overview.teamCompleted}
            totalLessons={overview.totalLessons}
          />
        )}
      </div>
    </div>
  );
}

/**
 * The lead's live link, assembled into a URL.
 *
 * `getSpaceInvite` re-derives leadership before it will produce the token — the
 * `token` column has no grant to any client role, so this is the only path that
 * yields the secret at all. It reaches the browser exactly once, inside the
 * lead's own uncached HTML.
 *
 * The URL is built by `inviteUrl()` — it points at the consent-and-accept
 * screen, carries the token as a query param (so it never lands in
 * `page_views.path` or third-party analytics) and is covered by the `/join`
 * robots disallow. Clicking it confers nothing on its own.
 */
async function leadInvite(spaceId: string) {
  const res = await getSpaceInvite(spaceId);
  if (!res.ok || !res.data) return null;
  const inv = res.data;
  return {
    url: inviteUrl(inv.token, SITE),
    expiresLabel: expiryLabel(inv.expiresAt),
    uses: inv.uses,
    maxUses: inv.maxUses,
  };
}
