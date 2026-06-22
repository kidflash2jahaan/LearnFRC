import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Users,
  CheckCircle2,
  Trophy,
  ArrowRight,
  Info,
  Sparkles,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { getTeamByNumber } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Reveal } from "@/components/motion/reveal";
import { clampPct, pluralize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "My Team · LearnFRC",
  description:
    "See your whole FRC team's progress. Everyone who signs up with your team number is grouped automatically.",
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

export default async function TeamsPage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login?next=/teams");

  return (
    <div className="relative mx-auto max-w-5xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-grid opacity-40 mask-b-faded" />
      </div>

      {!profile?.team_number ? (
        <Reveal>
          <Badge variant="primary" className="mb-3">
            <Users className="h-3 w-3" /> Your team
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            See your whole team&apos;s progress
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Add your FRC team number and everyone on your team who uses LearnFRC shows
            up here automatically — no codes, no setup. You&apos;ll all be able to see
            each other&apos;s progress and push each other to finish.
          </p>
          <Button asChild variant="brand" className="mt-6">
            <Link href="/settings">
              Add your team number <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </Reveal>
      ) : (
        await renderTeam(profile.team_number, user.id)
      )}
    </div>
  );

  async function renderTeam(teamNumber: number, uid: string) {
    const { totalLessons, members } = await getTeamByNumber(teamNumber);
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
          <Badge variant="primary" className="mb-2">
            <Users className="h-3 w-3" /> Your team
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight">
            Team <span className="text-gradient">#{teamNumber}</span>
          </h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Everyone who signed up with team #{teamNumber} is here — and you can all see
            each other&apos;s progress.
          </p>
        </Reveal>

        <Reveal delay={0.05}>
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
            {members.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-primary">
                  <Sparkles className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-medium">You&apos;re the first one here</p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                  Tell your teammates to sign up with team #{teamNumber} and they&apos;ll
                  appear here automatically.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {members.map((m) => {
                  const pct = totalLessons > 0 ? clampPct((m.completed / totalLessons) * 100) : 0;
                  const isYou = m.userId === uid;
                  return (
                    <li
                      key={m.userId}
                      className={`flex items-center gap-4 px-5 py-3.5 ${isYou ? "bg-primary/[0.06]" : ""}`}
                    >
                      <Avatar name={m.name} src={m.avatarUrl} seed={m.userId} className="h-9 w-9 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{m.name}</span>
                          {isYou && (
                            <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                              You
                            </span>
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
