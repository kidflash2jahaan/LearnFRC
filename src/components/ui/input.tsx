import * as React from "react";
import { cn } from "@/lib/utils";

/** Arena Clay 2 inputs — light rounded skins; same exported API. */

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "ac-input w-full text-[15px] text-foreground placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-55",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "ac-input min-h-28 w-full resize-y text-[15px] text-foreground placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-55",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
