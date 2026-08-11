import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback for /tools/frc-budget-calculator.
 *
 * The page is dynamic — it awaits getSession() (cookies + a Supabase auth
 * round-trip) before the calculator renders — so without this the browser sits
 * on the previous route with no feedback.
 *
 * Both columns are drawn from _calculator.tsx's FIRST-PAINT state (rookie ·
 * Regional · KOP · "New (itemized)" control system, both Championship boxes
 * unchecked): 17 field rows on the left, and on the right the grand-total
 * panel, the rookie-benefit callout and four of the seven CategoryBlocks.
 * The body grid stretches its items, so under-drawing the left column was
 * shortening the whole grid and pulling ToolCTA up several hundred pixels.
 *
 * Containers below are copied from the real page, not approximated:
 *   page.tsx  <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6 lg:px-8 lg:pt-32">
 *   _calculator.tsx  <div className="mx-auto w-full max-w-6xl">
 *   header  <div className="mb-6">  ·  body  grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]
 *   notes   <details className="ac-glass mt-6 rounded-2xl p-5">  (collapsed)
 *   footer  <ToolCTA> — <section className="mt-14">
 * Rendered as a <div> rather than <main> so the fallback does not add a second
 * <main> landmark under the root layout's.
 */
export default function BudgetCalculatorLoading() {
  return (
    <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6 lg:px-8 lg:pt-32">
      <div className="mx-auto w-full max-w-6xl">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="mb-6">
          {/* ac-chip supplies its own padding/radius; only its label shimmers */}
          <span className="ac-chip inline-flex items-center gap-2">
            <Skeleton className="h-4 w-28 rounded" />
          </span>
          {/* h1: text-2xl (2 lines on mobile) → sm:text-3xl (1 line) */}
          <Skeleton className="mt-3 h-8 w-full max-w-lg rounded-lg sm:h-9" />
          <Skeleton className="mt-1 h-8 w-2/3 rounded-lg sm:hidden" />
          {/* lead paragraph: text-sm, max-w-2xl */}
          <div className="mt-2 max-w-2xl space-y-1.5">
            <Skeleton className="h-3.5 rounded" />
            <Skeleton className="h-3.5 rounded" />
            <Skeleton className="h-3.5 w-11/12 rounded sm:w-3/4" />
            <Skeleton className="h-3.5 w-5/6 rounded sm:hidden" />
            <Skeleton className="h-3.5 w-1/2 rounded sm:hidden" />
          </div>
          {/* source note: text-xs */}
          <div className="mt-2 max-w-2xl space-y-1.5">
            <Skeleton className="h-3 rounded" />
            <Skeleton className="h-3 w-3/5 rounded" />
          </div>
        </div>

        {/* ── Body grid ──────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* LEFT: inputs
           *
           * _calculator.tsx's initial state is rookie · Regional · KOP
           * drivetrain · "New (itemized)" control system, with both
           * Championship checkboxes off. That renders 17 field rows, laid out
           * as 18 direct children of <div className="mt-4 space-y-4">.
           *
           * Row maths (Field = 20px label + mt-0.5 helper lines of 16px +
           * mt-1.5 control):
           *   NumberInput  px-3 py-2 text-sm + 1px border  → 38px
           *   SegBtn       p-1 + 32px pills + 1px border   → 42px
           */}
          <div className="ac-card rounded-2xl p-5">
            {/* icon + "Your team" (text-base h3) */}
            <Skeleton className="h-6 w-32 rounded" />

            <div className="mt-4 space-y-4">
              {/* 1 · Team type — 2-line helper, 2-pill segmented control */}
              <div>
                <Skeleton className="h-5 w-24 rounded" />
                <Skeleton className="mt-0.5 h-4 w-full rounded" />
                <Skeleton className="h-4 w-3/5 rounded" />
                <Skeleton className="mt-1.5 h-[42px] w-full rounded-xl" />
              </div>

              {/* 2 · Program / event model — 2-line helper, 2 pills */}
              <div>
                <Skeleton className="h-5 w-44 rounded" />
                <Skeleton className="mt-0.5 h-4 w-full rounded" />
                <Skeleton className="h-4 w-4/5 rounded" />
                <Skeleton className="mt-1.5 h-[42px] w-full rounded-xl" />
              </div>

              {/* 3 · Additional Regional events (Regional model is default) */}
              <div>
                <Skeleton className="h-5 w-52 rounded" />
                <Skeleton className="mt-0.5 h-4 w-full rounded" />
                <Skeleton className="h-4 w-2/5 rounded" />
                <Skeleton className="mt-1.5 h-[38px] w-full rounded-xl" />
              </div>

              {/* 4 · "Attending FIRST Championship?" checkbox row */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-5 w-56 max-w-full rounded" />
              </div>

              {/* 5 · Grants & sponsor vouchers */}
              <div>
                <Skeleton className="h-5 w-64 max-w-full rounded" />
                <Skeleton className="mt-0.5 h-4 w-2/5 rounded" />
                <Skeleton className="mt-1.5 h-[38px] w-full rounded-xl" />
              </div>

              <div className="ac-divider" />

              {/* 6 · Drivetrain — 3-pill segmented control */}
              <div>
                <Skeleton className="h-5 w-28 rounded" />
                <Skeleton className="mt-0.5 h-4 w-full rounded" />
                <Skeleton className="h-4 w-3/5 rounded" />
                <Skeleton className="mt-1.5 h-[42px] w-full rounded-xl" />
              </div>

              <div className="ac-divider" />

              {/* 7 · Control system — 4 pills */}
              <div>
                <Skeleton className="h-5 w-36 rounded" />
                <Skeleton className="mt-0.5 h-4 w-full rounded" />
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="mt-1.5 h-[42px] w-full rounded-xl" />
              </div>

              {/* 8–9 · Batteries + Consumables (grid-cols-2, shown because the
                  default control-system path is "New (itemized)") */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Skeleton className="h-5 w-24 rounded" />
                  <Skeleton className="mt-0.5 h-4 w-3/5 rounded" />
                  <Skeleton className="mt-1.5 h-[38px] w-full rounded-xl" />
                </div>
                <div>
                  <Skeleton className="h-5 w-28 rounded" />
                  <Skeleton className="mt-0.5 h-4 w-full rounded" />
                  <Skeleton className="mt-1.5 h-[38px] w-full rounded-xl" />
                </div>
              </div>

              <div className="ac-divider" />

              {/* "Motors & controllers" section label (not a field) */}
              <Skeleton className="h-5 w-44 rounded" />

              {/* 10–13 · NEO / Kraken / Other qty / Other unit (grid-cols-2) */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  "w-28",
                  "w-28",
                  "w-28",
                  "w-32",
                ].map((w, i) => (
                  <div key={i}>
                    <Skeleton className={`h-5 ${w} rounded`} />
                    <Skeleton className="mt-0.5 h-4 w-4/5 rounded" />
                    <Skeleton className="mt-1.5 h-[38px] w-full rounded-xl" />
                  </div>
                ))}
              </div>

              <div className="ac-divider" />

              {/* 14–16 · Tools · Travel · Spares */}
              {["w-52", "w-60", "w-64"].map((w, i) => (
                <div key={i}>
                  <Skeleton className={`h-5 ${w} max-w-full rounded`} />
                  <Skeleton className="mt-0.5 h-4 w-4/5 rounded" />
                  <Skeleton className="mt-1.5 h-[38px] w-full rounded-xl" />
                </div>
              ))}

              {/* 17 · Team size (optional) */}
              <div>
                <Skeleton className="h-5 w-40 rounded" />
                <Skeleton className="mt-0.5 h-4 w-3/5 rounded" />
                <Skeleton className="mt-1.5 h-[38px] w-full rounded-xl" />
              </div>
            </div>
          </div>

          {/* RIGHT: live results
           *
           * At first paint the grand-total panel, the rookie-benefit callout
           * (rookie + KOP) and four CategoryBlocks render — Registration (1
           * line item), Drivetrain (1), Control system (6, itemized) and
           * Motors & controllers (2). Tools / Travel / Spares start at $0 and
           * their blocks return null, so they are not drawn.
           */}
          <div className="ac-card rounded-2xl p-5">
            {/* icon + "Season budget" (text-base h3) */}
            <Skeleton className="h-6 w-36 rounded" />

            {/* grand total panel — rounded-2xl border p-5 */}
            <div className="mt-4 rounded-2xl border border-border p-5">
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="mt-1 h-12 w-56 max-w-full rounded-lg" />
              <Skeleton className="mt-1 h-5 w-3/4 rounded" />
            </div>

            {/* rookie-benefit callout — p-3 around two text-sm lines */}
            <Skeleton className="mt-3 h-16 w-full rounded-xl" />

            {/* itemized categories */}
            <div className="mt-4 space-y-3">
              {[
                { items: 1, lastNoteLines: 2 },
                { items: 1, lastNoteLines: 1 },
                { items: 6, lastNoteLines: 1 },
                { items: 2, lastNoteLines: 1 },
              ].map((block, b) => (
                <div key={b} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-5 w-32 rounded" />
                    <Skeleton className="h-5 w-16 shrink-0 rounded" />
                  </div>
                  <div className="ac-divider my-2" />
                  {Array.from({ length: block.items }).map((_, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 py-1.5">
                      <div className="min-w-0 flex-1">
                        <Skeleton className="h-5 w-3/5 rounded" />
                        {i === block.items - 1
                          ? Array.from({ length: block.lastNoteLines }).map((__, n) => (
                              <Skeleton
                                key={n}
                                className={n === 0 ? "h-4 w-11/12 rounded" : "h-4 w-1/2 rounded"}
                              />
                            ))
                          : null}
                      </div>
                      <Skeleton className="h-5 w-16 shrink-0 rounded" />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* verdict badge — px-2.5 py-1 text-xs pill */}
            <Skeleton className="mt-4 h-6 w-64 max-w-full rounded-lg" />

            {/* actions — ac-btn is min-h-11 / 16px radius */}
            <div className="mt-5 flex flex-wrap gap-3">
              <Skeleton className="h-11 w-44 rounded-2xl" />
              <Skeleton className="h-11 w-36 rounded-2xl" />
            </div>

            {/* signed-out "create a free account" notice */}
            <div className="mt-3 rounded-xl border border-dashed border-border p-3">
              <Skeleton className="h-5 w-72 max-w-full rounded" />
              <Skeleton className="mt-1 h-4 w-full rounded" />
            </div>
          </div>
        </div>

        {/* Notes & sources — a collapsed <details>, so only its summary shows */}
        <div className="ac-glass mt-6 rounded-2xl p-5">
          <Skeleton className="h-5 w-52 rounded" />
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
