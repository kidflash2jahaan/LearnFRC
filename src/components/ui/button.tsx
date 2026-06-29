import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

const variants = {
  primary:
    "bg-primary text-primary-foreground hover:brightness-110 shadow-[var(--glow-primary)] hover:shadow-[0_0_26px_-4px_var(--primary)]",
  brand:
    "bg-brand text-primary-foreground shadow-[var(--glow-primary)] hover:brightness-110 hover:shadow-[0_0_26px_-4px_var(--primary)]",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-muted border border-border",
  outline:
    "border border-border bg-transparent hover:bg-muted text-foreground",
  ghost: "text-foreground/75 hover:text-foreground hover:bg-muted",
  destructive:
    "bg-destructive text-destructive-foreground hover:brightness-110",
} as const;

const sizes = {
  sm: "h-9 px-3.5 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-5 text-sm gap-2 rounded-xl",
  lg: "h-12 px-7 text-[0.95rem] gap-2 rounded-xl",
  icon: "h-10 w-10 rounded-lg",
} as const;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap font-medium",
          "transition-all duration-200 cursor-pointer select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
