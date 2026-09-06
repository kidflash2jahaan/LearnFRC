import type { CSSProperties } from "react";

export type ShelfLink = { title: string; url: string };

/** Strip protocol and www so the host reads as a label, not a URL.
    Exported because the citations table on the page prints the same label, and
    two copies of this would drift the moment one of them learned about a
    subdomain the other did not. */
export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * One shelf of the toolbox, drawn as a labelled parts bin.
 *
 * The old file was a floating glass "shelf manifest" in the hero, with spring
 * meters sized to link counts. A meter comparing "three official links" against
 * "five programming links" measures nothing anyone came here to know. What a
 * reference page owes its reader is the link, the host it goes to, and which
 * bin it lives in, so that is all this draws: a mono part number across the
 * top, the count, and then the links themselves on ruled lines.
 *
 * Every link leaves the site, so every one says so to a screen reader and every
 * one prints its host, because the domain is how people recognise a doc they
 * already trust.
 *
 * Server Component. The section id is the jump target the rail links to.
 */
export function ShelfBin({
  id,
  index,
  slug,
  category,
  blurb,
  links,
  tilt,
}: {
  id: string;
  /** Zero-based position in the toolbox. Printed one-based and zero-padded. */
  index: number;
  /** Mono identifier for the bin, e.g. `software-programming`. */
  slug: string;
  category: string;
  blurb: string;
  links: ShelfLink[];
  /** Hand angle. Small: these are full-width across the content column. */
  tilt: string;
}) {
  return (
    <section
      id={id}
      className="nb-box nb-tilt p-[clamp(1.1rem,2.4vw,1.7rem)]"
      style={{ "--tilt": tilt } as CSSProperties}
      aria-labelledby={`${id}-heading`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
        <p className="nb-slug">
          shelf {String(index + 1).padStart(2, "0")} / {slug}
        </p>
        <p className="nb-count">
          {links.length}
          <small>links</small>
        </p>
      </div>

      <h3
        id={`${id}-heading`}
        className="mt-2 text-[clamp(1.2rem,1rem+0.7vw,1.55rem)]"
      >
        {category}
      </h3>
      {blurb && (
        <p className="mt-2 max-w-[54ch] text-[0.95rem] leading-[1.5] text-graphite">
          {blurb}
        </p>
      )}

      <ul className="mt-[clamp(0.9rem,2vw,1.3rem)]">
        {links.map((link, i) => (
          <li
            key={link.url}
            className={
              i === 0
                ? "border-t-2 border-ink"
                : "border-t border-dashed border-rule"
            }
          >
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex min-h-11 flex-wrap items-baseline justify-between gap-x-5 gap-y-0.5 py-2.5"
            >
              <span className="font-semibold decoration-blue decoration-2 underline-offset-4 group-hover:text-blue group-hover:underline">
                {link.title}
                <span className="sr-only"> (opens in a new tab)</span>
              </span>
              <span className="nb-slug">{hostLabel(link.url)}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
