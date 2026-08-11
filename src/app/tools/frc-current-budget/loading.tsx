import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback for /tools/frc-current-budget.
 *
 * The page is dynamic — it awaits getSession() (cookies + a Supabase auth
 * round-trip) — so the route is not prerendered and navigation blocks on that
 * request. This is the instant feedback in the meantime.
 *
 * Containers copied from the real page, not approximated:
 *   page.tsx  <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6 lg:px-8 lg:pt-32">
 *   _calculator.tsx  <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
 *   header  <div className="mb-6">  ·  body  grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]
 *   both columns are <div className="space-y-6"> stacks of ac-card rounded-2xl p-5
 *   notes   <div className="mt-8"><div className="ac-glass p-5 sm:p-6">  (collapsed by default)
 * Rendered as a <div> rather than <main> so the fallback does not add a second
 * <main> landmark under the root layout's.
 */
export default function CurrentBudgetLoading() {
  return (
    <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6 lg:px-8 lg:pt-32">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="mb-6">
          <span className="ac-chip inline-flex items-center gap-2">
            <Skeleton className="h-4 w-28 rounded" />
          </span>
          <Skeleton className="mt-3 h-8 w-full max-w-md rounded-lg sm:h-9" />
          <Skeleton className="mt-1 h-8 w-2/3 rounded-lg sm:hidden" />
          <div className="mt-2 max-w-2xl space-y-1.5">
            <Skeleton className="h-3.5 rounded" />
            <Skeleton className="h-3.5 rounded" />
            <Skeleton className="h-3.5 w-11/12 rounded sm:w-2/3" />
            <Skeleton className="h-3.5 w-5/6 rounded sm:hidden" />
          </div>
          <div className="mt-2 max-w-2xl space-y-1.5">
            <Skeleton className="h-3 rounded" />
            <Skeleton className="h-3 w-3/4 rounded" />
          </div>
        </div>

        {/* ── Body grid ──────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* LEFT: inputs — System & battery, then Mechanisms
           *
           * mechanisms seeds from typicalDrive(): three cards — Drivetrain (4
           * motors), Intake (1), Elevator (2) — every motor in "Smart limit"
           * mode, so each motor row renders the editable amps input. A motor
           * row's controls total ~520px against ~417px of card width, so it
           * wraps onto two 38px lines; the widths below reproduce that wrap
           * rather than assuming a single line.
           */}
          <div className="space-y-6">
            <div className="ac-card rounded-2xl p-5">
              <div className="mb-4 flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-[14px]" />
                <Skeleton className="h-7 w-40 rounded" />
              </div>
              {/* roboRIO version · brownout · V(oc) · internal resistance */}
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: "w-36", lines: 3, slider: false },
                  { label: "w-44", lines: 2, slider: false },
                  { label: "w-48", lines: 4, slider: false },
                  { label: "w-52", lines: 4, slider: true },
                ].map((f, i) => (
                  <div key={i}>
                    <Skeleton className={`h-5 ${f.label} max-w-full rounded`} />
                    {/* the resistance control is a range slider, not an input */}
                    <Skeleton
                      className={f.slider ? "mt-1 h-5 rounded-full" : "mt-1 h-[38px] rounded-xl"}
                    />
                    <div className="mt-1">
                      {Array.from({ length: f.lines }).map((_, n) => (
                        <Skeleton
                          key={n}
                          className={n === f.lines - 1 ? "h-4 w-2/3 rounded" : "h-4 w-full rounded"}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Skeleton className="h-11 w-44 rounded-2xl" />
                <Skeleton className="h-11 w-52 rounded-2xl" />
              </div>
            </div>

            <div className="ac-card rounded-2xl p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-[14px]" />
                  <Skeleton className="h-7 w-32 rounded" />
                </div>
                <Skeleton className="h-11 w-24 rounded-2xl" />
              </div>
              <div className="space-y-4">
                {[4, 1, 2].map((motors, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-border bg-white/40 p-4"
                  >
                    {/* name · "Running now" checkbox · remove */}
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-[8rem] flex-1">
                        <Skeleton className="h-4 w-12 rounded" />
                        <Skeleton className="mt-1 h-[38px] rounded-xl" />
                      </div>
                      <Skeleton className="mb-2 h-4 w-28 rounded" />
                      <Skeleton className="mb-2 h-4 w-4 rounded" />
                    </div>

                    {/* one row per motor: motor · mode · limit, then breaker
                        and remove wrapping onto a second line */}
                    <div className="mt-3 space-y-2">
                      {Array.from({ length: motors }).map((_, n) => (
                        <div key={n} className="flex flex-wrap items-center gap-2">
                          <Skeleton className="h-[38px] min-w-[9rem] flex-1 rounded-xl" />
                          <Skeleton className="h-[38px] w-32 rounded-xl" />
                          <Skeleton className="h-[38px] w-24 rounded-xl" />
                          <Skeleton className="h-[38px] w-[6.5rem] rounded-xl" />
                          <Skeleton className="h-4 w-4 rounded" />
                        </div>
                      ))}
                    </div>

                    {/* "Add motor" ‖ "N A total" status chip */}
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <Skeleton className="h-4 w-20 rounded" />
                      <Skeleton className="h-6 w-24 shrink-0 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: live results — three stacked result cards */}
          <div className="space-y-6">
            <div className="ac-card rounded-2xl p-5">
              <Skeleton className="h-5 w-48 rounded" />
              <Skeleton className="mt-2 h-12 w-40 rounded-lg" />
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between">
                  <Skeleton className="h-3 w-36 rounded" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
                <Skeleton className="h-2.5 w-full rounded-full" />
              </div>
              <div className="ac-divider my-4" />
              <div className="flex flex-wrap items-center gap-3">
                <Skeleton className="h-8 w-32 rounded-full" />
                <Skeleton className="h-4 w-40 rounded" />
              </div>
            </div>

            <div className="ac-card rounded-2xl p-5">
              <Skeleton className="h-6 w-40 rounded" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between gap-4">
                    <Skeleton className="h-4 w-1/2 rounded" />
                    <Skeleton className="h-4 w-20 shrink-0 rounded" />
                  </div>
                ))}
              </div>
            </div>

            <div className="ac-card rounded-2xl p-5">
              <Skeleton className="h-6 w-44 rounded" />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Notes & sources — collapsed, so only the toggle row is visible */}
        <div className="mt-8">
          <div className="ac-glass p-5 sm:p-6">
            <div className="flex w-full items-center justify-between">
              <Skeleton className="h-7 w-52 rounded" />
              <Skeleton className="h-5 w-12 rounded" />
            </div>
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
