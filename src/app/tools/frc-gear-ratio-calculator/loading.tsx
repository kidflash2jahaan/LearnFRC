import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback for /tools/frc-gear-ratio-calculator.
 *
 * The page awaits getSession() (cookies plus a Supabase round-trip), so it is
 * never prerendered and navigation blocks until that resolves. This is also
 * the heaviest client bundle of the six tools, so the gap between click and
 * paint is the most visible here.
 *
 * The shape below is the real page's bands in order, so nothing jumps when the
 * calculator arrives: question with the gearbox shelf, the train as a log, the
 * two output cards, the electrical ceiling as a margin note, then the working
 * table. The back of the sheet is collapsed on arrival, so there is nothing to
 * reserve for it. Rendered as a <div> because the root layout already owns the
 * <main> landmark, and a second one would break the skip link.
 */
export default function GearRatioCalculatorLoading() {
  return (
    <div>
      {/* 1 · the question, then the shelf of known-good gearboxes */}
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
            {[13, 11, 15, 10].map((w, i) => (
              <Skeleton
                key={i}
                className="h-[2.75rem]"
                style={{ width: `${w * 0.75}rem` }}
              />
            ))}
          </div>
          <Skeleton className="mt-3 h-4 w-4/5 max-w-[70ch]" />
        </div>
      </div>

      {/* 2 · the train: the motor head, then one ruled line per mesh */}
      <section className="nb-rule py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div>
              <Skeleton className="h-4 w-56" />
              <Skeleton className="mt-4 h-9 w-full max-w-[20ch]" />
            </div>
            <Skeleton className="h-[2.75rem] w-56" />
          </div>

          <div className="nb-box mt-[clamp(1.4rem,3vw,2.2rem)] p-[clamp(1.1rem,2.4vw,1.8rem)]">
            <div className="grid gap-[clamp(1rem,2.2vw,1.5rem)] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.6fr)]">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="mt-2 h-[2.75rem]" />
                  <Skeleton className="mt-2 h-3 w-4/5" />
                </div>
              ))}
            </div>
            <div className="nb-hair mt-[clamp(1rem,2.2vw,1.4rem)] grid grid-cols-2 gap-x-6 gap-y-2 pt-[clamp(0.9rem,2vw,1.3rem)] sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="mt-1.5 h-3.5 w-20" />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-[clamp(1.4rem,3vw,2rem)] flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-[2.75rem] w-44" />
          </div>

          {/* two meshes by default, on a 2px ink head rule */}
          <div className="mt-3 border-t-2 border-ink">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="grid items-end gap-x-[clamp(0.8rem,2vw,1.6rem)] gap-y-3 border-b border-dashed border-rule py-[clamp(0.9rem,2vw,1.3rem)] md:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,9rem)_2.75rem]"
              >
                <Skeleton className="h-4 w-8 md:mb-3" />
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 2 }).map((_, f) => (
                    <div key={f}>
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="mt-2 h-[2.75rem]" />
                    </div>
                  ))}
                </div>
                <div className="md:pb-2">
                  <Skeleton className="h-3.5 w-24 md:ml-auto" />
                  <Skeleton className="mt-2 h-5 w-28 md:ml-auto" />
                </div>
                <Skeleton className="size-11 md:mb-2 md:justify-self-end" />
              </div>
            ))}
          </div>

          <div className="mt-[clamp(1.1rem,2.4vw,1.6rem)] grid gap-[clamp(1.1rem,2.4vw,1.8rem)] lg:grid-cols-[minmax(0,auto)_minmax(0,1fr)] lg:items-start">
            <Skeleton className="h-[2.75rem] w-44" />
            <div className="lg:max-w-[34rem] lg:justify-self-end">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="mt-2 h-[2.75rem]" />
              <Skeleton className="mt-2 h-3 w-4/5" />
            </div>
          </div>
        </div>
      </section>

      {/* 3 · what comes out, on two cards pinned at two angles */}
      <section className="nb-rule py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <Skeleton className="h-4 w-60" />
          <Skeleton className="mt-4 h-9 w-full max-w-[22ch]" />

          <div className="mt-[clamp(1.4rem,3vw,2.2rem)] grid items-start gap-[clamp(1.2rem,2.8vw,2.2rem)] lg:grid-cols-2">
            {[
              { tilt: "nb-tilt-2", offset: "", rows: 3, fields: 2 },
              { tilt: "nb-tilt-3", offset: "lg:mt-8", rows: 5, fields: 3 },
            ].map((card, i) => (
              <div
                key={i}
                className={`nb-box ${card.tilt} ${card.offset} p-[clamp(1.1rem,2.4vw,1.7rem)]`}
              >
                <Skeleton className="h-3.5 w-44" />
                <Skeleton className="mt-3.5 h-[clamp(1.9rem,1.2rem+2.2vw,2.8rem)] w-3/5" />
                <div className="mt-4 grid gap-2">
                  {Array.from({ length: card.rows }).map((_, rowIndex) => (
                    <Skeleton key={rowIndex} className="h-3.5" />
                  ))}
                </div>
                <div
                  className={`nb-hair mt-[clamp(1.1rem,2.4vw,1.5rem)] grid gap-4 pt-[clamp(1rem,2.2vw,1.4rem)] ${
                    card.fields === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
                  }`}
                >
                  {Array.from({ length: card.fields }).map((_, f) => (
                    <div key={f}>
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="mt-2 h-[2.75rem]" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4 · the electrical ceiling, as a margin note */}
      <section className="py-[clamp(1.4rem,3vw,2.4rem)]">
        <div className="nb-wrap">
          <div className="nb-note grid gap-[clamp(1.2rem,3vw,2.4rem)] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <Skeleton className="h-3.5 w-44" />
              <Skeleton className="mt-3 h-[clamp(1.7rem,1.2rem+1.8vw,2.4rem)] w-2/3" />
              <Skeleton className="mt-3 h-[0.8rem]" />
              <Skeleton className="mt-2 h-3.5 w-4/5" />
              <Skeleton className="mt-3 h-3.5 w-3/5" />
            </div>
            <div>
              <Skeleton className="h-4" />
              <Skeleton className="mt-2 h-4" />
              <Skeleton className="mt-2 h-4 w-3/4" />
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i}>
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="mt-2 h-[2.75rem]" />
                  </div>
                ))}
              </div>
              <Skeleton className="mt-3 h-3" />
              <Skeleton className="mt-1.5 h-3 w-5/6" />
            </div>
          </div>
        </div>
      </section>

      {/* 5 · the working: formula rows on a 2px ink head rule */}
      <section className="nb-rule py-[clamp(2.2rem,5vw,3.6rem)]">
        <div className="nb-wrap">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div>
              <Skeleton className="h-4 w-52" />
              <Skeleton className="mt-4 h-9 w-full max-w-[20ch]" />
            </div>
            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-[2.75rem] w-40" />
              <Skeleton className="h-[2.75rem] w-48" />
            </div>
          </div>

          <div className="mt-[clamp(1.4rem,3vw,2.2rem)] border-t-2 border-ink pt-3">
            {Array.from({ length: 9 }).map((_, i) => (
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

          <div className="nb-hair mt-[clamp(1.4rem,3vw,2rem)] flex flex-wrap items-center justify-between gap-4 pt-[clamp(1.1rem,2.2vw,1.5rem)]">
            <div className="max-w-[46ch] grow">
              <Skeleton className="h-4" />
              <Skeleton className="mt-2 h-4 w-4/5" />
            </div>
            <Skeleton className="h-[2.75rem] w-52" />
          </div>
        </div>
      </section>
    </div>
  );
}
