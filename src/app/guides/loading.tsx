import type { CSSProperties } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { spansFor } from "./_pit-row";

/**
 * /guides is the one route in this group that is genuinely dynamic: it reads
 * the session and, for a signed-in reader, makes two more Supabase reads for
 * the per-department progress. That is real per-request latency, so this is the
 * fallback most likely to actually be seen.
 *
 * It holds the finished page's shape exactly, so nothing jumps when the real
 * thing lands: masthead, the blue tally band, the card wall on the same twelve
 * columns with the same widths, then the closing note.
 *
 * `spansFor` is imported rather than copied so the wall cannot drift out of
 * sync with the page. Eleven is the catalogue's size; if a department is ever
 * added the placeholder is one card short for a moment, which costs nothing.
 */
const CARDS = 11;
const SPANS = spansFor(CARDS);

/** A placeholder that has to read on the blue slab instead of on paper. */
const ON_SLAB = "bg-[rgba(245,246,242,0.22)] border-[rgba(245,246,242,0.35)]";

export default function GuidesLoading() {
  return (
    <>
      {/* ===================== MASTHEAD ===================== */}
      <section className="nb-wrap pb-[clamp(2rem,4vw,3rem)] pt-[clamp(2.2rem,5vw,4rem)]">
        {/* nb-marker line */}
        <Skeleton className="h-4 w-44" />

        {/* h1, two lines at the display clamp */}
        <Skeleton className="mt-4 h-[clamp(2.4rem,4.6vw,4.3rem)] w-[min(38rem,94%)]" />
        <Skeleton className="mt-2 h-[clamp(2.4rem,4.6vw,4.3rem)] w-[min(27rem,72%)]" />

        {/* nb-lede, three lines capped at 46ch */}
        <div className="mt-[clamp(1rem,2vw,1.5rem)] flex max-w-[46ch] flex-col gap-2.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[96%]" />
          <Skeleton className="h-4 w-[58%]" />
        </div>

        {/* the two buttons, at the 44px floor */}
        <div className="mt-[clamp(1.4rem,2.6vw,2rem)] flex flex-wrap gap-3">
          <Skeleton className="h-11 w-52" />
          <Skeleton className="h-11 w-48" />
        </div>
      </section>

      {/* ===================== THE TALLY ===================== */}
      <section className="nb-slab py-[clamp(2.2rem,4.5vw,3.4rem)]">
        <div className="nb-wrap grid items-end gap-[clamp(1.3rem,3vw,2.6rem)] min-[900px]:grid-cols-[1.05fr_repeat(3,minmax(0,0.72fr))]">
          <div>
            <Skeleton className={`h-9 w-[min(20rem,90%)] ${ON_SLAB}`} />
            <Skeleton className={`mt-3 h-4 w-[min(26rem,100%)] ${ON_SLAB}`} />
          </div>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i}>
              <Skeleton className={`h-[clamp(2.5rem,3.6vw,4.4rem)] w-[6ch] ${ON_SLAB}`} />
              <Skeleton className={`mt-3 h-3.5 w-[11ch] ${ON_SLAB}`} />
            </div>
          ))}
        </div>
      </section>

      {/* ===================== THE WALL ===================== */}
      <section className="nb-wrap py-[clamp(2.6rem,5vw,4.4rem)]">
        <div className="mb-[clamp(1.6rem,3.4vw,2.6rem)]">
          <Skeleton className="h-[clamp(1.8rem,2.5vw,3.2rem)] w-[min(22rem,80%)]" />
          <div className="mt-3 flex max-w-[56ch] flex-col gap-2.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[62%]" />
          </div>
        </div>

        {/* Same `min-[...]` family at both breakpoints as the real wall, and for
            the same reason: a named `md:` variant is emitted after every
            arbitrary one, so it would out-rank the 12-column rule above 1080px
            and the placeholder would hold a shape the page never takes. */}
        <div className="grid grid-cols-1 gap-[clamp(0.85rem,1.7vw,1.35rem)] min-[768px]:grid-cols-2 min-[1080px]:grid-cols-12">
          {SPANS.map((span, i) => (
            <div
              key={i}
              className="min-[1080px]:[grid-column:var(--span)]"
              style={{ "--span": `span ${span}` } as CSSProperties}
            >
              <Skeleton className="h-[13.5rem] w-full rounded-hand" />
            </div>
          ))}
        </div>
      </section>

      {/* ===================== THE NOTE AT THE END ===================== */}
      <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)]">
        <div className="nb-rule pt-[clamp(1.8rem,3.5vw,2.6rem)]">
          <Skeleton className="h-[11rem] max-w-[46rem] rounded-hand" />
        </div>
      </section>
    </>
  );
}
