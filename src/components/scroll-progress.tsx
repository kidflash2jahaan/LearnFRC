/**
 * How far down the sheet you are, ruled in ballpoint across the very top of the
 * page. It sits above the header's own 2px ink rule, so on a long lesson the
 * blue line grows along the edge of the paper as you read.
 *
 * This is one of the few things on the site that is allowed to move, because it
 * is not an entrance: it answers the reader's own scroll, frame for frame.
 *
 * NO SPRING ON IT, and that is still the whole point. There used to be a
 * `useSpring({ stiffness: 120, damping: 30 })` between the scroll and the bar.
 * That system is overdamped, so it does not wobble, it TRAILS: at a steady
 * scroll the line reports the position you were at about c/k = 250ms ago, and
 * it keeps a requestAnimationFrame loop running on the main thread for another
 * beat after your fingers stop. A progress readout that answers late is the
 * literal definition of a laggy interface, and this is the most visible moving
 * thing on the site: it is in the root layout, so it is on every page.
 *
 * NO ANIMATION RUNTIME ON IT EITHER, WHICH IS THE SAME ARGUMENT ONE STEP
 * FURTHER. Taking the spring out fixed the trailing, but the bar was still a
 * framer-motion `motion.div` reading a `useScroll` motion value, and because
 * this component is mounted in the ROOT LAYOUT that runtime was in the
 * first-load bundle of every page on the site. Measured on this build: 124 kB
 * raw, 41 kB gzipped, on `/`, `/guides`, `/dashboard`, every tool and every
 * lesson, to draw a line three pixels tall. It also installed a scroll
 * subscriber and a rAF loop on the main thread of every page, and the main
 * thread is exactly what is busy during a navigation, which is when scrolling
 * most needs to stay smooth.
 *
 * So the bar is now `.nb-progress-x` from globals.css: a scroll-driven CSS
 * animation on `scroll(root block)`. Same reading, same instant response, off
 * the main thread, and zero bytes of JavaScript. `components/motion/primitives.tsx`
 * already makes this argument about reveals ("a scroll reveal does not justify
 * shipping an animation runtime, a hydration boundary and a re-render loop to
 * every page on the site"); this was the last place on the site it had not been
 * applied, and it was the most expensive one.
 *
 * SERVER COMPONENT. There is no `"use client"` here any more, so the root
 * layout no longer opens a hydration boundary for a decorative line. A browser
 * with no scroll-driven animations simply gets no bar, which is the safe
 * direction: the element is `aria-hidden` and the page's own headings say where
 * you are. Reduced motion keeps it, because it reports your position rather
 * than performing at you.
 */
export function ScrollProgress() {
  return (
    <div
      aria-hidden="true"
      /* Above the sticky header (z-40), below the photocopier grain (z-90), so
         the toner overprints this line the same as it does the rest of the ink. */
      className="nb-progress-x fixed inset-x-0 top-0 z-50 h-[3px] bg-blue"
    />
  );
}
