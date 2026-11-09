/**
 * Who had a camera or screen share on in a class (sections 6.5 and 6.7).
 *
 * The AI review can't see video, so every browser in the room reports the
 * camera and screen-share changes it sees, its own and everyone else's
 * (src/app/classes/[id]/room/_media-log.tsx posts them to
 * POST /api/classes/[id]/media-log, which stores class_media_events). One
 * tampered client can't hide a teacher's camera, because the others still
 * report it.
 *
 *   parseMediaBatch  checks what a browser posted (the route's input).
 *   mediaIntervals   each reporter's on/off spans, unioned per person.
 *   mediaMinutes     those spans as minutes per person: the review's
 *                    camera and screen-share minutes and code flags.
 *
 * Pure, imports only ./minutes.ts (the Foundation's interval helpers), unit
 * tested (media.test.ts), safe in client components.
 */

import { toMs, totalMs, unionIntervals, type Interval, type TimeInput } from "./minutes.ts";

export type { Interval };

export type MediaKindName = "camera" | "screenshare";

/** One change as a browser reports it (the route's body is { events: [...] }). */
export type MediaLogEvent = {
  /** Whose media changed: their user id (RealtimeKit's customParticipantId). */
  subject: string;
  kind: MediaKindName;
  on: boolean;
  /** When the browser saw it, ISO 8601. */
  at: string;
};

/** A stored change (class_media_events, camelCased or as the row). */
export type MediaEventInput =
  | {
      subjectUserId: string | null;
      kind: MediaKindName;
      isOn: boolean;
      at: TimeInput;
      reportedBy: string | null;
    }
  | {
      subject_user_id: string | null;
      kind: MediaKindName;
      is_on: boolean;
      at: TimeInput;
      reported_by: string | null;
    };

export const MEDIA_LOG_LIMITS = {
  /** The logger posts at most this often (and on pagehide). */
  flushEveryMs: 15_000,
  /** Events per post. A class has at most ~20 people and 2 kinds each. */
  maxEvents: 200,
  /** A browser clock this far ahead of the server is still believed. */
  maxFutureMs: 60_000,
  /** Posts per person per minute (rateLimitKey "class-media"). */
  postsPerMinute: 30,
} as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS: readonly MediaKindName[] = ["camera", "screenshare"];

/* ── The route's input ─────────────────────────────────────────────── */

/**
 * What a browser posted, checked: { events: [{ subject, kind, on, at }] }.
 * Drops anything malformed, anything outside [from, until] (the class's join
 * window) or later than `now` plus a minute, and exact duplicates; keeps at
 * most MEDIA_LOG_LIMITS.maxEvents. Null when the body isn't that shape at all.
 */
export function parseMediaBatch(
  body: unknown,
  opts: { now: Date; from?: Date | null; until?: Date | null }
): { events: MediaLogEvent[]; dropped: number } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const raw = (body as { events?: unknown }).events;
  if (!Array.isArray(raw)) return null;

  const latest = opts.now.getTime() + MEDIA_LOG_LIMITS.maxFutureMs;
  const from = opts.from ? opts.from.getTime() : -Infinity;
  const until = Math.min(opts.until ? opts.until.getTime() : Infinity, latest);
  const seen = new Set<string>();
  const events: MediaLogEvent[] = [];
  let dropped = 0;

  for (const item of raw) {
    if (events.length >= MEDIA_LOG_LIMITS.maxEvents) {
      dropped++;
      continue;
    }
    const e = item as Partial<Record<keyof MediaLogEvent, unknown>> | null;
    const ok =
      !!e &&
      typeof e === "object" &&
      typeof e.subject === "string" &&
      UUID.test(e.subject) &&
      typeof e.kind === "string" &&
      (KINDS as readonly string[]).includes(e.kind) &&
      typeof e.on === "boolean" &&
      typeof e.at === "string";
    const at = ok ? Date.parse(e!.at as string) : NaN;
    if (!ok || !Number.isFinite(at) || at < from || at > until) {
      dropped++;
      continue;
    }
    const clean: MediaLogEvent = {
      subject: (e!.subject as string).toLowerCase(),
      kind: e!.kind as MediaKindName,
      on: e!.on as boolean,
      at: new Date(at).toISOString(),
    };
    const key = `${clean.subject}|${clean.kind}|${clean.on}|${clean.at}`;
    if (seen.has(key)) {
      dropped++;
      continue;
    }
    seen.add(key);
    events.push(clean);
  }
  return { events, dropped };
}

/* ── Intervals ─────────────────────────────────────────────────────── */

function normalize(e: MediaEventInput) {
  if ("subject_user_id" in e) {
    return { subject: e.subject_user_id, kind: e.kind, on: e.is_on, at: toMs(e.at), reporter: e.reported_by };
  }
  return { subject: e.subjectUserId, kind: e.kind, on: e.isOn, at: toMs(e.at), reporter: e.reportedBy };
}

export type MediaSpans = Record<string, { camera: Interval[]; screenshare: Interval[] }>;

/**
 * Each person's camera and screen-share time, as unioned intervals.
 *
 * Per reporter, per person, per kind: an "on" opens a span (a repeated "on"
 * keeps the first), an "off" closes it, an "off" with nothing open is
 * ignored. A span still open at the end closes at `until` (the class's end),
 * which can only overcount, the safe direction for a safety review. Then
 * every reporter's spans for that person and kind are unioned, so two
 * browsers seeing the same camera count it once. Everything is clipped to
 * [from, until].
 */
export function mediaIntervals(
  events: readonly MediaEventInput[],
  opts: { until: TimeInput; from?: TimeInput | null }
): MediaSpans {
  const until = toMs(opts.until);
  const from = opts.from === undefined || opts.from === null ? -Infinity : toMs(opts.from);

  // Stable: equal times keep the order they were stored in.
  const rows = events
    .map((e, i) => ({ ...normalize(e), i }))
    .filter((e) => e.subject && Number.isFinite(e.at) && KINDS.includes(e.kind))
    .sort((a, b) => a.at - b.at || a.i - b.i);

  const open = new Map<string, number>();
  const spans = new Map<string, Interval[]>();
  const keyOf = (subject: string, kind: MediaKindName) => `${subject}|${kind}`;
  const push = (subject: string, kind: MediaKindName, a: number, b: number) => {
    const s = Math.max(a, from);
    const t = Math.min(b, until);
    if (t <= s) return;
    const k = keyOf(subject, kind);
    spans.set(k, [...(spans.get(k) ?? []), { start: s, end: t }]);
  };

  for (const e of rows) {
    const reporterKey = `${e.reporter ?? "?"}|${e.subject}|${e.kind}`;
    const started = open.get(reporterKey);
    if (e.on) {
      if (started === undefined) open.set(reporterKey, e.at);
    } else if (started !== undefined) {
      push(e.subject!, e.kind, started, e.at);
      open.delete(reporterKey);
    }
  }
  for (const [reporterKey, started] of open) {
    const [, subject, kind] = reporterKey.split("|");
    push(subject, kind as MediaKindName, started, until);
  }

  const out: MediaSpans = {};
  for (const [k, list] of spans) {
    const [subject, kind] = k.split("|") as [string, MediaKindName];
    out[subject] ??= { camera: [], screenshare: [] };
    out[subject][kind] = unionIntervals(list);
  }
  return out;
}

/**
 * Minutes each person had a camera or a screen share on (section 6.7),
 * rounded UP, so a 20-second student camera still shows as 1 minute and
 * still raises its flag. People with none are left out.
 */
export function mediaMinutes(
  events: readonly MediaEventInput[],
  opts: { until: TimeInput; from?: TimeInput | null }
): { cameraMinutes: Record<string, number>; screenshareMinutes: Record<string, number> } {
  const spans = mediaIntervals(events, opts);
  const cameraMinutes: Record<string, number> = {};
  const screenshareMinutes: Record<string, number> = {};
  for (const [subject, s] of Object.entries(spans)) {
    const cam = totalMs(s.camera);
    const share = totalMs(s.screenshare);
    if (cam > 0) cameraMinutes[subject] = Math.ceil(cam / 60_000);
    if (share > 0) screenshareMinutes[subject] = Math.ceil(share / 60_000);
  }
  return { cameraMinutes, screenshareMinutes };
}

/** The sum of a minutes map (the review's camera_minutes and screenshare_minutes). */
export function sumMinutes(m: Record<string, number>): number {
  return Object.values(m).reduce((a, b) => a + b, 0);
}
