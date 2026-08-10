import type { CSSProperties } from "react";
import type { DayCell } from "@/lib/streaks";
import { cn } from "@/lib/utils";

/**
 * Seven days, as a record of what happened — not a chain to be protected.
 *
 * The measured reason this exists: coming back on a SECOND distinct day is
 * worth ~1.7x on d21 survival on top of lesson depth (5+ lessons on one day →
 * 24%, 5+ across two days → 41%). A learner cannot aim at a number they can't
 * see, so the days are drawn. What is deliberately NOT drawn: a break in a
 * chain, a red "missed" marker, or anything that scores an empty day. An empty
 * day is simply an empty square, styled the same as a day that hasn't happened
 * yet, because morally it is the same thing — a day with no lesson on it,
 * which costs the learner nothing.
 *
 * Server Component: `label`, `isToday` and `isFuture` are all computed on the
 * server by `computeRhythm`, so nothing here reads a clock and the first paint
 * is the final paint. Colours are inline styles rather than Tailwind ring/bg
 * utilities so the accent can be any department hex.
 */
export function DayStrip({
  days,
  accent = "#2560e6",
  className,
}: {
  days: readonly DayCell[];
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
        const style: CSSProperties = {};
        if (done) {
          style.backgroundImage = `linear-gradient(140deg, ${accent}, color-mix(in srgb, ${accent} 58%, #ffffff))`;
          style.color = "#0d1524";
          style.borderColor = "transparent";
        }
        if (d.isToday) {
          // Explicit box-shadow ring: works with an arbitrary hex accent and
          // doesn't depend on Tailwind's ring custom-property names.
          style.boxShadow = `0 0 0 2px var(--background), 0 0 0 4px ${accent}`;
        }

        return (
          <li key={d.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.08em]",
                d.isToday ? "text-foreground" : "text-muted-foreground"
              )}
              aria-hidden
            >
              {d.label.slice(0, 1)}
            </span>
            <span
              className={cn(
                "flex h-9 w-full items-center justify-center rounded-lg border text-[13px] font-bold tabular-nums",
                !done &&
                  (d.isFuture
                    ? "border-dashed border-border/70 bg-transparent"
                    : "border-border bg-muted/50")
              )}
              style={style}
            >
              {/* The number is only worth printing when more than one lesson
                  landed that day; a single lesson reads better as a solid
                  block. Screen readers get the full sentence either way. */}
              <span aria-hidden>{d.count > 1 ? d.count : ""}</span>
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
          </li>
        );
      })}
    </ul>
  );
}
