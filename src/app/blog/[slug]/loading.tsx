import { Skeleton } from "@/components/ui/skeleton";

/**
 * An article while its markdown is still being read.
 *
 * It holds the finished sheet's shape: the filing line and the ruled meta row
 * at the head, the prose column with the margin index beside it at xl, the
 * blue bridge band, and the three-panel strip at the foot.
 *
 * The prose block is drawn as real ruled lines of text rather than one grey
 * slab, because a wall of grey where the reading is supposed to be reads as a
 * broken page rather than as a page on its way.
 */

/** A placeholder that has to read on the ballpoint band instead of on paper. */
const ON_SLAB = "bg-[rgba(245,246,242,0.22)] border-[rgba(245,246,242,0.35)]";

/** One paragraph of prose, at the 68ch measure `nb-prose` sets. */
function Para({ widths }: { widths: string[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {widths.map((w, i) => (
        <Skeleton key={i} className="h-4" style={{ width: w }} />
      ))}
    </div>
  );
}

export default function ArticleLoading() {
  return (
    <article>
      {/* ===================== THE HEAD OF THE SHEET ===================== */}
      <header className="nb-wrap pb-[clamp(1.4rem,3vw,2.2rem)] pt-[clamp(1.8rem,4vw,3rem)]">
        <Skeleton className="h-[var(--tap)] w-44" />

        <Skeleton className="mt-3 h-4 w-36" />

        {/* h1, two lines at the article clamp */}
        <Skeleton className="mt-4 h-[clamp(2rem,2.9vw,3.4rem)] w-[min(30rem,96%)]" />
        <Skeleton className="mt-2 h-[clamp(2rem,2.9vw,3.4rem)] w-[min(21rem,70%)]" />

        {/* nb-lede, two lines capped at 46ch */}
        <div className="mt-5 flex max-w-[46ch] flex-col gap-2.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[78%]" />
        </div>

        <div className="nb-hair mt-[clamp(1.3rem,2.6vw,1.9rem)] flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pt-4">
          <Skeleton className="h-3.5 w-[min(22rem,80%)]" />
          <Skeleton className="h-[var(--tap)] w-28" />
        </div>
      </header>

      {/* ===================== BODY AND MARGIN INDEX ===================== */}
      <div className="nb-wrap grid gap-[clamp(1.8rem,4vw,3.4rem)] pb-[clamp(2rem,4vw,3rem)] xl:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="max-w-[68ch]">
          <Para widths={["100%", "96%", "99%", "62%"]} />

          {/* an h2, which nb-prose rules off above */}
          <div className="nb-rule mt-9 pt-[1.1rem]">
            <Skeleton className="h-[clamp(1.5rem,1.2vw+1.1rem,2rem)] w-[58%]" />
          </div>
          <div className="mt-[1.1rem]">
            <Para widths={["100%", "93%", "97%", "58%"]} />
          </div>

          {/* a pull-out note in the body */}
          <Skeleton className="mt-[1.1rem] h-32 rounded-hand-sm" />

          <div className="nb-rule mt-9 pt-[1.1rem]">
            <Skeleton className="h-[clamp(1.5rem,1.2vw+1.1rem,2rem)] w-[46%]" />
          </div>
          <div className="mt-[1.1rem]">
            <Para widths={["100%", "90%", "95%", "71%", "44%"]} />
          </div>

          {/* sources and corrections */}
          <Skeleton className="mt-10 h-56 w-full rounded-hand" />
        </div>

        {/* the margin index, a column only at xl */}
        <aside className="hidden xl:block">
          <Skeleton className="h-3.5 w-32" />
          <div className="mt-3 flex flex-col gap-3">
            {[92, 76, 88, 64, 84, 70].map((w, i) => (
              <Skeleton key={i} className="h-9" style={{ width: `${w}%` }} />
            ))}
          </div>
        </aside>
      </div>

      {/* ===================== THE BRIDGE BAND ===================== */}
      <section className="nb-slab mt-[clamp(2.4rem,5vw,3.6rem)] py-[clamp(2.2rem,4.5vw,3.4rem)]">
        <div className="nb-wrap">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="min-w-0">
              <Skeleton className={`h-3.5 w-40 ${ON_SLAB}`} />
              <Skeleton className={`mt-3 h-[clamp(1.55rem,1.7vw,2.5rem)] w-[min(26rem,90%)] ${ON_SLAB}`} />
              <Skeleton className={`mt-4 h-4 w-[min(30rem,100%)] ${ON_SLAB}`} />
            </div>
            <Skeleton className={`h-[var(--tap)] w-40 shrink-0 ${ON_SLAB}`} />
          </div>

          <div className="mt-[clamp(1.5rem,3vw,2.2rem)] grid gap-x-[clamp(1.4rem,3vw,2.6rem)] min-[860px]:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="nb-hair py-[clamp(0.9rem,1.8vw,1.15rem)]">
                <Skeleton className={`h-3.5 w-24 ${ON_SLAB}`} />
                <Skeleton className={`mt-2.5 h-5 w-[92%] ${ON_SLAB}`} />
                <Skeleton className={`mt-2.5 h-3.5 w-full ${ON_SLAB}`} />
                <Skeleton className={`mt-2 h-3.5 w-[64%] ${ON_SLAB}`} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== THE ACCOUNT ASK ===================== */}
      <section className="nb-wrap pt-[clamp(2.4rem,5vw,3.6rem)]">
        <Skeleton className="h-[15rem] max-w-[44rem] rounded-hand" />
      </section>

      {/* ===================== KEEP READING ===================== */}
      <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)] pt-[clamp(2.4rem,5vw,3.6rem)]">
        <Skeleton className="mb-[clamp(1.1rem,2.4vw,1.7rem)] h-[clamp(1.5rem,2.5vw,2.3rem)] w-[min(18rem,70%)]" />
        <Skeleton className="h-[15rem] w-full rounded-hand" />
      </section>
    </article>
  );
}
