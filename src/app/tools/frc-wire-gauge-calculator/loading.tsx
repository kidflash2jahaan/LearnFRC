import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback for /tools/frc-wire-gauge-calculator.
 *
 * The page is dynamic — it awaits getSession() (cookies + a Supabase auth
 * round-trip) — so it is not prerendered and navigation blocks until that
 * resolves.
 *
 * Containers copied from the real page, not approximated:
 *   page.tsx  <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6 lg:px-8 lg:pt-32">
 *   _calculator.tsx  <div className="space-y-6">   (header / grid / notes are its 3 children)
 *   header   <header className="space-y-3">
 *   body     grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]
 *   columns  <section className="ac-card rounded-2xl p-5">
 *   notes    <section className="ac-glass rounded-2xl p-5">  (collapsed by default)
 * Rendered as a <div> rather than <main> so the fallback does not add a second
 * <main> landmark under the root layout's.
 */
export default function WireGaugeCalculatorLoading() {
  return (
    <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6 lg:px-8 lg:pt-32">
      <div className="space-y-6">
        {/* ── Header (space-y-3, not mt-* like the other tools) ──── */}
        <div className="space-y-3">
          <div>
            <span className="ac-chip inline-flex items-center gap-2">
              <Skeleton className="h-3.5 w-3.5 rounded" />
              <Skeleton className="h-4 w-28 rounded" />
            </span>
          </div>
          <div>
            <Skeleton className="h-8 w-full max-w-lg rounded-lg sm:h-9" />
            <Skeleton className="mt-1 h-8 w-2/3 rounded-lg sm:hidden" />
          </div>
          <div className="max-w-2xl space-y-1.5">
            <Skeleton className="h-3.5 rounded" />
            <Skeleton className="h-3.5 rounded" />
            <Skeleton className="h-3.5 w-11/12 rounded sm:w-1/2" />
            <Skeleton className="h-3.5 w-3/4 rounded sm:hidden" />
          </div>
          <div className="max-w-2xl space-y-1.5">
            <Skeleton className="h-3 rounded" />
            <Skeleton className="h-3 w-3/5 rounded" />
          </div>
        </div>

        {/* ── Body grid ──────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* LEFT — the wire run
           *
           * First paint is showAdvanced=false, so the advanced panel
           * (temperature / voltage / uplift) does not render at all — the
           * column is the six field blocks, the ac-divider, and the collapsed
           * "Advanced" toggle, which is a plain text row rather than a button
           * pill. Controls are px-3 py-2 text-sm + 1px border → 38px.
           */}
          <div className="ac-card rounded-2xl p-5">
            <Skeleton className="mb-4 h-6 w-36 rounded" />
            <div className="space-y-4">
              {/* 1 · Load current (A) */}
              <div className="space-y-1">
                <Skeleton className="h-5 w-32 rounded" />
                <Skeleton className="h-[38px] rounded-xl" />
                <Skeleton className="h-4 w-3/5 rounded" />
              </div>

              {/* 2 · One-way run length — number input + unit select share a row */}
              <div className="space-y-1">
                <Skeleton className="h-5 w-40 rounded" />
                <div className="flex gap-2">
                  <Skeleton className="h-[38px] flex-1 rounded-xl" />
                  <Skeleton className="h-[38px] w-28 shrink-0 rounded-xl" />
                </div>
                <div>
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-2/3 rounded" />
                </div>
              </div>

              {/* 3 · Wire gauge (AWG) select */}
              <div className="space-y-1">
                <Skeleton className="h-5 w-36 rounded" />
                <Skeleton className="h-[38px] rounded-xl" />
                <div>
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-3/4 rounded" />
                </div>
              </div>

              {/* 4 · Circuit type / protection select */}
              <div className="space-y-1">
                <Skeleton className="h-5 w-44 rounded" />
                <Skeleton className="h-[38px] rounded-xl" />
                <Skeleton className="h-4 w-4/5 rounded" />
              </div>

              {/* 5 · "Stranded & warm" opt-in — a bordered label card, not a
                  field: p-3 around a 20px title and ~4 lines of text-xs */}
              <Skeleton className="h-[110px] rounded-xl" />

              {/* 6 · Voltage-drop target (%) */}
              <div className="space-y-1">
                <Skeleton className="h-5 w-44 rounded" />
                <Skeleton className="h-[38px] rounded-xl" />
                <div>
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-3/5 rounded" />
                </div>
              </div>

              <div className="ac-divider" />

              {/* 7 · collapsed "Advanced" toggle — a text-sm row, not a button */}
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-5 w-64 max-w-full rounded" />
                <Skeleton className="h-4 w-4 shrink-0 rounded" />
              </div>
            </div>
          </div>

          {/* RIGHT — live results */}
          <div className="ac-card rounded-2xl p-5">
            {/* primary result sits in its own ac-tile rounded-2xl p-5 */}
            <div className="ac-tile rounded-2xl p-5">
              <Skeleton className="h-4 w-32 rounded" />
              {/* text-4xl → sm:text-5xl */}
              <Skeleton className="mt-1 h-10 w-40 rounded-lg sm:h-12" />
              <Skeleton className="mt-2 h-4 w-2/3 rounded" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
            <div className="mt-4 space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
            <div className="ac-divider my-4" />
            <Skeleton className="h-5 w-44 rounded" />
            <div className="space-y-3">
              <Skeleton className="mt-3 h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Notes & sources — collapsed, so only the toggle row is visible */}
        <div className="ac-glass rounded-2xl p-5">
          <div className="flex w-full items-center justify-between">
            <Skeleton className="h-6 w-40 rounded" />
            <Skeleton className="h-4 w-4 rounded" />
          </div>
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
