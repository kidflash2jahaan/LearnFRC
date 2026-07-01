import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

const variants = {
  primary:
    "bg-gradient-to-br from-[#3b78f2] to-[#149fd0] text-white shadow-[0_10px_22px_rgba(37,96,230,0.26),inset_0_1px_0_rgba(255,255,255,0.5)] hover:brightness-[1.05] hover:-translate-y-0.5",
  brand:
    "bg-gradient-to-br from-[#3b78f2] to-[#149fd0] text-white shadow-[0_10px_22px_rgba(37,96,230,0.26),inset_0_1px_0_rgba(255,255,255,0.5)] hover:brightness-[1.05] hover:-translate-y-0.5",
  secondary:
    "bg-white/70 text-foreground border border-white/80 shadow-[0_6px_16px_rgba(60,95,160,0.12)] hover:bg-white backdrop-blur",
  outline:
    "border border-border bg-white/50 text-foreground hover:bg-white backdrop-blur",
  ghost: "text-foreground/70 hover:text-foreground hover:bg-black/[0.04]",
  destructive:
    "bg-destructive text-destructive-foreground hover:brightness-[1.05]",
} as const;

const sizes = {
  sm: "h-9 px-4 text-sm gap-1.5 rounded-xl",
  md: "h-11 px-5 text-sm gap-2 rounded-2xl",
  lg: "h-12 px-7 text-[0.95rem] gap-2 rounded-2xl",
  icon: "h-10 w-10 rounded-xl",
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
