import { CheckCircle2 } from "lucide-react";

/**
 * The accuracy check mark on a lesson.
 *
 * Renders only once a lesson has been verified. An unverified lesson shows
 * nothing at all, so the mark reads as a positive signal on the pages that
 * carry it rather than as a warning on the ones that do not.
 *
 * The date comes along for free, stamped when the box is ticked. It is worth
 * showing: "verified" on its own is a claim, "verified on 8 Sep 2026" is a
 * claim a reader can weigh against a rule change.
 */
export function VerifiedBadge({
  verifiedAt,
}: {
  verifiedAt: string | null;
}) {
  if (!verifiedAt) return null;

  const when = new Date(verifiedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0 text-[var(--blue)]" />
      <span className="nb-slug text-[var(--ink)]">verified</span>
      <span className="text-[0.88rem] text-[var(--graphite)]">
        checked against primary sources on {when}
      </span>
    </p>
  );
}
