import { Skeleton } from "@/components/ui/skeleton";

/**
 * Lesson reading skeleton.
 *
 * Mirrors page.tsx exactly where it counts:
 *   container  → relative mx-auto max-w-6xl px-4 pt-28 pb-20 sm:px-6 lg:px-8
 *   body grid  → mt-10 grid gap-10 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-12
 * The 300px reading rail is `hidden lg:block` on the real page, so it is hidden
 * here too — otherwise the mobile layout would shift by a full column when the
 * content swaps in.
 *
 * Radii are the ac-* skin values (ac-glass 28px, ac-card/ac-tile 20px,
 * ac-badge 14px, ac-chip 999px) so the corners do not visibly change either.
 */
export default function LessonLoading() {
  return (
    <div className="relative overflow-x-clip">
      <div className="relative mx-auto max-w-6xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
        {/* breadcrumb: Guides › Dept › Module › Lesson */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Skeleton className="h-5 w-14 rounded" />
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <Skeleton className="h-5 w-28 rounded" />
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <Skeleton className="h-5 w-36 rounded" />
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <Skeleton className="h-5 w-44 rounded" />
        </div>

        {/* ============================ HERO ============================ */}
        <header className="mt-6">
          {/* dept pill (h-7 badge + py-1 → 36px), read-time chip, status chip */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Skeleton className="h-9 w-44 rounded-full" />
            <Skeleton className="h-7 w-32 rounded-full" />
            <Skeleton className="h-7 w-28 rounded-full" />
          </div>

          {/* h1 — text-3xl / sm:text-4xl / lg:text-[2.9rem], leading-[1.06] */}
          <Skeleton className="mt-5 h-9 w-[88%] rounded-xl sm:h-11 lg:h-12" />
          <Skeleton className="mt-2 h-9 w-[58%] rounded-xl sm:h-11 lg:h-12" />

          {/* summary — mt-4 max-w-2xl text-lg */}
          <div className="mt-4 max-w-2xl space-y-2.5">
            <Skeleton className="h-5 w-full rounded" />
            <Skeleton className="h-5 w-[92%] rounded" />
          </div>

          {/* control deck — mt-7, ac-glass rounded-[28px] p-5 sm:p-6 */}
          <div className="mt-7">
            <Skeleton className="h-[132px] rounded-[28px] sm:h-[124px]" />
          </div>
        </header>

        {/* ===================== BODY: rail + article ==================== */}
        <div className="mt-10 grid gap-10 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-12">
          {/* sticky contents/progress rail — desktop only, same as the page */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <Skeleton className="h-[430px] rounded-[20px]" />
            </div>
          </aside>

          {/* article prose */}
          <div className="min-w-0">
            <div className="space-y-3.5">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-[97%] rounded" />
              <Skeleton className="h-4 w-[93%] rounded" />
              <Skeleton className="h-4 w-[99%] rounded" />
              <Skeleton className="h-4 w-[72%] rounded" />
            </div>

            {/* h2 + paragraph block */}
            <Skeleton className="mt-9 h-7 w-[56%] rounded-lg" />
            <div className="mt-4 space-y-3.5">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-[95%] rounded" />
              <Skeleton className="h-4 w-[98%] rounded" />
              <Skeleton className="h-4 w-[64%] rounded" />
            </div>

            {/* a code/callout block, which most lessons carry */}
            <Skeleton className="mt-6 h-40 rounded-[20px]" />

            <Skeleton className="mt-9 h-7 w-[48%] rounded-lg" />
            <div className="mt-4 space-y-3.5">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-[91%] rounded" />
              <Skeleton className="h-4 w-[96%] rounded" />
              <Skeleton className="h-4 w-[55%] rounded" />
            </div>

            {/* key takeaways — ac-card mt-10 p-6 */}
            <Skeleton className="mt-10 h-56 rounded-[20px]" />

            {/* next-step continuation block */}
            <Skeleton className="mt-10 h-64 rounded-[20px]" />

            {/* prev / next — mt-10 grid gap-4 sm:grid-cols-2 */}
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-[88px] rounded-[20px]" />
              <Skeleton className="h-[88px] rounded-[20px]" />
            </div>

            {/* collapsed "all lessons in this department" details */}
            <Skeleton className="mt-10 h-[76px] rounded-[20px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
