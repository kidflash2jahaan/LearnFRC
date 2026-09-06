import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The mono caption written above a control. It carries no margin of its own:
 * the gap between a label, its control and its hint belongs to the `nb-field`
 * grid that wraps all three, so putting one here would fight that gap and
 * every form would space differently depending on which it inherited.
 */
export function Label({
  className,
  ref,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { ref?: React.Ref<HTMLLabelElement> }) {
  return <label ref={ref} className={cn("nb-label", className)} {...props} />;
}
