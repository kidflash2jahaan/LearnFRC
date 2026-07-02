"use client";

import type { CSSProperties } from "react";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { AnimatedCounter } from "@/components/animated-counter";
import { pluralize } from "@/lib/utils";

export type CrewMember = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  isYou: boolean;
};

const RING_R = 44;
const RING_CIRC = 2 * Math.PI * RING_R;

/**
 * Signature hero device: "The pit crew, together" — a floating glass panel
 * whose headline image is an overlapping avatar lineup (spring pop-in),
 * paired with a build-season readiness ring so the crew's shared progress
 * reads at a glance.
 */
export function CrewPanel({
  teamNumber,
  avgPct,
  totalCompleted,
  totalNeeded,
  memberCount,
  members,
}: {
  teamNumber: number;
  avgPct: number;
  totalCompleted: number;
  totalNeeded: number;
  memberCount: number;
  members: CrewMember[];
}) {
  const reduce = useReducedMotion();
  const shown = members.slice(0, 6);
  const overflow = Math.max(0, memberCount - shown.length);
  const dashOffset = RING_CIRC * (1 - avgPct / 100);

  return (
    <motion.div
      className="ac-glass relative w-full max-w-md p-6 sm:p-7 lg:justify-self-end"
      initial={{ opacity: 0, y: 26, rotate: -1.2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={
        reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 18, delay: 0.25 }
      }
      whileHover={reduce ? undefined : { y: -6 }}
    >
      {/* header row */}
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-[17px] font-bold text-foreground">
          Team #{teamNumber}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-success">
          <motion.span
            className="h-2 w-2 rounded-full bg-[#12b565]"
            animate={reduce ? undefined : { scale: [1, 1.35, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />
          Live
        </span>
      </div>

      {/* the pit crew lineup — decorative; the real accessible roster is below */}
      <div className="mt-5 flex items-center" aria-hidden>
        {shown.length === 0 ? (
          <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-[rgba(120,145,190,0.55)] text-muted-foreground">
            <UserPlus className="h-5 w-5" />
          </span>
        ) : (
          shown.map((m, i) => (
            <motion.span
              key={m.userId}
              className="relative -ml-3 shrink-0 rounded-full ring-2 ring-white first:ml-0"
              style={{ zIndex: shown.length - i }}
              initial={{ opacity: 0, scale: 0.5, x: -8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 260, damping: 20, delay: 0.3 + i * 0.06 }
              }
            >
              <Avatar name={m.name} src={m.avatarUrl} seed={m.userId} className="h-12 w-12" />
              {m.isYou && (
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white ring-2 ring-white">
                  Y
                </span>
              )}
            </motion.span>
          ))
        )}
        {overflow > 0 && (
          <span className="relative -ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgba(120,145,190,0.2)] text-xs font-bold text-muted-foreground ring-2 ring-white">
            +{overflow}
          </span>
        )}
      </div>
      <p className="mt-2 text-[13px] text-muted-foreground">
        {memberCount > 0
          ? `${pluralize(memberCount, "member")}, one pit`
          : "Waiting on your first teammate"}
      </p>

      {/* readiness ring + headline numbers */}
      <div className="mt-5 flex items-center gap-5">
        <div className="relative shrink-0">
          <svg width="104" height="104" viewBox="0 0 104 104" aria-hidden>
            <circle
              cx="52"
              cy="52"
              r={RING_R}
              fill="none"
              stroke="rgba(120,145,190,.24)"
              strokeWidth="10"
            />
            <circle
              cx="52"
              cy="52"
              r={RING_R}
              fill="none"
              stroke="url(#crewReadinessRing)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={RING_CIRC}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 52 52)"
            />
            <defs>
              <linearGradient id="crewReadinessRing" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#2560e6" />
                <stop offset="1" stopColor="#1aa9d6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-2xl font-extrabold leading-none text-foreground">
              <AnimatedCounter value={avgPct} suffix="%" />
            </span>
            <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              ready
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-sm leading-relaxed text-foreground/75">Your crew has finished</div>
          <div className="font-display text-2xl font-extrabold leading-tight text-foreground">
            <AnimatedCounter value={totalCompleted} />{" "}
            <span className="text-base font-semibold text-muted-foreground">
              of {totalNeeded}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">lessons, together</div>
        </div>
      </div>
    </motion.div>
  );
}

export type { CSSProperties };
