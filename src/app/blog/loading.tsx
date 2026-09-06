import { Skeleton } from "@/components/ui/skeleton";

/**
 * The article index while the library is still being read.
 *
 * It holds the finished page's shape exactly, so nothing jumps when the real
 * thing lands: the asymmetric masthead with the divider card taped to the
 * right, the two-column contents frame, the chip row, and the first two desks
 * of the log with their rows already ruled.
 *
 * The rows are drawn as real dashed-ruled lines rather than as one grey block,
 * because the log is the page's dominant texture and a solid slab where the
 * ruling should be reads as a different page arriving.
 */
const DESKS = 11;

/** Label widths of the desk chips, so the row wraps where the real one does. */
const CHIP_WIDTHS = [118, 112, 232, 138, 178, 168, 132, 196, 250, 168, 136];

function LogRow() {
  return (
    <div className="grid gap-[clamp(1rem,3vw,2.4rem)] border-b border-dashed border-rule py-[clamp(1.05rem,2.2vw,1.6rem)] min-[769px]:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto]">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3.5 w-20" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-[1.4rem] w-[min(30rem,92%)]" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-[64%]" />
      </div>
      <Skeleton className="hidden h-3.5 w-10 min-[769px]:block" />
    </div>
  );
}

export default function BlogLoading() {
  return (
    <>
      {/* ===================== MASTHEAD ===================== */}
      <section className="nb-wrap pb-[clamp(2rem,4vw,3rem)] pt-[clamp(2.2rem,5vw,4rem)]">
        <div className="grid items-start gap-[clamp(1.8rem,4vw,3.6rem)] lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.85fr)]">
          <div>
            <Skeleton className="h-4 w-40" />

            {/* h1, two lines at the display clamp */}
            <Skeleton className="mt-4 h-[clamp(2.4rem,4.6vw,4.3rem)] w-[min(34rem,96%)]" />
            <Skeleton className="mt-2 h-[clamp(2.4rem,4.6vw,4.3rem)] w-[min(24rem,68%)]" />

            {/* nb-lede, three lines capped at 46ch */}
            <div className="mt-[clamp(1rem,2vw,1.5rem)] flex max-w-[46ch] flex-col gap-2.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[95%]" />
              <Skeleton className="h-4 w-[52%]" />
            </div>

            <div className="mt-[clamp(1.3rem,2.6vw,1.9rem)] flex flex-wrap gap-3">
              <Skeleton className="h-11 w-40" />
              <Skeleton className="h-11 w-48" />
            </div>

            <Skeleton className="mt-[clamp(1.3rem,2.6vw,1.9rem)] h-3.5 w-[min(30rem,90%)]" />
          </div>

          {/* the card of dividers */}
          <Skeleton className="h-[31rem] w-full max-w-md rounded-hand lg:justify-self-end" />
        </div>
      </section>

      {/* ===================== THE FRONT DOOR ===================== */}
      <section className="nb-wrap py-[clamp(2.4rem,5vw,4rem)]">
        <div className="nb-rule pt-[clamp(1.8rem,3.5vw,2.6rem)]">
          <div className="mb-[clamp(1.4rem,3vw,2.2rem)]">
            <Skeleton className="h-[clamp(1.8rem,2.5vw,3.2rem)] w-[min(19rem,72%)]" />
            <div className="mt-3 flex max-w-[56ch] flex-col gap-2.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[74%]" />
            </div>
          </div>

          <Skeleton className="h-[28rem] w-full rounded-hand" />
        </div>
      </section>

      {/* ===================== THE LOG ===================== */}
      <section className="nb-wrap pb-[clamp(2.6rem,5vw,4.4rem)]">
        <div className="nb-rule pt-[clamp(1.8rem,3.5vw,2.6rem)]">
          <Skeleton className="h-4 w-52" />
          <div className="mt-4 flex max-w-[52ch] flex-col gap-2.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[58%]" />
          </div>

          <div className="mt-[clamp(1.1rem,2.2vw,1.5rem)] flex flex-wrap gap-2">
            {CHIP_WIDTHS.slice(0, DESKS).map((w, i) => (
              <Skeleton
                key={i}
                className="h-[var(--tap)] max-w-full"
                style={{ width: `${w}px` }}
              />
            ))}
          </div>
        </div>

        {/* the first two desks, ruled */}
        {[6, 5].map((rows, deskIndex) => (
          <div key={deskIndex} className="pt-[clamp(2.2rem,4.4vw,3.4rem)]">
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
              <div>
                <Skeleton className="h-[clamp(1.5rem,2.5vw,2.3rem)] w-[min(16rem,70%)]" />
                <Skeleton className="mt-3 h-4 w-[min(26rem,90%)]" />
              </div>
              <Skeleton className="h-6 w-24 shrink-0" />
            </div>

            <div className="nb-list mt-[clamp(1rem,2vw,1.4rem)]">
              {Array.from({ length: rows }, (_, i) => (
                <LogRow key={i} />
              ))}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
