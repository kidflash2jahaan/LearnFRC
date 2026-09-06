import { Skeleton } from "@/components/ui/skeleton";

/**
 * Module hub, before the paper arrives.
 *
 * The point of this file is that nothing moves when the real page lands, so it
 * draws the same three shapes the hub actually opens with and in the same
 * order: the trail and masthead typed straight on the paper, the ruled figure
 * strip under it, then the lessons log.
 *
 * Two things are deliberately NOT drawn. The taped jargon card, the wrong-turn
 * note and the module table below the fold all render conditionally on real
 * data (about a third of modules have no glossary hits and no twins), so
 * guessing them here would shift the page for every module that has none. And
 * the lessons log gets six rows because six is the median across the 101 hubs;
 * a row is short, so being one or two out costs a fraction of a line rather
 * than a card's worth of height.
 *
 * `aria-hidden` comes from `Skeleton` itself, so this whole tree is invisible
 * to a screen reader, which is right: it announces nothing because there is
 * nothing yet to announce.
 */
export default function ModuleLoading() {
  return (
    <>
      {/* ---------------- tab divider ---------------- */}
      <section className="nb-wrap pb-[clamp(1.6rem,3vw,2.4rem)] pt-[clamp(1.8rem,4vw,3rem)]">
        {/* trail: guides / department / module */}
        <div className="-my-2 flex flex-wrap items-center gap-x-2 py-2">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-1.5" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-1.5" />
          <Skeleton className="h-4 w-36" />
        </div>

        {/* nb-marker: the blue stroke plus "module N of M" */}
        <div className="mt-[clamp(1.1rem,2.4vw,1.7rem)] flex items-center gap-2.5">
          <Skeleton className="h-0.5 w-[34px]" />
          <Skeleton className="h-4 w-40" />
        </div>

        {/* h1, clamp(2.45rem … 4.35rem) at leading .98 */}
        <Skeleton className="mt-3 h-[clamp(2.4rem,4.5vw,4.3rem)] w-[min(100%,26ch)]" />
        <Skeleton className="mt-2 h-[clamp(2.4rem,4.5vw,4.3rem)] w-[min(100%,16ch)]" />

        {/* overview lede, capped at 46ch like nb-lede */}
        <div className="mt-[clamp(0.9rem,1.8vw,1.3rem)] max-w-[46ch]">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="mt-2 h-5 w-[92%]" />
          <Skeleton className="mt-2 h-5 w-[58%]" />
        </div>

        {/* the orientation paragraph, narrower and quieter */}
        <div className="mt-4 max-w-[58ch]">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-[96%]" />
          <Skeleton className="mt-2 h-4 w-[64%]" />
        </div>

        {/* the ruled figure strip */}
        <div className="nb-rule mt-[clamp(1.5rem,3vw,2.2rem)] grid grid-cols-2 gap-x-[clamp(1rem,3vw,2.5rem)] gap-y-4 pt-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-6 w-14" />
            </div>
          ))}
        </div>

        {/* the two buttons, at the nb-btn 44px floor */}
        <div className="mt-[clamp(1.4rem,2.8vw,2rem)] flex flex-wrap gap-3">
          <Skeleton className="h-11 w-44" />
          <Skeleton className="h-11 w-40" />
        </div>
      </section>

      {/* ---------------- the lessons log ---------------- */}
      <section className="nb-wrap pb-[clamp(2rem,4vw,3rem)]">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-0.5 w-[34px]" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="mt-2.5 h-[clamp(1.8rem,3vw,3.1rem)] w-[min(100%,24ch)]" />

        <div className="nb-list mt-[clamp(1.2rem,2.4vw,1.8rem)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="grid gap-x-[clamp(1rem,3vw,2.4rem)] gap-y-2 border-b border-dashed border-rule py-[clamp(1.05rem,2.2vw,1.6rem)] md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto]"
            >
              <Skeleton className="h-4 w-40" />
              <div className="min-w-0">
                <Skeleton className="h-5 w-[min(100%,34ch)]" />
                <Skeleton className="mt-2 h-4 w-[min(100%,52ch)]" />
              </div>
              <Skeleton className="hidden h-4 w-14 sm:block" />
            </div>
          ))}
        </div>

        {/* where the tab hands over: one box, two panels */}
        <Skeleton className="mt-[clamp(1.8rem,3.5vw,2.8rem)] h-[9.5rem] sm:h-[7.5rem]" />
      </section>
    </>
  );
}
