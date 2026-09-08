import type { Metadata } from "next";
import Link from "next/link";
import { getDepartments } from "@/lib/queries";
import { Ink } from "@/components/motion/primitives";
import { OnboardingStrip, type OnboardingStep } from "./_onboarding-rail";
import { RosterSheet, type RosterMember } from "./_team-panel";

import { getOverviewStats } from "@/lib/queries";
export const metadata: Metadata = {
  title: "LearnFRC for Teams: free onboarding curriculum for FRC teams",
  description:
    "Onboard your whole FRC team with a ready-made curriculum across every department. Everyone who signs up with your team number is grouped automatically, and you can all see each other's progress. Free.",
  alternates: { canonical: "/for-teams" },
};

const STEPS: OnboardingStep[] = [
  {
    n: "01",
    title: "Everyone types the same team number",
    body: "When your members sign up, they enter your FRC team number. That is the whole step. There is no code to hand out and nothing to configure first.",
    out: "setup required: none",
  },
  {
    n: "02",
    title: "The roster builds itself",
    body: "Anyone on that number is grouped with the rest of you straight away, and a member who joins in week four shows up the moment they finish signing up.",
    out: "invites to send: zero",
  },
  {
    n: "03",
    title: "You can all see who has done what",
    body: "Lessons completed, XP and recent activity, for every member. Mentors use it to find who is trained on the mechanism, and who has not started.",
    out: "visible to: your team",
  },
];

/**
 * What a team gets out of this, in the order a mentor cares about it.
 * Takes the counts rather than baking them in, so the pitch cannot quote a
 * catalogue size the site no longer has.
 */
const offerFor = (
  lessons: number,
  depts: number
): { title: string; body: string }[] => [
  {
    title: "A curriculum that already exists",
    body: `${lessons > 0 ? `${lessons.toLocaleString()} lessons` : "Lessons"}${depts > 0 ? ` across all ${depts} departments` : ""}, written and reviewed. Nobody on your team has to rebuild rookie training from scratch in January again.`,
  },
  {
    title: "A quiz at the end of every lesson",
    body: "Clear every quiz in a department and it issues a certificate for that department, which is the part mentors actually use: real proof of who is trained on what.",
  },
  {
    title: "Free, with no seat count",
    body: "No ads, no paywall, no per-member pricing, and no upgrade waiting at the fifteenth member. Built by a high-school student, for the teams around him.",
  },
];

/** Illustrative roster for the sign-in sheet. Labelled as an example there. */
const SAMPLE_ROSTER: RosterMember[] = [
  { initials: "AK", name: "Ava K.", role: "Mechanical", xp: 1240 },
  { initials: "RJ", name: "Ravi J.", role: "Programming", xp: 980 },
  { initials: "MB", name: "Mia B.", role: "Scouting", xp: 760 },
  { initials: "DP", name: "Dev P.", role: "Rookie", xp: 120 },
];

/** The extent of the catalogue, as printed on the team handout. */
const TALLY: { n: string; unit: string }[] = [
  { n: "11", unit: "departments" },
  { n: "101", unit: "modules" },
  { n: "394", unit: "lessons" },
  { n: "$0", unit: "per member, ever" },
];

/**
 * /for-teams is the handout you give a mentor.
 *
 * The reader is not a learner, they are the person deciding whether to put
 * thirty rookies on this in January. So the page argues in the order they
 * decide in: what it costs to set up (nothing), what it looks like once it is
 * running (the roster), what their team actually gets, and where to point the
 * new members on day one. The three-step strip is the centrepiece because the
 * whole pitch is that there is no admin surface to learn.
 *
 * Server Component. Same single catalogue fetch as before.
 */
export default async function ForTeamsPage() {
  const { lessonCount, deptCount } = await getOverviewStats().catch(() => ({
    lessonCount: 0,
    deptCount: 0,
  }));
  const OFFER = offerFor(lessonCount, deptCount);
  const departments = await getDepartments().catch(() => []);
  const track = departments.slice(0, 6);

  return (
    <>
      {/* ===================== MASTHEAD ===================== */}
      <section className="nb-wrap pb-[clamp(2.2rem,4.5vw,3.4rem)] pt-[clamp(2.2rem,5vw,4rem)]">
        <p className="nb-marker">for mentors and team leads</p>

        <h1 className="max-w-[20ch]">
          Your team already has a curriculum. It just has not been written down.
        </h1>

        <p className="nb-lede mt-[clamp(1rem,2vw,1.5rem)]">
          Every job on an FRC team is in here, in order, with a quiz at the end
          of each lesson. Members who sign up with your team number are grouped
          together, so you can see who has actually done it.
        </p>

        <div className="mt-[clamp(1.4rem,2.6vw,2rem)] flex flex-wrap gap-3">
          <Link href="/teams" className="nb-btn">
            Go to your team
          </Link>
          <Link href="/guides" className="nb-btn-ghost">
            Browse the curriculum
          </Link>
        </div>

        <div className="nb-rule mt-[clamp(1.8rem,3.6vw,2.6rem)] flex flex-wrap gap-x-[clamp(1.6rem,5vw,4rem)] gap-y-3 pt-[clamp(0.9rem,2vw,1.3rem)]">
          {TALLY.map((item) => (
            <p key={item.unit} className="nb-count">
              {item.n}
              <small>{item.unit}</small>
            </p>
          ))}
        </div>
      </section>

      {/* ===================== NO SETUP ===================== */}
      <section className="nb-wrap pb-[clamp(2.4rem,5vw,3.8rem)]">
        <div className="mb-[clamp(1.4rem,3vw,2.2rem)] max-w-[46rem]">
          <h2 className="max-w-[22ch]">
            There is no admin dashboard, because there is nothing to administer.
          </h2>
          <p className="nb-sub mt-3">
            No seats to buy, no invite codes to chase down, no roster to keep in
            a spreadsheet. Three things happen, and you only do the first one.
          </p>
        </div>

        <OnboardingStrip steps={STEPS} />

        <p className="nb-pen mt-[clamp(0.9rem,2vw,1.2rem)] max-w-[30ch] rotate-[-0.9deg]">
          tell them the number once at the first meeting
        </p>
      </section>

      {/* ===================== WHAT IT LOOKS LIKE =====================
          Two columns of different weights, not two matching cards: the offer is
          running text with rules between it, and the roster is a taped sheet.
          They are doing different jobs, so they are not drawn the same. */}
      <section className="nb-wrap nb-rule py-[clamp(2.4rem,5vw,3.8rem)]">
        <div className="grid items-start gap-[clamp(1.8rem,4vw,3.4rem)] min-[900px]:grid-cols-[minmax(0,1.25fr)_minmax(0,0.85fr)]">
          <div>
            <h2 className="max-w-[18ch]">What your team gets out of it.</h2>

            <dl className="mt-[clamp(1.2rem,2.6vw,1.8rem)]">
              {OFFER.map((item, i) => (
                <div
                  key={item.title}
                  className={
                    i === 0 ? "pb-5" : "nb-hair pb-5 pt-5 last:pb-0"
                  }
                >
                  <dt className="text-[clamp(1.1rem,0.98rem+0.5vw,1.35rem)] font-extrabold leading-[1.1] tracking-[-0.02em]">
                    {item.title}
                  </dt>
                  <dd className="mt-2 max-w-[56ch] text-[0.97rem] leading-[1.5] text-graphite">
                    {item.body}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <RosterSheet roster={SAMPLE_ROSTER} />
        </div>
      </section>

      {/* ===================== WHERE TO POINT ROOKIES ===================== */}
      {track.length > 0 && (
        <section className="nb-wrap nb-rule py-[clamp(2.4rem,5vw,3.8rem)]">
          <div className="mb-[clamp(1.4rem,3vw,2.1rem)] flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div>
              <h2 className="max-w-[19ch]">
                Hand a new member this list on day one.
              </h2>
              <p className="nb-sub mt-3">
                The first {track.length} departments, in catalogue order. It is
                the order that assumes nothing, so a rookie who works down it
                can be useful in the shop before they have picked a job.
              </p>
            </div>
            <p className="nb-pen max-w-[20ch] rotate-[1.3deg] min-[900px]:text-right">
              safety before anyone touches a tool
            </p>
          </div>

          <ol className="nb-box grid gap-x-[clamp(1.4rem,4vw,3rem)] p-[clamp(1.1rem,2.6vw,1.9rem)] min-[720px]:grid-cols-2">
            {track.map((dept, i) => (
              <li
                key={dept.slug}
                className={
                  // Two columns fill row-wise, so the second item is also on the
                  // top row and must not draw a rule above itself there either.
                  i === 0
                    ? ""
                    : i === 1
                      ? "border-t border-dashed border-rule min-[720px]:border-t-0"
                      : "border-t border-dashed border-rule"
                }
              >
                <Link
                  href={`/guides/${dept.slug}`}
                  className="group flex min-h-11 items-baseline gap-3.5 py-3"
                >
                  <span className="nb-slug shrink-0 font-bold text-blue">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold leading-snug decoration-blue decoration-2 underline-offset-4 group-hover:text-blue group-hover:underline">
                      {dept.name}
                    </span>
                    {dept.tagline && (
                      <span className="mt-0.5 block text-[0.88rem] leading-snug text-graphite">
                        {dept.tagline}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ===================== THE ASK =====================
          The one inverted surface on the page, spent on the single action a
          mentor has to take. Everything above it argues; this states the step. */}
      <section className="nb-slab py-[clamp(2.4rem,5vw,3.8rem)]">
        <div className="nb-wrap grid items-end gap-[clamp(1.4rem,3.5vw,3rem)] min-[900px]:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)]">
          <div>
            <h2 className="max-w-[17ch] text-[clamp(1.6rem,1.1rem+1.9vw,2.55rem)]">
              Add your team number, then tell everyone else to.
            </h2>
            <p className="mt-3 max-w-[42ch] text-[0.95rem] text-[rgba(245,246,242,0.85)]">
              That is the entire setup. Reading needs no account at all, so a
              rookie can start on the shop floor tonight and sign up later for
              the ticks and the certificate.
            </p>

            <div className="mt-[clamp(1.4rem,3vw,2rem)] flex flex-wrap gap-3">
              <Link
                href="/teams"
                className="nb-btn border-card bg-card text-blue"
              >
                Go to your team
              </Link>
              <Link
                href="/paths"
                className="nb-btn-ghost border-card text-card"
              >
                Pick a route for them
              </Link>
            </div>
          </div>

          {/* MOTION: the page's punchline, so it lands like ink on the figure
              rather than arriving already printed. */}
          <p className="nb-stamp">
            <Ink as="b" className="block">$0</Ink>
            <span>no seats, no upgrade, no ads</span>
          </p>
        </div>
      </section>
    </>
  );
}
