import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Pencil,
  ExternalLink,
  CalendarDays,
  Users2,
  Trophy,
  BookOpenCheck,
  Zap,
  Lock,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCompletedLessonIds } from "@/lib/queries";
import type { Achievement } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import {
  TerminalFrame,
  StatusPill,
  NeonCounter,
} from "@/components/motion/terminal";
import { Icon } from "@/lib/icon-map";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Your profile · LearnFRC",
  description: "Your XP, level, completed lessons, and achievements on LearnFRC.",
};

const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  mentor: "Mentor",
  alum: "Alum",
  coach: "Coach",
  other: "Member",
};

function formatJoined(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

// cyan → lime fill for HUD progress bars
const XP_BAR = {
  background: "linear-gradient(90deg, var(--color-accent), var(--color-primary))",
} as const;

export default async function ProfilePage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login?next=/profile");

  const supabase = await createClient();

  // Own data: real completed-lesson count + earned achievements joined to catalog.
  const [completedIds, earnedRes, catalogRes] = await Promise.all([
    getCompletedLessonIds(user.id),
    supabase
      .from("user_achievements")
      .select("achievement_id, earned_at")
      .eq("user_id", user.id),
    supabase
      .from("achievements")
      .select("*")
      .order("sort_order"),
  ]);

  const lessonsCompleted = completedIds.size;
  const xp = profile?.xp ?? 0;
  const level = Math.floor(xp / 100) + 1;
  const intoLevel = xp % 100; // 0..99 XP toward next level
  const toNext = 100 - intoLevel;

  const catalog = (catalogRes.data as Achievement[] | null) ?? [];
  const earnedAtById = new Map<string, string>(
    (earnedRes.data ?? []).map((r) => [
      r.achievement_id as string,
      r.earned_at as string,
    ])
  );
  const achievements = catalog.map((a) => ({
    ...a,
    earned: earnedAtById.has(a.id),
    earnedAt: earnedAtById.get(a.id) ?? null,
  }));
  const earnedCount = achievements.filter((a) => a.earned).length;

  const displayName =
    profile?.full_name || profile?.username || user.email?.split("@")[0] || "You";
  const roleLabel = ROLE_LABEL[profile?.role ?? "student"] ?? "Member";
  const handle = profile?.username || "you";

  const stats = [
    { icon: Zap, label: "Total XP", value: xp, color: "var(--color-primary)" },
    { icon: Trophy, label: "Level", value: level, color: "var(--color-accent)" },
    {
      icon: BookOpenCheck,
      label: "Lessons done",
      value: lessonsCompleted,
      color: "var(--color-success)",
    },
    {
      icon: Trophy,
      label: "Badges earned",
      value: earnedCount,
      color: "var(--color-gold)",
    },
  ];

  return (
    <main className="relative overflow-hidden">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 hud-grid opacity-50 mask-b-faded" />
        <div className="absolute left-1/2 top-[-10%] h-[460px] w-[680px] -translate-x-1/2 rounded-full opacity-20 blur-3xl aurora-bg animate-aurora" />
      </div>

      <div className="mx-auto max-w-4xl px-4 pt-28 pb-24 sm:px-6 lg:px-8">
        {/* ===================== HERO ===================== */}
        <Reveal>
          <Card className="relative overflow-hidden border-primary/25 shadow-[var(--shadow-lg)]">
            {/* Banner */}
            <div aria-hidden className="absolute inset-x-0 top-0 h-28 bg-brand opacity-90">
              <div className="absolute inset-0 bg-grid opacity-25" />
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
            </div>
            <div className="relative p-6 pt-16">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                  <Avatar
                    name={displayName}
                    src={profile?.avatar_url}
                    seed={profile?.username || user.email || undefined}
                    className="h-24 w-24 ring-4 ring-card shadow-[var(--shadow-lg)] sm:h-28 sm:w-28"
                  />
                  <div className="pb-1">
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                      {displayName}
                    </h1>
                    <p className="mt-0.5 font-mono text-sm text-muted-foreground">
                      @{handle}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="primary">{roleLabel}</Badge>
                      {profile?.team_number != null && (
                        <Badge variant="accent">
                          <Users2 className="h-3.5 w-3.5" />
                          Team {profile.team_number}
                        </Badge>
                      )}
                      <Badge variant="outline">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Joined {formatJoined(profile?.created_at ?? null)}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <Button asChild variant="brand" size="md">
                    <Link href="/settings">
                      <Pencil className="h-4 w-4" />
                      Edit profile
                    </Link>
                  </Button>
                  {profile?.username && (
                    <Button asChild variant="outline" size="md">
                      <Link href={`/u/${profile.username}`}>
                        View public profile
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>

              {profile?.bio && (
                <p className="mt-6 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
                  {profile.bio}
                </p>
              )}
            </div>
          </Card>
        </Reveal>

        {/* ===================== STAT TILES ===================== */}
        <Stagger className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4" stagger={0.07}>
          {stats.map((s) => (
            <StaggerItem key={s.label}>
              <div className="group relative h-full overflow-hidden rounded-xl border border-border bg-card/60 p-5 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--glow-primary)]">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-[0.14] blur-2xl transition-opacity duration-300 group-hover:opacity-30"
                  style={{ background: s.color }}
                />
                <s.icon className="h-5 w-5" style={{ color: s.color }} />
                <div className="mt-3 font-display text-2xl font-bold tracking-tight tabular-nums">
                  <NeonCounter to={s.value} />
                </div>
                <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </div>
                <span
                  aria-hidden
                  className="mt-2.5 block h-0.5 w-6 rounded-full"
                  style={{ background: s.color, boxShadow: `0 0 10px ${s.color}` }}
                />
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        {/* ===================== XP / LEVEL ===================== */}
        <Reveal delay={0.04} className="mt-6">
          <TerminalFrame
            glow
            title={`level.dat — ~/${handle}`}
            right={<StatusPill tone="primary">● lvl {level}</StatusPill>}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary shadow-[var(--glow-primary)]">
                  <Zap className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    level{" "}
                    <span className="font-semibold text-foreground">{level}</span>
                  </div>
                  <div className="font-display text-xl font-bold">
                    <NeonCounter to={xp} suffix=" XP" />
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm font-medium">
                  {toNext} XP → lvl {level + 1}
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  {intoLevel} / 100 this level
                </div>
              </div>
            </div>
            <Progress
              value={intoLevel}
              className="mt-4 h-2.5"
              style={XP_BAR}
              aria-label={`${intoLevel} of 100 XP toward level ${level + 1}`}
            />
          </TerminalFrame>
        </Reveal>

        {/* ===================== ACHIEVEMENTS ===================== */}
        <Reveal delay={0.06} className="mt-10">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-accent">
                <span aria-hidden className="h-px w-6 bg-gradient-to-r from-accent to-transparent" />
                unlocks
              </span>
              <h2 className="mt-2 text-xl font-bold tracking-tight">Achievements</h2>
            </div>
            <span className="font-mono text-sm text-muted-foreground">
              {earnedCount} / {achievements.length} earned
            </span>
          </div>
        </Reveal>

        {achievements.length === 0 ? (
          <Reveal delay={0.08} className="mt-4">
            <Card className="p-10 text-center">
              <Trophy className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-3 font-mono text-sm text-muted-foreground">
                // no achievements available yet — check back soon
              </p>
            </Card>
          </Reveal>
        ) : (
          <Stagger
            className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3"
            stagger={0.05}
          >
            {achievements.map((a) => (
              <StaggerItem key={a.id}>
                <div
                  className={cn(
                    "group relative h-full overflow-hidden rounded-xl border p-5 backdrop-blur transition-all duration-300",
                    a.earned
                      ? "border-primary/30 bg-card/70 hover:-translate-y-1 hover:border-primary/55 hover:shadow-[var(--glow-primary)]"
                      : "border-dashed border-border bg-card/30 opacity-70"
                  )}
                >
                  {a.earned && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary/15 blur-2xl transition-opacity duration-300 group-hover:opacity-80"
                    />
                  )}
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                        a.earned
                          ? "text-primary-foreground shadow-[var(--glow-primary)]"
                          : "bg-muted text-muted-foreground"
                      )}
                      style={
                        a.earned
                          ? {
                              backgroundImage:
                                "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
                            }
                          : undefined
                      }
                    >
                      {a.earned ? (
                        <Icon name={a.icon} className="h-5 w-5" />
                      ) : (
                        <Lock className="h-4.5 w-4.5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold leading-tight">
                        {a.name}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {a.description}
                      </p>
                    </div>
                  </div>
                  {a.earned && (
                    <div className="mt-3">
                      <StatusPill tone="primary" pulse={false}>
                        earned
                      </StatusPill>
                    </div>
                  )}
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </main>
  );
}
