"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Crown, Medal } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { AnimatedCounter } from "@/components/animated-counter";
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

/** Per-rank visual treatment. Rank 1 is centered & tallest. */
const RANK_STYLE: Record<
  number,
  {
    accent: string;
    to: string;
    medal: string;
    podiumH: string;
    avatar: string;
    order: string;
    delay: number;
  }
> = {
  1: {
    accent: "#f5b50a",
    to: "#f97316",
    medal: "Gold",
    podiumH: "h-36 sm:h-44",
    avatar: "h-20 w-20 sm:h-24 sm:w-24",
    order: "order-2",
    delay: 0,
  },
  2: {
    accent: "#a9b4c2",
    to: "#7d8896",
    medal: "Silver",
    podiumH: "h-24 sm:h-32",
    avatar: "h-16 w-16 sm:h-20 sm:w-20",
    order: "order-1",
    delay: 0.12,
  },
  3: {
    accent: "#d08a52",
    to: "#a05a2c",
    medal: "Bronze",
    podiumH: "h-20 sm:h-24",
    avatar: "h-16 w-16 sm:h-20 sm:w-20",
    order: "order-3",
    delay: 0.2,
  },
};

function PodiumColumn({ entry }: { entry: PodiumEntry }) {
  const reduce = useReducedMotion();
  const s = RANK_STYLE[entry.rank];
  const isFirst = entry.rank === 1;

  const NameTag = (
    <span className="block max-w-[10rem] truncate text-sm font-semibold tracking-tight sm:text-base">
      {entry.name}
    </span>
  );

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 36, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.6,
        delay: s.delay,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      className={cn("flex flex-1 flex-col items-center", s.order)}
    >
      {/* Crown on the champion */}
      {isFirst && (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, rotate: -12 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ delay: s.delay + 0.35, type: "spring", stiffness: 260, damping: 16 }}
          className="mb-1"
          aria-hidden
        >
          <Crown
            className="h-7 w-7 drop-shadow"
            style={{ color: s.accent, fill: `color-mix(in srgb, ${s.accent} 30%, transparent)` }}
          />
        </motion.div>
      )}

      {/* Avatar with animated ring + medal chip */}
      <motion.div
        whileHover={reduce ? undefined : { y: -4, scale: 1.04 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
        className="relative"
      >
        <div
          aria-hidden
          className="absolute -inset-1 rounded-full opacity-70 blur-md"
          style={{ background: `linear-gradient(135deg, ${s.accent}, ${s.to})` }}
        />
        <div
          className="relative rounded-full p-[3px]"
          style={{ backgroundImage: `linear-gradient(135deg, ${s.accent}, ${s.to})` }}
        >
          <Avatar
            name={entry.name}
            src={entry.avatarUrl}
            seed={entry.username ?? entry.id}
            className={cn("border-2 border-background", s.avatar)}
          />
        </div>
        {/* rank medal badge */}
        <span
          className="absolute -bottom-2 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border-2 border-background text-xs font-bold text-white shadow-[var(--shadow-md)]"
          style={{ backgroundImage: `linear-gradient(135deg, ${s.accent}, ${s.to})` }}
          aria-label={`${s.medal} medal, rank ${entry.rank}`}
        >
          {entry.rank}
        </span>
      </motion.div>

      {/* Name + meta */}
      <div className="mt-4 text-center">
        {entry.username ? (
          <Link
            href={`/u/${entry.username}`}
            className="inline-block rounded-sm outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
          >
            {NameTag}
          </Link>
        ) : (
          NameTag
        )}
        <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          {entry.isYou && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary">
              You
            </span>
          )}
          {entry.teamNumber != null && (
            <span className="rounded-full border border-border px-2 py-0.5 font-mono">
              #{entry.teamNumber}
            </span>
          )}
          <span className="capitalize">{entry.role}</span>
        </div>
      </div>

      {/* Podium plinth */}
      <motion.div
        initial={reduce ? { opacity: 0 } : { scaleY: 0, opacity: 0 }}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={{
          duration: 0.55,
          delay: s.delay + 0.18,
          ease: [0.21, 0.47, 0.32, 0.98],
        }}
        style={{ transformOrigin: "bottom" }}
        className={cn(
          "relative mt-4 flex w-full flex-col items-center justify-end overflow-hidden rounded-t-2xl border border-b-0 border-border",
          s.podiumH
        )}
      >
        {/* gradient face */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.16]"
          style={{ background: `linear-gradient(180deg, ${s.accent}, ${s.to})` }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ background: `linear-gradient(90deg, ${s.accent}, ${s.to})` }}
        />
        <div className="relative z-10 flex flex-col items-center gap-0.5 pb-4">
          <Medal className="h-4 w-4" style={{ color: s.accent }} aria-hidden />
          <span
            className="font-mono text-xl font-bold tabular-nums sm:text-2xl"
            style={{ color: s.accent }}
          >
            <AnimatedCounter value={entry.xp} />
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            XP
          </span>
          <span className="mt-1 text-[11px] text-muted-foreground">
            Lvl {entry.level} · {entry.lessons} lessons
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function Podium({ entries }: { entries: PodiumEntry[] }) {
  // Render in rank order; CSS `order` re-positions 1 to the center.
  const ordered = [...entries].sort((a, b) => a.rank - b.rank);
  return (
    <div className="mx-auto flex max-w-2xl items-end justify-center gap-3 sm:gap-5">
      {ordered.map((e) => (
        <PodiumColumn key={e.id} entry={e} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Ranked rows (rank 4+)                                              */
/* ------------------------------------------------------------------ */

const ROW_EASE = [0.21, 0.47, 0.32, 0.98] as const;

const rowContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const rowItem = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: ROW_EASE } },
};

export function LeaderList({ entries }: { entries: PodiumEntry[] }) {
  const reduce = useReducedMotion();
  return (
    <motion.ul
      initial="hidden"
      animate="show"
      variants={rowContainer}
      className="divide-y divide-border"
    >
      {entries.map((e) => (
        <motion.li key={e.id} variants={rowItem}>
          <LeaderRow entry={e} reduce={!!reduce} />
        </motion.li>
      ))}
    </motion.ul>
  );
}

function LeaderRow({
  entry,
  reduce,
}: {
  entry: PodiumEntry;
  reduce: boolean;
}) {
  const NameTag = (
    <span className="truncate font-semibold tracking-tight">{entry.name}</span>
  );

  return (
    <motion.div
      whileHover={reduce ? undefined : { x: 4 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className={cn(
        "group relative flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-5",
        entry.isYou && "bg-primary/[0.06] ring-1 ring-inset ring-primary/30"
      )}
    >
      {/* current-user accent bar */}
      {entry.isYou && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1 rounded-r bg-primary"
        />
      )}

      {/* rank */}
      <span className="w-7 shrink-0 text-center font-mono text-sm font-semibold text-muted-foreground sm:w-9 sm:text-base">
        {entry.rank}
      </span>

      {/* avatar */}
      <Avatar
        name={entry.name}
        src={entry.avatarUrl}
        seed={entry.username ?? entry.id}
        className="h-10 w-10 shrink-0 ring-1 ring-border"
      />

      {/* identity */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {entry.username ? (
            <Link
              href={`/u/${entry.username}`}
              className="min-w-0 rounded-sm outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
            >
              {NameTag}
            </Link>
          ) : (
            <span className="min-w-0">{NameTag}</span>
          )}
          {entry.isYou && (
            <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              You
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
          {entry.teamNumber != null && (
            <span className="inline-flex items-center rounded-full border border-border px-1.5 py-0.5 font-mono text-[11px] leading-none">
              #{entry.teamNumber}
            </span>
          )}
          <span className="capitalize">{entry.role}</span>
        </div>
      </div>

      {/* level badge */}
      <span
        className="hidden shrink-0 items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary sm:inline-flex"
        aria-label={`Level ${entry.level}`}
      >
        Lvl {entry.level}
      </span>

      {/* lessons */}
      <span className="hidden w-20 shrink-0 text-right text-xs text-muted-foreground md:block">
        {entry.lessons} lessons
      </span>

      {/* XP */}
      <span className="w-16 shrink-0 text-right font-mono text-sm font-bold tabular-nums sm:w-24 sm:text-base">
        <AnimatedCounter value={entry.xp} />
        <span className="ml-1 text-[10px] font-medium uppercase text-muted-foreground">
          xp
        </span>
      </span>
    </motion.div>
  );
}
