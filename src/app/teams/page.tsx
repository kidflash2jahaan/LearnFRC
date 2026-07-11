import type { CSSProperties, ComponentType } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, CheckCircle2, Gauge, ArrowRight, Sparkles, UserPlus } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getTeamByNumber } from "@/lib/queries";
import { ShareButton } from "@/components/share-button";
import { AnimatedCounter } from "@/components/animated-counter";
import { clampPct, pluralize } from "@/lib/utils";
import {
  RiseGroup,
  RiseItem,
  Reveal,
  RevealGroup,
  RevealItem,
  Glow,
} from "@/components/motion/primitives";
import { Roster, type RosterMember } from "./_roster";
import { CrewPanel, type CrewMember } from "./_crew-panel";

export const metadata: Metadata = {
  title: "My Team · LearnFRC",
  description:
    "See your whole FRC team's progress. Everyone who signs up with your team number is grouped automatically.",
  robots: { index: false, follow: false },
};

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

export default async function TeamsPage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login?next=/teams");

  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "620px", pos: { left: "-170px", top: "-200px" }, color: "#8bbcff", opacity: 0.65 },
          { size: "560px", pos: { right: "-160px", top: "-120px" }, color: "#6ff0ea", opacity: 0.5, delay: 2 },
          { size: "520px", pos: { left: "34%", top: "480px" }, color: "#c8b6ff", opacity: 0.4, delay: 4 },
        ]}
      />

      <div className="mx-auto max-w-6xl px-4 pb-12 pt-28 sm:px-6 lg:px-8">
        {!profile?.team_number ? <EmptyState /> : await renderTeam(profile.team_number, user.id)}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  No team number yet — a welcoming onboarding card                  */
/* ----------------------------------------------------------------- */
function EmptyState() {
  return (
    <section className="mx-auto max-w-2xl pt-8 text-center">
      <RiseGroup>
        <RiseItem>
          <span className="ac-chip inline-flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-primary" aria-hidden />
            <span className="ac-eyebrow">Your pit crew</span>
          </span>
        </RiseItem>
        <RiseItem>
          <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.04] sm:text-5xl">
            See your whole{" "}
            <span style={BRAND_GRADIENT}>team&apos;s progress</span>
          </h1>
        </RiseItem>
        <RiseItem>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
            Add your FRC team number and everyone on your team who uses
            LearnFRC shows up here automatically — no codes, no setup.
            You&apos;ll all see each other&apos;s progress and push each
            other to finish before build season.
          </p>
        </RiseItem>
        <RiseItem>
          <div className="mx-auto mt-8 max-w-md">
            <div className="ac-glass p-6 text-left">
              <div className="flex items-center gap-3">
                <span
                  className="ac-badge flex h-11 w-11 shrink-0 items-center justify-center"
                  style={{ "--a": "#2560e6" } as CSSProperties}
                >
                  <UserPlus className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-base font-bold text-foreground">
                    One number links you all
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    It&apos;s the same team number you use at every event.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </RiseItem>
        <RiseItem>
          <div className="mt-7 flex justify-center">
            <Link href="/settings" className="ac-btn text-sm">
              Add your team number <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </RiseItem>
      </RiseGroup>
    </section>
  );
}

async function renderTeam(teamNumber: number, uid: string) {
  const { totalLessons, members } = await getTeamByNumber(teamNumber);
  const totalCompleted = members.reduce((s, m) => s + m.completed, 0);
  const totalNeeded = members.length * totalLessons;
  const avgPct =
    members.length && totalLessons
      ? clampPct((totalCompleted / totalNeeded) * 100)
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

  const crewMembers: CrewMember[] = rosterMembers.map((m) => ({
    userId: m.userId,
    name: m.name,
    avatarUrl: m.avatarUrl,
    isYou: m.isYou,
  }));

  const stats: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    value: number;
    suffix?: string;
    accent: string;
  }[] = [
    { icon: Users, label: "Members", value: members.length, accent: "var(--primary)" },
    {
      icon: CheckCircle2,
      label: "Lessons completed",
      value: totalCompleted,
      accent: "var(--accent)",
    },
    { icon: Gauge, label: "Avg. completion", value: avgPct, suffix: "%", accent: "var(--magenta)" },
  ];

  return (
    <div className="space-y-14">
      {/* ============================ HERO ============================ */}
      {/* Signature: the pit crew panel — overlapping avatar lineup +      */}
      {/* readiness ring, the crew's shared progress in one glass device. */}
      <section className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
        <RiseGroup>
          <RiseItem>
            <span className="ac-chip inline-flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="ac-eyebrow">Your pit crew</span>
            </span>
          </RiseItem>
          <RiseItem>
            <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.02] sm:text-5xl lg:text-[3.4rem]">
              Team <span style={BRAND_GRADIENT}>#{teamNumber}</span>
            </h1>
          </RiseItem>
          <RiseItem>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
              Everyone who signed up with team #{teamNumber} is in the pit —
              ranked by lessons finished so you can all see who&apos;s
              build-season ready and push each other to the top.
            </p>
          </RiseItem>
          <RiseItem>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/guides" className="ac-btn text-sm">
                Keep climbing <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <ShareButton
                variant="ghost"
                label="Invite teammates"
                text={`Join our FRC team on LearnFRC — sign up with team #${teamNumber} and we can track each other's progress and learn together:`}
                url="https://learnfrc.com"
              />
            </div>
          </RiseItem>
        </RiseGroup>

        <CrewPanel
          teamNumber={teamNumber}
          avgPct={avgPct}
          totalCompleted={totalCompleted}
          totalNeeded={totalNeeded}
          memberCount={members.length}
          members={crewMembers}
        />
      </section>

      {/* =========================== STATS =========================== */}
      <RevealGroup className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <RevealItem key={s.label}>
            <div
              className="ac-tile flex items-center gap-3 px-5 py-5"
              style={{ "--a": s.accent } as CSSProperties}
            >
              <span
                className="ac-badge flex h-11 w-11 shrink-0 items-center justify-center"
                style={{ "--a": s.accent } as CSSProperties}
              >
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
          </RevealItem>
        ))}
      </RevealGroup>

      {/* =========================== ROSTER ========================== */}
      <section>
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="ac-eyebrow inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-primary" aria-hidden />
                The leaderboard
              </span>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground">
                The roster
              </h2>
              <p className="mt-1 max-w-lg text-base text-foreground/70">
                Ranked by lessons finished. The one on top wears the crown —
                for now.
              </p>
            </div>
            <span className="ac-chip text-xs font-semibold">
              {pluralize(members.length, "member")}
            </span>
          </div>
        </Reveal>

        <div className="mt-6">
          {members.length === 0 ? (
            <Reveal>
              <div className="ac-card px-6 py-16 text-center">
                <div
                  className="ac-badge mx-auto flex h-14 w-14 items-center justify-center"
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
        <div className="ac-glass flex flex-col gap-4 p-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className="ac-badge flex h-11 w-11 shrink-0 items-center justify-center"
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
              url="https://learnfrc.com"
            />
          </div>
        </div>
      </Reveal>
    </div>
  );
}
