import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading UI for /u/[username].
 *
 * This is the slowest page on the site and the one where a fallback matters
 * most: it is `force-dynamic` and runs three sequential admin queries (profile,
 * lesson count, achievements) before anything can render, and a stranger
 * arriving from a shared link has no prior page to look at.
 *
 * Container classes are copied verbatim from page.tsx — the `lg:grid-cols-[1fr_360px]`
 * hero, the `max-w-6xl` column with its `pt-28 lg:pt-36`, the stat ribbon's
 * `grid-cols-2 sm:grid-cols-4`, and the medal wall's `pb-12 pt-10`.
 *
 * TWO JUDGEMENT CALLS, both settled against the live data rather than guessed:
 *  • No bio block. `bio` is optional and only 6 of 338 profiles have one, so
 *    drawing it would invent a paragraph for 98% of visits.
 *  • Two medal cards. Badges average 1.5 per profile; 44% of profiles have none
 *    and get a single dashed empty card instead. Two cards is one grid row at
 *    sm — the closest single shape to both, and it sits at/below the fold.
 */
export default function PublicProfileLoading() {
  return (
    <div className="relative overflow-x-clip">
      {/* ============================ HERO ============================ */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-28 sm:px-6 lg:grid-cols-[1fr_360px] lg:gap-12 lg:pb-20 lg:pt-36 lg:px-8">
        <div>
          {/* ac-chip "Learner trophy card" */}
          <Skeleton className="h-7 w-52 rounded-full" />

          {/* h1 — @username, always one line */}
          <Skeleton className="mt-5 h-10 w-64 max-w-full sm:h-12 sm:w-80" />

          {/* role / team / joined badge row (px-2.5 py-0.5 pills) */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>

          {/* share button — min-h-[44px] rounded-2xl */}
          <Skeleton className="mt-7 h-11 w-44 rounded-2xl" />
        </div>

        {/* SIGNATURE: the trophy panel — level ring, tier pill, XP rail */}
        <div className="ac-glass w-full max-w-sm overflow-hidden p-6 sm:p-7 lg:justify-self-end">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-14" />
          </div>

          <div className="mt-6 flex flex-col items-center">
            {/* the 176px level ring with the avatar inside it */}
            <Skeleton className="h-44 w-44 rounded-full" />
            {/* tier pill */}
            <Skeleton className="mt-5 h-7 w-32 rounded-full" />
          </div>

          <div className="mt-6">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
        </div>
      </section>

      {/* ================== Stat ribbon — clay tiles ================== */}
      <section className="mx-auto max-w-6xl px-4 pb-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="ac-tile flex h-full flex-col items-center rounded-3xl p-5 text-center"
            >
              <Skeleton className="h-11 w-11 rounded-2xl" />
              <Skeleton className="mt-3 h-9 w-16" />
              <Skeleton className="mt-1.5 h-3 w-20" />
            </div>
          ))}
        </div>
      </section>

      {/* ================= Medal wall — achievements ================= */}
      <section className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-8 w-44" />
          </div>
          <Skeleton className="h-6 w-24 shrink-0 rounded-full" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="ac-card flex items-center gap-4 rounded-3xl p-5">
              <Skeleton className="h-12 w-12 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-5 w-40 max-w-full" />
                <Skeleton className="mt-1.5 h-4 w-56 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
