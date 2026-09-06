import Link from "next/link";

export type DeskCount = {
  /** What the desk is called, e.g. "In the Pit". */
  label: string;
  /** Anchor id of that desk's group in the log further down the page. */
  slug: string;
  /** How many articles are filed on it. */
  count: number;
};

/**
 * The divider tabs.
 *
 * A binder's front matter is a card of dividers, and that is the only thing
 * this is: one line per desk, in filing order, each line jumping to that
 * desk's group in the log below. The ordinal on the left is the filing order,
 * which is also the reading order; the count on the right is mono so the
 * column of figures lines up down the card.
 *
 * Deliberately not a chart, a meter or a set of tiles. On an index page the
 * reader wants to reach a shelf, not to compare shelf sizes.
 *
 * Server Component. Nothing here holds state and nothing animates except the
 * one hover the system owns.
 */
export function DeskIndex({ desks }: { desks: DeskCount[] }) {
  if (desks.length === 0) return null;

  return (
    // "Desk dividers", not "Jump to a desk": the index page carries a second
    // jump nav as a chip row above the log, and two landmarks sharing one name
    // are indistinguishable in a screen reader's landmark list. This one is
    // named after what it visibly is, the dividers card.
    <nav aria-label="Desk dividers" className="w-full max-w-md lg:justify-self-end">
      <div className="nb-box nb-tilt-2 p-[clamp(1.1rem,2.2vw,1.6rem)]">
        <span className="nb-tape -top-3 left-[18%] rotate-[-4.2deg]" aria-hidden="true" />

        <p className="nb-slug border-b border-dashed border-rule pb-3">
          dividers / {desks.length} desks
        </p>

        <ul className="mt-1">
          {desks.map((d, i) => (
            <li key={d.slug} className="border-b border-dashed border-rule last:border-b-0">
              {/* The whole line is the target, and it slides right under the
                  cursor the same way a row in the log does, so reaching a desk
                  from here and reaching one from the log read as one gesture. */}
              <Link
                href={`#${d.slug}`}
                className="group flex items-baseline gap-3 py-2.5 transition-transform duration-[var(--nb-t-hover)] ease-[var(--nb-ease-out)] motion-safe:hover:translate-x-1.5 motion-safe:focus-visible:translate-x-1.5"
              >
                <span className="nb-slug w-[2.2ch] shrink-0 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 text-[0.97rem] font-semibold leading-tight group-hover:underline group-hover:decoration-blue group-hover:decoration-2 group-hover:underline-offset-4">
                  {d.label}
                </span>
                <span className="nb-slug shrink-0 font-bold tabular-nums text-ink">
                  {d.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
