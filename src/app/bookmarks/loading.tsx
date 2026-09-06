import { Skeleton } from "@/components/ui/skeleton";

/**
 * The bookmarks fallback, mirroring page.tsx:
 *   masthead   nb-wrap, split at 900px into copy / index slip
 *   folder     ruled section, one nb-box holding ruled entries
 *
 * Tuned to the POPULATED state, which is the state this page exists for and the
 * one a returning member waits on. An empty folder renders a short block
 * instead, and that render needs no data, so nobody watches a fallback for it.
 *
 * The section rules and gutters are drawn for real, so the placeholders land
 * where the entries will.
 */
export default function BookmarksLoading() {
  return (
    <>
      {/* ===================== MASTHEAD ===================== */}
      <section className="nb-wrap pb-[clamp(2rem,4vw,3rem)] pt-[clamp(2.2rem,5vw,4rem)]">
        <div className="grid items-start gap-[clamp(1.6rem,4vw,3.2rem)] min-[900px]:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
          <div className="min-w-0">
            <Skeleton className="h-4 w-44" />

            {/* h1, two lines at the 16ch measure the real heading holds to. */}
            <Skeleton className="mt-3 h-[clamp(2.45rem,0.2rem+4.6vw,4.35rem)] w-full max-w-[16ch]" />
            <Skeleton className="mt-2 h-[clamp(2.45rem,0.2rem+4.6vw,4.35rem)] w-2/3 max-w-[16ch]" />

            <div className="mt-[clamp(1rem,2vw,1.5rem)] max-w-[46ch] space-y-2">
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
              <Skeleton className="h-5 w-3/5" />
            </div>

            <div className="mt-[clamp(1.4rem,2.6vw,2rem)] flex flex-wrap gap-3">
              <Skeleton className="h-11 w-44" />
              <Skeleton className="h-11 w-48" />
            </div>
          </div>

          {/* The index slip, tilted the same 0.55deg as the real one. */}
          <div className="min-[900px]:justify-self-end">
            <div className="nb-box nb-tilt-2 w-full max-w-[24rem] p-[clamp(1.1rem,2.4vw,1.6rem)]">
              <Skeleton className="h-4 w-24" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-5" />
                ))}
              </div>
              <div className="nb-hair mt-4 flex gap-6 pt-3.5">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-28" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== THE FOLDER ===================== */}
      <section className="nb-wrap border-t-2 border-ink py-[clamp(2.2rem,4.5vw,3.6rem)]">
        <div className="mb-[clamp(1.1rem,2.4vw,1.6rem)] flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <Skeleton className="h-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)] w-44" />
          <Skeleton className="h-4 w-24" />
        </div>

        <div className="nb-box">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="grid items-baseline gap-x-[clamp(1rem,3vw,2.2rem)] gap-y-2 border-b border-dashed border-rule px-[clamp(1rem,2.4vw,1.7rem)] py-[clamp(1rem,2.2vw,1.4rem)] last:border-b-0 min-[760px]:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto]"
            >
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3.5 w-28" />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Skeleton className="h-6 w-4/5" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3.5 w-36" />
              </div>
              <Skeleton className="h-11 w-28 justify-self-start min-[760px]:justify-self-end" />
            </div>
          ))}
        </div>

        <Skeleton className="mt-[clamp(1.4rem,3vw,2.2rem)] h-5 w-full max-w-[56ch]" />
      </section>
    </>
  );
}
