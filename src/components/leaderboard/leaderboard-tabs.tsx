"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Users2 } from "lucide-react";
import { AnimatedCounter } from "@/components/animated-counter";
import { Podium, LeaderList, ROW_COLS, type PodiumEntry } from "./podium";
import { cn } from "@/lib/utils";

export type TeamRow = {
  rank: number;
  team_number: number;
  totalXp: number;
  members: number;
  avgXp: number;
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

const TEAM_VIEWS = [
  { key: "total", label: "Total" },
  { key: "avg", label: "Per member" },
] as const;
type TeamViewKey = (typeof TEAM_VIEWS)[number]["key"];

export function LeaderboardTabs({
  weekly,
  allTime,
  teams,
  teamsPerMember,
  minTeamMembers,
  userTeam = null,
}: {
  weekly: PodiumEntry[];
  allTime: PodiumEntry[];
  /** Teams by combined XP. Both boards arrive already ranked from the server. */
  teams: TeamRow[];
  /** The same teams by XP per member, minus the ones under the minimum. */
  teamsPerMember: TeamRow[];
  /** Stated in the UI, not just applied — comes from TEAM_MIN_MEMBERS. */
  minTeamMembers: number;
  userTeam?: number | null;
}) {
  const [tab, setTab] = React.useState<TabKey>("week");

  return (
    <div>
      {/* Tab switcher — clay-glass segmented control */}
      <SegmentedTabs
        items={TABS}
        value={tab}
        onChange={setTab}
        ariaLabel="Leaderboard views"
        idPrefix="lb"
        layoutId="lb-tab"
        className="mx-auto mt-10 w-full max-w-md"
      />

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
          <TeamBoard
            key="team"
            teams={teams}
            teamsPerMember={teamsPerMember}
            minTeamMembers={minTeamMembers}
            userTeam={userTeam}
          />
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

/**
 * The clay-glass segmented control the board has always used, lifted out so the
 * team board's Total / Per member switch is the same control rather than a
 * second one that drifts. Roving tabindex + arrow / Home / End keys, one real
 * <button> per option, focus ring left visible.
 *
 * `layoutId` must be unique per control — two controls sharing one id would
 * make framer-motion fly the highlight pill between them.
 */
function SegmentedTabs<K extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  idPrefix,
  layoutId,
  className,
}: {
  items: readonly { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  ariaLabel: string;
  idPrefix: string;
  layoutId: string;
  className?: string;
}) {
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const focusTab = (index: number) => {
    const next = (index + items.length) % items.length;
    onChange(items[next].key);
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
        focusTab(items.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "ac-glass flex items-center gap-1 rounded-2xl p-1.5",
        className
      )}
    >
      {items.map((t, i) => (
        <button
          key={t.key}
          ref={(el) => {
            tabRefs.current[i] = el;
          }}
          role="tab"
          id={`${idPrefix}-tab-${t.key}`}
          aria-selected={value === t.key}
          aria-controls={`${idPrefix}-panel-${t.key}`}
          tabIndex={value === t.key ? 0 : -1}
          onClick={() => onChange(t.key)}
          onKeyDown={(e) => onTabKeyDown(e, i)}
          className={cn(
            "relative min-h-[44px] flex-1 cursor-pointer rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            value === t.key ? "text-white" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {value === t.key && (
            <motion.span
              layoutId={layoutId}
              // NOTE: no ac-btn here — its `display: inline-flex` would
              // override this element's `absolute` positioning.
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
        <div className="ac-card mt-12 overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <h3 className="font-display text-base font-semibold text-foreground">
              {title}
            </h3>
          </div>
          {/* Header mirrors LeaderRow's exact geometry — both import ROW_COLS
              from podium.tsx, so the widths can never drift apart. */}
          <div className="hidden items-center gap-3 border-b border-border px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:flex sm:gap-4 sm:px-5">
            <span className={ROW_COLS.rank}>Rank</span>
            <span className={ROW_COLS.avatar} aria-hidden />
            <span className={ROW_COLS.name}>Learner</span>
            <span className={cn(ROW_COLS.level, "justify-center text-center")}>Level</span>
            <span className={ROW_COLS.lessons}>Lessons</span>
            <span className={ROW_COLS.xp}>XP</span>
          </div>
          <LeaderList entries={rest} />
        </div>
      )}
    </>
  );
}

// Mobile widths are deliberately tighter than they used to be on the two
// numeric columns: the team cell now carries a second line ("584 XP per
// member"), and at 360px it needs every pixel it can get to keep that caption
// on one line. Both numbers still fit their own column at 3-4 digits.
const TEAM_COLS = {
  rank: "w-7 shrink-0 text-center sm:w-9",
  icon: "w-10 shrink-0",
  name: "min-w-0 flex-1",
  members: "w-8 shrink-0 text-right sm:w-24",
  xp: "w-[4.5rem] shrink-0 text-right sm:w-28",
} as const;

function TeamBoard({
  teams,
  teamsPerMember,
  minTeamMembers,
  userTeam,
}: {
  teams: TeamRow[];
  teamsPerMember: TeamRow[];
  minTeamMembers: number;
  userTeam: number | null;
}) {
  const [view, setView] = React.useState<TeamViewKey>("total");
  const perMember = view === "avg";
  // Same aggregated rows either way, ranked server-side over the full set of
  // teams, so rank 1 always means "first on the board you're looking at".
  const rows = perMember ? teamsPerMember : teams;

  if (!teams.length)
    return (
      <Empty label="No teams on the board yet — add your team number in settings." />
    );

  return (
    <>
      <SegmentedTabs
        items={TEAM_VIEWS}
        value={view}
        onChange={setView}
        ariaLabel="Team ranking method"
        idPrefix="lb-team"
        layoutId="lb-team-view"
        className="mx-auto mt-8 w-full max-w-xs"
      />
      <p className="mx-auto mt-3 max-w-lg text-center text-sm text-muted-foreground">
        {perMember
          ? `Ranked by XP per member, so a team of 10 can compete with a team of 100. Only teams with ${minTeamMembers}+ members are listed: below that, one person's score is the whole ranking.`
          : "Ranked by the combined XP of everyone signed up with that team number."}
      </p>

      <div
        role="tabpanel"
        id={`lb-team-panel-${view}`}
        aria-labelledby={`lb-team-tab-${view}`}
        tabIndex={0}
        className="ac-card mt-8 overflow-hidden"
      >
        <div className="border-b border-border px-5 py-3">
          <h3 className="font-display text-base font-semibold text-foreground">
            {perMember ? "Team rankings by XP per member" : BOARD_TITLE.team}
          </h3>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {`No team has ${minTeamMembers} or more members signed up yet, so there's nothing to rank here. Get your teammates to add your team number in settings and you'll show up.`}
          </p>
        ) : (
          <>
            {/* Header mirrors the team-row geometry via the shared TEAM_COLS map. */}
            <div className="hidden items-center gap-3 border-b border-border px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:flex sm:gap-4 sm:px-5">
              <span className={TEAM_COLS.rank}>Rank</span>
              <span className={TEAM_COLS.icon} aria-hidden />
              <span className={TEAM_COLS.name}>Team</span>
              <span className={TEAM_COLS.members}>Members</span>
              <span className={TEAM_COLS.xp}>
                {perMember ? "XP / member" : "Total XP"}
              </span>
            </div>
            <motion.ul
              // Remount on switch so the rows re-enter in their new order
              // instead of silently teleporting past each other.
              key={view}
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045 } } }}
              className="divide-y divide-border"
            >
              {rows.map((t) => {
                const mine = t.team_number === userTeam;
                return (
                  <motion.li
                    key={t.team_number}
                    variants={{
                      hidden: { opacity: 0, y: 14 },
                      show: {
                        opacity: 1,
                        y: 0,
                        transition: {
                          duration: 0.4,
                          ease: [0.21, 0.47, 0.32, 0.98],
                        },
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
                        TEAM_COLS.rank,
                        "text-sm font-bold tabular-nums sm:text-base",
                        mine ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      {t.rank}
                    </span>
                    <span className={TEAM_COLS.icon}>
                      <span
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl border text-primary",
                          mine
                            ? "border-primary/50 bg-primary/15"
                            : "border-border bg-primary/10"
                        )}
                      >
                        <Users2 className="h-5 w-5" aria-hidden="true" />
                      </span>
                    </span>
                    <div className={cn(TEAM_COLS.name, "min-w-0")}>
                      <div className="font-display font-semibold tracking-tight">
                        Team {t.team_number}
                        {mine && (
                          <span className="ac-badge ml-2 px-1.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-[0.08em]" style={{ ["--a" as string]: "var(--primary)" }}>
                            Your team
                          </span>
                        )}
                      </div>
                      {/* The number this view ISN'T ranking by. Both figures
                          show in both views, so switching re-orders the board
                          without ever looking like different data. */}
                      <div className="mt-0.5 text-[0.7rem] tabular-nums text-muted-foreground">
                        {perMember
                          ? `${t.totalXp.toLocaleString()} XP total`
                          : `${t.avgXp.toLocaleString()} XP per member`}
                      </div>
                    </div>
                    <span className={cn(TEAM_COLS.members, "text-sm tabular-nums text-muted-foreground")}>
                      {t.members}
                      <span className="ml-1 hidden sm:inline">
                        {t.members === 1 ? "member" : "members"}
                      </span>
                    </span>
                    <span
                      className={cn(
                        TEAM_COLS.xp,
                        "text-sm font-bold tabular-nums sm:text-base",
                        mine ? "text-primary" : "text-foreground"
                      )}
                    >
                      <AnimatedCounter value={perMember ? t.avgXp : t.totalXp} />
                      <span className="mt-0.5 block text-[0.65rem] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                        {perMember ? "xp / member" : "xp"}
                      </span>
                    </span>
                  </motion.li>
                );
              })}
            </motion.ul>
          </>
        )}
      </div>
    </>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="ac-card mx-auto mt-12 max-w-md p-10 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
