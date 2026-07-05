import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Calendar, Zap, Trophy, BookOpen, Medal, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/lib/icon-map";
import {
  Glow,
  RiseGroup,
  RiseItem,
  Reveal,
  RevealGroup,
  RevealItem,
  Hover,
} from "@/components/motion/primitives";
import { ShareButton } from "@/components/profile/share-button";
import { AnimatedCounter } from "@/components/animated-counter";
import { TrophyPanel } from "./_trophy-panel";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `@${username}`,
    description: `@${username}'s FRC learning profile on LearnFRC — XP, level, completed lessons, and achievements across every department.`,
    alternates: { canonical: `/u/${username}` },
    openGraph: {
      title: `@${username} · LearnFRC`,
      description: `@${username}'s FRC learning profile — XP, level, and achievements on LearnFRC.`,
      url: `/u/${username}`,
      type: "profile",
    },
  };
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

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6, #e0a415, #2560e6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
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
  // Public profile — identify by username only; real names are never public.
  const displayName = p.username || username;
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
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "620px", pos: { left: "-180px", top: "-200px" }, color: "#8bbcff", opacity: 0.6 },
          { size: "480px", pos: { right: "-160px", top: "60px" }, color: `${tier.color}`, opacity: 0.32, delay: 2.5 },
          { size: "460px", pos: { left: "34%", top: "560px" }, color: "#c8b6ff", opacity: 0.4, delay: 5 },
        ]}
      />

      {/* ============================ HERO ============================ */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-28 sm:px-6 lg:grid-cols-[1fr_360px] lg:gap-12 lg:pb-20 lg:pt-36 lg:px-8">
        <RiseGroup>
          <RiseItem>
            <span className="ac-chip inline-flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="ac-eyebrow">Learner trophy card</span>
            </span>
          </RiseItem>
          <RiseItem>
            <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.05] sm:text-5xl">
              <span style={BRAND_GRADIENT}>@{displayName}</span>
            </h1>
          </RiseItem>
          <RiseItem>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Badge>{ROLE_LABEL[p.role] ?? "Member"}</Badge>
              {p.team_number && <Badge variant="accent">Team {p.team_number}</Badge>}
              <Badge variant="outline">
                <Calendar aria-hidden className="h-3 w-3" />
                Joined {joined}
              </Badge>
            </div>
          </RiseItem>
          {p.bio && (
            <RiseItem>
              <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
                {p.bio}
              </p>
            </RiseItem>
          )}
          <RiseItem>
            <div className="mt-7">
              <ShareButton username={username} name={displayName} />
            </div>
          </RiseItem>
        </RiseGroup>

        <TrophyPanel
          level={level}
          levelFraction={levelFraction}
          xpToNext={xpToNext}
          tierName={tier.name}
          tierColor={tier.color}
          avatarName={displayName}
          avatarSrc={p.avatar_url}
          avatarSeed={p.id}
        />
      </section>

      {/* ================== Stat ribbon — clay tiles ================== */}
      <section className="mx-auto max-w-6xl px-4 pb-4 sm:px-6 lg:px-8">
        <RevealGroup className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <RevealItem key={s.label}>
              <Hover className="h-full" lift={-4}>
                <div
                  className="ac-tile flex h-full flex-col items-center rounded-3xl p-5 text-center"
                  style={{ "--a": s.color } as CSSProperties}
                >
                  <span
                    className="ac-badge flex h-11 w-11 items-center justify-center rounded-2xl"
                    style={{ "--a": s.color } as CSSProperties}
                  >
                    <s.icon aria-hidden focusable="false" className="h-5 w-5" />
                  </span>
                  <div className="mt-3 font-display text-3xl font-extrabold tabular-nums text-foreground">
                    <AnimatedCounter value={s.value} />
                  </div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-foreground/70">
                    {s.label}
                  </div>
                </div>
              </Hover>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* ================= Medal wall — achievements ================= */}
      <section className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="ac-eyebrow">Every badge, earned</p>
              <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
                Medal wall
              </h2>
            </div>
            {achievements.length > 0 && (
              <Badge>
                <AnimatedCounter value={achievements.length} /> earned
              </Badge>
            )}
          </div>
        </Reveal>

        {achievements.length === 0 ? (
          <Reveal>
            <div className="ac-card flex flex-col items-center gap-3 rounded-3xl border border-dashed p-10 text-center">
              <span
                className="ac-badge flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ "--a": "#e0a415" } as CSSProperties}
              >
                <Medal aria-hidden className="h-6 w-6" />
              </span>
              <p className="text-base text-foreground/70">
                No medals yet — the first ones unlock during build season.
              </p>
            </div>
          </Reveal>
        ) : (
          <RevealGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {achievements.map((a) => (
              <RevealItem key={a.slug}>
                <Hover className="h-full" lift={-3}>
                  <div className="ac-card flex h-full items-center gap-4 rounded-3xl p-5">
                    <span
                      className="ac-badge flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
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
                </Hover>
              </RevealItem>
            ))}
          </RevealGroup>
        )}
      </section>
    </div>
  );
}
