import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Text controls are the same hand-ruled edge as everything else, at the small
 * radius. The kit handles focus, disabled and `aria-invalid`, so nothing here
 * repeats them. Font is inherited on purpose: the value a person types is body
 * copy, and only the label and the hint around it are mono.
 *
 * Pair these with `nb-field` + `nb-label` at the call site. A placeholder is
 * never a label.
 */

export function Input({
  className,
  type,
  ref,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} type={type} className={cn("nb-input", className)} {...props} />;
}

export function Textarea({
  className,
  ref,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.Ref<HTMLTextAreaElement> }) {
  return <textarea ref={ref} className={cn("nb-input", className)} {...props} />;
}
