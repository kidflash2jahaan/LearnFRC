import type { NextRequest } from "next/server";
import { loadBoard, parseBoard } from "@/lib/app/leaderboard";
import { apiError, guarded, publicOk } from "@/lib/app/http";

/**
 * GET /api/app/leaderboard?board=weekly|alltime|teams
 *
 * The same boards /leaderboard renders, from the same cached queries
 * (src/lib/app/leaderboard.ts). Public and the same for everyone, so the CDN
 * holds each board for 60 seconds. Usernames only, never real names or ids.
 */
export async function GET(req: NextRequest) {
  return guarded(async () => {
    const board = parseBoard(req.nextUrl.searchParams.get("board"));
    if (!board)
      return apiError("validation", "Pick a board: weekly, alltime or teams.");
    return publicOk(await loadBoard(board), 60, 300);
  });
}
