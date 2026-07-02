import type { CSSProperties } from "react";
import Link from "next/link";
import {
  Trophy,
  ArrowRight,
  Users,
  Zap,
  Sparkles,
  Flame,
  CalendarClock,
} from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { AnimatedCounter } from "@/components/animated-counter";
import { type PodiumEntry } from "@/components/leaderboard/podium";
import {
  LeaderboardTabs,
  type TeamRow,
} from "@/components/leaderboard/leaderboard-tabs";
import { InviteCard } from "@/components/leaderboard/invite-card";
import {
  getLeaderboard,
  getWeeklyLeaderboard,
  getTeamLeaderboard,
  getReferralCount,
  getXpTotals,
  type WeeklyEntry,
} from "@/lib/queries";
import { getSession } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import {
  ChampionSpotlight,
  type ChampionData,
} from "./_champion-spotlight";

export const metadata = {
  title: "Leaderboard · LearnFRC",
  description:
    "See the top FRC learners climbing the ranks — earn XP, level up, and represent your team on the global LearnFRC leaderboard.",
};

const HEADLINE_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

function displayName(p: Profile): string {
  if (p.hide_name) return p.username?.trim() || "Learner";
  return p.full_name?.trim() || p.username?.trim() || "Learner";
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
  const teamRows: TeamRow[] = teams.map((t, i) => ({ rank: i + 1, ...t }));
  // Site-wide totals (all learners), so the header matches the admin panel.
  const totalXp = xpTotals.totalXp;

  const hasBoard = allTimeEntries.length > 0;
  const champTop = allTimeEntries[0];
  const champion: ChampionData | null = champTop
    ? {
        id: champTop.id,
        name: champTop.name,
        username: champTop.username,
        avatarUrl: champTop.avatarUrl,
        teamNumber: champTop.teamNumber,
        role: champTop.role,
        xp: champTop.xp,
        level: champTop.level,
        lessons: champTop.lessons,
        isYou: champTop.isYou,
      }
    : null;

  return (
    <div
      data-theme="arena"
      className="aq-root relative isolate overflow-hidden text-foreground"
    >
      {/* ambient light the glass refracts */}
      <div className="aq-glow" aria-hidden>
        <span
          className="h-[640px] w-[640px] opacity-70"
          style={{
            left: "-160px",
            top: "-200px",
            background: "radial-gradient(circle, #8bbcff, transparent 70%)",
          }}
        />
        <span
          className="h-[560px] w-[560px] opacity-55"
          style={{
            right: "-160px",
            top: "-120px",
            background: "radial-gradient(circle, #ffe08a, transparent 70%)",
          }}
        />
        <span
          className="h-[520px] w-[520px] opacity-50"
          style={{
            left: "34%",
            top: "440px",
            background: "radial-gradient(circle, #6ff0ea, transparent 70%)",
          }}
        />
      </div>

      {/* ============================ HERO ============================ */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-12 pt-28 sm:px-6 sm:pt-28 lg:grid-cols-2 lg:gap-10 lg:pt-32">
        <div>
          <span className="aq-chip aq-eyebrow aq-rise aq-rise-1 inline-flex flex-wrap items-center gap-2">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" /> Climb the ranks
          </span>
          <h1 className="aq-display aq-rise aq-rise-2 mt-4 text-balance text-4xl font-extrabold leading-[1.03] sm:text-5xl lg:text-[3.4rem]">
            The{" "}
            <span className="aq-grad-anim" style={HEADLINE_GRADIENT}>
              podium
            </span>{" "}
            is earned, one lesson at a time.
          </h1>
          <p className="aq-rise aq-rise-3 mt-4 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
            Every guide you finish earns XP. Win the weekly sprint, chase the
            all-time greats, and put your team on the map — the same gracious
            grind that wins build season.
          </p>
          <div className="aq-rise aq-rise-4 mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/guides"
              className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              Start climbing{" "}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            {!user && (
              <Link
                href="/signup"
                className="aq-ghost inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                Create free account
              </Link>
            )}
          </div>

          {/* season stat strip — mono data labels */}
          {hasBoard && (
            <div className="aq-rise aq-rise-5 mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile
                icon={<Users className="h-4 w-4 text-foreground" aria-hidden />}
                accent="#2560e6"
                value={<AnimatedCounter value={xpTotals.learners} />}
                label={
                  xpTotals.learners === 1 ? "learner ranked" : "learners ranked"
                }
              />
              <StatTile
                icon={<Zap className="h-4 w-4 text-foreground" aria-hidden />}
                accent="#1aa9d6"
                value={<AnimatedCounter value={totalXp} />}
                label="XP earned"
              />
              <div
                className="aq-tile col-span-2 flex items-center justify-center gap-2 rounded-2xl px-4 py-3 sm:col-span-1"
                style={{ "--a": "var(--accent)" } as CSSProperties}
              >
                <span
                  className="aq-pulse h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]"
                  aria-hidden
                />
                <CalendarClock
                  className="h-4 w-4 text-foreground/80"
                  aria-hidden
                />
                <span className="text-sm font-semibold text-foreground">
                  Weekly race resets Monday
                </span>
              </div>
            </div>
          )}
        </div>

        {/* SIGNATURE: champion spotlight (or invite to be first) */}
        {champion ? (
          <ChampionSpotlight champion={champion} />
        ) : (
          <div className="aq-glass aq-sheen aq-float aq-rise aq-rise-3 rounded-[28px] p-10 text-center lg:justify-self-end">
            <div
              className="aq-badge aq-badge-bob mx-auto mb-5 flex h-16 w-16 items-center justify-center"
              style={{ "--a": "#ffd23d" } as CSSProperties}
            >
              <Trophy className="h-8 w-8 text-foreground" aria-hidden />
            </div>
            <h2 className="aq-display text-2xl font-bold tracking-tight">
              The podium is empty
            </h2>
            <p className="mt-2 text-base leading-relaxed text-foreground/70">
              No learners on the board yet. Be the first — start learning, earn
              XP, and claim the crown.
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                href="/guides"
                className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                Start learning
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        )}
      </section>

      {hasBoard && (
        <div className="mx-auto max-w-5xl px-4 pb-24 sm:px-6 lg:px-8">
          {user && profile?.username && (
            <Reveal>
              <InviteCard username={profile.username} count={referralCount} />
            </Reveal>
          )}

          {/* Board section header */}
          <Reveal className="mt-14 text-center">
            <span className="aq-eyebrow inline-flex items-center justify-center gap-2">
              <Flame className="h-3.5 w-3.5" aria-hidden />
              The full board
            </span>
            <h2 className="aq-display mt-2 text-3xl font-bold text-foreground">
              Every rank, every week
            </h2>
            <p className="mx-auto mt-1 max-w-lg text-base text-foreground/70">
              Weekly sprints, the all-time greats, and how your team stacks up —
              switch the view below.
            </p>
          </Reveal>

          <LeaderboardTabs
            weekly={weeklyEntries}
            allTime={allTimeEntries}
            teams={teamRows}
            userTeam={profile?.team_number ?? null}
          />

          <Reveal className="mt-14 text-center">
            <div className="aq-glass aq-sheen mx-auto max-w-2xl rounded-[28px] px-8 py-10">
              <div
                className="aq-badge aq-badge-bob mx-auto mb-4 flex h-12 w-12 items-center justify-center"
                style={{ "--a": "#2560e6" } as CSSProperties}
              >
                <Sparkles className="h-6 w-6 text-foreground" aria-hidden />
              </div>
              <h2 className="aq-display text-balance text-2xl font-bold text-foreground sm:text-3xl">
                Not on the board yet?
              </h2>
              <p className="mx-auto mt-2 max-w-md text-base text-foreground/70">
                Finish a lesson, earn your first XP, and start the climb toward
                the crown.
              </p>
              <div className="mt-6 flex justify-center">
                <Link
                  href="/guides"
                  className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
                >
                  Start a lesson
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      )}
    </div>
  );
}

function StatTile({
  icon,
  accent,
  value,
  label,
}: {
  icon: React.ReactNode;
  accent: string;
  value: React.ReactNode;
  label: string;
}) {
  return (
    <div
      className="aq-tile flex items-center gap-3 rounded-2xl px-4 py-3"
      style={{ "--a": accent } as CSSProperties}
    >
      <span className="aq-badge aq-badge-bob flex h-9 w-9 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-bold tabular-nums leading-none text-foreground">
          {value}
        </span>
        <span className="mt-1 block truncate text-sm font-medium text-foreground sm:text-xs">
          {label}
        </span>
      </span>
    </div>
  );
}
