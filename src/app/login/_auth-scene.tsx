"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import { Icon } from "@/lib/icon-map";
import { AnimatedCounter } from "@/components/animated-counter";
import { RiseGroup, RiseItem } from "@/components/motion/primitives";

export type OrbitDept = {
  slug: string;
  color: string;
  icon: string;
};

export type Stat = {
  value: number;
  suffix: string;
  label: string;
};

const HEADING_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

/** Six anchor points spread around the card for the decorative orbit. */
const ORBIT_SPOTS: CSSProperties[] = [
  { left: "2%", top: "8%" },
  { right: "4%", top: "6%" },
  { left: "-2%", top: "50%" },
  { right: "0%", top: "46%" },
  { left: "4%", bottom: "22%" },
  { right: "4%", bottom: "26%" },
];

/**
 * Signature: "the welcoming pit door" — a floating glass auth card, ringed
 * by drifting department badges, that the visitor's sign-in form sits inside.
 * `children` is the (functionally untouched) AuthForm, composed in from the
 * server page so no component function ever crosses the client boundary.
 */
export function AuthScene({
  orbit,
  stats,
  children,
}: {
  orbit: OrbitDept[];
  stats: Stat[];
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center py-10">
      {/* Decorative department orbit — drifting glass badges behind the card */}
      <div
        className="pointer-events-none absolute inset-0 -z-[1] hidden sm:block"
        aria-hidden
      >
        {orbit.map((d, i) => (
          <motion.span
            key={d.slug}
            className="ac-tile absolute grid h-14 w-14 place-items-center rounded-2xl opacity-75"
            style={{ "--a": d.color, ...ORBIT_SPOTS[i] } as CSSProperties}
            animate={reduce ? undefined : { y: [0, -10, 0], rotate: [0, 2.5, 0] }}
            transition={
              reduce
                ? { duration: 0 }
                : {
                    duration: 6 + i * 0.7,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.45,
                  }
            }
          >
            <span
              className="ac-badge grid h-9 w-9 place-items-center rounded-xl"
              style={{ "--a": d.color } as CSSProperties}
            >
              <Icon name={d.icon} className="h-[18px] w-[18px]" />
            </span>
          </motion.span>
        ))}
      </div>

      {/* The welcoming glass auth card */}
      <motion.div
        className="ac-glass relative w-full max-w-md p-6 sm:p-8"
        initial={{ opacity: 0, y: 26, rotate: -1.2 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={
          reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 18 }
        }
      >
        <RiseGroup stagger={0.07}>
          {/* Live status strip */}
          <RiseItem className="flex items-center justify-between gap-3">
            <span className="ac-chip inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
              Secure sign in
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-success">
              <motion.span
                className="h-2 w-2 rounded-full bg-[#12b565]"
                animate={reduce ? undefined : { scale: [1, 1.35, 1], opacity: [1, 0.6, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                aria-hidden
              />
              Pit is open
            </span>
          </RiseItem>

          {/* Welcome header */}
          <RiseItem className="mt-6 flex items-start gap-3.5">
            <span
              className="ac-badge flex h-12 w-12 shrink-0 items-center justify-center"
              style={{ "--a": "#2560e6" } as CSSProperties}
            >
              <KeyRound className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <p className="ac-eyebrow">Welcome back to the pit</p>
              <h1 className="mt-1 text-balance font-display text-2xl font-bold leading-tight text-foreground sm:text-[27px]">
                Pick up where <span style={HEADING_GRADIENT}>you left off</span>
              </h1>
            </div>
          </RiseItem>

          <RiseItem>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              Sign in to keep building. Your lessons, XP, and streak are
              waiting — every seat on the team, from drivetrain to scouting.
            </p>
          </RiseItem>

          <RiseItem>
            <hr className="ac-divider my-6" />
          </RiseItem>

          {/* Auth form — functionally untouched, restyled internally */}
          <RiseItem>{children}</RiseItem>
        </RiseGroup>
      </motion.div>

      {/* Count-up stats — proof under the card */}
      <RiseGroup
        className="mt-8 grid w-full max-w-md grid-cols-3 gap-3"
        stagger={0.09}
      >
        {stats.map((s) => (
          <RiseItem key={s.label}>
            <div className="ac-card h-full rounded-2xl px-3 py-4 text-center">
              <dl>
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-display text-2xl font-extrabold leading-none text-foreground">
                  <AnimatedCounter value={s.value} suffix={s.suffix} />
                </dd>
              </dl>
              <p className="mt-1 text-[13px] text-muted-foreground">{s.label}</p>
            </div>
          </RiseItem>
        ))}
      </RiseGroup>

      <motion.p
        className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={reduce ? { duration: 0 } : { delay: 0.55, duration: 0.5 }}
      >
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        100% free · No experience needed · Built for every seat on the team.
      </motion.p>
    </div>
  );
}
