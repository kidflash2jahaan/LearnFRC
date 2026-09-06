import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A placeholder that pulses, because a frozen grey block reads as broken
 * rather than as loading. `nb-skeleton` stops the pulse under reduced motion.
 *
 * Hidden from assistive tech: there is nothing here to announce, and the
 * loading state itself belongs on the region that is waiting. A caller can
 * still override it through the spread.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("nb-skeleton", className)} {...props} />;
}
