import { CheckCircle2 } from "lucide-react";

/**
 * The accuracy check mark on a lesson.
 *
 * WHY THIS IS WORDED THE WAY IT IS. The loudest criticism this site has ever
 * received is that its lessons read as machine-generated and unchecked. A badge
 * that answers that with the word "Verified" and nothing else answers a
 * specific accusation with a vague claim, which is worse than saying nothing:
 * it is exactly the move a reader who already distrusts the site expects.
 *
 * So this never says "verified" on its own. It always carries WHO checked it
 * and WHEN, and where a note exists, WHAT they changed. Those three facts make
 * the claim falsifiable, and a falsifiable claim is the only kind worth making
 * here. A reader who doubts it can go and check the same source.
 *
 * The unchecked state is a first-class rendering, not an absence. Most lessons
 * will be unchecked for months, and quietly showing nothing on those would let
 * a reader assume the whole catalogue had been checked because the pages they
 * happened to open carried a badge. Saying "not checked yet" out loud is the
 * honest default, and it is also what makes the checked badge mean anything.
 */
export function VerifiedBadge({
  verifiedAt,
  verifiedBy,
  note,
  sources,
  compact = false,
}: {
  verifiedAt: string | null;
  verifiedBy: string | null;
  note?: string | null;
  sources?: string[] | null;
  compact?: boolean;
}) {
  const checked = Boolean(verifiedAt && verifiedBy);

  if (!checked) {
    if (compact) return null;
    return (
      <p className="nb-slug text-[var(--graphite)]">
        not fact-checked yet
      </p>
    );
  }

  const when = new Date(verifiedAt as string).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  if (compact) {
    return (
      <span
        className="nb-slug inline-flex items-center gap-1 text-[var(--blue)]"
        title={`Checked by ${verifiedBy} on ${when}`}
      >
        <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
        checked
      </span>
    );
  }

  return (
    <div className="nb-box mt-6 p-[clamp(0.9rem,2vw,1.2rem)]">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0 text-[var(--blue)]" />
        <span className="nb-slug text-[var(--ink)]">fact-checked</span>
        <span className="text-[0.9rem] text-[var(--graphite)]">
          by {verifiedBy} on {when}
        </span>
      </p>
      {note ? (
        <p className="mt-2 text-[0.9rem] leading-relaxed text-[var(--graphite)]">
          {note}
        </p>
      ) : null}
      {sources && sources.length > 0 ? (
        <p className="mt-2 text-[0.85rem] leading-relaxed text-[var(--graphite)]">
          Checked against: {sources.join(", ")}
        </p>
      ) : null}
      {/* The limit of the claim, stated by the badge itself rather than left
          for a reader to discover. A check is a person reading it once against
          the sources named above; it is not a guarantee, and the game manual
          moves every season. */}
      <p className="mt-2 text-[0.8rem] leading-relaxed text-[var(--graphite)]">
        This means a person read it against those sources on that date. It does
        not mean it cannot be wrong, and rules change between seasons. If you
        spot something off, say so and it gets fixed.
      </p>
    </div>
  );
}
