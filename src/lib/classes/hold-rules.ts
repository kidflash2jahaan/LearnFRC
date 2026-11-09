/**
 * Evidence holds: the pure rules (classes-design.md sections 3.8 and 8.2).
 *
 * No imports besides types and no `server-only`, so `node --test` runs them
 * and the holds pages can share them. Everything that reads the database,
 * RealtimeKit or R2 is in ./holds.ts and ./r2.ts.
 */
import type { ClassRole, HoldReason, HoldRecordingStatus } from "./types.ts";

const DAY_MS = 86_400_000;

/** A hold lasts a year from when it's taken (the 2258A preservation period). */
export const HOLD_DAYS = 365;

/** Held recordings go up in parts of this size (R2 wants equal parts but the last). */
export const RECORDING_PART_BYTES = 10 * 1024 * 1024;

/** How long the review page's or the holds page's recording link lasts. */
export const RECORDING_LINK_SECONDS = 15 * 60;

/** A copy marked "copying" longer than this is treated as stopped (functions get 300 s). */
export const COPY_STALE_MS = 6 * 60_000;

/** A failed copy is tried again after this long, while the source link lasts. */
export const COPY_RETRY_MS = 30 * 60_000;

/** A peer report that couldn't be fetched is tried again after this long. */
export const PEER_RETRY_MS = 6 * 60 * 60_000;

/** Cloudflare keeps call analytics 6 months; after this, a retry can't help. */
export const PEER_RETRY_WITHIN_DAYS = 150;

/** At most this many peer reports per person per hold (a person rarely has more than 3). */
export const PEERS_PER_PERSON = 12;

/** Notes: each entry, and the whole field. */
export const HOLD_NOTE_MAX = 1000;
export const HOLD_NOTES_TOTAL_MAX = 20_000;

/** NCMEC report numbers are digits; allow a little more, never free text. */
export const NCMEC_ID_PATTERN = /^[A-Za-z0-9-]{1,40}$/;

/** What each reason is called on the holds pages. */
export const HOLD_REASON_LABELS: Record<HoldReason, string> = {
  urgent_flag: "Urgent flag in the review",
  refusal: "The AI refused to review it",
  class_report: "A report about the class",
  auto_end: "Ended after two reports",
  ban: "Account banned",
  self_delete_open_case: "Deleted their account with an open case",
  reject_safety: "Rejected for safety",
  manual: "Held by hand",
};

export const HOLD_RECORDING_LABELS: Record<HoldRecordingStatus, string> = {
  none: "No recording yet",
  copying: "Copying to the holds bucket",
  stored: "Kept in the holds bucket",
  failed: "Copy failed, retrying while the link lasts",
  gone: "Not kept: the link expired first",
};

/** When a hold taken now expires. */
export function holdExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + HOLD_DAYS * DAY_MS);
}

/** The later of the two: a new event never shortens a hold. */
export function laterOf(a: string | Date | null | undefined, b: Date): Date {
  if (!a) return b;
  const t = new Date(a).getTime();
  return Number.isFinite(t) && t > b.getTime() ? new Date(t) : b;
}

/* ── Who sees what ─────────────────────────────────────────────────── */

/**
 * A hold is restricted (the safety lead only) while it hasn't been released
 * and either its class's review is restricted (grooming, sexual content,
 * sextortion, a refusal) or the hold itself was taken for a refusal (which can
 * land before the review row says so). Section 7.6.
 */
export function isHoldRestricted(input: {
  reason: HoldReason;
  releasedAt: string | null;
  reviewRestricted: boolean | null | undefined;
}): boolean {
  if (input.releasedAt) return false;
  return input.reviewRestricted === true || input.reason === "refusal";
}

/* ── Recording copies ──────────────────────────────────────────────── */

/** Every held recording of a class lives under one prefix in the bucket. */
export function holdRecordingPrefix(classId: string): string {
  return `holds/${safeSegment(classId)}/`;
}

/** One session's composite recording. */
export function holdRecordingKey(classId: string, sessionId: string): string {
  return `${holdRecordingPrefix(classId)}${safeSegment(sessionId)}.mp4`;
}

function safeSegment(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "_";
}

export type SessionCopyStatus = "copying" | "stored" | "failed" | "gone";

/** The latest ledger entry for one session (class_events kind "hold_recording"). */
export type SessionCopyState = {
  sessionId: string;
  status: SessionCopyStatus;
  at: string;
  error?: string | null;
  bytes?: number | null;
  /** The R2 key, when a copy was actually attempted in the bucket. */
  key?: string | null;
};

/** One session's recording, as class_sessions has it. */
export type SessionRecording = {
  sessionId: string;
  recordingUrl: string | null;
  recordingExpiresAt: string | null;
};

export type CopyPlan =
  | { action: "copy"; sessionId: string; url: string }
  | { action: "gone"; sessionId: string }
  | { action: "skip"; sessionId: string; why: "no_recording" | "stored" | "in_progress" | "backoff" | "gone" };

/**
 * What to do with each session's recording right now. A copy runs when the
 * source link is still valid and nothing is stored, unless one started in the
 * last 6 minutes (still running) or failed in the last 30 (back off). A link
 * that expired before a copy was stored is gone.
 */
export function planRecordingCopies(
  sessions: readonly SessionRecording[],
  ledger: ReadonlyMap<string, SessionCopyState>,
  now: Date = new Date(),
  opts: { force?: boolean } = {}
): CopyPlan[] {
  const t = now.getTime();
  return sessions.map((s): CopyPlan => {
    const last = ledger.get(s.sessionId);
    if (last?.status === "stored") return { action: "skip", sessionId: s.sessionId, why: "stored" };
    if (!s.recordingUrl) return { action: "skip", sessionId: s.sessionId, why: "no_recording" };
    const expires = s.recordingExpiresAt ? new Date(s.recordingExpiresAt).getTime() : NaN;
    // A link with no recorded expiry is tried; RealtimeKit's last 7 days.
    if (Number.isFinite(expires) && expires <= t) {
      return last?.status === "gone"
        ? { action: "skip", sessionId: s.sessionId, why: "gone" }
        : { action: "gone", sessionId: s.sessionId };
    }
    if (last && !opts.force) {
      const age = t - new Date(last.at).getTime();
      if (last.status === "copying" && age < COPY_STALE_MS)
        return { action: "skip", sessionId: s.sessionId, why: "in_progress" };
      if (last.status === "failed" && age < COPY_RETRY_MS)
        return { action: "skip", sessionId: s.sessionId, why: "backoff" };
    }
    return { action: "copy", sessionId: s.sessionId, url: s.recordingUrl };
  });
}

/**
 * The one status a hold row shows for its class's recordings: copying while
 * any copy runs, failed while any can still be retried, gone when a link
 * expired uncopied, stored when every recording is kept, none when there is
 * no recording (yet).
 */
export function aggregateRecordingStatus(
  sessions: readonly SessionRecording[],
  ledger: ReadonlyMap<string, SessionCopyState>
): HoldRecordingStatus {
  const states = sessions
    .map((s) => ledger.get(s.sessionId)?.status ?? (s.recordingUrl ? "pending" : null))
    .filter((x): x is SessionCopyStatus | "pending" => x !== null);
  if (states.length === 0) return "none";
  if (states.includes("copying")) return "copying";
  if (states.includes("failed")) return "failed";
  if (states.includes("pending")) return "copying";
  if (states.includes("gone")) return "gone";
  return "stored";
}

/**
 * The newest ledger entry per session, from class_events rows (any order).
 * An entry `{ sessionId: "*", status: "deleted" }` (the expired hold's objects
 * were deleted from the bucket) clears everything before it.
 */
export function latestCopyStates(
  rows: readonly { created_at: string; detail: Record<string, unknown> | null }[]
): Map<string, SessionCopyState> {
  const out = new Map<string, SessionCopyState>();
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const r of sorted) {
    const d = r.detail ?? {};
    const sessionId = typeof d.sessionId === "string" ? d.sessionId : null;
    const status = d.status;
    if (sessionId === "*" && status === "deleted") {
      out.clear();
      continue;
    }
    if (!sessionId || !["copying", "stored", "failed", "gone"].includes(status as string)) continue;
    out.set(sessionId, {
      sessionId,
      status: status as SessionCopyStatus,
      at: r.created_at,
      error: typeof d.error === "string" ? d.error : null,
      bytes: typeof d.bytes === "number" ? d.bytes : null,
      key: typeof d.key === "string" ? d.key : null,
    });
  }
  return out;
}

/* ── Peer reports ──────────────────────────────────────────────────── */

/** One peer report kept on a hold (class_safety_holds.peer_reports is an array of these). */
export type HoldPeerReport = {
  userId: string | null;
  handle: string | null;
  role: ClassRole | null;
  sessionId: string;
  peerId: string;
  fetchedAt: string;
  ok: boolean;
  /** Why it couldn't be fetched (not_configured, timeout, http_500, ...). */
  error?: string | null;
  /** RealtimeKit's answer as it came, when ok. */
  report?: unknown;
};

/** Errors worth trying again later (keys added, Cloudflare back up). */
export function isRetryablePeerError(error: string | null | undefined): boolean {
  if (!error) return false;
  return error === "not_configured" || error === "timeout" || error === "network" || /^http_(5\d\d|429)$/.test(error);
}

/** The peer reports to fetch again now. */
export function peerReportsToRetry(
  reports: readonly HoldPeerReport[],
  holdCreatedAt: string,
  now: Date = new Date()
): HoldPeerReport[] {
  const t = now.getTime();
  if (t - new Date(holdCreatedAt).getTime() > PEER_RETRY_WITHIN_DAYS * DAY_MS) return [];
  return reports.filter(
    (r) => !r.ok && isRetryablePeerError(r.error) && t - new Date(r.fetchedAt).getTime() >= PEER_RETRY_MS
  );
}

/** Merges fresh reports into kept ones by peer id; a kept good report is never replaced by a failure. */
export function mergePeerReports(
  kept: readonly HoldPeerReport[] | null | undefined,
  fresh: readonly HoldPeerReport[]
): HoldPeerReport[] {
  const out = new Map<string, HoldPeerReport>();
  for (const r of kept ?? []) out.set(r.peerId, r);
  for (const r of fresh) {
    const old = out.get(r.peerId);
    if (old?.ok && !r.ok) continue;
    out.set(r.peerId, r);
  }
  return [...out.values()];
}

export type PeerSummary = {
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  userAgent: string | null;
};

const PEER_KEYS: Record<keyof PeerSummary, string[]> = {
  ip: ["ipv4", "ip", "ip_address", "ipAddress", "public_ip", "ipv6"],
  city: ["city", "city_name"],
  region: ["region", "region_name", "state", "subdivision"],
  country: ["country", "country_name", "country_code"],
  browser: ["browser", "browser_name", "browserName"],
  os: ["os", "os_name", "osName", "platform"],
  device: ["device_type", "deviceType", "device_name", "device"],
  userAgent: ["user_agent", "userAgent", "ua"],
};

/**
 * IP, city, region, country, browser, OS and device out of a RealtimeKit peer
 * report, wherever in the answer they sit (section 6.10 check 4 confirms the
 * exact shape with keys; this reads the documented fields and their likely
 * neighbours, first match breadth first).
 */
export function summarizePeerReport(report: unknown): PeerSummary {
  const found: Record<string, string | null> = {};
  for (const k of Object.keys(PEER_KEYS)) found[k] = null;
  const queue: unknown[] = [report];
  let seen = 0;
  while (queue.length && seen < 400) {
    const node = queue.shift();
    seen++;
    if (!node || typeof node !== "object") continue;
    const entries = Array.isArray(node) ? node.map((v, i) => [String(i), v] as const) : Object.entries(node);
    for (const [key, value] of entries) {
      for (const [field, names] of Object.entries(PEER_KEYS)) {
        if (found[field] !== null || !names.includes(key)) continue;
        if (typeof value === "string" && value.trim()) found[field] = value.trim().slice(0, 300);
        else if (typeof value === "number" && Number.isFinite(value)) found[field] = String(value);
      }
      if (value && typeof value === "object") queue.push(value);
    }
  }
  // Some reports only say whether the device is mobile.
  if (!found.device) {
    const mobile = findBoolean(report, "is_mobile") ?? findBoolean(report, "isMobile");
    if (mobile !== null) found.device = mobile ? "mobile" : "desktop";
  }
  const browserVersion = findString(report, "browser_version") ?? findString(report, "browserVersion");
  if (found.browser && browserVersion && !found.browser.includes(browserVersion))
    found.browser = `${found.browser} ${browserVersion}`;
  const osVersion = findString(report, "os_version") ?? findString(report, "osVersion");
  if (found.os && osVersion && !found.os.includes(osVersion)) found.os = `${found.os} ${osVersion}`;
  return found as PeerSummary;
}

function walk(node: unknown, visit: (key: string, value: unknown) => boolean): void {
  const queue: unknown[] = [node];
  let seen = 0;
  while (queue.length && seen < 400) {
    const n = queue.shift();
    seen++;
    if (!n || typeof n !== "object") continue;
    for (const [k, v] of Object.entries(n)) {
      if (visit(k, v)) return;
      if (v && typeof v === "object") queue.push(v);
    }
  }
}

function findString(node: unknown, key: string): string | null {
  let out: string | null = null;
  walk(node, (k, v) => {
    if (k === key && (typeof v === "string" || typeof v === "number")) {
      out = String(v);
      return true;
    }
    return false;
  });
  return out;
}

function findBoolean(node: unknown, key: string): boolean | null {
  let out: boolean | null = null;
  walk(node, (k, v) => {
    if (k === key && typeof v === "boolean") {
      out = v;
      return true;
    }
    return false;
  });
  return out;
}

/* ── Notes ─────────────────────────────────────────────────────────── */

/** "Nov 9, 2026" in UTC, table-driven so every server prints the same. */
export function noteDay(d: Date = new Date()): string {
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${m[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/**
 * Appends one dated line to a hold's notes, newest last, so the hold reads as
 * the record of what was done ("Write down what you did on the hold").
 * Returns null when the result would be too long.
 */
export function appendHoldNote(
  existing: string | null | undefined,
  entry: string,
  by: string | null,
  now: Date = new Date()
): string | null {
  const line = `${noteDay(now)}${by ? ` (${by})` : ""}: ${entry.trim()}`;
  const next = existing ? `${existing}\n${line}` : line;
  return next.length > HOLD_NOTES_TOTAL_MAX ? null : next;
}
