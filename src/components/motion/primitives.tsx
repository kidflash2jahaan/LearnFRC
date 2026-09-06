import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Motion primitives for the notebook.
 *
 * The binder has exactly two motions, and they are both in globals.css:
 *
 *   1. `.nb-route` is the page exposing in two steps, once per navigation.
 *   2. `.nb-lift` is a taped card straightening and rising 3px under the cursor.
 *
 * That is the whole vocabulary. Paper on a shop wall does not fade up section
 * by section as you scroll, and it does not have coloured light drifting behind
 * it, so every spring, scroll-reveal and ambient blob this module used to ship
 * is gone. What is left is layout: these render the element and its className
 * and nothing else.
 *
 * WHY THE EXPORTS AND PROPS SURVIVED
 * ----------------------------------
 * Fifty files across the site compose with these names. Keeping the surface
 * identical means the motion could be removed in one place instead of in fifty,
 * and it means none of those call sites has to be edited to stop animating.
 * Props that described the old motion (`delay`, `y`, `stagger`, `once`, `lift`,
 * `scale`) are still accepted and are deliberately ignored: a caller asking for
 * a 0.22s delay is asking for something the system no longer has.
 *
 * These are Server Components now. Every page that used them for entrances gets
 * its client bundle back, and there is no hydration boundary left to mismatch.
 */

type Tag = "div" | "section" | "span" | "header" | "li" | "article";

function Box({
  as = "div",
  className,
  children,
}: {
  as?: Tag;
  className?: string;
  children: React.ReactNode;
}) {
  const El = as;
  return <El className={className}>{children}</El>;
}

/* ---------------- Entrances (now: just the element) ---------------- */

export function Rise({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  /** Accepted for compatibility. The binder has one entrance, on the route. */
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "span" | "header";
}) {
  return (
    <Box as={as} className={className}>
      {children}
    </Box>
  );
}

export function RiseGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}) {
  return <div className={className}>{children}</div>;
}

export function RiseItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

/* ---------------- Scroll reveals (now: just the element) ---------------- */

export function Reveal({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  once?: boolean;
  as?: "div" | "section" | "li" | "span" | "article";
}) {
  return (
    <Box as={as} className={className}>
      {children}
    </Box>
  );
}

export function RevealGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  once?: boolean;
}) {
  return <div className={className}>{children}</div>;
}

export function RevealItem({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "li" | "article" | "span";
}) {
  return (
    <Box as={as} className={className}>
      {children}
    </Box>
  );
}

/* ---------------- The one hover ---------------- */

/**
 * The taped-card lift.
 *
 * It clones the child rather than wrapping it, because `.nb-lift` paints an
 * offset ink drop and that drop has to follow the card's own hand-drawn radius.
 * A wrapper div would draw a square shadow behind a card with four different
 * corner radii and leave a sliver showing at every corner. Cloning puts the
 * class on the card itself, which is where the reference draws it.
 *
 * `lift` and `scale` are accepted and ignored: there is one lift in the system,
 * 3px, and letting callers dial it is how a system grows a second one.
 */
export function Hover({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
  lift?: number;
  scale?: number;
}) {
  // A Fragment passes isValidElement but cannot take a className, so it has to
  // fall through to the wrapper or React warns on every render.
  if (
    React.isValidElement<{ className?: string }>(children) &&
    children.type !== React.Fragment
  ) {
    return React.cloneElement(children, {
      className: cn("nb-lift", children.props.className, className),
    });
  }
  return <div className={cn("nb-lift", className)}>{children}</div>;
}

/* ---------------- Ambient light: deleted ---------------- */

export type GlowBlob = {
  size: string;
  pos: React.CSSProperties;
  color: string;
  delay?: number;
  opacity?: number;
};

/**
 * Renders nothing, on purpose.
 *
 * `Glow` used to lay blurred pastel blobs behind a page and drift them forever.
 * The notebook gets its depth from a double rule and a strip of tape, never
 * from a blur, and nothing in it moves while you are reading. The export stays
 * so the pages still carrying a `<Glow blobs={...} />` keep compiling while
 * they are rebuilt; the blobs themselves are gone from every one of them.
 */
export function Glow(_props: { blobs: GlowBlob[] }) {
  return null;
}
