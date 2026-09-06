import { cn } from "@/lib/utils";
import type { BadgeProgress } from "@/lib/streaks";

export type AchievementView = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt: string | null;
  /**
   * How close this badge is, derived from the SAME `achievements.criteria`
   * shapes the award logic already uses (see `achievementProgress` in
   * src/lib/streaks.ts) — nothing new is stored, and a caller that doesn't
   * supply it gets exactly the previous behaviour.
   *
   * Why it matters: a zero-progress learner otherwise scrolls past eleven
   * identical locked cards, which reads as a wall rather than a ladder. "3 / 5"
   * on the nearest badge turns the same grid into something aimable.
   */
  progress?: BadgeProgress | null;
};

/**
 * One badge, as a card in the badge drawer.
 *
 * THE TOOLTIP IS GONE, and that is the point of the rebuild. The old card was a
 * Client Component whose only state was a hover popover holding the badge's
 * description, plus a pulsing ring on every earned badge. A page with eleven of
 * these ran eleven hover listeners and up to eleven infinite animations to hide
 * one short sentence behind a gesture that does not exist on a phone. The
 * binder prints the sentence. No hover, no popover, no client bundle.
 *
 * STATE IS MARKED TWICE, never by colour alone: an earned badge has a solid 2px
 * ink edge and prints the date it was earned; a locked one has a dashed rule
 * edge and prints either the distance left or the word "locked". Both survive a
 * photocopy and a colour-blind reader.
 *
 * `icon` stays on the type because the database column and the award logic use
 * it, but nothing is drawn from it: the binder identifies a badge by its name.
 */
export function AchievementBadge({
  achievement,
}: {
  achievement: AchievementView;
}) {
  const { earned, name, description, earnedAt, progress } = achievement;

  // Only meaningful while locked and actually started. An untouched badge
  // shows nothing rather than a zero-width bar and a "0 / 25".
  const meter =
    !earned && progress && progress.target > 0 && progress.current > 0
      ? progress
      : null;
  const meterPct = meter
    ? Math.max(4, Math.min(100, Math.round((meter.current / meter.target) * 100)))
    : 0;
  const remaining = meter ? Math.max(0, meter.target - meter.current) : 0;
  const unit =
    meter && remaining === 1 && meter.unit.endsWith("s")
      ? meter.unit.slice(0, -1)
      : meter?.unit;

  const earnedLabel = earnedAt
    ? new Date(earnedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <article
      className={cn(
        "nb-box-sm flex h-full flex-col p-[clamp(0.85rem,1.9vw,1.15rem)]",
        !earned && "border-dashed border-[var(--rule)]"
      )}
    >
      <p className="nb-slug">
        {earned
          ? earnedLabel
            ? `earned ${earnedLabel}`
            : "earned"
          : meter
            ? `${remaining} more ${unit}`
            : "locked"}
      </p>

      <h3
        className={cn(
          "mt-1.5 text-[0.98rem] leading-tight",
          !earned && "text-graphite"
        )}
      >
        {name}
      </h3>

      <p className="mt-1.5 text-[0.84rem] leading-snug text-graphite">
        {description}
      </p>

      {meter && (
        <div className="mt-auto pt-3">
          <p className="nb-slug flex items-baseline justify-between gap-2">
            <span>progress</span>
            <span className="font-bold text-ink">
              {meter.current}/{meter.target}
            </span>
          </p>
          <span className="nb-meter mt-1.5 block">
            <span className="nb-meter-bar" style={{ width: `${meterPct}%` }} />
          </span>
        </div>
      )}
    </article>
  );
}
