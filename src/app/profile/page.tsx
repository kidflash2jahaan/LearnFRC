import type { CSSProperties } from "react";
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
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
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

const GRADIENT_TEXT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

// blue → cyan fill for the level progress bar
const XP_BAR: CSSProperties = {
  background: "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
};

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

  const stats: {
    icon: typeof Zap;
    label: string;
    value: number;
    color: string;
  }[] = [
    { icon: Zap, label: "Total XP", value: xp, color: "#2560e6" },
    { icon: Trophy, label: "Level", value: level, color: "#1aa9d6" },
    {
      icon: BookOpenCheck,
      label: "Lessons done",
      value: lessonsCompleted,
      color: "#12b565",
    },
    {
      icon: Trophy,
      label: "Badges earned",
      value: earnedCount,
      color: "#e0a02a",
    },
  ];

  return (
    <main className="relative overflow-hidden">
      {/* Ambient soft glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[8%] top-[-6%] h-[420px] w-[520px] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute right-[4%] top-[18%] h-[360px] w-[420px] rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute bottom-[6%] left-[30%] h-[360px] w-[460px] rounded-full bg-[#8b7fff]/12 blur-3xl" />
      </div>

      <div className="mx-auto max-w-4xl px-4 pt-28 pb-24 sm:px-6 lg:px-8">
        {/* ===================== HERO ===================== */}
        <Reveal>
          <div className="aq-glass relative overflow-hidden rounded-[28px]">
            {/* Banner wash */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-32"
              style={{
                background:
                  "linear-gradient(120deg, color-mix(in srgb, var(--color-primary) 26%, transparent), color-mix(in srgb, var(--color-accent) 22%, transparent))",
              }}
            />
            <div className="relative p-6 pt-16 sm:p-8 sm:pt-20">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                  <div className="aq-rise aq-rise-1">
                    <Avatar
                      name={displayName}
                      src={profile?.avatar_url}
                      seed={profile?.username || user.email || undefined}
                      className="h-24 w-24 ring-4 ring-white/90 shadow-[0_18px_40px_rgba(40,80,150,0.28)] sm:h-28 sm:w-28"
                    />
                  </div>
                  <div className="aq-rise aq-rise-2 pb-1">
                    <span className="aq-eyebrow">Your pit crew profile</span>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                      <span style={GRADIENT_TEXT}>{displayName}</span>
                    </h1>
                    <p className="mt-1 font-mono text-sm text-muted-foreground">
                      @{handle}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="aq-chip font-medium">
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 rounded-full bg-primary"
                        />
                        {roleLabel}
                      </span>
                      {profile?.team_number != null && (
                        <span className="aq-chip">
                          <Users2 className="h-3.5 w-3.5 text-accent" />
                          Team {profile.team_number}
                        </span>
                      )}
                      <span className="aq-chip">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                        Joined {formatJoined(profile?.created_at ?? null)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="aq-rise aq-rise-3 flex flex-wrap gap-2.5">
                  <Link
                    href="/settings"
                    className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit profile
                  </Link>
                  {profile?.username && (
                    <Link
                      href={`/u/${profile.username}`}
                      className="aq-ghost inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
                    >
                      View public profile
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </div>

              {profile?.bio && (
                <p className="aq-rise aq-rise-4 mt-6 max-w-2xl text-pretty text-base leading-relaxed text-foreground/70">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>
        </Reveal>

        {/* ===================== STAT TILES ===================== */}
        <Stagger className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4" stagger={0.07}>
          {stats.map((s) => (
            <StaggerItem key={s.label}>
              <div
                className="aq-tile group h-full rounded-2xl p-5"
                style={{ "--a": s.color } as CSSProperties}
              >
                <span
                  className="aq-badge inline-flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ "--a": s.color } as CSSProperties}
                >
                  <s.icon className="h-5 w-5" />
                </span>
                <div className="mt-3 aq-display text-3xl font-bold tracking-tight tabular-nums text-foreground">
                  {s.value.toLocaleString()}
                </div>
                <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-foreground/60">
                  {s.label}
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        {/* ===================== XP / LEVEL ===================== */}
        <Reveal delay={0.04} className="mt-6">
          <div className="aq-card aq-card-hover overflow-hidden p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="aq-icon h-12 w-12">
                  <Zap className="h-5 w-5" />
                </span>
                <div>
                  <div className="aq-eyebrow">Season progress</div>
                  <div className="mt-1 aq-display text-2xl font-bold text-foreground">
                    {xp.toLocaleString()} XP
                    <span className="ml-2 text-base font-semibold text-muted-foreground">
                      · Level {level}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-foreground">
                  {toNext} XP to Level {level + 1}
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  {intoLevel} / 100 this level
                </div>
              </div>
            </div>
            <Progress
              value={intoLevel}
              className="mt-5 h-2.5"
              style={XP_BAR}
              aria-label={`${intoLevel} of 100 XP toward level ${level + 1}`}
            />
          </div>
        </Reveal>

        {/* ===================== ACHIEVEMENTS ===================== */}
        <Reveal delay={0.06} className="mt-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="aq-eyebrow">Every badge, earned in the pit</span>
              <h2 className="mt-2 text-2xl font-bold tracking-tight">
                Achievements
              </h2>
            </div>
            <span className="aq-chip shrink-0 font-mono text-xs">
              {earnedCount} / {achievements.length} earned
            </span>
          </div>
        </Reveal>

        {achievements.length === 0 ? (
          <Reveal delay={0.08} className="mt-5">
            <div className="aq-card p-10 text-center">
              <span className="aq-icon mx-auto mb-3 flex h-12 w-12">
                <Trophy className="h-6 w-6" />
              </span>
              <p className="text-base text-foreground/70">
                No achievements available yet — check back after the next build
                season kicks off.
              </p>
            </div>
          </Reveal>
        ) : (
          <Stagger
            className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3"
            stagger={0.05}
          >
            {achievements.map((a) => (
              <StaggerItem key={a.id}>
                <div
                  className={cn(
                    "aq-card h-full p-5",
                    a.earned ? "aq-card-hover" : "opacity-70"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                        a.earned
                          ? "aq-badge"
                          : "border border-dashed border-border bg-muted text-muted-foreground"
                      )}
                      style={
                        a.earned
                          ? ({ "--a": "#2560e6" } as CSSProperties)
                          : undefined
                      }
                    >
                      {a.earned ? (
                        <Icon name={a.icon} className="h-5 w-5" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold leading-tight text-foreground">
                        {a.name}
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {a.description}
                      </p>
                    </div>
                  </div>
                  {a.earned && (
                    <div className="mt-3.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 rounded-full bg-primary"
                        />
                        Earned
                      </span>
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
