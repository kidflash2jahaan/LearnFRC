import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Arena Clay 2 card family — clay-glass skins, same exported API.
 * `interactive` adds a hover lift; `reveal` is accepted for compat (scroll
 * reveals are done with the framer <Reveal> primitive at the usage site).
 */
export function Card({
  className,
  reveal: _reveal = false,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { reveal?: boolean; interactive?: boolean }) {
  return (
    <div
      className={cn(
        "ac-card text-card-foreground",
        interactive &&
          "transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("font-display text-lg font-bold leading-snug tracking-tight", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm leading-relaxed text-muted-foreground", className)} {...props} />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-3 p-6 pt-0", className)} {...props} />;
}
