/**
 * The team invite link, assembled in one place so every surface hands out the
 * same string.
 *
 * WHAT AN INVITE IS ON THIS SITE
 * There is no membership model, no token, no expiry and no join screen. Being
 * on a team here means having the team number on your profile, and the signup
 * form already asks for that. So an invite is the referral link this site
 * already ships, pointed at the team surface:
 *
 *     https://learnfrc.com/signup?ref=<username>&via=team-invite
 *
 * /signup already reads `?ref=` and `?via=` (src/app/signup/page.tsx),
 * "team-invite" is already allow-listed in REFERRAL_SURFACES, and
 * `attributeSignup` already writes `referred_by` plus `referral_surface` and
 * pays the double-sided +25 XP once the new account confirms its email. A
 * scanned QR and a pasted link both land on a working, attributed signup with
 * no new plumbing behind them.
 *
 * Nothing here expires and nothing can be revoked, which is the point: a sheet
 * pinned to a shop wall in October still works in March.
 *
 * WHY IT IS ITS OWN MODULE
 * Four surfaces emit this link: the copy field and the share sheet on /teams,
 * the QR beside them, the same component in the dashboard slot, and the printed
 * handout at /teams/print. A page whose copy button and QR code encode
 * different strings splits its own attribution in half, and that bug has
 * already shipped here once. One function, imported by all four, is the fix.
 *
 * Pure and dependency-free, so the server render, the client copy button and
 * the printable sheet are all reading the same code.
 *
 * WHY THE HOST IS HARD-CODED
 * Every other referral surface hard-codes it too, and this one additionally
 * gets printed onto paper and projected onto a wall. A QR that encoded
 * http://localhost:3000 because an env var was unset in some environment is a
 * stack of handouts in the bin.
 */

/**
 * The `?via=` tag for the /teams placement. Allow-listed as this exact string
 * in src/lib/signup-attribution.ts.
 */
export const TEAM_INVITE_VIA = "team-invite";

/** Hard-coded on purpose. See the note above. */
const SITE = "https://learnfrc.com";

/**
 * The invite link for one member, credited to their username.
 *
 * `via` defaults to the /teams tag. The dashboard placement passes its own,
 * "team-invite-dashboard", so the two can still be told apart in
 * `referral_surface` afterwards. Anything passed here has to be allow-listed in
 * REFERRAL_SURFACES or `normalizeVia` drops it on arrival and the signup
 * records no surface at all.
 *
 * Both values are percent-encoded. The live tags are lowercase slugs, so the
 * output is byte for byte what it has always been, but a tag carrying a space
 * or an ampersand would otherwise open a second query parameter instead of
 * naming a surface.
 */
export function teamInviteUrl(
  username: string,
  via: string = TEAM_INVITE_VIA
): string {
  const ref = encodeURIComponent(username);
  const surface = encodeURIComponent(via);
  return `${SITE}/signup?ref=${ref}&via=${surface}`;
}

/**
 * The same link with the scheme stripped, for the "or type this in" line on the
 * printed sheet and the caption under the QR.
 *
 * Derived from `teamInviteUrl` rather than assembled a second time, so the text
 * a reader types and the URL the code encodes are the same string by
 * construction.
 */
export function teamInviteDisplayUrl(
  username: string,
  via: string = TEAM_INVITE_VIA
): string {
  return teamInviteUrl(username, via).replace(/^https?:\/\//, "");
}
