import { cn } from "@/lib/utils";

/**
 * The week's count, written the way a count is written on paper: the figure
 * first, the trough under it, the window named beneath.
 *
 * It used to be a segmented SVG dial. The binder has one radius system and no
 * circles outside an avatar, and a five-unit total is a figure, not an arc: a
 * reader gets "2 of 5" faster from two characters than from a gauge they have
 * to estimate. The meter stays because it is the fastest read of "how much is
 * left", and the number is printed beside it so the bar is never the only way
 * to know.
 *
 * ZERO STATE is the branch this is tuned for. A brand-new learner sees `0/5`
 * and an empty trough, which is a shape to fill, not a monument to having done
 * nothing.
 *
 * Server Component: no clock, no hook, no client state, so the markup the
 * server sends is the final markup.
 */
export function WeekRing({
  count,
  goal,
  label,
  className,
}: {
  /** Lessons completed in the window. Values above `goal` still fill it. */
  count: number;
  goal: number;
  /** Caption under the figure, e.g. "this week". */
  label?: string;
  /**
   * Accepted for compatibility with callers that still describe the old dial
   * (`size`, `stroke`, `from`, `to`). The binder draws one shape at one scale
   * in one accent, so all four are ignored.
   */
  size?: number;
  stroke?: number;
  from?: string;
  to?: string;
  className?: string;
}) {
  const safeGoal = Math.max(1, Math.floor(goal));
  const filled = Math.max(0, Math.min(safeGoal, Math.floor(count)));
  const pct = Math.round((filled / safeGoal) * 100);

  return (
    <div className={cn("min-w-[8.5rem]", className)}>
      <p className="font-mono text-[clamp(2.4rem,1.6rem+2.4vw,3.4rem)] font-bold leading-none tabular-nums text-[var(--blue)]">
        {filled}
        <span className="text-graphite">/{safeGoal}</span>
      </p>

      <span className="nb-meter mt-3 block">
        <span className="nb-meter-bar" style={{ width: `${pct}%` }} />
      </span>

      {label && <p className="nb-slug mt-2">{label}</p>}
    </div>
  );
}
