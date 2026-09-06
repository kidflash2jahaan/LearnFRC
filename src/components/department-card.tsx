import Link from "next/link";
import { cn } from "@/lib/utils";

/** Four angles, so no two cards next to each other were straightened the same. */
const TILT = ["nb-tilt-1", "nb-tilt-2", "nb-tilt-3", "nb-tilt-4"] as const;

/**
 * One department, as an index card taped to the wall.
 *
 * The old tile identified a department by a coloured icon badge and a coloured
 * progress bar. In this system a department is identified by its name and its
 * mono slug, full stop: there are no per-department hues, so the card leads
 * with `dept / electrical-wiring` and lets the name do the rest. The count in
 * the footer is the one figure that matters on a wall of eleven of these, so it
 * gets the blue and the mono numerals.
 *
 * No motion of its own. `.nb-lift` is CSS, so this is a Server Component: it
 * was previously a client component solely to run a hover spring.
 */
export function DepartmentCard({
  slug,
  name,
  tagline,
  moduleCount,
  lessonCount,
  progressPct,
  index,
}: {
  slug: string;
  name: string;
  tagline: string | null;
  moduleCount?: number;
  lessonCount?: number;
  progressPct?: number;
  /** Only decides which of the four tilts this card gets. */
  index?: number;
}) {
  const hasLessons = typeof lessonCount === "number" && lessonCount > 0;
  const hasModules = typeof moduleCount === "number" && moduleCount > 0;
  const hasProgress = typeof progressPct === "number";
  const tilt = TILT[(index ?? 0) % TILT.length];

  return (
    <Link
      href={`/guides/${slug}`}
      className={cn(
        "nb-box nb-lift group flex h-full flex-col p-[clamp(1rem,1.9vw,1.45rem)]",
        tilt
      )}
    >
      <span className="nb-tape -top-3 left-4" aria-hidden="true" />

      {/* The slug line carries both identifiers, so the footer can stay two
          things wide: the figure that matters, and the way in. */}
      <p className="nb-slug flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate">dept / {slug}</span>
        {hasModules && (
          <span className="shrink-0">
            {moduleCount} {moduleCount === 1 ? "module" : "modules"}
          </span>
        )}
      </p>

      <h3 className="mt-2">{name}</h3>

      {tagline && (
        <p className="mt-2 text-[0.92rem] leading-snug text-graphite">
          {tagline}
        </p>
      )}

      {hasProgress && (
        <div className="mt-4">
          <div className="nb-slug mb-1.5 flex items-baseline justify-between gap-2">
            <span>progress</span>
            <span className="font-bold text-ink">{progressPct}%</span>
          </div>
          <span className="nb-meter block">
            <span
              className="nb-meter-bar"
              style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
            />
          </span>
        </div>
      )}

      <div className="nb-hair mt-auto flex items-baseline justify-between gap-3 pt-4">
        {hasLessons ? (
          <span className="nb-count">
            {lessonCount}
            <small>{lessonCount === 1 ? "lesson" : "lessons"}</small>
          </span>
        ) : hasModules ? (
          <span className="nb-count">
            {moduleCount}
            <small>{moduleCount === 1 ? "module" : "modules"}</small>
          </span>
        ) : (
          <span className="nb-slug">not counted yet</span>
        )}

        <span className="nb-slug border-b-2 border-b-transparent text-ink group-hover:border-b-blue group-hover:text-blue">
          open
        </span>
      </div>
    </Link>
  );
}
