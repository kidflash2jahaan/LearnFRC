import { Skeleton } from "@/components/ui/skeleton";

/**
 * Department hub skeleton.
 *
 * Mirrors page.tsx:
 *   hero     → mx-auto max-w-6xl px-4 pb-8 pt-28 sm:px-6 lg:px-8 lg:pt-32
 *   hero row → mt-6 grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14
 *   stats    → mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4
 *   body     → mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-8 sm:px-6
 *              lg:grid-cols-3 lg:gap-12 lg:px-8 lg:py-12   (main = lg:col-span-2)
 */
export default function DepartmentLoading() {
  return (
    <div className="relative overflow-x-clip">
      {/* ============================ HERO ============================ */}
      <section className="mx-auto max-w-6xl px-4 pb-8 pt-28 sm:px-6 lg:px-8 lg:pt-32">
        {/* "All departments" back link (-my-2 + min-h-11 → ~28px box) */}
        <Skeleton className="h-7 w-40 rounded-full" />

        <div className="mt-6 grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
          <div>
            {/* department badge + "Department curriculum" chip */}
            <div className="flex items-center gap-3">
              <Skeleton className="h-14 w-14 shrink-0 rounded-[14px]" />
              <Skeleton className="h-7 w-56 rounded-full" />
            </div>

            {/* h1 — text-4xl / sm:text-5xl / lg:text-[3.3rem] */}
            <Skeleton className="mt-5 h-10 w-[70%] rounded-xl sm:h-12 lg:h-14" />

            {/* tagline — mt-4 max-w-2xl text-xl */}
            <div className="mt-4 max-w-2xl space-y-2.5">
              <Skeleton className="h-6 w-[92%] rounded" />
              <Skeleton className="h-6 w-[54%] rounded" />
            </div>

            {/* description — mt-3 max-w-2xl text-lg */}
            <div className="mt-3 max-w-2xl space-y-2.5">
              <Skeleton className="h-5 w-full rounded" />
              <Skeleton className="h-5 w-[95%] rounded" />
              <Skeleton className="h-5 w-[68%] rounded" />
            </div>

            {/* modules / lessons / hours chips */}
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Skeleton className="h-8 w-32 rounded-full" />
              <Skeleton className="h-8 w-32 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
            </div>

            {/* hero CTA row */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Skeleton className="h-11 w-48 rounded-2xl" />
              <Skeleton className="h-11 w-40 rounded-2xl" />
            </div>
          </div>

          {/* mastery ring panel — ac-glass w-full max-w-sm lg:justify-self-end */}
          <Skeleton className="h-[352px] w-full max-w-sm rounded-[28px] lg:justify-self-end" />
        </div>

        {/* journey stat strip — four ac-card tiles */}
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-[20px]" />
          ))}
        </div>
      </section>

      {/* ========================= THE CURRICULUM ======================== */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:gap-12 lg:px-8 lg:py-12">
        {/* main: the module path */}
        <div className="min-w-0 lg:col-span-2">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
              <div>
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="mt-1.5 h-7 w-52 rounded-lg" />
              </div>
            </div>
            <Skeleton className="hidden h-5 w-40 rounded sm:block" />
          </div>

          {/* collapsed module accordion rows — rounded-[20px] p-5, space-y-4 */}
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] rounded-[20px]" />
            ))}
          </div>

          {/* "know something this department is missing?" row */}
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-6">
            <Skeleton className="h-5 w-72 max-w-full rounded" />
          </div>
        </div>

        {/* sidebar: the field guide — ac-card stack, space-y-5 */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-5">
            <Skeleton className="h-64 rounded-[20px]" />
            <Skeleton className="h-44 rounded-[20px]" />
            <Skeleton className="h-52 rounded-[20px]" />
          </div>
        </aside>
      </div>
    </div>
  );
}
