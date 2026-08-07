"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Flag, Trophy } from "lucide-react";
import { ShareButton } from "@/components/share-button";
import { useMyProgress } from "@/components/progress/my-progress";

/**
 * "Bring your team along" — the referral ask at lesson completion.
 *
 * WHY A MILESTONE AND NOT EVERY LESSON
 * ------------------------------------
 * Lesson completion is the highest-frequency moment of real accomplishment on
 * the site (135–226/day), which is exactly why it must not carry a standing
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
 *  1. `first-lesson` (count hits exactly 1) — the "I actually did a thing"
 *     moment. It is also the moment a new member is most likely to still be
 *     sitting next to the teammates who would use this.
 *  2. `ten-lessons` (count reaches 10 or more) — a real body of work, and the
 *     rung that reaches people who were already deep in the curriculum before
 *     this shipped. It is `>=` rather than `=== 10` deliberately: a member with
 *     41 completions never crosses exactly 10 again, and the copy quotes their
 *     true count, so it stays honest for them.
 *
 * Module completion would be the other honest unit of accomplishment, but the
 * completion island is not handed the module's lesson ids, and department
 * completion is deliberately left alone — it already ends at the certificate
 * page, which has its own share.
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
 * render, so server and first client render can never disagree. Reduced motion
 * changes `transition` only — never the rendered tree or text.
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
    // Storage blocked (private mode / embedded webview). Treat as unseen — the
    // in-page state still prevents a second ask within this session.
    return false;
  }
}

/** Spend this rung: it will never be offered again on this device. */
export function rememberMilestone(key: MilestoneKey) {
  try {
    localStorage.setItem(seenKey(key), "1");
  } catch {
    /* storage blocked — nothing to persist, the session state still holds */
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
 * Copy is about what the reader did and what a teammate gets — never about the
 * site, and never a deadline. The +25 XP is stated as the plain mechanic it is
 * (both sides get it), not as a payment for the share.
 */
function copyFor(milestone: LessonMilestone) {
  if (milestone.key === "first-lesson") {
    return {
      eyebrow: "First lesson done",
      title: "Bring your team along",
      body: "It's free for them too. Your link drops a teammate into the same lessons — and you both pick up +25 XP when they join.",
      shareText:
        "I'm learning FRC on LearnFRC — free lessons for every subteam, from CAD to scouting. Here's my link if you want in:",
    };
  }
  return {
    eyebrow: `${milestone.total} lessons done`,
    title: "Worth passing to your team",
    body: `You've covered ${milestone.total} lessons. Your link starts a teammate where you started — and you both pick up +25 XP when they join.`,
    shareText: `I've done ${milestone.total} lessons on LearnFRC — free FRC guides for every subteam. Here's my link if you want in:`,
  };
}

export function LessonMilestoneShare({
  username,
  milestone,
  onDismiss,
}: {
  username: string;
  milestone: LessonMilestone;
  onDismiss: () => void;
}) {
  const reduce = useReducedMotion();
  const { eyebrow, title, body, shareText } = copyFor(milestone);
  const accent = "#2560e6";

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
  // own "Copied!" feedback is still readable and nothing jumps.
  const onShared = () => rememberMilestone(milestone.key);

  const Icon = milestone.key === "first-lesson" ? Flag : Trophy;

  return (
    <motion.div
      // Opacity + transform only: the box occupies its final space from the
      // first frame, so neither this card nor anything under it ever shifts.
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduce ? { duration: 0 } : { duration: 0.35, ease: [0.21, 0.47, 0.32, 0.98] }
      }
      className="ac-tile p-4 text-left"
      style={{ "--a": accent } as CSSProperties}
    >
      <div className="flex items-start gap-3">
        <span
          className="ac-badge flex h-10 w-10 shrink-0 items-center justify-center"
          style={{ "--a": accent } as CSSProperties}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="ac-eyebrow">{eyebrow}</p>
          <p className="mt-1 text-[15px] font-semibold leading-snug text-foreground">
            {title}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-foreground/70">{body}</p>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2 sm:pl-[52px]">
        {/* `display:contents` pass-through: the real control inside is a
            <button> with its own keyboard handling, so this adds no interactive
            surface of its own — it only observes the click. */}
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
          className="inline-flex min-h-[44px] items-center rounded-xl px-3 text-sm font-medium text-foreground/60 transition-colors hover:bg-white/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Not now
        </button>
      </div>
    </motion.div>
  );
}
