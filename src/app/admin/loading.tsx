/**
 * /admin is the heaviest render on the site: six aggregate query bundles
 * (`getAdminStats`, `getRetentionStats`, `getFunnelStats`, pending edits,
 * pending submissions, feedback) are awaited in one `Promise.all` before a
 * single byte of the page can be produced. That wait is what this covers.
 *
 * The rule this file follows: draw everything that is KNOWN, and only put a
 * placeholder where a figure goes. The binder's furniture does not depend on
 * the query, so the gutter, the ink rules, the ruled tally page, the blue band
 * and all nine drawer headers are real here, not grey blocks. What pulses is
 * the handful of words and numbers the database has not handed over yet.
 *
 * Geometry is read off src/app/admin/page.tsx rather than eyeballed:
 *  - masthead   `nb-wrap pt-10 lg:pt-16`, then the same two-column grid
 *  - band       `nb-slab mt-14 lg:mt-20`, four stamps at 2 across, 4 at sm
 *  - tally      one `nb-box`, three `nb-panel`s, 4 / 4 / 3 readings
 *  - drawers    every one is CLOSED on first paint (`defaultOpen` is never
 *               passed), so each is a bare header: 2px rule + py-4 + a slug
 *               line + a title line, about 74px. Nine of them: Growth,
 *               Activation funnel, the six in the two-column grid, Feedback.
 *
 * The one deliberate approximation is the coverage note under the band. Its
 * length is data-dependent (the backfill sentence exists only while there are
 * backfilled rows), so it is modelled as a line count that steps down as the
 * column widens rather than pretending one count fits every case.
 *
 * Known and accepted mismatch: a NON-admin gets the locked-drawer card, which
 * this looks nothing like. That branch is free, because `getSession()` returns
 * without a network call when there is no auth cookie, so it renders about as
 * fast as this fallback can be swapped out, while the admin branch is the
 * six-query wait this file exists to cover. Shaping the skeleton around the one
 * visitor who actually waits is the right trade.
 */

/** One pulsing line. `w` is a Tailwind width class, so callers stay declarative. */
function Line({ w, className = "" }: { w: string; className?: string }) {
  return <span className={`nb-skeleton block h-3 ${w} ${className}`} />;
}

/** A closed drawer: the 2px rule and the header block are real, the words are not. */
function DrawerRow() {
  return (
    <div className="nb-rule px-1 py-4">
      <Line w="w-40" />
      <span className="nb-skeleton mt-2.5 block h-5 w-56 max-w-full" />
    </div>
  );
}

/** One ruled reading on the tally page. */
function ReadingRow() {
  return (
    <div className="nb-hair flex items-baseline justify-between gap-3 py-2.5 first:border-t-0 first:pt-0">
      <span className="min-w-0 flex-1">
        <span className="nb-skeleton block h-4 w-40 max-w-full" />
        <Line w="w-28 max-w-full" className="mt-2" />
      </span>
      <span className="nb-skeleton block h-5 w-14 shrink-0" />
    </div>
  );
}

export default function AdminLoading() {
  return (
    <div className="pb-24">
      {/* Masthead: marker, headline, lede, the auto-refresh stamp, and the
          taped card of things that want a person. */}
      <section className="nb-wrap pt-10 lg:pt-16">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)] lg:gap-16">
          <div>
            <Line w="w-32" />
            {/* The h1 is clamp(2.2rem, 3.6rem) at line-height .98, and it wraps
                to two lines at every width the two-column grid produces. */}
            <span className="nb-skeleton mt-5 block h-[clamp(2.2rem,1rem+3.4vw,3.6rem)] w-full" />
            <span className="nb-skeleton mt-2 block h-[clamp(2.2rem,1rem+3.4vw,3.6rem)] w-4/5" />
            <div className="mt-6 flex flex-col gap-2">
              <Line w="w-full max-w-[46ch]" />
              <Line w="w-full max-w-[46ch]" />
              <Line w="w-2/3 max-w-[46ch]" />
            </div>
            <Line w="w-44" className="mt-6" />
          </div>

          <div>
            {/* The card itself is drawn, tape and all. Only its four figures
                are missing, so nothing jumps when they land. */}
            <div className="nb-box nb-tilt-1 p-[clamp(1.15rem,2.4vw,1.65rem)]">
              <span className="nb-tape -top-3 left-[20%] rotate-[-3.4deg]" aria-hidden="true" />
              <span className="nb-tape -bottom-3 right-[14%] rotate-[2.6deg]" aria-hidden="true" />
              <Line w="w-48 max-w-full" className="mb-3" />
              <div className="mt-1 border-t border-dashed border-rule pt-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 border-t border-[rgba(22,24,27,0.13)] py-2.5 first:border-t-0"
                  >
                    <span className="nb-skeleton block h-8 w-12 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="nb-skeleton block h-4 w-full max-w-[14rem]" />
                      <Line w="w-24" className="mt-2" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The blue band is real. Four stamps, each a big figure over a ruled
          caption, so the band never changes height when the numbers arrive. */}
      <section className="nb-slab mt-14 py-[clamp(2.2rem,4.6vw,3.4rem)] lg:mt-20">
        <div className="nb-wrap grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)] lg:items-end lg:gap-16">
          <div>
            <span className="nb-skeleton block h-[clamp(1.6rem,1.1rem+1.9vw,2.5rem)] w-4/5" />
            <div className="mt-5 flex flex-col gap-2">
              <Line w="w-full max-w-[34ch]" />
              <Line w="w-3/4 max-w-[34ch]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-9 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <span className="nb-skeleton block h-[clamp(2.5rem,1.4rem+3.6vw,4.4rem)] w-full" />
                <span className="mt-[0.6rem] block border-t border-[rgba(245,246,242,0.4)] pt-[0.55rem]">
                  <Line w="w-full" />
                  <Line w="w-2/3" className="mt-1.5" />
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coverage note. Three lines wide, five at sm, seven on a phone: the
          same paragraph, wrapped by the column it sits in. */}
      <div className="nb-wrap mt-6">
        <div className="nb-note max-w-[70ch]">
          <Line w="w-52" />
          <div className="mt-3 flex flex-col gap-2">
            <Line w="w-full" />
            <Line w="w-full" />
            <Line w="w-3/4 lg:w-2/5" />
            <Line w="w-full lg:hidden" />
            <Line w="w-2/3 lg:hidden" />
            <Line w="w-full sm:hidden" />
            <Line w="w-1/2 sm:hidden" />
          </div>
        </div>
      </div>

      {/* The tally page: the box and its two ink rules are drawn, the eleven
          readings are not. 4 / 4 / 3, matching the three columns above. */}
      <section className="nb-wrap mt-14 lg:mt-20">
        <div className="mb-7">
          <Line w="w-44" />
          <span className="nb-skeleton mt-4 block h-[clamp(1.6rem,1.1rem+1.9vw,2.5rem)] w-full max-w-[22ch]" />
        </div>
        <div className="nb-box grid grid-cols-1 min-[861px]:grid-cols-3">
          {[4, 4, 3].map((rows, col) => (
            <section key={col} className="nb-panel">
              <Line w="w-36" />
              <div className="mt-3">
                {Array.from({ length: rows }).map((_, i) => (
                  <ReadingRow key={i} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      {/* Nine closed drawers, in the same two full-width, six paired,
          one full-width arrangement the page uses. */}
      <section className="nb-wrap mt-14 lg:mt-20">
        <div className="mb-7">
          <Line w="w-56" />
          <span className="nb-skeleton mt-4 block h-[clamp(1.6rem,1.1rem+1.9vw,2.5rem)] w-full max-w-[16ch]" />
        </div>
        <DrawerRow />
        <DrawerRow />
        <div className="grid items-start lg:grid-cols-2 lg:gap-x-14">
          {Array.from({ length: 6 }).map((_, i) => (
            <DrawerRow key={i} />
          ))}
        </div>
        <DrawerRow />
        <div className="nb-rule" />
      </section>
    </div>
  );
}
