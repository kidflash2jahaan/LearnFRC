/**
 * Plain helpers for the homepage's class cards (src/components/classes/
 * home-section.tsx). They import only the pure class-time helper, so the
 * client time component can use them and `node --test` can run them.
 *
 * The homepage is cached and shared by everyone, so a card's time is printed
 * in UTC on the server and swapped for the reader's own time zone once the
 * page is running in their browser (home-class-time.tsx). Both go through
 * formatClassTime (src/lib/classes/class-time.ts), like every other class
 * time. It builds the text from numbers, not a locale string, so the server
 * and the browser produce the exact same characters during hydration
 * whatever ICU each one ships.
 */

import { LOCAL_ZONE, formatClassTime } from "../../lib/classes/class-time.ts";

/** "Fri, Nov 20, 1:00 AM UTC". The same string on every machine. */
export function formatClassWhenUtc(iso: string): string {
  return formatClassTime(iso, "datetime", { timeZone: "UTC" });
}

/**
 * "Thu, Nov 19, 5:00 PM PT" in the reader's time zone (or `timeZone`, for
 * tests), labeled the way every class time is ("PT", "ET", "GMT+1"). Browser
 * only, after hydration. A zone this runtime doesn't know falls back to UTC.
 */
export function formatClassWhenLocal(iso: string, timeZone?: string): string {
  return formatClassTime(iso, "datetime", { timeZone: timeZone ?? LOCAL_ZONE }) || formatClassWhenUtc(iso);
}

/** "45 min", "90 min". */
export function lengthLabel(minutes: number): string {
  return `${Math.max(0, Math.round(minutes))} min`;
}

/** "9 seats left", "1 seat left", "full". */
export function seatsLabel(seats: { left: number }): string {
  const left = Math.max(0, Math.floor(seats.left));
  if (left === 0) return "full";
  return left === 1 ? "1 seat left" : `${left} seats left`;
}

/** "lesson / Wiring a CAN bus", or null when the class has no topic. */
export function topicLine(topic: { kind: "lesson" | "module"; title: string } | null): string | null {
  if (!topic || !topic.title.trim()) return null;
  return `${topic.kind} / ${topic.title.trim()}`;
}
