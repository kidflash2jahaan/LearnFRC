"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { ShieldCheck, Users2, CalendarDays, Trophy, Zap, BookOpenCheck } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { AnimatedCounter } from "@/components/animated-counter";

const GRADIENT_TEXT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

/**
 * Signature element: a friendly, tactile "pit crew ID card" — a glass
 * badge that gently tilts toward the cursor (spring-damped, disabled
 * under reduced motion) and settles in on load like a lanyard swinging
 * to a stop.
 */
export function IdentityCard({
  displayName,
  handle,
  avatarUrl,
  avatarSeed,
  roleLabel,
  teamNumber,
  joinedLabel,
  bio,
  level,
  xp,
  lessonsCompleted,
}: {
  displayName: string;
  handle: string;
  avatarUrl?: string | null;
  avatarSeed?: string;
  roleLabel: string;
  teamNumber: number | null;
  joinedLabel: string;
  bio: string | null;
  level: number;
  xp: number;
  lessonsCompleted: number;
}) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);

  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(my, [0, 1], [7, -7]), { stiffness: 220, damping: 22 });
  const rotateY = useSpring(useTransform(mx, [0, 1], [-7, 7]), { stiffness: 220, damping: 22 });

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  }
  function handleLeave() {
    mx.set(0.5);
    my.set(0.5);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{
        rotateX: reduce ? 0 : rotateX,
        rotateY: reduce ? 0 : rotateY,
        transformPerspective: 900,
      }}
      initial={{ opacity: 0, y: 22, rotate: -1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 150, damping: 19 }}
      className="ac-glass relative overflow-hidden p-6 sm:p-8"
    >
      {/* banner wash across the card top */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-28"
        style={{
          background:
            "linear-gradient(120deg, rgba(37,96,230,0.24), rgba(26,169,214,0.2))",
        }}
      />
      {/* punch-hole + lanyard cue — reads as a real ID card */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-3 h-1.5 w-16 -translate-x-1/2 rounded-full bg-white/70 shadow-[inset_0_1px_2px_rgba(40,80,150,0.35)]"
      />

      <div className="relative flex flex-col gap-5 pt-10 sm:flex-row sm:items-end">
        <motion.div
          className="shrink-0"
          animate={reduce ? undefined : { y: [0, -6, 0] }}
          transition={reduce ? undefined : { duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Avatar
            name={displayName}
            src={avatarUrl}
            seed={avatarSeed}
            className="h-28 w-28 ring-4 ring-white/90 shadow-[0_18px_40px_rgba(40,80,150,0.28)]"
          />
        </motion.div>
        <div className="min-w-0 pb-1">
          <div className="flex items-center gap-2">
            <span
              className="ac-badge inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold uppercase tracking-wider"
              style={{ "--a": "#2560e6" } as CSSProperties}
            >
              <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
              Member
            </span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              LearnFRC ID
            </span>
          </div>
          <h1 className="mt-2 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
            <span style={GRADIENT_TEXT}>{displayName}</span>
          </h1>
          <p className="mt-1 text-sm tracking-tight text-muted-foreground">@{handle}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="ac-chip inline-flex items-center gap-1.5 font-medium">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
              {roleLabel}
            </span>
            {teamNumber != null && (
              <span className="ac-chip inline-flex items-center gap-1.5">
                <Users2 aria-hidden className="h-3.5 w-3.5 text-accent" />
                Team {teamNumber}
              </span>
            )}
            <span className="ac-chip inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
              Joined {joinedLabel}
            </span>
          </div>
        </div>
      </div>

      {bio && (
        <p className="relative mt-6 max-w-2xl text-pretty text-base leading-relaxed text-foreground/70">
          {bio}
        </p>
      )}

      {/* card footer strip — level + xp inline, like a credential */}
      <div className="relative mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/70 pt-4 text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
          <Trophy aria-hidden className="h-4 w-4 text-accent" />
          Level {level}
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-foreground">
          <Zap aria-hidden className="h-4 w-4 text-primary" />
          <AnimatedCounter value={xp} suffix=" XP" />
        </span>
        <span className="inline-flex items-center gap-1.5 tabular-nums text-muted-foreground">
          <BookOpenCheck aria-hidden className="h-4 w-4" />
          <AnimatedCounter value={lessonsCompleted} /> lessons done
        </span>
      </div>
    </motion.div>
  );
}
