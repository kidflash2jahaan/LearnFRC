"use client";

import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck, Sparkles, Trophy, Hash } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { AnimatedCounter } from "@/components/animated-counter";

/**
 * Signature hero device: "Your identity" — a floating glass readout that
 * mirrors the homepage's telemetry panel, but tuned to one person: avatar,
 * role, XP and team number, live-pulsing to say "this is you, right now."
 */
export function IdentityCard({
  displayName,
  handle,
  avatarUrl,
  seed,
  roleLabel,
  isAdmin,
  xp,
  teamNumber,
  joined,
}: {
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  seed?: string;
  roleLabel: string;
  isAdmin: boolean;
  xp: number;
  teamNumber: number | null;
  joined: string | null;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="ac-glass relative w-full max-w-md p-6 sm:p-7 lg:justify-self-end"
      initial={{ opacity: 0, y: 26, rotate: 1.2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={
        reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 18, delay: 0.25 }
      }
      whileHover={reduce ? undefined : { y: -6 }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-[17px] font-bold text-foreground">
          Your identity
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

      <div className="mt-5 flex items-center gap-4">
        <Avatar
          name={displayName}
          src={avatarUrl}
          seed={seed}
          className="h-20 w-20 shrink-0 ring-2 ring-white/70 shadow-[var(--shadow-md)]"
        />
        <div className="min-w-0">
          <div className="truncate font-display text-xl font-bold leading-tight text-foreground">
            {displayName}
          </div>
          <div className="mt-0.5 truncate text-sm text-muted-foreground">{handle}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="ac-chip inline-flex items-center gap-1 text-xs font-semibold text-primary">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              {roleLabel}
            </span>
            {isAdmin && (
              <span
                className="ac-chip inline-flex items-center gap-1 text-xs font-semibold"
                style={{ color: "#7c3aed" }}
              >
                <Sparkles className="h-3 w-3" aria-hidden />
                Admin
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="ac-divider my-5" />

      <div className="grid grid-cols-2 gap-3">
        <div className="ac-card rounded-2xl p-4 text-center">
          <span
            className="ac-badge mx-auto mb-2 flex h-9 w-9 items-center justify-center"
            style={{ "--a": "#2560e6" } as CSSProperties}
          >
            <Trophy className="h-4 w-4" aria-hidden />
          </span>
          <div className="font-display text-2xl font-extrabold leading-none text-foreground">
            <AnimatedCounter value={xp} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">XP earned</div>
        </div>
        <div className="ac-card rounded-2xl p-4 text-center">
          <span
            className="ac-badge mx-auto mb-2 flex h-9 w-9 items-center justify-center"
            style={{ "--a": "#1aa9d6" } as CSSProperties}
          >
            <Hash className="h-4 w-4" aria-hidden />
          </span>
          <div className="font-display text-2xl font-extrabold leading-none text-foreground">
            {teamNumber ? (
              <AnimatedCounter value={teamNumber} />
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {teamNumber ? "your team" : "no team yet"}
          </div>
        </div>
      </div>

      <p className="mt-5 text-[13px] leading-relaxed text-muted-foreground">
        {joined
          ? `Member since ${joined} — edit the details below.`
          : "Edit your details below to complete your profile."}
      </p>
    </motion.div>
  );
}
