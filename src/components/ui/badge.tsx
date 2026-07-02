import * as React from "react";
import { cn } from "@/lib/utils";

/** Arena Clay 2 badge — soft legible pill tints; same exported API. */

const VARIANTS: Record<string, string> = {
  default: "bg-primary/10 text-primary border-primary/25",
  secondary: "bg-secondary text-secondary-foreground border-border",
  accent: "bg-accent/10 text-[#0e7490] border-accent/30",
  success: "bg-[#12b565]/12 text-success border-[#12b565]/30",
  warning: "bg-warning/10 text-warning border-warning/30",
  destructive: "bg-destructive/10 text-destructive border-destructive/30",
  outline: "bg-transparent text-foreground border-border",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: keyof typeof VARIANTS | (string & {});
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        VARIANTS[variant] ?? VARIANTS.default,
        className
      )}
      {...props}
    />
  );
}
