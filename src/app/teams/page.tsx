import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Users,
  CheckCircle2,
  Trophy,
  ArrowRight,
  Crown,
  Sparkles,
  Info,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { getMyTeam, getTeamDashboard } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Reveal } from "@/components/motion/reveal";
import { TeamOnboard } from "@/components/teams/team-onboard";
import { JoinCodeCard, LeaveTeamButton } from "@/components/teams/team-actions";
import { clampPct, pluralize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "My Team · LearnFRC",
  description:
    "Create or join an FRC team, share a join code, and track every member's progress across departments.",
};

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "—";
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 3600) return "just now";
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  const days = Math.floor(s / 86_400);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ joined?: string; err?: string }>;
}) {
  const { user } = await getSession();
  if (!user) redirect("/login?next=/teams");

  const sp = await searchParams;
  const mine = await getMyTeam(user.id);

  return (
    <div className="relative mx-auto max-w-5xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-grid opacity-40 mask-b-faded" />
      </div>

      {sp.joined && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" /> You&apos;ve joined the team.
        </div>
      )}
      {sp.err && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <Info className="h-4 w-4" /> {sp.err}
        </div>
      )}

      {!mine ? (
        <>
          <Reveal>
            <Badge variant="primary" className="mb-3">
              <Users className="h-3 w-3" /> Teams
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Train your whole team with LearnFRC
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Create a team to onboard new members with a ready-made curriculum and
              track everyone&apos;s progress — or join your team with a code.{" "}
              <Link href="/for-teams" className="text-primary underline-offset-4 hover:underline">
                See how it works →
              </Link>
            </p>
          </Reveal>
          <Reveal delay={0.05} className="mt-8">
            <TeamOnboard />
          </Reveal>
        </>
      ) : (
        await renderTeam(mine.team.id, user.id)
      )}
    </div>
  );

  async function renderTeam(teamId: string, uid: string) {
    const dash = await getTeamDashboard(teamId, uid);
    if (!dash) return <p className="text-muted-foreground">Couldn&apos;t load your team.</p>;
    const { team, isOwner, totalLessons, members } = dash;

    // Member (non-owner) view: lighter, shows your own progress.
    if (!isOwner) {
      const supabase = await createClient();
      const { count } = await supabase
        .from("lesson_progress")
        .select("*", { count: "exact", head: true })
        .eq("user_id", uid);
      const done = count ?? 0;
      const pct = totalLessons > 0 ? clampPct((done / totalLessons) * 100) : 0;
      return (
        <div className="space-y-6">
          <Reveal>
            <Badge variant="primary" className="mb-2">
              <Users className="h-3 w-3" /> Your team
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight">
              {team.name}
              {team.team_number ? (
                <span className="ml-2 text-muted-foreground">#{team.team_number}</span>
              ) : null}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your mentor manages this team. Keep learning — your progress shows up on their dashboard.
            </p>
          </Reveal>
          <Reveal delay={0.05}>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">Your progress</span>
                <span className="text-muted-foreground">
                  {done} / {totalLessons} lessons
                </span>
              </div>
              <Progress value={pct} className="h-2.5" />
              <Button asChild variant="brand" className="mt-5">
                <Link href="/guides">
                  Keep learning <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Reveal>
          <LeaveTeamButton owner={false} />
        </div>
      );
    }

    // Owner / mentor dashboard.
    const totalCompleted = members.reduce((s, m) => s + m.completed, 0);
    const avgPct =
      members.length && totalLessons
        ? clampPct((totalCompleted / (members.length * totalLessons)) * 100)
        : 0;

    const stats = [
      { icon: Users, label: "Members", value: members.length, accent: "var(--color-primary)" },
      { icon: CheckCircle2, label: "Lessons completed", value: totalCompleted, accent: "#10b981" },
      { icon: Trophy, label: "Avg. completion", value: `${avgPct}%`, accent: "#eab308" },
    ];

    return (
      <div className="space-y-8">
        <Reveal>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Badge variant="primary" className="mb-2">
                <Crown className="h-3 w-3" /> You manage this team
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight">
                {team.name}
                {team.team_number ? (
                  <span className="ml-2 text-muted-foreground">#{team.team_number}</span>
                ) : null}
              </h1>
            </div>
            <LeaveTeamButton owner />
          </div>
        </Reveal>

        <Reveal delay={0.04}>
          <JoinCodeCard code={team.join_code} teamId={team.id} />
        </Reveal>

        <Reveal delay={0.06}>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]"
              >
                <div
                  className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: `color-mix(in srgb, ${s.accent} 14%, transparent)`, color: s.accent }}
                >
                  <s.icon className="h-4.5 w-4.5" />
                </div>
                <div className="font-display text-2xl font-bold tracking-tight">{s.value}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="text-sm font-semibold">Members</h2>
              <span className="text-xs text-muted-foreground">
                {pluralize(members.length, "member")}
              </span>
            </div>
            {members.length <= 1 ? (
              <div className="px-5 py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-primary">
                  <Sparkles className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-medium">No members yet</p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                  Share your join code above. As members join, their progress shows up
                  here automatically — even if they already had an account.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {members.map((m) => {
                  const pct = totalLessons > 0 ? clampPct((m.completed / totalLessons) * 100) : 0;
                  return (
                    <li key={m.userId} className="flex items-center gap-4 px-5 py-3.5">
                      <Avatar name={m.name} src={m.avatarUrl} seed={m.userId} className="h-9 w-9 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{m.name}</span>
                          {m.role === "owner" && (
                            <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <Progress value={pct} className="h-1.5 max-w-[180px]" />
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {m.completed}/{totalLessons}
                          </span>
                        </div>
                      </div>
                      <div className="hidden shrink-0 text-right sm:block">
                        <div className="text-sm font-semibold">{m.xp} XP</div>
                        <div className="text-xs text-muted-foreground">{relTime(m.lastActive)}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Reveal>
      </div>
    );
  }
}
