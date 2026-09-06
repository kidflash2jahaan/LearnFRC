import { Skeleton } from "@/components/ui/skeleton";

/**
 * The profile fallback, mirroring page.tsx section for section:
 *   the card     nb-wrap, split at 1024px into member card / actions box
 *   spec sheet   ruled section, nb-table with three columns and eight rows
 *   checklist    ruled section, ruled badge lines
 *
 * The member card and the actions box are drawn as real `nb-box`es, tilt and
 * all, because their edges are the part of the layout that has to be in the
 * right place; only what is written inside them is a placeholder. Eight table
 * rows and six badge lines match the real counts, so nothing jumps when the
 * data lands.
 */
export default function ProfileLoading() {
  return (
    <>
      {/* ===================== THE CARD ===================== */}
      <section className="nb-wrap pb-[clamp(2rem,4vw,3rem)] pt-[clamp(2.2rem,5vw,4rem)]">
        <Skeleton className="h-4 w-32" />

        <div className="mt-[0.85rem] grid items-start gap-[clamp(1.4rem,3.4vw,2.6rem)] min-[1024px]:grid-cols-[minmax(0,1.4fr)_minmax(0,0.78fr)]">
          <div className="nb-box nb-tilt-1 p-[clamp(1.2rem,2.8vw,2rem)]">
            <Skeleton className="h-4 w-48" />

            <div className="mt-[clamp(1.1rem,2.4vw,1.6rem)] flex flex-wrap items-end gap-[clamp(1rem,2.4vw,1.6rem)]">
              <Skeleton className="h-24 w-24 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-[clamp(1.7rem,1.2rem+1.9vw,2.7rem)] w-56 max-w-full" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>

            <div className="mt-[clamp(1rem,2.2vw,1.4rem)] flex flex-wrap gap-2">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-7 w-36" />
            </div>

            <div className="nb-hair mt-[clamp(1.2rem,2.6vw,1.8rem)] flex flex-wrap gap-x-[clamp(1.4rem,4vw,3rem)] gap-y-3 pt-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-3.5 w-14" />
                </div>
              ))}
            </div>
          </div>

          <div className="nb-box p-[clamp(1.1rem,2.4vw,1.6rem)]">
            <Skeleton className="h-4 w-40" />
            <div className="mt-3 space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="border-t-2 border-ink pt-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="mt-2 h-4 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===================== THE SPEC SHEET ===================== */}
      <section className="nb-wrap border-t-2 border-ink py-[clamp(2.2rem,4.5vw,3.6rem)]">
        <Skeleton className="h-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)] w-72 max-w-full" />
        <Skeleton className="mt-3 h-5 w-full max-w-[56ch]" />

        <div className="nb-scroll mt-[clamp(1.2rem,2.6vw,1.8rem)]">
          <div className="min-w-[34rem]">
            {/* the mono head, on its 2px ink rule */}
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1.3fr)] gap-4 border-b-2 border-ink pb-3">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-36" />
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1.3fr)] gap-4 border-b border-dashed border-rule py-3"
              >
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-44" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== THE CHECKLIST ===================== */}
      <section className="nb-wrap border-t-2 border-ink py-[clamp(2.2rem,4.5vw,3.6rem)]">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <Skeleton className="h-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)] w-36" />
            <Skeleton className="mt-3 h-5 w-full max-w-[40ch]" />
          </div>
          <Skeleton className="h-6 w-24 shrink-0" />
        </div>

        <div className="nb-list mt-[clamp(1.2rem,2.6vw,1.8rem)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="grid items-baseline gap-x-[clamp(1rem,3vw,2.2rem)] gap-y-1.5 border-b border-dashed border-rule py-[clamp(0.85rem,1.9vw,1.25rem)] min-[720px]:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]"
            >
              <Skeleton className="h-4 w-40" />
              <div className="min-w-0 space-y-1.5">
                <Skeleton className="h-5 w-52 max-w-full" />
                <Skeleton className="h-4 w-full max-w-[52ch]" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
