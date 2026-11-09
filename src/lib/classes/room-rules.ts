/**
 * The room's pure rules (sections 6.4, 6.6 and 12): when someone may join,
 * whether a class is live now, and the monthly participant-minute cap.
 *
 * Imports only ./constants.ts (itself import-free), so node --test runs it
 * and client components can use it too. Unit tested (room-rules.test.ts).
 */

import { CLASS_LIMITS, earliestJoinFor } from "./constants.ts";

export type JoinRole = "teacher" | "student" | "staff";

/** Where now falls against a role's join window [earliest join, hard end). */
export type JoinTiming = "early" | "open" | "over";

export function joinTiming(
  now: Date,
  startsAt: Date | string,
  hardEndAt: Date | string,
  role: JoinRole
): JoinTiming {
  const opens = earliestJoinFor(new Date(startsAt), role).getTime();
  const closes = new Date(hardEndAt).getTime();
  const t = now.getTime();
  if (t >= closes) return "over";
  if (t < opens) return "early";
  return "open";
}

/**
 * A class counts as live now when its status is `live`, or it's still
 * `scheduled` but inside the teacher's join window (the webhook that flips
 * it to `live` may not have arrived, and a report filed from the room must
 * still be treated as live). Never after the hard end.
 */
export function isLiveNow(
  cls: { status: string; starts_at: string | Date; hard_end_at: string | Date },
  now: Date = new Date()
): boolean {
  const hardEnd = new Date(cls.hard_end_at).getTime();
  if (now.getTime() >= hardEnd) return false;
  if (cls.status === "live") return true;
  if (cls.status !== "scheduled") return false;
  return now.getTime() >= earliestJoinFor(new Date(cls.starts_at), "teacher").getTime();
}

/** Whether a reporter is still inside the 30-day window after a class. */
export function withinReportWindow(hardEndAt: Date | string, now: Date = new Date()): boolean {
  return now.getTime() <= new Date(hardEndAt).getTime() + CLASS_LIMITS.reportWindowDays * 86_400_000;
}

/* ── The monthly participant-minute cap (section 12) ───────────────── */

/** Jahaan gets one warning a month once this share of the cap is used. */
export const MINUTE_CAP_WARN_SHARE = 0.75;

/** The first instant of now's month, UTC (the cap resets then). */
export function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** "2026-11": the month a warning is for. */
export function monthKey(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Participant-minutes used this month, from attendance rows. An open row (no
 * left_at) counts up to now, but never past its class's hard end, so a missed
 * leave event can't run the meter forever. Rows are clipped to the month.
 */
export function participantMinutes(
  rows: readonly { joinedAt: string | Date; leftAt: string | Date | null; closesAt?: string | Date | null }[],
  now: Date
): number {
  const from = monthStartUtc(now).getTime();
  const t = now.getTime();
  let ms = 0;
  for (const r of rows) {
    const a = Math.max(new Date(r.joinedAt).getTime(), from);
    let b = r.leftAt ? new Date(r.leftAt).getTime() : t;
    if (!r.leftAt && r.closesAt) b = Math.min(b, new Date(r.closesAt).getTime());
    b = Math.min(b, t);
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) ms += b - a;
  }
  return Math.floor(ms / 60_000);
}

/** Under the cap, past the warning line, or at the cap. */
export function capState(used: number, cap: number): "ok" | "warn" | "over" {
  if (cap <= 0 || used >= cap) return "over";
  if (used >= cap * MINUTE_CAP_WARN_SHARE) return "warn";
  return "ok";
}
