/**
 * What /admin/team waits on: three query bundles in one `Promise.all`. Most
 * are ordinary table reads, but `getAdminTeam()` calls `auth.admin.getUserById`
 * once per member to work out who is an owner, and those are network round
 * trips that do not batch. On a team of six that is the whole wait.
 *
 * Same rule as src/app/admin/loading.tsx: draw everything that is KNOWN and
 * put a placeholder only where data goes. The gutter, the ink rules and the
 * drawer headers are real here, not grey blocks. What pulses is the handful of
 * words the database has not handed over yet.
 *
 * Geometry is read off src/app/admin/team/page.tsx rather than eyeballed:
 *  - masthead  `nb-wrap pt-10 lg:pt-16`, one column: marker, h1, lede
 *  - drawers   two (the admin team, decided), CLOSED here, so each is a bare
 *              header: 2px rule + py-4 + a slug line + a title line, about 74px.
 *
 * The "Old applications" drawer only exists while an application from before
 * /apply closed is waiting, which should be never after the first visit, so
 * it isn't drawn: guessing there's one and then taking it away is a worse
 * flicker than one drawer appearing a beat later.
 *
 * One deliberate mismatch, the same one /admin's fallback accepts: a signed-in
 * admin who is not a super admin gets the locked-drawer card, which looks
 * nothing like this. That branch returns before any query runs, so it renders
 * about as fast as this can be swapped out.
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
        <Line w="w-28" />
        {/* The h1 is clamp(2.2rem, 3.6rem) at line-height .98. */}
        <span className="nb-skeleton mt-5 block h-[clamp(2.2rem,1rem+3.4vw,3.6rem)] w-full max-w-[36rem]" />
        <div className="mt-6 flex max-w-[60ch] flex-col gap-2">
          <Line w="w-full" />
          <Line w="w-2/3" />
        </div>
      </section>

      <section className="nb-wrap mt-12 lg:mt-16">
        <Line w="w-48" className="mb-3.5" />
        <DrawerRow />
        <DrawerRow />
        <div className="nb-rule" />
      </section>
    </div>
  );
}
