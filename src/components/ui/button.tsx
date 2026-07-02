import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

/**
 * Arena Clay 2 button. Same public API (variant/size/asChild) as before so
 * functional components keep compiling; brand-new skin on the ac system.
 */
const VARIANTS: Record<string, string> = {
  brand: "ac-btn",
  primary: "ac-btn",
  ghost: "ac-btn-ghost",
  outline: "ac-btn-ghost",
  secondary:
    "inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-secondary px-5 py-3 font-semibold text-secondary-foreground shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  destructive:
    "inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-destructive px-5 py-3 font-semibold text-destructive-foreground shadow-[var(--shadow-md)] transition-all hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive",
  success:
    "inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-[#12b565] px-5 py-3 font-semibold text-white shadow-[var(--shadow-md)] transition-all hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a7a43]",
  warning:
    "inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-[#f5b23d] px-5 py-3 font-semibold text-[#4a3203] shadow-[var(--shadow-md)] transition-all hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning",
  accent:
    "inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-accent px-5 py-3 font-semibold text-accent-foreground shadow-[var(--glow-accent)] transition-all hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
};

const SIZES: Record<string, string> = {
  sm: "min-h-9 px-3.5 py-2 text-sm rounded-xl",
  md: "px-5 py-3 text-sm",
  lg: "px-6 py-3.5 text-base",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS | (string & {});
  size?: keyof typeof SIZES | (string & {});
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "brand", size = "md", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          VARIANTS[variant] ?? VARIANTS.brand,
          SIZES[size] ?? SIZES.md,
          "cursor-pointer disabled:pointer-events-none disabled:opacity-55",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
