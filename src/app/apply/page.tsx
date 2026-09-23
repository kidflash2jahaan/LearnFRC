import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getMyApplication } from "@/lib/admin-team";
import { teamRoleLabel } from "@/lib/team-roles";
import { ApplyForm } from "./_apply-form";
import { WithdrawForm } from "./_withdraw-form";

export const metadata: Metadata = {
  // `absolute` on purpose. The root template appends " · LearnFRC", and this
  // title already ends in the site's name, so the default would print it twice.
  title: { absolute: "Help run LearnFRC" },
  description:
    "Apply to help run LearnFRC: read the site's numbers, answer the feedback readers send in, review suggested edits, and mark a lesson verified once you've checked it. For anyone who has been on an FRC team and has a few hours a month.",
  alternates: { canonical: "/apply" },
};

/**
 * The way in, for somebody who wants to take a piece of running the site.
 *
 * WHY THE PAGE IS SHAPED LIKE THIS. Every other "join us" page on the internet
 * opens by selling the opportunity. This one opens by describing the work,
 * because the work is four unglamorous jobs and a person who finds that out
 * after being accepted is a person who quietly stops answering. So the order is
 * the order somebody actually decides in: what the job is, what it does not
 * come with, whether it is for them, and only then the form.
 *
 * ONE COLUMN, AND THE FORM IS RULED ONTO THE PAPER rather than boxed, the same
 * way /contact is. The form swaps itself for a taped receipt on success, and a
 * card appearing inside a card would read as a rendering fault. The single card
 * on the page is whichever state card the visit lands on, so a card always
 * means "here is where you stand", never "here is a section".
 *
 * NO `export const dynamic`. `getSession()` reads cookies, which makes this
 * route dynamic on its own, exactly as it does on /settings and /dashboard.
 * Declaring it again would only say the same thing in a second place.
 *
 * Server Component. The two forms are the client leaves, because both hold
 * state; nothing else here does.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * `2026-09-22T23:13:50Z` to `Sep 22, 2026`.
 *
 * UTC and table-driven for the same reason /admin's formatter is: this runs on
 * the server and the string is handed to the browser already made, so nothing
 * is recomputed on the client and hydration cannot disagree with it, and
 * `toLocaleDateString` returns different strings on different ICU builds.
 * The year is printed because an application can sit across a season boundary
 * and a bare "Sep 22" on a decision from last year reads as this week.
 */
function day(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** The four jobs, in the order they take up time. Slug left, the work right. */
const JOBS: { slug: string; text: string }[] = [
  {
    slug: "the feedback",
    text: "Every message sent through the contact form lands in one inbox. Most want a short, specific answer. Some are a real bug report and need chasing down before you can reply.",
  },
  {
    slug: "suggested edits",
    text: "Anyone with an account can rewrite the markdown of a lesson. Somebody has to read the change, check it against the source it touches, and either merge it or say plainly why not.",
  },
  {
    slug: "verifying lessons",
    text: "Lessons are drafted with AI help and checked by hand. Marking one verified means you read it against the documents it cites, found it held up, and put your account behind that.",
  },
  {
    slug: "the numbers",
    text: "The same admin page I read: signups, lessons finished, where readers arrive from, which pages get opened and which ones never do.",
  },
];

/**
 * The heading and the mono note over whichever block the visit lands on.
 *
 * Plain strings rather than JSX, so the apostrophe is the typographic one the
 * rest of the site uses rather than an HTML entity that would need escaping
 * around.
 */
const HEADS = {
  "signed-out": {
    title: "Applying needs an account",
    slug: "free, and it takes a minute",
  },
  "on-the-team": {
    title: "You’re already on the team",
    slug: "nothing to apply for",
  },
  pending: { title: "Your application", slug: "waiting on a decision" },
  "no-handle": {
    title: "Pick a handle first",
    slug: "one step, then the three questions",
  },
  again: { title: "Apply again", slug: "three questions, nothing else" },
  new: { title: "Apply", slug: "three questions, nothing else" },
} as const;

export default async function ApplyPage() {
  const { user, profile, isAdmin } = await getSession();
  // Only fetched when it can change what renders. An admin has nothing to
  // apply for, and a signed-out reader has no id to look one up by.
  const application = user && !isAdmin ? await getMyApplication(user.id) : null;

  // An accepted application whose account is no longer on the team is treated
  // as no application at all: they were removed, and the record of the old
  // acceptance is not an answer to "can I apply". Pending is the only status
  // that blocks a new one, and the server enforces that independently.
  const open = application?.status === "pending" ? application : null;
  const closed =
    application?.status === "rejected" || application?.status === "withdrawn"
      ? application
      : null;

  // A handle is the only thing on an application that identifies a person: the
  // reviewer gets that, a team number and the role they picked, and nothing
  // else. Without one the entry lands on the desk reading "no username yet",
  // so the page asks for it before the form rather than warning about it
  // beside a live Send button. Doing it here rather than inside the form also
  // means there is no half-written draft to lose on the trip to /settings.
  const handle = profile?.username ?? null;
  const needsHandle = !!user && !isAdmin && !open && !handle;

  const mode = !user
    ? "signed-out"
    : isAdmin
      ? "on-the-team"
      : open
        ? "pending"
        : needsHandle
          ? "no-handle"
          : closed
            ? "again"
            : "new";
  const head = HEADS[mode];

  return (
    <div className="nb-wrap max-w-[52rem] py-[clamp(2.2rem,5vw,3.8rem)]">
      <header>
        <p className="nb-marker">apply / the admin team</p>
        <h1 className="text-[clamp(2.2rem,1.2rem+3.4vw,3.4rem)]">
          Help <span className="nb-mark">run</span> LearnFRC.
        </h1>
        <p className="nb-lede mt-5">
          One person writes the lessons here, and the same person answers
          everything that comes back. The second half is the part I want help
          with. If you&rsquo;ve been on an FRC team, you can take a piece of it.
        </p>
        <p className="nb-pen mt-5 max-w-[27ch] rotate-[-1.1deg]">
          most of it is reading what people send in
        </p>
      </header>

      {/* ---- the work ----------------------------------------------------
          A ruled ledger, not four tiles. Each row is a job and what that job
          actually involves, which is a two-part shape, and a dashed rule
          between them carries it better than a border drawn all the way
          around each one. Four equal cards would also say these are four
          choices, and they are not: they are the whole of the work. */}
      <section
        aria-labelledby="job"
        className="mt-[clamp(2rem,4vw,3rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="job" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
            What an admin does
          </h2>
          <p className="nb-slug">four jobs, and that is the list</p>
        </div>

        <dl className="mt-5">
          {JOBS.map((j) => (
            <div
              key={j.slug}
              className="grid gap-x-[clamp(1rem,3vw,2.4rem)] gap-y-1 border-t border-dashed border-rule py-4 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]"
            >
              <dt className="nb-slug font-bold text-ink">{j.slug}</dt>
              <dd className="text-[0.99rem] leading-relaxed text-graphite">
                {j.text}
              </dd>
            </div>
          ))}
        </dl>

        {/* The limits, said out loud here rather than discovered after being
            accepted. The page's one standing aside, so it gets the callout
            frame; the only other note that can appear is a reviewer's own
            words on a refused application, which is quoted material. */}
        <div className="nb-note mt-[clamp(1.4rem,3vw,2rem)] max-w-[70ch]">
          <p className="nb-slug">what the job does not come with</p>
          {/* `.nb-prose` rather than a hand-built list: the system already
              draws a `-` marker in blue on `ul > li`, and inventing a local
              one would be a second way to write the same bullet. */}
          <div className="nb-prose mt-2.5">
            <ul>
              {/* Not "a handle and a team number, and that is the whole of
                  it": the review desk also prints the FRC role the applicant
                  picked and everything they wrote, which the record strip
                  further down this page correctly lists. An exhaustive claim
                  that the next section disproves is worse than no claim. */}
              <li>
                No real names. Everyone in the panel is a handle and a team
                number. An application adds the FRC role they picked and what
                they wrote in the three boxes, and that is the end of it.
              </li>
              <li>
                No email addresses. Replies leave through the site, so you
                answer somebody without ever seeing where the answer goes.
              </li>
              <li>
                No new editing rights. Reviewing an edit is not writing one. You
                can merge somebody else&rsquo;s change and mark a lesson
                verified, and you can suggest an edit exactly like any other
                account can.
              </li>
            </ul>
            <p className="text-[0.95rem] text-graphite">
              That is deliberate, and it is not loosening later. Nobody needs a
              stranger&rsquo;s legal name to answer a question about swerve.
            </p>
          </div>
        </div>
      </section>

      {/* ---- who it suits -------------------------------------------------
          Plain prose. A reader who got this far is reading rather than
          scanning, and boxing this would only put a border between them and
          the one paragraph that decides it. */}
      <section
        aria-labelledby="who"
        className="mt-[clamp(2.4rem,5vw,3.6rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
      >
        <h2 id="who" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
          Who this suits
        </h2>
        <div className="mt-4 flex max-w-[64ch] flex-col gap-4 text-[0.99rem] leading-relaxed text-graphite">
          <p>
            Somebody who has actually been on an FRC team. Student, mentor,
            alum, coach, it makes no difference which. The job is judging
            whether an answer about a gearbox or a CAN bus or a scouting app is
            right, and that comes from having done it, not from reading about
            it.
          </p>
          <p>
            A few hours a month is enough, and there are quiet weeks. It is
            unpaid. Nothing on this site makes money, so there is nothing to pay
            anyone out of. What you get instead is a say in what a free
            curriculum tells the next rookie who finds it.
          </p>
        </div>
      </section>

      {/* ---- where you stand ---------------------------------------------
          One section, five states. The form is ruled onto the paper; the
          states that have no form get the page's one card instead. */}
      <section
        aria-labelledby="apply"
        className="mt-[clamp(2.4rem,5vw,3.6rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="apply" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
            {head.title}
          </h2>
          <p className="nb-slug">{head.slug}</p>
        </div>

        {mode === "signed-out" && (
          <div className="nb-box nb-tilt-2 mt-6 p-[clamp(1.1rem,2.6vw,1.8rem)]">
            <span
              className="nb-tape -top-3 left-[16%] rotate-[-3.2deg]"
              aria-hidden="true"
            />
            <p className="nb-slug">sign in first</p>
            {/* No claim about what else on the site needs an account. Nine
                routes redirect to /login and /about names three reasons to
                have one, so "the two things that do" was a sentence the rest
                of the site disproves. */}
            <p className="mt-3 max-w-[58ch] text-[0.99rem] leading-relaxed">
              An application arrives as a handle and a team number, so it has to
              be attached to an account. Reading LearnFRC never needs one. An
              account is free and takes a minute.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
              <Link href="/login?next=/apply" className="nb-btn">
                Sign in and apply
              </Link>
              <span className="nb-hint">
                No account yet?{" "}
                <Link href="/signup?next=/apply" className="nb-link">
                  Make one
                </Link>
                , it&rsquo;s free and it comes straight back here.
              </span>
            </div>
          </div>
        )}

        {mode === "on-the-team" && (
          <div className="nb-box nb-tilt-1 mt-6 p-[clamp(1.1rem,2.6vw,1.8rem)]">
            <span
              className="nb-tape -top-3 left-[22%] rotate-[-2.6deg]"
              aria-hidden="true"
            />
            <p className="nb-slug">you already have the keys</p>
            <p className="mt-3 max-w-[58ch] text-[0.99rem] leading-relaxed">
              This account can open the admin panel, answer the feedback readers
              send in, review suggested edits and mark a lesson verified. There
              is nothing here left to apply for.
            </p>
            <Link href="/admin" className="nb-btn mt-6">
              Open the admin panel
            </Link>
          </div>
        )}

        {mode === "pending" && open && (
          <>
            <div className="nb-box nb-tilt-3 mt-6 p-[clamp(1.1rem,2.6vw,1.8rem)]">
              <span
                className="nb-tape -top-3 left-[12%] rotate-[-3.6deg]"
                aria-hidden="true"
              />
              <span
                className="nb-tape -bottom-3 right-[18%] rotate-[2.4deg]"
                aria-hidden="true"
              />
              <p className="nb-slug">sent {day(open.createdAt) ?? "recently"}</p>
              <p className="mt-3 font-semibold">
                It&rsquo;s on the desk, waiting to be read.
              </p>
              <p className="mt-2 max-w-[58ch] text-[0.99rem] leading-relaxed text-graphite">
                Nothing else is needed from you, and there is no second step.
                You&rsquo;ll get an email either way, and this page says where it
                stands until then.
              </p>
              <WithdrawForm />
            </div>
            <p className="nb-hint mt-4 max-w-[58ch]">
              One open application at a time. Withdrawing closes this one, and
              you can send a new one straight after.
            </p>
          </>
        )}

        {mode === "no-handle" && (
          <div className="nb-box nb-tilt-2 mt-6 p-[clamp(1.1rem,2.6vw,1.8rem)]">
            <span
              className="nb-tape -top-3 left-[20%] rotate-[-2.9deg]"
              aria-hidden="true"
            />
            <p className="nb-slug">one field on your settings page</p>
            {/* The whole state, not a warning printed beside a live form. The
                reviewer only ever sees a handle and a team number, so an
                application without a handle arrives with nothing on it to
                identify anybody. Asking here also means there is no
                half-written draft to lose on the trip to /settings. */}
            <p className="mt-3 max-w-[58ch] text-[0.99rem] leading-relaxed">
              A handle is the only thing on an application that says who sent
              it. Without one, yours lands on the desk as a team number and
              nothing else. Pick one, then come back and the three questions
              are right here.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
              <Link href="/settings" className="nb-btn">
                Pick a handle
              </Link>
              <span className="nb-hint">
                Your team number lives on the same page, and it&rsquo;s worth
                setting while you&rsquo;re there.
              </span>
            </div>
          </div>
        )}

        {(mode === "again" || mode === "new") && handle && (
          <>
            {closed && (
              <div className="mt-6">
                <p className="nb-slug">
                  {closed.status === "withdrawn"
                    ? `withdrawn ${day(closed.reviewedAt) ?? "earlier"}`
                    : `turned down ${day(closed.reviewedAt) ?? "earlier"}`}
                </p>
                <p className="mt-2 max-w-[60ch] text-[0.99rem] leading-relaxed">
                  {closed.status === "withdrawn"
                    ? "You pulled that one back before it was decided. You can send another whenever you like."
                    : "That one was turned down, which is not a permanent answer. If something has changed since, say so in the first box."}
                </p>
                {closed.reviewNote && (
                  <div className="nb-note mt-4 max-w-[64ch]">
                    <p className="nb-slug">what the reviewer wrote back</p>
                    <p className="mt-2 text-[0.95rem] leading-relaxed whitespace-pre-line">
                      {closed.reviewNote}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* `handle &&` above is how the type system sees what `mode`
                already guarantees: "again" and "new" are only reachable once
                `needsHandle` is false, which is exactly when a handle exists. */}
            <div className="mt-6">
              <ApplyForm
                username={handle}
                teamNumber={profile?.team_number ?? null}
                // The word, not the stored slug. `profiles.role` holds
                // `other` for a fifth of accounts, and a strip that claims to
                // be the whole record cannot print a value nobody would use
                // about themselves. The desk and the owner's email read the
                // same table.
                teamRole={profile?.role ? teamRoleLabel(profile.role) : null}
                again={!!closed}
              />
            </div>
          </>
        )}
      </section>

      <p className="nb-hint mt-[clamp(2.4rem,5vw,3.4rem)] max-w-[68ch]">
        Not looking to help run it, just want to tell me something is wrong? The{" "}
        <Link href="/contact" className="nb-link">
          contact form
        </Link>{" "}
        is the shorter path and needs no account at all. Every change anyone has
        suggested is public on the{" "}
        <Link href="/contributions" className="nb-link">
          contributions page
        </Link>
        .
      </p>
    </div>
  );
}
