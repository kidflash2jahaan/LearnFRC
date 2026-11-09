/**
 * What the 5-minute sweep does to one class (classes-design.md 6.9), as pure
 * decisions. src/lib/classes/reconcile.ts (runSweep) reads the rows, asks
 * these, and acts through the shared functions (endClass, reconcileClass,
 * runClassReview). No imports, so `node --test` runs it (sweep-rules.test.ts).
 *
 *   1. Hard end: past hard_end_at and still scheduled or live: end it.
 *      `time` if it ever went live, `sweep` for one that never started.
 *   2. Teacher gone: live, students present, no open teacher attendance for
 *      10 minutes (counted from the later of the start and the teacher's last
 *      leave): `teacher_gone`.
 *   3. Empty: live with nobody present for 10 minutes, after the start:
 *      `empty`. An early "everyone left" stays rejoinable until then.
 *   5. Reviews due: ended at least 30 minutes ago with no finished review, or
 *      a failed review under 3 attempts whose last try was 30 minutes ago.
 */

export const SWEEP_RULES = {
  teacherGoneMs: 10 * 60_000,
  emptyMs: 10 * 60_000,
  reviewAfterEndMs: 30 * 60_000,
  reviewRetryMs: 30 * 60_000,
  maxReviewAttempts: 3,
} as const;

type Time = string | number | Date;
const t = (v: Time): number => (v instanceof Date ? v.getTime() : typeof v === "number" ? v : Date.parse(v));

export type SweepClass = {
  status: string;
  startsAt: Time;
  hardEndAt: Time;
  /** A class_sessions row exists (the meeting went live at least once). */
  hasSession: boolean;
};

export type SweepSpan = {
  role: "teacher" | "student" | "staff";
  joinedAt: Time;
  leftAt: Time | null;
};

export type SweepEnd = { action: "end"; reason: "time" | "teacher_gone" | "empty" | "sweep" } | { action: "none" };

export function sweepDecision(c: SweepClass, attendance: readonly SweepSpan[], now: Time): SweepEnd {
  if (c.status !== "scheduled" && c.status !== "live") return { action: "none" };
  const nowMs = t(now);
  const startMs = t(c.startsAt);
  if (nowMs >= t(c.hardEndAt)) {
    return { action: "end", reason: c.status === "live" || c.hasSession ? "time" : "sweep" };
  }
  if (c.status !== "live" || nowMs < startMs) return { action: "none" };

  const open = attendance.filter((a) => a.leftAt == null);
  const lastLeave = (spans: readonly SweepSpan[]) =>
    spans.reduce((m, a) => (a.leftAt != null ? Math.max(m, t(a.leftAt)) : m), -Infinity);

  if (open.length === 0) {
    const since = Math.max(startMs, lastLeave(attendance));
    return nowMs - since >= SWEEP_RULES.emptyMs ? { action: "end", reason: "empty" } : { action: "none" };
  }
  const teacherOpen = open.some((a) => a.role === "teacher");
  const studentsOpen = open.some((a) => a.role === "student");
  if (studentsOpen && !teacherOpen) {
    const since = Math.max(startMs, lastLeave(attendance.filter((a) => a.role === "teacher")));
    return nowMs - since >= SWEEP_RULES.teacherGoneMs ? { action: "end", reason: "teacher_gone" } : { action: "none" };
  }
  return { action: "none" };
}

export type ReviewState = { status: string; attempts: number; updatedAt: Time } | null;

/**
 * Whether the sweep should run (or retry) a class's review now. `endedAt` is
 * classes.ended_at, or hard_end_at when the class never recorded an end.
 */
export function reviewDue(
  c: { status: string; endedAt: Time | null; hardEndAt: Time },
  review: ReviewState,
  now: Time
): "run" | "retry" | null {
  if (c.status !== "ended" && c.status !== "in_review") return null;
  const nowMs = t(now);
  const endMs = t(c.endedAt ?? c.hardEndAt);
  if (!review || review.status === "pending") {
    return c.status === "ended" && nowMs - endMs >= SWEEP_RULES.reviewAfterEndMs ? "run" : null;
  }
  if (
    review.status === "failed" &&
    review.attempts < SWEEP_RULES.maxReviewAttempts &&
    nowMs - t(review.updatedAt) >= SWEEP_RULES.reviewRetryMs
  ) {
    return "retry";
  }
  return null;
}
