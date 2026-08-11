import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors src/app/bookmarks/page.tsx exactly:
 *   hero   mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-28
 *          sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:gap-12 lg:pb-16 lg:pt-32
 *   list   mx-auto max-w-4xl px-4 pb-12 sm:px-6 lg:px-8, with the reading
 *          rail's `mt-5 pl-5 sm:pl-6` inset and `flex flex-col gap-3` cards
 *
 * Tuned to the populated state — the state this page exists for, and the one
 * a returning member sees. See findings for the empty-shelf caveat.
 *
 * The page's <Glow> blobs are `absolute inset-0 -z-10` and contribute no
 * layout, so — as in the dashboard reference — the outer
 * `relative overflow-x-clip` wrapper is omitted.
 */
export default function BookmarksLoading() {
  return (
    <>
      {/* ============================ HERO ============================ */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-28 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:gap-12 lg:pb-16 lg:pt-32">
        <div>
          {/* "Your personal reading list" chip */}
          <Skeleton className="h-7 w-56 rounded-full" />
          {/* h1: text-4xl sm:text-5xl lg:text-[3.35rem] leading-[1.03] */}
          <Skeleton className="mt-4 h-9 rounded-xl sm:h-[50px] lg:h-[55px]" />
          <Skeleton className="mt-2 h-9 w-3/4 rounded-xl sm:h-[50px] lg:h-[55px]" />
          {/* lead paragraph: max-w-xl text-lg leading-relaxed, three lines */}
          <div className="mt-4 max-w-xl space-y-2">
            <Skeleton className="h-6 rounded-md" />
            <Skeleton className="h-6 rounded-md" />
            <Skeleton className="h-6 w-2/3 rounded-md" />
          </div>
          {/* two CTAs (ac-btn / ac-btn-ghost, min-height 44) */}
          <div className="mt-7 flex flex-wrap gap-3">
            <Skeleton className="h-11 w-52 rounded-2xl" />
            <Skeleton className="h-11 w-48 rounded-2xl" />
          </div>
          {/* saved / departments / read-time counters */}
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            <Skeleton className="h-5 w-20 rounded-md" />
            <Skeleton className="h-5 w-28 rounded-md" />
            <Skeleton className="h-5 w-32 rounded-md" />
          </div>
        </div>

        {/* shelf panel: ac-glass w-full max-w-md p-6 sm:p-7 lg:justify-self-end */}
        <Skeleton className="h-[380px] w-full max-w-md rounded-[28px] lg:justify-self-end" />
      </section>

      {/* ============================ SHELF ============================ */}
      <section className="mx-auto max-w-4xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="mt-2 h-8 w-56 rounded-lg" />
          </div>
          <Skeleton className="h-4 w-24 shrink-0 rounded-md" />
        </div>

        {/* the reading rail — same pl inset as the real list */}
        <div className="mt-5 pl-5 sm:pl-6">
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-[20px]" />
            ))}
          </div>
        </div>

        {/* "Room for more on the shelf" card */}
        <Skeleton className="mt-10 h-[116px] rounded-[20px]" />
      </section>
    </>
  );
}
