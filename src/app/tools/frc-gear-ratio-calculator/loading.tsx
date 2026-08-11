import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback for /tools/frc-gear-ratio-calculator.
 *
 * The page is dynamic — it awaits getSession() (cookies + a Supabase auth
 * round-trip) — so it is not prerendered and navigation blocks until that
 * resolves. This is also the heaviest client bundle of the six tools, so the
 * gap between click and paint is the most visible here.
 *
 * Containers copied from the real page, not approximated:
 *   page.tsx  <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6 lg:px-8 lg:pt-32">
 *   _calculator.tsx  <div className="ac-card rounded-2xl p-5 sm:p-6">
 *   header   <header className="mb-6">
 *   presets  <div className="mb-6 rounded-2xl border border-border bg-white/60 p-4">
 *   body     grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]
 *   columns  <div className="min-w-0 rounded-2xl border border-border bg-white/60 p-5">
 *   notes    <details className="mt-6 rounded-2xl border border-border bg-white/50 p-4">  (collapsed)
 * Rendered as a <div> rather than <main> so the fallback does not add a second
 * <main> landmark under the root layout's.
 */
export default function GearRatioCalculatorLoading() {
  return (
    <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6 lg:px-8 lg:pt-32">
      <div className="ac-card rounded-2xl p-5 sm:p-6">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="mb-6">
          {/* this chip carries an icon + eyebrow, hence the two blocks */}
          <span className="ac-chip inline-flex items-center gap-2">
            <Skeleton className="h-3.5 w-3.5 rounded" />
            <Skeleton className="h-4 w-40 rounded" />
          </span>
          <Skeleton className="mt-3 h-8 w-full max-w-sm rounded-lg sm:h-9" />
          <Skeleton className="mt-1 h-8 w-1/2 rounded-lg sm:hidden" />
          <div className="mt-2 max-w-2xl space-y-1.5">
            <Skeleton className="h-3.5 rounded" />
            <Skeleton className="h-3.5 rounded" />
            <Skeleton className="h-3.5 rounded" />
            <Skeleton className="h-3.5 w-2/3 rounded sm:w-1/2" />
            <Skeleton className="h-3.5 w-5/6 rounded sm:hidden" />
            <Skeleton className="h-3.5 w-1/2 rounded sm:hidden" />
          </div>
          <div className="mt-2 max-w-2xl space-y-1.5">
            <Skeleton className="h-3 rounded" />
            <Skeleton className="h-3 w-3/4 rounded" />
          </div>
        </div>

        {/* ── Presets ────────────────────────────────────────────── */}
        <div className="mb-6 rounded-2xl border border-border bg-white/60 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-5 w-56 rounded" />
          </div>
          <div className="flex flex-wrap gap-2">
            {/* PRESETS has four entries: KOP tank · NEO tank · swerve · arm */}
            {["w-36", "w-44", "w-40", "w-32"].map((w) => (
              <Skeleton key={w} className={`h-11 rounded-xl ${w}`} />
            ))}
          </div>
          <div className="mt-2 space-y-1.5">
            <Skeleton className="h-3 rounded" />
            <Skeleton className="h-3 w-2/3 rounded" />
          </div>
        </div>

        {/* ── Body grid ──────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* INPUTS
           *
           * First paint is Drivetrain mode with two Teeth-mode stages, so the
           * five-Field "Robot & wheels" branch renders (not the one-Field
           * mechanism branch) and each stage card carries two inputs. Both
           * mode grids are `sm:grid-cols-2`, so those 5 + 3 Fields occupy 3 +
           * 2 rows above sm. INPUT_CLS/SELECT_CLS here carry min-h-[44px] —
           * 44px controls, not 38 — and the helpers are text-xs
           * leading-relaxed (≈20px/line) wrapping 4-8 lines in a half-width
           * cell.
           */}
          <div className="min-w-0 rounded-2xl border border-border bg-white/60 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <Skeleton className="h-5 w-40 rounded" />
              {/* [Drivetrain | Mechanism] — its buttons are min-h-[44px] */}
              <Skeleton className="h-11 w-44 rounded-lg" />
            </div>

            {/* Motor select + its live spec line */}
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="mt-1 h-11 rounded-xl" />
            <div className="mt-1">
              <Skeleton className="h-5 w-full rounded" />
              <Skeleton className="h-5 w-11/12 rounded" />
              <Skeleton className="h-5 w-2/3 rounded" />
            </div>

            {/* Number of these motors — no helper text */}
            <div className="mt-3">
              <Skeleton className="h-5 w-48 rounded" />
              <Skeleton className="mt-1 h-11 rounded-xl" />
            </div>

            <div className="ac-divider my-5" />

            {/* Gear stages heading ‖ [Teeth | Ratio] toggle, then the blurb */}
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="h-11 w-32 rounded-lg" />
            </div>
            <div className="mb-3">
              <Skeleton className="h-5 w-full rounded" />
              <Skeleton className="h-5 w-full rounded" />
              <Skeleton className="h-5 w-1/2 rounded" />
            </div>

            {/* two stage cards — p-3 around a header row and a 44px input row */}
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-[110px] rounded-xl" />
              ))}
            </div>

            {/* Add a stage — ac-btn-ghost, min-h-11 / 16px radius */}
            <Skeleton className="mt-3 h-11 w-36 rounded-2xl" />

            {/* Total drivetrain efficiency (%) */}
            <div className="mt-4">
              <Skeleton className="h-5 w-56 max-w-full rounded" />
              <Skeleton className="mt-1 h-11 rounded-xl" />
              <div className="mt-1">
                <Skeleton className="h-5 w-full rounded" />
                <Skeleton className="h-5 w-full rounded" />
                <Skeleton className="h-5 w-full rounded" />
                <Skeleton className="h-5 w-1/3 rounded" />
              </div>
            </div>

            <div className="ac-divider my-5" />

            {/* Robot & wheels — 5 Fields across 3 sm:grid-cols-2 rows */}
            <Skeleton className="mb-2 h-5 w-40 rounded" />
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: "w-36", lines: 7 },
                { label: "w-28", lines: 4 },
                { label: "w-32", lines: 7 },
                { label: "w-40", lines: 6 },
                { label: "w-28", lines: 8 },
              ].map((f, i) => (
                <div key={i} className="min-w-0">
                  <Skeleton className={`h-5 ${f.label} rounded`} />
                  <Skeleton className="mt-1 h-11 rounded-xl" />
                  <div className="mt-1">
                    {Array.from({ length: f.lines }).map((_, n) => (
                      <Skeleton
                        key={n}
                        className={n === f.lines - 1 ? "h-5 w-1/2 rounded" : "h-5 w-full rounded"}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="ac-divider my-5" />

            {/* Current limit & battery — 3 Fields across 2 grid rows */}
            <Skeleton className="mb-2 h-5 w-52 rounded" />
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: "w-44", lines: 6 },
                { label: "w-40", lines: 4 },
                { label: "w-44", lines: 5 },
              ].map((f, i) => (
                <div key={i} className="min-w-0">
                  <Skeleton className={`h-5 ${f.label} rounded`} />
                  <Skeleton className="mt-1 h-11 rounded-xl" />
                  <div className="mt-1">
                    {Array.from({ length: f.lines }).map((_, n) => (
                      <Skeleton
                        key={n}
                        className={n === f.lines - 1 ? "h-5 w-1/2 rounded" : "h-5 w-full rounded"}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Reset to the KOP preset */}
            <Skeleton className="mt-5 h-11 w-52 rounded-2xl" />
          </div>

          {/* RESULTS */}
          <div className="min-w-0 rounded-2xl border border-border bg-white/60 p-5">
            <Skeleton className="h-4 w-40 rounded" />
            {/* primary figure: font-display text-5xl */}
            <Skeleton className="mt-1 h-12 w-44 rounded-lg" />
            <Skeleton className="mt-1 h-5 w-56 rounded" />
            {/* four ac-tile stats */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            <Skeleton className="mt-3 h-24 rounded-xl" />
            {/* traction / pushing-force group */}
            <Skeleton className="mt-5 h-5 w-44 rounded" />
            <div className="mt-2 grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            {/* current / brownout group */}
            <Skeleton className="mt-5 h-5 w-40 rounded" />
            <div className="mt-2 grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            {/* worked-formula panel */}
            <Skeleton className="mt-5 h-40 rounded-xl" />
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
