/**
 * Hours letters: the pure rules (classes-design.md section 9).
 *
 * Which classes a letter counts, the date range, the totals, the code, the
 * letter's own sentences, and the check that a request still matches the
 * records when Dhiren signs it. No imports besides types and no
 * `server-only`, so the request form's live preview runs the same filter the
 * server does, and `node --test` runs letter-rules.test.ts.
 *
 * Dates here are calendar dates ("2026-11-08"). A class's date is its start
 * in Pacific time, like every class time in the emails.
 */

import type { HoursLetterClass } from "./types.ts";

/* ── Dates ─────────────────────────────────────────────────────────── */

export const LETTER_TIME_ZONE = "America/Los_Angeles";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-11-08" for a moment, in Pacific time. */
export function pacificDate(at: Date | string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LETTER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const m = ISO_DATE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Aug 1 of the school year `today` is in. */
export function schoolYearStart(today: string): string {
  const m = ISO_DATE.exec(today);
  if (!m) throw new Error(`not a date: ${today}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  return `${month >= 8 ? year : year - 1}-08-01`;
}

/** The request form's default range: the school year so far (Aug 1 to today). */
export function defaultLetterPeriod(now: Date = new Date()): { start: string; end: string } {
  const today = pacificDate(now);
  return { start: schoolYearStart(today), end: today };
}

export type PeriodCheck =
  | { ok: true; start: string; end: string }
  | { ok: false; error: string; field: "start" | "end" };

/** The request's date range, checked: real dates, in order, not in the future. */
export function checkLetterPeriod(start: unknown, end: unknown, today: string): PeriodCheck {
  if (!isIsoDate(start)) return { ok: false, error: "Pick a start date.", field: "start" };
  if (!isIsoDate(end)) return { ok: false, error: "Pick an end date.", field: "end" };
  if (end > today) return { ok: false, error: "The end date can't be after today.", field: "end" };
  if (start > end) return { ok: false, error: "The start date has to come before the end date.", field: "start" };
  return { ok: true, start, end };
}

/** "November 8, 2026". */
export function longDate(date: string): string {
  const m = ISO_DATE.exec(date);
  if (!m) return date;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** "Nov 8, 2026". */
export function shortDate(date: string): string {
  const m = ISO_DATE.exec(date);
  if (!m) return date;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ── Which classes count (section 9.1) ─────────────────────────────── */

/** One class as the letters code reads it from the classes table. */
export type LetterSourceClass = {
  id: string;
  teacherId: string | null;
  status: string;
  rtkApp: string;
  startsAt: string;
  creditedMinutes: number | null;
  title: string;
  topic: string | null;
};

/**
 * A class counts toward a teacher's letter when it's approved, they taught
 * it, it belongs to this deployment's RealtimeKit app (dev test classes never
 * reach a real letter), it has frozen credited minutes above zero (an empty
 * room earns nothing, so it isn't a class taught), and its Pacific date is in
 * the range. Oldest first.
 */
export function classesForLetter(
  source: readonly LetterSourceClass[],
  filter: { teacherId: string; app: string; start: string; end: string }
): HoursLetterClass[] {
  return source
    .filter(
      (c) =>
        c.status === "approved" &&
        c.teacherId === filter.teacherId &&
        c.rtkApp === filter.app &&
        typeof c.creditedMinutes === "number" &&
        c.creditedMinutes > 0
    )
    .map((c) => ({
      classId: c.id,
      date: pacificDate(c.startsAt),
      title: c.title,
      topic: c.topic,
      minutes: c.creditedMinutes as number,
      startsAt: c.startsAt,
    }))
    .filter((c) => c.date >= filter.start && c.date <= filter.end)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.classId.localeCompare(b.classId))
    .map(({ classId, date, title, topic, minutes }) => ({ classId, date, title, topic, minutes }));
}

/** The letter's two figures. */
export function letterTotals(classes: readonly HoursLetterClass[]): { totalMinutes: number; classCount: number } {
  return {
    totalMinutes: classes.reduce((sum, c) => sum + c.minutes, 0),
    classCount: classes.length,
  };
}

/** "2 hours 15 minutes", "1 hour", "45 minutes", "0 minutes". */
export function hoursAndMinutes(totalMinutes: number): string {
  const total = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const hours = `${h} ${h === 1 ? "hour" : "hours"}`;
  const minutes = `${m} ${m === 1 ? "minute" : "minutes"}`;
  if (h === 0) return minutes;
  if (m === 0) return hours;
  return `${hours} ${minutes}`;
}

/* ── Approving: does the request still match the records? ──────────── */

/** A class as it stands now, for the check at signing time. */
export type CurrentClass = {
  teacherId: string | null;
  status: string;
  rtkApp: string;
  creditedMinutes: number | null;
};

/**
 * What changed between a request's snapshot and the records, one sentence
 * per class. Empty means the letter can be signed as requested. A letter
 * only ever certifies classes that are approved right now, for the minutes
 * on file right now.
 */
export function snapshotDrift(
  snapshot: readonly HoursLetterClass[],
  current: ReadonlyMap<string, CurrentClass>,
  teacherId: string,
  app: string
): string[] {
  const out: string[] = [];
  for (const c of snapshot) {
    const now = current.get(c.classId);
    const label = `"${c.title}" (${shortDate(c.date)})`;
    if (!now) out.push(`${label} isn't in the records any more.`);
    else if (now.teacherId !== teacherId || now.rtkApp !== app) out.push(`${label} isn't theirs any more.`);
    else if (now.status !== "approved") out.push(`${label} isn't approved any more.`);
    else if (now.creditedMinutes !== c.minutes)
      out.push(`${label} is ${now.creditedMinutes ?? 0} minutes now, not ${c.minutes}.`);
  }
  return out;
}

/* ── Codes (LF-XXXXX-XXXXX) ────────────────────────────────────────── */

/**
 * No 0/O, 1/I/L or U, so a code read off paper can't be mistyped into a
 * different valid code. 30 symbols, 10 places: about 6 x 10^14 codes, so
 * guessing one on a rate-limited page is hopeless.
 */
export const LETTER_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export const LETTER_CODE_PATTERN = new RegExp(
  `^LF-[${LETTER_CODE_ALPHABET}]{5}-[${LETTER_CODE_ALPHABET}]{5}$`
);

/** A new code. `randomIndex(n)` must return a uniform integer in [0, n). */
export function makeLetterCode(randomIndex: (n: number) => number): string {
  let body = "";
  for (let i = 0; i < 10; i++) body += LETTER_CODE_ALPHABET[randomIndex(LETTER_CODE_ALPHABET.length)];
  return `LF-${body.slice(0, 5)}-${body.slice(5)}`;
}

/**
 * A code as someone typed or pasted it ("lf-abcde-fghjk", "LF ABCDE FGHJK",
 * "LFABCDEFGHJK") in its stored form, or null when it can't be one.
 */
export function normalizeLetterCode(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 40) return null;
  const compact = raw.toUpperCase().replace(/[\s\-_.]/g, "");
  if (!/^LF[A-Z0-9]{10}$/.test(compact)) return null;
  const code = `LF-${compact.slice(2, 7)}-${compact.slice(7)}`;
  return LETTER_CODE_PATTERN.test(code) ? code : null;
}

/** The verify page's address for a code: also exactly what the QR code holds. */
export function verifyUrlFor(siteUrl: string, code: string): string {
  return `${siteUrl.replace(/\/$/, "")}/verify/${code}`;
}

/** "learnfrc.com/verify/LF-...": the address printed under the QR code. */
export function verifyUrlLabel(siteUrl: string, code: string): string {
  return verifyUrlFor(siteUrl, code).replace(/^https?:\/\//, "");
}

/* ── The letter's words (section 9.2 step 4) ───────────────────────── */

export type LetterFacts = {
  name: string;
  start: string;
  end: string;
  classCount: number;
  totalMinutes: number;
};

/** The two paragraphs every letter carries, word for word. */
export function letterParagraphs(f: LetterFacts): { confirms: string; howChecked: string } {
  const classes = `${f.classCount} live online ${f.classCount === 1 ? "class" : "classes"}`;
  return {
    confirms:
      `This letter confirms, from LearnFRC's records, that ${f.name} volunteered as a teacher with ` +
      `LearnFRC (learnfrc.com), a free, student-run site that teaches FIRST Robotics Competition skills. ` +
      `Between ${longDate(f.start)} and ${longDate(f.end)}, ${f.name} taught ${classes}, for ` +
      `${hoursAndMinutes(f.totalMinutes)} of teaching time.`,
    howChecked:
      `How we checked: the time comes from the class video service's join and leave records, counting only ` +
      `minutes while ${f.name} was teaching and at least one student was in the room, and only for classes ` +
      `LearnFRC reviewed and approved. Every class was recorded and reviewed afterwards. An adult volunteer ` +
      `wasn't present for every class.`,
  };
}

/** The note next to the request button (section 9.2). */
export const SCHOOL_RULES_NOTE =
  "Check your school's rules first. Some schools don't count online service, some need a registered " +
  "nonprofit, and some want an adult present at every session. Misreporting hours means removal from " +
  "teaching and withdrawn letters.";

/** The footer line under every letter. */
export const NOT_A_NONPROFIT = "LearnFRC is an independent, student-run project, not a registered nonprofit.";
