import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyTeamSpace, isTeamNumberClaimed } from "@/lib/team-space";
import { Glow } from "@/components/motion/primitives";
import { SpaceCreate } from "@/components/team/space-manage-create";

/**
 * CREATE / CLAIM A TEAM SPACE.
 *
 * Auth-gated and never cached: it renders one specific person's eligibility and
 * one specific team number. `/teams` is already in the robots disallow list, so
 * this path is covered, and the metadata below makes that independent of
 * robots.txt — which is a crawling hint, not an access control.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Start a team space · LearnFRC",
  description:
    "Create a shared space for your FIRST team and invite them with one link.",
  robots: { index: false, follow: false },
};

export default async function NewTeamSpacePage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login?next=/teams/space/new");

  // One active space per account, DB-enforced. Someone who already has one has
  // nothing to create here.
  const mine = await getMyTeamSpace();
  if (mine) redirect("/teams/space");

  const supabase = await createClient();
  const [{ count }, prefillClaimed] = await Promise.all([
    // The caller's OWN progress, read under their own RLS — this page never
    // touches another user's rows.
    supabase
      .from("lesson_progress")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    /**
     * Whether the number already on this profile is claimed.
     *
     * Checked ONLY for the viewer's own profile.team_number, never for a value
     * from the URL or the form. The point is that someone whose team already
     * has a space is told so before they spend one of their two daily create
     * attempts on a number that was never going to work. It answers a single
     * bit — "a space exists" — and names nobody: no lead, no member, no count.
     * Do NOT turn this into a live "check availability" endpoint against
     * arbitrary numbers; that would be an enumeration oracle over which teams
     * have spaces, and the create action's 2-per-day limit is what bounds it
     * today.
     */
    profile?.team_number
      ? isTeamNumberClaimed(profile.team_number)
      : Promise.resolve(false),
  ]);

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
        <SpaceCreate
          defaultTeamNumber={profile?.team_number ?? null}
          defaultClaimed={prefillClaimed}
          // Anti-spam speed bump only. Nothing downstream may read this as
          // evidence about who the creator is.
          eligible={(count ?? 0) >= 1}
        />
      </div>
    </div>
  );
}
