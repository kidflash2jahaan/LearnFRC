"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Crown } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { NeonCounter } from "@/components/motion/terminal";
import { cn } from "@/lib/utils";

export type PodiumEntry = {
  id: string;
  rank: number;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  teamNumber: number | null;
  role: string;
  xp: number;
  level: number;
  lessons: number;
  isYou: boolean;
};

const ROW_EASE = [0.21, 0.47, 0.32, 0.98] as const;

/** Per-rank neon treatment. Rank 1 (gold) is centered & elevated. */
const RANK_STYLE: Record<
  number,
  {
    /** css color var for the rank accent */
    accent: string;
    label: string;
    order: string;
    delay: number;
    /** lift the champion above the 2/3 plinths on desktop */
    lift: string;
  }
> = {
  1: {
    accent: "var(--gold)",
    label: "RANK 01",
    order: "order-first sm:order-2",
    delay: 0,
    lift: "sm:-translate-y-4",
  },
  2: {
    accent: "var(--accent)",
    label: "RANK 02",
    order: "order-2 sm:order-1",
    delay: 0.08,
    lift: "",
  },
  3: {
    accent: "var(--magenta)",
    label: "RANK 03",
    order: "order-3 sm:order-3",
    delay: 0.16,
    lift: "",
  },
};

function PodiumColumn({ entry }: { entry: PodiumEntry }) {
  const reduce = useReducedMotion();
  const s = RANK_STYLE[entry.rank] ?? RANK_STYLE[3];
  const isFirst = entry.rank === 1;
  const accent = s.accent;

  const NameTag = (
    <span className="block max-w-[12rem] truncate font-display text-base font-semibold tracking-tight sm:text-lg">
      {entry.name}
    </span>
  );

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, delay: s.delay, ease: ROW_EASE }}
      whileHover={reduce ? undefined : { y: -6 }}
      className={cn("flex w-full flex-col", s.order, s.lift)}
    >
      <div
        className={cn(
          "group relative overflow-hidden rounded-2xl border bg-card/70 px-5 pb-6 pt-7 text-center backdrop-blur-md transition-shadow",
          isFirst ? "sm:px-6 sm:pb-8 sm:pt-9" : ""
        )}
        style={{
          borderColor: `color-mix(in srgb, ${accent} 38%, var(--border))`,
          boxShadow: `0 0 0 1px color-mix(in srgb, ${accent} 18%, transparent), 0 28px 60px -42px color-mix(in srgb, ${accent} 70%, transparent)`,
        }}
      >
        {/* top radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-12 h-32 opacity-70"
          style={{
            background: `radial-gradient(closest-side, color-mix(in srgb, ${accent} 24%, transparent), transparent)`,
          }}
        />

        {/* rank tag */}
        <span
          className="absolute right-4 top-4 font-mono text-[0.62rem] tracking-[0.16em]"
          style={{ color: `color-mix(in srgb, ${accent} 75%, var(--muted-foreground))` }}
        >
          // {s.label}
        </span>

        {/* crown on the champion */}
        {isFirst && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, rotate: -12 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ delay: s.delay + 0.3, type: "spring", stiffness: 260, damping: 16 }}
            className="mb-2 flex justify-center"
            aria-hidden
          >
            <Crown
              className="h-6 w-6 drop-shadow"
              style={{ color: accent, filter: `drop-shadow(0 0 8px ${accent})` }}
            />
          </motion.div>
        )}

        {/* avatar + medal chip */}
        <div className="relative mx-auto w-fit">
          <div
            aria-hidden
            className="absolute -inset-1 rounded-2xl opacity-60 blur-md"
            style={{ background: accent }}
          />
          <div
            className="relative rounded-2xl p-[2px]"
            style={{ backgroundImage: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 30%, transparent))` }}
          >
            <Avatar
              name={entry.name}
              src={entry.avatarUrl}
              seed={entry.username ?? entry.id}
              className={cn(
                "rounded-[0.9rem] border-2 border-background",
                isFirst ? "h-20 w-20 sm:h-24 sm:w-24" : "h-16 w-16 sm:h-20 sm:w-20"
              )}
            />
          </div>
          <span
            className="absolute -bottom-2.5 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border-2 border-background font-mono text-xs font-bold"
            style={{ background: accent, color: "var(--background)" }}
            aria-label={`Rank ${entry.rank}`}
          >
            {entry.rank}
          </span>
        </div>

        {/* name + team */}
        <div className="mt-6">
          {entry.username ? (
            <Link
              href={`/u/${entry.username}`}
              className="inline-block rounded-sm outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
            >
              {NameTag}
            </Link>
          ) : (
            NameTag
          )}
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5 font-mono text-[0.72rem] text-muted-foreground">
            {entry.isYou && (
              <span className="rounded bg-primary/15 px-1.5 py-0.5 font-semibold text-primary">
                YOU
              </span>
            )}
            {entry.teamNumber != null && <span>Team {entry.teamNumber}</span>}
            <span className="capitalize">· {entry.role}</span>
          </div>
        </div>

        {/* XP */}
        <div className="mt-5">
          <span
            className="font-display text-2xl font-bold tabular-nums tracking-tight sm:text-3xl"
            style={{ color: accent, textShadow: `0 0 24px color-mix(in srgb, ${accent} 45%, transparent)` }}
          >
            <NeonCounter to={entry.xp} />
          </span>
          <span className="ml-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
            XP
          </span>
        </div>

        {/* plinth */}
        <div className="mt-5 border-t border-border pt-3 font-mono text-[0.7rem] tracking-wide text-muted-foreground">
          Lvl {entry.level} · {entry.lessons} lessons
        </div>
      </div>
    </motion.div>
  );
}

export function Podium({ entries }: { entries: PodiumEntry[] }) {
  // Render in rank order; CSS `order` re-positions rank 1 to the center.
  const ordered = [...entries].sort((a, b) => a.rank - b.rank);
  return (
    <div className="mx-auto grid max-w-3xl grid-cols-1 items-end gap-4 sm:grid-cols-3 sm:gap-5">
      {ordered.map((e) => (
        <PodiumColumn key={e.id} entry={e} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Ranked rows (rank 4+)                                              */
/*  CRITICAL: animate on MOUNT (initial -> animate), never            */
/*  whileInView+once, so rows are always visible after a tab switch.  */
/* ------------------------------------------------------------------ */

const rowContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045 } },
};

const rowItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: ROW_EASE } },
};

export function LeaderList({ entries }: { entries: PodiumEntry[] }) {
  return (
    <motion.ul
      initial="hidden"
      animate="show"
      variants={rowContainer}
      className="divide-y divide-border"
    >
      {entries.map((e) => (
        <motion.li key={e.id} variants={rowItem}>
          <LeaderRow entry={e} />
        </motion.li>
      ))}
    </motion.ul>
  );
}

function LeaderRow({ entry }: { entry: PodiumEntry }) {
  const reduce = useReducedMotion();
  const NameTag = (
    <span className="truncate font-display font-semibold tracking-tight">
      {entry.name}
    </span>
  );

  return (
    <motion.div
      whileHover={reduce ? undefined : { x: 4 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className={cn(
        "group relative flex items-center gap-3 px-4 py-3.5 transition-colors sm:gap-4 sm:px-5",
        entry.isYou
          ? "bg-primary/[0.07] ring-1 ring-inset ring-primary/40"
          : "hover:bg-primary/[0.04]"
      )}
    >
      {/* current-user accent bar */}
      {entry.isYou && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1 rounded-r bg-primary shadow-[0_0_12px_var(--primary)]"
        />
      )}

      {/* rank */}
      <span
        className={cn(
          "w-7 shrink-0 text-center font-mono text-sm font-bold tabular-nums sm:w-9 sm:text-base",
          entry.isYou ? "text-primary" : "text-muted-foreground"
        )}
      >
        {entry.rank}
      </span>

      {/* avatar */}
      <Avatar
        name={entry.name}
        src={entry.avatarUrl}
        seed={entry.username ?? entry.id}
        className={cn(
          "h-10 w-10 shrink-0 rounded-xl ring-1",
          entry.isYou ? "ring-primary/50" : "ring-border"
        )}
      />

      {/* identity */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {entry.username ? (
            <Link
              href={`/u/${entry.username}`}
              className="min-w-0 rounded-sm outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
            >
              {NameTag}
            </Link>
          ) : (
            <span className="min-w-0">{NameTag}</span>
          )}
          {entry.isYou && (
            <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.1em] text-primary-foreground">
              You
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.72rem] text-muted-foreground">
          {entry.teamNumber != null && (
            <span className="text-foreground/70">Team {entry.teamNumber}</span>
          )}
          <span className="capitalize">· {entry.role}</span>
        </div>
      </div>

      {/* level badge */}
      <span
        className="hidden shrink-0 items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 font-mono text-xs font-semibold text-primary sm:inline-flex"
        aria-label={`Level ${entry.level}`}
      >
        Lvl {entry.level}
      </span>

      {/* lessons */}
      <span className="hidden w-20 shrink-0 text-right font-mono text-xs text-muted-foreground md:block">
        <span className="font-semibold text-foreground/80">{entry.lessons}</span> done
      </span>

      {/* XP */}
      <span
        className={cn(
          "w-16 shrink-0 text-right font-mono text-sm font-bold tabular-nums sm:w-24 sm:text-base",
          entry.isYou ? "text-primary" : "text-foreground"
        )}
      >
        <NeonCounter to={entry.xp} />
        <span className="ml-1 text-[0.6rem] font-medium uppercase text-muted-foreground">
          xp
        </span>
      </span>
    </motion.div>
  );
}
