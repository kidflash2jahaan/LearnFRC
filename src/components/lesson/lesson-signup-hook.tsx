"use client";

import * as React from "react";
import Link from "next/link";
import { useMyProgress } from "@/components/progress/my-progress";
import { readGuestLessons, subscribeGuestProgress } from "@/lib/guest-progress";

/**
 * The stamped block: the one inverted surface on a lesson page.
 *
 * Everything from the masthead down to here is ink on newsprint. This is the
 * only thing printed the other way round, in solid ballpoint with the paper as
 * the type, which is why it can be the last block on the sheet and still be the
 * one a reader stops at. It is `nb-slab`, the system's single inverted surface,
 * and it is used exactly once per page.
 *
 * WHAT IT IS FOR: it is the primary logged-out conversion surface. Rendered
 * inside <MyProgressProvider>, it SSRs its cold-visitor variant (the store's
 * initial `authed` is false, so the ask is in the static HTML a crawler and a
 * logged-out visitor see) and unmounts itself once /api/me/progress confirms the
 * reader is signed in. Sitting near the end of the lesson keeps that brief
 * pre-hydration state off-screen for signed-in readers, so it never sticks.
 *
 * The ask branches on what the reader has actually done:
 *
 *   - Guest with completions in THIS department: "you've done N of M in
 *     {department}, take them with you". The strongest prospect there is,
 *     people who finish lessons without ever signing up.
 *   - Guest with completions elsewhere on LearnFRC: the same offer, without the
 *     department framing.
 *   - First-time reader: no account ask at all, just a pointer at the quiz.
 *     This is also the server-rendered variant, so the static HTML is honest for
 *     crawlers and nothing branches on client-only state at first paint.
 *
 * Guest completions live in localStorage (`lf_guest_lessons`, written by
 * <LessonComplete/>), so they can only be read after mount, and only once the
 * progress store has confirmed the reader is NOT signed in, so a signed-in
 * reader never sees a stale "claim your lessons" flash.
 *
 * Department name, lesson count, this lesson's 1-based position and the
 * department's lesson ids are computed server-side and passed in, so the copy is
 * contextual with zero extra fetching.
 */

/** What an account actually adds on top of guest reading. All four are real,
    shipped features. Nothing here is aspirational. */
const PERKS = [
  "Saved across every device",
  "XP and daily streaks",
  "Certificate on finish",
  "Leaderboard rank",
] as const;

/** The base award the on_lesson_completed trigger pays per migrated lesson. It
    can be higher (a streak bonus of up to +10), never lower, which is why the
    copy says "at least". */
const XP_PER_LESSON = 10;

type GuestCount = { total: number; inDept: number };
const NO_GUEST: GuestCount = { total: 0, inDept: 0 };

function countGuest(deptIds: Set<string>): GuestCount {
  const set = readGuestLessons();
  let inDept = 0;
  for (const id of set) if (deptIds.has(id)) inDept++;
  return { total: set.size, inDept };
}

/** Card stock at reduced strength, for the quiet type on the blue. Measured at
    5.8:1 against `--blue`, so it clears AA for body text. */
const QUIET = "text-[rgba(245,246,242,0.86)]";

export function LessonSignupHook({
  department,
  count,
  position,
  lessonPath,
  lessonIds,
}: {
  department: string;
  count: number;
  position: number;
  lessonPath: string;
  /** Every lesson id in this department, used to say "N of M in {dept}". */
  lessonIds: string[];
}) {
  const { authed, loaded } = useMyProgress();
  const [guest, setGuest] = React.useState<GuestCount>(NO_GUEST);

  const deptIds = React.useMemo(() => new Set(lessonIds), [lessonIds]);

  React.useEffect(() => {
    // Wait for the progress store: until it resolves we do not know whether
    // this is a guest, and reading the guest bucket for a signed-in reader
    // would flash the wrong ask.
    if (!loaded || authed) return;

    const read = () =>
      setGuest((prev) => {
        const next = countGuest(deptIds);
        return prev.total === next.total && prev.inDept === next.inDept
          ? prev
          : next;
      });
    read();

    // The guest store broadcasts on every write (this tab, another tab, or on
    // refocus), so finishing the lesson directly above this block upgrades the
    // ask immediately. It replaces a document-wide capture-phase click listener
    // that re-read localStorage after every click anywhere on the page; the
    // re-read still lands within 500ms of a real interaction, so any resulting
    // reflow stays excluded from CLS.
    return subscribeGuestProgress(read);
  }, [loaded, authed, deptIds]);

  if (authed) return null;

  const encoded = encodeURIComponent(lessonPath);
  const { total, inDept } = guest;
  const xp = total * XP_PER_LESSON;
  const them = total === 1 ? "it" : "them";
  const plural = total === 1 ? "" : "s";
  // "all 1 lesson" reads like a bug, so the singular gets its own phrasing.
  const theLessons = total === 1 ? "your lesson" : `all ${total} lessons`;

  let label: string;
  let headline: string;
  let body: string;
  let cta: string;

  // Both "has progress" branches are written around what an account ADDS, not
  // around what a browser might take away. The previous version led with "don't
  // lose them" and opened the body with "Clear your history, or open LearnFRC on
  // your build-season laptop, and it's gone": loss aversion aimed at teenagers,
  // over a threat the product itself creates. Every fact is still here (browser
  // storage, the XP floor, the preserved dates, certificates, leaderboard); the
  // sentence now ends in the benefit rather than in the loss.
  //
  // The label stays "saved in this browser only" on purpose. That is not a scare
  // line, it is the one piece of information a reader needs in order to judge
  // the offer at all, and dropping it would make the ask less honest, not kinder.
  if (inDept > 0) {
    label = "saved in this browser only";
    headline = `${inDept} of ${count} done in ${department}. Take that with you.`;
    body =
      `A free account gives the work a permanent home. It moves ` +
      `${theLessons} into a real profile with the dates you actually earned ` +
      `them, worth at least +${xp} XP, and from then on your progress follows ` +
      `you onto any device, counts toward the ${department} certificate, and ` +
      `puts you on the leaderboard. Reading stays free either way, and nothing ` +
      `here gets locked.`;
    cta = `Claim my ${total} lesson${plural}`;
  } else if (total > 0) {
    label = "saved in this browser only";
    headline = `${total} lesson${plural} finished without an account. Give that a permanent home.`;
    body =
      `A free account moves ${them} into a real profile with the dates you ` +
      `actually earned them, worth at least +${xp} XP, so your progress ` +
      `follows you onto any device, counts toward streaks and certificates, ` +
      `and puts you on the leaderboard. Reading stays free either way, and ` +
      `nothing here gets locked.`;
    cta = `Claim my ${total} lesson${plural}`;
  } else {
    // Nothing finished yet, so there is nothing to keep and no reason to ask.
    // This is also the server-rendered variant, the HTML a crawler and a cold
    // visitor get, so it says the true thing: the quiz below works right now,
    // signed in or not. The account ask arrives once they have earned
    // something, which is what the two branches above are for.
    label = "no account needed";
    headline = `Lesson ${position} of ${count} in ${department}. Finish it right here.`;
    body =
      `The quiz above is open to everyone. Pass it and this lesson is marked ` +
      `complete, saved in this browser, with no sign-up. Do a few and we'll ` +
      `offer you somewhere permanent to put them.`;
    cta = "Take the quiz";
  }

  const asked = total > 0;

  return (
    <aside
      aria-label={asked ? "Save your progress" : "Finish this lesson"}
      className="nb-slab mt-[clamp(2rem,4vw,3rem)] px-[clamp(1.1rem,3vw,2.2rem)] py-[clamp(1.5rem,3.4vw,2.4rem)]"
    >
      <p className={`nb-slug ${QUIET}`}>{label}</p>

      <h2 className="mt-2 max-w-[20ch] text-[clamp(1.35rem,1.1rem+1vw,2.05rem)] text-card">
        {headline}
      </h2>

      <p className={`mt-3 max-w-[54ch] text-[0.98rem] leading-relaxed ${QUIET}`}>
        {body}
      </p>

      {/* The account pitch only appears once there is progress an account would
          carry. Written out as a list rather than as chips: on the inverted
          surface a row of card-coloured pills would out-shout the one control
          that matters, which is the button below them. */}
      {asked && (
        <ul className="mt-4 grid max-w-[44ch] gap-1 font-mono text-[0.78rem] leading-relaxed sm:grid-cols-2">
          {PERKS.map((perk) => (
            <li key={perk} className={`flex gap-2 ${QUIET}`}>
              <span aria-hidden="true" className="font-bold text-card">
                -
              </span>
              {perk}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-[clamp(1.2rem,2.4vw,1.7rem)] flex flex-wrap items-center gap-x-5 gap-y-3">
        {/* The button inverts with the surface: paper fill, ballpoint type,
            the same ink drop it presses into everywhere else on the site. */}
        {asked ? (
          <Link
            href={`/signup?next=${encoded}&ref=lesson-hook`}
            className="nb-btn max-w-full border-card bg-card text-blue"
          >
            <span className="truncate">{cta}</span>
          </Link>
        ) : (
          // Every lesson carries a quiz, and <LessonComplete/> renders it with
          // id="lesson-quiz" whenever the lesson is not already done, which is
          // exactly the state this branch describes. A plain in-page anchor, so
          // it works before hydration and without JS.
          <a
            href="#lesson-quiz"
            className="nb-btn max-w-full border-card bg-card text-blue"
          >
            <span className="truncate">{cta}</span>
          </a>
        )}

        <span className={`text-[0.92rem] ${QUIET}`}>
          {asked ? "Already have an account? " : "Got an account? "}
          <Link
            href={`/login?next=${encoded}`}
            className="font-bold text-card underline decoration-[rgba(245,246,242,0.55)] decoration-2 underline-offset-4 hover:decoration-[var(--card)]"
          >
            Log in
          </Link>
          {!asked && (
            <>
              {" "}
              or{" "}
              <Link
                href={`/signup?next=${encoded}&ref=lesson-hook`}
                className="font-bold text-card underline decoration-[rgba(245,246,242,0.55)] decoration-2 underline-offset-4 hover:decoration-[var(--card)]"
              >
                create one free
              </Link>
            </>
          )}
        </span>
      </div>
    </aside>
  );
}
