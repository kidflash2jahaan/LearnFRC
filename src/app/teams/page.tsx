import type { CSSProperties, ComponentType } from "react";
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
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Reveal } from "@/components/motion/reveal";
import { ShareButton } from "@/components/share-button";
import { AnimatedCounter } from "@/components/animated-counter";
import { clampPct, pluralize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "My Team · LearnFRC",
  description:
    "See your whole FRC team's progress. Everyone who signs up with your team number is grouped automatically.",
};

const HEADLINE_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, var(--primary), var(--accent))",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
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

/* Soft ambient light blobs behind the hero — the glass refracts them. */
function AmbientGlows() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div
        className="absolute -top-32 left-1/2 h-[540px] w-[820px] -translate-x-1/2 rounded-full opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--primary) 22%, transparent), transparent 72%)",
        }}
      />
      <div
        className="absolute -top-10 right-[6%] h-72 w-72 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--accent) 26%, transparent), transparent 70%)",
        }}
      />
      <div
        className="absolute top-28 left-[4%] h-64 w-64 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--magenta) 22%, transparent), transparent 70%)",
        }}
      />
    </div>
  );
}

export default async function TeamsPage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login?next=/teams");

  return (
    <div className="relative overflow-hidden">
      <AmbientGlows />

      <div className="mx-auto max-w-5xl px-4 pt-28 pb-24 sm:px-6 lg:px-8">
        {!profile?.team_number ? (
          <section className="mx-auto max-w-2xl text-center">
            <span className="aq-eyebrow aq-rise aq-rise-1 justify-center">
              <Users className="h-3.5 w-3.5" aria-hidden />
              Your pit crew
            </span>
            <h1 className="aq-display aq-rise aq-rise-2 mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
              See your whole{" "}
              <span className="aq-grad-anim" style={HEADLINE_GRADIENT}>
                team&apos;s progress
              </span>
            </h1>
            <p className="aq-rise aq-rise-3 mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-foreground/70 sm:text-lg">
              Add your FRC team number and everyone on your team who uses
              LearnFRC shows up here automatically — no codes, no setup.
              You&apos;ll all see each other&apos;s progress and push each other
              to finish before build season.
            </p>
            <div className="aq-rise aq-rise-5 mt-8 flex justify-center">
              <Link href="/settings" className="aq-cta">
                Add your team number
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </section>
        ) : (
          await renderTeam(profile.team_number, user.id)
        )}
      </div>
    </div>
  );

  async function renderTeam(teamNumber: number, uid: string) {
    const { totalLessons, members } = await getTeamByNumber(teamNumber);
    const totalCompleted = members.reduce((s, m) => s + m.completed, 0);
    const avgPct =
      members.length && totalLessons
        ? clampPct((totalCompleted / (members.length * totalLessons)) * 100)
        : 0;

    const stats: {
      icon: ComponentType<{ className?: string }>;
      label: string;
      value: number;
      suffix?: string;
      accent: string;
    }[] = [
      {
        icon: Users,
        label: "Members",
        value: members.length,
        accent: "var(--primary)",
      },
      {
        icon: CheckCircle2,
        label: "Lessons completed",
        value: totalCompleted,
        accent: "var(--accent)",
      },
      {
        icon: Trophy,
        label: "Avg. completion",
        value: avgPct,
        suffix: "%",
        accent: "var(--magenta)",
      },
    ];

    return (
      <div className="space-y-8">
        {/* Hero — the team badge is the most characteristic thing here */}
        <section>
          <span className="aq-eyebrow aq-rise aq-rise-1">
            <Users className="h-3.5 w-3.5" aria-hidden />
            Your pit crew
          </span>
          <h1 className="aq-display aq-rise aq-rise-2 mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Team{" "}
            <span className="aq-grad-anim" style={HEADLINE_GRADIENT}>
              #{teamNumber}
            </span>
          </h1>
          <p className="aq-rise aq-rise-3 mt-3 flex items-start gap-2 text-base leading-relaxed text-foreground/70">
            <Info className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>
              Everyone who signed up with team #{teamNumber} is here — and you
              can all see each other&apos;s progress.
            </span>
          </p>
        </section>

        {/* Stat tiles */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="aq-tile aq-reveal flex items-center gap-3 rounded-2xl px-4 py-4"
              style={
                { "--a": s.accent, animationDelay: `${i * 90}ms` } as CSSProperties
              }
            >
              <span className="aq-badge aq-badge-bob flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                <s.icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-2xl font-bold leading-none tracking-tight text-foreground tabular-nums">
                  <AnimatedCounter value={s.value} suffix={s.suffix} />
                </span>
                <span className="mt-1.5 block truncate text-xs font-medium uppercase tracking-wide text-foreground">
                  {s.label}
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* Invite callout */}
        <Reveal>
          <div className="aq-glass aq-sheen aq-card-hover flex flex-col gap-4 rounded-3xl p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span
                className="aq-badge aq-float flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ "--a": "var(--primary)" } as CSSProperties}
              >
                <Sparkles className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-lg font-bold tracking-tight">
                  Invite your teammates
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-foreground/70">
                  Anyone who signs up with team #{teamNumber} joins
                  automatically — no codes, no setup.
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <ShareButton
                variant="brand"
                label="Share invite"
                text={`Join our FRC team on LearnFRC — sign up with team #${teamNumber} and we can track each other's progress and learn together:`}
                url="https://learnfrc.systemerr.com"
              />
            </div>
          </div>
        </Reveal>

        {/* Roster */}
        <Reveal>
          <div className="aq-card aq-card-hover overflow-hidden rounded-3xl">
            <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-4">
              <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
                <span
                  className="aq-pulse inline-block h-2 w-2 rounded-full bg-primary"
                  aria-hidden
                />
                Roster
              </h2>
              <span className="aq-chip text-xs">
                {pluralize(members.length, "member")}
              </span>
            </div>
            <hr className="aq-divider" />

            {members.length === 0 ? (
              <div className="aq-reveal px-6 py-14 text-center">
                <div
                  className="aq-badge aq-float mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ "--a": "var(--primary)" } as CSSProperties}
                >
                  <Sparkles className="h-6 w-6" aria-hidden />
                </div>
                <p className="mt-4 text-base font-semibold text-foreground">
                  You&apos;re the first one here
                </p>
                <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-foreground/70">
                  Tell your teammates to sign up with team #{teamNumber} and
                  they&apos;ll appear here automatically.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {members.map((m, i) => {
                  const pct =
                    totalLessons > 0
                      ? clampPct((m.completed / totalLessons) * 100)
                      : 0;
                  const isYou = m.userId === uid;
                  return (
                    <li
                      key={m.userId}
                      className={`aq-reveal flex items-center gap-4 px-6 py-4 transition-colors ${
                        isYou ? "bg-primary/[0.06]" : "hover:bg-primary/[0.04]"
                      }`}
                      style={
                        { animationDelay: `${Math.min(i, 8) * 60}ms` } as CSSProperties
                      }
                    >
                      <Avatar
                        name={m.name}
                        src={m.avatarUrl}
                        seed={m.userId}
                        className="h-10 w-10 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {m.name}
                          </span>
                          {isYou && (
                            <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                              You
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <Progress
                            value={pct}
                            className="h-1.5 max-w-[180px]"
                            barClassName="aq-bar-anim"
                          />
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {m.completed}/{totalLessons}
                          </span>
                        </div>
                      </div>
                      <div className="hidden shrink-0 text-right sm:block">
                        <div className="text-sm font-bold text-primary tabular-nums">
                          <AnimatedCounter value={m.xp} suffix=" XP" />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {relTime(m.lastActive)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Reveal>
      </div>
    );
  }
}
