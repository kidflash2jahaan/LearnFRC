import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading UI for /certificate/[department].
 *
 * THE STATE THIS MATCHES, AND WHY. The route renders two mutually exclusive
 * pages: a "not signed off yet" spread, and the earned certificate. A single
 * skeleton cannot be both, so it is drawn for the earned one, because the only
 * link into this route anywhere in the app is the "Get certificate" CTA on the
 * department page, which renders exclusively when the department is complete.
 * Someone who has not finished has no in-app way to arrive here.
 *
 * Geometry is copied from the earned branch of page.tsx rather than
 * approximated: the same `nb-wrap` column and top padding, the same chrome row,
 * and the same `max-w-[56rem]` certificate card with its clamped padding. A
 * skeleton that does not line up turns the content swap into a visible jump.
 *
 * It stops after the certificate. Below that sit the TeamChallenge note (gated
 * on a username the fallback cannot know) and one line of tip copy, both far
 * down the page. Content growing in below a skeleton is not a jump; skeleton
 * blocks landing in the wrong place are.
 */
export default function CertificateLoading() {
  return (
    <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)] pt-[clamp(1.6rem,4vw,2.8rem)]">
      {/* Chrome: back link, share, print. */}
      <div className="mb-[clamp(1.2rem,2.6vw,1.8rem)] flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-11 w-48" />
        <div className="flex flex-wrap items-center gap-2.5">
          <Skeleton className="h-11 w-28" />
          <Skeleton className="h-11 w-48" />
        </div>
      </div>

      {/* The certificate. A real nb-box, so the card's own rules are already
          correct while its contents are still arriving. */}
      <div className="nb-box relative mx-auto max-w-[56rem] px-[clamp(1.3rem,4vw,3.4rem)] py-[clamp(2rem,4.5vw,3.2rem)]">
        {/* The stamp, pressed into the corner from sm up. */}
        <div className="mb-[clamp(1.4rem,3vw,2rem)] flex justify-center sm:absolute sm:right-[clamp(1.4rem,4vw,3.2rem)] sm:top-[clamp(1.6rem,4vw,2.8rem)] sm:mb-0 sm:block">
          <Skeleton className="h-[7.4rem] w-[9.5rem] rotate-[-4.5deg]" />
        </div>

        {/* Logotype. */}
        <Skeleton className="mx-auto h-7 w-40" />

        {/* "certificate of completion" */}
        <Skeleton className="mx-auto mt-[clamp(1.6rem,3.4vw,2.4rem)] h-4 w-56 max-w-full" />

        {/* "This certifies that" */}
        <Skeleton className="mx-auto mt-[clamp(1.4rem,3vw,2.2rem)] h-5 w-40" />

        {/* The recipient's name, set at h1 scale. */}
        <Skeleton className="mx-auto mt-2 h-[2.6rem] w-[18rem] max-w-full sm:h-[3.6rem] sm:w-[26rem]" />

        {/* The department, ruled off on both sides. */}
        <div className="mx-auto mt-[clamp(1.3rem,2.8vw,1.9rem)] flex max-w-[34rem] items-center gap-4">
          <span aria-hidden="true" className="h-0.5 flex-1 bg-[var(--rule)]" />
          <Skeleton className="h-5 w-48 shrink-0" />
          <span aria-hidden="true" className="h-0.5 flex-1 bg-[var(--rule)]" />
        </div>

        {/* The citation: two lines wide, four on a phone. */}
        <div className="mx-auto mt-[clamp(1rem,2.2vw,1.5rem)] flex max-w-[52ch] flex-col items-center gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full sm:w-4/5" />
          <Skeleton className="h-4 w-full sm:hidden" />
          <Skeleton className="h-4 w-2/3 sm:hidden" />
        </div>

        {/* Signature row: date, team, founder. */}
        <div className="nb-rule mx-auto mt-[clamp(1.8rem,3.6vw,2.6rem)] grid max-w-[44rem] gap-x-8 gap-y-5 pt-[clamp(1.1rem,2.4vw,1.6rem)] sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-5 w-36 max-w-full" />
              <Skeleton className="mt-1 h-3.5 w-28 max-w-full" />
            </div>
          ))}
        </div>

        {/* Credential id. */}
        <Skeleton className="mx-auto mt-[clamp(1.2rem,2.4vw,1.7rem)] h-4 w-36" />
      </div>
    </section>
  );
}
