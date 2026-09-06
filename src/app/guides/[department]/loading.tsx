import { Skeleton } from "@/components/ui/skeleton";
import { TITLE_BLOCK_CELL } from "./_mastery-panel";

/**
 * The department sheet, before the catalogue read resolves.
 *
 * It holds the finished page's shape so nothing shifts when the real content
 * lands: breadcrumb, masthead, the four-cell title block on the same rules,
 * the module log and the margin sheet, then the sign-off band.
 *
 * The title block is drawn for real, borders and all, rather than as one grey
 * slab. It is the strongest shape on the page, so a placeholder that keeps it
 * is the difference between a page loading and a page missing.
 */
export default function DepartmentLoading() {
  return (
    <>
      {/* ===================== MASTHEAD ===================== */}
      <section className="nb-wrap pb-[clamp(1.6rem,3vw,2.4rem)] pt-[clamp(1.6rem,3.5vw,2.6rem)]">
        <Skeleton className="h-4 w-56" />

        {/* h1 at the display clamp */}
        <Skeleton className="mt-[clamp(1rem,2vw,1.5rem)] h-[clamp(2.4rem,4.6vw,4.3rem)] w-[min(30rem,88%)]" />

        {/* tagline, at the 46ch lede measure */}
        <div className="mt-5 flex max-w-[46ch] flex-col gap-2.5">
          <Skeleton className="h-4 w-[92%]" />
          <Skeleton className="h-4 w-[54%]" />
        </div>

        {/* description, at the 62ch body measure */}
        <div className="mt-4 flex max-w-[62ch] flex-col gap-2.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[94%]" />
          <Skeleton className="h-4 w-[66%]" />
        </div>

        <div className="mt-[clamp(1.4rem,2.6vw,2rem)] flex flex-wrap gap-3">
          <Skeleton className="h-11 w-44" />
          <Skeleton className="h-11 w-52" />
        </div>
      </section>

      {/* ===================== TITLE BLOCK ===================== */}
      <section className="nb-wrap pb-[clamp(2rem,4vw,3rem)]">
        <div className="nb-box grid grid-cols-1 min-[861px]:grid-cols-4">
          <span className="nb-tape -top-3 left-[8%] rotate-[-3.4deg]" aria-hidden="true" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={TITLE_BLOCK_CELL}>
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-16 min-[861px]:mt-1.5" />
            </div>
          ))}
        </div>
      </section>

      {/* ===================== THE PATH, AND THE MARGIN ===================== */}
      <div className="nb-wrap grid gap-[clamp(2rem,4vw,3.2rem)] pb-[clamp(2.6rem,5vw,4rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
        <div className="min-w-0">
          <div className="mb-[clamp(1.2rem,2.4vw,1.8rem)]">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-3 h-[clamp(1.6rem,1.6vw,2.4rem)] w-[min(19rem,70%)]" />
          </div>

          {/* module rows, opening on the same 2px ink rules */}
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="nb-rule flex items-center gap-[clamp(0.7rem,2vw,1.15rem)] py-[clamp(0.9rem,2vw,1.3rem)]"
            >
              <Skeleton className="size-11 shrink-0" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-5 w-[min(18rem,72%)]" />
                <Skeleton className="mt-2 h-3.5 w-40" />
              </div>
              <Skeleton className="hidden h-3 w-24 shrink-0 sm:block" />
              <Skeleton className="size-8 shrink-0" />
            </div>
          ))}
        </div>

        {/* Not sticky, for the same reason the real margin is not: the sheet
            runs taller than the viewport and would pin its own tail out of
            reach. */}
        <aside>
          <div className="nb-box nb-tilt-2 p-[clamp(1.1rem,2.2vw,1.5rem)]">
            <span className="nb-tape -top-3 right-6 rotate-[2.8deg]" aria-hidden="true" />
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="nb-hair mt-5 pt-5 [&:first-of-type]:mt-0 [&:first-of-type]:border-t-0 [&:first-of-type]:pt-0"
              >
                <Skeleton className="h-5 w-40" />
                <div className="mt-3 flex flex-col gap-2">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-[88%]" />
                  <Skeleton className="h-3.5 w-[72%]" />
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* ===================== THE SIGN-OFF ===================== */}
      <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)]">
        <div className="nb-rule pt-[clamp(1.8rem,3.5vw,2.6rem)]">
          <Skeleton className="h-[clamp(1.6rem,1.6vw,2.4rem)] w-[min(24rem,80%)]" />
          <div className="mt-3 flex max-w-[56ch] flex-col gap-2.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[70%]" />
          </div>
          <div className="mt-[clamp(1.4rem,2.6vw,2rem)] flex flex-wrap gap-3">
            <Skeleton className="h-11 w-44" />
            <Skeleton className="h-11 w-56" />
          </div>
        </div>
      </section>
    </>
  );
}
