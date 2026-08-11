import { Skeleton } from "@/components/ui/skeleton";

/**
 * Article index skeleton.
 *
 * Mirrors page.tsx:
 *   hero  → mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-28 sm:px-6
 *           lg:grid-cols-[1.1fr_1fr] lg:gap-10 lg:pb-20 lg:pt-36 lg:px-8
 *   cards → grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 (featured)
 *           and gap-5 for the full library below it
 *
 * The full-library section is three blocks deep before its first card grid,
 * and all three are reproduced here so the grid lands at the same offset:
 *   1. the eyebrow + "The full library" heading row
 *   2. <nav className="mt-6 flex flex-wrap gap-2"> of min-h-11 desk chips
 *   3. <div className="mt-12 …"> → per-desk header (44px ac-badge + 51px
 *      title/blurb stack) → <RevealGroup className="mt-6 grid …">
 */
export default function BlogLoading() {
  return (
    <div className="relative overflow-x-clip">
      {/* ============================ HERO ============================ */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-28 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-10 lg:pb-20 lg:pt-36 lg:px-8">
        <div>
          {/* "The LearnFRC Reader" chip */}
          <Skeleton className="h-7 w-56 rounded-full" />

          {/* h1 — text-4xl / sm:text-5xl / lg:text-[3.3rem], leading-[1.02] */}
          <Skeleton className="mt-5 h-10 w-[90%] rounded-xl sm:h-12 lg:h-14" />
          <Skeleton className="mt-2.5 h-10 w-[72%] rounded-xl sm:h-12 lg:h-14" />

          {/* lead paragraph — mt-5 max-w-xl text-lg */}
          <div className="mt-5 max-w-xl space-y-2.5">
            <Skeleton className="h-5 w-full rounded" />
            <Skeleton className="h-5 w-[95%] rounded" />
            <Skeleton className="h-5 w-[90%] rounded" />
            <Skeleton className="h-5 w-[58%] rounded" />
          </div>

          {/* newsletter form + "browse the guides" — stacks below sm */}
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Skeleton className="h-11 w-full rounded-2xl sm:w-72" />
            <Skeleton className="h-11 w-52 rounded-2xl" />
          </div>

          {/* article / minute / price counters */}
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            <Skeleton className="h-5 w-36 rounded" />
            <Skeleton className="h-5 w-44 rounded" />
            <Skeleton className="h-5 w-24 rounded" />
          </div>
        </div>

        {/* the desk-index glass panel */}
        <Skeleton className="h-[440px] w-full rounded-[28px]" />
      </section>

      {/* =========================== START HERE ========================== */}
      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 lg:px-8">
        <Skeleton className="h-5 w-32 rounded-full" />
        <Skeleton className="mt-2 h-9 w-72 max-w-full rounded-xl sm:h-10" />
        <div className="mt-3 max-w-2xl space-y-2.5">
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-[82%] rounded" />
        </div>

        {/* featured tiles — ac-tile, 20px radius */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-[20px]" />
          ))}
        </div>
      </section>

      {/* ========================= THE FULL LIBRARY ======================= */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Skeleton className="h-4 w-52 rounded" />
            <Skeleton className="mt-2 h-9 w-64 rounded-xl sm:h-10" />
          </div>
          <Skeleton className="hidden h-5 w-28 rounded sm:block" />
        </div>

        {/*
         * "Jump to a desk" nav — page.tsx renders
         *   <nav className="mt-6 flex flex-wrap gap-2"> with one ac-chip per
         * desk. Each chip is `min-h-11` (44px) and the row gap is 8px, so the
         * chips are drawn at their real label widths inside the same
         * flex-wrap container: they then wrap to the same number of rows the
         * real nav does at every breakpoint (two rows at lg).
         */}
        <div className="mt-6 flex flex-wrap gap-2">
          {[138, 138, 233, 145, 196, 182, 153, 203, 240, 175].map((w, i) => (
            <Skeleton
              key={i}
              className="h-11 max-w-full rounded-full"
              style={{ width: `${w}px` }}
            />
          ))}
        </div>

        {/*
         * First desk group. page.tsx wraps the groups in
         *   <div className="mt-12 space-y-14"> and each group leads with a
         * header row: ac-badge h-11 w-11 (14px radius) beside a text-2xl
         * leading-tight title (30px) + mt-0.5 text-sm leading-snug blurb
         * (19px) = 51px, then the card grid at mt-6.
         */}
        <div className="mt-12">
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-11 w-11 shrink-0 rounded-[14px]" />
            <div className="min-w-0">
              <Skeleton className="h-[30px] w-56 max-w-full rounded-lg" />
              <Skeleton className="mt-0.5 h-[19px] w-80 max-w-full rounded" />
            </div>
            <Skeleton className="ml-auto h-4 w-20 shrink-0 rounded" />
          </div>

          {/* one desk group of article cards */}
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-[20px]" />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
