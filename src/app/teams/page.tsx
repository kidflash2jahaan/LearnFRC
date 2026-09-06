import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  getTeamByNumber,
  getTeamSubteamCoverage,
  getReferralCount,
} from "@/lib/queries";
import { ShareButton } from "@/components/share-button";
import { clampPct, pluralize } from "@/lib/utils";
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

/**
 * /teams is the sign-out sheet on the pit wall.
 *
 * A member comes here to answer three questions in order: who else from my
 * team is here, which subteams has nobody picked up, and how do I get more
 * people in. The page is laid out in exactly that order, and the middle
 * question gets the most room because it is the only one that ends in
 * somebody doing something.
 */
export default async function TeamsPage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login?next=/teams");

  if (!profile?.team_number) return <NoTeamNumber />;

  return renderTeam(profile.team_number, user.id, profile.username);
}

/* ------------------------------------------------------------------ */
/*  No team number on the profile yet                                  */
/* ------------------------------------------------------------------ */

/**
 * There is no team to draw, so the page is one card and one field to fill in.
 * Nothing is faked here: an empty roster and four zeroed figures would be a
 * report on a team that does not exist yet.
 */
function NoTeamNumber() {
  return (
    <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)] pt-[clamp(2.2rem,5vw,3.8rem)]">
      <div className="nb-box nb-tilt-2 relative mx-auto max-w-[44rem] p-[clamp(1.4rem,3.2vw,2.4rem)]">
        <span className="nb-tape -top-3 left-[18%] rotate-[-4deg]" aria-hidden="true" />
        <span className="nb-tape -bottom-3 right-[16%] rotate-[2.8deg]" aria-hidden="true" />

        <p className="nb-marker">team / not set</p>

        <h1 className="text-[clamp(1.8rem,1.3rem+2.2vw,2.9rem)]">
          Put your team number on your profile.
        </h1>

        <p className="nb-lede mt-[clamp(1rem,2vw,1.4rem)]">
          It is the one you already use at every event, and it is the only
          setup this page has. Everyone who signs up with the same number lands
          on the same sheet: no codes, no invites to accept, no admin.
        </p>

        <ul className="nb-hair mt-[clamp(1.2rem,2.4vw,1.8rem)] flex flex-col gap-2 pt-[clamp(1.2rem,2.4vw,1.8rem)] text-[0.95rem] text-graphite">
          <li>- who on your team is here, and how far each of them has got</li>
          <li>- which of the 11 subteams nobody has picked up yet</li>
          <li>- one link and one QR code for pulling the rest of them in</li>
        </ul>

        <div className="mt-[clamp(1.3rem,2.6vw,1.9rem)]">
          <Link href="/settings" className="nb-btn">
            Add your team number
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  The sheet                                                          */
/* ------------------------------------------------------------------ */

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

  // Departments ARE subteams, so this is the one team view a member can act
  // on. Only usernames and avatars cross the boundary: the coverage query
  // never opens the profiles table at all.
  const byId = new Map(rosterMembers.map((m) => [m.userId, m]));
  const coverage = await getTeamSubteamCoverage(members.map((m) => m.userId));
  const subteamRows: SubteamRow[] = coverage.map((c) => ({
    slug: c.slug,
    name: c.name,
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
  // Distinct lessons the team has finished between them, NOT the sum of the
  // per-member counts, which double-counts a lesson two people both did.
  const distinctDone = subteamRows.reduce((s, r) => s + r.teamCompleted, 0);
  const solo = members.length <= 1;

  const tally: { figure: string; label: string }[] = [
    { figure: String(members.length), label: pluralize(members.length, "member") },
    {
      figure: `${claimedCount}/${subteamRows.length}`,
      label: "subteams claimed",
    },
    {
      figure: totalCompleted.toLocaleString(),
      label: "lessons finished, counting everyone",
    },
    { figure: `${avgPct}%`, label: "average through the catalogue" },
  ];

  return (
    <>
      {/* ===================== MASTHEAD ===================== */}
      <section className="nb-wrap grid items-start gap-[clamp(1.8rem,4vw,3.4rem)] pb-[clamp(1.8rem,3.6vw,2.8rem)] pt-[clamp(2.2rem,5vw,3.8rem)] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.8fr)]">
        <div>
          <p className="nb-marker">the pit sheet</p>

          <h1 className="max-w-[14ch]">Team {teamNumber}, and who is on what.</h1>

          <p className="nb-lede mt-[clamp(1rem,2vw,1.5rem)]">
            {solo
              ? `You are the only one from ${teamNumber} here so far. Every subteam on the team is ruled out below: what you have covered, and what is still wide open.`
              : `Everyone who signed up with team ${teamNumber} is on this sheet, with all 11 subteams ruled out so you can see who is covering what and what nobody has picked up.`}
          </p>

          <div className="mt-[clamp(1.4rem,2.6vw,2rem)] flex flex-wrap gap-3">
            <Link href="/guides" className="nb-btn">
              Open the guides
            </Link>
            <Link href="#subteams" className="nb-btn-ghost">
              {gapRows.length > 0 ? "See what is open" : "See who is on what"}
            </Link>
          </div>
        </div>

        <CrewPanel
          teamNumber={teamNumber}
          avgPct={avgPct}
          totalCompleted={totalCompleted}
          totalNeeded={totalNeeded}
          memberCount={members.length}
          members={crewMembers}
        />
      </section>

      {/* ===================== THE TALLY =====================
          Four figures ruled across the page. Not cards: a card per number
          would make four objects to compare where there are only four
          numbers to read. */}
      <section className="nb-wrap pb-[clamp(2.4rem,5vw,3.6rem)]">
        <div className="nb-rule grid grid-cols-2 gap-x-[clamp(1rem,3vw,2.4rem)] gap-y-[clamp(1.2rem,2.4vw,1.6rem)] pt-[clamp(1.2rem,2.4vw,1.8rem)] sm:grid-cols-4">
          {tally.map((t, i) => (
            <div
              key={t.label}
              className={
                i > 0
                  ? "sm:border-l sm:border-dashed sm:pl-[clamp(1rem,2.4vw,1.8rem)]"
                  : undefined
              }
            >
              <p className="nb-count text-[clamp(1.7rem,1.2rem+1.4vw,2.3rem)]">
                {t.figure}
              </p>
              <p className="nb-slug mt-1.5 leading-relaxed">{t.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= INVITE, FOR A TEAM OF ONE =================
          109 of 144 teams here are exactly one person, and for that person a
          roster is a list of themselves. The empty roster IS the invite
          moment, so on a team of one the invite runs directly under the
          masthead: an offer, not a report that nobody else showed up. On a
          team with a crew it stays at the bottom where it always was. */}
      {solo && username ? (
        <section id="invite" className="nb-wrap pb-[clamp(2.4rem,5vw,3.6rem)]">
          <TeamInvite
            username={username}
            teamNumber={teamNumber}
            referralCount={referralCount}
            tone="solo"
          />
        </section>
      ) : null}

      {/* ===================== COVERAGE =====================
          The section that makes this a team tool rather than a profile. A
          named, checkable gap ("nobody is on Electrical") is a specific person
          to go and ask, and it reads the same on a team of one. */}
      <section id="subteams" className="nb-wrap pb-[clamp(2.6rem,5vw,4rem)]">
        <div className="mb-[clamp(1.2rem,2.6vw,1.8rem)] flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <p className="nb-marker">who is on what</p>
            <h2>Subteam coverage</h2>
            <p className="nb-sub mt-3">
              {claimedCount} of {subteamRows.length} subteams have somebody from{" "}
              {teamNumber} on them
              {gapRows.length > 0
                ? ". The dashed lines are the ones nobody has picked up."
                : ", which is the whole robot covered."}
            </p>
          </div>
          {/* Distinct lessons, deliberately worded apart from the tally above:
              that one sums every member, this one counts each lesson once
              however many people finished it. */}
          <p className="nb-slug shrink-0">
            covers {distinctDone.toLocaleString()} of{" "}
            {totalLessons.toLocaleString()} lessons
          </p>
        </div>

        <SubteamMeter rows={subteamRows} />

        <div className="mt-[clamp(1.4rem,3vw,2.2rem)]">
          <SubteamGapCard
            teamNumber={teamNumber}
            username={username}
            gaps={gapRows.map((r) => subteamLabel(r.name))}
            coveredCount={claimedCount}
            totalSubteams={subteamRows.length}
            soloMember={solo}
            teamCompleted={distinctDone}
            totalLessons={totalLessons}
          />
        </div>

        <div className="mt-[clamp(1.6rem,3.4vw,2.6rem)]">
          <SubteamBoard rows={subteamRows} />
        </div>
      </section>

      {/* ===================== ROSTER ===================== */}
      <section className="nb-wrap pb-[clamp(2.6rem,5vw,4rem)]">
        <div className="mb-[clamp(1.2rem,2.6vw,1.8rem)] flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <p className="nb-marker">the roster</p>
            <h2>{solo ? "Where you are at" : "Who is furthest along"}</h2>
            <p className="nb-sub mt-3">
              {solo
                ? `One row, for now. Anyone who signs up with ${teamNumber} lands on this sheet automatically, ranked by lessons finished.`
                : "Ranked by lessons finished. Your own row is washed blue and barred in the margin."}
            </p>
          </div>
          <p className="nb-slug shrink-0">
            {pluralize(members.length, "member")}
          </p>
        </div>

        {members.length === 0 ? (
          <div className="nb-note max-w-[46rem]">
            <p className="nb-slug">roster / empty</p>
            <p className="mt-2 text-[0.95rem] leading-snug">
              You are the first one here. Tell your teammates to sign up with
              team {teamNumber} and they appear on this sheet on their own.
            </p>
          </div>
        ) : (
          // Capped for the same reason as the leaderboard's board: a
          // five-column sheet stretched to the full gutter puts the XP figure
          // a hand's width from the name it belongs to.
          <div className="max-w-[58rem]">
            <Roster members={rosterMembers} totalLessons={totalLessons} />
          </div>
        )}
      </section>

      {/* ===================== INVITE =====================
          The real referral panel, not a bare homepage link. Both share
          controls on this page used to point at https://learnfrc.com with no
          `?ref=`, so every teammate recruited from the team page landed
          unattributed and neither side ever got the +25 XP the copy promises.
          TeamInvite hands out ONE url across its copy control, its share
          sheet, its QR and the printable handout, so a signup from any of
          them is credited to the same person and stamped `via=team-invite`.
          (The gap card above still emits a bare `?ref=` with no `&via=`:
          attributed, just not surface-tagged.)

          Rendered here only when it is not already up under the masthead, so
          a solo member never gets the same panel twice. */}
      {!solo || !username ? (
        <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)]">
          {username ? (
            <TeamInvite
              username={username}
              teamNumber={teamNumber}
              referralCount={referralCount}
            />
          ) : (
            <UnattributedInvite teamNumber={teamNumber} />
          )}
        </section>
      ) : null}
    </>
  );
}

/**
 * Fallback for the handful of accounts with no username yet. There is no
 * `?ref=` to build a referral link from, so this can only send a plain signup
 * link, and no QR or handout: both would print a code that credits nobody.
 * Everyone else gets the real TeamInvite above.
 */
function UnattributedInvite({ teamNumber }: { teamNumber: number }) {
  return (
    <div className="nb-box flex flex-col gap-5 p-[clamp(1.2rem,2.6vw,1.9rem)] sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <p className="nb-marker">invite / free for your team</p>
        <h2 className="text-[clamp(1.2rem,1rem+0.9vw,1.6rem)]">Grow the crew</h2>
        <p className="nb-sub mt-2.5 text-[0.95rem]">
          Anyone who signs up with team {teamNumber} joins this sheet on their
          own: no codes, no setup.{" "}
          <Link href="/settings" className="nb-link">
            Pick a username
          </Link>{" "}
          and the link starts crediting you the +25 XP too.
        </p>
      </div>
      <div className="shrink-0">
        <ShareButton
          variant="brand"
          label="Share invite"
          text={`Join our FRC team on LearnFRC. Sign up with team ${teamNumber} and we can track each other's progress and learn together:`}
          url="https://learnfrc.com/signup"
        />
      </div>
    </div>
  );
}
