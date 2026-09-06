import { Skeleton } from "@/components/ui/skeleton";

/**
 * /unsubscribe is `force-dynamic` and writes before it renders: every visit
 * runs an UPDATE ... RETURNING against `profiles` to flip `email_opt_in`, and
 * nothing can be sent until Supabase answers. It is also reached almost
 * exclusively as a COLD page load from a link in an email rather than as a
 * client navigation, which is exactly where a loading fallback pays: the card
 * is on the paper while the write is still in flight instead of the reader
 * staring at a blank tab.
 *
 * Geometry is copied from src/app/unsubscribe/page.tsx, and the card is drawn
 * with its real chrome, tilt and tape rather than as a grey slab, so the ink
 * edge does not appear late. Modelled on the SUCCESS branch, which is where a
 * link from a mail we actually sent lands; the rejected-link branch is about
 * one button shorter, and in a `justify-center` column that reads as a small
 * settle rather than a jump.
 */
export default function UnsubscribeLoading() {
  return (
    <div className="nb-wrap flex min-h-[70dvh] max-w-[36rem] flex-col justify-center py-[clamp(2.5rem,6vw,4rem)]">
      <div className="nb-box nb-tilt-1 p-[clamp(1.3rem,3vw,2rem)]">
        <span
          className="nb-tape -top-3 left-[22%] rotate-[-3.4deg]"
          aria-hidden="true"
        />
        <span
          className="nb-tape -bottom-3 right-[18%] rotate-[2.5deg]"
          aria-hidden="true"
        />

        {/* "learnfrc / learning reminders" */}
        <Skeleton className="h-3.5 w-56 max-w-full" />

        {/* headline, one line at this measure */}
        <Skeleton className="mt-3 h-[clamp(1.75rem,1.3rem+1.6vw,2.4rem)] w-4/5" />

        {/* body copy, three lines */}
        <div className="mt-4">
          <Skeleton className="h-4" />
          <Skeleton className="mt-2 h-4" />
          <Skeleton className="mt-2 h-4 w-2/3" />
        </div>

        {/* the state line under the hairline */}
        <div className="nb-hair mt-6 flex items-baseline justify-between gap-6 pt-4">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-5 w-10" />
        </div>

        {/* one filled action plus the undo */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Skeleton className="h-11 w-44" />
          <Skeleton className="h-11 w-48" />
        </div>
      </div>
    </div>
  );
}
