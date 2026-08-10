import type { CSSProperties, ComponentType } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Users,
  CheckCircle2,
  Gauge,
  LayoutGrid,
  ArrowRight,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import {
  getTeamByNumber,
  getTeamSubteamCoverage,
  getReferralCount,
} from "@/lib/queries";
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
import {
  SubteamBoard,
  SubteamMeter,
  type SubteamRow,
} from "@/components/team/subteam-board";
// From its own plain module, NOT from the "use client" board: a Server
// Component cannot call a function exported by a client module.
import { subteamLabel } from "@/components/team/subteam-label";
import { SubteamGapCard } from "@/components/team/subteam-gap-card";
import { TeamInvite } from "@/components/team/team-invite";
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
        {!profile?.team_number ? (
          <EmptyState />
        ) : (
          await renderTeam(profile.team_number, user.id, profile.username)
        )}
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

async function renderTeam(
  teamNumber: number,
  uid: string,
  username: string | null
) {
  const [{ totalLessons, members }, referralCount] = await Promise.all([
    getTeamByNumber(teamNumber),
    getReferralCount(uid),
  ]);
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

  // ── Subteam coverage ────────────────────────────────────────────────────
  // Departments ARE subteams, so this is the one team view a member can act
  // on. Only usernames/avatars cross the boundary — the coverage query never
  // opens the profiles table at all.
  const byId = new Map(rosterMembers.map((m) => [m.userId, m]));
  const coverage = await getTeamSubteamCoverage(members.map((m) => m.userId));
  const subteamRows: SubteamRow[] = coverage.map((c) => ({
    slug: c.slug,
    name: c.name,
    accent: c.accent,
    icon: c.icon,
    lessonCount: c.lessonCount,
    teamCompleted: c.teamCompleted,
    crew: c.members.flatMap((cm) => {
      const r = byId.get(cm.userId);
      return r
        ? [
            {
              userId: r.userId,
              name: r.name,
              avatarUrl: r.avatarUrl,
              completed: cm.completed,
              isYou: r.isYou,
            },
          ]
        : [];
    }),
  }));

  const gapRows = subteamRows.filter((r) => r.crew.length === 0);
  const claimedCount = subteamRows.length - gapRows.length;
  // Distinct lessons the team has finished between them — NOT the sum of the
  // per-member counts, which double-counts a lesson two people both did.
  const distinctDone = subteamRows.reduce((s, r) => s + r.teamCompleted, 0);
  const solo = members.length <= 1;

  const stats: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    value: number;
    suffix?: string;
    accent: string;
  }[] = [
    { icon: Users, label: "Members", value: members.length, accent: "var(--primary)" },
    {
      icon: LayoutGrid,
      label: "Subteams covered",
      value: claimedCount,
      suffix: `/${subteamRows.length}`,
      accent: "var(--magenta)",
    },
    {
      icon: CheckCircle2,
      label: "Lessons completed",
      value: totalCompleted,
      accent: "var(--accent)",
    },
    { icon: Gauge, label: "Avg. completion", value: avgPct, suffix: "%", accent: "var(--primary)" },
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
              {solo ? (
                <>
                  You&apos;re the only one from #{teamNumber} here so far.
                  Below is every subteam on the team — what you&apos;re
                  covering, and what&apos;s still wide open.
                </>
              ) : (
                <>
                  Everyone who signed up with team #{teamNumber} is in the pit —
                  with every subteam laid out so you can see who&apos;s covering
                  what, and what nobody has picked up yet.
                </>
              )}
            </p>
          </RiseItem>
          <RiseItem>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/guides" className="ac-btn text-sm">
                Keep climbing <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="#subteams" className="ac-btn-ghost text-sm">
                {gapRows.length > 0 ? "See what's missing" : "See who's on what"}
              </Link>
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

      {/* ==================== INVITE (solo lead) ===================== */}
      {/* 109 of 144 teams here are exactly one person, and for that person a  */}
      {/* roster is a list of themselves. The empty roster IS the invite       */}
      {/* moment, so on a team of one the invite runs directly under the hero  */}
      {/* instead of at the bottom of the page — an offer, not a report that   */}
      {/* nobody else showed up. On a team with a crew it stays where it was.  */}
      {solo && username ? (
        <Reveal>
          <section id="invite" className="scroll-mt-28">
            <TeamInvite
              username={username}
              teamNumber={teamNumber}
              referralCount={referralCount}
              tone="solo"
            />
          </section>
        </Reveal>
      ) : null}

      {/* =========================== STATS =========================== */}
      <RevealGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* ========================== SUBTEAMS ========================= */}
      {/* An FRC team is split into subteams and so is this catalog — one      */}
      {/* department each. This is the section that makes the page a TEAM      */}
      {/* tool: a named, checkable gap ("nobody is on Electrical") is a        */}
      {/* specific person to go ask, and it reads the same for a team of one.  */}
      <section id="subteams" className="scroll-mt-28">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="ac-eyebrow inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-primary" aria-hidden />
                Who&apos;s on what
              </span>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground">
                Subteam coverage
              </h2>
              <p className="mt-1 max-w-lg text-base text-foreground/70">
                {claimedCount} of {subteamRows.length} subteams have someone
                from #{teamNumber} on them
                {gapRows.length > 0
                  ? ". The dashed ones are wide open."
                  : " — the whole robot, covered."}
              </p>
            </div>
            {/* Distinct lessons, deliberately worded differently from the
                "Lessons completed" stat above — that one sums every member,
                this one counts each lesson once however many people did it. */}
            <span className="ac-chip text-xs font-semibold tabular-nums">
              Covers {distinctDone} of {totalLessons} lessons
            </span>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="mt-5">
            <SubteamMeter rows={subteamRows} />
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-5">
            <SubteamGapCard
              teamNumber={teamNumber}
              username={username}
              gaps={gapRows.map((r) => subteamLabel(r.name))}
              gapAccent={gapRows[0]?.accent}
              coveredCount={claimedCount}
              totalSubteams={subteamRows.length}
              soloMember={solo}
              teamCompleted={distinctDone}
              totalLessons={totalLessons}
            />
          </div>
        </Reveal>

        <div className="mt-5">
          <SubteamBoard rows={subteamRows} />
        </div>
      </section>

      {/* =========================== ROSTER ========================== */}
      <section>
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="ac-eyebrow inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-primary" aria-hidden />
                {solo ? "Where you're at" : "The leaderboard"}
              </span>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground">
                {solo ? "Your progress" : "The roster"}
              </h2>
              <p className="mt-1 max-w-lg text-base text-foreground/70">
                {solo
                  ? `One row, for now. Anyone who signs up with #${teamNumber} lands here automatically, ranked by lessons finished.`
                  : "Ranked by lessons finished. The one on top wears the crown — for now."}
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
      {/* The real referral card, not a bare homepage link. Both share       */}
      {/* controls on this page used to point at https://learnfrc.com with   */}
      {/* no `?ref=`, so every teammate recruited from the team page landed  */}
      {/* unattributed and neither side ever got the +25 XP the copy         */}
      {/* promises. TeamInvite hands out ONE url across its copy control,    */}
      {/* its share sheet, its QR and the printable handout, so a signup     */}
      {/* from any of them is credited to the same person and stamped        */}
      {/* `via=team-invite`. (The subteam gap card above still emits a bare  */}
      {/* `?ref=` with no `&via=` — attributed, just not surface-tagged.)    */}
      {/*                                                                    */}
      {/* Rendered here only when it is NOT already up under the hero, so a  */}
      {/* solo member never gets the same panel twice.                       */}
      {!solo || !username ? (
        <Reveal>
          {username ? (
            <TeamInvite
              username={username}
              teamNumber={teamNumber}
              referralCount={referralCount}
            />
          ) : (
            <UnattributedInvite teamNumber={teamNumber} />
          )}
        </Reveal>
      ) : null}
    </div>
  );
}

/**
 * Fallback for the handful of accounts with no username yet — there is no
 * `?ref=` to build a referral link from, so this can only send a plain signup
 * link — and no QR or handout, both of which would print a code that credits
 * nobody. Everyone else gets the real TeamInvite above.
 */
function UnattributedInvite({ teamNumber }: { teamNumber: number }) {
  return (
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
          url="https://learnfrc.com/signup"
        />
      </div>
    </div>
  );
}
