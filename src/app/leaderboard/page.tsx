import type { Metadata } from "next";
import Link from "next/link";
import { type PodiumEntry } from "@/components/leaderboard/podium";
import { LeaderboardTabs } from "@/components/leaderboard/leaderboard-tabs";
import { InviteCard } from "@/components/leaderboard/invite-card";
import {
  getLeaderboard,
  getWeeklyLeaderboard,
  getTeamLeaderboard,
  getReferralCount,
  getXpTotals,
  TEAM_MIN_MEMBERS,
  type WeeklyEntry,
} from "@/lib/queries";
import { getSession } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import { ChampionPanel } from "./_champion-panel";

export const metadata: Metadata = {
  // The root template appends " · LearnFRC", so don't repeat it here.
  title: "Leaderboard",
  description:
    "See the top FRC learners climbing the ranks — earn XP, level up, and represent your team on the global LearnFRC leaderboard.",
  alternates: { canonical: "/leaderboard" },
  // This page lists usernames and team numbers of learners, many of whom are
  // minors. It's user-generated personal data with no search value, so keep it
  // out of the index entirely while leaving links crawlable.
  robots: {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true },
  },
};

// Public surfaces never show real names: learners are identified by username
// only. Real names live in private views (dashboard, settings, certificate).
function displayName(p: Profile): string {
  return p.username?.trim() || "Learner";
}

function toEntry(
  p: Profile & { lessons: number },
  rank: number,
  currentUserId: string | null
): PodiumEntry {
  const xp = p.xp ?? 0;
  return {
    id: p.id,
    rank,
    name: displayName(p),
    username: p.username,
    avatarUrl: p.avatar_url,
    teamNumber: p.team_number,
    role: p.role || "Learner",
    xp,
    level: Math.floor(xp / 100) + 1,
    lessons: p.lessons,
    isYou: currentUserId != null && p.id === currentUserId,
  };
}

function toWeeklyEntry(
  p: WeeklyEntry,
  rank: number,
  currentUserId: string | null
): PodiumEntry {
  return {
    id: p.id,
    rank,
    name: displayName(p),
    username: p.username,
    avatarUrl: p.avatar_url,
    teamNumber: p.team_number,
    role: p.role || "Learner",
    xp: p.weeklyXp,
    level: Math.floor((p.xp ?? 0) / 100) + 1,
    lessons: p.weeklyLessons,
    isYou: currentUserId != null && p.id === currentUserId,
  };
}

/**
 * /leaderboard is the results sheet posted on the shop wall.
 *
 * A person arrives to answer one of two questions: who is winning, and where
 * am I. So the standing is the first thing on the page, taped up beside the
 * masthead, and the full board underneath is a table you can scan for your own
 * name. Nothing on this page is a scoreboard graphic, because a scoreboard is
 * for spectators and this is for the person in the row.
 */
export default async function LeaderboardPage() {
  const [profiles, weekly, teams, xpTotals, { user, profile }] =
    await Promise.all([
      getLeaderboard(50),
      getWeeklyLeaderboard(50),
      getTeamLeaderboard(50),
      getXpTotals(),
      getSession(),
    ]);

  const uid = user?.id ?? null;
  const referralCount = uid ? await getReferralCount(uid) : 0;
  const allTimeEntries = profiles.map((p, i) => toEntry(p, i + 1, uid));
  const weeklyEntries = weekly.map((p, i) => toWeeklyEntry(p, i + 1, uid));
  // Site-wide totals across all learners, so the band matches the admin panel.
  const totalXp = xpTotals.totalXp;

  const hasBoard = allTimeEntries.length > 0;
  const top3 = allTimeEntries.slice(0, 3);

  return (
    <>
      {/* ===================== MASTHEAD =====================
          Split, because the page has two jobs at the top: say what the board
          is, and show the current standing. Neither should wait for a scroll. */}
      {/* `grid-cols-1` below lg is load-bearing: the implicit `auto` track
          otherwise sizes to the standings card's min-content, stretches past
          `.nb-wrap`, and the root's `overflow-x: clip` shears the lede and the
          buttons off the right edge on a phone. */}
      <section className="nb-wrap grid grid-cols-1 items-start gap-[clamp(1.8rem,4vw,3.4rem)] pb-[clamp(2rem,4vw,3rem)] pt-[clamp(2.2rem,5vw,3.8rem)] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
        <div>
          <p className="nb-marker">the standings</p>

          <h1 className="max-w-[15ch]">
            Every lesson you finish moves you up this page.
          </h1>

          <p className="nb-lede mt-[clamp(1rem,2vw,1.5rem)]">
            One hundred XP a level, a weekly race that resets every Monday, and
            a team board so the whole pit can climb together. Reading is free
            and always was; the ranking is just the part that makes people
            finish.
          </p>

          <div className="mt-[clamp(1.4rem,2.6vw,2rem)] flex flex-wrap gap-3">
            <Link href="/guides" className="nb-btn">
              Open the guides
            </Link>
            {!user && (
              <Link href="/signup" className="nb-btn-ghost">
                Make a free account
              </Link>
            )}
          </div>
        </div>

        {hasBoard ? (
          <ChampionPanel top3={top3} />
        ) : (
          <div className="nb-box nb-tilt-1 relative p-[clamp(1.2rem,2.6vw,1.8rem)] lg:justify-self-end">
            <span
              className="nb-tape -top-3 left-[20%] rotate-[-3.8deg]"
              aria-hidden="true"
            />
            <p className="nb-marker">standings / empty</p>
            <h2 className="text-[clamp(1.2rem,1rem+0.9vw,1.6rem)]">
              Nobody is on the board yet
            </h2>
            <p className="nb-sub mt-2.5 text-[0.95rem]">
              Finish one lesson and the top of this page has your name on it,
              which is a sentence that stops being true fairly quickly.
            </p>
            <div className="mt-4">
              <Link href="/guides" className="nb-btn">
                Read lesson one
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* ===================== THE TOTALS =====================
          The one inverted surface on this page. Figures big enough to read
          from the other side of the shop, printed once and nowhere else. */}
      <section className="nb-slab py-[clamp(2rem,4.2vw,3.2rem)]">
        <div className="nb-wrap grid items-end gap-[clamp(1.3rem,3vw,2.6rem)] min-[900px]:grid-cols-[1.15fr_repeat(2,minmax(0,0.62fr))]">
          <div>
            <h2 className="max-w-[16ch] text-[clamp(1.5rem,1.1rem+1.7vw,2.4rem)]">
              Nobody was paid to be here.
            </h2>
            <p className="mt-3 max-w-[36ch] text-[0.95rem] text-[rgba(245,246,242,0.85)]">
              No marketing budget and no sales calls. Every account on this
              board found the site, then dragged their team onto it.
            </p>
          </div>

          <p className="nb-stamp">
            <b>{xpTotals.learners.toLocaleString()}</b>
            <span>{xpTotals.learners === 1 ? "learner" : "learners"}</span>
          </p>
          <p className="nb-stamp">
            <b>{totalXp.toLocaleString()}</b>
            <span>xp earned</span>
          </p>
        </div>
      </section>

      {hasBoard && (
        <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)] pt-[clamp(2.4rem,5vw,4rem)]">
          {user && profile?.username && (
            <div className="mb-[clamp(2.2rem,4.4vw,3.4rem)]">
              <InviteCard
                username={profile.username}
                count={referralCount}
                via="leaderboard"
              />
            </div>
          )}

          <div className="mb-[clamp(1.4rem,3vw,2.2rem)] flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div>
              <h2>The full board</h2>
              <p className="nb-sub mt-3">
                Three ways to read it: the week that is running now, everything
                ever earned, and the team standing. Your own row is washed blue
                and barred in the margin wherever you land.
              </p>
            </div>
            <p className="nb-pen max-w-[20ch] rotate-[1.4deg] min-[900px]:text-right">
              the weekly one is the winnable one
            </p>
          </div>

          {/* Capped measure. The gutter runs to 1280px, and a five-column
              standing stretched across all of it strands the XP figure a
              hand's width from the name it belongs to. A posted sheet is
              narrower than the wall it is pinned to. */}
          <div className="max-w-[58rem]">
            <LeaderboardTabs
              weekly={weeklyEntries}
              allTime={allTimeEntries}
              teams={teams.byTotal}
              teamsPerMember={teams.byMember}
              minTeamMembers={TEAM_MIN_MEMBERS}
              userTeam={profile?.team_number ?? null}
            />
          </div>

          {/* Not a third call to action. By this point the reader has scrolled
              a whole standing, so the only thing left worth saying is how a
              name gets onto it, and that is one sentence. */}
          <div className="nb-rule mt-[clamp(2.6rem,5vw,4rem)] pt-[clamp(1.6rem,3.2vw,2.4rem)]">
            <div className="nb-note max-w-[46rem]">
              <p className="nb-slug">how xp works</p>
              <p className="mt-2 text-[0.95rem] leading-snug">
                Finish a lesson, pass its quiz, earn the XP. There is no other
                way onto this board and nothing to buy.{" "}
                <Link href="/guides" className="nb-link">
                  Pick a department
                </Link>{" "}
                and start with whichever one your team is worst at.
              </p>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
