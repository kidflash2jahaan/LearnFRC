"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Hash, Users, Eye } from "lucide-react";

// Icons resolved here by name — server pages can't pass component functions
// across the client boundary.
const STEP_ICONS = { hash: Hash, users: Users, eye: Eye } as const;

type Step = {
  n: string;
  title: string;
  body: string;
  icon: keyof typeof STEP_ICONS;
};

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

/**
 * The signature element: the 3-step onboarding story told as a connected
 * timeline. A gradient rail grows down through three numbered nodes as they
 * pop in, ending in a mini "roster assembling" beat — visually narrating
 * "your team assembles itself." Reduced-motion safe (renders static).
 */
export function OnboardingRail({ steps }: { steps: Step[] }) {
  const ref = React.useRef<HTMLOListElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const play = inView && !reduce;

  return (
    <ol ref={ref} className="relative mt-12 space-y-6 sm:space-y-8" aria-label="How onboarding works, in three steps">
      {/* the rail: a vertical gradient line the nodes hang off (desktop/tablet) */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-[27px] top-6 bottom-6 w-[3px] origin-top rounded-full sm:left-[31px]"
        style={
          {
            background: "linear-gradient(180deg,#2560e6,#1aa9d6,#7c5cff)",
            transform: play || reduce ? "scaleY(1)" : "scaleY(0)",
            transition: reduce ? "none" : "transform 1.4s cubic-bezier(.35,0,.15,1)",
          } as CSSProperties
        }
      />

      {steps.map((s, i) => (
        <motion.li
          key={s.n}
          className="relative flex gap-5"
          initial={reduce ? undefined : { opacity: 0, y: 26 }}
          animate={play ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.55, delay: 0.25 + i * 0.28, ease: EASE }}
        >
          {/* numbered node sitting on the rail */}
          <div className="relative z-[1] shrink-0">
            <motion.span
              className="aq-badge flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ "--a": "#2560e6" } as CSSProperties}
              initial={reduce ? undefined : { scale: 0.5, opacity: 0 }}
              animate={play ? { scale: 1, opacity: 1 } : undefined}
              transition={{ type: "spring", stiffness: 320, damping: 18, delay: 0.3 + i * 0.28 }}
            >
              {React.createElement(STEP_ICONS[s.icon], { "aria-hidden": true, className: "h-6 w-6" })}
            </motion.span>
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-bold text-primary shadow-[0_2px_6px_rgba(40,80,150,0.25)] ring-1 ring-primary/20"
            >
              {s.n}
            </span>
          </div>

          {/* step card */}
          <div className="aq-card aq-card-hover flex-1 rounded-[20px] p-5 sm:p-6">
            <h3 className="text-lg font-semibold text-foreground">{s.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
          </div>
        </motion.li>
      ))}
    </ol>
  );
}
