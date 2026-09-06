"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * A sheet of card stock that drops out from under the trigger. `nb-surface`
 * gives it the ink edge and the offset ink drop, never a blur.
 *
 * It appears in two visible steps of opacity, the same exposure the route
 * transition uses, because this system's motion is a photocopier and not a
 * spring. No scale, so no transform-origin question, and nothing to reverse
 * on close. `overflow-hidden` is what lets the rows run full width and still
 * be cut by the sheet's drawn corners; the rows' focus ring is inset by the
 * kit so clipping never eats it.
 *
 * `z-50` is not decoration: the sticky header sits at `z-40`, and a portalled
 * sheet with an auto z-index would render underneath it.
 */
export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  align = "end",
  sideOffset = 10,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "nb-surface z-50 min-w-[12rem] overflow-hidden py-1",
          "data-[state=open]:animate-[nb-expose_120ms_steps(2,end)_both]",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { inset?: boolean }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "nb-menu-item",
        "data-[disabled]:pointer-events-none data-[disabled]:text-[var(--graphite)]",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  );
}

/** Who you are signed in as. Mono, because it is a record, not a heading. */
export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn("px-[0.85rem] pb-2 pt-1.5", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator className={cn("nb-hair my-1 h-0", className)} {...props} />
  );
}
