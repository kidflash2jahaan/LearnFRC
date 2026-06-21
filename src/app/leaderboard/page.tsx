import Link from "next/link";
import { Trophy, Sparkles, ArrowRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { Podium, LeaderList, type PodiumEntry } from "@/components/leaderboard/podium";
import { getLeaderboard } from "@/lib/queries";
import { getSession } from "@/lib/auth";
import type { Profile } from "@/lib/types";

export const metadata = {
  title: "Leaderboard · LearnFRC",
  description:
    "See the top FRC learners climbing the ranks — earn XP, level up, and represent your team on the global LearnFRC leaderboard.",
};

function displayName(p: Profile): string {
  if (p.hide_name) return p.username?.trim() || "Learner";
  return p.full_name?.trim() || p.username?.trim() || "Learner";
}

function toEntry(p: Profile, rank: number, currentUserId: string | null): PodiumEntry {
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
    lessons: Math.floor(xp / 10),
    isYou: currentUserId != null && p.id === currentUserId,
  };
}

export default async function LeaderboardPage() {
  const [profiles, { user }] = await Promise.all([
    getLeaderboard(50),
    getSession(),
  ]);

  const entries = profiles.map((p, i) => toEntry(p, i + 1, user?.id ?? null));
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);
  const totalXp = entries.reduce((s, e) => s + e.xp, 0);

  return (
    <div className="relative">
      {/* ambient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] aurora-bg opacity-25 mask-b-faded"
      />

      <div className="mx-auto max-w-5xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
        {/* Header */}
        <Reveal as="section" className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground glass">
            <Trophy className="h-3.5 w-3.5 text-primary" />
            Global rankings
          </span>
          <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            The <span className="text-gradient">Leaderboard</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
            Every lesson you complete earns XP. Level up, climb the ranks, and put
            your team on the map alongside learners from everywhere.
          </p>

          {entries.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span className="font-semibold text-foreground">
                  {entries.length.toLocaleString()}
                </span>{" "}
                ranked {entries.length === 1 ? "learner" : "learners"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                <span className="font-mono font-semibold text-foreground">
                  {totalXp.toLocaleString()}
                </span>{" "}
                XP earned
              </span>
            </div>
          )}
        </Reveal>

        {entries.length === 0 ? (
          /* Empty state */
          <Reveal className="mt-16">
            <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-sm)]">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-white shadow-[var(--shadow-md)]">
                <Trophy className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight">
                No learners on the board yet
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Be the first — start learning, earn XP, and claim the top spot.
              </p>
              <Button asChild variant="brand" className="mt-6">
                <Link href="/guides">
                  Start learning
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Reveal>
        ) : (
          <>
            {/* Podium — top 3 */}
            {podium.length > 0 && (
              <section className="mt-14 sm:mt-16" aria-label="Top three learners">
                <Podium entries={podium} />
              </section>
            )}

            {/* Ranked list — ranks 4+ */}
            {rest.length > 0 && (
              <Reveal className="mt-12">
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)]">
                  {/* column header (desktop) */}
                  <div className="hidden items-center gap-4 border-b border-border px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:flex">
                    <span className="w-9 text-center">#</span>
                    <span className="flex-1">Learner</span>
                    <span className="w-[4.5rem] text-center">Level</span>
                    <span className="hidden w-20 text-right md:block">Lessons</span>
                    <span className="w-24 text-right">XP</span>
                  </div>
                  <LeaderList entries={rest} />
                </div>
              </Reveal>
            )}

            {/* CTA */}
            <Reveal className="mt-12 text-center">
              <p className="text-sm text-muted-foreground">
                Not on the board yet?{" "}
                <Link
                  href="/guides"
                  className="font-medium text-primary underline-offset-4 hover:underline"
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
