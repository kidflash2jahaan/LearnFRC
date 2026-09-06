import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback for /tools/frc-current-budget.
 *
 * The page awaits getSession() (cookies plus a Supabase round-trip), so it is
 * never prerendered and navigation blocks until that resolves.
 *
 * The shape below is the real page's bands in order, so nothing jumps when the
 * calculator arrives: question with the scenario shelf, ink verdict band, the
 * pack tag, the load list of mechanism cards, then the per-motor check.
 * Rendered as a <div> because the root layout already owns the <main>
 * landmark, and a second one would break the skip link.
 */
export default function CurrentBudgetCalculatorLoading() {
  return (
    <div>
      {/* 1 · the question, then the scenario shelf */}
      <div className="nb-wrap py-[clamp(2.2rem,5vw,3.6rem)]">
        <Skeleton className="h-4 w-52" />
        <Skeleton className="mt-4 h-[clamp(2.2rem,1.6rem+2.4vw,3.4rem)] w-full max-w-[24ch]" />
        <Skeleton className="mt-2 h-[clamp(2.2rem,1.6rem+2.4vw,3.4rem)] w-2/5" />
        <div className="mt-5 max-w-[46ch]">
          <Skeleton className="h-4" />
          <Skeleton className="mt-2 h-4" />
          <Skeleton className="mt-2 h-4 w-3/5" />
        </div>

        <div className="nb-hair mt-[clamp(1.6rem,3.4vw,2.4rem)] pt-[clamp(1.1rem,2.2vw,1.5rem)]">
          <Skeleton className="h-3.5 w-40" />
          <div className="mt-3 flex flex-wrap gap-3">
            <Skeleton className="h-[2.75rem] w-40" />
            <Skeleton className="h-[2.75rem] w-56" />
          </div>
        </div>
      </div>

      {/* 2 · the ink verdict band, a real band even while empty so the page
             does not grow a blue stripe on arrival */}
      <section className="nb-slab py-[clamp(2rem,4.4vw,3.2rem)]">
        <div className="nb-wrap grid items-end gap-[clamp(1.3rem,3vw,2.6rem)] lg:grid-cols-[minmax(0,1.05fr)_repeat(3,minmax(0,0.72fr))]">
          <div>
            <Skeleton className="h-4 w-52" />
            <Skeleton className="mt-3 h-8 w-full max-w-[16ch]" />
            <Skeleton className="mt-2 h-8 w-3/5" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-[clamp(2.5rem,1.4rem+3.6vw,4.4rem)] w-4/5" />
              <Skeleton className="mt-3 h-4 w-full" />
            </div>
          ))}
        </div>
      </section>

      {/* 3 · the pack tag: four fields, then the derived lines in the footer */}
      <section className="py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="mt-4 h-9 w-full max-w-[21ch]" />

          <div className="nb-box nb-tilt-3 mt-[clamp(1.4rem,3vw,2.2rem)] p-[clamp(1.2rem,2.6vw,2rem)]">
            <div className="grid gap-[clamp(1rem,2.2vw,1.5rem)] sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="mt-2 h-[2.75rem]" />
                  <Skeleton className="mt-2 h-3 w-4/5" />
                </div>
              ))}
            </div>
            <div className="nb-hair mt-[clamp(1.2rem,2.6vw,1.8rem)] grid gap-1.5 pt-[clamp(1.1rem,2.2vw,1.5rem)]">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-3.5" />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4 · the load list: three mechanism cards carrying 4, 1 and 2 motors */}
      <section className="nb-rule py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <div className="grid gap-x-[clamp(1.5rem,4vw,3rem)] gap-y-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <Skeleton className="h-4 w-52" />
              <Skeleton className="mt-4 h-9 w-full max-w-[22ch]" />
              <div className="mt-4 max-w-[56ch]">
                <Skeleton className="h-4" />
                <Skeleton className="mt-2 h-4 w-4/5" />
              </div>
            </div>
            <Skeleton className="h-[2.75rem] w-44 lg:mb-1" />
          </div>

          <div className="mt-[clamp(1.4rem,3vw,2.2rem)] grid gap-[clamp(1.2rem,2.6vw,1.9rem)]">
            {[4, 1, 2].map((motorCount, card) => (
              <div key={card} className="nb-box p-[clamp(1.1rem,2.4vw,1.7rem)]">
                <div className="grid items-end gap-[clamp(0.9rem,2vw,1.4rem)] sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <div>
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="mt-2 h-[2.75rem]" />
                  </div>
                  <Skeleton className="h-[2.75rem] w-36 sm:mb-1" />
                  <Skeleton className="size-11 sm:mb-1 sm:justify-self-end" />
                </div>

                <div className="mt-[clamp(1rem,2.2vw,1.5rem)] border-t-2 border-ink">
                  {Array.from({ length: motorCount }).map((_, i) => (
                    <div
                      key={i}
                      className="grid items-end gap-[0.7rem] border-b border-dashed border-rule py-[clamp(0.85rem,1.8vw,1.15rem)] sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.6fr)_minmax(0,0.6fr)_auto]"
                    >
                      {Array.from({ length: 4 }).map((__, f) => (
                        <div key={f}>
                          <Skeleton className="h-3.5 w-20" />
                          <Skeleton className="mt-2 h-[2.75rem]" />
                        </div>
                      ))}
                      <Skeleton className="size-11 lg:mb-1 lg:justify-self-end" />
                    </div>
                  ))}
                </div>

                <div className="mt-[clamp(0.9rem,2vw,1.3rem)] flex flex-wrap items-center justify-between gap-4">
                  <Skeleton className="h-[2.75rem] w-36" />
                  <Skeleton className="h-6 w-32" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5 · the per-motor check: seven ruled rows on a 2px ink head rule */}
      <section className="nb-rule py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <div className="grid gap-x-[clamp(1.5rem,4vw,3rem)] gap-y-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <Skeleton className="h-4 w-60" />
              <Skeleton className="mt-4 h-9 w-full max-w-[22ch]" />
              <div className="mt-4 max-w-[56ch]">
                <Skeleton className="h-4" />
                <Skeleton className="mt-2 h-4 w-3/4" />
              </div>
            </div>
            <Skeleton className="h-6 w-44 lg:mb-1" />
          </div>

          <div className="mt-[clamp(1.4rem,3vw,2.2rem)] border-t-2 border-ink pt-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-2 gap-4 border-b border-dashed border-rule py-3 sm:grid-cols-7"
              >
                <Skeleton className="h-4" />
                <Skeleton className="h-4" />
                <Skeleton className="hidden h-4 sm:block" />
                <Skeleton className="hidden h-4 sm:block" />
                <Skeleton className="hidden h-4 sm:block" />
                <Skeleton className="hidden h-4 sm:block" />
                <Skeleton className="hidden h-4 sm:block" />
              </div>
            ))}
          </div>

          <div className="mt-[clamp(1.4rem,3vw,2.2rem)] flex flex-wrap gap-3">
            <Skeleton className="h-[2.75rem] w-40" />
            <Skeleton className="h-[2.75rem] w-56" />
          </div>
        </div>
      </section>
    </div>
  );
}
