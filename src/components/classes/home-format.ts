/**
 * Plain helpers for the homepage's class cards (src/components/classes/
 * home-section.tsx). No imports, so the client time component can use them
 * and `node --test` can run them.
 *
 * The homepage is cached and shared by everyone, so a card's time is printed
 * in UTC on the server and swapped for the reader's own time zone once the
 * page is running in their browser (home-class-time.tsx). The UTC form is
 * built by hand, not with Intl, so the server and the browser produce the
 * exact same characters during hydration whatever ICU each one ships.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "Fri, Nov 20, 1:00 AM UTC". The same string on every machine. */
export function formatClassWhenUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h24 = d.getUTCHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ampm = h24 < 12 ? "AM" : "PM";
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${h12}:${mm} ${ampm} UTC`;
}

/**
 * "Thu, Nov 19, 5:00 PM PST" in the reader's time zone (or `timeZone`, for
 * tests). Browser only after hydration: Intl output differs between ICU
 * builds, which is fine once nothing has to match the server's HTML.
 */
export function formatClassWhenLocal(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      ...(timeZone ? { timeZone } : {}),
    })
      .format(d)
      .replace(/[  ]/g, " ");
  } catch {
    return formatClassWhenUtc(iso);
  }
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
