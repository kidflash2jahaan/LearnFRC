"use client";

import { useSyncExternalStore } from "react";
import {
  CLASS_TIME_ZONE,
  LOCAL_ZONE,
  formatClassTime,
  type ClassTimeStyle,
} from "@/lib/classes/class-time";

/**
 * A class time in the reader's own time zone (classes-design.md section 11).
 *
 * The server can't know where the reader is, so the server render (and the
 * browser's first render, which has to match it) shows Pacific time with a
 * "PT" label, the zone LearnFRC's emails use. Right after hydration it
 * switches to the reader's local zone. Both go through formatClassTime
 * (src/lib/classes/class-time.ts), the one helper every class page, admin
 * page and email uses, so a reader in California sees "5:00 PM PT" both
 * times, and anyone else their own zone with its own label ("ET", "GMT+1").
 *
 * NO HYDRATION MISMATCH, on purpose. The Pacific text is built from numbers,
 * not from a locale string (class-time.ts says why), and switching zones
 * uses useSyncExternalStore (server snapshot false, client snapshot true),
 * React's own way to render one thing during hydration and another after it,
 * with no effect setting state.
 */

const noopSubscribe = () => () => {};

/** False during the server render and hydration, true right after. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

/** Pacific for the server render and hydration, the reader's zone after. */
export function useClassTimeZone(): string {
  return useHydrated() ? LOCAL_ZONE : CLASS_TIME_ZONE;
}

export type LocalTimeStyle = ClassTimeStyle;

/**
 * One class time. `end` is for the "range" style ("5:00 to 6:00 PM PT").
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
  const timeZone = useClassTimeZone();
  return (
    <time dateTime={iso} className={className}>
      {formatClassTime(iso, style, { timeZone, end })}
    </time>
  );
}
