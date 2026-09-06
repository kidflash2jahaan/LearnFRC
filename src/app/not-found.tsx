import Link from "next/link";
import { MissingSheet } from "./_not-found/field-radar";
import { RouteRecovery } from "./_not-found/route-recovery";

/**
 * The page that is not in the binder.
 *
 * It was four identical gradient tiles under a 404 in brand-gradient text, with
 * drifting light behind it. A 404 has exactly one job: get the reader to the
 * page they meant. So the ways out are a carbon-copy log, the same row list the
 * site uses for lessons and articles, because a log is scannable in one pass
 * and four equal cards are not.
 *
 * Server Component. The only client code on the page is the recovery list,
 * which has to read the URL that was actually requested.
 */
const ROUTES = [
  {
    href: "/",
    slug: "index / home",
    title: "Start at the front of the binder",
    body: "Everything the site has, in one page.",
  },
  {
    href: "/guides",
    slug: "guides / all departments",
    title: "Browse the departments",
    body: "Every job on a team, start to finish.",
  },
  {
    href: "/blog",
    slug: "articles / troubleshooting",
    title: "Read the articles",
    body: "The failures that end a competition day.",
  },
  {
    href: "/glossary",
    slug: "glossary / a to z",
    title: "Look up an acronym",
    body: "Every term in FRC, decoded once.",
  },
];

export default function NotFound() {
  return (
    <div className="nb-wrap py-[clamp(2.5rem,6vw,4.5rem)]">
      <div className="grid gap-[clamp(1.6rem,4vw,3.4rem)] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)] lg:items-start">
        <div>
          <p className="nb-marker">404 / sheet not in the binder</p>
          <h1>
            That page isn&rsquo;t <span className="nb-mark">filed here</span>.
          </h1>
          <p className="nb-lede mt-5">
            The link you followed points at something this site has never had, or
            at something that moved. Nothing is broken and nothing is gone.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/" className="nb-btn">
              Back to the front page
            </Link>
            <Link href="/guides" className="nb-btn-ghost">
              Open the guides
            </Link>
          </div>

          <RouteRecovery />
        </div>

        <div className="lg:justify-self-end lg:pt-2">
          <MissingSheet />
        </div>
      </div>

      <section className="mt-[clamp(2.6rem,5vw,4rem)]">
        {/* An h2, because the four rows below are h3s and the only heading
            above them was the page h1: as a <p> this label left the whole list
            hanging a level below nothing. `font-normal` and the explicit
            leading hold the marker's own weight and line box, so it draws
            exactly as it did. */}
        <h2 className="nb-marker font-normal leading-[1.55]">
          where to go instead
        </h2>
        <div className="nb-list">
          {ROUTES.map((r) => (
            /* The third column of an nb-row is `auto`, so it hugs the right
               edge. That is for a short label, not a sentence: the description
               goes under the title in the flexible column instead. */
            <Link key={r.href} href={r.href} className="nb-row">
              <span className="nb-slug">{r.slug}</span>
              <span>
                <h3>{r.title}</h3>
                <span className="mt-1 block text-[0.95rem] text-graphite">
                  {r.body}
                </span>
              </span>
              <span className="nb-slug">open</span>
            </Link>
          ))}
        </div>
        <p className="nb-pen mt-6 rotate-[-0.8deg]">
          if a link on another site sent you here, tell me and I&rsquo;ll fix it
        </p>
      </section>
    </div>
  );
}
