import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * THE NOTEBOOK'S MOTION KIT
 * =========================
 *
 * Six primitives, one per paper motion. Paper motion means: a taped card
 * straightens and lifts, a ruled line draws itself, ink lands on a figure, a
 * section gets laid down onto the page. Nothing fades in from nowhere, nothing
 * floats, nothing loops, nothing breathes while you are reading it.
 *
 * WHY THERE IS NO ANIMATION LIBRARY HERE
 * --------------------------------------
 * `framer-motion` is still in package.json but NOTHING IN `src/` IMPORTS IT any
 * more. A scroll reveal does not justify shipping an animation runtime, a
 * hydration boundary and a re-render loop to every page on the site, so all six
 * motions below are the CSS already declared in `globals.css`, driven by
 * `animation-timeline: view()`.
 *
 * The last two holdouts were the two scroll readouts, `components/scroll-progress.tsx`
 * and the lesson `_reading-rail.tsx`, both of which read a `useScroll` motion
 * value to draw a line. They are now `.nb-progress-x` / `.nb-progress-y` on a
 * `scroll(root block)` timeline. That one change took 124 kB raw / 41 kB gzip of
 * JavaScript off the first load of EVERY route, because the top bar is mounted
 * in the root layout. If you are about to add a seventh motion, this is the
 * measurement to remember before you reach for a library.
 *
 * That buys three things a JS reveal cannot:
 *
 *   - ZERO CLIENT JS. There is no `"use client"` in this file. Every export is a
 *     Server Component, so a page shell stays a Server Component and pages that
 *     use the kit ship no extra bytes.
 *   - THE SCROLL TIMELINE RUNS OFF THE MAIN THREAD. It cannot drop frames while
 *     the router is fetching, which is exactly when an IntersectionObserver
 *     reveal stutters.
 *   - NOTHING IS EVER INVISIBLE. Every keyframe in the system animates transform
 *     only, never opacity, and each element's base style IS its end state. With
 *     JS off, with a crawler, with a browser that has no scroll-driven
 *     animations, and under `prefers-reduced-motion`, the content is on the page
 *     and readable. The worst case anywhere is a card sitting 14px low for a
 *     moment.
 *
 *   The `@supports` fallback in globals.css keeps a browser without `view()`
 *   honest: the same animation plays once, on load, and lands at its end state.
 *
 * REDUCED MOTION is handled once, globally, at the bottom of globals.css. It
 * switches these animations off by name, which is the only thing that works on a
 * scroll-driven animation (zeroing `animation-duration` does nothing to one:
 * its progress comes from the scroll position, not from a clock). Do not add a
 * second reduced-motion check in a page.
 *
 * HOW TO USE THESE
 * ----------------
 * A primitive IS the element, it does not wrap one. Pass the card's own classes
 * straight through:
 *
 *   <Reveal as="section" className="nb-wrap py-16"> … </Reveal>
 *   <RevealGroup className="grid gap-6 md:grid-cols-3">{cards}</RevealGroup>
 *   <Lift as="article" tilt={-1.1} className="nb-box p-6"> … </Lift>
 *   <Draw className="h-[2px] w-28 bg-blue" />
 *   <Ink className="nb-count">248<small>lessons</small></Ink>
 *
 * They compose through `className`, because the vocabulary is class names and
 * these are typed shortcuts over it, not a parallel system. A taped card that
 * arrives crooked AND lifts under the cursor is one element:
 *
 *   <Lift as="article" tilt={-1.1} className="nb-box nb-straighten p-6">
 *
 * Use `asChild` when the element already exists and cannot be replaced, most
 * often a `<Link>`. The class lands on the child, so the offset ink drop follows
 * the card's own hand-drawn radius instead of a square wrapper:
 *
 *   <Lift asChild tilt={0.6}><Link href="/guides" className="nb-box p-6">…</Link></Lift>
 *
 * FOUR RULES, ALL LEARNED THE HARD WAY
 * ------------------------------------
 *  1. Put an arrival on a card or a band, never on a 3000px section. The `entry`
 *     range is measured in element heights, so a very tall element animates for
 *     a very long scroll and reads as lag.
 *  2. Do not nest arrivals. A `<Reveal>` inside a `<RevealGroup>` child animates
 *     the same element twice.
 *  3. Do not put an arrival inside an `.nb-scroll` container. `view()` resolves
 *     against the nearest scrollport, which there is the horizontal one, and the
 *     element can sit at its start offset permanently.
 *  4. Nothing here animates width, height, top, left, box-shadow or filter, and
 *     nothing you add should either. Transform and opacity, or it does not ship.
 */

/* ------------------------------------------------------------------ */
/*  Shared plumbing                                                    */
/* ------------------------------------------------------------------ */

/** The tags a paper motion can sit on. Add one when a page genuinely needs it. */
type PaperTag =
  | "div" | "section" | "article" | "aside" | "header" | "footer" | "nav"
  | "ul" | "ol" | "li" | "dl" | "dt" | "dd"
  | "figure" | "figcaption" | "p" | "span" | "b" | "strong" | "em"
  | "h2" | "h3" | "h4" | "hr" | "td" | "th";

export type PaperMotionProps = React.HTMLAttributes<HTMLElement> & {
  /** The element to render. Each primitive has a sensible default. */
  as?: PaperTag;
  /**
   * Put the motion class on the single child element instead of rendering a new
   * one. Use it for a `<Link>`, or any element you cannot swap out. A wrapper
   * around a hand-ruled card would draw a square ink drop behind four different
   * corner radii and leave a sliver showing at every corner.
   */
  asChild?: boolean;
};

type ChildProps = { className?: string; style?: React.CSSProperties };

/**
 * Renders `tag` with `motionClass` merged in, or clones the only child when
 * `asChild` is set.
 *
 * `cn` is tailwind-merge, so on a conflict the caller wins: `<Ink>` asks for
 * `inline-block`, a caller passing `block` gets `block`.
 */
function paper(
  motionClass: string,
  tag: PaperTag,
  { as, asChild, className, style, children, ...rest }: PaperMotionProps,
) {
  const el = as ?? tag;

  if (asChild) {
    // A Fragment passes isValidElement but cannot take a className, so it has
    // to fall through to the real element or React warns on every render.
    if (
      React.isValidElement<ChildProps>(children) &&
      children.type !== React.Fragment
    ) {
      return React.cloneElement(children, {
        ...rest,
        className: cn(motionClass, className, children.props.className),
        style: { ...children.props.style, ...style },
      });
    }
    // asChild with no single element child: render the element anyway rather
    // than dropping the motion silently.
  }

  return React.createElement(
    el,
    { ...rest, className: cn(motionClass, className), style },
    children,
  );
}

/** A resting angle for a card that was never straightened on the wall. */
function tiltStyle(tilt: number | undefined, style: React.CSSProperties | undefined) {
  if (tilt === undefined) return style;
  const withTilt: React.CSSProperties & Record<string, string> = { "--tilt": `${tilt}deg` };
  return { ...withTilt, ...style };
}

/* ------------------------------------------------------------------ */
/*  1. Arrivals                                                        */
/* ------------------------------------------------------------------ */

/**
 * A SECTION ARRIVING AS YOU SCROLL TO IT.
 *
 * The default arrival: the band travels 14px up and is laid down onto the page
 * over its own entry into the viewport. Travel only, no rotation, so it is safe
 * on a full-bleed band whose corners would otherwise swing past the gutter.
 *
 *   <Reveal as="section" className="nb-wrap py-16">…</Reveal>
 *
 * Reach for `Straighten` instead when the thing is taped down.
 */
export function Reveal(props: PaperMotionProps) {
  return paper("nb-reveal", "div", props);
}

/**
 * THE SAME ARRIVAL DEALT OUT ACROSS A ROW OF CHILDREN.
 *
 * Put it on the grid or the list, not on each card: it targets its DIRECT
 * children, so they need no wrapper and no marker component.
 *
 *   <RevealGroup className="grid gap-6 md:grid-cols-3">
 *     {departments.map((d) => <DepartmentCard key={d.slug} … />)}
 *   </RevealGroup>
 *
 * Scroll-driven animations ignore `animation-delay`, so the stagger is built
 * from shifted entry ranges, and it caps at six. Past six the cards are
 * off-screen anyway and a longer cascade only makes the page feel slower.
 */
export function RevealGroup(props: PaperMotionProps) {
  return paper("nb-reveal-group", "div", props);
}

/**
 * A TAPED ITEM ARRIVING CROOKED AND GETTING PUSHED SQUARE.
 *
 * The way you actually put a card on a wall: it goes up at an angle and then
 * gets straightened. Written with the independent `rotate` and `translate`
 * properties, so it composes with `.nb-tilt` rather than wiping it, and the
 * card lands on ITS OWN resting angle instead of on zero.
 *
 *   <Straighten as="figure" tilt={0.9} className="nb-box p-5">
 *     <span className="nb-tape" style={{ top: -10, left: 24, rotate: "-3deg" }} />
 *     …
 *   </Straighten>
 *
 * `tilt` is that resting angle in degrees, and no two pieces on one screen
 * should share one.
 */
export function Straighten({ tilt, style, ...rest }: PaperMotionProps & { tilt?: number }) {
  return paper(
    cn("nb-straighten", tilt !== undefined && "nb-tilt"),
    "div",
    { ...rest, style: tiltStyle(tilt, style) },
  );
}

/**
 * A RULED LINE DRAWING ITSELF, LEFT TO RIGHT.
 *
 * The way a pen crosses a straightedge: fast off the mark, eased into the stop.
 * Scales one axis, so it costs no layout and no paint.
 *
 *   <Draw className="h-[2px] w-28 bg-blue" />
 *
 * Goes on the line itself, never on the box around it. It renders `block`
 * because a transform does nothing to a non-replaced inline element, which is a
 * failure you would never see: the line would just sit there fully drawn.
 */
export function Draw(props: PaperMotionProps) {
  return paper("nb-draw block", "div", props);
}

/**
 * INK LANDING ON A FIGURE.
 *
 * The number comes down 5px and stops dead, because that is what a stamp does.
 * No bounce anywhere in this system: paper and a marker have no spring in them.
 *
 *   <Ink className="nb-count">248<small>lessons</small></Ink>
 *
 * Goes on the figure itself, not the block around it: `.nb-count`, `.nb-stamp b`,
 * a table total. `inline-block` for the same reason as `Draw`. Inside an
 * `.nb-stamp`, pass `className="block"` so the caption keeps its own line.
 */
export function Ink(props: PaperMotionProps) {
  return paper("nb-ink inline-block", "span", props);
}

/* ------------------------------------------------------------------ */
/*  2. The one hover                                                   */
/* ------------------------------------------------------------------ */

/**
 * A CARD LIFTING OFF THE PAGE, AND STRAIGHTENING AS IT GOES.
 *
 * The only hover in the system. The card rises 3px, its resting tilt goes to
 * zero and the offset ink drop deepens, over 180ms on the response curve. It
 * starts moving inside the first frame, which is the whole point: a hover that
 * resolves in two visible jumps reads as a dropped frame, not as a stutter.
 *
 *   <Lift as="article" tilt={-1.1} className="nb-box p-6">…</Lift>
 *   <Lift asChild tilt={0.6}><Link href="/guides" className="nb-box p-6">…</Link></Lift>
 *
 * `tilt` is the resting angle in degrees. Give it one when the card is taped
 * down, so there is something to straighten; leave it off for a plain card that
 * should only rise. Keyboard focus lifts on every device, pointer hover is gated
 * behind `(hover: hover)` so a tap on a phone does not leave the card stuck up.
 *
 * Add the arrival on the same element rather than nesting a wrapper:
 *
 *   <Lift as="article" tilt={-1.1} className="nb-box nb-straighten p-6">
 */
export function Lift({ tilt, style, ...rest }: PaperMotionProps & { tilt?: number }) {
  return paper(
    cn("nb-lift", tilt !== undefined && "nb-tilt"),
    "div",
    { ...rest, style: tiltStyle(tilt, style) },
  );
}

/* ------------------------------------------------------------------ */
/*  3. The class names, for the places a component cannot reach        */
/* ------------------------------------------------------------------ */

/**
 * The same six motions as bare class names, for when the element belongs to
 * something else and there is only a `className` to hand: a third-party
 * component, a `cva` variant, a `cn()` call inside another primitive.
 *
 *   <SomeCard className={cn(nbMotion.lift, "nb-box")} />
 *
 * Every rule above still applies. This is the same CSS, not a shortcut past it.
 */
export const nbMotion = {
  /** A section arriving as you scroll to it. */
  reveal: "nb-reveal",
  /** The same arrival dealt out across a row of DIRECT children. */
  revealGroup: "nb-reveal-group",
  /** A taped item arriving crooked and getting pushed square. */
  straighten: "nb-straighten",
  /** A ruled line drawing itself, left to right. Needs a block box. */
  draw: "nb-draw",
  /** Ink landing on a figure. Needs a block or inline-block box. */
  ink: "nb-ink",
  /** The card hover: straightens, rises 3px, drop deepens. */
  lift: "nb-lift",
  /** A resting angle. Pair with `style={{ "--tilt": "-1.1deg" }}`. */
  tilt: "nb-tilt",
} as const;
