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
  { key: "week", label: "Weekly" },
  { key: "all", label: "All-Time" },
  { key: "team", label: "By Team" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const BOARD_TITLE: Record<TabKey, string> = {
  week: "This week's rankings",
  all: "All-time rankings",
  team: "Team rankings",
};

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
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const focusTab = (index: number) => {
    const next = (index + TABS.length) % TABS.length;
    setTab(TABS[next].key);
    tabRefs.current[next]?.focus();
  };

  const onTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        focusTab(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        focusTab(index - 1);
        break;
      case "Home":
        e.preventDefault();
        focusTab(0);
        break;
      case "End":
        e.preventDefault();
        focusTab(TABS.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div>
      {/* Tab switcher — Arena Clay clay-glass segmented control */}
      <div
        role="tablist"
        aria-label="Leaderboard views"
        className="aq-glass mx-auto mt-10 flex w-full max-w-md items-center gap-1 rounded-2xl p-1.5"
      >
        {TABS.map((t, i) => (
          <button
            key={t.key}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            role="tab"
            id={`lb-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`lb-panel-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            onClick={() => setTab(t.key)}
            onKeyDown={(e) => onTabKeyDown(e, i)}
            className={cn(
              "relative flex-1 min-h-[44px] cursor-pointer rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              tab === t.key
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === t.key && (
              <motion.span
                layoutId="lb-tab"
                // NOTE: no aq-cta here — its global `position: relative` would
                // override `absolute` and shrink the pill to content size.
                className="absolute inset-0 rounded-xl"
                style={{
                  background: "linear-gradient(160deg, #3b78f2, #0f7fb8)",
                  boxShadow:
                    "0 6px 16px rgba(37,96,230,0.30), inset 0 1px 0 rgba(255,255,255,0.45)",
                }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative z-10">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "week" && (
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Ranked by XP earned in the last 7 days — resets weekly, so anyone can
          reach the top.
        </p>
      )}

      {tab === "team" ? (
        <div
          role="tabpanel"
          id="lb-panel-team"
          aria-labelledby="lb-tab-team"
          tabIndex={0}
        >
          <TeamBoard key="team" teams={teams} userTeam={userTeam} />
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`lb-panel-${tab}`}
          aria-labelledby={`lb-tab-${tab}`}
          tabIndex={0}
        >
          <IndividualBoard
            key={tab}
            title={BOARD_TITLE[tab]}
            entries={tab === "week" ? weekly : allTime}
            emptyLabel={
              tab === "week"
                ? "No XP earned this week yet — be the first to climb."
                : "No learners on the board yet."
            }
          />
        </div>
      )}
    </div>
  );
}

function IndividualBoard({
  entries,
  emptyLabel,
  title,
}: {
  entries: PodiumEntry[];
  emptyLabel: string;
  title: string;
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
        <div className="aq-card mt-12 overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <h3 className="aq-display text-base font-semibold text-foreground">{title}</h3>
          </div>
          <div className="aq-eyebrow hidden items-center gap-4 border-b border-border px-5 py-2.5 text-[0.65rem] text-muted-foreground sm:flex">
            <span className="w-9 text-center">Rank</span>
            <span className="ml-[3.25rem] flex-1">Learner</span>
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
    return (
      <Empty label="No teams on the board yet — add your team number in settings." />
    );
  return (
    <div className="aq-card mt-12 overflow-hidden">
      <div className="border-b border-border px-5 py-3">
        <h3 className="aq-display text-base font-semibold text-foreground">
          {BOARD_TITLE.team}
        </h3>
      </div>
      <div className="aq-eyebrow hidden items-center gap-4 border-b border-border px-5 py-2.5 text-[0.65rem] text-muted-foreground sm:flex">
        <span className="w-9 text-center">Rank</span>
        <span className="ml-[3.25rem] flex-1">Team</span>
        <span className="w-24 text-right">Members</span>
        <span className="w-24 text-right">XP</span>
      </div>
      <motion.ul
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045 } } }}
        className="divide-y divide-border"
      >
        {teams.map((t) => {
          const mine = t.team_number === userTeam;
          return (
            <motion.li
              key={t.team_number}
              variants={{
                hidden: { opacity: 0, y: 14 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] },
                },
              }}
              className={cn(
                "relative flex items-center gap-3 px-4 py-3.5 transition-colors sm:gap-4 sm:px-5",
                mine
                  ? "bg-primary/[0.07] ring-1 ring-inset ring-primary/40"
                  : "hover:bg-primary/[0.04]"
              )}
            >
              {mine && (
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-1 rounded-r bg-primary"
                />
              )}
              <span
                className={cn(
                  "w-7 shrink-0 text-center text-sm font-bold tabular-nums sm:w-9 sm:text-base",
                  mine ? "text-primary" : "text-muted-foreground"
                )}
              >
                {t.rank}
              </span>
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-primary",
                  mine
                    ? "border-primary/50 bg-primary/15"
                    : "border-border bg-primary/10"
                )}
              >
                <Users2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-display font-semibold tracking-tight">
                  Team {t.team_number}
                  {mine && (
                    <span className="aq-badge ml-2 bg-primary text-[0.7rem] font-bold uppercase tracking-[0.08em] text-primary-foreground">
                      Your team
                    </span>
                  )}
                </div>
              </div>
              <span className="w-14 shrink-0 text-right text-sm tabular-nums text-muted-foreground sm:w-24">
                {t.members}
                <span className="ml-1 hidden sm:inline">
                  {t.members === 1 ? "member" : "members"}
                </span>
              </span>
              <span
                className={cn(
                  "w-16 shrink-0 text-right text-sm font-bold tabular-nums sm:w-24 sm:text-base",
                  mine ? "text-primary" : "text-foreground"
                )}
              >
                <AnimatedCounter value={t.totalXp} />
                <span className="ml-1 text-[0.7rem] font-medium uppercase text-muted-foreground">
                  xp
                </span>
              </span>
            </motion.li>
          );
        })}
      </motion.ul>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="aq-card mx-auto mt-12 max-w-md p-10 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
