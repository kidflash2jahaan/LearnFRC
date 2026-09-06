import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback for /tools/frc-budget-calculator.
 *
 * The page awaits getSession() (cookies plus a Supabase round-trip), so it is
 * never prerendered and navigation blocks until that resolves.
 *
 * The shape below is the real page's three bands in order, so nothing jumps
 * when the calculator arrives: question with the taped total, the three-panel
 * assumptions frame, then the ledger. Rendered as a <div> because the root
 * layout already owns the <main> landmark.
 */
export default function BudgetCalculatorLoading() {
  return (
    <div>
      {/* 1 · the question, with the total taped beside it */}
      <div className="nb-wrap py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="grid items-start gap-[clamp(1.6rem,4vw,3.4rem)] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.82fr)]">
          <div>
            <Skeleton className="h-4 w-56" />
            <Skeleton className="mt-4 h-[clamp(2.2rem,1.6rem+2.4vw,3.4rem)] w-full max-w-[24ch]" />
            <Skeleton className="mt-2 h-[clamp(2.2rem,1.6rem+2.4vw,3.4rem)] w-2/5" />
            <div className="mt-5 max-w-[46ch]">
              <Skeleton className="h-4" />
              <Skeleton className="mt-2 h-4" />
              <Skeleton className="mt-2 h-4 w-4/5" />
            </div>
          </div>

          <div className="nb-box nb-tilt-1 mt-2 p-[clamp(1.2rem,2.4vw,1.7rem)]">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="mt-4 h-[clamp(2rem,1.3rem+2.4vw,3rem)] w-3/4" />
            <Skeleton className="mt-3 h-3.5" />
            <div className="nb-hair mt-4 grid gap-2 pt-3.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-3.5" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2 · the three-panel assumptions frame */}
      <section className="nb-rule py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="mt-4 h-9 w-full max-w-[22ch]" />

          {/* Divider held horizontal through 861-1023 to match the real strip,
              which splits at `lg` rather than the usual 861. */}
          <div className="nb-box mt-[clamp(1.4rem,3vw,2.2rem)] grid overflow-hidden max-lg:[&>.nb-panel+.nb-panel]:border-l-0 max-lg:[&>.nb-panel+.nb-panel]:border-t-2 lg:grid-cols-[1.05fr_1fr_0.92fr]">
            {Array.from({ length: 3 }).map((_, panel) => (
              <div key={panel} className="nb-panel gap-4">
                <Skeleton className="h-3.5 w-32" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i}>
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="mt-2 h-[2.75rem]" />
                    <Skeleton className="mt-2 h-3 w-4/5" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3 · the ledger: ruled category heads with lines under each */}
      <section className="nb-rule py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <div className="grid gap-x-[clamp(1.5rem,4vw,3rem)] gap-y-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-4 h-9 w-full max-w-[20ch]" />
            </div>
            <div className="flex flex-wrap gap-3 lg:pb-1">
              <Skeleton className="h-[2.75rem] w-40" />
              <Skeleton className="h-[2.75rem] w-48" />
            </div>
          </div>

          <div className="mt-[clamp(1.6rem,3vw,2.2rem)] max-w-[74ch]">
            {[3, 1, 6, 2].map((rows, sec) => (
              <div key={sec} className="mt-[clamp(1.4rem,2.8vw,2.1rem)] first:mt-0">
                <div className="flex items-baseline justify-between gap-4 border-b-2 border-ink pb-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-5 w-24" />
                </div>
                {Array.from({ length: rows }).map((_, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 border-b border-dashed border-rule py-2.5"
                  >
                    <Skeleton className="h-4" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ))}

            <div className="mt-[clamp(1.6rem,3.2vw,2.4rem)] border-t-2 border-ink pt-4">
              <div className="flex items-baseline justify-between gap-6">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-8 w-36" />
              </div>
              <Skeleton className="mt-4 h-3.5 w-3/5" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
