import "server-only";
import { cloudflareAccountId, rtkApiToken, rtkApp, rtkAppId } from "@/lib/classes/config";
import type { RtkApp } from "@/lib/classes/types";
import type { RtkPreset } from "@/lib/classes/presets";

/**
 * A thin RealtimeKit REST client (section 6.1), plain fetch like
 * src/lib/email.ts. Only the server talks to Cloudflare; the browser only
 * ever holds one participant's join token.
 *
 *   base: https://api.cloudflare.com/client/v4/accounts/<account>/realtime/kit/<app id>
 *   auth: Authorization: Bearer <CLOUDFLARE_REALTIMEKIT_API_TOKEN>
 *
 * Every call times out after 10 seconds and returns `{ ok: true, data }` or
 * `{ ok: false, status, error }`; nothing throws.
 *
 * WHICH APP. Dev and prod share one database, so every class records the app
 * that made its meeting (classes.rtk_app). Every call about an existing class
 * passes that app, and the client refuses (`status: 0, error: "other_app"`)
 * when it isn't this deployment's, so production never acts on a dev meeting
 * or the reverse. Only the setup script (which passes `allowOtherApp`) may
 * manage the other app.
 *
 * There's no chat call: RealtimeKit's chat is off for every preset and the
 * class chat lives in class_chat_messages. There's no token refresh either:
 * "refreshing does not invalidate previously issued tokens", so joinClass
 * rotates the participant on every join instead.
 */

export type RtkResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export type RtkCallOptions = {
  /** The app the meeting belongs to (classes.rtk_app). Default: this deployment's. */
  app?: RtkApp;
  /** Setup script only: manage an app that isn't this deployment's. */
  allowOtherApp?: boolean;
};

const TIMEOUT_MS = 10_000;

function baseUrl(app: RtkApp): string | null {
  const account = cloudflareAccountId();
  const appId = rtkAppId(app);
  if (!account || !appId) return null;
  return `https://api.cloudflare.com/client/v4/accounts/${account}/realtime/kit/${appId}`;
}

/** One request. Exported for the setup script and the spike checks. */
export async function rtkRequest<T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  opts: RtkCallOptions = {}
): Promise<RtkResult<T>> {
  const app = opts.app ?? rtkApp();
  if (app !== rtkApp() && !opts.allowOtherApp) return { ok: false, status: 0, error: "other_app" };
  const base = baseUrl(app);
  const token = rtkApiToken();
  if (!base || !token) return { ok: false, status: 0, error: "not_configured" };
  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      return { ok: false, status: res.status, error: errorText(json) ?? (text.slice(0, 300) || res.statusText) };
    }
    const env = json as { success?: boolean; data?: unknown; result?: unknown } | null;
    if (env && env.success === false) return { ok: false, status: res.status, error: errorText(json) ?? "failed" };
    return { ok: true, data: (env?.data ?? env?.result ?? env ?? null) as T };
  } catch (e) {
    const err = e as Error;
    return { ok: false, status: 0, error: err.name === "TimeoutError" ? "timeout" : err.message };
  }
}

function errorText(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const j = json as {
    error?: { message?: string } | string;
    errors?: { message?: string }[];
    message?: string;
  };
  if (typeof j.error === "string") return j.error;
  if (j.error?.message) return j.error.message;
  if (j.errors?.length) return j.errors.map((e) => e.message).filter(Boolean).join("; ") || null;
  return j.message || null;
}

const enc = encodeURIComponent;

/* ── Meetings ──────────────────────────────────────────────────────── */

export type MeetingConfig = {
  title: string;
  record_on_start: boolean;
  transcribe_on_end: boolean;
  summarize_on_end: boolean;
  persist_chat: boolean;
  session_keep_alive_time_in_secs: number;
  ai_config?: {
    transcription?: { language?: string; keywords?: string[]; profanity_filter?: boolean };
  };
  recording_config?: {
    max_seconds?: number;
    file_name_prefix?: string;
    video_config?: { codec?: "H264" | "VP8"; width?: number; height?: number };
    audio_config?: { codec?: "AAC" | "MP3"; channel?: "mono" | "stereo"; export_file?: boolean };
    realtimekit_bucket_config?: { enabled: boolean };
  };
};

export type RtkMeeting = {
  id: string;
  title?: string;
  status?: "ACTIVE" | "INACTIVE";
  created_at?: string;
  updated_at?: string;
};

/**
 * The meeting config for a class (section 6.2). The title carries no class
 * title or handle, since Cloudflare keeps meeting records indefinitely.
 *
 * The transcription language is the base code "en": post-meeting
 * transcription (transcribe_on_end, Whisper) refuses regional codes, and
 * Create Meeting answers 400 "Invalid language 'en-US' for post-meeting
 * transcription" to them. "en-US" is a real-time (Deepgram) code.
 */
export function meetingConfigFor(input: {
  classId: string;
  durationMinutes: number;
  keywords?: string[];
}): MeetingConfig {
  const keywords = [...new Set([...(input.keywords ?? []), "FRC", "swerve", "CAN", "PWM", "roboRIO"])].slice(0, 30);
  return {
    title: `LearnFRC class ${input.classId}`,
    record_on_start: true,
    transcribe_on_end: true,
    summarize_on_end: false,
    persist_chat: false,
    session_keep_alive_time_in_secs: 60,
    ai_config: { transcription: { language: "en", keywords, profanity_filter: false } },
    recording_config: {
      // Earliest join (teacher, 30 minutes early) to the hard end (15 after).
      max_seconds: (input.durationMinutes + 45) * 60,
      file_name_prefix: input.classId,
      video_config: { codec: "H264", width: 1280, height: 720 },
      audio_config: { codec: "AAC", channel: "mono", export_file: true },
      realtimekit_bucket_config: { enabled: true },
    },
  };
}

/** POST /meetings. Always in this deployment's app. */
export function createMeeting(cfg: MeetingConfig): Promise<RtkResult<RtkMeeting>> {
  return rtkRequest<RtkMeeting>("POST", "/meetings", cfg);
}

/** PATCH /meetings/{id}: INACTIVE removes everyone and blocks new sessions. */
export function setMeetingStatus(
  meetingId: string,
  status: "ACTIVE" | "INACTIVE",
  opts: RtkCallOptions = {}
): Promise<RtkResult<RtkMeeting>> {
  return rtkRequest<RtkMeeting>("PATCH", `/meetings/${enc(meetingId)}`, { status }, opts);
}

/* ── Participants ──────────────────────────────────────────────────── */

export type RtkParticipant = {
  id: string;
  token: string;
  custom_participant_id: string;
  preset_name: string;
  name?: string;
  not_before?: string;
  expires_on?: string;
  created_at?: string;
};

export type AddParticipantInput = {
  /** The full display name (displayNameFor in presets.ts). */
  name: string;
  preset_name: string;
  /** The Supabase user id. Never an email. */
  custom_participant_id: string;
  /** The token window [not_before, expires_on), RFC 3339. */
  token?: { not_before?: string; expires_on?: string };
};

/** POST /meetings/{id}/participants: returns the participant id and its join token. */
export function addParticipant(
  meetingId: string,
  p: AddParticipantInput,
  opts: RtkCallOptions = {}
): Promise<RtkResult<RtkParticipant>> {
  return rtkRequest<RtkParticipant>("POST", `/meetings/${enc(meetingId)}/participants`, p, opts);
}

/**
 * DELETE /meetings/{id}/participants/{pid}: revokes every token that
 * participant has and removes them from the live session at once.
 */
export function deleteParticipant(
  meetingId: string,
  participantId: string,
  opts: RtkCallOptions = {}
): Promise<RtkResult<unknown>> {
  return rtkRequest("DELETE", `/meetings/${enc(meetingId)}/participants/${enc(participantId)}`, undefined, opts);
}

/** POST /meetings/{id}/active-session/kick by our user ids (every connection of each). */
export function kickParticipants(
  meetingId: string,
  input: { customIds: string[] },
  opts: RtkCallOptions = {}
): Promise<RtkResult<unknown>> {
  return rtkRequest(
    "POST",
    `/meetings/${enc(meetingId)}/active-session/kick`,
    { custom_participant_ids: input.customIds },
    opts
  );
}

/** POST /meetings/{id}/active-session/kick-all (also stops the recorder at once). */
export function kickAll(meetingId: string, opts: RtkCallOptions = {}): Promise<RtkResult<unknown>> {
  return rtkRequest("POST", `/meetings/${enc(meetingId)}/active-session/kick-all`, {}, opts);
}

/* ── Sessions ──────────────────────────────────────────────────────── */

export type RtkSessionParticipant = {
  id?: string;
  peer_id?: string;
  custom_participant_id?: string;
  display_name?: string;
  joined_at?: string;
  left_at?: string | null;
  duration?: number;
  [key: string]: unknown;
};

/** GET /sessions/{id}/participants (fills attendance gaps in reconcile). */
export function sessionParticipants(
  sessionId: string,
  opts: RtkCallOptions = {}
): Promise<RtkResult<{ participants?: RtkSessionParticipant[] } | RtkSessionParticipant[]>> {
  return rtkRequest("GET", `/sessions/${enc(sessionId)}/participants`, undefined, opts);
}

/** GET /sessions/peer-report/{peer_id}: IP, city, device (holds only). */
export function peerReport(peerId: string, opts: RtkCallOptions = {}): Promise<RtkResult<unknown>> {
  return rtkRequest("GET", `/sessions/peer-report/${enc(peerId)}`, undefined, opts);
}

/** GET /sessions/{id}/transcript: a download URL for the transcript. */
export function sessionTranscript(
  sessionId: string,
  opts: RtkCallOptions = {}
): Promise<RtkResult<{ transcript_download_url?: string; [key: string]: unknown }>> {
  return rtkRequest("GET", `/sessions/${enc(sessionId)}/transcript`, undefined, opts);
}

/* ── Presets and webhooks (setup script only) ──────────────────────── */

export type RtkPresetRecord = { id: string; name: string; [key: string]: unknown };
export type RtkWebhookRecord = { id: string; name: string; url: string; events: string[]; enabled?: boolean };

export function listPresets(opts: RtkCallOptions = {}): Promise<RtkResult<RtkPresetRecord[]>> {
  return rtkRequest("GET", "/presets?per_page=100", undefined, opts);
}

/** Creates the preset, or updates it in place when one with its name exists. */
export async function upsertPreset(p: RtkPreset, opts: RtkCallOptions = {}): Promise<RtkResult<RtkPresetRecord>> {
  const list = await listPresets(opts);
  if (!list.ok) return list;
  const existing = (Array.isArray(list.data) ? list.data : []).find((x) => x.name === p.name);
  return existing
    ? rtkRequest("PATCH", `/presets/${enc(existing.id)}`, p, opts)
    : rtkRequest("POST", "/presets", p, opts);
}

/** GET /webhooks. Cloudflare answers 404 "Webhook not found" when the app has none: that's an empty list. */
export async function listWebhooks(opts: RtkCallOptions = {}): Promise<RtkResult<RtkWebhookRecord[]>> {
  const res = await rtkRequest<RtkWebhookRecord[]>("GET", "/webhooks", undefined, opts);
  if (!res.ok && res.status === 404) return { ok: true, data: [] };
  return res;
}

export function registerWebhook(
  w: { name: string; url: string; events: readonly string[]; enabled?: boolean },
  opts: RtkCallOptions = {}
): Promise<RtkResult<RtkWebhookRecord>> {
  return rtkRequest("POST", "/webhooks", w, opts);
}

export function updateWebhook(
  id: string,
  w: Partial<{ name: string; url: string; events: readonly string[]; enabled: boolean }>,
  opts: RtkCallOptions = {}
): Promise<RtkResult<RtkWebhookRecord>> {
  return rtkRequest("PATCH", `/webhooks/${enc(id)}`, w, opts);
}
