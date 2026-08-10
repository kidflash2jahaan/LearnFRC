/**
 * The team invite link — one string, built in one place.
 *
 * WHY THERE IS NOTHING TO BUILD HERE
 * ----------------------------------
 * A team invite needs no membership model, no token, no expiry and no join
 * screen. It is the referral link this site already ships, pointed at the
 * team surface:
 *
 *     https://learnfrc.com/signup?ref=<username>&via=team-invite
 *
 * `/signup` already reads `?ref=` and `?via=` (see src/app/signup/page.tsx),
 * `team-invite` is already allow-listed in REFERRAL_SURFACES, and
 * `attributeSignup` already writes `referred_by` + `referral_surface` and pays
 * the double-sided +25 XP on email confirmation. So a scanned QR and a pasted
 * link both land on a working, attributed signup with zero new plumbing.
 *
 * THE HOST IS HARD-CODED ON PURPOSE. Every other surface that builds a
 * referral link (invite-card, subteam-gap-card) hard-codes it too, and this one
 * additionally gets printed onto paper and projected on a wall — a QR that
 * encoded `http://localhost:3000` because an env var was unset in some
 * environment is a stack of handouts in the bin.
 *
 * Pure and dependency-free, so both the page and the printable sheet import it
 * and the code on paper can never drift from the link on screen.
 */

/** The `?via=` surface tag. Allow-listed in src/lib/signup-attribution.ts. */
export const TEAM_INVITE_VIA = "team-invite";

const SITE = "https://learnfrc.com";

/** The invite link for a member, credited to their username. */
export function teamInviteUrl(username: string): string {
  return `${SITE}/signup?ref=${encodeURIComponent(
    username
  )}&via=${TEAM_INVITE_VIA}`;
}

/**
 * The same link with the scheme stripped, for the "or type this in" line on
 * the printed sheet. Derived from `teamInviteUrl` rather than re-assembled, so
 * the printed text and the encoded QR are the same URL by construction.
 */
export function teamInviteDisplayUrl(username: string): string {
  return teamInviteUrl(username).replace(/^https?:\/\//, "");
}
