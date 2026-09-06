import Link from "next/link";

export type Clause = { id: string; title: string };

/**
 * The clause index, taped to the top of the page.
 *
 * What used to be here was a sticky sidebar carrying a scroll-spy progress
 * ring, a live pulsing dot and two count-up numbers, for a document that is ten
 * short clauses and about four minutes long. A rail that tells you how far
 * through four minutes you are is instrumentation for its own sake, and it cost
 * a client bundle plus a motion library to say it.
 *
 * A contract prints its contents on the first page. So does this: every clause
 * at once, numbered, reachable in one click, at every width. No state, so no
 * `"use client"`, so no JavaScript ships for it at all.
 */
export function ClauseIndex({
  clauses,
  contactHref,
}: {
  clauses: Clause[];
  /** Route to the contact form. Was a `mailto:` on a domain with no MX record. */
  contactHref: string;
}) {
  return (
    <nav
      aria-label="Contents"
      className="nb-box p-[clamp(0.9rem,2vw,1.4rem)]"
    >
      <span className="nb-tape -top-3 left-[7%] rotate-[-3.1deg]" aria-hidden="true" />
      <p className="nb-slug px-2">contents / {clauses.length} clauses</p>
      <ol className="nb-hair mt-3 grid list-none pt-3 sm:grid-cols-2 sm:gap-x-[clamp(0.5rem,2vw,1.6rem)]">
        {clauses.map((c, i) => (
          <li key={c.id}>
            <a href={`#${c.id}`} className="nb-menu-item items-baseline gap-2.5 text-[0.92rem]">
              <span className="nb-slug shrink-0 font-bold tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="leading-snug">{c.title}</span>
            </a>
          </li>
        ))}
      </ol>
      <p className="nb-hair nb-hint mt-3 pt-3">
        Something here unclear?{" "}
        <Link href={contactHref} className="nb-link">
          Ask about it
        </Link>
        , no account needed.
      </p>
    </nav>
  );
}
