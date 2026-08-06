import * as React from "react";
import { cn, clampPct } from "@/lib/utils";

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
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
    >
      <div
        className={cn(
          "h-full rounded-full bg-brand transition-[width] duration-700 ease-out",
          barClassName
        )}
        style={{ width: `${pct}%`, ...style }}
      />
    </div>
  );
}
