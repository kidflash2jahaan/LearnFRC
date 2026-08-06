"use client";

import type { CSSProperties } from "react";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, Cloud, Medal, Trophy, Zap } from "lucide-react";
import { Reveal } from "@/components/motion/primitives";
import { useMyProgress } from "@/components/progress/my-progress";

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

/** Where <LessonComplete/> stores a guest's completions on this device. */
const GUEST_KEY = "lf_guest_lessons";
/** /api/migrate-guest awards exactly this per migrated lesson — so the XP
    number this component quotes is the number the reader actually receives. */
const XP_PER_LESSON = 10;

type GuestCount = { total: number; inDept: number };
const NO_GUEST: GuestCount = { total: 0, inDept: 0 };

function readGuestCount(deptIds: Set<string>): GuestCount {
  try {
    const map = JSON.parse(localStorage.getItem(GUEST_KEY) || "{}") as Record<
      string,
      boolean
    >;
    let total = 0;
    let inDept = 0;
    for (const [id, done] of Object.entries(map)) {
      if (!done) continue;
      total++;
      if (deptIds.has(id)) inDept++;
    }
    return { total, inDept };
  } catch {
    // Storage blocked (private mode / third-party restrictions) — fall back to
    // the first-time ask rather than guessing.
    return NO_GUEST;
  }
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
        const next = readGuestCount(deptIds);
        return prev.total === next.total && prev.inDept === next.inDept
          ? prev
          : next;
      });
    read();

    // <LessonComplete/> writes straight to localStorage with no event, so
    // re-read on the next tick after any click. Finishing the lesson directly
    // above this card therefore upgrades the ask immediately — and because the
    // re-read lands within 500ms of a real user interaction, any resulting
    // reflow is excluded from CLS.
    const onClick = () => window.setTimeout(read, 0);
    document.addEventListener("click", onClick, true);
    // Cross-tab / returning readers.
    window.addEventListener("storage", read);
    window.addEventListener("focus", read);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("storage", read);
      window.removeEventListener("focus", read);
    };
  }, [loaded, authed, deptIds]);

  if (authed) return null;

  const encoded = encodeURIComponent(lessonPath);
  const { total, inDept } = guest;
  const xp = total * XP_PER_LESSON;
  const them = total === 1 ? "it" : "them";
  const plural = total === 1 ? "" : "s";

  let eyebrow: string;
  let headline: [string, string];
  let body: string;
  let cta: string;

  if (inDept > 0) {
    eyebrow = "Saved on this device only";
    headline = [
      `You've already finished ${inDept} of ${count} lessons in ${department} —`,
      `claim ${them}.`,
    ];
    body =
      `Guest progress lives in this browser only. Creating a free ` +
      `account moves all ${total} lesson${plural} you've finished on LearnFRC ` +
      `into a real profile — that's +${xp} XP the moment you sign up — so they ` +
      `follow you to any device, count toward your streak and the ${department} ` +
      `certificate, and put you on the leaderboard. About 10 seconds; you can ` +
      `keep learning either way.`;
    cta = `Claim my ${total} lesson${plural}`;
  } else if (total > 0) {
    eyebrow = "Saved on this device only";
    headline = [
      `You've finished ${total} lesson${plural} without an account —`,
      `claim ${them}.`,
    ];
    body =
      `Guest progress lives in this browser only. Creating a free ` +
      `account moves ${them} into a real profile — that's +${xp} XP the moment ` +
      `you sign up — so your work follows you to any device, counts toward your ` +
      `streak and certificates, and puts you on the leaderboard. About 10 ` +
      `seconds; you can keep learning either way.`;
    cta = `Claim my ${total} lesson${plural}`;
  } else {
    eyebrow = "Save your progress";
    headline = [`You're on lesson ${position} of ${count} in`, `${department}.`];
    body =
      `You can finish lessons without an account — progress saves in this ` +
      `browser. A free account keeps it on every device instead, adds XP and ` +
      `daily streaks, and unlocks the ${department} certificate when you finish ` +
      `the track. It takes about 10 seconds.`;
    cta = "Create a free account";
  }

  return (
    <Reveal>
      <aside
        aria-label="Create a free account"
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

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              href={`/signup?next=${encoded}&ref=lesson-hook`}
              className="ac-btn max-w-full text-sm"
            >
              <span className="truncate">{cta}</span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
            </Link>
            <span className="text-sm text-muted-foreground">
              Already have one?{" "}
              <Link
                href={`/login?next=${encoded}`}
                className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Log in
              </Link>
            </span>
          </div>
        </div>
      </aside>
    </Reveal>
  );
}
