import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading UI for /certificate/[department].
 *
 * THE STATE THIS MATCHES, AND WHY. The route renders two mutually exclusive
 * layouts: a locked "in progress" card in a `max-w-2xl` column, and the earned,
 * printable certificate in a `max-w-4xl` one. A single skeleton cannot be both,
 * so it is built for the earned state — because the only link to this route in
 * the whole app is the "Get certificate" CTA in `guides/[department]/_progress-islands.tsx`,
 * which renders exclusively when `complete === true`. A visitor who has not
 * finished the department has no in-app way to arrive here.
 *
 * Everything below is copied from the earned branch of page.tsx: the same
 * `max-w-4xl px-4 pb-12 pt-28 sm:px-6` column (note: no `lg:px-8` on this
 * route), the same chrome row, the same `rounded-[28px]` certificate with its
 * `p-6 sm:p-10` shell and `px-2 py-4 sm:px-8 sm:py-6` inner block, and the
 * 160px seal.
 *
 * Stops after the three-up stat strip. Below that the page has a TeamChallenge
 * panel gated on `profile.username` and a tip line — far below the fold, and not
 * worth guessing at.
 */
export default function CertificateLoading() {
  return (
    <div className="relative overflow-x-clip">
      <div className="mx-auto max-w-4xl px-4 pb-12 pt-28 sm:px-6">
        {/* Page chrome — back link, share, print (all min-h-[44px]) */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-11 w-44 rounded-2xl" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-11 w-28 rounded-2xl" />
            <Skeleton className="h-11 w-44 rounded-2xl" />
          </div>
        </div>

        {/* "Credential earned" chip */}
        <div className="mb-5 flex justify-center">
          <Skeleton className="h-8 w-48 rounded-full" />
        </div>

        {/* ============ THE CERTIFICATE (printable artifact) ============ */}
        <div className="rounded-[28px] border border-border bg-card p-6 shadow-[0_28px_70px_-28px_rgba(37,96,230,0.4)] sm:p-10">
          <div className="px-2 py-4 text-center sm:px-8 sm:py-6">
            {/* Wordmark */}
            <div className="flex items-center justify-center gap-2.5">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="h-6 w-28" />
            </div>

            {/* "Certificate of Completion" */}
            <Skeleton className="mx-auto mt-6 h-4 w-56 max-w-full" />

            {/* The signature seal (h-40 w-40) */}
            <Skeleton className="mx-auto mt-6 h-40 w-40 rounded-full" />

            {/* "This certifies that" */}
            <Skeleton className="mx-auto mt-6 h-5 w-36" />

            {/* the recipient's name — text-3xl sm:text-5xl, one line */}
            <Skeleton className="mx-auto mt-1.5 h-9 w-64 max-w-full sm:h-14 sm:w-96" />

            {/* engraved divider carrying the department name */}
            <div className="mx-auto mt-6 flex max-w-md items-center gap-3">
              <Skeleton className="h-px flex-1" />
              <Skeleton className="h-5 w-40 shrink-0" />
              <Skeleton className="h-px flex-1" />
            </div>

            {/* citation paragraph — 2 lines at sm, 4 on a phone */}
            <div className="mx-auto mt-4 max-w-lg space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full sm:w-3/4 sm:mx-auto" />
              <Skeleton className="h-4 w-full sm:hidden" />
              <Skeleton className="mx-auto h-4 w-2/3 sm:hidden" />
            </div>

            {/* Signature row — date / team / founder */}
            <div className="mt-9 flex flex-col items-stretch gap-5 border-t border-border pt-6 text-center sm:flex-row sm:items-end sm:justify-between sm:text-left">
              <div>
                <Skeleton className="mx-auto h-5 w-36 sm:mx-0" />
                <Skeleton className="mx-auto mt-1 h-3.5 w-28 sm:mx-0" />
              </div>
              <div className="sm:text-center">
                <Skeleton className="mx-auto h-5 w-28" />
                <Skeleton className="mx-auto mt-1 h-3.5 w-20" />
              </div>
              <div className="sm:text-right">
                <Skeleton className="mx-auto h-5 w-40 sm:ml-auto sm:mr-0" />
                <Skeleton className="mx-auto mt-1 h-3.5 w-32 sm:ml-auto sm:mr-0" />
              </div>
            </div>

            {/* Credential id */}
            <div className="mt-5 flex items-center justify-center gap-2">
              <Skeleton className="h-6 w-6 rounded-md" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>

        {/* Stat strip — lessons / modules / percent */}
        <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="ac-card h-full p-4 text-center">
              <Skeleton className="mx-auto h-7 w-16 sm:h-8" />
              <Skeleton className="mx-auto mt-1.5 h-4 w-24 max-w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
