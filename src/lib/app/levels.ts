/**
 * Level and rank tier from XP. One hundred XP a level, the same rule the
 * dashboard, the leaderboard and the public profile page use. The tiers are
 * the public profile's rank stamp (src/app/u/[username]/page.tsx).
 *
 * Pure and client-safe.
 */

export const XP_PER_LEVEL = 100;

export function levelForXp(xp: number | null | undefined): number {
  return Math.floor(Math.max(0, xp ?? 0) / XP_PER_LEVEL) + 1;
}

/** Rank tiers earned by level. A name, not a colour. */
export function tierFor(level: number): string {
  if (level >= 25) return "Champion";
  if (level >= 15) return "All-Star";
  if (level >= 8) return "Veteran";
  if (level >= 3) return "Contender";
  return "Rookie";
}
