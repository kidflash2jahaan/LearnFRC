import { Skeleton } from "@/components/ui/skeleton";

/**
 * /unsubscribe is `force-dynamic` and writes before it renders: every visit
 * runs an UPDATE ... RETURNING against `profiles` to flip `email_opt_in`, and
 * nothing can be sent until Supabase answers. It is also reached almost
 * exclusively as a COLD page load from a link in an email rather than as a
 * client navigation, which is exactly where a loading fallback pays: the
 * shell streams while the write is still in flight instead of the reader
 * staring at a blank tab.
 *
 * Geometry is copied from src/app/unsubscribe/page.tsx:
 *  - `mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center
 *     px-4 py-28 text-center`, card `ac-glass w-full rounded-2xl p-8`.
 *    (`rounded-2xl` is load-bearing: `.ac-glass` is a 28px radius, and the
 *    utility overrides it to 16px because @layer components loses to
 *    utilities. The skeleton has to override it the same way.)
 *
 * Modelled on the SUCCESS state — icon, headline, two-line body, the
 * "Resubscribe" ghost button and the "Back to LearnFRC" link. That is the
 * state a link from a mail we actually sent lands in; the "Link not
 * recognized" branch is the exception and is ~44px shorter (no resubscribe
 * action), which in a `justify-center` column reads as a ~22px settle rather
 * than a jump. Matching the common state and eating the error state's small
 * settle is the better trade than matching neither.
 */
export default function UnsubscribeLoading() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-28 text-center">
      <div className="ac-glass w-full rounded-2xl p-8">
        {/* Status icon (h-10 w-10, mb-4). */}
        <Skeleton className="mx-auto mb-4 h-10 w-10 rounded-full" />

        {/* "You're unsubscribed" — text-2xl, one line. */}
        <Skeleton className="mx-auto h-8 w-56 rounded-xl" />

        {/* Body copy: two lines at 15px/leading-relaxed. */}
        <div className="mt-3 space-y-2.5">
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="mx-auto h-4 w-4/5 rounded-md" />
        </div>

        {/* Resubscribe — `.ac-btn-ghost` is min-h-11 with a 16px radius. */}
        <Skeleton className="mx-auto mt-6 h-11 w-64 rounded-2xl" />

        {/* "Back to LearnFRC". */}
        <Skeleton className="mx-auto mt-6 h-5 w-36 rounded-md" />
      </div>
    </main>
  );
}
