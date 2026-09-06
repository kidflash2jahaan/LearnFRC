import Link from "next/link";
import { getLessonBridge } from "@/lib/lesson-bridge";

/**
 * The articles someone clipped to this page of the binder.
 *
 * WHY: before this, 0 of 394 lesson pages linked to a single article, in either
 * direction. That was backwards twice over. Lessons are the site's largest
 * surface (507 of the 691 URLs in the sitemap) and articles are the pages that
 * actually pull search traffic: over 14 days, 91 articles took 243 landings
 * while 394 lessons took 134, roughly ten times the pull per page. Sending
 * internal links from the big surface to the pages that rank helps those
 * rankings, and a lesson reader gets somewhere concrete to go.
 *
 * HOW IT IS DRAWN: everything else on the lesson sheet is flat, ruled and
 * square. These are the one thing on the page that came from somewhere else, so
 * they are drawn as what they are: torn-out pages taped to the sheet, each at
 * its own angle, none of them straightened. That is the whole reason this block
 * can sit two screens below the continuation card and still be told apart from
 * it at a glance.
 *
 * Server Component rendering from a generated static map: no query, no client
 * JS, present in the HTML for crawlers, which is the point. Lessons with no
 * genuine article match are absent from the map and render nothing rather than
 * pointing somewhere irrelevant.
 */

/** No two clippings on one sheet share an angle, and none of them is straight,
    because the straight object on this page is the continuation card. */
const TILT = ["nb-tilt-1", "nb-tilt-4", "nb-tilt-3"] as const;

/** Where the tape lands on each clipping, so it never reads as a repeat. */
const TAPE = [
  "-top-3 left-5 rotate-[-4deg]",
  "-top-3 right-6 rotate-[3deg]",
  "-top-3 left-1/3 rotate-[-2deg]",
] as const;

export function LessonReadNext({ lessonId }: { lessonId: string }) {
  const articles = getLessonBridge(lessonId);
  if (articles.length === 0) return null;

  return (
    <section
      aria-labelledby="read-next-title"
      className="mt-[clamp(2rem,4vw,3rem)]"
    >
      <p className="nb-slug">clipped to this lesson</p>
      <h2
        id="read-next-title"
        className="mt-1.5 max-w-[22ch] text-[clamp(1.3rem,1.1rem+0.9vw,1.85rem)]"
      >
        Articles that go further on this
      </h2>
      <p className="nb-sub mt-2 text-[0.95rem]">
        The lesson gets you through the topic. These go wider on it, and they
        read in one sitting.
      </p>

      <ul className="mt-[clamp(1.5rem,3vw,2.2rem)] grid gap-[clamp(1.1rem,2.4vw,1.7rem)] sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a, i) => (
          <li key={a.href}>
            <Link
              href={a.href}
              className={`nb-box nb-lift ${TILT[i % TILT.length]} flex h-full flex-col p-[clamp(1rem,2vw,1.35rem)] no-underline`}
            >
              <span
                aria-hidden="true"
                className={`nb-tape absolute h-[21px] w-[74px] ${TAPE[i % TAPE.length]}`}
              />
              <span className="nb-slug">
                {a.readMins ? `${a.readMins} min read` : "article"}
              </span>
              <span className="mt-2 block text-[1.02rem] font-extrabold leading-[1.12] tracking-[-0.02em]">
                {a.title}
              </span>
              {a.description && (
                <span className="mt-2 line-clamp-3 text-[0.9rem] leading-snug text-graphite">
                  {a.description}
                </span>
              )}
              <span className="nb-hair mt-auto flex items-baseline justify-between gap-3 pt-3.5 font-mono text-[0.78rem] leading-none">
                <span className="text-graphite">/blog</span>
                <span className="font-bold text-blue">read it</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
