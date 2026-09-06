import Link from "next/link";
import type { BadgeProgress } from "@/lib/streaks";
import { cn } from "@/lib/utils";

/**
 * "Next unlock": one reachable badge, and the distance to it.
 *
 * The achievements grid is eleven badges and a new account has none of them, so
 * the section reads as eleven locked boxes: a scoreboard of things not done.
 * This lifts the single nearest one out of the grid and states the gap in
 * lessons, which is the only number a learner can act on.
 *
 * It adds no data. `progress` comes from `achievementProgress()`, which reads
 * the same `criteria` shapes (`lessons` / `departments` / `streak`) that
 * `awardAchievements()` already awards against. Pick the badge with
 * `pickNextUnlock()`.
 *
 * Renders nothing when there is no next badge, so the caller needs no guard.
 *
 * Server Component. Nothing here reads a clock or a browser API.
 */
export function NextUnlock({
  name,
  description,
  progress,
  href,
  className,
}: {
  name: string;
  description: string;
  /**
   * Icon NAME, still accepted so the department page does not have to change.
   * The binder draws no icons: a badge is identified by its name and by the
   * figure beside it, both of which survive a photocopy.
   */
  icon?: string;
  progress: BadgeProgress | null | undefined;
  /** Optional target for the whole card, e.g. the next lesson. */
  href?: string;
  /** Accepted for compatibility. There is one accent, so it is ignored. */
  accent?: string;
  className?: string;
}) {
  if (!progress || progress.target <= 0) return null;
  const remaining = Math.max(0, progress.target - progress.current);
  if (remaining <= 0) return null;

  const pct = Math.max(
    0,
    Math.min(100, Math.round((progress.current / progress.target) * 100))
  );
  const unit =
    remaining === 1 && progress.unit.endsWith("s")
      ? progress.unit.slice(0, -1)
      : progress.unit;

  const body = (
    <>
      <span className="min-w-0">
        <span className="nb-slug block">next unlock</span>
        <span className="mt-1 block truncate text-[1.02rem] font-bold leading-tight">
          {name}
        </span>
        <span className="mt-1 block text-[0.9rem] leading-snug text-graphite">
          {remaining} more {unit}. {description}
        </span>
      </span>

      {/* The figure is printed next to the trough, always. A bar alone is one
          colour against one colour, which tells a reader who cannot judge the
          ratio by eye nothing at all. */}
      <span className="w-full shrink-0 sm:w-[9rem]">
        <span className="nb-slug flex items-baseline justify-between gap-2">
          <span>progress</span>
          <span className="font-bold text-ink">
            {progress.current}/{progress.target}
          </span>
        </span>
        <span className="nb-meter mt-1.5 block">
          <span className="nb-meter-bar" style={{ width: `${pct}%` }} />
        </span>
      </span>
    </>
  );

  const classes = cn(
    "nb-box flex flex-col items-start gap-4 p-[clamp(0.95rem,2vw,1.3rem)] sm:flex-row sm:items-center sm:justify-between sm:gap-6",
    href && "nb-lift",
    className
  );

  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
