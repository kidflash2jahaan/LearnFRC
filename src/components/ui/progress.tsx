import * as React from "react";
import { cn, clampPct } from "@/lib/utils";

/**
 * An ink trough with a ballpoint fill. Always print the figure next to it at
 * the call site: the bar alone is one colour against one colour, so a reader
 * who cannot judge that ratio by eye gets nothing from it. `aria-valuenow`
 * covers screen readers, not the person squinting at a photocopy.
 *
 * The width is a real number from real data, so it is set inline. Nothing
 * about it animates: this is a mark on paper, not a filling gauge.
 */
export function Progress({
  value,
  className,
  barClassName,
  style,
  indeterminate,
}: {
  value: number;
  className?: string;
  barClassName?: string;
  style?: React.CSSProperties;
  indeterminate?: boolean;
}) {
  const pct = clampPct(value);
  return (
    <div
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("nb-meter w-full", className)}
    >
      <span className={cn("nb-meter-bar", barClassName)} style={{ width: `${pct}%`, ...style }} />
    </div>
  );
}
