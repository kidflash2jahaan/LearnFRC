"use client";

import { useSyncExternalStore } from "react";

/**
 * A class time in the reader's own time zone (classes-design.md section 11).
 *
 * The server can't know where the reader is, so the server render (and the
 * browser's first render, which has to match it) shows Pacific time with a
 * "PT" label, the zone LearnFRC's emails use. Right after hydration it
 * switches to the reader's local zone with its own label ("EST", "GMT+1").
 *
 * NO HYDRATION MISMATCH, on purpose. The Pacific text is built from numbers
 * (formatToParts with numeric fields) and this file's own month and weekday
 * tables, not from a locale string, because toLocaleString gives different
 * spacing on different ICU builds and the server and the browser would then
 * disagree. Switching zones uses useSyncExternalStore (server snapshot false,
 * client snapshot true), React's own way to render one thing during
 * hydration and another after it, with no effect setting state.
 */

const PACIFIC = "America/Los_Angeles";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const noopSubscribe = () => () => {};

/** False during the server render and hydration, true right after. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

export type ZonedParts = {
  year: number;
  /** 1 to 12. */
  month: number;
  day: number;
  /** 0 to 23. */
  hour: number;
  minute: number;
  /** 0 (Sunday) to 6. */
  weekday: number;
  /** "PT" before hydration, then the reader's own short zone name. */
  zone: string;
};

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatterFor(timeZone: string | undefined): Intl.DateTimeFormat {
  const key = timeZone ?? "local";
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
      timeZoneName: timeZone ? undefined : "short",
    });
    formatters.set(key, f);
  }
  return f;
}

/**
 * The date and time parts of `iso` in Pacific time (local = false) or the
 * reader's zone (local = true, only after hydration).
 */
export function zonedParts(iso: string, local: boolean): ZonedParts | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = formatterFor(local ? undefined : PACIFIC).formatToParts(d);
  const num = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? NaN);
  const year = num("year");
  const month = num("month");
  const day = num("day");
  const hour = num("hour") % 24;
  const minute = num("minute");
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) return null;
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const zone = local ? (parts.find((p) => p.type === "timeZoneName")?.value ?? "") : "PT";
  return { year, month, day, hour, minute, weekday, zone };
}

function clock(p: ZonedParts, withMeridiem = true): string {
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const mm = String(p.minute).padStart(2, "0");
  return `${h12}:${mm}${withMeridiem ? ` ${p.hour < 12 ? "AM" : "PM"}` : ""}`;
}

/** "Thursday, November 20" */
export function dayLabel(p: ZonedParts): string {
  return `${DAYS_LONG[p.weekday]}, ${MONTHS_LONG[p.month - 1]} ${p.day}`;
}

/** "2026-11-20", for grouping by day. */
export function dayKey(p: ZonedParts): string {
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export type LocalTimeStyle = "datetime" | "date" | "time" | "range";

/** The text for one time, in one zone. */
export function formatClassTime(
  iso: string,
  style: LocalTimeStyle,
  local: boolean,
  endIso?: string
): string {
  const p = zonedParts(iso, local);
  if (!p) return "";
  const zone = p.zone ? ` ${p.zone}` : "";
  switch (style) {
    case "date":
      return dayLabel(p);
    case "time":
      return `${clock(p)}${zone}`;
    case "range": {
      const e = endIso ? zonedParts(endIso, local) : null;
      if (!e) return `${clock(p)}${zone}`;
      const sameHalf = (p.hour < 12) === (e.hour < 12);
      return `${clock(p, !sameHalf)} to ${clock(e)}${zone}`;
    }
    default:
      return `${DAYS_SHORT[p.weekday]}, ${MONTHS_SHORT[p.month - 1]} ${p.day}, ${clock(p)}${zone}`;
  }
}

/**
 * One class time. `end` is for the "range" style ("5:00 to 6:00 PM PST").
 * Renders a <time> with the exact instant in `dateTime`.
 */
export function LocalTime({
  iso,
  end,
  style = "datetime",
  className,
}: {
  iso: string;
  end?: string;
  style?: LocalTimeStyle;
  className?: string;
}) {
  const hydrated = useHydrated();
  return (
    <time dateTime={iso} className={className}>
      {formatClassTime(iso, style, hydrated, end)}
    </time>
  );
}
