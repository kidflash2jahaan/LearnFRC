import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

/**
 * The binder has two buttons: the filled ballpoint one you are meant to press,
 * and the drawn one you press instead. Callers still name seven variants, so
 * every name resolves onto one of those two rather than growing a palette the
 * system does not have.
 *
 * `destructive` is the exception worth explaining: there is no red here, and
 * inventing one would put a seventh colour on the page to say a thing the
 * label already says. It reads as the drawn button with a heavy 3px ink edge,
 * the same weight `nb-error` and an invalid input use, so the severity still
 * survives a greyscale photocopy.
 */
const VARIANTS: Record<string, string> = {
  brand: "nb-btn",
  primary: "nb-btn",
  accent: "nb-btn",
  success: "nb-btn",
  ghost: "nb-btn-ghost",
  outline: "nb-btn-ghost",
  secondary: "nb-btn-ghost",
  warning: "nb-btn-ghost",
  destructive: "nb-btn-ghost border-[3px]",
};

/** Every size keeps the 44px floor `nb-btn` sets; only the inline run changes. */
const SIZES: Record<string, string> = {
  sm: "nb-btn-sm",
  md: "",
  lg: "min-h-[3.15rem] px-[1.6rem] text-[0.95rem]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS | (string & {});
  size?: keyof typeof SIZES | (string & {});
  asChild?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

export function Button({
  className,
  variant = "brand",
  size = "md",
  asChild = false,
  ref,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      className={cn(VARIANTS[variant] ?? VARIANTS.brand, SIZES[size] ?? SIZES.md, className)}
      {...props}
    />
  );
}
