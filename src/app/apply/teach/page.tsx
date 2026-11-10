import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PUBLIC_CONTACT_EMAIL } from "@/lib/email";
import { classesVisible } from "@/lib/classes/config";
import { CLASS_LIMITS } from "@/lib/classes/constants";
import { COORDINATOR } from "@/lib/classes/coordinator";
import { TEACHER_CODE } from "@/lib/classes/notice";
import { canApplyIn, type TeachApplyMode } from "@/lib/classes/teacher-rules";
import { teachDraftKey } from "@/lib/classes/teach-draft";
import { loadTeachApplyState, type TeachApplyState } from "@/lib/app/class-teachers";
import { scheduleTopicOptions } from "@/lib/app/classes-teaching";
import { TeachForm } from "./_teach-form";
import { DropTeachDraft } from "./_drop-draft";
import { WithdrawTeachForm } from "./_withdraw-form";
import { CodeAgreeForm } from "./_code-form";

export const metadata: Metadata = {
  title: "Teach a live class",
  description:
    "Experienced FRC students teach short, free live classes on LearnFRC lessons to other FRC students. Every class is recorded on video and reviewed. Apply to teach.",
  alternates: { canonical: "/apply/teach" },
};

// Per viewer, and a 404 while classes are hidden: never prerendered, so the
// hidden 404 can't outlive the switch being turned on.
export const dynamic = "force-dynamic";

/**
 * Applying to teach live classes (classes-design.md sections 2, 3.1 and 11).
 *
 * Hidden (404) until live classes are visible: both switches (section 1).
 *
 * What the role is, what it needs, then where you stand. Teaching is the
 * only role LearnFRC takes applications for (/apply sends people here while
 * classes are visible). Where you stand comes from loadTeachApplyState
 * (src/lib/app/class-teachers.ts), the same answer the app's
 * GET /api/app/apply gives in `roles`.
 *
 * Ages: the age question lives at /classes/ready and stays neutral, so this
 * page doesn't print the age range (or the code, whose first line states it)
 * to anyone who hasn't answered it yet. Once the answer is stored, the
 * requirements say 13 to 17 plainly.
 *
 * Teachers need at least one full FRC season (FULL_SEASON_SENTENCE in
 * src/lib/classes/teacher-rules.ts): the form asks it first, and the server
 * refuses without it.
 *
 * Nothing here promises that an adult sits in on a first class. Every class,
 * the first included, is recorded on video and reviewed afterwards.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-09-22T23:13:50Z` to `Sep 22, 2026`, in UTC, as /apply does. */
function day(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

const HEADS: Record<TeachApplyMode, { title: string; slug: string }> = {
  hidden: { title: "Not open yet", slug: "check back soon" },
  "signed-out": { title: "Applying needs an account", slug: "free, and it takes a minute" },
  "no-handle": { title: "Pick a username first", slug: "one field on your settings page" },
  "needs-age": { title: "One quick question first", slug: "asked once" },
  "device-blocked": { title: "Not available here", slug: "live classes" },
  adult: { title: "Live classes are for students", slug: "lessons are all still yours" },
  "parent-declined": { title: "Your parent or guardian said no", slug: "live classes" },
  suspended: { title: "Your teaching is paused", slug: "nothing to apply for" },
  "code-outdated": { title: "The teacher code changed", slug: "agree again to keep teaching" },
  teacher: { title: "You’re a teacher", slug: "nothing to apply for" },
  pending: { title: "Your application", slug: "waiting on a decision" },
  again: { title: "Apply again", slug: "about 30 to 45 minutes, saves as you go" },
  new: { title: "Apply", slug: "about 30 to 45 minutes, saves as you go" },
};

/** One state card: tape, slug, a sentence or two, and its controls. */
function StateCard({
  slug,
  tilt = "nb-tilt-2",
  children,
}: {
  slug: string;
  tilt?: string;
  children: ReactNode;
}) {
  return (
    <div className={`nb-box ${tilt} mt-6 p-[clamp(1.1rem,2.6vw,1.8rem)]`}>
      <span className="nb-tape -top-3 left-[18%] rotate-[-3deg]" aria-hidden="true" />
      <p className="nb-slug">{slug}</p>
      {children}
    </div>
  );
}

const body = "mt-3 max-w-[58ch] text-[0.99rem] leading-relaxed";

/**
 * Modes where this account's draft has no use: sent (from this device or
 * another), already teaching, or unable to apply. The page deletes the draft
 * on this device when it shows one of them.
 */
const NO_DRAFT_MODES: TeachApplyMode[] = ["pending", "teacher", "code-outdated", "suspended", "adult", "parent-declined"];

/** What still stands between an applicant or teacher and their first class. */
function BeforeYouSchedule({ state }: { state: TeachApplyState }) {
  const items: ReactNode[] = [];
  if (state.parentStep === "not_asked" || state.parentStep === "waiting") {
    items.push(
      <li key="parent">
        A parent or guardian says OK once, by email.{" "}
        {state.parentStep === "waiting" ? (
          "You've asked; it's waiting on their answer."
        ) : (
          <Link href="/classes/ready" className="nb-link">
            Ask them
          </Link>
        )}
      </li>
    );
  }
  if (state.parentStep === "declined") {
    items.push(
      <li key="declined">
        Your parent or guardian didn&rsquo;t OK live classes, so you can&rsquo;t schedule one. If that&rsquo;s
        changed, write to{" "}
        <a href={`mailto:${PUBLIC_CONTACT_EMAIL}`} className="nb-link">
          {PUBLIC_CONTACT_EMAIL}
        </a>
        .
      </li>
    );
  }
  if (state.bioHasContact) {
    items.push(
      <li key="bio">
        Your profile bio has contact details in it. Take them out on your{" "}
        <Link href="/settings" className="nb-link">
          settings page
        </Link>
        , since everyone in a class can open your profile.
      </li>
    );
  }
  if (items.length === 0) return null;
  return (
    <div className="nb-note mt-5 max-w-[64ch]">
      <p className="nb-slug">before you can schedule a class</p>
      <div className="nb-prose mt-2.5">
        <ul>{items}</ul>
      </div>
    </div>
  );
}

export default async function TeachApplyPage() {
  if (!(await classesVisible())) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const state = await loadTeachApplyState(user);
  if (state.mode === "hidden") notFound();

  const mode = state.mode;
  const head = HEADS[mode];
  // The age range and the code are printed only once the age is known.
  const ageKnown = state.ageBand !== null;
  // Modules and their lessons, for the module picker and the sample lesson.
  const groups = canApplyIn(mode) ? await scheduleTopicOptions() : [];
  const closed =
    state.application?.status === "rejected" || state.application?.status === "withdrawn"
      ? state.application
      : null;

  return (
    <div className="nb-wrap max-w-[52rem] py-[clamp(2.2rem,5vw,3.8rem)]">
      <header>
        <p className="nb-marker">apply / teach</p>
        <h1 className="text-[clamp(2.2rem,1.2rem+3.4vw,3.4rem)]">
          Teach a <span className="nb-mark">live</span> class.
        </h1>
        <p className="nb-lede mt-5">
          Experienced FRC students teach short live classes on LearnFRC lessons, to other FRC students. It&rsquo;s free
          for everyone, it runs on learnfrc.com, and every class is recorded on video and reviewed
          afterwards.
        </p>
        <p className="nb-pen mt-5 max-w-[27ch] rotate-[-1.1deg]">teach the thing you just figured out</p>
      </header>

      <section
        aria-labelledby="what"
        className="mt-[clamp(2rem,4vw,3rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
      >
        <h2 id="what" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
          What teachers do
        </h2>
        <dl className="mt-5">
          {[
            {
              slug: "pick a topic",
              text: `Schedule a class on a LearnFRC lesson or module you know well: ${CLASS_LIMITS.minDurationMinutes} to ${CLASS_LIMITS.maxDurationMinutes} minutes, up to ${CLASS_LIMITS.maxCapacity} students, 2 hours to ${CLASS_LIMITS.scheduleMaxAheadDays} days ahead.`,
            },
            {
              slug: "teach it live",
              text: "Classes run in LearnFRC’s own video rooms on learnfrc.com. Your camera is optional, and students’ cameras stay off. You can mute anyone, and remove anyone who breaks the rules.",
            },
            {
              slug: "keep it in the class",
              text: "Everyone in a class sees each other’s LearnFRC usernames. There’s no private messaging, and the class chat won’t send links outside LearnFRC and the docs, @handles, emails, phone numbers or other apps’ usernames. That includes your messages.",
            },
            {
              slug: "after the class",
              text: `Every class, your first one included, is recorded on video and transcribed, and LearnFRC reviews it. Classes LearnFRC approves count toward an hours letter signed by ${COORDINATOR.name}, our volunteer coordinator.`,
            },
          ].map((j) => (
            <div
              key={j.slug}
              className="grid gap-x-[clamp(1rem,3vw,2.4rem)] gap-y-1 border-t border-dashed border-rule py-4 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]"
            >
              <dt className="nb-slug font-bold text-ink">{j.slug}</dt>
              <dd className="text-[0.99rem] leading-relaxed text-graphite">{j.text}</dd>
            </div>
          ))}
        </dl>

        <div className="nb-note mt-[clamp(1.4rem,3vw,2rem)] max-w-[70ch]">
          <p className="nb-slug">hours, honestly</p>
          <p className="mt-2 text-[0.97rem] leading-relaxed">
            Check your school&rsquo;s rules first. Some schools don&rsquo;t count online service, some need a
            registered nonprofit, and some want an adult present at every session. LearnFRC is an
            independent, student-run project, not a registered nonprofit, and an adult isn&rsquo;t present at
            every class. Misreporting hours means removal from teaching and withdrawn letters.
          </p>
        </div>
      </section>

      <section
        aria-labelledby="need"
        className="mt-[clamp(2.4rem,5vw,3.6rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
      >
        <h2 id="need" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
          What you need
        </h2>
        <div className="nb-prose mt-4 max-w-[64ch]">
          <ul>
            <li>A LearnFRC account with a username.</li>
            <li>
              At least one full FRC season: a build season and at least one official event. FTC or FLL
              experience is welcome, but it doesn&rsquo;t count on its own.
            </li>
            <li>
              {ageKnown
                ? "To be 13 to 17. Live classes are for students, teachers included."
                : "To answer one quick question about your age. We ask once."}
            </li>
            <li>
              A parent or guardian&rsquo;s OK, once, by email. You can apply before they answer; you can&rsquo;t
              schedule a class until they say OK.
            </li>
            <li>To agree to the teacher code{ageKnown ? ", below" : ""}.</li>
            <li>About 30 to 45 minutes for the application. It saves on this device as you go.</li>
          </ul>
        </div>
      </section>

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
          <StateCard slug="sign in first">
            <p className={body}>
              An application is tied to your LearnFRC account and your username. An account is free and
              takes a minute.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
              <Link href="/login?next=/apply/teach" className="nb-btn">
                Sign in and apply
              </Link>
              <span className="nb-hint">
                No account yet?{" "}
                <Link href="/signup?next=/apply/teach" className="nb-link">
                  Make one
                </Link>
                , it&rsquo;s free and it comes straight back here.
              </span>
            </div>
          </StateCard>
        )}

        {mode === "no-handle" && (
          <StateCard slug="one field on your settings page">
            <p className={body}>
              Everyone in a class sees your username, and it&rsquo;s how the reviewer knows who applied. Pick
              one, then come back here.
            </p>
            <Link href="/settings" className="nb-btn mt-6">
              Pick a username
            </Link>
          </StateCard>
        )}

        {mode === "needs-age" && (
          <StateCard slug="why we ask">
            <p className={body}>
              Before you apply, answer one quick question. We ask once, so we know whether a parent or
              guardian needs to say OK.
            </p>
            <Link href="/classes/ready?next=/apply/teach" className="nb-btn mt-6">
              Answer it
            </Link>
          </StateCard>
        )}

        {mode === "device-blocked" && (
          <StateCard slug="live classes">
            <p className={body}>
              Live classes aren&rsquo;t available on this device. If that&rsquo;s a mistake, a parent or guardian
              can write to{" "}
              <a href={`mailto:${PUBLIC_CONTACT_EMAIL}`} className="nb-link">
                {PUBLIC_CONTACT_EMAIL}
              </a>
              .
            </p>
          </StateCard>
        )}

        {mode === "adult" && (
          <StateCard slug="live classes">
            <p className={body}>
              Live classes are for students 13 to 17, teachers included. Lessons are all still yours.
            </p>
          </StateCard>
        )}

        {mode === "parent-declined" && (
          <StateCard slug="live classes">
            <p className={body}>
              Your parent or guardian didn&rsquo;t OK live classes, so you can&rsquo;t apply to teach. If
              that&rsquo;s changed, write to{" "}
              <a href={`mailto:${PUBLIC_CONTACT_EMAIL}`} className="nb-link">
                {PUBLIC_CONTACT_EMAIL}
              </a>
              .
            </p>
          </StateCard>
        )}

        {mode === "suspended" && (
          <StateCard slug="teaching / paused">
            <p className={body}>
              Your teaching on LearnFRC is paused, and your upcoming classes were canceled. Your account and
              your lessons aren&rsquo;t affected. If you have questions, write to{" "}
              <a href={`mailto:${PUBLIC_CONTACT_EMAIL}`} className="nb-link">
                {PUBLIC_CONTACT_EMAIL}
              </a>
              .
            </p>
          </StateCard>
        )}

        {mode === "code-outdated" && state.teacher && (
          <StateCard slug="teacher code / new version" tilt="nb-tilt-1">
            <p className={body}>
              The teacher code changed since you agreed to it. Read it and agree again before you schedule
              your next class.
            </p>
            <CodeAgreeForm codeVersion={state.codeVersion} />
          </StateCard>
        )}

        {mode === "teacher" && state.teacher && (
          <>
            <StateCard slug={`teacher since ${day(state.teacher.since) ?? "recently"}`} tilt="nb-tilt-1">
              <p className={body}>
                You can schedule classes from your teaching page. Pick a lesson or module, a time and how many
                seats.
              </p>
              <div className="nb-hair mt-5 pt-4">
                <p className="nb-slug">name on your hours letters</p>
                <p className="mt-1.5 text-[1.05rem] font-bold">{state.teacher.letterName}</p>
                <p className="nb-hint mt-1.5 max-w-[56ch]">
                  It&rsquo;s locked, so it reads the same on every letter. Wrong? Write to{" "}
                  <a href={`mailto:${PUBLIC_CONTACT_EMAIL}`} className="nb-link">
                    {PUBLIC_CONTACT_EMAIL}
                  </a>
                  .
                </p>
              </div>
              <Link href="/classes/teaching" className="nb-btn mt-6">
                Open your teaching page
              </Link>
            </StateCard>
            <BeforeYouSchedule state={state} />
          </>
        )}

        {mode === "pending" && state.application && (
          <>
            <StateCard slug={`sent ${day(state.application.createdAt) ?? "recently"}`} tilt="nb-tilt-3">
              <p className="mt-3 font-semibold">It&rsquo;s on the desk, waiting to be read.</p>
              <p className="mt-2 max-w-[58ch] text-[0.99rem] leading-relaxed text-graphite">
                You&rsquo;ll get an email either way, and this page says where it stands until then.
              </p>
              <WithdrawTeachForm />
            </StateCard>
            <BeforeYouSchedule state={state} />
          </>
        )}

        {canApplyIn(mode) && state.username && (
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
                    : state.previousAnswers
                      ? "That one was turned down, which isn’t a permanent answer. Your last answers are filled in below. Read what the reviewer wrote, change what needs changing, and send it again."
                      : "That one was turned down, which isn’t a permanent answer. Read what the reviewer wrote, change what needs changing, and send it again."}
                </p>
                {closed.reviewNote && (
                  <div className="nb-note mt-4 max-w-[64ch]">
                    <p className="nb-slug">what the reviewer wrote back</p>
                    <p className="mt-2 whitespace-pre-line text-[0.95rem] leading-relaxed">{closed.reviewNote}</p>
                  </div>
                )}
              </div>
            )}
            <BeforeYouSchedule state={state} />
            <div className="mt-6">
              <TeachForm
                username={state.username}
                teamNumber={state.teamNumber}
                teamRole={state.teamRoleLabel}
                again={!!closed}
                groups={groups}
                codeVersion={state.codeVersion}
                draftKey={teachDraftKey(user?.id ?? "")}
                previous={state.previousAnswers}
                thisYear={new Date().getUTCFullYear()}
              />
            </div>
          </>
        )}
        {user && NO_DRAFT_MODES.includes(mode) ? <DropTeachDraft userId={user.id} /> : null}
      </section>

      {ageKnown && !canApplyIn(mode) && mode !== "code-outdated" ? (
        <section
          aria-labelledby="code"
          className="mt-[clamp(2.4rem,5vw,3.6rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
        >
          <h2 id="code" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
            The teacher code
          </h2>
          <div className="nb-prose mt-4 max-w-[64ch]">
            <ul>
              {TEACHER_CODE.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <p className="nb-hint mt-[clamp(2.4rem,5vw,3.4rem)] max-w-[68ch]">
        Just want to take a class? See{" "}
        <Link href="/classes" className="nb-link">
          live classes
        </Link>
        . Questions about teaching go to{" "}
        <a href={`mailto:${PUBLIC_CONTACT_EMAIL}`} className="nb-link">
          {PUBLIC_CONTACT_EMAIL}
        </a>
        .
      </p>
    </div>
  );
}
