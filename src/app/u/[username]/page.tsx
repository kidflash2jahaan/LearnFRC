import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Calendar, Zap, Trophy, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/lib/icon-map";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { AnimatedCounter } from "@/components/animated-counter";
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
  const lessons = Math.floor(p.xp / 10); // derived (others' progress is private)

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
    { label: "XP", value: p.xp, icon: Zap },
    { label: "Level", value: level, icon: Trophy },
    { label: "Lessons", value: lessons, icon: BookOpen },
    { label: "Badges", value: achievements.length, icon: Trophy },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
      <Reveal>
        <div className="flex flex-col items-center text-center">
          <Avatar
            name={displayName}
            src={p.avatar_url}
            seed={p.id}
            className="h-24 w-24 text-2xl"
          />
          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            {displayName}
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
            <div className="rounded-2xl border border-border bg-card p-5 text-center">
              <s.icon className="mx-auto h-5 w-5 text-primary" />
              <div className="mt-2 font-display text-2xl font-bold">
                <AnimatedCounter value={s.value} />
              </div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal className="mt-10">
        <h2 className="mb-4 text-xl font-bold tracking-tight">Achievements</h2>
        {achievements.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No badges yet.
          </p>
        ) : (
          <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {achievements.map((a) => (
              <StaggerItem key={a.slug}>
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary">
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
  );
}
