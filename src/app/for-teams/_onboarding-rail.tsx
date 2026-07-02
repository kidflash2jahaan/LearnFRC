"use client";

import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Hash, Users, Eye, type LucideIcon } from "lucide-react";

// Icons are referenced by NAME from the server page and resolved here —
// component functions can't cross the server -> client boundary.
const STEP_ICONS: Record<string, LucideIcon> = { hash: Hash, users: Users, eye: Eye };

export type OnboardingStep = {
  n: string;
  icon: "hash" | "users" | "eye";
  title: string;
  body: string;
};

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

/**
 * Signature element: the 3-step onboarding story told as a connected rail.
 * A gradient spine grows down through three numbered nodes as they scroll
 * into view, narrating "your team assembles itself" — no admin dashboard,
 * no invite codes, just a shared team number. Purely whileInView driven so
 * SSR and first client paint render the identical rest-state tree; reduced
 * motion only zeroes the transition durations.
 */
export function OnboardingRail({ steps }: { steps: OnboardingStep[] }) {
  const reduce = useReducedMotion();

  return (
    <ol className="relative mt-12 space-y-6 sm:space-y-8" aria-label="How onboarding works, in three steps">
      <motion.span
        aria-hidden
        className="pointer-events-none absolute bottom-7 left-[27px] top-7 hidden w-[3px] origin-top rounded-full sm:block"
        style={{ background: "linear-gradient(180deg, #2560e6, #1aa9d6, #7c5cff)" }}
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={reduce ? { duration: 0 } : { duration: 1.3, ease: EASE }}
      />

      {steps.map((s, i) => {
        const StepIcon = STEP_ICONS[s.icon] ?? Hash;
        return (
          <motion.li
            key={s.n}
            className="relative flex gap-5"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={reduce ? { duration: 0 } : { duration: 0.55, delay: i * 0.15, ease: EASE }}
          >
            <div className="relative z-[1] shrink-0">
              <span
                className="ac-badge flex h-14 w-14 items-center justify-center"
                style={{ "--a": "#2560e6" } as CSSProperties}
              >
                <StepIcon className="h-6 w-6" aria-hidden />
              </span>
              <span
                aria-hidden
                className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-bold text-primary shadow-[0_2px_6px_rgba(40,80,150,0.25)] ring-1 ring-primary/20"
              >
                {s.n}
              </span>
            </div>
            <div className="ac-card flex-1 p-5 sm:p-6">
              <h3 className="font-display text-lg font-bold text-foreground">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
