import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Icon } from "@/lib/icon-map";
import type { BadgeProgress } from "@/lib/streaks";
import { cn } from "@/lib/utils";

/**
 * "Next unlock" — one reachable badge, with the distance to it.
 *
 * The achievements grid is eleven badges and a brand-new account has none of
 * them, so the section reads as eleven padlocks: a scoreboard of things not
 * done. This card lifts the single nearest one out of the grid and states the
 * gap in lessons, which is the only number a learner can act on.
 *
 * It extends the existing `achievements` / `user_achievements` tables rather
 * than adding anything: `progress` comes from `achievementProgress()`, which
 * reads the same `criteria` shapes (`lessons` / `departments` / `streak`) that
 * `awardAchievements()` in src/app/actions/progress.ts already awards against.
 * Pick the badge with `pickNextUnlock()`.
 *
 * Renders nothing when there is no next badge (everything earned, or nothing
 * measurable), so the caller doesn't need a guard.
 *
 * Server Component: icons arrive as string names resolved through the shared
 * icon map, nothing reads a clock, and there is no client state.
 */
export function NextUnlock({
  name,
  description,
  icon,
  progress,
  href,
  accent = "#f5a623",
  className,
}: {
  name: string;
  description: string;
  /** Icon NAME, resolved through the shared map — never a component. */
  icon: string;
  progress: BadgeProgress | null | undefined;
  /** Optional target for the whole row, e.g. the next lesson. */
  href?: string;
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
      <span className="flex min-w-0 items-center gap-3">
        <span
          className="ac-badge flex h-11 w-11 shrink-0 items-center justify-center"
          style={{ "--a": accent } as CSSProperties}
        >
          <Icon name={icon} className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Next unlock
          </span>
          <span className="block truncate text-[15px] font-bold text-foreground">
            {name}
          </span>
          <span className="block truncate text-sm text-muted-foreground">
            {remaining} more {unit} — {description}
          </span>
        </span>
      </span>
      <span className="hidden shrink-0 items-center gap-3 sm:flex">
        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full"
            style={{
              width: `${pct}%`,
              backgroundImage: `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 55%, #ffffff))`,
            }}
          />
        </span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {progress.current}/{progress.target}
        </span>
        {href && (
          <ArrowRight className="h-4 w-4 text-primary" aria-hidden />
        )}
      </span>
    </>
  );

  const classes = cn(
    "ac-card flex items-center justify-between gap-4 p-4",
    href &&
      "group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
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
