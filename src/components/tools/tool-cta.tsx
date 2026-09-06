import Link from "next/link";

export type RelatedLink = { href: string; label: string };

/**
 * The foot of every /tools page.
 *
 * This is the last thing on a worksheet, so it is drawn as the bottom of the
 * sheet rather than as another card: one 2px ink rule, then two columns of
 * plain type. The old version was a centred glass panel with a glow behind it,
 * which competed with the calculator directly above it for attention; a tool
 * page should end quietly and point somewhere useful.
 *
 * Two jobs, kept apart on purpose: the account pitch on the left (the tools are
 * the top of the funnel for search traffic), and the keyword-bearing internal
 * links on the right, which is what actually feeds link equity to the lessons.
 */
export function ToolCTA({ related }: { related: RelatedLink[] }) {
  return (
    <section className="nb-rule mt-[clamp(2.5rem,6vw,4rem)] pt-[clamp(1.8rem,4vw,2.8rem)] pb-[clamp(2rem,5vw,3.4rem)]">
      <div className="nb-wrap grid gap-[clamp(1.6rem,4vw,3rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.72fr)]">
        <div>
          <p className="nb-marker">free / no account needed to use</p>
          <h2 className="max-w-[18ch] text-[clamp(1.5rem,1.1rem+1.5vw,2.2rem)]">
            Every tool here is free, and so is the rest of the binder.
          </h2>
          <p className="nb-sub mt-4">
            394 lessons across all 11 departments, plus every calculator on this
            site. An account is only for saving your work and tracking what
            you have finished.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/signup" className="nb-btn">
              Create a free account
            </Link>
            <Link href="/guides" className="nb-btn-ghost">
              Browse the guides
            </Link>
          </div>
        </div>

        {related.length > 0 && (
          <div className="lg:pl-[clamp(1rem,2vw,2rem)]">
            <p className="nb-slug border-b-2 border-ink pb-2">keep reading</p>
            <ul className="m-0 list-none p-0">
              {related.map((r) => (
                <li key={r.href} className="nb-hair first:border-t-0">
                  <Link
                    href={r.href}
                    className="group flex min-h-[2.75rem] items-center gap-3 py-3 text-[0.98rem] font-medium leading-snug no-underline"
                  >
                    <span className="border-b-2 border-b-transparent group-hover:border-b-blue group-hover:text-blue">
                      {r.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
