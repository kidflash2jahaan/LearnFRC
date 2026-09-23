/**
 * What /admin/team waits on: three query bundles in one `Promise.all`. Two are
 * ordinary table reads, but `getAdminTeam()` calls `auth.admin.getUserById`
 * once per member to work out who is an owner, and those are network round
 * trips that do not batch. On a team of six that is the whole wait.
 *
 * Same rule as src/app/admin/loading.tsx: draw everything that is KNOWN and
 * put a placeholder only where data goes. The gutter, the ink rules, the taped
 * card and all three drawer headers are real here, not grey blocks. What
 * pulses is the handful of words the database has not handed over yet.
 *
 * Geometry is read off src/app/admin/team/page.tsx rather than eyeballed:
 *  - masthead  `nb-wrap pt-10 lg:pt-16`, then the same two-column grid
 *  - card      `nb-box nb-tilt-1`, four ruled grant rows, then the note
 *  - drawers   three, all CLOSED here, so each is a bare header: 2px rule +
 *              py-4 + a slug line + a title line, about 74px.
 *
 * One deliberate mismatch, the same one /admin's fallback accepts: a signed-in
 * admin who is not a super admin gets the locked-drawer card, which looks
 * nothing like this. That branch returns before any query runs, so it renders
 * about as fast as this can be swapped out. Shaping the skeleton around the one
 * visitor who actually waits is the right trade.
 *
 * The Applications drawer opens itself on the real page when something is
 * waiting. It is drawn closed here on purpose: guessing that there is work in
 * the queue, then collapsing it when there isn't, is a worse flicker than one
 * drawer opening a beat later.
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
      <span className="nb-skeleton mt-2.5 block h-5 w-48 max-w-full" />
    </div>
  );
}

export default function AdminTeamLoading() {
  return (
    <div className="pb-24">
      <section className="nb-wrap pt-10 lg:pt-16">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)] lg:gap-16">
          <div>
            <Line w="w-28" />
            {/* The h1 is clamp(2.2rem, 3.6rem) at line-height .98 and wraps to
                two lines at every width this two-column grid produces. */}
            <span className="nb-skeleton mt-5 block h-[clamp(2.2rem,1rem+3.4vw,3.6rem)] w-full" />
            <span className="nb-skeleton mt-2 block h-[clamp(2.2rem,1rem+3.4vw,3.6rem)] w-3/5" />
            <div className="mt-6 flex flex-col gap-2">
              <Line w="w-full max-w-[46ch]" />
              <Line w="w-full max-w-[46ch]" />
              <Line w="w-2/3 max-w-[46ch]" />
            </div>
          </div>

          <div>
            {/* The card is drawn, tape and all. Only its words are missing, so
                nothing jumps when they land. */}
            <div className="nb-box nb-tilt-1 p-[clamp(1.15rem,2.4vw,1.65rem)]">
              <span className="nb-tape -top-3 left-[20%] rotate-[-3.4deg]" aria-hidden="true" />
              <span className="nb-tape -bottom-3 right-[14%] rotate-[2.6deg]" aria-hidden="true" />
              <Line w="w-44 max-w-full" className="mb-3" />
              <div className="mt-1 border-t border-dashed border-rule pt-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="border-t border-[rgba(22,24,27,0.13)] py-2.5 first:border-t-0"
                  >
                    <span className="nb-skeleton block h-4 w-full max-w-[11rem]" />
                    <Line w="w-full max-w-[15rem]" className="mt-2" />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-2 border-t border-dashed border-rule pt-3">
                <Line w="w-full" />
                <Line w="w-full" />
                <Line w="w-3/4" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="nb-wrap mt-12 lg:mt-16">
        <Line w="w-48" className="mb-3.5" />
        <DrawerRow />
        <DrawerRow />
        <DrawerRow />
        <div className="nb-rule" />
      </section>
    </div>
  );
}
