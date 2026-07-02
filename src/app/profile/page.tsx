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
  ShieldCheck,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCompletedLessonIds } from "@/lib/queries";
import type { Achievement } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { AnimatedCounter } from "@/components/animated-counter";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { Icon } from "@/lib/icon-map";
import { cn } from "@/lib/utils";
import { TiltIdCard } from "./_id-card";

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

  // Level ring geometry (r=34 → circumference ≈ 213.6).
  const RING_C = 213.6;
  const ringOffset = RING_C - (intoLevel / 100) * RING_C;

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
    <main className="relative overflow-x-clip">
      {/* Ambient drifting glows */}
      <div aria-hidden className="aq-glow -z-10">
        <span
          className="h-[520px] w-[560px] opacity-60"
          style={{
            left: "-140px",
            top: "-180px",
            background: "radial-gradient(circle, #8bbcff, transparent 70%)",
          }}
        />
        <span
          className="h-[460px] w-[480px] opacity-55"
          style={{
            right: "-120px",
            top: "40px",
            background: "radial-gradient(circle, #6ff0ea, transparent 70%)",
          }}
        />
        <span
          className="h-[460px] w-[520px] opacity-45"
          style={{
            left: "34%",
            top: "560px",
            background: "radial-gradient(circle, #c8b6ff, transparent 70%)",
          }}
        />
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-28 pb-24 sm:px-6 lg:px-8">
        {/* Page eyebrow */}
        <span className="aq-eyebrow aq-rise aq-rise-1">
          <Sparkles aria-hidden className="h-3.5 w-3.5" />
          Your pit crew profile
        </span>

        {/* ===================== HERO: ID CARD + LIGHT SETTINGS ===================== */}
        <div className="mt-4 grid items-start gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          {/* ---- SIGNATURE: friendly interactive pit-crew ID card ---- */}
          <TiltIdCard
            className="aq-rise aq-rise-2 aq-glass relative overflow-hidden rounded-[28px] p-6 sm:p-8"
          >
            {/* Banner wash across the card top */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-28"
              style={{
                background:
                  "linear-gradient(120deg, color-mix(in srgb, var(--color-primary) 26%, transparent), color-mix(in srgb, var(--color-accent) 22%, transparent))",
              }}
            />
            {/* Punch-hole + lanyard cue — reads as a real ID card */}
            <div
              aria-hidden
              className="absolute left-1/2 top-3 h-1.5 w-16 -translate-x-1/2 rounded-full bg-white/70 shadow-[inset_0_1px_2px_rgba(40,80,150,0.35)]"
            />

            <div className="relative flex flex-col gap-5 pt-10 sm:flex-row sm:items-end">
              <div className="aq-float shrink-0">
                <Avatar
                  name={displayName}
                  src={profile?.avatar_url}
                  seed={profile?.username || user.email || undefined}
                  className="h-28 w-28 ring-4 ring-white/90 shadow-[0_18px_40px_rgba(40,80,150,0.28)]"
                />
              </div>
              <div className="min-w-0 pb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="aq-badge inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold uppercase tracking-wider"
                    style={{ "--a": "#2560e6" } as CSSProperties}
                  >
                    <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
                    Member
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    LearnFRC ID
                  </span>
                </div>
                <h1 className="mt-2 aq-display text-3xl font-bold tracking-tight sm:text-4xl">
                  <span className="aq-grad-anim" style={GRADIENT_TEXT}>
                    {displayName}
                  </span>
                </h1>
                <p className="mt-1 text-sm tracking-tight text-muted-foreground">
                  @{handle}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="aq-chip font-medium">
                    <span
                      aria-hidden
                      className="aq-pulse h-1.5 w-1.5 rounded-full bg-primary"
                    />
                    {roleLabel}
                  </span>
                  {profile?.team_number != null && (
                    <span className="aq-chip">
                      <Users2 aria-hidden className="h-3.5 w-3.5 text-accent" />
                      Team {profile.team_number}
                    </span>
                  )}
                  <span className="aq-chip">
                    <CalendarDays
                      aria-hidden
                      className="h-3.5 w-3.5 text-muted-foreground"
                    />
                    Joined {formatJoined(profile?.created_at ?? null)}
                  </span>
                </div>
              </div>
            </div>

            {profile?.bio && (
              <p className="relative mt-6 max-w-2xl text-pretty text-base leading-relaxed text-foreground/70">
                {profile.bio}
              </p>
            )}

            {/* Card footer strip — level + xp inline, like a credential */}
            <div className="relative mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/70 pt-4 text-sm">
              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                <Trophy aria-hidden className="h-4 w-4 text-accent" />
                Level {level}
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground tabular-nums">
                <Zap aria-hidden className="h-4 w-4 text-primary" />
                <AnimatedCounter value={xp} suffix=" XP" />
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground tabular-nums">
                <BookOpenCheck aria-hidden className="h-4 w-4" />
                <AnimatedCounter value={lessonsCompleted} /> lessons done
              </span>
            </div>
          </TiltIdCard>

          {/* ---- SETTINGS THAT FEEL LIGHT: level ring + quick actions ---- */}
          <div className="aq-rise aq-rise-3 flex flex-col gap-6">
            {/* Level progress ring */}
            <div className="aq-card aq-card-hover overflow-hidden p-6">
              <div className="aq-eyebrow">Season progress</div>
              <div className="mt-4 flex items-center gap-5">
                <div className="relative shrink-0">
                  <svg width="96" height="96" viewBox="0 0 82 82" aria-hidden>
                    <circle
                      cx="41"
                      cy="41"
                      r="34"
                      fill="none"
                      stroke="rgba(120,145,190,.24)"
                      strokeWidth="9"
                    />
                    <circle
                      className="aq-ring-anim"
                      cx="41"
                      cy="41"
                      r="34"
                      fill="none"
                      stroke="url(#aqlvl)"
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeDasharray={RING_C}
                      strokeDashoffset={ringOffset}
                      transform="rotate(-90 41 41)"
                    />
                    <defs>
                      <linearGradient id="aqlvl" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#2560e6" />
                        <stop offset="1" stopColor="#1aa9d6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <span className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="aq-display text-xl font-extrabold leading-none text-foreground">
                      {level}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Level
                    </span>
                  </span>
                </div>
                <div className="min-w-0">
                  <div
                    className="aq-display text-2xl font-bold text-foreground tabular-nums"
                    aria-label={`${xp} total XP`}
                  >
                    <AnimatedCounter value={xp} suffix=" XP" />
                  </div>
                  <p className="mt-1 text-sm leading-snug text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {toNext} XP
                    </span>{" "}
                    to Level {level + 1}
                  </p>
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-full bg-[rgba(120,145,190,.24)]"
                    role="progressbar"
                    aria-valuenow={intoLevel}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${intoLevel} of 100 XP toward level ${level + 1}`}
                  >
                    <span
                      className="aq-bar-anim block h-full rounded-full"
                      style={{
                        width: `${intoLevel}%`,
                        background:
                          "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                    {intoLevel} / 100 this level
                  </p>
                </div>
              </div>
            </div>

            {/* Quick actions — settings that feel light */}
            <div className="aq-card p-5">
              <div className="aq-eyebrow">Quick actions</div>
              <div className="mt-3 flex flex-col gap-2.5">
                <Link
                  href="/settings"
                  className="group flex items-center gap-3 rounded-2xl border border-white/70 bg-white/60 p-3 transition-colors hover:bg-white/90"
                >
                  <span className="aq-icon aq-badge-bob flex h-10 w-10 shrink-0">
                    <Pencil aria-hidden className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-tight text-foreground">
                      Edit profile
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      Name, team, bio &amp; more
                    </span>
                  </span>
                  <ArrowUpRight
                    aria-hidden
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </Link>

                {profile?.username && (
                  <Link
                    href={`/u/${profile.username}`}
                    className="group flex items-center gap-3 rounded-2xl border border-white/70 bg-white/60 p-3 transition-colors hover:bg-white/90"
                  >
                    <span
                      className="aq-badge aq-badge-bob flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ "--a": "#1aa9d6" } as CSSProperties}
                    >
                      <ExternalLink aria-hidden className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold leading-tight text-foreground">
                        View public profile
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        How your team sees you
                      </span>
                    </span>
                    <ArrowUpRight
                      aria-hidden
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ===================== STAT SHELF ===================== */}
        <Stagger
          className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4"
          stagger={0.07}
        >
          {stats.map((s) => (
            <StaggerItem key={s.label}>
              <div
                className="aq-tile group h-full rounded-2xl p-5"
                style={{ "--a": s.color } as CSSProperties}
              >
                <span
                  className="aq-badge aq-badge-bob inline-flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ "--a": s.color } as CSSProperties}
                >
                  <s.icon aria-hidden className="h-5 w-5" />
                </span>
                <div className="mt-3 aq-display text-3xl font-bold tracking-tight tabular-nums text-foreground">
                  <AnimatedCounter value={s.value} />
                </div>
                <div className="mt-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        {/* ===================== ACHIEVEMENTS — TROPHY SHELF ===================== */}
        <Reveal delay={0.06} className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="aq-eyebrow">Every badge, earned in the pit</span>
              <h2 className="mt-2 aq-display text-2xl font-bold tracking-tight">
                Achievements
              </h2>
            </div>
            <span
              className="aq-chip shrink-0 text-xs tabular-nums"
              aria-label={`${earnedCount} of ${achievements.length} earned`}
            >
              <AnimatedCounter value={earnedCount} /> / {achievements.length}{" "}
              earned
            </span>
          </div>
        </Reveal>

        {achievements.length === 0 ? (
          <Reveal delay={0.08} className="mt-5">
            <div className="aq-card p-10 text-center">
              <span className="aq-icon mx-auto mb-3 flex h-12 w-12">
                <Trophy aria-hidden className="h-6 w-6" />
              </span>
              <p className="text-base text-foreground/70">
                No achievements available yet — check back after the next build
                season kicks off.
              </p>
            </div>
          </Reveal>
        ) : (
          <Stagger
            className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
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
                          ? "aq-badge aq-badge-bob"
                          : "border border-dashed border-border bg-muted text-muted-foreground"
                      )}
                      style={
                        a.earned
                          ? ({ "--a": "var(--color-primary)" } as CSSProperties)
                          : undefined
                      }
                    >
                      {a.earned ? (
                        <Icon name={a.icon} className="h-5 w-5" />
                      ) : (
                        <Lock aria-hidden className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold leading-tight text-foreground">
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
                          className="aq-pulse h-1.5 w-1.5 rounded-full bg-primary"
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
