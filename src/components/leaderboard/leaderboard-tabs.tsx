"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Users2 } from "lucide-react";
import { AnimatedCounter } from "@/components/animated-counter";
import { Podium, LeaderList, type PodiumEntry } from "./podium";
import { cn } from "@/lib/utils";

export type TeamRow = {
  rank: number;
  team_number: number;
  totalXp: number;
  members: number;
};

const TABS = [
  { key: "week", label: "This Week" },
  { key: "all", label: "All-Time" },
  { key: "team", label: "By Team" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function LeaderboardTabs({
  weekly,
  allTime,
  teams,
  userTeam = null,
}: {
  weekly: PodiumEntry[];
  allTime: PodiumEntry[];
  teams: TeamRow[];
  userTeam?: number | null;
}) {
  const [tab, setTab] = React.useState<TabKey>("week");

  return (
    <div>
      {/* Tab switcher */}
      <div
        role="tablist"
        aria-label="Leaderboard views"
        className="mx-auto mt-10 flex w-full max-w-md items-center gap-1 rounded-full border border-border bg-card/60 p-1 glass"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "relative flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
              tab === t.key
                ? "text-white"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === t.key && (
              <motion.span
                layoutId="lb-tab"
                className="absolute inset-0 rounded-full bg-brand shadow-[var(--shadow-sm)]"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative z-10">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "week" && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Ranked by XP earned in the last 7 days — resets weekly, so anyone can
          reach the top.
        </p>
      )}

      {tab === "team" ? (
        <TeamBoard teams={teams} userTeam={userTeam} />
      ) : (
        <IndividualBoard
          key={tab}
          entries={tab === "week" ? weekly : allTime}
          emptyLabel={
            tab === "week"
              ? "No XP earned this week yet — be the first to climb."
              : "No learners on the board yet."
          }
        />
      )}
    </div>
  );
}

function IndividualBoard({
  entries,
  emptyLabel,
}: {
  entries: PodiumEntry[];
  emptyLabel: string;
}) {
  if (!entries.length) return <Empty label={emptyLabel} />;
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);
  return (
    <>
      {podium.length > 0 && (
        <section className="mt-12 sm:mt-14" aria-label="Top three">
          <Podium entries={podium} />
        </section>
      )}
      {rest.length > 0 && (
        <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)]">
          <div className="hidden items-center gap-4 border-b border-border px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:flex">
            <span className="w-9 text-center">#</span>
            <span className="flex-1">Learner</span>
            <span className="w-[4.5rem] text-center">Level</span>
            <span className="hidden w-20 text-right md:block">Lessons</span>
            <span className="w-24 text-right">XP</span>
          </div>
          <LeaderList entries={rest} />
        </div>
      )}
    </>
  );
}

function TeamBoard({
  teams,
  userTeam,
}: {
  teams: TeamRow[];
  userTeam: number | null;
}) {
  if (!teams.length)
    return <Empty label="No teams on the board yet — add your team number in settings." />;
  return (
    <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)]">
      <div className="hidden items-center gap-4 border-b border-border px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:flex">
        <span className="w-9 text-center">#</span>
        <span className="flex-1">Team</span>
        <span className="w-24 text-right">Members</span>
        <span className="w-24 text-right">XP</span>
      </div>
      <ul className="divide-y divide-border">
        {teams.map((t) => (
          <li
            key={t.team_number}
            className={cn(
              "flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-5",
              t.team_number === userTeam && "bg-primary/[0.06]"
            )}
          >
            <span className="w-7 shrink-0 text-center font-mono text-sm font-semibold text-muted-foreground sm:w-9 sm:text-base">
              {t.rank}
            </span>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
              <Users2 className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold tracking-tight">
                Team {t.team_number}
                {t.team_number === userTeam && (
                  <span className="ml-2 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    Your team
                  </span>
                )}
              </div>
            </div>
            <span className="w-24 text-right text-xs text-muted-foreground sm:text-sm">
              {t.members} {t.members === 1 ? "member" : "members"}
            </span>
            <span className="w-16 shrink-0 text-right font-mono text-sm font-bold tabular-nums sm:w-24 sm:text-base">
              <AnimatedCounter value={t.totalXp} />
              <span className="ml-1 text-[10px] font-medium uppercase text-muted-foreground">
                xp
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="mx-auto mt-12 max-w-md rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
