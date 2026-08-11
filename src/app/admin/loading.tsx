import { Skeleton } from "@/components/ui/skeleton";

/**
 * /admin is the heaviest render on the site: six aggregate query bundles
 * (`getAdminStats`, `getRetentionStats`, `getFunnelStats`, pending edits,
 * pending submissions, feedback) are awaited in one `Promise.all` before a
 * single byte of the page can be produced. That wait is what this covers.
 *
 * Geometry is read off src/app/admin/page.tsx rather than eyeballed. The
 * container and grid tracks are copied exactly; every block height below is
 * added up from the compiled type scale:
 *  - container  `mx-auto max-w-6xl px-4 pt-20 pb-20 sm:px-6 lg:px-8 lg:pt-24`
 *  - header row 44px — the h1 is 32px but the AutoRefresh chip is `min-h-11`
 *  - stat grid  `grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6`,
 *    17 tiles, `mt-5`. Tile height is NOT constant across breakpoints and the
 *    skeleton must not pretend it is. Added up from the type scale rather
 *    than eyeballed — every tile is
 *      padding (p-3=24 / sm:p-3.5=28) + 2px `.ac-tile` border
 *      + label row 16.5   (text-[11px] sets font-size only, so it inherits
 *                          preflight's html line-height:1.5 → 11 × 1.5)
 *      + mt-1.5 6 + the number's line-height
 *      + mt-0.5 2 + hint lines × 15.125  (leading-snug 1.375 × 11)
 *    The number is `text-xl sm:text-2xl lg:text-xl` — 28 / 32 / 28px — and
 *    `hero` bumps it one step to 32 / 36 / 32: StatTile sizes it by TILE
 *    width, so it steps up at sm and is given back at lg. Every hint is
 *    `line-clamp-2`, and grid items stretch, so a ROW is as tall as its
 *    tallest tile — one 2-line hint sets the row.
 *
 *    Worked through row by row (2 / 3 / 6 across) that lands at
 *    ≈101 / 111 / 114px, i.e. `h-[100px] sm:h-[112px]`. Two values, not
 *    three: the sm and lg rows differ by ~3px because lg gives the number
 *    size back at the same moment its 6-across tile (~120px of text at the
 *    1024px breakpoint) starts wrapping more hints to the second line.
 *    Radius is `.ac-tile`'s 20px (rounded-2xl would be 16px).
 *  - panels     every CollapsiblePanel is CLOSED on first paint
 *    (`defaultOpen` is never passed), so each one is a bare header row:
 *    32px icon + py-3/sm:py-3.5 + the 1px `.ac-card` border = 58/62px.
 *    Nine of them: Growth, Activation funnel, the six in the two-column
 *    grid, and Feedback.
 *
 * The one deliberate approximation is the coverage footnote under the grid —
 * its length is data-dependent (the backfill sentence exists only while
 * there are backfilled rows), so it is modelled as a line count that steps
 * down as the column widens rather than pretending one count fits.
 *
 * Not mirrored: the `<Glow>` blobs. They are `pointer-events-none` and
 * absolutely positioned, contribute no layout, and re-mounting them here
 * would only restart their drift when the real page swaps in — the same
 * call src/app/dashboard/loading.tsx makes.
 *
 * Known and accepted mismatch: a NON-admin gets the "Access denied" card
 * (`mx-auto flex max-w-md flex-col items-center px-4 pt-40 pb-20`), which
 * this looks nothing like. That branch is free — `getSession()` returns
 * without a network call when there is no auth cookie, so it renders about
 * as fast as the fallback can be swapped out — while the admin branch is
 * the six-query wait this file exists to cover. /admin is unlinked except
 * in the navbar for admins, so shaping the skeleton around the one visitor
 * who actually waits is the right trade.
 */
export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-20 pb-20 sm:px-6 lg:px-8 lg:pt-24">
      {/* Header: "Dashboard" h1 + the live auto-refresh chip. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Skeleton className="h-8 w-40 rounded-xl" />
        <Skeleton className="h-11 w-48 rounded-full" />
      </div>

      {/* Every number, one grid — 17 tiles. */}
      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
        {Array.from({ length: 17 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-[100px] rounded-[20px] sm:h-[112px]"
          />
        ))}
      </div>

      {/* Coverage footnote: 11px / leading-relaxed, so h-3 + space-y-1.5 is
          exactly one 18px line. Three lines wide, six at sm, eight on a
          phone — the same paragraph, wrapped by the column it sits in. */}
      <div className="mt-2 space-y-1.5">
        <Skeleton className="h-3 w-full rounded-md" />
        <Skeleton className="h-3 w-full rounded-md" />
        <Skeleton className="h-3 w-3/4 rounded-md lg:w-2/5" />
        <Skeleton className="h-3 w-full rounded-md lg:hidden" />
        <Skeleton className="h-3 w-full rounded-md lg:hidden" />
        <Skeleton className="h-3 w-2/3 rounded-md lg:hidden" />
        <Skeleton className="h-3 w-full rounded-md sm:hidden" />
        <Skeleton className="h-3 w-1/2 rounded-md sm:hidden" />
      </div>

      {/* Growth. */}
      <Skeleton className="mt-6 h-[58px] rounded-[20px] sm:h-[62px]" />

      {/* Activation funnel. */}
      <Skeleton className="mt-3 h-[58px] rounded-[20px] sm:h-[62px]" />

      {/* Where they come from · Engagement · Teams & referrals ·
          Top articles · Achievements · Recent activity. */}
      <div className="mt-3 grid items-start gap-3 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[58px] rounded-[20px] sm:h-[62px]" />
        ))}
      </div>

      {/* Feedback. */}
      <Skeleton className="mt-3 h-[58px] rounded-[20px] sm:h-[62px]" />
    </div>
  );
}
