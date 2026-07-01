import type { CSSProperties } from "react";
import Link from "next/link";
import { Trophy, ArrowRight, Users, Zap, Sparkles } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
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

const nf = new Intl.NumberFormat("en-US");

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

  return (
    <div className="relative overflow-hidden">
      {/* ambient glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-[560px] w-[820px] -translate-x-1/2 rounded-full opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--primary) 22%, transparent), transparent 72%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 right-[8%] -z-10 h-72 w-72 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--accent) 26%, transparent), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-24 left-[6%] -z-10 h-64 w-64 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in srgb, #a855f7 22%, transparent), transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-5xl px-4 pt-28 pb-24 sm:px-6 lg:px-8">
        {/* Hero */}
        <section className="text-center">
          <span className="aq-eyebrow aq-rise aq-rise-1 justify-center">
            <Trophy className="h-3.5 w-3.5" aria-hidden />
            Climb the ranks
          </span>
          <h1 className="aq-rise aq-rise-2 mt-4 text-balance text-5xl font-bold tracking-tight sm:text-6xl">
            The{" "}
            <span style={HEADLINE_GRADIENT}>podium</span>
          </h1>
          <p className="aq-rise aq-rise-3 mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-foreground/70 sm:text-lg">
            Every lesson you finish earns XP. Win the weekly sprint, chase the
            all-time greats, and put your team on the map — the same gracious
            grind that wins build season.
          </p>
        </section>

        {allTimeEntries.length === 0 ? (
          /* Empty state — no learners at all yet */
          <Reveal className="mt-16">
            <div className="aq-glass mx-auto max-w-md rounded-3xl p-10 text-center">
              <div
                className="aq-badge mx-auto mb-5 flex h-16 w-16 items-center justify-center"
                style={{ "--a": "#2560e6" } as CSSProperties}
              >
                <Trophy className="h-8 w-8 text-foreground" aria-hidden />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">
                No learners on the board yet
              </h2>
              <p className="mt-2 text-base leading-relaxed text-foreground/70">
                Be the first — start learning, earn XP, and claim the top spot.
              </p>
              <div className="mt-6 flex justify-center">
                <Link href="/guides" className="aq-cta">
                  Start learning
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </Reveal>
        ) : (
          <>
            {/* Season stat strip */}
            <Reveal className="mt-10">
              <div className="aq-card grid grid-cols-2 gap-3 rounded-3xl p-3 sm:grid-cols-3 sm:gap-4 sm:p-4">
                <StatTile
                  icon={<Users className="h-4 w-4 text-foreground" aria-hidden />}
                  accent="#2560e6"
                  value={nf.format(xpTotals.learners)}
                  label={xpTotals.learners === 1 ? "learner ranked" : "learners ranked"}
                />
                <StatTile
                  icon={<Zap className="h-4 w-4 text-foreground" aria-hidden />}
                  accent="#1aa9d6"
                  value={nf.format(totalXp)}
                  label="XP earned"
                />
                <div
                  className="aq-tile col-span-2 flex items-center justify-center gap-2 rounded-2xl px-4 py-3 sm:col-span-1"
                  style={{ "--a": "#7c3aed" } as CSSProperties}
                >
                  <Sparkles className="h-4 w-4 text-foreground/80" aria-hidden />
                  <span className="text-sm font-semibold text-foreground">
                    Weekly race resets Monday
                  </span>
                </div>
              </div>
            </Reveal>

            {user && profile?.username && (
              <Reveal>
                <InviteCard username={profile.username} count={referralCount} />
              </Reveal>
            )}

            <LeaderboardTabs
              weekly={weeklyEntries}
              allTime={allTimeEntries}
              teams={teamRows}
              userTeam={profile?.team_number ?? null}
            />

            <Reveal className="mt-14 text-center">
              <p className="text-base text-foreground/70">
                Not on the board yet?{" "}
                <Link
                  href="/guides"
                  className="font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Start a lesson
                </Link>{" "}
                and start climbing.
              </p>
            </Reveal>
          </>
        )}
      </div>
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
  value: string;
  label: string;
}) {
  return (
    <div
      className="aq-tile flex items-center gap-3 rounded-2xl px-4 py-3"
      style={{ "--a": accent } as CSSProperties}
    >
      <span className="aq-badge flex h-9 w-9 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-bold tabular-nums leading-none text-foreground">
          {value}
        </span>
        <span className="mt-1 block truncate text-xs font-medium text-foreground/70">
          {label}
        </span>
      </span>
    </div>
  );
}
