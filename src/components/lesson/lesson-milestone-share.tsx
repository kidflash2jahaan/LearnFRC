"use client";

import * as React from "react";
import { ShareButton } from "@/components/share-button";
import { useMyProgress } from "@/components/progress/my-progress";

/**
 * "Bring your team along", the referral ask at lesson completion.
 *
 * WHY A MILESTONE AND NOT EVERY LESSON
 * ------------------------------------
 * Lesson completion is the highest-frequency moment of real accomplishment on
 * the site (135-226/day), which is exactly why it must not carry a standing
 * ask: a student who finishes twelve lessons in a build-season evening would be
 * asked twelve times, and the ask stops reading as a suggestion and starts
 * reading as spam. So the ask is spent on moments that only happen once.
 *
 * WHICH MILESTONES, AND WHY THESE
 * -------------------------------
 * The only trustworthy signal available at this exact instant is the reader's
 * lifetime completed-lesson count, which the client progress store already
 * holds (`/api/me/progress` → `completedLessonIds`). Two rungs, both one-time:
 *
 *  1. `first-lesson` (count hits exactly 1), the "I actually did a thing"
 *     moment. It is also the moment a new member is most likely to still be
 *     sitting next to the teammates who would use this.
 *  2. `ten-lessons` (count reaches 10 or more), a real body of work, and the
 *     rung that reaches people who were already deep in the curriculum before
 *     this shipped. It is `>=` rather than `=== 10` deliberately: a member with
 *     41 completions never crosses exactly 10 again, and the copy quotes their
 *     true count, so it stays honest for them.
 *
 * DON'T-NAG CONTRACT
 * ------------------
 * Each rung is remembered in localStorage the moment it is shown, so it is at
 * most two asks in an entire account lifetime, it cannot come back on reload,
 * and re-completing the same lesson cannot re-trigger it.
 *
 * HYDRATION
 * ---------
 * This component never participates in hydration: the parent only mounts it
 * from inside a click handler, after a completion the reader just performed.
 * The localStorage read therefore happens in an event handler, never during
 * render, so server and first client render can never disagree.
 */

export type MilestoneKey = "first-lesson" | "ten-lessons";

export type LessonMilestone = {
  key: MilestoneKey;
  /** True lifetime completed-lesson count at the instant the rung fired. */
  total: number;
};

/** Lifetime count at which the second (and last) rung fires. */
const DEEP_IN = 10;

const SEEN_PREFIX = "lf_milestone_share_";

function seenKey(key: MilestoneKey) {
  return `${SEEN_PREFIX}${key}`;
}

/** Has this rung already been offered on this device? */
export function hasSeenMilestone(key: MilestoneKey): boolean {
  try {
    return localStorage.getItem(seenKey(key)) === "1";
  } catch {
    // Storage blocked (private mode / embedded webview). Treat as unseen, the
    // in-page state still prevents a second ask within this session.
    return false;
  }
}

/** Spend this rung: it will never be offered again on this device. */
export function rememberMilestone(key: MilestoneKey) {
  try {
    localStorage.setItem(seenKey(key), "1");
  } catch {
    /* storage blocked, nothing to persist, the session state still holds */
  }
}

/**
 * Returns a resolver to be called *synchronously inside the completion click
 * handler*, so the result lands in the same React batch as the completion
 * itself and the card renders in the very same commit (no layout shift).
 *
 * The store's `completed` set has not yet been told about the lesson being
 * completed at call time, hence the `has()` guard when counting.
 */
export function useLessonMilestone(lessonId: string) {
  const { loaded, authed, completed, username } = useMyProgress();

  return React.useCallback((): LessonMilestone | null => {
    // A referral link needs a username. Guests, username-less accounts, and the
    // window before the progress store has loaded get nothing at all.
    if (!loaded || !authed || !username) return null;

    const total = completed.has(lessonId) ? completed.size : completed.size + 1;

    const key: MilestoneKey | null =
      total === 1 ? "first-lesson" : total >= DEEP_IN ? "ten-lessons" : null;

    if (!key) return null;
    if (hasSeenMilestone(key)) return null;

    return { key, total };
  }, [loaded, authed, completed, username, lessonId]);
}

/**
 * Copy is about what the reader did and what a teammate gets, never about the
 * site, and never a deadline. The +25 XP is stated as the plain mechanic it is
 * (both sides get it), not as a payment for the share.
 */
function copyFor(milestone: LessonMilestone) {
  if (milestone.key === "first-lesson") {
    return {
      slug: "first lesson done",
      title: "Bring your team along",
      body: "It's free for them too. Your link drops a teammate into the same lessons, and you both pick up +25 XP when they join.",
      shareText:
        "I'm learning FRC on LearnFRC, free lessons for every subteam, from CAD to scouting. Here's my link if you want in:",
    };
  }
  return {
    slug: `${milestone.total} lessons done`,
    title: "Worth passing to your team",
    body: `You've covered ${milestone.total} lessons. Your link starts a teammate where you started, and you both pick up +25 XP when they join.`,
    shareText: `I've done ${milestone.total} lessons on LearnFRC, free FRC guides for every subteam. Here's my link if you want in:`,
  };
}

/**
 * The card itself: an index card taped into the completion sheet at an angle
 * nothing else on the page uses, so it reads as something added afterwards
 * rather than as another row of the form.
 */
export function LessonMilestoneShare({
  username,
  milestone,
  onDismiss,
}: {
  username: string;
  milestone: LessonMilestone;
  onDismiss: () => void;
}) {
  const { slug, title, body, shareText } = copyFor(milestone);

  // `via` tells the server which surface earned the signup (allow-listed
  // server-side, stored on profiles.referral_surface for genuine referrals).
  const link = `https://learnfrc.com/signup?ref=${username}&via=lesson-milestone`;

  const dismiss = () => {
    rememberMilestone(milestone.key);
    onDismiss();
  };

  // ShareButton owns its own click (native sheet → clipboard fallback) and
  // exposes no callback, so capture the click on the way down to spend the
  // rung. The card deliberately stays on screen afterwards so the button's
  // own "Copied" feedback is still readable and nothing jumps.
  const onShared = () => rememberMilestone(milestone.key);

  return (
    <div className="nb-box nb-tilt-4 relative p-5 text-left">
      {/* Inline transform, not a utility: the reduced-motion block in
          globals.css flattens `.nb-tape` by overriding `transform`, and an
          inline declaration is what that override is written against. */}
      <span
        className="nb-tape -top-3 left-8"
        style={{ transform: "rotate(-5deg)" }}
        aria-hidden="true"
      />

      <p className="nb-slug">{slug}</p>
      <h3 className="mt-1.5">{title}</h3>
      <p className="mt-2 max-w-[48ch] text-[0.95rem] leading-relaxed text-graphite">
        {body}
      </p>

      <div className="nb-hair mt-4 flex flex-wrap items-center gap-3 pt-4">
        {/* `display:contents` pass-through: the real control inside is a
            <button> with its own keyboard handling, so this adds no interactive
            surface of its own, it only observes the click. */}
        <span className="contents" onClickCapture={onShared}>
          <ShareButton
            variant="brand"
            label="Send to a teammate"
            text={shareText}
            url={link}
          />
        </span>
        <button
          type="button"
          onClick={dismiss}
          className="nb-slug inline-flex min-h-11 items-center text-ink underline decoration-rule underline-offset-4 hover:decoration-blue"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
