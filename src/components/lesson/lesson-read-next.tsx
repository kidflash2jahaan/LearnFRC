import Link from "next/link";
import { ArrowRight, Newspaper, Clock } from "lucide-react";
import { getLessonBridge } from "@/lib/lesson-bridge";

/**
 * Articles worth reading after this lesson.
 *
 * Before this, 0 of 394 lesson pages linked to a single article, in either
 * direction. That was backwards twice over. Lessons are the site's largest
 * surface (507 of the 691 URLs in the sitemap) and articles are the pages that
 * actually pull search traffic: over 14 days, 91 articles took 243 landings
 * while 394 lessons took 134, roughly ten times the pull per page. Sending
 * internal links from the big surface to the pages that rank helps those
 * rankings, and a lesson reader gets somewhere concrete to go.
 *
 * The articles are the practical, in-the-pit companion to a lesson's theory, so
 * this is a genuine next step rather than filler.
 *
 * Server component rendering from a generated static map: no query, no client
 * JS, present in the HTML for crawlers, which is the whole point. Lessons with
 * no genuine article match are absent from the map and render nothing.
 */
export function LessonReadNext({ lessonId }: { lessonId: string }) {
  const articles = getLessonBridge(lessonId);
  if (articles.length === 0) return null;

  return (
    <section aria-labelledby="read-next-title" className="mt-10">
      <p className="ac-eyebrow flex items-center gap-1.5">
        <Newspaper aria-hidden className="h-3.5 w-3.5" /> Read next
      </p>
      <h2
        id="read-next-title"
        className="mt-1.5 font-display text-xl font-bold tracking-tight text-foreground"
      >
        Articles on this, for competition day
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-foreground/65">
        The lesson covers how it works. These cover what to do when it breaks.
      </p>

      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {articles.map((a) => (
          <li key={a.href}>
            <Link
              href={a.href}
              className="ac-card group flex h-full flex-col gap-2 rounded-2xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {a.readMins ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Clock aria-hidden className="h-3 w-3" /> {a.readMins} min read
                </span>
              ) : null}
              <h3 className="font-display text-[15px] font-semibold leading-snug tracking-tight transition-colors group-hover:text-primary">
                {a.title}
              </h3>
              {a.description ? (
                <p className="line-clamp-3 text-sm leading-relaxed text-foreground/65">
                  {a.description}
                </p>
              ) : null}
              <span className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-medium text-primary">
                Read
                <ArrowRight
                  aria-hidden
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
