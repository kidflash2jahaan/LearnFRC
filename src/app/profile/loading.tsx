import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors src/app/profile/page.tsx exactly:
 *   container      mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-6 lg:px-8
 *   hero grid      mt-5 grid items-start gap-6 lg:grid-cols-[1.15fr_0.85fr]
 *   stat shelf     mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4
 *   achievements   mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3
 *
 * The page's <Glow> blobs are `absolute inset-0 -z-10` and contribute no
 * layout, so — as in the dashboard reference — the outer
 * `relative overflow-x-clip` wrapper is omitted and the inner container is
 * rendered directly. Radii track the real skins: ac-glass 28px, ac-card and
 * ac-tile 20px, ac-badge 14px.
 */
export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-6 lg:px-8">
      {/* "Your pit crew profile" chip */}
      <Skeleton className="h-7 w-52 rounded-full" />

      {/* HERO — ID card (ac-glass) + season progress / quick actions column */}
      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Stacks avatar-over-details below sm, so it is taller on mobile. */}
        <Skeleton className="h-[420px] rounded-[28px] sm:h-[344px]" />
        <div className="flex flex-col gap-6">
          {/* season progress: eyebrow + 96px ring row inside ac-card p-6 */}
          <Skeleton className="h-44 rounded-[20px]" />
          {/* quick actions: eyebrow + two 44px rows inside ac-card p-5 */}
          <Skeleton className="h-52 rounded-[20px]" />
        </div>
      </div>

      {/* STAT SHELF — four ac-tile p-5 blocks */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-[20px]" />
        ))}
      </div>

      {/* ACHIEVEMENTS heading row */}
      <div className="mt-14 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skeleton className="h-4 w-56 rounded-md" />
          <Skeleton className="mt-2 h-8 w-44 rounded-lg" />
        </div>
        <Skeleton className="h-7 w-32 shrink-0 rounded-full" />
      </div>

      {/* ACHIEVEMENTS grid — ac-card p-5, badge + title + two-line description */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-[20px]" />
        ))}
      </div>
    </div>
  );
}
