/**
 * The pure scheduling rules behind scheduleClass (classes-design.md section
 * 11, /classes/teaching): the form's input, how far ahead a class may start,
 * overlap with the teacher's own classes, the per-teacher cap and how many
 * classes run at once across the site.
 *
 * Pure and client-safe: it imports only ./constants.ts, so node --test runs
 * it (schedule.test.ts) and the schedule form can read the same sentences.
 * Everything that reads the database or RealtimeKit is in
 * src/lib/app/classes-teaching.ts, which calls these in the order the design
 * asks for: every refusal before any RealtimeKit call.
 *
 * A first class schedules exactly like any other (section 8.3): the same
 * lead time, the same seats, no host step.
 */

import { CLASS_LIMITS, hardEndFor, scheduledEndFor } from "./constants.ts";

const MINUTE = 60_000;
const DAY = 86_400_000;

/** What the teacher reads when scheduling is refused. */
export const SCHEDULE_SENTENCES = {
  notTeacher: "Only accepted teachers can schedule classes. Apply to teach first.",
  suspended: "Your teaching is paused, so you can't schedule classes right now.",
  codeUpdate: "The teacher code changed. Read it and agree again before you schedule.",
  notConfigured: "Scheduling opens soon. Nothing was saved, so try again in a few days.",
  title: `Give the class a title of ${CLASS_LIMITS.titleMin} to ${CLASS_LIMITS.titleMax} characters.`,
  description: `Keep the description under ${CLASS_LIMITS.descriptionMax} characters.`,
  topic: "Pick the lesson or module this class teaches.",
  topicMissing: "That lesson or module isn't on LearnFRC anymore. Pick another.",
  startsAt: "Pick a date and time for the class.",
  duration: `Classes run ${CLASS_LIMITS.minDurationMinutes} to ${CLASS_LIMITS.maxDurationMinutes} minutes.`,
  capacity: `Seats can be ${CLASS_LIMITS.minCapacity} to ${CLASS_LIMITS.maxCapacity}.`,
  tooSoon: "Classes start at least 2 hours from now, so students have time to find them.",
  tooFar: `Classes can be scheduled up to ${CLASS_LIMITS.scheduleMaxAheadDays} days ahead.`,
  overlap: `That overlaps one of your other classes. Leave ${CLASS_LIMITS.overlapBufferMinutes} minutes between them.`,
  tooMany: `You already have ${CLASS_LIMITS.maxUpcomingPerTeacher} upcoming classes. Teach or cancel one before you add another.`,
  siteFull: "Too many classes are already running at that time. Pick another time.",
  profaneTitle: "Keep the title friendly. Something in it isn't allowed here.",
  profaneDescription: "Keep the description friendly. Something in it isn't allowed here.",
  contactTitle: "Take contact details out of the title. Links outside LearnFRC and the docs, @handles, emails, phone numbers and other apps' usernames can't go in a class listing.",
  contactDescription: "Take contact details out of the description. Links outside LearnFRC and the docs, @handles, emails, phone numbers and other apps' usernames can't go in a class listing.",
  bio: "Take contact details out of your bio before you schedule. Students can open your profile from the class.",
  rate: "That's a lot of classes at once. Wait a while and try again.",
  save: "Couldn't schedule that. Try again.",
  meeting: "Couldn't set up the class video room. Nothing was saved, so try again in a minute.",
} as const;

/** A half-open stretch of time [start, end), in epoch milliseconds. */
export type Interval = { start: number; end: number };

/* ── The form ──────────────────────────────────────────────────────── */

export type ScheduleFields = {
  title: string;
  description: string | null;
  lessonId: string | null;
  moduleId: string | null;
  startsAt: Date;
  durationMinutes: number;
  capacity: number;
};

export type ScheduleField = "title" | "description" | "topic" | "startsAt" | "durationMinutes" | "capacity";

export type ParsedSchedule =
  | { ok: true; value: ScheduleFields }
  | { ok: false; field: ScheduleField; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** An instant with its zone: what the form sends (Date#toISOString). */
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Collapses runs of whitespace and trims, keeping single line breaks. */
export function tidyText(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Reads the schedule form. `topic` is "lesson:<uuid>" or "module:<uuid>", or
 * the caller passes lessonId or moduleId directly.
 */
export function parseScheduleInput(raw: {
  title?: unknown;
  description?: unknown;
  topic?: unknown;
  lessonId?: unknown;
  moduleId?: unknown;
  startsAt?: unknown;
  durationMinutes?: unknown;
  capacity?: unknown;
}): ParsedSchedule {
  const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

  const title = tidyText(str(raw.title)).replace(/\n+/g, " ");
  if (title.length < CLASS_LIMITS.titleMin || title.length > CLASS_LIMITS.titleMax)
    return { ok: false, field: "title", error: SCHEDULE_SENTENCES.title };

  const description = tidyText(str(raw.description));
  if (description.length > CLASS_LIMITS.descriptionMax)
    return { ok: false, field: "description", error: SCHEDULE_SENTENCES.description };

  let lessonId: string | null = str(raw.lessonId).trim() || null;
  let moduleId: string | null = str(raw.moduleId).trim() || null;
  const topic = str(raw.topic).trim();
  if (topic) {
    const m = /^(lesson|module):(.+)$/.exec(topic);
    if (!m) return { ok: false, field: "topic", error: SCHEDULE_SENTENCES.topic };
    if (m[1] === "lesson") {
      lessonId = m[2];
      moduleId = null;
    } else {
      moduleId = m[2];
      lessonId = null;
    }
  }
  if ((lessonId ? 1 : 0) + (moduleId ? 1 : 0) !== 1)
    return { ok: false, field: "topic", error: SCHEDULE_SENTENCES.topic };
  if ((lessonId && !UUID.test(lessonId)) || (moduleId && !UUID.test(moduleId)))
    return { ok: false, field: "topic", error: SCHEDULE_SENTENCES.topic };

  const startsRaw = str(raw.startsAt).trim();
  const startsAt = ISO_WITH_ZONE.test(startsRaw) ? new Date(startsRaw) : null;
  if (!startsAt || Number.isNaN(startsAt.getTime()))
    return { ok: false, field: "startsAt", error: SCHEDULE_SENTENCES.startsAt };

  const durationMinutes = Number(str(raw.durationMinutes).trim());
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < CLASS_LIMITS.minDurationMinutes ||
    durationMinutes > CLASS_LIMITS.maxDurationMinutes
  )
    return { ok: false, field: "durationMinutes", error: SCHEDULE_SENTENCES.duration };

  const capRaw = str(raw.capacity).trim();
  const capacity = capRaw === "" ? CLASS_LIMITS.defaultCapacity : Number(capRaw);
  if (!Number.isInteger(capacity) || capacity < CLASS_LIMITS.minCapacity || capacity > CLASS_LIMITS.maxCapacity)
    return { ok: false, field: "capacity", error: SCHEDULE_SENTENCES.capacity };

  return {
    ok: true,
    value: {
      title,
      description: description || null,
      lessonId: lessonId ? lessonId.toLowerCase() : null,
      moduleId: moduleId ? moduleId.toLowerCase() : null,
      startsAt,
      durationMinutes,
      capacity,
    },
  };
}

/* ── Timing ────────────────────────────────────────────────────────── */

/**
 * A class starts 2 hours to 30 days ahead, first classes included.
 * `allowSoon` (CLASSES_DEV_ALLOW_SOON on a dev server) drops the 2-hour lead
 * to one minute so a test can schedule a class that starts in minutes.
 */
export function timingRefusal(
  startsAt: Date,
  now: Date,
  opts: { allowSoon?: boolean } = {}
): "too_soon" | "too_far" | null {
  const lead = startsAt.getTime() - now.getTime();
  const minLead = opts.allowSoon ? MINUTE : CLASS_LIMITS.scheduleMinLeadMinutes * MINUTE;
  if (lead < minLead) return "too_soon";
  if (lead > CLASS_LIMITS.scheduleMaxAheadDays * DAY) return "too_far";
  return null;
}

/** The stretch a class occupies on the site: its start to its hard end. */
export function classWindow(startsAt: Date, durationMinutes: number): Interval {
  return { start: startsAt.getTime(), end: hardEndFor(startsAt, durationMinutes).getTime() };
}

/** Whether two half-open intervals share any moment. */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Whether a new class would overlap one of the teacher's own, counting the
 * 15-minute buffer between the scheduled end of one and the start of the next.
 */
export function overlapsOwnClass(
  next: { startsAt: Date; durationMinutes: number },
  own: { startsAt: Date; durationMinutes: number }[]
): boolean {
  const buffer = CLASS_LIMITS.overlapBufferMinutes * MINUTE;
  const a: Interval = {
    start: next.startsAt.getTime(),
    end: scheduledEndFor(next.startsAt, next.durationMinutes).getTime() + buffer,
  };
  return own.some((o) =>
    overlaps(a, {
      start: o.startsAt.getTime(),
      end: scheduledEndFor(o.startsAt, o.durationMinutes).getTime() + buffer,
    })
  );
}

/**
 * The most of `others` running at the same moment anywhere inside `window`.
 * Intervals are half-open, so one class ending exactly as another starts
 * doesn't count as two at once.
 */
export function maxConcurrent(window: Interval, others: Interval[]): number {
  const events: [number, number][] = [];
  for (const o of others) {
    const start = Math.max(o.start, window.start);
    const end = Math.min(o.end, window.end);
    if (start < end) {
      events.push([start, 1], [end, -1]);
    }
  }
  // Ends before starts at the same moment.
  events.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  let now = 0;
  let max = 0;
  for (const [, d] of events) {
    now += d;
    if (now > max) max = now;
  }
  return max;
}

/** Whether one more class in `window` would go past the site's cap. */
export function siteFull(window: Interval, others: Interval[], maxLive: number): boolean {
  return maxConcurrent(window, others) + 1 > maxLive;
}

/** Whether the teacher already has the most upcoming classes allowed. */
export function tooManyUpcoming(upcomingCount: number): boolean {
  return upcomingCount >= CLASS_LIMITS.maxUpcomingPerTeacher;
}

/* ── Transcription keywords ────────────────────────────────────────── */

const STOP = new Set([
  "the", "and", "for", "with", "your", "you", "how", "what", "why", "from", "into", "that", "this",
  "are", "its", "it's", "about", "when", "where", "using", "use", "intro", "introduction", "part",
]);

/**
 * Words from the topic and class titles that help the transcriber spell
 * robotics terms (section 6.2's "lesson title words"). No handles or names:
 * the meeting record lives on at Cloudflare.
 */
export function transcriptionKeywords(...titles: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of titles) {
    for (const w of (t ?? "").split(/[^A-Za-z0-9+#.-]+/)) {
      const word = w.replace(/^[.-]+|[.-]+$/g, "");
      if (word.length < 3 || word.length > 30) continue;
      if (STOP.has(word.toLowerCase())) continue;
      if (/^\d+$/.test(word)) continue;
      const key = word.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(word);
      if (out.length >= 12) return out;
    }
  }
  return out;
}
