"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Crown } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { AnimatedCounter } from "@/components/animated-counter";
import { inkFor } from "@/lib/departments";
import type { PodiumEntry } from "@/components/leaderboard/podium";

const RANK_ACCENT: Record<number, string> = {
  2: "#22d3ee",
  3: "#ff3dcb",
};

/**
 * Signature hero device: "Current champion" — a floating glass instrument
 * that spotlights rank #1 (crown, avatar, live XP count-up) with ranks #2
 * and #3 trailing underneath as spring-loaded XP-gap meters. This is the
 * page's "podium moment," felt before you ever scroll to the full board.
 */
export function ChampionPanel({ top3 }: { top3: PodiumEntry[] }) {
  const reduce = useReducedMotion();
  const champ = top3[0];
  const rest = top3.slice(1, 3);
  if (!champ) return null;

  const gold = "#ffd23d";
  const ink = inkFor(gold);
  const max = Math.max(1, champ.xp);

  const champName = (
    <span className="block truncate font-display text-lg font-bold text-foreground sm:text-xl">
      {champ.name}
    </span>
  );

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
      {/* header row */}
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-[17px] font-bold text-foreground">
          Current champion
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

      {/* champion row */}
      <div className="mt-5 flex items-center gap-4">
        <div className="relative shrink-0">
          <div
            className="rounded-2xl p-[2px]"
            style={{
              backgroundImage: `linear-gradient(135deg, ${gold}, color-mix(in srgb, ${gold} 30%, transparent))`,
            }}
          >
            <Avatar
              name={champ.name}
              src={champ.avatarUrl}
              seed={champ.username ?? champ.id}
              className="h-16 w-16 rounded-[1rem] border-2 border-background sm:h-[4.5rem] sm:w-[4.5rem]"
            />
          </div>
          <motion.span
            aria-hidden
            className="absolute -right-2 -top-2.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background"
            style={{ background: gold }}
            initial={{ opacity: 0, scale: 0.5, rotate: -16 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={reduce ? { duration: 0 } : { delay: 0.5, type: "spring", stiffness: 260, damping: 16 }}
          >
            <Crown className="h-4 w-4" style={{ color: ink }} />
          </motion.span>
        </div>
        <div className="min-w-0 flex-1">
          {champ.username ? (
            <Link
              href={`/u/${champ.username}`}
              className="-my-1.5 inline-flex min-h-[44px] max-w-full items-center rounded-md py-1.5 outline-none transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {champName}
            </Link>
          ) : (
            champName
          )}
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {champ.teamNumber != null ? `Team ${champ.teamNumber} · ` : ""}
            <span className="capitalize">{champ.role}</span>
          </p>
          <p className="mt-1.5 font-display text-2xl font-extrabold tabular-nums" style={{ color: ink }}>
            <AnimatedCounter value={champ.xp} />{" "}
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              XP
            </span>
          </p>
        </div>
      </div>

      {/* runner-up meters */}
      {rest.length > 0 && (
        <div className="mt-5 space-y-3">
          {rest.map((e, i) => {
            const accent = RANK_ACCENT[e.rank] ?? "#22d3ee";
            return (
              <div key={e.id}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-display text-[11px] font-bold"
                      style={{ background: accent, color: inkFor(accent) }}
                    >
                      {e.rank}
                    </span>
                    <span className="truncate">{e.name}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                    {e.xp.toLocaleString()} XP
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[rgba(120,145,190,0.18)]">
                  <motion.div
                    className="h-full origin-left rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${accent}, #1aa9d6)`,
                      width: `${Math.max(6, Math.round((e.xp / max) * 100))}%`,
                    }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={
                      reduce
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 90, damping: 20, delay: 0.5 + i * 0.12 }
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-5 text-[13px] leading-relaxed text-muted-foreground">
        Finish a lesson to earn XP and start closing the gap to the top.
      </p>
    </motion.div>
  );
}
