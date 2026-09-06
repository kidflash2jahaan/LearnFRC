import { Skeleton } from "@/components/ui/skeleton";

/**
 * The dashboard's fallback, mirroring page.tsx section for section:
 *   masthead     nb-wrap, avatar + h1 row, lede, two buttons
 *   tally        one nb-box split at 861px into level / six readings
 *   next up      ruled section, heading, the taped resume tile
 *   departments  ruled section, heading, the three-column wall
 *
 * Tuned to the RETURNING learner, which is who waits on this page: a
 * zero-progress account renders the first-run block instead, and that account
 * only ever sees this screen once. The badge drawer is left out because it sits
 * well below the fold on every viewport this page is read at.
 *
 * The real sections are drawn as real sections (the 2px ink rules and the
 * gutters are cheap and they are what makes the fallback land in the same place
 * the content does), and only the content inside them is a placeholder.
 */
export default function DashboardLoading() {
  return (
    <>
      {/* ===================== MASTHEAD ===================== */}
      <section className="nb-wrap pb-[clamp(1.4rem,3vw,2.2rem)] pt-[clamp(2.2rem,5vw,3.6rem)]">
        <Skeleton className="h-4 w-40" />

        <div className="mt-3 flex items-center gap-[clamp(0.9rem,2vw,1.3rem)]">
          <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
          <Skeleton className="h-[clamp(2rem,1.3rem+2.4vw,3.4rem)] w-64 max-w-full" />
        </div>

        <div className="mt-[clamp(0.9rem,2vw,1.2rem)] max-w-[46ch] space-y-2">
          <Skeleton className="h-5" />
          <Skeleton className="h-5 w-2/3" />
        </div>

        <div className="mt-[clamp(1.2rem,2.4vw,1.7rem)] flex flex-wrap gap-3">
          <Skeleton className="h-11 w-48" />
          <Skeleton className="h-11 w-36" />
        </div>
      </section>

      {/* ===================== THE TALLY ===================== */}
      <section className="nb-wrap pb-[clamp(2rem,4vw,3.2rem)]">
        <div className="nb-box grid grid-cols-1 min-[861px]:grid-cols-[minmax(0,0.82fr)_minmax(0,1.5fr)]">
          <div className="nb-panel p-[clamp(1.05rem,2.4vw,1.7rem)]">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="mt-2 h-[clamp(2.6rem,1.9rem+2.4vw,3.6rem)] w-20" />
            <Skeleton className="mt-4 h-[0.8rem]" />
            <Skeleton className="mt-2 h-4 w-28" />
            <Skeleton className="mt-2 h-5 w-40" />
          </div>

          <div className="nb-panel p-[clamp(1.05rem,2.4vw,1.7rem)]">
            <Skeleton className="h-4 w-20" />
            <div className="mt-3 grid grid-cols-2 gap-x-[clamp(0.9rem,2.4vw,2rem)] gap-y-[clamp(0.8rem,1.8vw,1.15rem)] min-[520px]:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="border-t-2 border-ink pt-2">
                  <Skeleton className="h-6 w-14" />
                  <Skeleton className="mt-1.5 h-3.5 w-24" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===================== NEXT UP ===================== */}
      <section className="nb-wrap border-t-2 border-ink py-[clamp(2.2rem,4.5vw,3.6rem)]">
        <Skeleton className="h-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)] w-40" />
        {/* The resume tile: slug, big title, slug, meter, ruled footer. */}
        <Skeleton className="mt-[clamp(1.2rem,2.6vw,1.8rem)] h-[clamp(15rem,26vw,18rem)]" />
      </section>

      {/* ===================== DEPARTMENTS ===================== */}
      <section className="nb-wrap border-t-2 border-ink py-[clamp(2.2rem,4.5vw,3.6rem)]">
        <div className="mb-[clamp(1.4rem,3vw,2.2rem)] flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <Skeleton className="h-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)] w-72 max-w-full" />
            <Skeleton className="mt-3 h-5 w-full max-w-[46ch]" />
          </div>
          <Skeleton className="h-11 w-44 shrink-0" />
        </div>

        <div className="grid gap-[clamp(0.9rem,1.9vw,1.4rem)] min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      </section>
    </>
  );
}
