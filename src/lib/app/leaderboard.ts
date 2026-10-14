import "server-only";
import {
  getLeaderboard,
  getWeeklyLeaderboard,
  getTeamLeaderboard,
  getXpTotals,
  TEAM_MIN_MEMBERS,
  type TeamEntry,
} from "@/lib/queries";
import { levelForXp } from "@/lib/app/levels";

/**
 * The leaderboards as the app's GET /api/app/leaderboard sends them. The data
 * comes from the same cached queries /leaderboard renders (src/lib/queries.ts,
 * 5-minute cache under the `leaderboard` tag), with the same limit of 50 and
 * the same mapping: XP and lessons for the weekly board are the last seven
 * days, the level is always from all-time XP.
 *
 * PRIVACY: every field is copied out by name from the queries' explicit
 * column list (PROFILE_BOARD_COLS). No `full_name`, and no user ids.
 */

export const BOARDS = ["weekly", "alltime", "teams"] as const;
export type Board = (typeof BOARDS)[number];
export const BOARD_LIMIT = 50;

export type LearnerEntry = {
  rank: number;
  username: string | null;
  avatarUrl: string | null;
  teamNumber: number | null;
  role: string;
  /** Weekly board: XP earned in the last 7 days. All-time board: total XP. */
  xp: number;
  /** From all-time XP on both boards. */
  level: number;
  /** Weekly board: lessons in the last 7 days. All-time board: all lessons. */
  lessons: number;
};

export type TeamBoardEntry = {
  rank: number;
  teamNumber: number;
  members: number;
  xp: number;
  avgXp: number;
};

export type BoardPayload =
  | { board: "weekly" | "alltime"; entries: LearnerEntry[]; totals: XpTotals }
  | {
      board: "teams";
      /** By combined XP. */
      entries: TeamBoardEntry[];
      /** Teams with `minMembers`+ members, by XP per member. */
      perMember: TeamBoardEntry[];
      minMembers: number;
      totals: XpTotals;
    };

type XpTotals = { learners: number; totalXp: number };

function teamRow(t: TeamEntry): TeamBoardEntry {
  return {
    rank: t.rank,
    teamNumber: t.team_number,
    members: t.members,
    xp: t.totalXp,
    avgXp: t.avgXp,
  };
}

export function parseBoard(raw: string | null): Board | null {
  const v = (raw ?? "weekly").trim().toLowerCase();
  return (BOARDS as readonly string[]).includes(v) ? (v as Board) : null;
}

export async function loadBoard(board: Board): Promise<BoardPayload> {
  const totals = await getXpTotals();

  if (board === "teams") {
    const { byTotal, byMember } = await getTeamLeaderboard(BOARD_LIMIT);
    return {
      board,
      entries: byTotal.map(teamRow),
      perMember: byMember.map(teamRow),
      minMembers: TEAM_MIN_MEMBERS,
      totals,
    };
  }

  if (board === "weekly") {
    const rows = await getWeeklyLeaderboard(BOARD_LIMIT);
    return {
      board,
      entries: rows.map((p, i) => ({
        rank: i + 1,
        username: p.username,
        avatarUrl: p.avatar_url,
        teamNumber: p.team_number,
        role: p.role || "student",
        xp: p.weeklyXp,
        level: levelForXp(p.xp),
        lessons: p.weeklyLessons,
      })),
      totals,
    };
  }

  const rows = await getLeaderboard(BOARD_LIMIT);
  return {
    board,
    entries: rows.map((p, i) => ({
      rank: i + 1,
      username: p.username,
      avatarUrl: p.avatar_url,
      teamNumber: p.team_number,
      role: p.role || "student",
      xp: p.xp ?? 0,
      level: levelForXp(p.xp),
      lessons: p.lessons,
    })),
    totals,
  };
}
