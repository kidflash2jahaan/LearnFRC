import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading UI for /leaderboard.
 *
 * Geometry is copied from page.tsx rather than approximated: the same
 * `nb-wrap` masthead grid with the same clamped padding, the same full-bleed
 * `nb-slab` band, and the same board column. A skeleton that does not line up
 * with the real page is worse than none, because it turns the content swap into
 * a visible jump.
 *
 * DELIBERATELY NOT DRAWN: the referral InviteCard above the board header. It
 * renders only for a signed-in member with a username, and a fallback cannot
 * know who is asking. Drawing it would invent a card for every signed-out
 * visitor; omitting it means a signed-in one sees the board header settle
 * downward. Omission is the smaller error.
 *
 * It also stops after six table rows, where the real board carries up to 47.
 * Content growing in below a skeleton is not a jump.
 */
export default function LeaderboardLoading() {
  return (
    <>
      {/* ===================== MASTHEAD =====================
          `grid-cols-1` below lg is load-bearing here for the same reason it is
          on the page this stands in for: without it the implicit `auto` track
          sizes to the standings card's min-content, pushes past `.nb-wrap` and
          gives the whole document 91px of horizontal scroll at 320px. */}
      <section className="nb-wrap grid grid-cols-1 items-start gap-[clamp(1.8rem,4vw,3.4rem)] pb-[clamp(2rem,4vw,3rem)] pt-[clamp(2.2rem,5vw,3.8rem)] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
        <div>
          {/* nb-marker */}
          <Skeleton className="h-4 w-40" />

          {/* h1, two lines at desktop and three on a phone */}
          <div className="mt-3 flex flex-col gap-2">
            <Skeleton className="h-[2.4rem] w-full sm:h-[3.2rem] lg:h-[4rem]" />
            <Skeleton className="h-[2.4rem] w-4/5 sm:h-[3.2rem] lg:h-[4rem]" />
            <Skeleton className="h-[2.4rem] w-3/5 sm:hidden" />
          </div>

          {/* nb-lede */}
          <div className="mt-[clamp(1rem,2vw,1.5rem)] flex max-w-[46ch] flex-col gap-2.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>

          {/* the button row, at the kit's 44px floor */}
          <div className="mt-[clamp(1.4rem,2.6vw,2rem)] flex flex-wrap gap-3">
            <Skeleton className="h-11 w-44" />
            <Skeleton className="h-11 w-48" />
          </div>
        </div>

        {/* The taped standings slip: three ruled lines, the first one heavier. */}
        <div className="nb-box nb-tilt-2 w-full max-w-[27rem] p-[clamp(1.2rem,2.6vw,1.8rem)] lg:justify-self-end">
          <Skeleton className="h-4 w-44" />
          {[0, 1, 2].map((i) => (
            <div key={i} className={i === 0 ? "mt-4" : "nb-hair mt-3.5 pt-3.5"}>
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-[1.6rem] shrink-0" />
                <Skeleton
                  className={
                    i === 0
                      ? "h-12 w-12 shrink-0 rounded-full"
                      : "h-9 w-9 shrink-0 rounded-full"
                  }
                />
                <div className="min-w-0 flex-1">
                  <Skeleton className={i === 0 ? "h-5 w-36" : "h-4 w-28"} />
                  <Skeleton className="mt-1.5 h-3.5 w-24" />
                </div>
                <Skeleton className={i === 0 ? "h-6 w-24" : "h-5 w-16"} />
              </div>
              <Skeleton className="mt-2 h-[0.45rem] w-full" />
            </div>
          ))}
          <div className="nb-hair mt-4 pt-3.5">
            <Skeleton className="h-3.5 w-52 max-w-full" />
          </div>
        </div>
      </section>

      {/* ===================== THE TOTALS =====================
          A real nb-slab, so the one inverted band on the page is already the
          right colour and the right height before its figures arrive. */}
      <section className="nb-slab py-[clamp(2rem,4.2vw,3.2rem)]">
        <div className="nb-wrap grid items-end gap-[clamp(1.3rem,3vw,2.6rem)] min-[900px]:grid-cols-[1.15fr_repeat(2,minmax(0,0.62fr))]">
          <div>
            <Skeleton className="h-8 w-4/5 opacity-30 sm:h-10" />
            <div className="mt-3 flex max-w-[36ch] flex-col gap-2">
              <Skeleton className="h-3.5 w-full opacity-30" />
              <Skeleton className="h-3.5 w-3/4 opacity-30" />
            </div>
          </div>
          {[0, 1].map((i) => (
            <div key={i}>
              <Skeleton className="h-[3.4rem] w-40 max-w-full opacity-30 sm:h-[4rem]" />
              <Skeleton className="mt-3 h-4 w-28 opacity-30" />
            </div>
          ))}
        </div>
      </section>

      {/* ===================== THE BOARD ===================== */}
      <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)] pt-[clamp(2.4rem,5vw,4rem)]">
        <div className="mb-[clamp(1.4rem,3vw,2.2rem)]">
          <Skeleton className="h-8 w-64 max-w-full sm:h-10" />
          <div className="mt-3 flex max-w-[56ch] flex-col gap-2.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>

        {/* The tab strip: three dashed underlines. */}
        <div className="flex flex-wrap items-end gap-x-[clamp(1.1rem,3vw,2.2rem)] gap-y-1">
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-11 w-20" />
          <Skeleton className="h-11 w-20" />
        </div>

        {/* The selected tab's note. */}
        <div className="mt-[clamp(1.4rem,3vw,2.2rem)] flex max-w-[56ch] flex-col gap-2.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>

        {/* Three plinths, rank one centred and raised at sm, exactly as the
            Podium lays them out. */}
        <div className="mx-auto mt-[clamp(1.6rem,3.4vw,2.6rem)] grid max-w-[54rem] grid-cols-1 items-end gap-[clamp(0.9rem,2vw,1.4rem)] sm:grid-cols-3">
          <Plinth first className="order-first nb-tilt-3 sm:order-2 sm:-mt-7" />
          <Plinth className="order-2 nb-tilt-1 sm:order-1" />
          <Plinth className="order-3 nb-tilt-4" />
        </div>

        {/* Ranks four and down, as the table's own rows. */}
        <div className="mt-[clamp(2rem,4vw,3rem)]">
          <Skeleton className="h-4 w-52" />
          <div className="mt-3 border-t-2 border-ink">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-dashed border-[var(--rule)] py-3"
              >
                <Skeleton className="h-4 w-6 shrink-0" />
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-40 max-w-full" />
                  <Skeleton className="mt-1.5 h-3.5 w-28 max-w-full" />
                </div>
                <Skeleton className="hidden h-4 w-8 shrink-0 sm:block" />
                <Skeleton className="hidden h-4 w-8 shrink-0 md:block" />
                <Skeleton className="h-4 w-16 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * One plinth from the podium. Padding, avatar size and the ruled foot are
 * lifted from the real card so the three land at the same heights they will
 * settle at, and the champion's extra scale is kept.
 */
function Plinth({
  first = false,
  className = "",
}: {
  first?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`nb-box flex flex-col items-center px-[clamp(0.9rem,2vw,1.4rem)] pb-[clamp(1rem,2vw,1.4rem)] pt-[clamp(1.4rem,2.6vw,2rem)] ${className}`}
    >
      <Skeleton className="h-4 w-24" />
      <Skeleton
        className={`mt-3 rounded-full ${first ? "h-[4.5rem] w-[4.5rem]" : "h-16 w-16"}`}
      />
      <Skeleton className={`mt-3 ${first ? "h-6 w-32" : "h-5 w-28"}`} />
      <Skeleton className="mt-1.5 h-3.5 w-24" />
      <Skeleton className={`mt-4 ${first ? "h-9 w-28" : "h-7 w-24"}`} />
      <div className="nb-hair mt-4 w-full pt-3">
        <Skeleton className="mx-auto h-3.5 w-32 max-w-full" />
      </div>
    </div>
  );
}
