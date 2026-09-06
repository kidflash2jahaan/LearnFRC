import Link from "next/link";
import { unstable_cache } from "next/cache";
import { getSocialProofStats as fetchSocialProofStats } from "@/lib/social-proof-stats";
import { LiveStats } from "@/components/live-stat";
import { LISTED_TEAMS, TEAM_QUOTES } from "@/lib/team-quotes";

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
 * Cached wrapper for the home page's static render. The query itself lives in
 * src/lib/social-proof-stats.ts so /api/stats can call it live and the two can
 * never drift into reporting different figures for the same three labels.
 */
const getSocialProofStats = unstable_cache(
  fetchSocialProofStats,
  ["home-social-proof"],
  { revalidate: SOCIAL_PROOF_TTL, tags: ["social-proof"] }
);

/** Four angles, so no two cards on the wall were straightened the same. */
const TILT = ["nb-tilt-2", "nb-tilt-3", "nb-tilt-1", "nb-tilt-4"] as const;

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
 *
 * The team number is set as a stamp, in the mono face every other identifier on
 * this site uses, on its own small card. That is the whole visual claim being
 * made: a number, and one sentence describing exactly what that team agreed to.
 * Nothing here is allowed to look like a logo wall.
 */
export async function SocialProof() {
  // Never let a stats read take the home page down, and never render a zero:
  // "0 learners" would be worse than showing no numbers at all.
  const stats = await getSocialProofStats().catch(() => null);
  const showStats = stats !== null && stats.learners > 0;

  return (
    <section className="nb-wrap py-[clamp(2.6rem,5vw,4.4rem)]">
      <p className="nb-marker">who uses it</p>
      <h2>Who is actually using this</h2>
      <p className="nb-sub mt-4">
        It&rsquo;s a fair thing to ask about a site one student built.
        Here&rsquo;s what I can back up: every team named below said yes in
        writing, and every number is counted straight from the database.
      </p>

      {/* A team appears here only after it has said yes in writing, and only
          with the claim it actually agreed to. */}
      <ul className="mt-8 flex flex-col gap-5">
        {LISTED_TEAMS.map((t, i) => (
          <li key={t.team}>
            {/* MOTION: a taped card straightens on arrival, the same rule the
                department wall above it runs on. */}
            <div className={`nb-box nb-straighten ${TILT[i % TILT.length]} p-[clamp(1.2rem,2.6vw,1.8rem)]`}>
              <span className="nb-tape -top-3 left-[12%] rotate-[-3.8deg]" aria-hidden="true" />
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <span
                  aria-hidden="true"
                  className="nb-box-sm grid h-16 w-16 shrink-0 place-items-center font-mono text-xl font-bold tabular-nums"
                >
                  {t.team}
                </span>
                <div className="min-w-0">
                  <p className="nb-slug">team / {t.team}</p>
                  <h3 className="mt-1.5">
                    Team {t.team} {t.use}
                  </h3>
                  <p className="mt-3 max-w-[60ch] text-[0.95rem] leading-relaxed text-graphite">
                    They gave written permission to be listed here, and
                    that&rsquo;s the whole claim. I&rsquo;m not stretching it
                    into anything bigger. If your team is happy to be listed
                    too,{" "}
                    <Link href="/contact" className="nb-link">
                      send me a message
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {showStats && (
        <>
          <LiveStats initial={stats} />
          <p className="nb-hint mt-4 max-w-[62ch]">
            These come out of the database when the page rebuilds, not from
            anything I type in by hand. The team count is how many different FRC
            team numbers people have put on their profiles, so it&rsquo;s teams
            with at least one account here.
          </p>
        </>
      )}

      {/* Quotes render only when a real one has arrived. Nothing here is ever
          written by me or by an AI. See src/lib/team-quotes.ts. */}
      {TEAM_QUOTES.length > 0 && (
        <ul className="mt-6 flex flex-col gap-4">
          {TEAM_QUOTES.map((q) => (
            <li key={q.team}>
              <figure className="nb-note">
                <blockquote className="text-pretty text-[1.05rem] leading-relaxed">
                  {q.quote}
                </blockquote>
                <figcaption className="nb-slug mt-3">{q.attribution}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
