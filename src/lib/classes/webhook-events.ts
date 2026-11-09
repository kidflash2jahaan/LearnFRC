/**
 * Reading RealtimeKit webhook bodies and transcript files (classes-design.md
 * 6.8 and 7.1). Pure, no imports, so `node --test` runs it
 * (webhook-events.test.ts); src/lib/classes/webhook.ts and reconcile.ts do
 * the database side.
 *
 * Payload shapes are Cloudflare's published examples [S2]: most events carry
 * a `meeting` object (id, sessionId, startedAt, endedAt, createdAt), the
 * participant events a `participant` (peerId, customParticipantId, joinedAt,
 * leftAt), recording.statusUpdate a `recording` (status, downloadUrl,
 * downloadUrlExpiry, organizationId), and meeting.transcript a
 * transcriptDownloadUrl. Some events (meeting.chatSynced) put `meetingId` and
 * `sessionId` at the top level with no `meeting` object, so every reader here
 * looks in both places.
 */

export type RtkWebhookBody = {
  event?: string;
  meeting?: {
    id?: string;
    sessionId?: string;
    title?: string;
    status?: string;
    createdAt?: string;
    startedAt?: string;
    endedAt?: string;
  };
  meetingId?: string;
  sessionId?: string;
  createdAt?: string;
  startedAt?: string;
  endedAt?: string;
  reason?: string;
  participant?: {
    peerId?: string;
    userDisplayName?: string;
    customParticipantId?: string;
    joinedAt?: string;
    leftAt?: string;
  };
  recording?: {
    id?: string;
    recordingId?: string;
    status?: string;
    downloadUrl?: string;
    audioDownloadUrl?: string;
    downloadUrlExpiry?: string;
    startedTime?: string;
    stoppedTime?: string;
    meetingId?: string;
    organizationId?: string;
  };
  transcriptDownloadUrl?: string;
  transcriptDownloadUrlExpiry?: string;
};

/** Events older than this (by their own signed timestamps) are dropped. */
export const WEBHOOK_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** The meeting an event is about: `meeting.id`, else a top-level `meetingId`. */
export function meetingIdOf(body: RtkWebhookBody): string | null {
  return str(body.meeting?.id) ?? str(body.meetingId) ?? str(body.recording?.meetingId);
}

/** The session (one live run of the meeting) an event is about. */
export function sessionIdOf(body: RtkWebhookBody): string | null {
  return str(body.meeting?.sessionId) ?? str(body.sessionId);
}

function ms(v: unknown): number | null {
  const s = str(v);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

/**
 * The event's own time, from the signed body: the participant's join or
 * leave, the meeting's end or start, the recording's stop, or a creation
 * time, whichever this event has. Null when the body has none.
 */
export function eventTimeMs(body: RtkWebhookBody): number | null {
  const m = body.meeting ?? {};
  switch (body.event) {
    case "meeting.participantJoined":
      return ms(body.participant?.joinedAt) ?? ms(m.startedAt);
    case "meeting.participantLeft":
      return ms(body.participant?.leftAt) ?? ms(body.participant?.joinedAt) ?? ms(m.startedAt);
    case "meeting.started":
      return ms(m.startedAt) ?? ms(body.startedAt) ?? ms(m.createdAt);
    case "recording.statusUpdate":
      return ms(body.recording?.stoppedTime) ?? ms(body.recording?.startedTime) ?? ms(m.endedAt) ?? ms(m.startedAt);
    default:
      return (
        ms(m.endedAt) ?? ms(body.endedAt) ?? ms(m.startedAt) ?? ms(body.startedAt) ?? ms(m.createdAt) ?? ms(body.createdAt)
      );
  }
}

/** True when the event's own time is more than 7 days before `nowMs`. */
export function isStale(body: RtkWebhookBody, nowMs: number): boolean {
  const t = eventTimeMs(body);
  return t !== null && nowMs - t > WEBHOOK_MAX_AGE_MS;
}

/** An ISO time from the body, or null. */
export function isoOf(v: unknown): string | null {
  const t = ms(v);
  return t === null ? null : new Date(t).toISOString();
}

/** Recording statuses that mean the composite video is in RealtimeKit's bucket. */
export function isRecordingReady(status: unknown): boolean {
  return typeof status === "string" && /^uploaded$/i.test(status.trim());
}

/* ── Transcript files ──────────────────────────────────────────────── */

/** One line of a RealtimeKit transcript, before we map people. */
export type RawTranscriptLine = {
  /** Seconds from the session's start. */
  t0: number;
  t1: number;
  peerId: string | null;
  /** custom_participant_id: our user id. */
  cpi: string | null;
  displayName: string | null;
  text: string;
};

/** Splits CSV text into rows, honouring quotes and doubled quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

/**
 * Milliseconds as RealtimeKit writes them, to seconds from the session start.
 * An epoch timestamp (anything past 2001) is made relative to the session's
 * start, or to the first line when the start isn't known.
 */
function relSeconds(raw: number, sessionStartMs: number | null, firstEpochMs: number | null): number {
  if (raw > 1e12) {
    const base = sessionStartMs ?? firstEpochMs ?? raw;
    return Math.max(0, (raw - base) / 1000);
  }
  return Math.max(0, raw / 1000);
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/**
 * Parses a RealtimeKit transcript download. JSON (an array of
 * { startTime, endTime, sentence, peerData: { id, cpi, displayName } }, also
 * wrapped in an object or as JSON lines) or CSV (start ms, peer id, user id,
 * custom participant id, name, text; a header row is skipped). Lines come
 * back sorted by time; empty sentences are dropped.
 */
export function parseTranscriptFile(text: string, sessionStartMs: number | null = null): RawTranscriptLine[] {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return [];
  type Item = { start: number | null; end: number | null; peerId: string | null; cpi: string | null; name: string | null; text: string };
  let items: Item[] | null = null;

  const fromJson = (v: unknown): Item | null => {
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    const peer = (o.peerData ?? o.peer ?? {}) as Record<string, unknown>;
    const sentence = str(o.sentence) ?? str(o.text) ?? str(o.transcript);
    if (!sentence) return null;
    return {
      start: num(o.startTime ?? o.start_time ?? o.start),
      end: num(o.endTime ?? o.end_time ?? o.end),
      peerId: str(peer.id) ?? str(o.peerId) ?? str(o.peer_id),
      cpi: str(peer.cpi) ?? str(peer.customParticipantId) ?? str(o.customParticipantId) ?? str(o.custom_participant_id),
      name: str(peer.displayName) ?? str(o.displayName) ?? str(o.name),
      text: sentence,
    };
  };

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const list = Array.isArray(parsed)
        ? parsed
        : (["transcript", "data", "lines", "items"]
            .map((k) => (parsed as Record<string, unknown>)[k])
            .find(Array.isArray) as unknown[] | undefined) ?? [parsed];
      items = list.map(fromJson).filter((x): x is Item => !!x);
    } catch {
      // JSON lines: one object per line.
      const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().startsWith("{"));
      const parsed: Item[] = [];
      for (const l of lines) {
        try {
          const it = fromJson(JSON.parse(l));
          if (it) parsed.push(it);
        } catch {
          // skip a broken line
        }
      }
      items = parsed.length ? parsed : null;
    }
  }

  if (!items) {
    const rows = parseCsv(trimmed);
    items = [];
    for (const r of rows) {
      if (r.length < 6) continue;
      const start = num(r[0]);
      if (start === null) continue; // a header row
      const sentence = r.slice(5).join(",").trim();
      if (!sentence) continue;
      items.push({ start, end: null, peerId: str(r[1]), cpi: str(r[3]), name: str(r[4]), text: sentence });
    }
  }

  const firstEpoch = items.map((i) => i.start).find((s): s is number => s !== null && s > 1e12) ?? null;
  const out = items.map((i) => {
    const t0 = relSeconds(i.start ?? 0, sessionStartMs, firstEpoch);
    const t1 = i.end !== null ? Math.max(t0, relSeconds(i.end, sessionStartMs, firstEpoch)) : t0;
    return { t0, t1, peerId: i.peerId, cpi: i.cpi, displayName: i.name, text: i.text };
  });
  out.sort((a, b) => a.t0 - b.t0);
  return out;
}

/** Words in a transcript, for the short-transcript check and the coverage line. */
export function wordCount(lines: readonly { text: string }[]): number {
  return lines.reduce((n, l) => n + (l.text.trim() ? l.text.trim().split(/\s+/).length : 0), 0);
}
