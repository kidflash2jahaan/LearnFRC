import { Skeleton } from "@/components/ui/skeleton";

/**
 * Glossary term skeleton.
 *
 * Mirrors page.tsx:
 *   root    → <div className="relative overflow-x-clip text-foreground">
 *   header  → mx-auto max-w-3xl px-4 pb-8 pt-28 sm:px-6 lg:px-8
 *   "in a match" and "where you'll see this" stay max-w-3xl; the related-terms
 *   strip widens to max-w-6xl with a 2/4-column grid, which is reproduced below.
 */
export default function GlossaryTermLoading() {
  return (
    <div className="relative overflow-x-clip text-foreground">
      {/* ============================ HERO ============================ */}
      <header className="mx-auto max-w-3xl px-4 pb-8 pt-28 sm:px-6 lg:px-8">
        {/* breadcrumb: Home › Glossary › Term */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Skeleton className="h-5 w-12 rounded" />
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <Skeleton className="h-5 w-20 rounded" />
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <Skeleton className="h-5 w-28 rounded" />
        </div>

        {/* badge + category + abbreviation */}
        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <Skeleton className="h-10 w-10 shrink-0 rounded-[14px]" />
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-6 w-16 rounded-lg" />
        </div>

        {/* h1 — text-4xl / sm:text-5xl, leading-[1.05] */}
        <Skeleton className="mt-4 h-11 w-[62%] rounded-xl sm:h-12" />

        {/* definition — mt-5 max-w-2xl text-lg */}
        <div className="mt-5 max-w-2xl space-y-2.5">
          <Skeleton className="h-5 w-full rounded" />
          <Skeleton className="h-5 w-[94%] rounded" />
          <Skeleton className="h-5 w-[70%] rounded" />
        </div>

        {/* "also called" row */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>

        {/* CTA row */}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Skeleton className="h-11 w-52 rounded-2xl" />
          <Skeleton className="h-11 w-40 rounded-2xl" />
        </div>
      </header>

      {/* ========================== IN A MATCH ========================== */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-56 rounded-[20px]" />
      </section>

      {/* the ac-divider */}
      <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6 lg:px-8">
        <Skeleton className="h-px w-full rounded-none" />
      </div>

      {/* ==================== WHERE YOU'LL SEE THIS ==================== */}
      <section className="mx-auto max-w-3xl px-4 pt-10 sm:px-6 lg:px-8">
        <Skeleton className="h-4 w-44 rounded" />
        <Skeleton className="mt-2 h-8 w-72 max-w-full rounded-lg" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-[20px]" />
          ))}
        </div>
      </section>

      {/* ======================== RELATED TERMS ======================== */}
      <section className="mx-auto max-w-6xl px-4 pt-14 sm:px-6 lg:px-8">
        <Skeleton className="h-4 w-36 rounded" />
        <Skeleton className="mt-2 h-8 w-64 max-w-full rounded-lg" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-[20px]" />
          ))}
        </div>
      </section>

      {/* closing CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 lg:px-8">
        <Skeleton className="h-64 rounded-[28px]" />
      </section>
    </div>
  );
}
