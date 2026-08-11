import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors src/app/settings/page.tsx exactly:
 *   hero     mx-auto grid max-w-6xl items-center gap-10 px-4 pb-10 pt-28
 *            sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pb-14
 *   panels   mx-auto max-w-3xl px-4 pb-24 sm:px-6, three `ac-card p-6 sm:p-7`
 *            sections separated by mt-6
 *
 * The three panels are drawn with their real `ac-card` chrome so the card
 * edges, radius and shadow do not change when content swaps in — only the
 * bars inside them are skeletons. The settings form is the one region across
 * these routes whose shape is entirely fixed (the same fields for every
 * user), so it is worth mirroring field-by-field rather than as one slab.
 *
 * The page's <Glow> blobs are `absolute inset-0 -z-10` and contribute no
 * layout, so — as in the dashboard reference — the outer
 * `relative overflow-x-clip` wrapper is omitted.
 */
export default function SettingsLoading() {
  return (
    <>
      {/* ============================ HERO ============================ */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-10 pt-28 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pb-14">
        <div>
          {/* "Your control panel" chip */}
          <Skeleton className="h-7 w-44 rounded-full" />
          {/* h1: text-4xl sm:text-5xl leading-[1.04], two lines */}
          <Skeleton className="mt-4 h-9 rounded-xl sm:h-[50px]" />
          <Skeleton className="mt-2 h-9 w-4/5 rounded-xl sm:h-[50px]" />
          {/* lead paragraph: max-w-xl text-lg leading-relaxed, three lines */}
          <div className="mt-4 max-w-xl space-y-2">
            <Skeleton className="h-6 rounded-md" />
            <Skeleton className="h-6 rounded-md" />
            <Skeleton className="h-6 w-2/3 rounded-md" />
          </div>
          {/* two CTAs (ac-btn / ac-btn-ghost, min-height 44) */}
          <div className="mt-7 flex flex-wrap gap-3">
            <Skeleton className="h-11 w-44 rounded-2xl" />
            <Skeleton className="h-11 w-44 rounded-2xl" />
          </div>
          {/* jump-link chips (min-h-11) */}
          <div className="mt-6 flex flex-wrap gap-2">
            <Skeleton className="h-11 w-28 rounded-full" />
            <Skeleton className="h-11 w-36 rounded-full" />
            <Skeleton className="h-11 w-28 rounded-full" />
          </div>
        </div>

        {/* identity card: ac-glass w-full max-w-md p-6 sm:p-7 lg:justify-self-end */}
        <Skeleton className="h-[400px] w-full max-w-md rounded-[28px] lg:justify-self-end" />
      </section>

      {/* ========================= CONTROL PANELS ===================== */}
      <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
        {/* ---------- Profile ---------- */}
        <section>
          <div className="ac-card p-6 sm:p-7">
            <PanelHeader />
            <div className="ac-divider my-6" />

            {/* live avatar preview strip */}
            <Skeleton className="h-24 rounded-2xl" />

            <div className="mt-5 space-y-5">
              {/* Email (read-only) */}
              <Field helperLines={1} />
              {/* Full name */}
              <Field helperLines={2} />
              {/* Username + FRC team number */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field helperLines={2} />
                <Field helperLines={2} />
              </div>
              {/* Role select */}
              <Field helperLines={0} />
              {/* Avatar image URL */}
              <Field helperLines={1} />
              {/* Bio textarea (min-h-28) */}
              <div>
                <Skeleton className="h-4 w-12 rounded-md" />
                <Skeleton className="mt-1.5 h-28 rounded-[14px]" />
                <Skeleton className="mt-1.5 h-3 w-2/3 rounded-md" />
              </div>
              {/* Save button (size lg → 52px tall) */}
              <div className="pt-1">
                <Skeleton className="h-[52px] w-full rounded-2xl sm:w-44" />
              </div>
            </div>

            {/* Danger zone */}
            <Skeleton className="mt-8 h-[164px] rounded-2xl" />
          </div>
        </section>

        {/* ---------- Performance ---------- */}
        <section className="mt-6">
          <div className="ac-card p-6 sm:p-7">
            <PanelHeader />
            <div className="ac-divider my-6" />
            <Skeleton className="h-[224px] rounded-[20px]" />
          </div>
        </section>

        {/* ---------- Account / sign out ---------- */}
        <section className="mt-6">
          <div className="ac-card p-6 sm:p-7">
            <PanelHeader />
            <div className="ac-divider my-6" />
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="w-full space-y-2">
                <Skeleton className="h-4 rounded-md" />
                <Skeleton className="h-4 w-3/4 rounded-md" />
              </div>
              <Skeleton className="h-11 w-32 shrink-0 rounded-2xl" />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

/** ac-badge (h-12, 14px radius) + section title + two-line description. */
function PanelHeader() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="h-12 w-12 shrink-0 rounded-[14px]" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-6 w-32 rounded-md" />
        <Skeleton className="mt-2 h-4 w-full max-w-sm rounded-md" />
        <Skeleton className="mt-1.5 h-4 w-2/3 max-w-xs rounded-md" />
      </div>
    </div>
  );
}

/** Label (text-sm + mb-1.5) + ac-input (44px tall, 14px radius) + helper. */
function Field({ helperLines }: { helperLines: 0 | 1 | 2 }) {
  return (
    <div>
      <Skeleton className="h-4 w-24 rounded-md" />
      <Skeleton className="mt-1.5 h-11 rounded-[14px]" />
      {helperLines > 0 && <Skeleton className="mt-1.5 h-3 w-3/4 rounded-md" />}
      {helperLines > 1 && <Skeleton className="mt-1.5 h-3 w-1/2 rounded-md" />}
    </div>
  );
}
