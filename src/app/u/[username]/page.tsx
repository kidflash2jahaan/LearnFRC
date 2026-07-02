import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Calendar, Zap, Trophy, BookOpen, Medal, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/lib/icon-map";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { ShareButton } from "@/components/profile/share-button";
import { AnimatedCounter } from "@/components/animated-counter";
import { TrophyRing } from "./_trophy-ring";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  mentor: "Mentor",
  alum: "Alum",
  coach: "Coach",
  other: "Member",
};

/** Rank tiers earned by level — the trophy card's headline honor. */
function tierFor(level: number): { name: string; color: string } {
  if (level >= 25) return { name: "Champion", color: "#e0a415" };
  if (level >= 15) return { name: "All-Star", color: "#8b7fff" };
  if (level >= 8) return { name: "Veteran", color: "#1aa9d6" };
  if (level >= 3) return { name: "Contender", color: "#2560e6" };
  return { name: "Rookie", color: "#12b565" };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  if (!profile) notFound();

  const p = profile as Profile;
  const displayName =
    (p.hide_name ? p.username : p.full_name || p.username) || username;
  const level = Math.floor(p.xp / 100) + 1;
  const xpIntoLevel = p.xp % 100;
  const xpToNext = 100 - xpIntoLevel;
  const levelFraction = xpIntoLevel / 100;
  const tier = tierFor(level);

  // Real completed-lesson count (lesson_progress is RLS-private → admin client).
  const { count: lessonsCount } = await createAdminClient()
    .from("lesson_progress")
    .select("*", { count: "exact", head: true })
    .eq("user_id", p.id);
  const lessons = lessonsCount ?? 0;

  const { data: ua } = await supabase
    .from("user_achievements")
    .select("earned_at, achievements(slug, name, description, icon)")
    .eq("user_id", p.id)
    .order("earned_at", { ascending: false });

  type Ach = { slug: string; name: string; description: string; icon: string };
  const achievements = (ua ?? [])
    .map((r) => {
      const a = r.achievements as unknown;
      return (Array.isArray(a) ? a[0] : a) as Ach | undefined;
    })
    .filter(Boolean) as Ach[];

  const joined = new Date(p.created_at).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });

  const stats = [
    { label: "Total XP", value: p.xp, icon: Zap, color: "#2560e6" },
    { label: "Level", value: level, icon: Trophy, color: "#1aa9d6" },
    { label: "Lessons", value: lessons, icon: BookOpen, color: "#12b565" },
    { label: "Badges", value: achievements.length, icon: Medal, color: "#e0a415" },
  ];

  return (
    <main className="relative overflow-x-clip">
      {/* Ambient light the trophy-card glass refracts */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="aq-float absolute left-1/2 top-[-8%] h-[440px] w-[720px] -translate-x-1/2 rounded-full bg-primary/25 opacity-60 blur-3xl" />
        <div className="aq-float absolute right-[6%] top-[22%] h-[320px] w-[320px] rounded-full bg-accent/25 opacity-50 blur-3xl" />
        <div className="aq-float absolute left-[3%] top-[44%] h-[300px] w-[300px] rounded-full bg-[#e0a415]/15 opacity-50 blur-3xl" />
      </div>

      <div className="mx-auto max-w-4xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
        <p className="aq-eyebrow aq-rise aq-rise-1 flex items-center gap-1.5">
          <Sparkles aria-hidden className="h-3.5 w-3.5" />
          Learner trophy card
        </p>

        {/* ============ SIGNATURE: the shareable trophy card ============ */}
        <Reveal className="mt-3">
          <div className="aq-glass aq-sheen aq-rise aq-rise-2 relative overflow-hidden rounded-[32px] p-6 sm:p-9">
            {/* tier ribbon glow */}
            <div
              aria-hidden
              className="aq-float pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl"
              style={{ background: `${tier.color}33` }}
            />

            <div className="relative grid gap-8 sm:grid-cols-[auto_1fr] sm:items-center">
              {/* Left: medallion — the level ring wrapping the avatar */}
              <div className="aq-rise aq-rise-2 flex flex-col items-center gap-4">
                <TrophyRing level={level} fraction={levelFraction} />
                <span
                  className="aq-badge inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.1em]"
                  style={{ "--a": tier.color } as CSSProperties}
                >
                  <Trophy aria-hidden className="h-3.5 w-3.5" />
                  {tier.name}
                </span>
              </div>

              {/* Right: identity + XP progress rail */}
              <div className="min-w-0 text-center sm:text-left">
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                  <Avatar
                    name={displayName}
                    src={p.avatar_url}
                    seed={p.id}
                    className="aq-badge-bob h-16 w-16 shrink-0 text-xl shadow-[0_12px_30px_rgba(40,80,150,0.22)] ring-4 ring-white/80"
                  />
                  <div className="min-w-0">
                    <h1 className="aq-display aq-rise aq-rise-3 text-3xl font-extrabold leading-tight sm:text-4xl">
                      <span
                        className="aq-grad-anim"
                        style={{
                          background:
                            "linear-gradient(120deg,#2560e6,#1aa9d6,#e0a415,#2560e6)",
                          WebkitBackgroundClip: "text",
                          backgroundClip: "text",
                          color: "transparent",
                        }}
                      >
                        {displayName}
                      </span>
                    </h1>
                    <p className="aq-rise aq-rise-3 mt-0.5 text-sm text-muted-foreground">
                      @{p.username}
                    </p>
                  </div>
                </div>

                <div className="aq-rise aq-rise-4 mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <Badge variant="primary">{ROLE_LABEL[p.role] ?? "Member"}</Badge>
                  {p.team_number && (
                    <Badge variant="accent">Team {p.team_number}</Badge>
                  )}
                  <Badge variant="outline">
                    <Calendar aria-hidden className="h-3 w-3" />
                    Joined {joined}
                  </Badge>
                </div>

                {p.bio && (
                  <p className="aq-rise aq-rise-4 mt-4 max-w-md text-pretty text-base leading-relaxed text-foreground/70">
                    {p.bio}
                  </p>
                )}

                {/* XP progress-to-next-level rail */}
                <div className="aq-rise aq-rise-5 mt-5">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-foreground">
                      Level {level}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      <AnimatedCounter value={xpToNext} /> XP to level{" "}
                      {level + 1}
                    </span>
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-[rgba(120,145,190,.24)]"
                    role="progressbar"
                    aria-valuenow={xpIntoLevel}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${xpIntoLevel} of 100 XP toward level ${level + 1}`}
                  >
                    <span
                      className="aq-bar-anim block h-full rounded-full"
                      style={{
                        width: `${Math.max(levelFraction * 100, 3)}%`,
                        background:
                          "linear-gradient(90deg,#2560e6,#1aa9d6,#e0a415)",
                      }}
                    />
                  </div>
                </div>

                <div className="aq-rise aq-rise-5 mt-6 flex justify-center sm:justify-start">
                  <ShareButton username={username} name={displayName} />
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* ================== Stat ribbon — clay tiles ================== */}
        <Stagger className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s, i) => (
            <StaggerItem key={s.label}>
              <div
                className="aq-tile aq-reveal group flex flex-col items-center rounded-3xl p-5 text-center"
                style={
                  { "--a": s.color, animationDelay: `${i * 90}ms` } as CSSProperties
                }
              >
                <span
                  className="aq-badge aq-badge-bob flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ "--a": s.color } as CSSProperties}
                >
                  <s.icon aria-hidden focusable="false" className="h-5 w-5" />
                </span>
                <div className="aq-display mt-3 text-3xl font-extrabold tabular-nums text-foreground">
                  <AnimatedCounter value={s.value} />
                </div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-foreground/70">
                  {s.label}
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        {/* ================= Medal wall — achievements ================= */}
        <Reveal className="mt-12">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="aq-eyebrow">Every badge, earned</p>
              <h2 className="aq-display mt-2 text-2xl font-bold sm:text-3xl">
                Medal wall
              </h2>
            </div>
            {achievements.length > 0 && (
              <Badge variant="primary">
                <AnimatedCounter value={achievements.length} /> earned
              </Badge>
            )}
          </div>

          {achievements.length === 0 ? (
            <div className="aq-card aq-reveal flex flex-col items-center gap-3 rounded-3xl border-dashed p-10 text-center">
              <span className="aq-icon aq-badge-bob flex h-12 w-12 items-center justify-center">
                <Medal aria-hidden className="h-6 w-6" />
              </span>
              <p className="text-base text-foreground/70">
                No medals yet — the first ones unlock during build season.
              </p>
            </div>
          ) : (
            <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {achievements.map((a, i) => (
                <StaggerItem key={a.slug}>
                  <div
                    className="aq-card aq-card-hover aq-reveal flex items-center gap-4 rounded-3xl p-5"
                    style={{ animationDelay: `${i * 70}ms` } as CSSProperties}
                  >
                    <span
                      className="aq-badge aq-badge-bob flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110"
                      style={{ "--a": "#e0a415" } as CSSProperties}
                    >
                      <Icon name={a.icon} className="h-6 w-6" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-foreground">
                        {a.name}
                      </div>
                      <div className="truncate text-sm text-foreground/65">
                        {a.description}
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </Reveal>
      </div>
    </main>
  );
}
