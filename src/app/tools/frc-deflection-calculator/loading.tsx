import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback for /tools/frc-deflection-calculator.
 *
 * The page awaits getSession() (cookies plus a Supabase round-trip), so it is
 * never prerendered and navigation blocks until that resolves.
 *
 * The shape below is the real page's bands in order, so nothing jumps when the
 * calculator arrives: question with the stock shelf, ink verdict band, the
 * member tag, the section drawn beside its dimensions, then the working table.
 * Rendered as a <div> because the root layout already owns the <main>
 * landmark, and a second one would break the skip link.
 */
export default function DeflectionCalculatorLoading() {
  return (
    <div>
      {/* 1 · the question, then the stock shelf */}
      <div className="nb-wrap py-[clamp(2.2rem,5vw,3.6rem)]">
        <Skeleton className="h-4 w-60" />
        <Skeleton className="mt-4 h-[clamp(2.2rem,1.6rem+2.4vw,3.4rem)] w-full max-w-[24ch]" />
        <Skeleton className="mt-2 h-[clamp(2.2rem,1.6rem+2.4vw,3.4rem)] w-1/2" />
        <div className="mt-5 max-w-[46ch]">
          <Skeleton className="h-4" />
          <Skeleton className="mt-2 h-4" />
          <Skeleton className="mt-2 h-4 w-3/5" />
        </div>

        <div className="nb-hair mt-[clamp(1.6rem,3.4vw,2.4rem)] pt-[clamp(1.1rem,2.2vw,1.5rem)]">
          <Skeleton className="h-3.5 w-32" />
          <div className="mt-3 flex flex-wrap gap-2">
            {[26, 40, 34, 26, 44, 28].map((w, i) => (
              <Skeleton
                key={i}
                className="h-[2.75rem]"
                style={{ width: `${w * 0.25}rem` }}
              />
            ))}
          </div>
          <Skeleton className="mt-3 h-4 w-4/5 max-w-[70ch]" />
        </div>
      </div>

      {/* 2 · the ink verdict band, a real band even while empty so the page
             does not grow a blue stripe on arrival */}
      <section className="nb-slab py-[clamp(2rem,4.4vw,3.2rem)]">
        <div className="nb-wrap grid items-end gap-[clamp(1.3rem,3vw,2.6rem)] lg:grid-cols-[minmax(0,1.05fr)_repeat(3,minmax(0,0.72fr))]">
          <div>
            <Skeleton className="h-4 w-56" />
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

      {/* 3 · the member tag: six fields, then the derived lines in the footer */}
      <section className="py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div>
              <Skeleton className="h-4 w-64" />
              <Skeleton className="mt-4 h-9 w-full max-w-[20ch]" />
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <Skeleton className="h-[2.75rem] w-36" />
              <Skeleton className="h-[2.75rem] w-32" />
            </div>
          </div>

          <div className="nb-box nb-tilt-3 mt-[clamp(1.4rem,3vw,2.2rem)] p-[clamp(1.2rem,2.6vw,2rem)]">
            <div className="grid gap-[clamp(1rem,2.2vw,1.5rem)] sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="mt-2 h-[2.75rem]" />
                  <Skeleton className="mt-2 h-3 w-4/5" />
                </div>
              ))}
            </div>
            <div className="nb-hair mt-[clamp(1.2rem,2.6vw,1.8rem)] grid gap-1.5 pt-[clamp(1.1rem,2.2vw,1.5rem)]">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-3.5" />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4 · the section: dimensions on one card, the load case drawn on the other */}
      <section className="nb-rule py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <Skeleton className="h-4 w-52" />
          <Skeleton className="mt-4 h-9 w-full max-w-[22ch]" />

          <div className="mt-[clamp(1.4rem,3vw,2.2rem)] grid items-start gap-[clamp(1.2rem,2.8vw,2.2rem)] lg:grid-cols-2">
            <div className="nb-box nb-tilt-2 p-[clamp(1.1rem,2.4vw,1.7rem)]">
              <Skeleton className="h-3.5 w-48" />
              <div className="mt-4 grid gap-[clamp(1rem,2.2vw,1.4rem)] sm:grid-cols-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i}>
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="mt-2 h-[2.75rem]" />
                    <Skeleton className="mt-2 h-3 w-4/5" />
                  </div>
                ))}
              </div>
              <div className="nb-hair mt-[clamp(1.1rem,2.4vw,1.6rem)] grid gap-1.5 pt-[clamp(1rem,2.2vw,1.4rem)]">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-3.5" />
                ))}
              </div>
            </div>

            <div className="nb-box nb-tilt-3 p-[clamp(1.1rem,2.4vw,1.7rem)] lg:mt-8">
              <Skeleton className="h-3.5 w-56" />
              {/* the diagram holds a 320 x 132 viewBox, so reserve that ratio */}
              <Skeleton className="mt-4 aspect-[320/132] w-full" />
              <Skeleton className="mt-3 h-4" />
              <Skeleton className="mt-2 h-4 w-3/4" />
              <Skeleton className="mt-[clamp(1.1rem,2.4vw,1.6rem)] h-[2.75rem] w-48" />
            </div>
          </div>
        </div>
      </section>

      {/* 5 · the working: eight formula rows on a 2px ink head rule */}
      <section className="nb-rule py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div>
              <Skeleton className="h-4 w-52" />
              <Skeleton className="mt-4 h-9 w-full max-w-[20ch]" />
            </div>
            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-[2.75rem] w-40" />
              <Skeleton className="h-[2.75rem] w-36" />
            </div>
          </div>

          <div className="mt-[clamp(1.4rem,3vw,2.2rem)] border-t-2 border-ink pt-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-1 gap-4 border-b border-dashed border-rule py-3 sm:grid-cols-3"
              >
                <Skeleton className="h-4" />
                <Skeleton className="hidden h-4 sm:block" />
                <Skeleton className="hidden h-4 sm:block" />
              </div>
            ))}
          </div>

          <div className="nb-note mt-[clamp(1.4rem,3vw,2.2rem)] max-w-[64ch]">
            <Skeleton className="h-3.5 w-56" />
            <Skeleton className="mt-3 h-4" />
            <Skeleton className="mt-2 h-4" />
            <Skeleton className="mt-2 h-4 w-2/3" />
          </div>
        </div>
      </section>
    </div>
  );
}
