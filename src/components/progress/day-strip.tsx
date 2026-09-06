import type { DayCell } from "@/lib/streaks";
import { cn } from "@/lib/utils";

/**
 * Seven days, ruled off like the attendance row at the top of a shop log.
 *
 * The measured reason it exists: coming back on a SECOND distinct day is worth
 * ~1.7x on d21 survival on top of lesson depth (5+ lessons on one day -> 24%,
 * 5+ across two days -> 41%). A learner cannot aim at a number they cannot see,
 * so the days get drawn. What is deliberately NOT drawn: a broken chain, a
 * "missed" mark, or anything that scores an empty day. An empty day is an empty
 * cell, styled the same as a day that has not happened yet, because morally it
 * is the same thing.
 *
 * Today is marked twice, never by colour alone: the weekday letter goes bold
 * ink, and a short blue pen stroke sits under the cell. A filled day is marked
 * twice as well, by the blue fill AND by the count when more than one landed.
 *
 * Server Component. `label`, `isToday` and `isFuture` all arrive pre-computed
 * from `computeRhythm` on the server, so nothing here reads a clock and the
 * first paint is the final paint.
 */
export function DayStrip({
  days,
  className,
}: {
  days: readonly DayCell[];
  /**
   * Accepted for compatibility with the department page, which still passes a
   * department hex. The binder has one accent, so the colour is ignored: a
   * department is identified by its name and its slug, never by a hue.
   */
  accent?: string;
  className?: string;
}) {
  return (
    <ul
      className={cn("flex items-end gap-1.5 sm:gap-2", className)}
      aria-label="Lessons completed each day this week"
    >
      {days.map((d) => {
        const done = d.count > 0;
        return (
          <li key={d.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span
              className={cn(
                "font-mono text-[0.68rem] leading-none",
                d.isToday ? "font-bold text-ink" : "text-graphite"
              )}
              aria-hidden="true"
            >
              {d.label.slice(0, 1)}
            </span>

            <span
              className={cn(
                "flex h-9 w-full items-center justify-center border-2 font-mono text-[0.8rem] font-bold tabular-nums",
                done
                  ? "border-[var(--blue)] bg-[var(--blue)] text-card"
                  : d.isFuture
                    ? "border-dashed border-rule text-graphite"
                    : "border-rule bg-paper text-graphite"
              )}
              style={{ borderRadius: "var(--hand-s)" }}
            >
              {/* The figure is only worth printing when more than one lesson
                  landed: a single lesson reads better as a solid block. Screen
                  readers get the full sentence either way. */}
              <span aria-hidden="true">{d.count > 1 ? d.count : ""}</span>
              <span className="sr-only">
                {d.label}
                {d.isToday ? " (today)" : ""}:{" "}
                {d.isFuture
                  ? "still to come"
                  : d.count === 0
                    ? "no lessons"
                    : d.count === 1
                      ? "1 lesson"
                      : `${d.count} lessons`}
              </span>
            </span>

            {/* The pen stroke under today. Two marks for one state, so it
                survives greyscale and a colour-blind reader. */}
            <span
              aria-hidden="true"
              className={cn(
                "block h-[3px] w-full",
                d.isToday ? "bg-[var(--blue)]" : "bg-transparent"
              )}
            />
          </li>
        );
      })}
    </ul>
  );
}
