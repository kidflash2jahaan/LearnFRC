import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors src/app/settings/page.tsx: the same gutter (`nb-wrap max-w-[54rem]`),
 * the same top padding, the same order of record strip, form, motion card and
 * session block.
 *
 * The three hand-ruled boxes are drawn with their REAL `nb-box` chrome rather
 * than as grey slabs, so the ink borders, the inset hairline and the panel
 * divisions do not move when the content swaps in. Only what goes inside them
 * pulses. The profile form is the one region on this route whose shape is
 * completely fixed (every account sees the same seven fields), so it is worth
 * mirroring field by field instead of as one block.
 */
export default function SettingsLoading() {
  return (
    <div className="nb-wrap max-w-[54rem] pb-[clamp(3rem,6vw,4.5rem)] pt-[clamp(2rem,4.5vw,3.2rem)]">
      {/* ---- header ---- */}
      <div>
        {/* nb-marker: a 34px blue stroke plus one mono line. The stroke is
            real, because it is two pixels of colour and never loads late. */}
        <div className="mb-[0.85rem] flex items-baseline gap-[0.65rem]">
          <span
            className="inline-block h-0.5 w-[34px] shrink-0 -translate-y-[0.28em] rotate-[-1deg] bg-blue"
            aria-hidden="true"
          />
          <Skeleton className="h-3.5 w-52" />
        </div>
        <Skeleton className="h-[clamp(1.9rem,1.3rem+2vw,2.8rem)] w-full max-w-lg" />
        <Skeleton className="mt-2 h-[clamp(1.9rem,1.3rem+2vw,2.8rem)] w-2/3 max-w-sm" />
        <div className="mt-4 max-w-[46ch]">
          <Skeleton className="h-4" />
          <Skeleton className="mt-2 h-4 w-4/5" />
        </div>
      </div>

      {/* ---- member record strip ---- */}
      <div className="nb-box mt-[clamp(1.6rem,3.4vw,2.4rem)] grid overflow-hidden min-[861px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="nb-panel">
          <Skeleton className="h-3.5 w-40" />
          <div className="mt-4 flex items-center gap-4">
            <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-6 w-48 max-w-full" />
              <Skeleton className="mt-2 h-3.5 w-32" />
            </div>
          </div>
          <Skeleton className="mt-4 h-7 w-24" />
        </div>
        <div className="nb-panel justify-center gap-0">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`flex items-baseline justify-between gap-4 py-2.5 ${
                i > 0 ? "border-t border-dashed border-rule" : ""
              }`}
            >
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* ---- the two ghost links under it ---- */}
      <div className="mt-5 flex flex-wrap gap-3">
        <Skeleton className="h-11 w-32" />
        <Skeleton className="h-11 w-56" />
      </div>

      {/* ---- profile form ---- */}
      <section className="mt-[clamp(2.4rem,5vw,3.4rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <Skeleton className="h-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)] w-28" />
          <Skeleton className="h-3.5 w-64 max-w-full" />
        </div>

        <div className="mt-6 flex flex-col gap-5">
          {/* "how you appear" strip */}
          <div className="nb-hair flex items-center gap-4 pt-4">
            <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="mt-2 h-5 w-40" />
            </div>
          </div>

          <Field hints={1} />
          <Field hints={2} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field hints={2} />
            <Field hints={2} />
          </div>
          <Field hints={0} />
          <Field hints={1} />

          {/* bio: label plus counter, a 4-row textarea, one hint */}
          <div className="grid gap-[0.4rem]">
            <div className="flex items-baseline justify-between gap-3">
              <Skeleton className="h-3.5 w-10" />
              <Skeleton className="h-3.5 w-16" />
            </div>
            <Skeleton className="h-[7.5rem]" />
            <Skeleton className="h-3 w-48" />
          </div>

          <div className="pt-1">
            <Skeleton className="h-11 w-full sm:w-40" />
          </div>
        </div>

        {/* danger zone: real 3px chrome, skeleton contents */}
        <div className="nb-box mt-10 border-[3px] p-[clamp(1.1rem,2.4vw,1.6rem)]">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="mt-2 h-6 w-56 max-w-full" />
          <div className="mt-3 max-w-[56ch]">
            <Skeleton className="h-4" />
            <Skeleton className="mt-2 h-4 w-3/4" />
          </div>
          <Skeleton className="mt-5 h-11 w-48" />
        </div>
      </section>

      {/* ---- motion card ---- */}
      <div className="nb-box mt-[clamp(2.4rem,5vw,3.4rem)] p-[var(--pad)]">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="mt-2 h-6 w-52" />
        <div className="mt-2 max-w-[56ch]">
          <Skeleton className="h-4" />
          <Skeleton className="mt-2 h-4 w-2/3" />
        </div>
        <div className="nb-hair mt-5 flex flex-wrap items-center justify-between gap-4 pt-4">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-3 w-56 max-w-full" />
          </div>
          <Skeleton className="h-8 w-[3.75rem] shrink-0" />
        </div>
      </div>

      {/* ---- session ---- */}
      <section className="mt-[clamp(2.4rem,5vw,3.4rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]">
        <Skeleton className="h-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)] w-32" />
        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="w-full max-w-[52ch] flex-1">
            <Skeleton className="h-4" />
            <Skeleton className="mt-2 h-4 w-5/6" />
          </div>
          <Skeleton className="h-11 w-32 shrink-0" />
        </div>
      </section>
    </div>
  );
}

/** One `nb-field`: mono label, a 44px control, and 0 to 2 hint lines. */
function Field({ hints }: { hints: 0 | 1 | 2 }) {
  return (
    <div className="grid gap-[0.4rem]">
      <Skeleton className="h-3.5 w-28" />
      <Skeleton className="h-11" />
      {hints > 0 && <Skeleton className="h-3 w-3/4" />}
      {hints > 1 && <Skeleton className="h-3 w-1/2" />}
    </div>
  );
}
