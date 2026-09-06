import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading UI for /u/[username].
 *
 * This is the slowest page on the site and the one where a fallback matters
 * most: it is `force-dynamic` and runs three sequential admin queries (profile,
 * lesson count, achievements) before anything can render, and a stranger
 * arriving from a shared link has no prior page to look at.
 *
 * It mirrors page.tsx section for section, on the same numbers:
 *   record sheet  nb-box nb-tilt-3, max-w-[58rem], split at 760px
 *   the figures   nb-slab band, four stamps, 1 / 2 / 4 columns
 *   the roster    ruled lines under a heading
 *
 * THE FRAMES ARE REAL, ONLY THE WRITING IS A PLACEHOLDER. The card, its tilt,
 * its tape and the blue band are drawn exactly as the page draws them, because
 * their edges are the part of the layout that has to be in the right place when
 * the data lands. A grey rectangle standing in for the whole card would move
 * every edge on the page at swap time.
 *
 * TWO JUDGEMENT CALLS, both settled against the live data rather than guessed:
 *  - No bio block. `bio` is optional and only 6 of 338 profiles have one, so
 *    drawing it would invent a paragraph for 98% of visits.
 *  - Two roster lines. Badges average 1.5 per profile and 44% of profiles have
 *    none, so two lines is the closest single shape to both, and it sits at or
 *    below the fold either way.
 */
export default function PublicProfileLoading() {
  return (
    <>
      {/* ===================== THE RECORD SHEET ===================== */}
      <section className="nb-wrap pb-[clamp(2rem,4vw,3rem)] pt-[clamp(2.2rem,5vw,4rem)]">
        <div className="nb-box nb-tilt-3 mx-auto max-w-[58rem] p-[clamp(1.3rem,3vw,2.4rem)]">
          <span className="nb-tape -top-3 left-[18%] rotate-[-3.4deg]" aria-hidden="true" />
          <span className="nb-tape -bottom-3 right-[14%] rotate-[2.2deg]" aria-hidden="true" />

          {/* the "learnfrc / record of work" rule */}
          <div className="border-b border-dashed border-rule pb-2.5">
            <Skeleton className="h-4 w-52" />
          </div>

          <div className="mt-[clamp(1.2rem,2.6vw,1.8rem)] grid items-start gap-[clamp(1.4rem,3.4vw,2.6rem)] min-[760px]:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              {/* @username, always one line */}
              <Skeleton className="h-[clamp(2rem,1.3rem+2.4vw,3.4rem)] w-72 max-w-full" />

              {/* role / team / joined chips */}
              <div className="mt-[clamp(1rem,2.2vw,1.4rem)] flex flex-wrap gap-2">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-7 w-32" />
              </div>
            </div>

            {/* the rank stamp, drawn as the real small card */}
            <div className="nb-box-sm nb-tilt-4 w-full max-w-[19rem] p-[clamp(1rem,2.2vw,1.4rem)] min-[760px]:justify-self-end">
              <div className="flex items-center gap-3.5">
                <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-12" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>

              <div className="nb-hair mt-4 flex items-end gap-3 pt-4">
                <Skeleton className="h-[clamp(2.6rem,2rem+2vw,3.4rem)] w-14" />
                <Skeleton className="mb-1 h-3.5 w-10" />
              </div>

              <Skeleton className="mt-3 h-[0.8rem] w-full" />
              <Skeleton className="mt-2 h-3.5 w-40 max-w-full" />
            </div>
          </div>

          <div className="nb-hair mt-[clamp(1.4rem,3vw,2.2rem)] flex flex-wrap items-center gap-x-4 gap-y-3 pt-[clamp(1rem,2.2vw,1.4rem)]">
            <Skeleton className="h-11 w-44" />
            <Skeleton className="h-4 w-48 max-w-full" />
          </div>
        </div>
      </section>

      {/* ===================== THE FIGURES =====================
          The band is painted for real. It is the strongest edge on the page,
          and holding it still is most of what keeps the swap from jumping. */}
      <section className="nb-slab py-[clamp(2rem,4.5vw,3.4rem)]">
        <div className="nb-wrap grid gap-[clamp(1.2rem,3vw,2.4rem)] min-[520px]:grid-cols-2 min-[860px]:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-[clamp(2.5rem,1.4rem+3.6vw,4.4rem)] w-28 max-w-full" />
              <div className="mt-[0.6rem] border-t border-[rgba(245,246,242,0.4)] pt-[0.55rem]">
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== THE ROSTER ===================== */}
      <section className="nb-wrap py-[clamp(2.2rem,4.5vw,3.6rem)]">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <Skeleton className="h-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)] w-52" />
            <Skeleton className="mt-3 h-5 w-full max-w-[52ch]" />
          </div>
          <Skeleton className="h-6 w-24 shrink-0" />
        </div>

        <div className="nb-list mt-[clamp(1.2rem,2.6vw,1.8rem)]">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="grid items-baseline gap-x-[clamp(1rem,3vw,2.2rem)] gap-y-1.5 border-b border-dashed border-rule py-[clamp(0.9rem,2vw,1.3rem)] min-[720px]:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]"
            >
              <Skeleton className="h-5 w-44 max-w-full" />
              <Skeleton className="h-4 w-full max-w-[54ch]" />
            </div>
          ))}
        </div>

        <Skeleton className="mt-[clamp(1.4rem,3vw,2.2rem)] h-5 w-full max-w-[46ch]" />
      </section>
    </>
  );
}
