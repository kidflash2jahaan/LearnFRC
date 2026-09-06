"use client";

import * as React from "react";
import { Podium, LeaderTable, type PodiumEntry } from "./podium";

export type TeamRow = {
  rank: number;
  team_number: number;
  totalXp: number;
  members: number;
  avgXp: number;
};

const TABS = [
  { key: "week", label: "this week" },
  { key: "all", label: "all time" },
  { key: "team", label: "by team" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const BOARD_TITLE: Record<TabKey, string> = {
  week: "ranks 4 and down, this week",
  all: "ranks 4 and down, all time",
  team: "every team on the board",
};

const TEAM_VIEWS = [
  { key: "total", label: "total xp" },
  { key: "avg", label: "xp per member" },
] as const;
type TeamViewKey = (typeof TEAM_VIEWS)[number]["key"];

/**
 * THE BOARD, WITH THREE WAYS TO READ IT.
 *
 * The only client boundary on this page, and it exists for one reason: which
 * of the three standings you are looking at. Everything the tabs reveal is
 * server-rendered markup handed down as props, so switching a tab changes what
 * is mounted, not what is fetched.
 *
 * The tab strip is `.nb-tab`: dashed until it is the one you are on, then a
 * solid blue rule. That is deliberate. A filled pill would say "selected" in
 * colour alone, and this site gets printed and photocopied, so the state has to
 * be a change of stroke, not a change of hue.
 */
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
  /** Stated in the UI, not just applied. Comes from TEAM_MIN_MEMBERS. */
  minTeamMembers: number;
  userTeam?: number | null;
}) {
  const [tab, setTab] = React.useState<TabKey>("week");

  return (
    <div>
      <TabStrip
        items={TABS}
        value={tab}
        onChange={setTab}
        ariaLabel="Leaderboard views"
        idPrefix="lb"
      />

      {tab === "team" ? (
        <div
          role="tabpanel"
          id="lb-panel-team"
          aria-labelledby="lb-tab-team"
          tabIndex={0}
          className="mt-[clamp(1.4rem,3vw,2.2rem)]"
        >
          <TeamBoard
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
          className="mt-[clamp(1.4rem,3vw,2.2rem)]"
        >
          <IndividualBoard
            key={tab}
            title={BOARD_TITLE[tab]}
            note={
              tab === "week"
                ? "Ranked by XP earned in the last 7 days. It resets every Monday, so a week of work beats a year of it."
                : "Ranked by every point of XP earned since the account was made."
            }
            entries={tab === "week" ? weekly : allTime}
            emptyLabel={
              tab === "week"
                ? "Nobody has earned XP this week yet. Finish one lesson and the top of this board is yours."
                : "No learners on the board yet."
            }
          />
        </div>
      )}
    </div>
  );
}

/**
 * One strip of tabs. Roving tabindex with arrow, Home and End keys, one real
 * <button> per option, and the focus ring left alone.
 *
 * Shared by the three board views and the team board's two ranking methods, so
 * the page has one tab control rather than two that drift apart.
 */
function TabStrip<K extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  idPrefix,
}: {
  items: readonly { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  ariaLabel: string;
  idPrefix: string;
}) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const move = (index: number) => {
    const next = (index + items.length) % items.length;
    onChange(items[next].key);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        move(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        move(index - 1);
        break;
      case "Home":
        e.preventDefault();
        move(0);
        break;
      case "End":
        e.preventDefault();
        move(items.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex flex-wrap items-end gap-x-[clamp(1.1rem,3vw,2.2rem)] gap-y-1"
    >
      {items.map((t, i) => (
        <button
          key={t.key}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          id={`${idPrefix}-tab-${t.key}`}
          aria-selected={value === t.key}
          aria-controls={`${idPrefix}-panel-${t.key}`}
          tabIndex={value === t.key ? 0 : -1}
          onClick={() => onChange(t.key)}
          onKeyDown={(e) => onKeyDown(e, i)}
          className="nb-tab"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function IndividualBoard({
  entries,
  emptyLabel,
  title,
  note,
}: {
  entries: PodiumEntry[];
  emptyLabel: string;
  title: string;
  note: string;
}) {
  if (!entries.length) return <Empty label={emptyLabel} />;
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <>
      <p className="nb-sub">{note}</p>

      <div className="mt-[clamp(1.6rem,3.4vw,2.6rem)]">
        <Podium entries={podium} />
      </div>

      {rest.length > 0 && (
        <div className="mt-[clamp(2rem,4vw,3rem)]">
          <LeaderTable entries={rest} caption={title} />
        </div>
      )}
    </>
  );
}

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
  // Same aggregated rows either way, ranked server-side across the full set of
  // teams, so rank 1 always means "first on the board you are looking at".
  const rows = perMember ? teamsPerMember : teams;

  if (!teams.length)
    return (
      <Empty label="No teams on the board yet. Put your team number in settings and yours is the first." />
    );

  return (
    <>
      <TabStrip
        items={TEAM_VIEWS}
        value={view}
        onChange={setView}
        ariaLabel="Team ranking method"
        idPrefix="lb-team"
      />

      <p className="nb-sub mt-[clamp(1rem,2.2vw,1.5rem)]">
        {perMember
          ? `Ranked by XP per member, so a team of 10 can beat a team of 100. Teams under ${minTeamMembers} members are left off: below that, one person's score is the whole ranking.`
          : "Ranked by the combined XP of everyone signed up with that team number."}
      </p>

      <div
        role="tabpanel"
        id={`lb-team-panel-${view}`}
        aria-labelledby={`lb-team-tab-${view}`}
        tabIndex={0}
        className="mt-[clamp(1.4rem,3vw,2rem)]"
      >
        {rows.length === 0 ? (
          <Empty
            label={`No team has ${minTeamMembers} or more members signed up yet, so there is nothing to rank. Get your teammates to add your team number in settings and yours shows up here.`}
          />
        ) : (
          <div className="nb-scroll">
            <table className="nb-table">
              <caption className="nb-slug pb-3 text-left">
                {perMember ? "teams by xp per member" : "teams by total xp"}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="w-[3.5rem]">
                    rank
                  </th>
                  <th scope="col">team</th>
                  <th scope="col" className="hidden text-right sm:table-cell">
                    members
                  </th>
                  <th scope="col" className="text-right">
                    {perMember ? "xp / member" : "total xp"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const mine = t.team_number === userTeam;
                  return (
                    <tr
                      key={t.team_number}
                      className={mine ? "bg-blue/[0.07]" : undefined}
                    >
                      <td
                        className={`nb-slug text-ink ${mine ? "border-l-[3px] border-l-blue pl-2" : ""}`}
                      >
                        {t.rank}
                      </td>
                      <td>
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-bold">Team {t.team_number}</span>
                          {mine && (
                            <span className="nb-tag" data-on>
                              yours
                            </span>
                          )}
                        </span>
                        {/* The figure this view is NOT ranking by. Both show in
                            both views, so switching re-orders the board without
                            ever looking like different data. */}
                        <span className="nb-slug block">
                          {perMember
                            ? `${t.totalXp.toLocaleString()} xp total`
                            : `${t.avgXp.toLocaleString()} xp per member`}
                        </span>
                      </td>
                      <td className="nb-slug hidden text-right text-ink sm:table-cell">
                        {t.members}
                      </td>
                      <td className="nb-slug text-right font-bold text-ink">
                        {(perMember ? t.avgXp : t.totalXp).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/** Nothing to rank yet. A note in the margin, not an empty card with a shrug. */
function Empty({ label }: { label: string }) {
  return (
    <div className="nb-note max-w-[46rem]">
      <p className="nb-slug">board / empty</p>
      <p className="mt-2 text-[0.95rem] leading-snug">{label}</p>
    </div>
  );
}
