import { blockUser, listBlocks } from "@/lib/app/blocks";
import {
  badJson,
  fromFailure,
  guarded,
  ok,
  readJsonObject,
  requireAppUser,
  successBody,
} from "@/lib/app/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/app/blocks: everyone the caller has blocked, newest first, by their
 * handle now (`listBlocks` in src/lib/app/blocks.ts, which the website's
 * Settings list renders from too).
 *
 * The app hides these handles from the leaderboards and public profiles it
 * has on screen or cached; GET /api/app/team already leaves them off.
 */
export async function GET(req: Request) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const result = await listBlocks(auth.user);
    if (!result.ok) return fromFailure(result);
    return ok(successBody(result));
  });
}

/**
 * POST /api/app/blocks { username }: blocks an account, through blockUser,
 * the function the website's Block button calls (no blocking yourself, 500 at
 * most, 60 an hour). Blocking someone already blocked answers 200 as well.
 */
export async function POST(req: Request) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const body = await readJsonObject(req);
    if (!body) return badJson();
    const result = await blockUser(auth.user, { username: body.username });
    if (!result.ok) return fromFailure(result);
    return ok(successBody(result));
  });
}
