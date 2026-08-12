import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type SocialProofStats = {
  /** Rows in `profiles`: everyone who has made an account. */
  learners: number;
  /** Distinct FRC team numbers people have put on their profile. */
  teams: number;
  /** Rows in `lesson_progress`, which only ever records completions. */
  lessonsCompleted: number;
};

/**
 * The three public counters under the home page's "Who uses it" section.
 *
 * UNCACHED ON PURPOSE. Two callers wrap it differently:
 *  - src/components/social-proof.tsx wraps it in unstable_cache at 24h, because
 *    Next takes the MINIMUM revalidate across everything a page reads and a
 *    short window there would rebuild the site's busiest page constantly.
 *  - src/app/api/stats/route.ts calls it live, so the browser can refresh the
 *    numbers after the cached HTML has painted.
 * Keeping the query here means those two can never drift into reporting
 * different figures for the same three labels.
 *
 * Service-role client because `profiles` is not SELECTable by the anon API role
 * and `lesson_progress` is RLS-locked per user. Every result is a plain
 * integer, so no row about any person leaves this function.
 */
export async function getSocialProofStats(): Promise<SocialProofStats> {
  const admin = createAdminClient();
  const [learners, completions] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("lesson_progress").select("id", { count: "exact", head: true }),
  ]);

  // Distinct team numbers have to be counted client-side (PostgREST has no
  // COUNT(DISTINCT)), and a plain .select() would stop at PostgREST's 1000-row
  // cap SILENTLY, undercounting teams the moment signups pass it. Page it,
  // ordered by id so windows can't overlap or skip.
  const teamNumbers = new Set<number>();
  const PAGE = 1000;
  const MAX_PAGES = 200; // hard stop so a bad response can't spin forever
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await admin
      .from("profiles")
      .select("team_number")
      .not("team_number", "is", null)
      .order("id")
      .range(page * PAGE, page * PAGE + PAGE - 1);
    // THROW, never break. Breaking here would return the teams counted so far
    // as if the scan had finished, which prints a real-looking undercount. The
    // whole point of this section is that its numbers are measured, so a number
    // we are not sure of has to become no number at all.
    if (error) throw error;
    const chunk = (data ?? []) as { team_number: number | null }[];
    for (const row of chunk) {
      if (row.team_number != null) teamNumbers.add(row.team_number);
    }
    if (chunk.length < PAGE) break;
  }

  // Same reasoning for the two counts. `count` is null on a failed query, and
  // `?? 0` would quietly render "0 learners" as a measured fact. Callers catch
  // this and render without stats rather than with wrong ones. On a site that
  // has been publicly accused of making things up, a confidently wrong number
  // is worse than a missing one.
  if (learners.error) throw learners.error;
  if (completions.error) throw completions.error;
  if (learners.count == null || completions.count == null)
    throw new Error("social-proof: count came back null without an error");

  return {
    learners: learners.count,
    teams: teamNumbers.size,
    lessonsCompleted: completions.count,
  };
}
