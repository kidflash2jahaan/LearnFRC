"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AnimatedCounter } from "@/components/animated-counter";

export type RosterMember = {
  initials: string;
  name: string;
  role: string;
  xp: number;
};

/**
 * Hero visual: an illustrative team roster "assembling" into a glass panel
 * — sets up the onboarding-rail signature below the fold. Sample data only;
 * clearly labeled so it never reads as a real team's private info.
 */
export function TeamPanel({ teamNumber, roster }: { teamNumber: string; roster: RosterMember[] }) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="ac-glass relative w-full max-w-md p-6 sm:p-7 lg:justify-self-end"
      initial={{ opacity: 0, y: 26, rotate: 1.2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 18, delay: 0.25 }}
      whileHover={reduce ? undefined : { y: -6 }}
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="font-display text-[17px] font-bold text-foreground">
          Team {teamNumber} · roster
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-success">
          <motion.span
            className="h-2 w-2 rounded-full bg-[#12b565]"
            animate={reduce ? undefined : { scale: [1, 1.35, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />
          Sample
        </span>
      </div>

      <motion.ul
        className="space-y-2.5"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.1, delayChildren: 0.35 } } }}
      >
        {roster.map((r) => (
          <motion.li
            key={r.initials}
            className="ac-card flex items-center gap-3 p-3"
            variants={{
              hidden: { opacity: 0, y: 14 },
              show: { opacity: 1, y: 0, transition: reduce ? { duration: 0 } : { duration: 0.4 } },
            }}
          >
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary"
            >
              {r.initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">{r.name}</div>
              <div className="text-xs text-muted-foreground">{r.role}</div>
            </div>
            <span className="shrink-0 tabular-nums text-xs font-semibold text-foreground/70">
              <AnimatedCounter value={r.xp} /> XP
            </span>
          </motion.li>
        ))}
      </motion.ul>

      <hr className="ac-divider my-4" />
      <p className="text-center text-[13px] leading-relaxed text-muted-foreground">
        One team number groups everyone — rookies, veterans, and mentors —
        into a shared roster you can all see.
      </p>
    </motion.div>
  );
}
