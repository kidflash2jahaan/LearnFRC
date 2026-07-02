import type { CSSProperties, ComponentType } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Users,
  CheckCircle2,
  Gauge,
  ArrowRight,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { getTeamByNumber } from "@/lib/queries";
import { Reveal } from "@/components/motion/reveal";
import { ShareButton } from "@/components/share-button";
import { AnimatedCounter } from "@/components/animated-counter";
import { clampPct, pluralize } from "@/lib/utils";
import { Roster, type RosterMember } from "./_roster";

export const metadata: Metadata = {
  title: "My Team · LearnFRC",
  description:
    "See your whole FRC team's progress. Everyone who signs up with your team number is grouped automatically.",
};

const HEADLINE_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

/* Soft ambient light blobs behind the hero — the glass refracts them. */
function AmbientGlows() {
  return (
    <div className="aq-glow" aria-hidden>
      <span
        className="h-[620px] w-[620px] opacity-70"
        style={{
          left: "-170px",
          top: "-200px",
          background: "radial-gradient(circle, #8bbcff, transparent 70%)",
        }}
      />
      <span
        className="h-[560px] w-[560px] opacity-60"
        style={{
          right: "-160px",
          top: "-120px",
          background: "radial-gradient(circle, #6ff0ea, transparent 70%)",
        }}
      />
      <span
        className="h-[520px] w-[520px] opacity-50"
        style={{
          left: "34%",
          top: "440px",
          background: "radial-gradient(circle, #c8b6ff, transparent 70%)",
        }}
      />
    </div>
  );
}

export default async function TeamsPage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login?next=/teams");

  return (
    <div
      data-theme="arena"
      className="aq-root relative isolate overflow-hidden text-foreground"
    >
      <AmbientGlows />

      <div className="mx-auto max-w-6xl px-4 pt-28 pb-24 sm:px-6 sm:pt-28 lg:px-8">
        {!profile?.team_number ? (
          <EmptyState />
        ) : (
          await renderTeam(profile.team_number, user.id)
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  No team number yet — a welcoming glass onboarding card            */
/* ----------------------------------------------------------------- */
function EmptyState() {
  return (
    <section className="mx-auto max-w-2xl pt-8 text-center">
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
        Add your FRC team number and everyone on your team who uses LearnFRC
        shows up here automatically — no codes, no setup. You&apos;ll all see
        each other&apos;s progress and push each other to finish before build
        season.
      </p>

      <div className="aq-rise aq-rise-4 mx-auto mt-8 max-w-md">
        <div className="aq-glass aq-float rounded-3xl p-6 text-left">
          <div className="flex items-center gap-3">
            <span
              className="aq-badge aq-badge-bob flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ "--a": "var(--primary)" } as CSSProperties}
            >
              <UserPlus className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-base font-bold text-foreground">
                One number links you all
              </p>
              <p className="mt-0.5 text-sm text-foreground/70">
                It&apos;s the same team number you use at every event.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="aq-rise aq-rise-5 mt-7 flex justify-center">
        <Link href="/settings" className="aq-cta">
          Add your team number
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

async function renderTeam(teamNumber: number, uid: string) {
  const { totalLessons, members } = await getTeamByNumber(teamNumber);
  const totalCompleted = members.reduce((s, m) => s + m.completed, 0);
  const avgPct =
    members.length && totalLessons
      ? clampPct((totalCompleted / (members.length * totalLessons)) * 100)
      : 0;

  const rosterMembers: RosterMember[] = members.map((m) => ({
    userId: m.userId,
    name: m.name,
    avatarUrl: m.avatarUrl,
    xp: m.xp,
    completed: m.completed,
    lastActive: m.lastActive,
    isYou: m.userId === uid,
  }));

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
      icon: Gauge,
      label: "Avg. completion",
      value: avgPct,
      suffix: "%",
      accent: "var(--magenta)",
    },
  ];

  // Ring geometry for the team-readiness dial (r=52 → circumference ≈ 326.7).
  const R = 52;
  const CIRC = 2 * Math.PI * R;
  const dashOffset = CIRC * (1 - avgPct / 100);

  return (
    <div className="space-y-14">
      {/* ============================ HERO ============================ */}
      {/* Signature: the team readiness dial — the crew's shared progress */}
      <section className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
        <div>
          <span className="aq-eyebrow aq-rise aq-rise-1">
            <Users className="h-3.5 w-3.5" aria-hidden />
            Your pit crew
          </span>
          <h1 className="aq-display aq-rise aq-rise-2 mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-[3.4rem] lg:leading-[1.04]">
            Team{" "}
            <span className="aq-grad-anim" style={HEADLINE_GRADIENT}>
              #{teamNumber}
            </span>
          </h1>
          <p className="aq-rise aq-rise-3 mt-4 max-w-xl text-pretty text-base leading-relaxed text-foreground/70 sm:text-lg">
            Everyone who signed up with team #{teamNumber} is in the pit — ranked
            by lessons finished so you can all see who&apos;s build-season ready
            and push each other to the top.
          </p>
          <div className="aq-rise aq-rise-4 mt-7 flex flex-wrap items-center gap-3">
            <Link href="/guides" className="aq-cta">
              Keep climbing
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <ShareButton
              variant="ghost"
              label="Invite teammates"
              text={`Join our FRC team on LearnFRC — sign up with team #${teamNumber} and we can track each other's progress and learn together:`}
              url="https://learnfrc.systemerr.com"
            />
          </div>
        </div>

        {/* Team readiness dial — floating glass panel */}
        <div className="aq-glass aq-float aq-rise aq-rise-3 rounded-3xl p-7 lg:justify-self-end">
          <div className="mb-5 flex items-center gap-2">
            <span className="aq-display text-[17px] font-bold text-foreground">
              Build season readiness
            </span>
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[#0a7a43]">
              <span className="aq-pulse h-2 w-2 rounded-full bg-[#12b565]" />
              Live
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative shrink-0">
              <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden>
                <circle
                  cx="66"
                  cy="66"
                  r={R}
                  fill="none"
                  stroke="rgba(120,145,190,.24)"
                  strokeWidth="12"
                />
                <circle
                  cx="66"
                  cy="66"
                  r={R}
                  fill="none"
                  stroke="url(#aqTeamRing)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 66 66)"
                />
                <defs>
                  <linearGradient id="aqTeamRing" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#2560e6" />
                    <stop offset="1" stopColor="#1aa9d6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="aq-display text-3xl font-extrabold leading-none text-foreground">
                  <AnimatedCounter value={avgPct} suffix="%" />
                </span>
                <span className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  avg
                </span>
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-sm leading-relaxed text-foreground/75">
                Your crew has finished
              </div>
              <div className="aq-display text-2xl font-extrabold leading-tight text-foreground">
                <AnimatedCounter value={totalCompleted} />{" "}
                <span className="text-base font-semibold text-muted-foreground">
                  of {members.length * totalLessons}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                lessons across {pluralize(members.length, "member")}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================== STATS =========================== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="aq-tile aq-reveal flex items-center gap-3 rounded-2xl px-5 py-5"
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
              <span className="mt-1.5 block truncate text-xs font-semibold uppercase tracking-wide text-foreground">
                {s.label}
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* =========================== ROSTER ========================== */}
      <section>
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="aq-eyebrow">
                <span className="aq-pulse inline-block h-2 w-2 rounded-full bg-primary" aria-hidden />
                The leaderboard
              </span>
              <h2 className="aq-display mt-2 text-3xl font-bold tracking-tight text-foreground">
                The roster
              </h2>
              <p className="mt-1 max-w-lg text-base text-foreground/70">
                Ranked by lessons finished. The one on top wears the crown — for
                now.
              </p>
            </div>
            <span className="aq-chip text-xs">
              {pluralize(members.length, "member")}
            </span>
          </div>
        </Reveal>

        <div className="mt-6">
          {members.length === 0 ? (
            <Reveal>
              <div className="aq-card overflow-hidden rounded-3xl px-6 py-16 text-center">
                <div
                  className="aq-badge aq-float mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ "--a": "var(--primary)" } as CSSProperties}
                >
                  <Sparkles className="h-6 w-6" aria-hidden />
                </div>
                <p className="mt-4 text-lg font-bold text-foreground">
                  You&apos;re the first one here
                </p>
                <p className="mx-auto mt-1.5 max-w-sm text-base leading-relaxed text-foreground/70">
                  Tell your teammates to sign up with team #{teamNumber} and
                  they&apos;ll appear on the roster automatically.
                </p>
              </div>
            </Reveal>
          ) : (
            <Roster members={rosterMembers} totalLessons={totalLessons} />
          )}
        </div>
      </section>

      {/* ========================== INVITE =========================== */}
      <Reveal>
        <div className="aq-glass aq-sheen aq-card-hover flex flex-col gap-4 rounded-3xl p-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className="aq-badge aq-float flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ "--a": "var(--accent)" } as CSSProperties}
            >
              <UserPlus className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                Grow the crew
              </h2>
              <p className="mt-1 text-base leading-relaxed text-foreground/70">
                Anyone who signs up with team #{teamNumber} joins the roster
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
    </div>
  );
}
