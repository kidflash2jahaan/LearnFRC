import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The LearnFRC logotype: the name written out in the binder's own hand, with
 * the last syllable boxed in ballpoint the way you box a part number you keep
 * having to look up. There is no mark and no tile. The site owns exactly one
 * decorative gesture per element and here it is the box, so an icon beside it
 * would be a second one competing for the same job.
 *
 * `nb-brand` carries the weight, the tracking and the drawn box on the <b>.
 * Size is set here rather than in the kit because the header and the footer
 * want different ones off the same class.
 */
export function Logo({
  className,
  textClassName,
}: {
  className?: string;
  /** Applied to the wordmark itself, so a caller can resize it without
   *  disturbing the link box that holds the focus ring. */
  textClassName?: string;
}) {
  return (
    <Link
      href="/"
      aria-label="LearnFRC, home"
      /* min-h-11 is the 44px touch floor. The logotype's own line box is only
         38px tall, and this is the first link on every page. */
      className={cn("nb-brand min-h-11 text-[1.22rem]", className)}
    >
      <span className={textClassName}>
        learn<b>FRC</b>
      </span>
    </Link>
  );
}
