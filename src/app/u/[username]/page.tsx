import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Calendar, Zap, Trophy, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/lib/icon-map";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { NeonCounter, StatusPill } from "@/components/motion/terminal";
import { ShareButton } from "@/components/profile/share-button";
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
    { label: "XP", value: p.xp, icon: Zap, color: "var(--color-primary)" },
    { label: "Level", value: level, icon: Trophy, color: "var(--color-accent)" },
    { label: "Lessons", value: lessons, icon: BookOpen, color: "var(--color-success)" },
    { label: "Badges", value: achievements.length, icon: Trophy, color: "var(--color-gold)" },
  ];

  return (
    <main className="relative overflow-hidden">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 hud-grid opacity-50 mask-b-faded" />
        <div className="absolute left-1/2 top-[-10%] h-[420px] w-[640px] -translate-x-1/2 rounded-full opacity-20 blur-3xl aurora-bg" />
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
        <Reveal>
          <div className="flex flex-col items-center text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
              // learner profile
            </p>
            <Avatar
              name={displayName}
              src={p.avatar_url}
              seed={p.id}
              className="mt-4 h-24 w-24 text-2xl ring-2 ring-primary/40"
            />
            <h1 className="mt-4 text-3xl font-bold tracking-tight">
              <span className="text-gradient">{displayName}</span>
            </h1>
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              @{p.username}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <Badge variant="primary">{ROLE_LABEL[p.role] ?? "Member"}</Badge>
              {p.team_number && (
                <Badge variant="accent">Team {p.team_number}</Badge>
              )}
              <Badge variant="outline">
                <Calendar className="h-3 w-3" />
                Joined {new Date(p.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
              </Badge>
            </div>
            {p.bio && (
              <p className="mt-4 max-w-md text-pretty text-muted-foreground">
                {p.bio}
              </p>
            )}
            <div className="mt-5">
              <ShareButton username={username} name={displayName} />
            </div>
          </div>
        </Reveal>

        <Stagger className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <StaggerItem key={s.label}>
              <div className="group relative overflow-hidden rounded-xl border border-border bg-card/60 p-5 text-center backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--glow-primary)]">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-[0.14] blur-2xl transition-opacity duration-300 group-hover:opacity-30"
                  style={{ background: s.color }}
                />
                <s.icon className="mx-auto h-5 w-5" style={{ color: s.color }} />
                <div className="mt-2 font-display text-2xl font-bold tabular-nums">
                  <NeonCounter to={s.value} />
                </div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal className="mt-10">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-accent">
                <span aria-hidden className="h-px w-6 bg-gradient-to-r from-accent to-transparent" />
                unlocks
              </span>
              <h2 className="mt-2 text-xl font-bold tracking-tight">Achievements</h2>
            </div>
            {achievements.length > 0 && (
              <StatusPill tone="primary" pulse={false}>
                {achievements.length} earned
              </StatusPill>
            )}
          </div>
          {achievements.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-center font-mono text-sm text-muted-foreground">
              // no badges yet
            </p>
          ) : (
            <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {achievements.map((a) => (
                <StaggerItem key={a.slug}>
                  <div className="group flex items-center gap-3 rounded-xl border border-primary/25 bg-card/70 p-4 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[var(--glow-primary)]">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-primary-foreground shadow-[var(--glow-primary)]"
                      style={{
                        backgroundImage:
                          "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
                      }}
                    >
                      <Icon name={a.icon} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{a.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
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
