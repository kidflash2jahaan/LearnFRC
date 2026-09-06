import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A chip torn off the same card stock: mono, drawn edge, small hand radius.
 * Seven variant names resolve onto four treatments, because the palette has
 * one accent and no status hues. Each treatment differs in edge weight or
 * fill, not only in colour, so a chip still reads correctly photocopied:
 *
 *   drawn   the default label
 *   filled  something earned or affirmed (the one blue chip)
 *   quiet   incidental metadata, dashed and graphite
 *   heavy   the one you are meant to stop at, 3px ink like `nb-error`
 */
const VARIANTS: Record<string, string> = {
  default: "",
  accent: "border-[var(--blue)] bg-[var(--blue)] text-[var(--card)]",
  success: "border-[var(--blue)] bg-[var(--blue)] text-[var(--card)]",
  outline: "border-dashed border-[var(--rule)] text-[var(--graphite)]",
  secondary: "border-dashed border-[var(--rule)] text-[var(--graphite)]",
  warning: "border-[3px] font-bold",
  destructive: "border-[3px] font-bold",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: keyof typeof VARIANTS | (string & {});
}) {
  return (
    <span className={cn("nb-tag", VARIANTS[variant] ?? VARIANTS.default, className)} {...props} />
  );
}
