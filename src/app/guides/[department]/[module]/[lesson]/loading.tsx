import { Skeleton } from "@/components/ui/skeleton";

/**
 * The lesson sheet, before the ink lands.
 *
 * The only job of this file is that nothing moves when the real page arrives,
 * so it draws the same shapes the lesson opens with, in the same order, at the
 * same clamps: the file path, the title, the lede, the ruled fact row with the
 * two controls at the end of it, then the margin-and-sheet split.
 *
 * The margin is `hidden lg:block` on the real page, so it is hidden here too.
 * Drawing it on a phone would shift the layout by a whole column the moment the
 * article swapped in.
 *
 * What is deliberately NOT drawn: the takeaways callout, the article clippings,
 * the signup block and the mobile progress strip all render conditionally on
 * real data or on who is reading, so guessing them here would shift the page
 * for every lesson that has none. What is drawn below the prose is the set that
 * renders on all 394 lessons.
 *
 * `Skeleton` carries its own `aria-hidden`, so this whole tree is invisible to a
 * screen reader. That is right: it announces nothing because there is nothing
 * yet to announce.
 */
export default function LessonLoading() {
  return (
    <div className="nb-wrap pb-[clamp(2.4rem,5vw,4rem)] pt-[clamp(1.8rem,4vw,3rem)]">
      {/* the trail: guides / department / module / lesson */}
      <div className="-my-2 flex min-h-11 flex-wrap items-center gap-x-2 py-2">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 w-1.5" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-1.5" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-1.5" />
        <Skeleton className="h-4 w-40" />
      </div>

      <header className="mt-[clamp(1rem,2.2vw,1.6rem)]">
        {/* h1, clamp(2.45rem … 4.35rem) at leading .98, capped at 17ch */}
        <Skeleton className="h-[clamp(2.4rem,4.5vw,4.3rem)] w-[min(100%,15ch)]" />
        <Skeleton className="mt-2 h-[clamp(2.4rem,4.5vw,4.3rem)] w-[min(100%,10ch)]" />

        {/* the lede, capped at 46ch like nb-lede */}
        <div className="mt-[clamp(0.9rem,1.8vw,1.3rem)] max-w-[46ch]">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="mt-2 h-5 w-[94%]" />
          <Skeleton className="mt-2 h-5 w-[52%]" />
        </div>

        {/* the ruled fact row: four label/figure pairs, then the two controls */}
        <div className="nb-rule mt-[clamp(1.4rem,2.8vw,2.1rem)] flex flex-wrap items-end justify-between gap-x-[clamp(1.2rem,3vw,2.6rem)] gap-y-5 pt-4">
          <div className="flex flex-wrap items-end gap-x-[clamp(1.2rem,3vw,2.6rem)] gap-y-4">
            {[24, 20, 22, 12].map((w, i) => (
              <div key={i}>
                <Skeleton className="h-4" style={{ width: `${w * 4}px` }} />
                <Skeleton className="mt-1.5 h-6 w-20" />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-11 w-36" />
            <Skeleton className="h-11 w-24" />
          </div>
        </div>
      </header>

      <div className="mt-[clamp(2rem,4vw,3.2rem)] grid gap-[clamp(1.8rem,3.5vw,3rem)] lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-0">
        {/* ---- the margin ---- */}
        <aside className="hidden lg:block lg:pr-[clamp(1.6rem,2.6vw,2.6rem)]">
          <div className="sticky top-[clamp(5rem,7vw,6.5rem)]">
            <Skeleton className="h-4 w-28" />
            <div className="mt-3 grid gap-2 pl-4">
              {[92, 78, 86, 64, 88, 70].map((w, i) => (
                <Skeleton key={i} className="h-5" style={{ width: `${w}%` }} />
              ))}
            </div>
            <div className="nb-hair mt-6 pt-5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-1.5 h-5 w-40" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-4 w-36" />
            </div>
          </div>
        </aside>

        {/* ---- the sheet ---- */}
        <div className="min-w-0 lg:border-l-2 lg:border-ink lg:pl-[clamp(1.8rem,3vw,3rem)]">
          {/* the opening run of prose, at the nb-prose 68ch measure */}
          <div className="grid max-w-[68ch] gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[97%]" />
            <Skeleton className="h-4 w-[93%]" />
            <Skeleton className="h-4 w-[99%]" />
            <Skeleton className="h-4 w-[68%]" />
          </div>

          {/* an h2, which nb-prose opens on its own 2px ink rule */}
          <div className="nb-rule mt-10 pt-[1.1rem]">
            <Skeleton className="h-8 w-[min(100%,22ch)]" />
          </div>
          <div className="mt-4 grid max-w-[68ch] gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[95%]" />
            <Skeleton className="h-4 w-[98%]" />
            <Skeleton className="h-4 w-[61%]" />
          </div>

          {/* the code or table block most lessons carry */}
          <Skeleton className="mt-6 h-40 max-w-[68ch]" />

          <div className="nb-rule mt-10 pt-[1.1rem]">
            <Skeleton className="h-8 w-[min(100%,18ch)]" />
          </div>
          <div className="mt-4 grid max-w-[68ch] gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[91%]" />
            <Skeleton className="h-4 w-[96%]" />
            <Skeleton className="h-4 w-[47%]" />
          </div>

          {/* the continuation block: ruled, not a card */}
          <div className="nb-rule mt-[clamp(2rem,4vw,3rem)] pt-4">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="mt-3 h-8 w-[min(100%,16ch)]" />
            <Skeleton className="mt-4 h-[7.5rem] w-full" />
            <div className="mt-4 flex flex-wrap gap-4">
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-5 w-44" />
            </div>
          </div>

          {/* the colophon: sources and corrections */}
          <div className="nb-rule mt-[clamp(2rem,4vw,3rem)] pt-4">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="mt-2.5 h-7 w-[min(100%,20ch)]" />
            <div className="mt-3 grid max-w-[60ch] gap-2.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[88%]" />
            </div>
          </div>

          {/* the answer sheet */}
          <Skeleton className="mt-[clamp(2rem,4vw,3rem)] h-[22rem]" />

          {/* the running footer: what came before, what comes after */}
          <div className="nb-rule mt-[clamp(2rem,4vw,3rem)] grid gap-y-4 pt-5 sm:grid-cols-2 sm:gap-x-8">
            <div>
              <Skeleton className="h-4 w-36" />
              <Skeleton className="mt-1.5 h-5 w-[min(100%,26ch)]" />
            </div>
            <div className="sm:justify-self-end sm:text-right">
              <Skeleton className="h-4 w-32 sm:ml-auto" />
              <Skeleton className="mt-1.5 h-5 w-[min(100%,26ch)] sm:ml-auto" />
            </div>
          </div>

          {/* the whole department, folded away */}
          <Skeleton className="mt-[clamp(2rem,4vw,3rem)] h-[3.4rem]" />
        </div>
      </div>
    </div>
  );
}
