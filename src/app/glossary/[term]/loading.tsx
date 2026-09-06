import type { CSSProperties } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * A term while the catalogue is still being read.
 *
 * It holds the finished sheet's shape: the filing line, the taped card that is
 * the whole point of the page, the margin note under it, the ruled log of
 * lessons, and the uneven wall of neighbouring cards.
 *
 * The spans and the count are the page's own, so the wall lands on the same
 * twelve columns and nothing shifts sideways when the real cards arrive.
 */
const RELATED_SPANS = [7, 5, 5, 7];

export default function GlossaryTermLoading() {
  return (
    <>
      {/* ===================== THE CARD ===================== */}
      <section className="nb-wrap pb-[clamp(1.8rem,3.5vw,2.6rem)] pt-[clamp(1.8rem,4vw,3rem)]">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-3.5 w-12" />
          <Skeleton className="h-3.5 w-2" />
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-2" />
          <Skeleton className="h-3.5 w-24" />
        </div>

        <Skeleton className="mt-[clamp(1.2rem,2.4vw,1.8rem)] h-[19rem] max-w-[46rem] rounded-hand" />
      </section>

      {/* ===================== IN A MATCH ===================== */}
      <section className="nb-wrap pb-[clamp(1.8rem,3.5vw,2.6rem)]">
        <Skeleton className="h-[9.5rem] max-w-[52rem] rounded-hand-sm" />
      </section>

      {/* ===================== THE LESSONS ===================== */}
      <section className="nb-wrap pb-[clamp(2.2rem,4.5vw,3.4rem)]">
        <div className="nb-rule pt-[clamp(1.6rem,3.2vw,2.4rem)]">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
            <div>
              <Skeleton className="h-[clamp(1.5rem,2.5vw,2.3rem)] w-[min(20rem,80%)]" />
              <Skeleton className="mt-3 h-4 w-[min(26rem,92%)]" />
            </div>
            <Skeleton className="h-6 w-24 shrink-0" />
          </div>

          <div className="nb-list mt-[clamp(1rem,2vw,1.4rem)]">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="grid gap-[clamp(1rem,3vw,2.4rem)] border-b border-dashed border-rule py-[clamp(1.05rem,2.2vw,1.6rem)] min-[769px]:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto]"
              >
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-[1.4rem] w-[min(28rem,90%)]" />
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-[58%]" />
                </div>
                <Skeleton className="hidden h-3.5 w-10 min-[769px]:block" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== THE CARDS NEXT TO IT ===================== */}
      <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)]">
        <div className="nb-rule pt-[clamp(1.6rem,3.2vw,2.4rem)]">
          <Skeleton className="mb-[clamp(1.2rem,2.6vw,1.9rem)] h-[clamp(1.5rem,2.5vw,2.3rem)] w-[min(16rem,66%)]" />

          <div className="grid grid-cols-1 gap-[clamp(0.85rem,1.7vw,1.35rem)] min-[640px]:grid-cols-2 min-[1080px]:grid-cols-12">
            {RELATED_SPANS.map((span, i) => (
              <div
                key={i}
                className="min-[1080px]:[grid-column:var(--span)]"
                style={{ "--span": `span ${span}` } as CSSProperties}
              >
                <Skeleton className="h-[12.5rem] w-full rounded-hand" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
