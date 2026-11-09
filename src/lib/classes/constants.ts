/**
 * Live classes: the limits and the pure rules every package shares.
 *
 * No imports and no `server-only`, so client components can read the limits
 * (the schedule form's seat and length pickers, the chat box's character
 * count) and `node --test` can run the helpers. Anything that reads env vars
 * or the database lives in ./config.ts, which re-exports all of this.
 *
 * The numbers are the design's (classes-design.md sections 3, 6, 9 and 12).
 * Change one here and every page, action and route follows.
 */

export const CLASS_LIMITS = {
  /** Scheduled length, minutes (classes.duration_minutes check). */
  minDurationMinutes: 15,
  maxDurationMinutes: 90,
  /** Seats, students only (classes.capacity check). First classes included. */
  minCapacity: 2,
  maxCapacity: 15,
  defaultCapacity: 15,
  /** hard_end_at = starts_at + duration + this. */
  hardEndGraceMinutes: 15,
  /** How early a student may join, before starts_at. */
  studentEarlyJoinMinutes: 15,
  /** How early the teacher and staff may join, before starts_at. */
  teacherEarlyJoinMinutes: 30,
  /** Enrollment closes this long after the start (class_enroll matches it). */
  enrollCloseAfterStartMinutes: 10,
  /** A class starts 2 hours to 30 days ahead (the same for a first class). */
  scheduleMinLeadMinutes: 120,
  scheduleMaxAheadDays: 30,
  /** Upcoming classes per teacher. */
  maxUpcomingPerTeacher: 4,
  /** No overlap with the teacher's own classes, with this buffer. */
  overlapBufferMinutes: 15,
  /** classes.title and classes.description checks. */
  titleMin: 4,
  titleMax: 80,
  descriptionMax: 600,
  /** Teacher minutes count from this long before the start (minutes rule). */
  creditWindowBeforeStartMinutes: 10,
  /** The sweep ends a live class after this long with no teacher, or empty. */
  teacherGoneMinutes: 10,
  emptyRoomMinutes: 10,
  /** People who were in a class can report someone from it for this long. */
  reportWindowDays: 30,
  /** Holds keep a ban's classes from this far back. */
  banHoldLookbackDays: 90,
} as const;

/** The class chat (section 6.5). */
export const CHAT_LIMITS = {
  maxChars: 300,
  /** Messages per person per minute (rateLimitKey "class-chat"). */
  perMinute: 20,
  /** The panel falls back to polling when Realtime isn't SUBSCRIBED by then. */
  realtimeTimeoutMs: 5_000,
  pollEveryMs: 4_000,
} as const;

/** Joins (section 6.4). */
export const JOIN_LIMITS = {
  perUser: 6,
  perUserWindowSeconds: 600,
  perIp: 30,
  perIpWindowSeconds: 600,
} as const;

/** The parent OK (section 5.1). */
export const PARENT_LIMITS = {
  tokenDays: 14,
  sendsPerDayPerAccount: 3,
  sendsPerDayPerIp: 10,
  /** "Resend in 24 hours." */
  resendAfterHours: 24,
} as const;

/** Hours letters (section 9). */
export const LETTER_LIMITS = {
  maxOpenRequests: 3,
  requestsPerDay: 10,
} as const;

/** The three RealtimeKit presets, by name (src/lib/classes/presets.ts). */
export const PRESET_NAMES = {
  teacher: "lfrc-teacher",
  student: "lfrc-student",
  staff: "lfrc-staff",
} as const;

/** The cookie an under-13 answer leaves on the device (section 5). */
export const UNDER_13_COOKIE = "lf_cls_age";
export const UNDER_13_COOKIE_VALUE = "u13";

/** "Taught by an FRC student": what signed-out visitors see instead of a handle. */
export const TEACHER_LABEL = "Taught by an FRC student";

const MINUTE = 60_000;

/** starts_at + duration + the grace period. */
export function hardEndFor(startsAt: Date, durationMinutes: number): Date {
  return new Date(
    startsAt.getTime() + (durationMinutes + CLASS_LIMITS.hardEndGraceMinutes) * MINUTE
  );
}

/** The scheduled end (no grace period). */
export function scheduledEndFor(startsAt: Date, durationMinutes: number): Date {
  return new Date(startsAt.getTime() + durationMinutes * MINUTE);
}

/** The earliest moment someone in `role` may join a class starting at `startsAt`. */
export function earliestJoinFor(startsAt: Date, role: "teacher" | "student" | "staff"): Date {
  const early =
    role === "student" ? CLASS_LIMITS.studentEarlyJoinMinutes : CLASS_LIMITS.teacherEarlyJoinMinutes;
  return new Date(startsAt.getTime() - early * MINUTE);
}

/**
 * Which RealtimeKit app this deployment uses: `prod` on Vercel Production,
 * `dev` everywhere else (local dev servers and Vercel Preview). Dev and prod
 * share one database, so every class records the app that made its meeting
 * (classes.rtk_app) and code only manages meetings of its own app.
 */
export function rtkAppFor(vercelEnv: string | undefined | null): "dev" | "prod" {
  return vercelEnv === "production" ? "prod" : "dev";
}

/** The two visibility switches, after the dev override (section 1). */
export type ClassSwitches = {
  /** Classes show anywhere at all. */
  visible: boolean;
  /** Nobody but staff can join a room. */
  joinsPaused: boolean;
};

/**
 * Both switches must be on for classes to show: the CLASSES_VISIBLE env var
 * and class_settings.classes_visible. On a dev server, CLASSES_DEV_SWITCHES=1
 * treats both as open (and joins as unpaused) without writing the production
 * row. A production build (NODE_ENV=production) ignores the override, so
 * nothing on Vercel can open classes by accident.
 */
export function evaluateSwitches(input: {
  nodeEnv: string | undefined;
  devSwitches: string | undefined;
  envVisible: string | undefined;
  dbVisible: boolean | null | undefined;
  dbJoinsPaused: boolean | null | undefined;
}): ClassSwitches {
  if (input.nodeEnv !== "production" && input.devSwitches === "1") {
    return { visible: true, joinsPaused: false };
  }
  const visible = input.envVisible === "1" && input.dbVisible === true;
  // A missing settings row reads as paused: the safe default.
  return { visible, joinsPaused: input.dbJoinsPaused !== false };
}
