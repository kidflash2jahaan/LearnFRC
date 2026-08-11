import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback for /tools/frc-deflection-calculator.
 *
 * The page is dynamic — it awaits getSession() (cookies + a Supabase auth
 * round-trip) — so it is not prerendered and navigation blocks until that
 * resolves.
 *
 * Containers copied from the real page, not approximated:
 *   page.tsx  <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6 lg:px-8 lg:pt-32">
 *   _calculator.tsx  <div className="ac-card rounded-2xl p-5 sm:p-6">
 *   header  <header className="mb-6">  ·  body  grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]
 *   both columns  <div className="rounded-2xl border border-border bg-white/60 p-5">
 *   notes   <details className="mt-6 rounded-2xl border border-border bg-white/50 p-4">  (collapsed)
 * Rendered as a <div> rather than <main> so the fallback does not add a second
 * <main> landmark under the root layout's.
 */
export default function DeflectionCalculatorLoading() {
  return (
    <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6 lg:px-8 lg:pt-32">
      <div className="ac-card rounded-2xl p-5 sm:p-6">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="mb-6">
          <span className="ac-chip inline-flex items-center gap-2">
            <Skeleton className="h-4 w-24 rounded" />
          </span>
          <Skeleton className="mt-3 h-8 w-full max-w-md rounded-lg sm:h-9" />
          <Skeleton className="mt-1 h-8 w-2/3 rounded-lg sm:hidden" />
          <div className="mt-2 max-w-2xl space-y-1.5">
            <Skeleton className="h-3.5 rounded" />
            <Skeleton className="h-3.5 rounded" />
            <Skeleton className="h-3.5 w-11/12 rounded sm:w-3/4" />
            <Skeleton className="h-3.5 w-5/6 rounded sm:hidden" />
            <Skeleton className="h-3.5 w-1/2 rounded sm:hidden" />
          </div>
          <div className="mt-2 max-w-2xl space-y-1.5">
            <Skeleton className="h-3 rounded" />
            <Skeleton className="h-3 w-4/5 rounded" />
          </div>
        </div>

        {/* ── Body grid ──────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* INPUTS
           *
           * First paint is 6061 aluminium (so the custom-E block is absent),
           * cantilever + point load, and the 1×1 tube section — which selects
           * the three-Field tube branch (b / h / wall), not the two-Field
           * round/solid branches. That is 10 controls, but 8 of them sit in
           * `grid gap-4 sm:grid-cols-2` pairs, so above sm the column is 13
           * vertical rows, not a flat stack. Controls are px-3 py-2 text-sm
           * + 1px border → 38px; Field = 20px label + mt-1 + control + mt-1 +
           * 16px-per-line helper.
           */}
          <div className="rounded-2xl border border-border bg-white/60 p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-40 rounded" />
              <div className="flex flex-wrap items-center justify-end gap-1">
                <Skeleton className="h-[26px] w-20 rounded-lg" />
                <Skeleton className="h-[26px] w-20 rounded-lg" />
              </div>
            </div>

            {/* Material select + live E note */}
            <Skeleton className="h-5 w-20 rounded" />
            <Skeleton className="mt-1 h-[38px] rounded-xl" />
            <Skeleton className="mt-1 h-4 w-11/12 rounded" />

            {/* Yield strength (MPa) */}
            <div className="mt-3">
              <Skeleton className="h-5 w-44 rounded" />
              <Skeleton className="mt-1 h-[38px] rounded-xl" />
              <Skeleton className="mt-1 h-4 w-3/4 rounded" />
            </div>

            <div className="ac-divider my-5" />

            {/* Support / load-type selects, then the span + load Fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Skeleton className="h-5 w-36 rounded" />
                <Skeleton className="mt-1 h-[38px] rounded-xl" />
              </div>
              <div>
                <Skeleton className="h-5 w-24 rounded" />
                <Skeleton className="mt-1 h-[38px] rounded-xl" />
              </div>
              <div>
                <Skeleton className="h-5 w-40 rounded" />
                <Skeleton className="mt-1 h-[38px] rounded-xl" />
                <div className="mt-1">
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-1/2 rounded" />
                </div>
              </div>
              <div>
                <Skeleton className="h-5 w-32 rounded" />
                <Skeleton className="mt-1 h-[38px] rounded-xl" />
                <div className="mt-1">
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-1/2 rounded" />
                </div>
              </div>
            </div>

            <div className="ac-divider my-5" />

            {/* Cross-section heading + preset select */}
            <Skeleton className="mb-2 h-5 w-36 rounded" />
            <Skeleton className="h-[38px] rounded-xl" />
            <Skeleton className="mt-1 h-4 w-4/5 rounded" />

            {/* tube branch — outer width b · outer height h · wall thickness */}
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <Skeleton className="h-5 w-28 rounded" />
                <Skeleton className="mt-1 h-[38px] rounded-xl" />
                <Skeleton className="mt-1 h-4 w-4/5 rounded" />
              </div>
              <div>
                <Skeleton className="h-5 w-28 rounded" />
                <Skeleton className="mt-1 h-[38px] rounded-xl" />
                <div className="mt-1">
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-1/3 rounded" />
                </div>
              </div>
              <div>
                <Skeleton className="h-5 w-32 rounded" />
                <Skeleton className="mt-1 h-[38px] rounded-xl" />
                <div className="mt-1">
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-1/3 rounded" />
                </div>
              </div>
            </div>

            {/* computed-section readout — px-3 py-2 text-xs, ~3 lines */}
            <Skeleton className="mt-3 h-[66px] rounded-xl" />

            {/* Reset to defaults — ac-btn-ghost is min-h-11 / 16px radius */}
            <Skeleton className="mt-5 h-11 w-40 rounded-2xl" />
          </div>

          {/* RESULTS */}
          <div className="rounded-2xl border border-border bg-white/60 p-5">
            <Skeleton className="h-4 w-44 rounded" />
            {/* primary figure: font-display text-5xl */}
            <Skeleton className="mt-1 h-12 w-48 rounded-lg" />
            <Skeleton className="mt-1 h-5 w-32 rounded" />
            {/* deflection ratio + stiffness band tiles */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
            <Skeleton className="mt-2 h-3 w-full rounded" />
            {/* beam diagram */}
            <Skeleton className="mt-4 h-32 rounded-xl" />
            {/* formula chips */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Skeleton className="h-8 w-40 rounded-lg" />
              <Skeleton className="h-8 w-32 rounded-lg" />
              <Skeleton className="h-8 w-36 rounded-lg" />
            </div>
            <Skeleton className="mt-4 h-14 rounded-xl" />
          </div>
        </div>

        {/* Notes & sources — a collapsed <details>, only its summary shows */}
        <div className="mt-6 rounded-2xl border border-border bg-white/50 p-4">
          <Skeleton className="h-5 w-48 rounded" />
        </div>
      </div>

      {/* ── ToolCTA ────────────────────────────────────────────── */}
      <section className="mt-14">
        <div className="ac-glass relative overflow-hidden p-8 text-center sm:px-14 sm:py-10">
          <Skeleton className="mx-auto h-11 w-11 rounded-2xl" />
          <Skeleton className="mx-auto mt-4 h-8 w-full max-w-md rounded-lg sm:h-9" />
          <Skeleton className="mx-auto mt-1 h-8 w-2/3 max-w-xs rounded-lg lg:hidden" />
          <div className="mx-auto mt-3 max-w-md space-y-1.5">
            <Skeleton className="h-4 rounded" />
            <Skeleton className="h-4 rounded" />
            <Skeleton className="mx-auto h-4 w-3/5 rounded" />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Skeleton className="h-11 w-56 rounded-2xl" />
            <Skeleton className="h-11 w-40 rounded-2xl" />
          </div>
        </div>
        <div className="mt-8">
          <Skeleton className="h-4 w-28 rounded" />
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[52px] rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
