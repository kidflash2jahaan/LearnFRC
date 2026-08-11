import { Skeleton } from "@/components/ui/skeleton";

/**
 * Article reading skeleton.
 *
 * Mirrors page.tsx:
 *   root   → <article className="relative overflow-x-clip text-foreground">
 *   header → mx-auto max-w-3xl px-4 pb-8 pt-28 sm:px-6 lg:px-8
 *   body   → mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 pt-8 sm:px-6 lg:px-8
 *            xl:grid-cols-[minmax(0,1fr)_16rem]
 * The TOC rail only becomes a column at xl, and the body itself is a centred
 * max-w-3xl block below that — both are reproduced so the prose column does not
 * move when the article swaps in.
 */
export default function ArticleLoading() {
  return (
    <article className="relative overflow-x-clip text-foreground">
      {/* ============================ HERO ============================ */}
      <header className="mx-auto max-w-3xl px-4 pb-8 pt-28 sm:px-6 lg:px-8">
        {/* "Back to all articles" (-my-2 + min-h-11 → ~28px box) */}
        <Skeleton className="h-7 w-48 rounded-full" />

        {/* article chip + read time + date */}
        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <Skeleton className="h-7 w-32 rounded-full" />
          <Skeleton className="h-5 w-28 rounded" />
          <Skeleton className="h-5 w-36 rounded" />
        </div>

        {/* h1 — text-3xl / sm:text-4xl / md:text-5xl, leading-[1.08] */}
        <Skeleton className="mt-5 h-9 w-[92%] rounded-xl sm:h-11 md:h-12" />
        <Skeleton className="mt-2.5 h-9 w-[64%] rounded-xl sm:h-11 md:h-12" />

        {/* description — mt-5 max-w-2xl text-lg */}
        <div className="mt-5 max-w-2xl space-y-2.5">
          <Skeleton className="h-5 w-full rounded" />
          <Skeleton className="h-5 w-[86%] rounded" />
        </div>

        {/* CTA row */}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Skeleton className="h-11 w-52 rounded-2xl" />
          <Skeleton className="h-11 w-28 rounded-2xl" />
        </div>

        {/* three stat cards — mt-8 grid grid-cols-3 gap-3, ac-card rounded-2xl */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[86px] rounded-2xl" />
          ))}
        </div>
      </header>

      {/* the ac-divider between hero and body */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-px w-full rounded-none" />
      </div>

      {/* ===================== BODY + READING RAIL ==================== */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 pt-8 sm:px-6 lg:px-8 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="mx-auto w-full max-w-3xl xl:mx-0">
          <div className="space-y-3.5">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-[96%] rounded" />
            <Skeleton className="h-4 w-[99%] rounded" />
            <Skeleton className="h-4 w-[68%] rounded" />
          </div>

          <Skeleton className="mt-9 h-7 w-[58%] rounded-lg" />
          <div className="mt-4 space-y-3.5">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-[93%] rounded" />
            <Skeleton className="h-4 w-[97%] rounded" />
            <Skeleton className="h-4 w-[60%] rounded" />
          </div>

          <Skeleton className="mt-6 h-36 rounded-[20px]" />

          <Skeleton className="mt-9 h-7 w-[46%] rounded-lg" />
          <div className="mt-4 space-y-3.5">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-[90%] rounded" />
            <Skeleton className="h-4 w-[95%] rounded" />
            <Skeleton className="h-4 w-[52%] rounded" />
          </div>

          {/* provenance / references block */}
          <Skeleton className="mt-10 h-48 rounded-[20px]" />
        </div>

        {/* sticky TOC rail — only a column at xl, same as the page */}
        <aside className="xl:order-none">
          <Skeleton className="hidden h-[360px] rounded-[20px] xl:block" />
        </aside>
      </div>

      {/* ========================= KEEP READING ======================== */}
      <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 lg:px-8">
        <Skeleton className="h-4 w-40 rounded" />
        <Skeleton className="mt-2 h-9 w-72 max-w-full rounded-xl sm:h-10" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-[20px]" />
          ))}
        </div>
      </section>
    </article>
  );
}
