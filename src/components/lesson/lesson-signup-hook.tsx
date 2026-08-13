"use client";

import type { CSSProperties } from "react";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, Cloud, Medal, Trophy, Zap } from "lucide-react";
import { Reveal } from "@/components/motion/primitives";
import { useMyProgress } from "@/components/progress/my-progress";
import { readGuestLessons, subscribeGuestProgress } from "@/lib/guest-progress";

const GRADIENT_TEXT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

/** What an account actually adds on top of guest reading. All four are real
    features (device sync, XP/streaks, per-department certificates, leaderboard)
    — nothing here is aspirational. */
const PERKS = [
  { icon: Cloud, label: "Saved across every device" },
  { icon: Zap, label: "XP + daily streaks" },
  { icon: Trophy, label: "Certificate on finish" },
  { icon: Medal, label: "Leaderboard rank" },
] as const;

/** The base award the on_lesson_completed trigger pays per migrated lesson.
    It can be higher (there is a streak bonus of up to +10), never lower — so
    the figure this component quotes is a floor the reader is guaranteed, which
    is why the copy says "at least". */
const XP_PER_LESSON = 10;

type GuestCount = { total: number; inDept: number };
const NO_GUEST: GuestCount = { total: 0, inDept: 0 };

function countGuest(deptIds: Set<string>): GuestCount {
  const set = readGuestLessons();
  let inDept = 0;
  for (const id of set) if (deptIds.has(id)) inDept++;
  return { total: set.size, inDept };
}

/**
 * The primary logged-out conversion surface on a lesson page. Rendered inside
 * <MyProgressProvider>; it SSRs its card (the store's initial `authed` is false,
 * so the ask is present in the static HTML a crawler / logged-out visitor sees)
 * and unmounts itself once /api/me/progress confirms the reader is signed in —
 * exactly like the existing <SignupPrompt> in the hero. Placement near the end
 * of the lesson keeps the brief pre-hydration state off-screen for signed-in
 * readers, so it never sticks.
 *
 * The ask branches on what the reader has actually done, the way the article
 * hook branches on topic:
 *
 *   - Guest with completions in THIS department → "you've done N of M in
 *     {department}, claim them" (the strongest prospect we have: people who
 *     finish lessons without ever signing up).
 *   - Guest with completions elsewhere on LearnFRC → the same claim, without
 *     the department framing.
 *   - First-time reader → a lighter "here's what an account adds" ask. This is
 *     also the server-rendered variant, so the static HTML is honest for
 *     crawlers and there is no hydration branch on client-only state.
 *
 * Guest completions live in localStorage (`lf_guest_lessons`, written by
 * <LessonComplete/>), so they can only be read after mount — and only once the
 * progress store has confirmed the reader is NOT signed in, so a signed-in
 * reader never sees a stale "claim your lessons" flash.
 *
 * Department name, lesson count, this lesson's 1-based position, and the
 * department's lesson ids are computed server-side and passed as props so the
 * copy is contextual with zero extra fetching.
 */
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
  /** Every lesson id in this department — used to say "N of M in {dept}". */
  lessonIds: string[];
}) {
  const { authed, loaded } = useMyProgress();
  const [guest, setGuest] = React.useState<GuestCount>(NO_GUEST);

  const deptIds = React.useMemo(() => new Set(lessonIds), [lessonIds]);

  React.useEffect(() => {
    // Wait for the progress store: until it resolves we don't know whether this
    // is a guest, and reading the guest bucket for a signed-in reader would
    // flash the wrong ask.
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
    // refocus), so finishing the lesson directly above this card upgrades the
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

  let eyebrow: string;
  let headline: [string, string];
  let body: string;
  let cta: string;

  // Both "has progress" branches are written around what an account ADDS, not
  // around what a browser might take away. The previous version led in
  // emphasised type with "don't lose them" and opened the body with "Clear your
  // history, or open LearnFRC on your build-season laptop, and it's gone" —
  // loss aversion aimed at teenagers, and a threat the product itself creates.
  // Every fact below is still here (browser-only storage, the XP floor, the
  // preserved dates, certificates, leaderboard); what changed is that the
  // sentence now ends in the benefit rather than the loss.
  //
  // The eyebrow stays "Saved in this browser only" on purpose. That is not a
  // scare line, it is the one piece of information a reader needs in order to
  // judge the offer at all, and removing it would make the ask less honest
  // rather than kinder.
  if (inDept > 0) {
    eyebrow = "Saved in this browser only";
    headline = [
      `${inDept} of ${count} lessons done in ${department}.`,
      `Take your progress with you.`,
    ];
    body =
      `A free account gives that work a permanent home: it moves ` +
      `${theLessons} into a real profile with the dates you actually earned ` +
      `them, worth at least +${xp} XP, and from then on your progress ` +
      `follows you onto any device, counts toward the ${department} ` +
      `certificate, and puts you on the leaderboard. Reading stays free ` +
      `either way; nothing here gets locked.`;
    cta = `Claim my ${total} lesson${plural}`;
  } else if (total > 0) {
    eyebrow = "Saved in this browser only";
    headline = [
      `${total} lesson${plural} finished without an account.`,
      `Give your progress a permanent home.`,
    ];
    body =
      `A free account moves ${them} into a real profile with the dates you ` +
      `actually earned them, worth at least +${xp} XP, so your progress ` +
      `follows you onto any device, counts toward streaks and certificates, ` +
      `and puts you on the leaderboard. Reading stays free either way; ` +
      `nothing here gets locked.`;
    cta = `Claim my ${total} lesson${plural}`;
  } else {
    // Nothing finished yet, so there is nothing to lose and no reason to ask.
    // This is also the server-rendered variant — the HTML a crawler and a cold
    // visitor get — so it says the true thing: the quiz below works right now,
    // signed in or not. The account ask arrives once they've earned something,
    // which is what the two branches above are for.
    eyebrow = "No account needed";
    headline = [
      `Lesson ${position} of ${count} in ${department}.`,
      `Finish it right here.`,
    ];
    body =
      `The quiz above is open to everyone: pass it and this lesson is marked ` +
      `complete, saved in this browser, no sign-up. Do a few and we'll offer ` +
      `you somewhere permanent to put them.`;
    cta = "Take the quiz";
  }

  const asked = total > 0;

  return (
    <Reveal>
      <aside
        aria-label={asked ? "Save your progress" : "Finish this lesson"}
        className="ac-glass relative mt-10 overflow-hidden rounded-3xl p-6 sm:p-8"
        style={{ "--a": "#2560e6" } as CSSProperties}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(26,169,214,0.22),transparent_70%)] blur-2xl"
        />
        <div className="relative">
          <p className="ac-eyebrow">{eyebrow}</p>
          <h2 className="mt-2 text-balance font-display text-2xl font-bold leading-tight tracking-tight sm:text-[1.7rem]">
            {headline[0]} <span style={GRADIENT_TEXT}>{headline[1]}</span>
          </h2>
          <p className="mt-3 max-w-xl text-pretty text-[15px] leading-relaxed text-foreground/70">
            {body}
          </p>

          {/* The perk chips are an account pitch, so they only appear once
              there is progress an account would protect. */}
          {asked && (
            <ul className="mt-5 flex flex-wrap gap-2.5">
              {PERKS.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="ac-chip inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80"
                >
                  <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            {asked ? (
              <Link
                href={`/signup?next=${encoded}&ref=lesson-hook`}
                className="ac-btn max-w-full text-sm"
              >
                <span className="truncate">{cta}</span>
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
              </Link>
            ) : (
              // Every lesson carries a quiz, and <LessonComplete/> renders it
              // with id="lesson-quiz" whenever the lesson isn't already done —
              // which is exactly the state this branch describes. A plain
              // in-page anchor, so it works before hydration and without JS.
              <a href="#lesson-quiz" className="ac-btn max-w-full text-sm">
                <span className="truncate">{cta}</span>
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
              </a>
            )}
            <span className="text-sm text-muted-foreground">
              {asked ? "Already have an account? " : "Got an account? "}
              <Link
                href={`/login?next=${encoded}`}
                className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Log in
              </Link>
              {!asked && (
                <>
                  {" "}
                  or{" "}
                  <Link
                    href={`/signup?next=${encoded}&ref=lesson-hook`}
                    className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    create one free
                  </Link>
                </>
              )}
            </span>
          </div>
        </div>
      </aside>
    </Reveal>
  );
}
