import { Skeleton } from "@/components/ui/skeleton";

/**
 * Module hub skeleton.
 *
 * Mirrors page.tsx:
 *   hero    → mx-auto max-w-5xl px-4 pb-6 pt-28 sm:px-6 lg:px-8 lg:pt-32
 *   lessons → mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8, list is space-y-3
 * Note this route is max-w-5xl, narrower than the department hub above it and
 * the lesson page below it — copying max-w-6xl here would shift the whole page.
 */
export default function ModuleLoading() {
  return (
    <div className="relative overflow-x-clip">
      {/* ============================ HERO ============================ */}
      <section className="mx-auto max-w-5xl px-4 pb-6 pt-28 sm:px-6 lg:px-8 lg:pt-32">
        {/* breadcrumb: Guides › Dept › Module (-my-2 + min-h-11 → ~28px) */}
        <div className="-my-2 flex flex-wrap items-center gap-1.5 py-2">
          <Skeleton className="h-5 w-14 rounded" />
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <Skeleton className="h-5 w-28 rounded" />
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <Skeleton className="h-5 w-40 rounded" />
        </div>

        <div className="mt-6">
          {/* dept pill + "Module N of M" chip */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Skeleton className="h-9 w-44 rounded-full" />
            <Skeleton className="h-7 w-40 rounded-full" />
          </div>

          {/* h1 — text-3xl / sm:text-4xl / lg:text-[2.9rem] */}
          <Skeleton className="mt-5 h-9 w-[82%] rounded-xl sm:h-11 lg:h-12" />

          {/* overview — mt-4 max-w-2xl text-lg */}
          <div className="mt-4 max-w-2xl space-y-2.5">
            <Skeleton className="h-5 w-full rounded" />
            <Skeleton className="h-5 w-[94%] rounded" />
            <Skeleton className="h-5 w-[62%] rounded" />
          </div>

          {/* "how this module fits" — mt-3 max-w-2xl */}
          <div className="mt-3 max-w-2xl space-y-2.5">
            <Skeleton className="h-4 w-[97%] rounded" />
            <Skeleton className="h-4 w-[70%] rounded" />
          </div>

          {/* lessons / minutes / dept-total chips */}
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="h-8 w-48 rounded-full" />
          </div>

          {/* CTA row */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Skeleton className="h-11 w-48 rounded-2xl" />
            <Skeleton className="h-11 w-44 rounded-2xl" />
          </div>
        </div>
      </section>

      {/* ========================== THE LESSONS ========================== */}
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
            <div>
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="mt-1.5 h-7 w-32 rounded-lg" />
            </div>
          </div>
        </div>

        {/* lesson rows — ac-card p-5, badge + title + summary + read time */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[124px] rounded-[20px]" />
          ))}
        </div>

        {/* prev / next module */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-[88px] rounded-[20px]" />
          <Skeleton className="h-[88px] rounded-[20px]" />
        </div>
      </section>

      {/* related modules / articles strips below the fold */}
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <Skeleton className="h-56 rounded-[20px]" />
      </section>
    </div>
  );
}
