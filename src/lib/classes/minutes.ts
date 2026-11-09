/**
 * The teacher-minutes rule (section 3.4).
 *
 *   credited = length( union(teacher intervals)
 *                    ∩ union(countable student intervals)
 *                    ∩ [starts_at - 10 min, hard_end_at] )
 *
 * - A countable student has role `student` and an account at least
 *   `minStudentAccountDays` old at join (class_attendance.account_age_days).
 *   An unknown account age doesn't count. Staff never count. An empty room
 *   earns nothing.
 * - An interval with no left_at is closed at its session's ended_at, or at
 *   hard_end_at if the session never closed.
 * - Floor to whole minutes (creditedMinutes).
 *
 * The interval helpers are exported for the media summary (src/lib/classes/
 * media.ts) and the one-on-one measure.
 *
 * Pure, no imports, unit tested (minutes.test.ts).
 */

/** Half-open [start, end) in epoch milliseconds. */
export type Interval = { start: number; end: number };

export type TimeInput = Date | string | number;

export type AttendanceSpan = {
  userId: string | null;
  role: "teacher" | "student" | "staff";
  joinedAt: TimeInput;
  leftAt: TimeInput | null;
  /** class_attendance.account_age_days at join. */
  accountAgeDays: number | null;
  /** The session's ended_at, used when leftAt is missing. */
  sessionEndedAt?: TimeInput | null;
};

export function toMs(t: TimeInput): number {
  return t instanceof Date ? t.getTime() : typeof t === "number" ? t : Date.parse(t);
}

/** Sorted, merged, non-empty intervals. */
export function unionIntervals(intervals: readonly Interval[]): Interval[] {
  const sorted = intervals
    .filter((i) => Number.isFinite(i.start) && Number.isFinite(i.end) && i.end > i.start)
    .map((i) => ({ start: i.start, end: i.end }))
    .sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push(i);
  }
  return out;
}

/** The overlap of two interval sets (each is unioned first). */
export function intersectIntervals(a: readonly Interval[], b: readonly Interval[]): Interval[] {
  const x = unionIntervals(a);
  const y = unionIntervals(b);
  const out: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    const start = Math.max(x[i].start, y[j].start);
    const end = Math.min(x[i].end, y[j].end);
    if (end > start) out.push({ start, end });
    if (x[i].end < y[j].end) i++;
    else j++;
  }
  return out;
}

/** Total length in milliseconds (unioned first, so overlaps count once). */
export function totalMs(intervals: readonly Interval[]): number {
  return unionIntervals(intervals).reduce((sum, i) => sum + (i.end - i.start), 0);
}

/** An attendance span as an interval, closing an open one as the rule says. */
export function spanInterval(span: AttendanceSpan, hardEndAt: TimeInput): Interval {
  const start = toMs(span.joinedAt);
  const end =
    span.leftAt != null
      ? toMs(span.leftAt)
      : span.sessionEndedAt != null
        ? toMs(span.sessionEndedAt)
        : toMs(hardEndAt);
  return { start, end };
}

export type CreditInput = {
  attendance: readonly AttendanceSpan[];
  startsAt: TimeInput;
  hardEndAt: TimeInput;
  /** class_settings.min_student_account_days (default 7). */
  minStudentAccountDays: number;
  /** Students not to count ("minutes if flagged students aren't counted"). */
  excludeUserIds?: readonly string[];
  /** Defaults to the design's 10 minutes before the start. */
  windowBeforeStartMinutes?: number;
};

/** Whether a span is a student who counts toward the teacher's minutes. */
export function isCountableStudent(
  span: AttendanceSpan,
  minStudentAccountDays: number,
  exclude: ReadonlySet<string> = new Set()
): boolean {
  if (span.role !== "student") return false;
  if (span.accountAgeDays == null || span.accountAgeDays < minStudentAccountDays) return false;
  if (span.userId && exclude.has(span.userId)) return false;
  return true;
}

/** Credited teaching time in seconds (not yet floored to minutes). */
export function creditedSeconds(input: CreditInput): number {
  const before = (input.windowBeforeStartMinutes ?? 10) * 60_000;
  const window: Interval[] = [
    { start: toMs(input.startsAt) - before, end: toMs(input.hardEndAt) },
  ];
  const exclude = new Set(input.excludeUserIds ?? []);
  const teacher = input.attendance
    .filter((s) => s.role === "teacher")
    .map((s) => spanInterval(s, input.hardEndAt));
  const students = input.attendance
    .filter((s) => isCountableStudent(s, input.minStudentAccountDays, exclude))
    .map((s) => spanInterval(s, input.hardEndAt));
  const both = intersectIntervals(intersectIntervals(teacher, students), window);
  return Math.floor(totalMs(both) / 1000);
}

/** Credited teaching time in whole minutes, floored (credited_minutes_computed). */
export function creditedMinutes(input: CreditInput): number {
  return Math.floor(creditedSeconds(input) / 60);
}
