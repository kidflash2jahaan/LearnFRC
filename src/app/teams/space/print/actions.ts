"use server";

import { revalidatePath } from "next/cache";
import {
  getMyTeamSpace,
  getSpaceInvite,
  createSpaceInvite,
} from "@/lib/team-space";

/**
 * Mint the join link for the sheet — and only if there isn't one already.
 *
 * TAKES NO ARGUMENTS, ON PURPOSE. There is no space id, no member key and no
 * token in the payload, so there is nothing for a caller to tamper with: the
 * target is re-derived from `auth.getUser()` inside `getMyTeamSpace()`, and
 * `createSpaceInvite` re-derives leadership again before it writes. A server
 * action is a public HTTP endpoint; the only argument shape that cannot be
 * abused is none.
 *
 * WHY NOT `createInviteAction` FROM src/app/actions/team-space.ts. That one is
 * the lead's deliberate "reset my invite link" control and always rotates,
 * which is right on the space page and wrong here for the reason below. It also
 * revalidates `/teams/space`, so pressing it from the sheet would leave the
 * sheet itself showing stale state.
 *
 * THE `if (current)` GUARD IS LOAD-BEARING. `createSpaceInvite` rotates —
 * minting a link revokes the previous one instantly, by design. That is exactly
 * right for "reset my invite link" and exactly wrong here: a lead who prints a
 * second copy of the sheet, or double-submits, would silently kill the code on
 * the twenty sheets already handed out at the meeting, and nobody would find
 * out until a student scanned a dead link. So this function only ever fills a
 * gap; rotation stays an explicit, separately-worded action on the space page.
 *
 * Failures are swallowed rather than surfaced: every error `createSpaceInvite`
 * can return here (`rate_limited`, `not_found`) re-renders as the same
 * "no live link yet" state the user is already looking at, and inventing a
 * louder message would leak which of those it was.
 */
export async function ensureSheetInvite(): Promise<void> {
  const space = await getMyTeamSpace();
  if (!space || space.myRole !== "lead") return;

  const current = await getSpaceInvite(space.id);
  if (!current.ok || current.data) return;

  await createSpaceInvite(space.id);
  revalidatePath("/teams/space/print");
}
