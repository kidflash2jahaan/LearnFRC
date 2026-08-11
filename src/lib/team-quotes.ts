/**
 * Teams that have given WRITTEN permission to be named on the site, and the
 * quotes they have sent.
 *
 * Read this before you touch either array below.
 *
 * 1. Nothing goes in here without a real written reply from that team that I
 *    can still open and re-read. Not a conversation someone remembers, not a
 *    "they'd probably be fine with it", not a team that was asked and hasn't
 *    answered yet.
 * 2. Never write a quote. Never paraphrase one, tidy one up, shorten one into
 *    something punchier, or drop in a placeholder to see how it looks. The
 *    `quote` field is the team's own words pasted in exactly as they sent
 *    them. A made-up testimonial is the single worst thing this site could
 *    ship, and an empty section costs nothing.
 * 3. The permission covers the TEAM NUMBER only, so nothing that renders may
 *    identify a person: no names, no roles, no "a mentor told me", no contact
 *    details. `attribution` is a team-level credit line like "Team 447" and
 *    nothing more. Provenance notes in these comments are for me, they never
 *    reach the page.
 * 4. Say only what the team agreed to. Team 447 agreed to be listed as a team
 *    that uses LearnFRC for training, so `use` says that and stops there. No
 *    "trusted by", no "loves", no adjectives they didn't write.
 * 5. Empty is a valid, shipping state. The homepage section renders no quote
 *    block at all when TEAM_QUOTES is empty, so it is always fine to wait for
 *    the real reply.
 */

export type ListedTeam = {
  /** FRC team number. The only identifier the permission covers. */
  team: number;
  /**
   * What the team agreed I can say they use LearnFRC for, phrased so it reads
   * as a sentence after "Team 447". Keep it literal and boring.
   */
  use: string;
};

/**
 * Teams that said yes, in writing, to being named.
 *
 * 447: a mentor replied "Feel free to list us on your site." That covers the
 * team being listed as a user of the site for training. It does not cover a
 * quote (see TEAM_QUOTES) and it does not cover naming anyone on the team.
 */
export const LISTED_TEAMS: readonly ListedTeam[] = [
  { team: 447, use: "uses LearnFRC for training" },
];

export type TeamQuote = {
  /** FRC team number the quote came from. */
  team: number;
  /** The team's own words, pasted in verbatim. Never written or edited by me. */
  quote: string;
  /** Team-level credit line shown under the quote, e.g. "Team 447". */
  attribution: string;
};

/**
 * Quotes from teams. EMPTY ON PURPOSE.
 *
 * Team 447 said they'd send one and it hasn't arrived yet. When the real reply
 * lands, this becomes one entry and nothing else in the codebase changes:
 *
 *   { team: 447, quote: "<paste their reply, word for word>", attribution: "Team 447" }
 *
 * Until then this array stays empty and the homepage shows no quote block.
 */
export const TEAM_QUOTES: readonly TeamQuote[] = [];
