import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback for /tools/frc-wire-gauge-calculator.
 *
 * The page awaits getSession() (cookies plus a Supabase round-trip), so it is
 * never prerendered and navigation blocks until that resolves.
 *
 * The shape below is the real page's four bands in order, so nothing jumps
 * when the calculator arrives: question, ink verdict band, the tag, the
 * gauge ladder. Rendered as a <div> because the root layout already owns the
 * <main> landmark, and a second one would break the skip link.
 */
export default function WireGaugeCalculatorLoading() {
  return (
    <div>
      {/* 1 · the question */}
      <div className="nb-wrap py-[clamp(2.2rem,5vw,3.6rem)]">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="mt-4 h-[clamp(2.2rem,1.6rem+2.4vw,3.4rem)] w-full max-w-[26ch]" />
        <Skeleton className="mt-2 h-[clamp(2.2rem,1.6rem+2.4vw,3.4rem)] w-full max-w-[18ch]" />
        <div className="mt-5 max-w-[46ch]">
          <Skeleton className="h-4" />
          <Skeleton className="mt-2 h-4" />
          <Skeleton className="mt-2 h-4 w-3/5" />
        </div>
      </div>

      {/* 2 · the ink verdict band, which is a real band even while empty so
             the page does not grow a blue stripe on arrival */}
      <section className="nb-slab py-[clamp(2rem,4.4vw,3.2rem)]">
        <div className="nb-wrap grid items-end gap-[clamp(1.3rem,3vw,2.6rem)] lg:grid-cols-[minmax(0,1.05fr)_repeat(3,minmax(0,0.72fr))]">
          <div>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-3 h-8 w-full max-w-[15ch]" />
            <Skeleton className="mt-2 h-8 w-2/3" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-[clamp(2.5rem,1.4rem+3.6vw,4.4rem)] w-4/5" />
              <Skeleton className="mt-3 h-4 w-full" />
            </div>
          ))}
        </div>
      </section>

      {/* 3 · the tag */}
      <section className="py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="mt-4 h-9 w-full max-w-[20ch]" />

          <div className="nb-box nb-tilt-3 mt-[clamp(1.4rem,3vw,2.2rem)] p-[clamp(1.2rem,2.6vw,2rem)]">
            <div className="grid gap-[clamp(1rem,2.2vw,1.5rem)] sm:grid-cols-2 lg:grid-cols-3">
              {/* five fields, the fourth of which spans two columns */}
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={i === 3 ? "sm:col-span-2" : ""}>
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="mt-2 h-[2.75rem]" />
                  <Skeleton className="mt-2 h-3 w-4/5" />
                </div>
              ))}
            </div>
            <div className="nb-hair mt-[clamp(1.2rem,2.6vw,1.8rem)] grid gap-[clamp(1rem,2.2vw,1.6rem)] pt-[clamp(1.1rem,2.2vw,1.5rem)] lg:grid-cols-2">
              <div>
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-3" />
                <Skeleton className="mt-1.5 h-3 w-5/6" />
              </div>
              <div className="grid gap-1.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-3.5" />
                ))}
              </div>
            </div>
          </div>

          <Skeleton className="mt-[clamp(1.2rem,2.6vw,1.8rem)] h-[2.75rem]" />
        </div>
      </section>

      {/* 4 · the gauge ladder, ten rows on a 2px ink head rule */}
      <section className="nb-rule py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <Skeleton className="h-4 w-52" />
          <Skeleton className="mt-4 h-9 w-full max-w-[22ch]" />
          <div className="mt-4 max-w-[56ch]">
            <Skeleton className="h-4" />
            <Skeleton className="mt-2 h-4 w-3/4" />
          </div>

          <div className="mt-[clamp(1.4rem,3vw,2.2rem)] border-t-2 border-ink pt-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-2 gap-4 border-b border-dashed border-rule py-3 sm:grid-cols-6"
              >
                <Skeleton className="h-4" />
                <Skeleton className="h-4" />
                <Skeleton className="hidden h-4 sm:block" />
                <Skeleton className="hidden h-4 sm:block" />
                <Skeleton className="hidden h-4 sm:block" />
                <Skeleton className="hidden h-4 sm:block" />
              </div>
            ))}
          </div>

          <div className="mt-[clamp(1.4rem,3vw,2.2rem)] flex flex-wrap gap-3">
            <Skeleton className="h-[2.75rem] w-40" />
            <Skeleton className="h-[2.75rem] w-52" />
          </div>
        </div>
      </section>
    </div>
  );
}
