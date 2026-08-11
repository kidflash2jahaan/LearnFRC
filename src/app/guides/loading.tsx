import { Skeleton } from "@/components/ui/skeleton";

/**
 * /guides is the one route in this group that is genuinely dynamic: it calls
 * getSession() (cookies) and, for a signed-in reader, two more Supabase reads
 * for the per-department progress rings. That is real per-request latency, so
 * the fallback here is the one most likely to actually be seen.
 *
 * Mirrors page.tsx:
 *   hero → mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-28
 *          sm:px-6 lg:grid-cols-2 lg:gap-10 lg:pb-20 lg:pt-36 lg:px-8
 *   grid → mx-auto max-w-7xl px-4 py-14 … mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3
 */
export default function GuidesLoading() {
  return (
    <div className="relative overflow-x-clip">
      {/* ============================ HERO ============================ */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-28 sm:px-6 lg:grid-cols-2 lg:gap-10 lg:pb-20 lg:pt-36 lg:px-8">
        <div>
          {/* eyebrow chip */}
          <Skeleton className="h-7 w-52 rounded-full" />

          {/* h1 — text-4xl / sm:text-5xl / lg:text-[3.4rem], leading-[1.02] */}
          <Skeleton className="mt-5 h-10 w-[94%] rounded-xl sm:h-12 lg:h-14" />
          <Skeleton className="mt-2.5 h-10 w-[76%] rounded-xl sm:h-12 lg:h-14" />

          {/* lead paragraph — mt-5 max-w-xl text-lg */}
          <div className="mt-5 max-w-xl space-y-2.5">
            <Skeleton className="h-5 w-full rounded" />
            <Skeleton className="h-5 w-[96%] rounded" />
            <Skeleton className="h-5 w-[92%] rounded" />
            <Skeleton className="h-5 w-[60%] rounded" />
          </div>

          {/* CTA row — ac-btn min-height 44px */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Skeleton className="h-11 w-52 rounded-2xl" />
            <Skeleton className="h-11 w-48 rounded-2xl" />
          </div>

          {/* departments / modules / lessons counters */}
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            <Skeleton className="h-5 w-32 rounded" />
            <Skeleton className="h-5 w-28 rounded" />
            <Skeleton className="h-5 w-24 rounded" />
          </div>
        </div>

        {/* the pit-row glass panel — ac-glass w-full max-w-md lg:justify-self-end */}
        <Skeleton className="h-[520px] w-full max-w-md rounded-[28px] lg:justify-self-end" />
      </section>

      {/* ========================= THE FULL WALK ========================= */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <Skeleton className="h-5 w-48 rounded-full" />
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <Skeleton className="h-9 w-[22rem] max-w-full rounded-xl sm:h-10" />
          <Skeleton className="h-8 w-56 rounded-full" />
        </div>

        {/* 11 department tiles — ac-tile, 20px radius */}
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 11 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-[20px]" />
          ))}
        </div>
      </section>

      {/* ========================== CLOSING CTA ========================== */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Skeleton className="h-80 rounded-[28px]" />
      </section>
    </div>
  );
}
