import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Calendar, Zap, Trophy, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/lib/icon-map";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { ShareButton } from "@/components/profile/share-button";
import { AnimatedCounter } from "@/components/animated-counter";
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

  const stats = [
    { label: "XP", value: p.xp, icon: Zap, color: "#2560e6" },
    { label: "Level", value: level, icon: Trophy, color: "#1aa9d6" },
    { label: "Lessons", value: lessons, icon: BookOpen, color: "#12b565" },
    { label: "Badges", value: achievements.length, icon: Trophy, color: "#e0a415" },
  ];

  return (
    <main className="relative overflow-hidden">
      {/* Ambient light glows the glass refracts */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-8%] h-[440px] w-[720px] -translate-x-1/2 rounded-full bg-primary/25 opacity-60 blur-3xl" />
        <div className="absolute right-[6%] top-[24%] h-[320px] w-[320px] rounded-full bg-accent/25 opacity-50 blur-3xl" />
        <div className="absolute left-[4%] top-[46%] h-[300px] w-[300px] rounded-full bg-[#8b7fff]/20 opacity-50 blur-3xl" />
      </div>

      <div className="mx-auto max-w-4xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
        {/* Hero — the learner card, front and center */}
        <Reveal>
          <div className="aq-glass aq-sheen aq-rise aq-rise-1 relative overflow-hidden rounded-[28px] p-8 sm:p-10">
            <div
              aria-hidden
              className="aq-float pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/15 blur-3xl"
            />
            <div className="relative flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-left sm:gap-7">
              <Avatar
                name={displayName}
                src={p.avatar_url}
                seed={p.id}
                className="aq-badge-bob aq-rise aq-rise-1 h-28 w-28 shrink-0 text-3xl shadow-[0_16px_38px_rgba(40,80,150,0.22)] ring-4 ring-white/80"
              />
              <div className="mt-5 min-w-0 sm:mt-0">
                <p className="aq-eyebrow aq-rise aq-rise-1 justify-center sm:justify-start">
                  Learner profile
                </p>
                <h1 className="aq-display aq-rise aq-rise-2 mt-2 text-4xl font-extrabold leading-tight sm:text-5xl">
                  <span
                    className="aq-grad-anim"
                    style={{
                      background:
                        "linear-gradient(120deg,#2560e6,#1aa9d6,#12b565,#2560e6)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    {displayName}
                  </span>
                </h1>
                <p className="aq-rise aq-rise-2 mt-1 font-mono text-sm text-muted-foreground">
                  @{p.username}
                </p>
                <div className="aq-rise aq-rise-3 mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <Badge variant="primary">{ROLE_LABEL[p.role] ?? "Member"}</Badge>
                  {p.team_number && (
                    <Badge variant="accent">Team {p.team_number}</Badge>
                  )}
                  <Badge variant="outline">
                    <Calendar className="h-3 w-3" />
                    Joined{" "}
                    {new Date(p.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      year: "numeric",
                    })}
                  </Badge>
                </div>
                {p.bio && (
                  <p className="aq-rise aq-rise-3 mt-4 max-w-md text-pretty text-base leading-relaxed text-foreground/70">
                    {p.bio}
                  </p>
                )}
                <div className="aq-rise aq-rise-4 mt-6 flex justify-center sm:justify-start">
                  <ShareButton username={username} name={displayName} />
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Stats — a row of clay tiles */}
        <Stagger className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
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
                  <s.icon className="h-5 w-5" />
                </span>
                <div className="aq-display mt-3 text-3xl font-extrabold tabular-nums text-foreground">
                  <AnimatedCounter value={s.value} />
                </div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-foreground/60">
                  {s.label}
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        {/* Achievements — earned badges */}
        <Reveal className="mt-12">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="aq-eyebrow">Every badge, earned</p>
              <h2 className="aq-display mt-2 text-2xl font-bold sm:text-3xl">
                Achievements
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
                <Trophy className="h-6 w-6" />
              </span>
              <p className="text-base text-foreground/70">
                No badges yet — the first ones unlock during build season.
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
                      className="aq-badge aq-badge-bob flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                      style={{ "--a": "#2560e6" } as CSSProperties}
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
