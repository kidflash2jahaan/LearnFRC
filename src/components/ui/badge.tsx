import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Arena Clay badge — a glossy clay-glass pill.
 * Built on the `aq-chip` foundation (frosted white glass, soft blue border,
 * rounded-full) with a per-variant translucent color wash + matching ink.
 * Hover gives a gentle lift/shine; each variant stays legible (dark same-family
 * ink on its own tint) to hold ≥4.5:1 contrast.
 */
const variants = {
  default:
    "aq-chip text-foreground",
  primary:
    "aq-chip !border-primary/30 !bg-primary/12 text-primary",
  accent:
    "aq-chip !border-accent/35 !bg-accent/12 text-[color-mix(in_srgb,var(--accent)_78%,#0b2b38)]",
  success:
    "aq-chip !border-success/35 !bg-success/14 text-[color-mix(in_srgb,var(--success)_70%,#0a3d24)]",
  warning:
    "aq-chip !border-warning/40 !bg-warning/16 text-[color-mix(in_srgb,var(--warning)_60%,#4a3400)]",
  outline:
    "aq-chip !bg-transparent text-muted-foreground",
} as const;

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: keyof typeof variants;
}) {
  return (
    <span
      className={cn(
        // aq-chip already gives rounded-full glass pill w/ padding + font.
        // Tighten padding/size for a compact inline badge and add hover lift.
        "!gap-1.5 !px-2.5 !py-0.5 !text-xs font-semibold leading-none",
        "shadow-[0_1px_2px_rgba(60,90,140,0.08)] backdrop-blur-sm",
        "transition-[transform,box-shadow,background-color] duration-200 ease-out",
        "hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(60,90,140,0.16)]",
        "aq-reveal",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
