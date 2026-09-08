import { CheckCircle2 } from "lucide-react";

/**
 * The accuracy check mark on a lesson.
 *
 * The date comes along for free (it is stamped when the box is ticked) and it
 * is worth showing: "verified" on its own is a claim, "verified on 8 Sep 2026"
 * is a claim a reader can weigh against a rule change. Nothing else is asked
 * for, so ticking a lesson stays a one-click job.
 *
 * The unchecked state renders too, rather than showing nothing. If unchecked
 * lessons were silent, a reader who happened to open two checked ones would
 * assume the whole catalogue had been done, and the badge would mean nothing.
 */
export function VerifiedBadge({
  verifiedAt,
}: {
  verifiedAt: string | null;
}) {
  if (!verifiedAt) {
    return <p className="nb-slug text-[var(--graphite)]">not verified yet</p>;
  }

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
