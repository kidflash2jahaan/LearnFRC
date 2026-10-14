import "server-only";
import {
  getTeamByNumber,
  getTeamSubteamCoverage,
  getTeamMemberDeptProgress,
  getReferralCount,
  type MemberDeptProgress,
  type SubteamCoverage,
} from "@/lib/queries";
import { clampPct } from "@/lib/utils";
import type { TeamMemberProgress } from "@/lib/types";

/**
 * Everything the team sheet shows, loaded once. Shared by the website's /teams
 * page and the app's GET /api/app/team, so the two always show the same
 * members, numbers and coverage.
 *
 * PRIVACY: members are identified by username and avatar only. The queries
 * underneath never select `full_name`, and nothing here adds it. The viewer
 * must be a member of `teamNumber` (both callers pass the signed-in user's own
 * team number from their own profile).
 */
export type TeamSheet = {
  teamNumber: number;
  totalLessons: number;
  /** Most lessons first, then most XP. */
  members: TeamMemberProgress[];
  /** People the viewer has referred (for the invite's tone). */
  referralCount: number;
  /** One row per department (subteam), in catalog order. */
  coverage: SubteamCoverage[];
  /** user id to that member's progress, department by department. */
  deptProgress: Record<string, MemberDeptProgress[]>;
  /** Lessons finished, counting everyone (a lesson two people did counts twice). */
  totalCompleted: number;
  /** members x lessons in the catalog. */
  totalNeeded: number;
  /** 0 to 100: average through the catalog. */
  avgPct: number;
  /** Subteams (departments) with at least one member on them. */
  claimedSubteams: number;
  /** Distinct lessons finished by anyone on the team (each lesson once). */
  lessonsCovered: number;
};

export async function loadTeamSheet(
  teamNumber: number,
  viewerId: string
): Promise<TeamSheet> {
  const [{ totalLessons, members }, referralCount] = await Promise.all([
    getTeamByNumber(teamNumber),
    getReferralCount(viewerId),
  ]);
  const ids = members.map((m) => m.userId);
  // Departments ARE subteams, so this is the one team view a member can act on.
  // The coverage query never opens the profiles table at all.
  const [coverage, deptProgress] = await Promise.all([
    getTeamSubteamCoverage(ids),
    getTeamMemberDeptProgress(ids),
  ]);

  const totalCompleted = members.reduce((s, m) => s + m.completed, 0);
  const totalNeeded = members.length * totalLessons;
  const avgPct =
    members.length && totalLessons
      ? clampPct((totalCompleted / totalNeeded) * 100)
      : 0;

  // Coverage is computed from exactly these members, so a subteam is claimed
  // when anyone appears on it. Distinct lessons, NOT the sum of the per-member
  // counts, which double-counts a lesson two people both did.
  const claimedSubteams = coverage.filter((c) => c.members.length > 0).length;
  const lessonsCovered = coverage.reduce((s, c) => s + c.teamCompleted, 0);

  return {
    teamNumber,
    totalLessons,
    members,
    referralCount,
    coverage,
    deptProgress,
    totalCompleted,
    totalNeeded,
    avgPct,
    claimedSubteams,
    lessonsCovered,
  };
}
