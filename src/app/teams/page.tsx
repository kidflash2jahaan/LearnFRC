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
import { TerminalFrame, NeonCounter, StatusPill } from "@/components/motion/terminal";
import { ShareButton } from "@/components/share-button";
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
          <Badge
            variant="primary"
            className="mb-3 font-mono uppercase tracking-wider"
          >
            <Users className="h-3 w-3" /> Your team
          </Badge>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            See your whole team&apos;s progress
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Add your FRC team number and everyone on your team who uses LearnFRC
            shows up here automatically — no codes, no setup. You&apos;ll all be
            able to see each other&apos;s progress and push each other to finish.
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
      {
        icon: Users,
        label: "Members",
        to: members.length,
        suffix: "",
        accent: "var(--primary)",
      },
      {
        icon: CheckCircle2,
        label: "Lessons completed",
        to: totalCompleted,
        suffix: "",
        accent: "var(--accent)",
      },
      {
        icon: Trophy,
        label: "Avg. completion",
        to: avgPct,
        suffix: "%",
        accent: "var(--magenta)",
      },
    ];

    return (
      <div className="space-y-8">
        <Reveal>
          <Badge
            variant="primary"
            className="mb-2 font-mono uppercase tracking-wider"
          >
            <Users className="h-3 w-3" /> Your team
          </Badge>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Team <span className="text-gradient">#{teamNumber}</span>
          </h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Everyone who signed up with team #{teamNumber} is here — and you can
            all see each other&apos;s progress.
          </p>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-border bg-card/80 p-4 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--glow-primary)]"
              >
                <div
                  className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{
                    background: `color-mix(in srgb, ${s.accent} 14%, transparent)`,
                    color: s.accent,
                  }}
                >
                  <s.icon className="h-4.5 w-4.5" />
                </div>
                <div className="font-display text-2xl font-bold tracking-tight">
                  <NeonCounter to={s.to} suffix={s.suffix} />
                </div>
                <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-sm font-semibold">
                Invite your teammates
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Anyone who signs up with team #{teamNumber} joins automatically —
                no codes, no setup.
              </p>
            </div>
            <ShareButton
              variant="brand"
              label="Share invite"
              text={`Join our FRC team on LearnFRC — sign up with team #${teamNumber} and we can track each other's progress and learn together:`}
              url="https://learnfrc.systemerr.com"
            />
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <TerminalFrame
            title={`roster — ~/team/${teamNumber}`}
            glow
            bodyClassName="p-0"
            right={
              <StatusPill tone="primary">
                {pluralize(members.length, "member")}
              </StatusPill>
            }
          >
            {members.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary glow-primary">
                  <Sparkles className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-medium">
                  You&apos;re the first one here
                </p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                  Tell your teammates to sign up with team #{teamNumber} and
                  they&apos;ll appear here automatically.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {members.map((m) => {
                  const pct =
                    totalLessons > 0
                      ? clampPct((m.completed / totalLessons) * 100)
                      : 0;
                  const isYou = m.userId === uid;
                  return (
                    <li
                      key={m.userId}
                      className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
                        isYou
                          ? "bg-primary/[0.06]"
                          : "hover:bg-primary/[0.03]"
                      }`}
                    >
                      <Avatar
                        name={m.name}
                        src={m.avatarUrl}
                        seed={m.userId}
                        className="h-9 w-9 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {m.name}
                          </span>
                          {isYou && (
                            <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary">
                              You
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <Progress
                            value={pct}
                            className="h-1.5 max-w-[180px]"
                          />
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">
                            {m.completed}/{totalLessons}
                          </span>
                        </div>
                      </div>
                      <div className="hidden shrink-0 text-right sm:block">
                        <div className="font-display text-sm font-semibold text-primary">
                          {m.xp} XP
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {relTime(m.lastActive)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </TerminalFrame>
        </Reveal>
      </div>
    );
  }
}
