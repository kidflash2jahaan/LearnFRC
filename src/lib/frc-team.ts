/**
 * ONE RULE FOR WHAT COUNTS AS AN FRC TEAM NUMBER.
 *
 * `profiles.team_number` is a free number field, so it holds two kinds of
 * thing: real FRC team numbers, and whatever somebody typed to get past the
 * field. 12345 and 99990 are both in there.
 *
 * The site prints "FRC teams represented" in two places off two different
 * queries, the home page's public counter and the admin tally, and the moment
 * one of them filtered and the other did not, the same label carried two
 * different numbers (173 and 175). That is the bug this module exists to make
 * impossible: both import the predicate below, so they cannot drift apart.
 *
 * This is a PLAUSIBILITY BOUND, not validation. Nothing here rejects a signup
 * or edits anybody's profile: the account keeps whatever it entered, the number
 * just does not add a team that has never existed to a published count.
 */

/**
 * Highest plausible FRC team number. FIRST has handed numbers out sequentially
 * since 1992 and the newest are a little over 10,000, so this leaves headroom
 * for several more seasons of rookies while still excluding placeholders.
 *
 * Raise it when real numbers approach it. Everything above it today is a typo.
 */
export const MAX_FRC_TEAM = 12_000;

/** Whether a stored `team_number` can be a real FRC team. */
export function isPlausibleTeamNumber(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= MAX_FRC_TEAM;
}

/** Distinct plausible team numbers in a list of profile rows. */
export function countDistinctTeams(
  rows: { team_number: number | null }[]
): number {
  const seen = new Set<number>();
  for (const row of rows) {
    if (isPlausibleTeamNumber(row.team_number)) seen.add(row.team_number);
  }
  return seen.size;
}
