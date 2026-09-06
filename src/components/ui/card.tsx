import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * An index card in the binder. `nb-box` draws both rules; padding lives on the
 * parts rather than the box so a card can also hold something that needs to
 * reach its own edge, like a table or a full-bleed panel strip.
 *
 * `interactive` adds `nb-lift`, the one hover the system has: the card
 * straightens and rises 3px. Use it only when the whole card is a link or a
 * button, because a lift on something unclickable is a lie.
 */
export function Card({
  className,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return <div className={cn("nb-box", interactive && "nb-lift", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-2 p-[var(--pad)] pb-0", className)} {...props} />;
}

/** An h3 by default, so the base type scale does the sizing. */
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={className} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-[0.94rem] leading-[1.45] text-[var(--graphite)]", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-[var(--pad)]", className)} {...props} />;
}

/** Sits under a dashed hairline, the way a card's totals sit under its rule. */
export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "nb-hair mx-[var(--pad)] flex items-center gap-3 pb-[var(--pad)] pt-4",
        className
      )}
      {...props}
    />
  );
}
