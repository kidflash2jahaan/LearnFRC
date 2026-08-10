"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Users, ArrowRight } from "lucide-react";
import { ShareButton } from "@/components/share-button";

/**
 * "Start a team space" — the one ask that turns a solo learner into a team.
 *
 * WHY THIS ASK, AND WHY IT IS WORTH SPENDING A RUNG ON
 * ---------------------------------------------------
 * 109 of 144 teams on LearnFRC have exactly one member. Teams with an adult
 * running them average 5.09 members against 1.35 for teams without — the whole
 * reason Team Mode exists is that somebody has to press "I'll organise this",
 * and today nothing ever suggests it. A person who has finished a handful of
 * lessons and is still the only account on their team number is the single
 * best-qualified audience for that suggestion that this product will ever have.
 *
 * WHY IT IS NOT A STANDING BANNER
 * -------------------------------
 * A permanent "start a team space" card on the dashboard would be seen by the
 * same person on every visit for the rest of their account's life, which is how
 * a suggestion turns into furniture and then into noise. This follows the same
 * contract as `lesson-milestone-share`: two rungs, each remembered in
 * localStorage the moment it is shown, so it is at most TWO asks in an entire
 * account lifetime and it cannot come back on reload.
 *
 *  1. `warmed-up` (3+ lessons) — past the point where someone is just poking
 *     at the site. Only 31 of the 109 solo members clear this bar, which is
 *     precisely why it is the bar: below it, the ask is aimed at people who
 *     have not yet decided the site is worth their own time, let alone their
 *     team's.
 *  2. `invested` (12+ lessons) — a real body of work built alone. This rung
 *     exists for the people who were already deep in the curriculum before Team
 *     Mode shipped and would otherwise never see rung 1 again. It is `>=`, and
 *     the copy quotes their true count, so it stays honest at 12 or at 174.
 *
 * ELIGIBILITY IS DECIDED ON THE SERVER, NOT HERE
 * ----------------------------------------------
 * `inTeamSpace`, `teamSpaceExists` and `teammatesOnPlatform` are cross-user
 * facts; a client has no business deriving them and this component never tries. The caller passes them
 * down already resolved (see the wiring note at the bottom of this file), and
 * this component decides only two things: which rung, and whether that rung has
 * already been spent on this device.
 *
 * HYDRATION
 * ---------
 * The "have I already spent this rung" answer comes through
 * `useSyncExternalStore`, whose `getServerSnapshot` returns "yes, seen". React
 * uses that value both when server-rendering AND when hydrating, so the server
 * tree and the first client tree are identical by construction — this component
 * renders literally nothing until hydration is finished, at which point React
 * re-reads the client snapshot and the card mounts (so its entrance animation
 * plays properly instead of being burned during a hidden mount).
 *
 * That is also why storage is not touched in an effect: React's own
 * `set-state-in-effect` rule forbids the read-then-setState shape, and
 * `useSyncExternalStore` is the sanctioned way to read a client-only value
 * without a hydration mismatch. The snapshot is cached at module scope, so the
 * read happens at most once per page load and never on the server.
 *
 * Reduced motion changes `transition` only — never the tree or the text.
 */

/* ------------------------------------------------------------------ */
/*  Attribution                                                        */
/* ------------------------------------------------------------------ */

/**
 * Surfaces the signup attribution allow-list already accepts
 * (`REFERRAL_SURFACES` in src/lib/signup-attribution.ts). Typed as a union on
 * purpose: a `via=` that is not on that list is silently dropped server-side, so
 * an invented value would look like attribution and record nothing. If this
 * nudge ever lands on a surface that needs its own value, the value has to be
 * added to that allow-list in the same change.
 */
export type ReferralSurface = "dashboard" | "leaderboard" | "lesson-milestone";

/* ------------------------------------------------------------------ */
/*  Don't-nag contract                                                 */
/* ------------------------------------------------------------------ */

export type StartSpaceRung = "warmed-up" | "invested";

/** Lifetime completed-lesson count at which each rung becomes available. */
const WARMED_UP_AT = 3;
const INVESTED_AT = 12;

/**
 * Teams bigger than this already have momentum without anyone organising them,
 * and an unsolicited card is worth less there than the silence is. The ask is
 * for the 109 one-person teams and the handful of two- and three-person ones.
 */
const MAX_TEAMMATES = 4;

const SEEN_PREFIX = "lf_start_space_";

/** Has this rung already been offered on this device? */
export function hasSeenStartSpaceRung(rung: StartSpaceRung): boolean {
  try {
    return localStorage.getItem(`${SEEN_PREFIX}${rung}`) === "1";
  } catch {
    // Storage blocked (private mode / embedded webview). Treat as unseen — the
    // in-page state still prevents a second ask within this session.
    return false;
  }
}

/** Spend this rung: it will never be offered again on this device. */
export function rememberStartSpaceRung(rung: StartSpaceRung): void {
  try {
    localStorage.setItem(`${SEEN_PREFIX}${rung}`, "1");
  } catch {
    /* storage blocked — nothing to persist, the session state still holds */
  }
}

/** Which rung a lifetime lesson count qualifies for, if any. */
export function rungFor(completedLessons: number): StartSpaceRung | null {
  if (completedLessons >= INVESTED_AT) return "invested";
  if (completedLessons >= WARMED_UP_AT) return "warmed-up";
  return null;
}

/* --- the store behind useSyncExternalStore ------------------------- */

/**
 * Read once per page load and cached, for two reasons. First, `getSnapshot`
 * runs on every render and must return a stable value or React loops. Second —
 * and this is the behavioural one — the rung is marked as spent while the card
 * is on screen, and re-reading storage would then flip the answer to "seen" and
 * yank the card out from under the reader mid-sentence. The cache pins the
 * decision for the life of the page; the next page load reads storage fresh and
 * correctly finds the rung spent.
 */
const seenCache = new Map<StartSpaceRung, boolean>();

function seenSnapshot(rung: StartSpaceRung | null): boolean {
  if (!rung) return true;
  let value = seenCache.get(rung);
  if (value === undefined) {
    value = hasSeenStartSpaceRung(rung);
    seenCache.set(rung, value);
  }
  return value;
}

/** Nothing outside React ever changes this answer mid-page, so never notify. */
function subscribeNever(): () => void {
  return () => {};
}

/** Server and hydration both see "already spent", i.e. render nothing. */
function seenOnServer(): boolean {
  return true;
}

/* ------------------------------------------------------------------ */
/*  Copy                                                               */
/* ------------------------------------------------------------------ */

function copyFor({
  rung,
  teamNumber,
  completedLessons,
  teammatesOnPlatform,
}: {
  rung: StartSpaceRung;
  teamNumber: number;
  completedLessons: number;
  teammatesOnPlatform: number;
}) {
  const alone = teammatesOnPlatform === 0;
  const crew = teammatesOnPlatform + 1;

  // The eyebrow quotes the reader's real count, never a rounded rung number —
  // "12 lessons in" would read as a lie to someone with 174.
  const eyebrow =
    rung === "invested" && alone
      ? `${completedLessons} lessons, one account`
      : `${completedLessons} lessons in`;

  const title = alone
    ? `Bring the rest of ${teamNumber} with you`
    : `Get all of ${teamNumber} in one place`;

  // The offer is described in terms of what the reader gets to DO, and the
  // privacy shape is stated up front rather than buried behind the click —
  // most people reading this are inviting minors.
  const situation = alone
    ? rung === "invested"
      ? `You've finished ${completedLessons} lessons and team ${teamNumber} still has exactly one account on it: yours.`
      : `You're the only one from team ${teamNumber} here so far.`
    : `There are ${crew} of you from team ${teamNumber} here, but nobody's running a space for it.`;

  const body = `${situation} A team space gives you one link to hand out — everyone who joins lands in the same roster, you can see which subteams still have nobody on them, and members only ever share the lessons they've finished. No names, no emails, and anyone can leave in one click.`;

  const shareText = alone
    ? `I'm learning FRC on LearnFRC — free lessons for every subteam, CAD through scouting. Team ${teamNumber} should be on this:`
    : `Team ${teamNumber} is on LearnFRC — free lessons for every subteam, CAD through scouting. Grab yours:`;

  return { eyebrow, title, body, shareText };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function StartSpaceNudge({
  teamNumber,
  username,
  completedLessons,
  teammatesOnPlatform,
  inTeamSpace,
  teamSpaceExists,
  createHref = "/teams/space/new",
  via = "dashboard",
}: {
  /** The viewer's own FRC team number. Display label only — never authority. */
  teamNumber: number | null;
  /** Referral username. Null for the handful of accounts that have none. */
  username: string | null;
  /** Lifetime completed-lesson count, resolved on the server. */
  completedLessons: number;
  /** OTHER accounts carrying the same team number. 0 = they are alone. */
  teammatesOnPlatform: number;
  /** True if the viewer is already in a team space — then never ask at all. */
  inTeamSpace: boolean;
  /**
   * True if SOMEONE has already claimed a space for this team number
   * (`isTeamNumberClaimed`). Then the ask is a dead end — first claimer wins, so
   * "start a team space" would fail with `taken` — and the nudge stays silent
   * rather than telling this reader that a space they are not in exists.
   */
  teamSpaceExists: boolean;
  /** Where "Start a team space" goes. Defaults to the create screen. */
  createHref?: string;
  /** Allow-listed attribution surface for the fallback share link. */
  via?: ReferralSurface;
}) {
  const reduce = useReducedMotion();
  const [dismissed, setDismissed] = React.useState(false);

  // Nothing to ask for if they already have a space, if the number is already
  // claimed (the ask would dead-end on `taken`), if their team is big enough to
  // be self-organising, or if there's no number to name.
  const eligible =
    !inTeamSpace &&
    !teamSpaceExists &&
    teamNumber !== null &&
    teammatesOnPlatform <= MAX_TEAMMATES;
  const rung = eligible ? rungFor(completedLessons) : null;

  const readSeen = React.useCallback(() => seenSnapshot(rung), [rung]);
  const seen = React.useSyncExternalStore(subscribeNever, readSeen, seenOnServer);

  const visible = rung !== null && !seen && !dismissed;

  // Spend the rung the moment the card is shown — the same contract as the
  // lesson milestone card, and the reason this is at most two asks per account.
  // A storage write is a pure external-system sync, which is exactly what an
  // effect is for; the cached snapshot above means it cannot hide the card it
  // has just revealed.
  React.useEffect(() => {
    if (visible && rung) rememberStartSpaceRung(rung);
  }, [visible, rung]);

  if (!visible || !rung || teamNumber === null) return null;

  const { eyebrow, title, body, shareText } = copyFor({
    rung,
    teamNumber,
    completedLessons,
    teammatesOnPlatform,
  });
  const accent = "#2560e6";

  // Fallback path for someone who doesn't want to run a space: just refer.
  // `via` is allow-listed (see ReferralSurface) so this actually records.
  const shareLink = username
    ? `https://learnfrc.com/signup?ref=${username}&via=${via}`
    : "https://learnfrc.com/signup";

  return (
    <motion.div
      // Opacity + transform only: the card occupies its final space from the
      // first frame it exists, so nothing under it jumps.
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduce ? { duration: 0 } : { duration: 0.35, ease: [0.21, 0.47, 0.32, 0.98] }
      }
      className="ac-tile p-5"
      style={{ "--a": accent } as CSSProperties}
    >
      <div className="flex items-start gap-3">
        <span
          className="ac-badge flex h-11 w-11 shrink-0 items-center justify-center"
          style={{ "--a": accent } as CSSProperties}
        >
          <Users className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="ac-eyebrow">{eyebrow}</p>
          <p className="mt-1 font-display text-lg font-bold leading-snug text-foreground">
            {title}
          </p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-foreground/75">
            {body}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 sm:pl-[56px]">
        {/* No onClick: the rung is already spent, and hiding the card under the
            reader's cursor mid-navigation is a flash for no gain. */}
        <Link href={createHref} className="ac-btn text-sm">
          Start a team space <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        {username ? (
          <ShareButton
            variant="ghost"
            label="Just send the link"
            text={shareText}
            url={shareLink}
          />
        ) : null}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="inline-flex min-h-[44px] items-center rounded-xl px-3 text-sm font-medium text-foreground/60 transition-colors hover:bg-white/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Not now
        </button>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 *  WIRING (kept here so the caller stays a three-line change)
 *
 *  From a Server Component that already has the session — the dashboard is the
 *  intended home, since it is the highest-traffic authed surface and the one
 *  people land on after finishing something:
 *
 *    import { getMyTeamSpace, isTeamNumberClaimed } from "@/lib/team-space";
 *    import { StartSpaceNudge } from "@/components/team/start-space-nudge";
 *
 *    const n = profile?.team_number ?? null;
 *    const [space, claimed] = await Promise.all([
 *      getMyTeamSpace(),
 *      n ? isTeamNumberClaimed(n) : Promise.resolve(false),
 *    ]);
 *    // teammatesOnPlatform: other accounts sharing this team number. Count it
 *    // with the admin client and `head: true` — a COUNT, never a row read, so
 *    // no other user's data is fetched to render a nudge.
 *    const { count } = n
 *      ? await admin.from("profiles").select("id", { count: "exact", head: true })
 *          .eq("team_number", n).neq("id", user.id)
 *      : { count: 0 };
 *
 *    <StartSpaceNudge
 *      teamNumber={n}
 *      username={profile?.username ?? null}
 *      completedLessons={completedCount}
 *      teammatesOnPlatform={count ?? 0}
 *      inTeamSpace={space !== null}
 *      teamSpaceExists={claimed}
 *      createHref="/teams/space/new"
 *      via="dashboard"          // must stay in the signup-attribution allow-list
 *    />
 *
 *  Place it ABOVE the fold. The rung is spent when the card renders, not when
 *  it is scrolled into view, so a card buried at the bottom of a long dashboard
 *  burns one of the two asks this account will ever get.
 * ------------------------------------------------------------------ */
