import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Pencil,
  ExternalLink,
  Trophy,
  BookOpenCheck,
  Zap,
  Lock,
  Sparkles,
  ArrowUpRight,
  Award,
  UserPlus,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCompletedLessonIds, getReferralCount } from "@/lib/queries";
import type { Achievement } from "@/lib/types";
import { AnimatedCounter } from "@/components/animated-counter";
import {
  Rise,
  RiseGroup,
  RiseItem,
  Reveal,
  RevealGroup,
  RevealItem,
  Hover,
  Glow,
} from "@/components/motion/primitives";
import { Icon } from "@/lib/icon-map";
import { cn } from "@/lib/utils";
import { IdentityCard } from "./_identity-card";

export const metadata = {
  title: "Your profile · LearnFRC",
  description: "Your XP, level, completed lessons, and achievements on LearnFRC.",
  robots: { index: false, follow: false },
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
    supabase.from("achievements").select("*").order("sort_order"),
  ]);

  const lessonsCompleted = completedIds.size;
  const xp = profile?.xp ?? 0;
  const level = Math.floor(xp / 100) + 1;
  const intoLevel = xp % 100; // 0..99 XP toward next level
  const toNext = 100 - intoLevel;

  const catalog = (catalogRes.data as Achievement[] | null) ?? [];
  const earnedAtById = new Map<string, string>(
    (earnedRes.data ?? []).map((r) => [r.achievement_id as string, r.earned_at as string])
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

  // How many teammates this member has recruited (shown only when > 0).
  const referralCount = await getReferralCount(user.id);

  // Level ring geometry (r=34 → circumference ≈ 213.6).
  const RING_C = 213.6;
  const ringOffset = RING_C - (intoLevel / 100) * RING_C;

  const stats: { icon: typeof Zap; label: string; value: number; color: string }[] = [
    { icon: Zap, label: "Total XP", value: xp, color: "#2560e6" },
    { icon: Trophy, label: "Level", value: level, color: "#1aa9d6" },
    { icon: BookOpenCheck, label: "Lessons done", value: lessonsCompleted, color: "#12b565" },
    { icon: Award, label: "Badges earned", value: earnedCount, color: "#e0a02a" },
  ];

  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "560px", pos: { left: "-160px", top: "-200px" }, color: "#8bbcff", opacity: 0.6 },
          { size: "520px", pos: { right: "-180px", top: "-110px" }, color: "#6ff0ea", opacity: 0.5, delay: 2 },
          { size: "480px", pos: { left: "34%", top: "540px" }, color: "#c8b6ff", opacity: 0.4, delay: 4 },
        ]}
      />

      <div className="mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-6 lg:px-8">
        <Rise>
          <div className="flex flex-wrap items-center gap-2">
            <span className="ac-chip inline-flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="ac-eyebrow">Your pit crew profile</span>
            </span>
            {referralCount > 0 && (
              <span className="ac-chip inline-flex items-center gap-1.5 text-sm font-semibold">
                <UserPlus className="h-3.5 w-3.5 text-primary" aria-hidden />
                {referralCount} {referralCount === 1 ? "teammate" : "teammates"} recruited
              </span>
            )}
          </div>
        </Rise>

        {/* ===================== HERO: ID CARD + SEASON PROGRESS ===================== */}
        <div className="mt-5 grid items-start gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <IdentityCard
            displayName={displayName}
            handle={handle}
            avatarUrl={profile?.avatar_url}
            avatarSeed={profile?.username || user.email || undefined}
            roleLabel={roleLabel}
            teamNumber={profile?.team_number ?? null}
            joinedLabel={formatJoined(profile?.created_at ?? null)}
            bio={profile?.bio ?? null}
            level={level}
            xp={xp}
            lessonsCompleted={lessonsCompleted}
          />

          <RiseGroup className="flex flex-col gap-6">
            {/* Level progress ring */}
            <RiseItem>
              <div className="ac-card p-6">
                <p className="ac-eyebrow">Season progress</p>
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
                        cx="41"
                        cy="41"
                        r="34"
                        fill="none"
                        stroke="url(#ac-level-ring)"
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeDasharray={RING_C}
                        strokeDashoffset={ringOffset}
                        transform="rotate(-90 41 41)"
                        style={{ transition: "stroke-dashoffset 0.7s ease" }}
                      />
                      <defs>
                        <linearGradient id="ac-level-ring" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0" stopColor="#2560e6" />
                          <stop offset="1" stopColor="#1aa9d6" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <span className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-display text-xl font-extrabold leading-none text-foreground">
                        {level}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Level
                      </span>
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div
                      className="font-display text-2xl font-bold tabular-nums text-foreground"
                      aria-label={`${xp} total XP`}
                    >
                      <AnimatedCounter value={xp} suffix=" XP" />
                    </div>
                    <p className="mt-1 text-sm leading-snug text-muted-foreground">
                      <span className="font-semibold text-foreground">{toNext} XP</span> to Level{" "}
                      {level + 1}
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
                        className="block h-full rounded-full transition-[width] duration-700 ease-out"
                        style={{
                          width: `${intoLevel}%`,
                          background: "linear-gradient(90deg, #2560e6, #1aa9d6)",
                        }}
                      />
                    </div>
                    <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                      {intoLevel} / 100 this level
                    </p>
                  </div>
                </div>
              </div>
            </RiseItem>

            {/* Quick actions */}
            <RiseItem>
              <div className="ac-card p-5">
                <p className="ac-eyebrow">Quick actions</p>
                <div className="mt-3 flex flex-col gap-2.5">
                  <Hover lift={-2} scale={1.01}>
                    <Link
                      href="/settings"
                      className="group flex min-h-[44px] items-center gap-3 rounded-2xl border border-white/70 bg-white/60 p-3 transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <span
                        className="ac-badge flex h-10 w-10 shrink-0 items-center justify-center"
                        style={{ "--a": "#2560e6" } as CSSProperties}
                      >
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
                  </Hover>

                  {profile?.username && (
                    <Hover lift={-2} scale={1.01}>
                      <Link
                        href={`/u/${profile.username}`}
                        className="group flex min-h-[44px] items-center gap-3 rounded-2xl border border-white/70 bg-white/60 p-3 transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <span
                          className="ac-badge flex h-10 w-10 shrink-0 items-center justify-center"
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
                    </Hover>
                  )}
                </div>
              </div>
            </RiseItem>
          </RiseGroup>
        </div>

        {/* ===================== STAT SHELF ===================== */}
        <RevealGroup className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <RevealItem key={s.label}>
              <Hover className="h-full" lift={-4}>
                <div className="ac-tile h-full p-5" style={{ "--a": s.color } as CSSProperties}>
                  <span
                    className="ac-badge inline-flex h-10 w-10 items-center justify-center"
                    style={{ "--a": s.color } as CSSProperties}
                  >
                    <s.icon aria-hidden className="h-5 w-5" />
                  </span>
                  <div className="mt-3 font-display text-3xl font-bold tabular-nums tracking-tight text-foreground">
                    <AnimatedCounter value={s.value} />
                  </div>
                  <div className="mt-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </div>
                </div>
              </Hover>
            </RevealItem>
          ))}
        </RevealGroup>

        {/* ===================== ACHIEVEMENTS ===================== */}
        <Reveal className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="ac-eyebrow">Every badge, earned in the pit</p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">
                Achievements
              </h2>
            </div>
            <span
              className="ac-chip shrink-0 text-xs tabular-nums"
              aria-label={`${earnedCount} of ${achievements.length} earned`}
            >
              <AnimatedCounter value={earnedCount} /> / {achievements.length} earned
            </span>
          </div>
        </Reveal>

        {achievements.length === 0 ? (
          <Reveal delay={0.06} className="mt-5">
            <div className="ac-card p-10 text-center">
              <span
                className="ac-badge mx-auto mb-3 flex h-12 w-12 items-center justify-center"
                style={{ "--a": "#2560e6" } as CSSProperties}
              >
                <Trophy aria-hidden className="h-6 w-6" />
              </span>
              <p className="text-base text-foreground/70">
                No achievements available yet — check back after the next build season kicks off.
              </p>
            </div>
          </Reveal>
        ) : (
          <RevealGroup className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {achievements.map((a) => (
              <RevealItem key={a.id}>
                <Hover className="h-full" lift={a.earned ? -4 : 0} scale={a.earned ? 1.015 : 1}>
                  <div className={cn("ac-card h-full p-5", !a.earned && "opacity-70")}>
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                          a.earned
                            ? "ac-badge"
                            : "border border-dashed border-border bg-muted text-muted-foreground"
                        )}
                        style={a.earned ? ({ "--a": "#2560e6" } as CSSProperties) : undefined}
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
                          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
                          Earned
                        </span>
                      </div>
                    )}
                  </div>
                </Hover>
              </RevealItem>
            ))}
          </RevealGroup>
        )}
      </div>
    </div>
  );
}
