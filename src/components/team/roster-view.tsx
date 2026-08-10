import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, LayoutGrid, Users, Lock } from "lucide-react";
import { listSpaceProgress } from "@/lib/team-space";
import { Reveal } from "@/components/motion/primitives";
import { AnimatedCounter } from "@/components/animated-counter";
import {
  SubteamBoard,
  SubteamMeter,
  type SubteamRow,
} from "@/components/team/subteam-board";
import { SubteamGapCard } from "@/components/team/subteam-gap-card";
// From its own plain module, NOT from the "use client" board: a Server
// Component cannot call a function a client module exports.
import { subteamLabel } from "@/components/team/subteam-label";
import {
  RosterList,
  RosterConsentNote,
  type RosterRow,
} from "@/components/team/roster-list";

/**
 * THE LEAD'S ROSTER — the one genuinely privileged view in Team Mode.
 *
 * ORDER IS THE ARGUMENT. Coverage first, people second. A mentor does not open
 * this to rank teenagers; they open it to answer "has anybody on my team
 * actually learned electrical yet, and if not who do I go ask". Naming the
 * empty subteam is what turns a page-view into an assignment and an invite,
 * which is the entire reason this feature is being built: 11 teams with an
 * adult average 5.09 members, the 133 without average 1.35.
 *
 * SECURITY POSTURE. This component fetches through listSpaceProgress(), which
 * re-derives leadership from auth.getUser() plus a membership row on every
 * call and returns `not_found` — never `forbidden` — to anyone else. Nothing
 * here trusts a prop for authorisation: `spaceId` is a lookup key, not a
 * capability, and passing someone else's space id yields the same locked card
 * a stranger gets. No profile field beyond username/avatar/xp is available to
 * render even by accident, because the server never selects one.
 *
 * WHY THE REUSED CARDS. SubteamBoard and SubteamGapCard already exist and are
 * already tuned for the 375px single-column case; a second coverage board
 * would drift from the first within a month. They take opaque memberKeys here
 * exactly where they took raw user ids on the legacy /teams page.
 */
export async function TeamRosterView({
  spaceId,
  viewerUsername,
  inviteHref = "/teams/space#invite-h",
}: {
  spaceId: string;
  /** The viewer's own referral handle, for the reused gap card's share link. */
  viewerUsername: string | null;
  /**
   * Where "send them your invite link" goes. The invite link itself is owned
   * by the manage surface (/teams/space) — this view never mints, renders or
   * even reads a token, so a leaked screenshot of this page admits nobody.
   * `#invite-h` is that page's invite heading.
   */
  inviteHref?: string;
}) {
  const res = await listSpaceProgress(spaceId);

  // Uniform failure. A non-lead, a stale space id and a deleted space all land
  // here with identical copy, so this page cannot be used to confirm that some
  // other space exists.
  if (!res.ok) return <RosterLocked />;

  const { space, members, totalLessons, coverage } = res.data;
  // Taken from the authorised payload, never from a prop: a caller-supplied
  // team number could put "Team #254" above team #90001's roster, which is a
  // lie in exactly the direction that matters.
  const teamNumber = space.teamNumber;

  // ── per-member subteam shape ──────────────────────────────────────────────
  // "Priya, mostly Programming" is the sentence that makes a roster row worth
  // reading. Built from the coverage query we already have, so it costs no
  // extra round trip and no extra column.
  const shape = new Map<
    string,
    { count: number; top: string | null; accent: string | null; best: number }
  >();
  for (const c of coverage) {
    const label = subteamLabel(c.name);
    for (const cm of c.members) {
      const e =
        shape.get(cm.memberKey) ??
        { count: 0, top: null as string | null, accent: null as string | null, best: 0 };
      e.count += 1;
      if (cm.completed > e.best) {
        e.best = cm.completed;
        e.top = label;
        e.accent = c.accent;
      }
      shape.set(cm.memberKey, e);
    }
  }

  const rows: RosterRow[] = members.map((m) => {
    const s = shape.get(m.memberKey);
    return {
      memberKey: m.memberKey,
      username: m.username,
      avatarUrl: m.avatarUrl,
      isLead: m.isLead,
      isSelf: m.isSelf,
      completed: m.completed,
      xp: m.xp,
      // Formatted on the server so the client renders the identical string.
      lastActiveLabel: relTime(m.lastActive),
      topSubteam: s?.top ?? null,
      topAccent: s?.accent ?? null,
      subteamCount: s?.count ?? 0,
    };
  });

  // ── the board ─────────────────────────────────────────────────────────────
  const byKey = new Map(members.map((m) => [m.memberKey, m]));
  const subteamRows: SubteamRow[] = coverage.map((c) => ({
    slug: c.slug,
    name: c.name,
    accent: c.accent,
    icon: c.icon,
    lessonCount: c.lessonCount,
    teamCompleted: c.teamCompleted,
    crew: c.members.flatMap((cm) => {
      const r = byKey.get(cm.memberKey);
      // `userId` on this shared type is only ever a React key and an avatar
      // seed. Feeding it the opaque memberKey keeps the real auth UUID on the
      // server, where it belongs — the legacy roster shipped the raw one.
      return r
        ? [
            {
              userId: r.memberKey,
              name: r.username,
              avatarUrl: r.avatarUrl,
              completed: cm.completed,
              isYou: r.isSelf,
            },
          ]
        : [];
    }),
  }));

  const gapRows = subteamRows.filter((r) => r.crew.length === 0);
  const covered = subteamRows.length - gapRows.length;
  // Distinct lessons, NOT the sum of per-member counts: two people finishing
  // the same lesson is one lesson of coverage, and a mentor reading this as
  // "we've done 62 of 394" must not be told 120.
  const distinctDone = subteamRows.reduce((s, r) => s + r.teamCompleted, 0);
  const solo = members.length <= 1;
  const gapNames = gapRows.map((r) => subteamLabel(r.name));

  return (
    <div className="space-y-10">
      {/* ============================ HEADER =========================== */}
      <Reveal>
        <div>
          <span className="ac-eyebrow inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full bg-primary"
              aria-hidden
            />
            Team space
          </span>
          <h1 className="mt-2 text-balance font-display text-3xl font-extrabold leading-[1.06] text-foreground sm:text-4xl">
            Team{" "}
            <span
              style={{
                background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              #{teamNumber}
            </span>
          </h1>
          <p className="mt-3 max-w-xl text-pretty text-base leading-relaxed text-foreground/70 sm:text-lg">
            {solo
              ? "Every subteam in the curriculum is below, with what you have covered and what is still wide open. Invite the crew and their progress lands here too."
              : `Everyone who accepted your invite, and how much of the curriculum team #${teamNumber} has between them.`}
          </p>
          {/* The invite token and the danger zone live on the manage screen,
              deliberately not on the same page as per-member progress. */}
          <Link href="/teams/space" className="ac-btn-ghost mt-5 text-sm">
            Manage this space <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </Reveal>

      {/* ========================= COVERAGE HERO ======================== */}
      {/* The lead paragraph of the page. Not a stat dump — one number a      */}
      {/* mentor can act on, the eleven-pip shape underneath it, and the      */}
      {/* names of what nobody has touched.                                   */}
      <Reveal delay={0.04}>
        <div className="ac-glass p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
            <div className="min-w-0">
              <span className="ac-eyebrow">Curriculum coverage</span>
              <p className="mt-1.5 font-display text-4xl font-extrabold leading-none text-foreground">
                <AnimatedCounter value={covered} />
                <span className="ml-1.5 text-xl font-bold text-muted-foreground">
                  of {subteamRows.length} subteams
                </span>
              </p>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-foreground/70">
                {coverageSentence(gapNames, distinctDone, subteamRows.length)}
              </p>
            </div>

            <div className="grid w-full shrink-0 grid-cols-2 gap-3 sm:w-auto">
              <MiniStat
                icon="lessons"
                value={distinctDone}
                suffix={`/${totalLessons}`}
                label="Lessons covered"
                accent="var(--accent)"
              />
              <MiniStat
                icon="members"
                value={members.length}
                label={members.length === 1 ? "Member" : "Members"}
                accent="var(--primary)"
              />
            </div>
          </div>

          <div className="mt-6">
            <SubteamMeter rows={subteamRows} />
          </div>
        </div>
      </Reveal>

      {/* ====================== THE ASK, MADE SPECIFIC ================== */}
      {/* Reused wholesale. It already has a solo state, a fresh state and a  */}
      {/* covered state, and it is the only named, targeted invite control   */}
      {/* in the product.                                                     */}
      <Reveal delay={0.06}>
        <SubteamGapCard
          teamNumber={teamNumber}
          username={viewerUsername}
          gaps={gapNames}
          gapAccent={gapRows[0]?.accent}
          coveredCount={covered}
          totalSubteams={subteamRows.length}
          soloMember={solo}
          teamCompleted={distinctDone}
          totalLessons={totalLessons}
        />
      </Reveal>

      {/* =========================== THE BOARD ========================== */}
      <section id="subteams" className="scroll-mt-28">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Who&apos;s on what
              </h2>
              <p className="mt-1 max-w-lg text-[15px] text-foreground/70">
                {gapRows.length > 0
                  ? "The dashed ones have nobody on them yet — those are the assignments."
                  : "Every subteam has someone on it. Now it's about finishing them."}
              </p>
            </div>
            <Link href="/guides" className="ac-btn-ghost text-sm">
              Browse the curriculum{" "}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </Reveal>

        <div className="mt-5">
          <SubteamBoard rows={subteamRows} />
        </div>
      </section>

      {/* =========================== THE PEOPLE ========================= */}
      <section>
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {solo ? "Your progress" : "The roster"}
              </h2>
              <p className="mt-1 max-w-lg text-[15px] text-foreground/70">
                {solo
                  ? "One seat filled. Anyone who accepts your invite appears here with the same three numbers."
                  : "Most lessons finished first. Ordered, not ranked."}
              </p>
            </div>
            <span className="ac-chip text-xs font-semibold tabular-nums">
              {members.length} accepted
            </span>
          </div>
        </Reveal>

        <div className="mt-5">
          <RosterList
            rows={rows}
            totalLessons={totalLessons}
            showInviteRow={solo}
            inviteHref={inviteHref}
          />
        </div>

        <div className="mt-4">
          <RosterConsentNote />
        </div>
      </section>

      {/* Space name is DB-CHECK-pinned to `Team <n>`; rendering it here is a
          cheap reminder that it is derived, never typed by anyone. */}
      <p className="text-center text-xs text-muted-foreground">
        {space.name} · {space.program.toUpperCase()}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * One sentence naming the gap. Three states, because the same words are wrong
 * in the other two — telling a lead who signed up an hour ago that "nobody has
 * started anything" reads as an accusation against the only member: them.
 */
function coverageSentence(
  gaps: string[],
  distinctDone: number,
  total: number
): string {
  if (distinctDone === 0)
    return `Nothing finished yet — all ${total} subteams are still open. Pick the one your team actually works on first.`;
  if (gaps.length === 0)
    return "Every subteam has someone on it. The gaps left are inside them, not between them.";
  const named = gaps.slice(0, 3);
  const rest = gaps.length - named.length;
  const list =
    rest > 0
      ? `${named.join(", ")} and ${rest} more`
      : named.length === 1
        ? named[0]
        : `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
  return `Nobody has started ${list}.`;
}

const MINI_ICONS = {
  lessons: LayoutGrid,
  members: Users,
} as const;

/** Small tile. `--a` drives the ac-tile gradient; layout stays on Tailwind. */
function MiniStat({
  icon,
  value,
  suffix,
  label,
  accent,
}: {
  icon: keyof typeof MINI_ICONS;
  value: number;
  suffix?: string;
  label: string;
  accent: string;
}) {
  const I = MINI_ICONS[icon];
  return (
    <div
      className="ac-tile px-3.5 py-3"
      style={{ "--a": accent } as CSSProperties}
    >
      <I className="h-4 w-4 text-foreground/60" aria-hidden />
      <span className="mt-1.5 block text-xl font-extrabold leading-none tabular-nums text-foreground">
        <AnimatedCounter value={value} suffix={suffix} />
      </span>
      <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
        {label}
      </span>
    </div>
  );
}

/**
 * Shown for every failure mode: not the lead, no such space, space deleted.
 * One card, one sentence, no detail — a probe learns nothing from it.
 */
function RosterLocked() {
  return (
    <div className="ac-card mx-auto max-w-md px-6 py-12 text-center">
      <span
        className="ac-badge mx-auto flex h-12 w-12 items-center justify-center"
        style={{ "--a": "var(--primary)" } as CSSProperties}
      >
        <Lock className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-4 text-lg font-bold text-foreground">
        This roster isn&apos;t yours to see
      </p>
      <p className="mx-auto mt-1.5 max-w-sm text-[15px] leading-relaxed text-foreground/70">
        Per-member progress is visible only to the person who runs the space.
      </p>
      <div className="mt-6 flex justify-center">
        <Link href="/teams/space" className="ac-btn text-sm">
          Back to your team space{" "}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

/**
 * Relative time, computed on the SERVER.
 *
 * Doing this in the client component would call Date.now() during render and
 * mismatch the server's string across a bucket boundary. Buckets are coarse on
 * purpose: "active 3h ago" is what a mentor needs, and a to-the-minute presence
 * readout on a 14-year-old is a different product with a different consent
 * conversation.
 */
function relTime(iso: string | null): string {
  if (!iso) return "no lessons yet";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "no lessons yet";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 3600) return "active just now";
  if (s < 86_400) return `active ${Math.floor(s / 3600)}h ago`;
  const days = Math.floor(s / 86_400);
  if (days < 30) return `active ${days}d ago`;
  return `active ${Math.floor(days / 30)}mo ago`;
}
