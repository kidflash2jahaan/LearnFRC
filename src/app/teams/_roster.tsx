"use client";

import type { CSSProperties } from "react";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Crown, Flame, Medal } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { AnimatedCounter } from "@/components/animated-counter";
import { clampPct } from "@/lib/utils";

export type RosterMember = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  xp: number;
  completed: number;
  lastActive: string | null;
  isYou: boolean;
};

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

/* Rank medal colors for the top three (gold / silver / bronze). */
const MEDAL: Record<number, { ring: string; ink: string }> = {
  0: { ring: "#f5b100", ink: "#8a5a00" },
  1: { ring: "#9fb2cc", ink: "#4d5b78" },
  2: { ring: "#d08653", ink: "#8a4b1f" },
};

function relTime(iso: string | null): string {
  if (!iso) return "not started yet";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "—";
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 3600) return "active just now";
  if (s < 86_400) return `active ${Math.floor(s / 3600)}h ago`;
  const days = Math.floor(s / 86_400);
  if (days < 30) return `active ${days}d ago`;
  return `active ${Math.floor(days / 30)}mo ago`;
}

/**
 * The pit-crew roster. Members ranked by lessons done, the leader crowned,
 * each row an animated progress lane. Spring stagger on scroll-in, hover
 * lift; fully reduced-motion safe.
 */
export function Roster({
  members,
  totalLessons,
}: {
  members: RosterMember[];
  totalLessons: number;
}) {
  const reduce = useReducedMotion();

  return (
    <ul className="flex flex-col gap-3" aria-label="Team roster ranked by progress">
      {members.map((m, i) => {
        const pct = totalLessons > 0 ? clampPct((m.completed / totalLessons) * 100) : 0;
        const medal = MEDAL[i];
        const leader = i === 0 && m.completed > 0;

        return (
          <motion.li
            key={m.userId}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={reduce ? { duration: 0 } : { duration: 0.5, delay: Math.min(i, 10) * 0.05, ease: EASE }}
            whileHover={reduce ? undefined : { y: -3 }}
            className={`ac-card group relative flex items-center gap-4 px-4 py-4 sm:px-5 ${
              m.isYou ? "ring-2 ring-primary/45" : ""
            }`}
          >
            {/* rank chip */}
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums"
              style={
                {
                  background: medal
                    ? `color-mix(in srgb, ${medal.ring} 22%, #fff)`
                    : "rgba(120,145,190,0.14)",
                  color: medal ? medal.ink : "var(--muted-foreground)",
                  boxShadow: medal
                    ? `inset 0 0 0 1.5px ${medal.ring}`
                    : "inset 0 0 0 1px rgba(120,145,190,0.24)",
                } as CSSProperties
              }
              aria-hidden
            >
              {i < 3 ? <Medal className="h-4 w-4" /> : i + 1}
            </span>

            {/* avatar with leader crown */}
            <div className="relative shrink-0">
              <Avatar
                name={m.name}
                src={m.avatarUrl}
                seed={m.userId}
                className="h-11 w-11 transition-transform duration-300 group-hover:scale-105"
              />
              {leader && (
                <span
                  className="absolute -right-1.5 -top-2 flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ background: "#fff", boxShadow: "0 2px 6px rgba(180,140,0,0.4)" }}
                  aria-hidden
                >
                  <Crown className="h-3 w-3" style={{ color: "#c98a00" }} />
                </span>
              )}
            </div>

            {/* name + progress lane */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-base font-semibold text-foreground">{m.name}</span>
                {m.isYou && (
                  <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                    You
                  </span>
                )}
                {leader && (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: "rgba(201,138,0,0.15)", color: "#8a5a00" }}
                  >
                    Team lead
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2.5">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(120,145,190,0.2)]">
                  <motion.span
                    className="block h-full rounded-full"
                    style={{
                      background: "linear-gradient(90deg, #2560e6, #1aa9d6)",
                    }}
                    initial={{ transform: "scaleX(0)" }}
                    whileInView={{ transform: `scaleX(${pct / 100})` }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={
                      reduce
                        ? { duration: 0 }
                        : {
                            duration: 0.9,
                            delay: 0.15 + Math.min(i, 10) * 0.05,
                            ease: EASE,
                          }
                    }
                  />
                </div>
                <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                  {m.completed}/{totalLessons}
                </span>
              </div>
            </div>

            {/* xp + last active */}
            <div className="hidden shrink-0 flex-col items-end sm:flex">
              <span className="inline-flex items-center gap-1 text-sm font-bold text-primary tabular-nums">
                <Flame className="h-3.5 w-3.5" aria-hidden />
                <AnimatedCounter value={m.xp} suffix=" XP" />
              </span>
              <span className="mt-0.5 text-xs text-muted-foreground">{relTime(m.lastActive)}</span>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}
