import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading UI for /leaderboard.
 *
 * Geometry is copied from page.tsx, not approximated: the hero is the same
 * `max-w-7xl` two-column grid with the same padding, the board sits in the same
 * `max-w-5xl` column, and the tab control / podium / ranked rows reuse the exact
 * container classes from leaderboard-tabs.tsx and podium.tsx. A skeleton that
 * doesn't line up with the real page is worse than none — it turns the content
 * swap into a visible jump.
 *
 * DELIBERATELY NOT DRAWN: the referral InviteCard that sits at the top of the
 * board column. It renders only for signed-in users with a username, and the
 * fallback cannot know who is asking. Drawing it would invent a ~180px card for
 * every signed-out visitor; omitting it means signed-in visitors see the board
 * header settle downward by that much, below the fold on a laptop. Omission is
 * the smaller error.
 *
 * Also stops after six ranked rows (the real board carries up to 47) and before
 * the closing CTA. Content growing in below the skeleton is not a jump; only
 * skeleton blocks that land in the wrong place are.
 */
export default function LeaderboardLoading() {
  return (
    <div className="relative overflow-x-clip">
      {/* ============================ HERO ============================ */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-12 pt-28 sm:px-6 lg:grid-cols-2 lg:gap-10 lg:pb-16 lg:pt-32 lg:px-8">
        <div>
          {/* ac-chip eyebrow */}
          <Skeleton className="h-7 w-44 rounded-full" />

          {/* h1 — text-4xl / sm:text-5xl / lg:text-[3.4rem], leading-[1.02] */}
          <div className="mt-5 space-y-1.5">
            <Skeleton className="h-9 w-full sm:h-12 lg:h-14" />
            <Skeleton className="h-9 w-11/12 sm:h-12 lg:h-14" />
            <Skeleton className="h-9 w-3/5 sm:h-12 lg:h-14" />
          </div>

          {/* lede — max-w-xl text-lg leading-relaxed */}
          <div className="mt-5 max-w-xl space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>

          {/* ac-btn row (min-height 44px, 16px radius) */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Skeleton className="h-11 w-40 rounded-2xl" />
            <Skeleton className="h-11 w-48 rounded-2xl" />
          </div>

          {/* stat tiles — two square tiles + the full-width weekly-reset tile */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Skeleton className="h-[66px] rounded-[20px]" />
            <Skeleton className="h-[66px] rounded-[20px]" />
            <Skeleton className="col-span-2 h-11 rounded-[20px] sm:col-span-1 sm:h-[66px]" />
          </div>
        </div>

        {/* SIGNATURE: the champion panel — same glass shell, same inner rhythm */}
        <div className="ac-glass w-full max-w-md p-6 sm:p-7 lg:justify-self-end">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-14" />
          </div>

          <div className="mt-5 flex items-center gap-4">
            <Skeleton className="h-16 w-16 shrink-0 rounded-2xl sm:h-[4.5rem] sm:w-[4.5rem]" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-6 w-40 max-w-full" />
              <Skeleton className="mt-1.5 h-4 w-32 max-w-full" />
              <Skeleton className="mt-2 h-7 w-28" />
            </div>
          </div>

          {/* the two runner-up XP meters */}
          <div className="mt-5 space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <Skeleton className="h-5 w-36 max-w-full" />
                  <Skeleton className="h-4 w-16 shrink-0" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        </div>
      </section>

      {/* =========================== BOARD =========================== */}
      <div className="mx-auto max-w-5xl px-4 pb-24 sm:px-6 lg:px-8">
        {/* "The full board" section header */}
        <div className="mt-14 text-center">
          <Skeleton className="mx-auto h-4 w-36" />
          <Skeleton className="mx-auto mt-2 h-9 w-72 max-w-full" />
          <div className="mt-1 space-y-2">
            <Skeleton className="mx-auto h-4 w-full max-w-lg" />
            <Skeleton className="mx-auto h-4 w-2/3 max-w-sm" />
          </div>
        </div>

        {/* Segmented tab control — Weekly / All-Time / By Team */}
        <div className="ac-glass mx-auto mt-10 flex w-full max-w-md items-center gap-1 rounded-2xl p-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-11 flex-1 rounded-xl" />
          ))}
        </div>

        {/* the weekly-tab explainer under the control */}
        <div className="mt-3 space-y-1.5">
          <Skeleton className="mx-auto h-4 w-full max-w-xl" />
          <Skeleton className="mx-auto h-4 w-1/2 max-w-[15rem] sm:hidden" />
        </div>

        {/* Podium — rank 1 centred and lifted at sm, exactly as RANK_STYLE does */}
        <section className="mt-12 sm:mt-14">
          <div className="mx-auto grid max-w-3xl grid-cols-1 items-end gap-4 sm:grid-cols-3 sm:gap-5">
            <PodiumColumn champion className="order-first sm:order-2 sm:-translate-y-4" />
            <PodiumColumn className="order-2 sm:order-1" />
            <PodiumColumn className="order-3" />
          </div>
        </section>

        {/* Ranked rows (rank 4+) */}
        <div className="ac-card mt-12 overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <Skeleton className="h-6 w-52 max-w-full" />
          </div>

          {/* column header — mirrors ROW_COLS widths */}
          <div className="hidden items-center gap-3 border-b border-border px-4 py-2.5 sm:flex sm:gap-4 sm:px-5">
            <div className="w-7 shrink-0 sm:w-9">
              <Skeleton className="h-3.5 w-full" />
            </div>
            <div className="w-10 shrink-0" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3.5 w-16" />
            </div>
            <div className="hidden w-[4.5rem] shrink-0 justify-center sm:flex">
              <Skeleton className="h-3.5 w-10" />
            </div>
            <div className="hidden w-20 shrink-0 md:block">
              <Skeleton className="ml-auto h-3.5 w-14" />
            </div>
            <div className="w-16 shrink-0 sm:w-24">
              <Skeleton className="ml-auto h-3.5 w-8" />
            </div>
          </div>

          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5"
              >
                <div className="w-7 shrink-0 sm:w-9">
                  <Skeleton className="mx-auto h-5 w-5" />
                </div>
                <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-5 w-40 max-w-full" />
                  <Skeleton className="mt-1.5 h-3.5 w-28 max-w-full" />
                </div>
                <div className="hidden w-[4.5rem] shrink-0 justify-center sm:flex">
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <div className="hidden w-20 shrink-0 md:block">
                  <Skeleton className="ml-auto h-4 w-14" />
                </div>
                <div className="w-16 shrink-0 sm:w-24">
                  <Skeleton className="ml-auto h-5 w-12" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * One podium plinth. Padding, avatar sizes and the crown slot are lifted
 * straight from PodiumColumn so the card lands at the same height (~291px, or
 * ~339px for the champion, growing at the sm breakpoint the same way).
 */
function PodiumColumn({
  champion = false,
  className,
}: {
  champion?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full flex-col", className)}>
      <div
        className={cn(
          "ac-card px-5 pb-6 pt-7 text-center",
          champion && "sm:px-6 sm:pb-8 sm:pt-9"
        )}
      >
        {champion && <Skeleton className="mx-auto mb-2 h-6 w-6 rounded-md" />}
        <Skeleton
          className={cn(
            "mx-auto rounded-[0.9rem]",
            champion ? "h-20 w-20 sm:h-24 sm:w-24" : "h-16 w-16 sm:h-20 sm:w-20"
          )}
        />
        <Skeleton className="mx-auto mt-6 h-6 w-32 max-w-full" />
        <Skeleton className="mx-auto mt-1.5 h-5 w-24 max-w-full" />
        <Skeleton className="mx-auto mt-5 h-8 w-24" />
        <div className="mt-5 border-t border-border pt-3">
          <Skeleton className="mx-auto h-4 w-28 max-w-full" />
        </div>
      </div>
    </div>
  );
}
