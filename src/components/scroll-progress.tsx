"use client";

import { motion, useScroll, useSpring } from "framer-motion";
import { useStaticMotion } from "@/components/perf-mode";

/**
 * How far down the sheet you are, ruled in ballpoint across the very top of the
 * page. It sits above the header's own 2px ink rule, so on a long lesson the
 * blue line grows along the edge of the paper as you read.
 *
 * This is one of the few things on the site that is allowed to move, because it
 * is not an entrance: it answers the reader's own scroll, frame for frame. The
 * spring only smooths that answer, so Performance mode and a reduced-motion
 * preference drop it and track the scroll exactly.
 *
 * `useScroll` writes to a motion value rather than React state, so scrolling
 * never re-renders the tree.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const smoothed = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });
  const still = useStaticMotion();

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX: still ? scrollYProgress : smoothed }}
      /* Above the sticky header (z-40), below the photocopier grain (z-90), so
         the toner overprints this line the same as it does the rest of the ink. */
      className="fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-blue"
    />
  );
}
