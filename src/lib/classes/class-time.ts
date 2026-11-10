/**
 * Every class time LearnFRC prints goes through here: /classes, the class
 * pages, the teaching page, the room, the homepage cards, /admin and every
 * classes email (classes-design.md section 11).
 *
 * The zone. Pacific is what the server prints: admin pages, emails, and the
 * first render of every class page (which hydration has to match). In the
 * browser, right after hydration, LocalTime (src/components/classes/
 * local-time.tsx) asks for "local", the reader's own zone.
 *
 * The label. One form everywhere: a US zone by its plain name, "PT", like the
 * emails' "Pacific time" ("MT", "CT" and "ET" too), never "PST" or "PDT". So a
 * reader in California sees "5:00 PM PT" before hydration, after it, and on
 * every page and email. Other zones keep the browser's short name ("GMT+1").
 *
 * The text is built from numbers (formatToParts with numeric fields) and this
 * file's own month and weekday tables, not from a locale string, because
 * toLocaleString spaces things differently on different ICU builds (newer
 * ones put a narrow no-break space before "PM"), and the server and the
 * browser would then disagree.
 *
 * No imports and no "server-only", so server pages, client components,
 * emails and `node --test` (class-time.test.ts) all run the same code.
 */

/** Pacific: the zone of every server render, admin page and email. */
export const CLASS_TIME_ZONE = "America/Los_Angeles";

/** As a `timeZone`: the zone of the machine running this (the reader's, in the browser). */
export const LOCAL_ZONE = "local";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Labels that don't depend on the ICU build. */
const FIXED_LABELS: Record<string, string> = { [CLASS_TIME_ZONE]: "PT", UTC: "UTC" };

/** The browser's short names for US zones, by their plain names. */
const PLAIN_US: Record<string, string> = {
  PST: "PT",
  PDT: "PT",
  MST: "MT",
  MDT: "MT",
  CST: "CT",
  CDT: "CT",
  EST: "ET",
  EDT: "ET",
};

/** "PT" for "PST" or "PDT", and so on; any other zone name as it is. */
export function zoneLabel(shortName: string): string {
  return PLAIN_US[shortName] ?? shortName;
}

export type ClassTimeParts = {
  year: number;
  /** 1 to 12. */
  month: number;
  day: number;
  /** 0 to 23. */
  hour: number;
  minute: number;
  /** 0 (Sunday) to 6. */
  weekday: number;
  /** "PT", "ET", "GMT+1". */
  zone: string;
};

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone === LOCAL_ZONE ? undefined : timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
      timeZoneName: FIXED_LABELS[timeZone] ? undefined : "short",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/**
 * The date and time parts of `at` in `timeZone` (an IANA zone, or LOCAL_ZONE;
 * Pacific by default). Null for a bad date or a zone this runtime doesn't know.
 */
export function classTimeParts(at: string | Date, timeZone: string = CLASS_TIME_ZONE): ClassTimeParts | null {
  const d = typeof at === "string" ? new Date(at) : at;
  if (Number.isNaN(d.getTime())) return null;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = formatterFor(timeZone).formatToParts(d);
  } catch {
    return null;
  }
  const num = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? NaN);
  const year = num("year");
  const month = num("month");
  const day = num("day");
  const hour = num("hour") % 24;
  const minute = num("minute");
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) return null;
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const zone = FIXED_LABELS[timeZone] ?? zoneLabel(parts.find((p) => p.type === "timeZoneName")?.value ?? "");
  return { year, month, day, hour, minute, weekday, zone };
}

function clock(p: ClassTimeParts, withMeridiem = true): string {
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const mm = String(p.minute).padStart(2, "0");
  return `${h12}:${mm}${withMeridiem ? ` ${p.hour < 12 ? "AM" : "PM"}` : ""}`;
}

/** "Thursday, November 20" */
export function dayLabel(p: ClassTimeParts): string {
  return `${DAYS_LONG[p.weekday]}, ${MONTHS_LONG[p.month - 1]} ${p.day}`;
}

/** "2026-11-20", for grouping by day. */
export function dayKey(p: ClassTimeParts): string {
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 *   datetime  "Thu, Nov 20, 5:00 PM PT"
 *   date      "Thursday, November 20"
 *   day       "Thu, Nov 20"
 *   time      "5:00 PM PT"
 *   range     "5:00 to 6:00 PM PT" (with `end`)
 */
export type ClassTimeStyle = "datetime" | "date" | "day" | "time" | "range";

/** One class time as text. "" for a bad date or an unknown zone. */
export function formatClassTime(
  at: string | Date,
  style: ClassTimeStyle = "datetime",
  opts: { timeZone?: string; end?: string | Date } = {}
): string {
  const timeZone = opts.timeZone ?? CLASS_TIME_ZONE;
  const p = classTimeParts(at, timeZone);
  if (!p) return "";
  const zone = p.zone ? ` ${p.zone}` : "";
  switch (style) {
    case "date":
      return dayLabel(p);
    case "day":
      return `${DAYS_SHORT[p.weekday]}, ${MONTHS_SHORT[p.month - 1]} ${p.day}`;
    case "time":
      return `${clock(p)}${zone}`;
    case "range": {
      const e = opts.end ? classTimeParts(opts.end, timeZone) : null;
      if (!e) return `${clock(p)}${zone}`;
      const sameHalf = (p.hour < 12) === (e.hour < 12);
      return `${clock(p, !sameHalf)} to ${clock(e)}${zone}`;
    }
    default:
      return `${DAYS_SHORT[p.weekday]}, ${MONTHS_SHORT[p.month - 1]} ${p.day}, ${clock(p)}${zone}`;
  }
}

/** "Thu, Nov 20, 5:00 PM PT": admin pages and emails, always Pacific. */
export function pacificTime(at: string | Date): string {
  return formatClassTime(at, "datetime");
}
