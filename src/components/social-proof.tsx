import type { CSSProperties } from "react";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { Users, Quote } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { AnimatedCounter } from "@/components/animated-counter";
import {
  Reveal,
  RevealGroup,
  RevealItem,
  Hover,
} from "@/components/motion/primitives";
import { LISTED_TEAMS, TEAM_QUOTES } from "@/lib/team-quotes";

// Mirrors the home page's brand gradient. Kept local so this section can be
// dropped anywhere without importing from a route file.
const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

export type SocialProofStats = {
  /** Rows in `profiles`: everyone who has made an account. */
  learners: number;
  /** Distinct FRC team numbers people have put on their profile. */
  teams: number;
  /** Rows in `lesson_progress`, which only ever records completions. */
  lessonsCompleted: number;
};

// 24 hours, matching CATALOG_TTL in src/lib/queries.ts. This is deliberately
// NOT shorter than the rest of the home page's data.
//
// Next takes the MINIMUM revalidate across everything a page reads, so this
// constant sets how often the whole home page regenerates. At 3600 it silently
// dragged the site's highest-traffic page from a daily rebuild to an hourly
// one, undoing a decision an earlier commit made on purpose and wrote down
// (CATALOG_TTL was raised from 1h to 24h precisely to stop hourly ISR writes
// and DB refetches for content that barely changes).
//
// These three counters do not need to be fresher than that. Going from 346
// learners to 347 is not worth rebuilding the home page 24 times a day, and
// nothing here is time-sensitive. If a number ever must update immediately,
// revalidate the "social-proof" tag from /api/revalidate instead of lowering
// this.
const SOCIAL_PROOF_TTL = 86400;

/**
 * The three numbers under the social-proof section, measured rather than
 * claimed. Service-role client because `profiles` is not SELECTable by the
 * anon API role and `lesson_progress` is RLS-locked per user; all three
 * results are plain integers, so no row about any person leaves this function.
 */
const getSocialProofStats = unstable_cache(
  async (): Promise<SocialProofStats> => {
    const admin = createAdminClient();
    const [learners, completions] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("lesson_progress").select("id", { count: "exact", head: true }),
    ]);

    // Distinct team numbers have to be counted client-side (PostgREST has no
    // COUNT(DISTINCT)), and a plain .select() would stop at PostgREST's
    // 1000-row cap SILENTLY — undercounting teams the moment signups pass it.
    // Page it, ordered by id so windows can't overlap or skip.
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
      // THROW, never break. Breaking here would return the teams counted so
      // far as if the scan had finished, which prints a real-looking undercount
      // on the homepage. The whole point of this section is that its numbers
      // are measured, so a number we are not sure of has to become no number.
      if (error) throw error;
      const chunk = (data ?? []) as { team_number: number | null }[];
      for (const row of chunk) {
        if (row.team_number != null) teamNumbers.add(row.team_number);
      }
      if (chunk.length < PAGE) break;
    }

    // Same reasoning for the two counts. `count` is null on a failed query, and
    // `?? 0` would quietly render "0 learners" as a measured fact. The caller
    // catches this and renders the section without stats rather than with wrong
    // ones. On a site that has been publicly accused of making things up, a
    // confidently wrong number is worse than a missing one.
    if (learners.error) throw learners.error;
    if (completions.error) throw completions.error;
    if (learners.count == null || completions.count == null)
      throw new Error("social-proof: count came back null without an error");

    return {
      learners: learners.count,
      teams: teamNumbers.size,
      lessonsCompleted: completions.count,
    };
  },
  ["home-social-proof"],
  { revalidate: SOCIAL_PROOF_TTL, tags: ["social-proof"] }
);

/**
 * Home page social proof.
 *
 * Two halves, both of which have to be true:
 *  - the teams in LISTED_TEAMS, who each gave written permission to be named,
 *    described only as far as that permission goes;
 *  - three aggregates read out of the database at build/revalidate time.
 *
 * Quotes come from TEAM_QUOTES and render only when it has entries. See that
 * file before adding anything to either array.
 */
export async function SocialProof() {
  // Never let a stats read take the home page down, and never render a zero:
  // "0 learners" would be worse than showing no numbers at all.
  const stats = await getSocialProofStats().catch(() => null);
  const showStats = stats !== null && stats.learners > 0;

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <Reveal>
        <p className="ac-eyebrow flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" aria-hidden /> Who uses it
        </p>
        <h2 className="mt-2 max-w-xl text-balance font-display text-3xl font-bold sm:text-4xl">
          Who’s actually using this
        </h2>
        {/* Deliberately count-agnostic: this stays true whether LISTED_TEAMS
            has one team or ten, so nobody has to remember to edit it. */}
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          It’s a fair thing to ask about a site one student built. Here’s what I
          can back up: every team named below said yes in writing, and every
          number is counted straight from the database.
        </p>
      </Reveal>

      {/* Named teams. A team appears here only after it has said yes in
          writing, and only with the claim it actually agreed to. */}
      <RevealGroup className="mt-8 grid grid-cols-1 gap-4">
        {LISTED_TEAMS.map((t) => (
          <RevealItem key={t.team}>
            <Hover lift={-4}>
              <div className="ac-glass p-6 sm:p-7">
                {/* Stacked at 375px so the copy gets the full card width,
                    side by side from sm up. */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <span
                    aria-hidden
                    className="ac-tile flex h-16 w-16 shrink-0 items-center justify-center font-display text-xl font-extrabold text-foreground"
                    style={{ "--a": "#2560e6" } as CSSProperties}
                  >
                    {t.team}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-bold leading-snug sm:text-xl">
                      Team {t.team} {t.use}
                    </h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                      They gave written permission to be listed here, and that’s
                      the whole claim. I’m not stretching it into anything
                      bigger. If your team is happy to be listed too,{" "}
                      <Link
                        href="/contact"
                        className="font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        send me a message
                      </Link>
                      .
                    </p>
                  </div>
                </div>
              </div>
            </Hover>
          </RevealItem>
        ))}
      </RevealGroup>

      {showStats && (
        <>
          <RevealGroup className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { value: stats.learners, label: "learners with an account" },
              { value: stats.teams, label: "FRC teams represented" },
              { value: stats.lessonsCompleted, label: "lessons completed" },
            ].map((s) => (
              <RevealItem key={s.label}>
                <Hover className="h-full">
                  <div className="ac-card h-full p-5 text-center">
                    <div
                      className="font-display text-3xl font-extrabold leading-none"
                      style={BRAND_GRADIENT}
                    >
                      <AnimatedCounter value={s.value} />
                    </div>
                    <div className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
                      {s.label}
                    </div>
                  </div>
                </Hover>
              </RevealItem>
            ))}
          </RevealGroup>

          <Reveal>
            <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              These come out of the database when the page rebuilds, not from
              anything I type in by hand. The team count is how many different
              FRC team numbers people have put on their profiles, so it’s teams
              with at least one account here.
            </p>
          </Reveal>
        </>
      )}

      {/* Quotes render only when a real one has arrived. Nothing here is ever
          written by me or by an AI — see src/lib/team-quotes.ts. */}
      {TEAM_QUOTES.length > 0 && (
        <RevealGroup className="mt-4 grid grid-cols-1 gap-4">
          {TEAM_QUOTES.map((q) => (
            <RevealItem key={q.team}>
              <figure className="ac-card p-6 sm:p-7">
                <Quote className="h-5 w-5 text-primary" aria-hidden />
                <blockquote className="mt-3 text-pretty text-[17px] leading-relaxed text-foreground">
                  “{q.quote}”
                </blockquote>
                <figcaption className="mt-3 text-sm font-semibold text-muted-foreground">
                  {q.attribution}
                </figcaption>
              </figure>
            </RevealItem>
          ))}
        </RevealGroup>
      )}
    </section>
  );
}
