"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Icon } from "@/lib/icon-map";
import { AnimatedCounter } from "@/components/animated-counter";

/**
 * Signature visual: the credential seal. A slow-rotating ring of
 * "LEARNFRC · CERTIFIED · …" micro-type circles a glossy medallion in the
 * department accent, with a little ribbon underneath — the thing you'd
 * actually want printed and pinned to a pit wall.
 */
export function CertificateSeal({
  icon,
  color,
  to,
  ink,
  ringText,
}: {
  icon: string;
  color: string;
  to: string;
  ink: string;
  ringText: string;
}) {
  const reduce = useReducedMotion();
  const rawId = React.useId();
  const pathId = `seal-ring-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
      <motion.svg
        viewBox="0 0 200 200"
        className="absolute inset-0 h-full w-full"
        aria-hidden
        animate={reduce ? undefined : { rotate: 360 }}
        transition={reduce ? undefined : { duration: 46, repeat: Infinity, ease: "linear" }}
      >
        <defs>
          <path id={pathId} d="M 100,100 m -84,0 a 84,84 0 1,1 168,0 a 84,84 0 1,1 -168,0" />
        </defs>
        <text fontSize="10.5" fontWeight={700} letterSpacing="2.5" fill={ink}>
          <textPath href={`#${pathId}`} startOffset="0%">
            {ringText}
          </textPath>
        </text>
      </motion.svg>

      <div
        className="relative flex h-24 w-24 items-center justify-center rounded-full text-white"
        style={{
          background: `linear-gradient(160deg, ${color}, ${to})`,
          boxShadow: `0 12px 24px -6px color-mix(in srgb, ${color} 55%, transparent), inset 0 1px 0 rgba(255,255,255,0.55)`,
          border: "3px solid rgba(255,255,255,0.85)",
        }}
      >
        <Icon name={icon} className="h-10 w-10" />
      </div>

      <svg
        aria-hidden
        viewBox="0 0 100 40"
        className="absolute -bottom-5 left-1/2 h-10 w-24 -translate-x-1/2"
      >
        <path d="M20 0 L2 38 L20 30 L28 40 Z" fill={color} opacity="0.85" />
        <path d="M80 0 L98 38 L80 30 L72 40 Z" fill={to} opacity="0.85" />
      </svg>
    </div>
  );
}

/**
 * Locked-state companion: a dimmed medallion waiting behind a spring-drawn
 * progress ring, so the earned seal is visible in outline before it's real.
 */
export function ProgressSeal({
  pct,
  icon,
  color,
  to,
  ink,
}: {
  pct: number;
  icon: string;
  color: string;
  to: string;
  ink: string;
}) {
  const reduce = useReducedMotion();
  const r = 54;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const offset = c - (c * clamped) / 100;

  return (
    <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
      <div
        aria-hidden
        className="absolute inset-6 rounded-full opacity-25 blur-[0.5px] grayscale"
        style={{ background: `linear-gradient(160deg, ${color}, ${to})` }}
      />
      <div aria-hidden className="absolute inset-6 flex items-center justify-center rounded-full opacity-40 grayscale">
        <Icon name={icon} className="h-9 w-9 text-white" />
      </div>

      <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(120,145,190,0.22)" strokeWidth="8" />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={ink}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 55, damping: 18, delay: 0.3 }}
        />
      </svg>

      <div className="relative flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold" style={{ color: ink }}>
          <AnimatedCounter value={clamped} suffix="%" />
        </span>
        <span className="text-xs font-medium text-muted-foreground">complete</span>
      </div>
    </div>
  );
}
