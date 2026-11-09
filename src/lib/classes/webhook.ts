import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { endClass } from "@/lib/app/classes-room";
import { SITE_URL, getClassSettings, rtkApp } from "@/lib/classes/config";
import { deleteParticipant } from "@/lib/classes/realtimekit";
import { createRtkVerifier, type RtkVerifier } from "@/lib/classes/verify-signature";
import {
  eventTimeMs,
  isRecordingReady,
  isStale,
  isoOf,
  meetingIdOf,
  sessionIdOf,
  type RtkWebhookBody,
} from "@/lib/classes/webhook-events";
import {
  CLASS_REF_COLUMNS,
  allTranscriptsIn,
  downloadTranscript,
  finalizeMinutes,
  recordJoin,
  recordLeave,
  storeTranscript,
  upsertSession,
  type ClassOpsDeps,
  type ClassRef,
} from "@/lib/classes/reconcile";
import { runClassReview, sendClassMails } from "@/lib/classes/review";
import { startHoldRecordingCopy } from "@/lib/classes/holds";
import { unknownMeetingMail } from "@/lib/classes/safety-routing";
import { SYSTEM_ACTOR } from "@/lib/classes/types";

/**
 * RealtimeKit's webhook (classes-design.md section 6.8). The route
 * (src/app/api/classes/webhook/route.ts) hands the request to
 * receiveWebhook, answers with its response, and runs the returned work in
 * after(), so Cloudflare gets its 200 at once.
 *
 * Before answering:
 *   1. the raw body, untouched (re-serializing would break the signature);
 *   2. the rtk-signature check against Cloudflare's published key (401 when
 *      it fails; Cloudflare doesn't retry a 4xx);
 *   3. sanity checks on what the signature doesn't cover: rtk-webhook-id must
 *      be the webhook registered for this deployment's app, and a body's
 *      organizationId must be ours. The key is the same for every RealtimeKit
 *      customer, so the real protection is step 6: only events about our own
 *      meetings do anything;
 *   4. freshness from the body's own timestamps (older than 7 days: dropped);
 *   5. dedupe on the SIGNED body's sha256 as well as the unsigned rtk-uuid,
 *      so a replay with a fresh rtk-uuid still collides. A database error
 *      here answers 500, so Cloudflare retries.
 * Then, after the response (handleWebhookEvent):
 *   6. the meeting must be a class. An unknown one raises the alarm (one
 *      class_events row and one email per meeting: it could be a breakout
 *      room); a class of the other app (dev and prod share the database) is
 *      dropped;
 *   7. the handler for the event. Every one starts with upsertSession, so the
 *      order deliveries arrive in never matters, and every write is an
 *      idempotent upsert.
 */

/** Cached across requests in one function instance; refetches the key on a failure. */
const defaultVerifier = createRtkVerifier();

export type WebhookDeps = ClassOpsDeps & { verifier?: RtkVerifier };

export type WebhookReceipt = {
  response: Response;
  /** The work to run after the response, or null when there's nothing to do. */
  work: (() => Promise<void>) | null;
};

const MAX_BODY_BYTES = 1_000_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Steps 1 to 5. Never throws. */
export async function receiveWebhook(req: Request, deps: WebhookDeps = {}): Promise<WebhookReceipt> {
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return { response: json({ error: "unreadable body" }, 400), work: null };
  }
  if (raw.length > MAX_BODY_BYTES) return { response: json({ error: "too large" }, 413), work: null };

  const verifier = deps.verifier ?? defaultVerifier;
  if (!(await verifier.verify(raw, req.headers.get("rtk-signature")))) {
    console.warn("classes webhook: bad signature");
    return { response: json({ error: "bad signature" }, 401), work: null };
  }

  let body: RtkWebhookBody;
  try {
    body = JSON.parse(raw) as RtkWebhookBody;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
  } catch {
    return { response: json({ error: "not json" }, 400), work: null };
  }
  const event = typeof body.event === "string" ? body.event : "unknown";
  const now = deps.now?.() ?? new Date();

  const settings = await getClassSettings();
  const webhookId = req.headers.get("rtk-webhook-id");
  const expected = settings.rtk_webhook_ids?.[rtkApp()];
  if (expected && webhookId !== expected) {
    console.warn(`classes webhook: ${event} for webhook ${webhookId ?? "(none)"}, not this app's; dropped`);
    return { response: json({ ok: true, dropped: "webhook" }), work: null };
  }
  const org = body.recording?.organizationId;
  if (org && settings.rtk_organization_id && org !== settings.rtk_organization_id) {
    console.warn(`classes webhook: ${event} for another organization; dropped`);
    return { response: json({ ok: true, dropped: "organization" }), work: null };
  }
  if (isStale(body, now.getTime())) {
    console.warn(`classes webhook: ${event} from ${new Date(eventTimeMs(body) ?? 0).toISOString()} is over 7 days old; dropped`);
    return { response: json({ ok: true, dropped: "stale" }), work: null };
  }

  const hash = sha256Hex(raw);
  const uuid = req.headers.get("rtk-uuid")?.trim() || `sha256:${hash}`;
  const { error } = await createAdminClient()
    .from("class_webhook_events")
    .insert({
      id: uuid.slice(0, 200),
      body_sha256: hash,
      webhook_id: webhookId,
      event,
      meeting_id: meetingIdOf(body),
      payload: body,
    });
  if (error) {
    if (error.code === "23505") return { response: json({ ok: true, duplicate: true }), work: null };
    console.error("classes webhook: storing the event failed:", error.message);
    return { response: json({ error: "try again" }, 500), work: null };
  }

  return {
    response: json({ ok: true }),
    work: async () => {
      try {
        await handleWebhookEvent(body, deps);
      } catch (e) {
        // Reconcile and the sweep fill in whatever this missed.
        console.error(`classes webhook: handling ${event} failed:`, e);
      }
    },
  };
}

/* ── After the response ────────────────────────────────────────────── */

/** Steps 6 and 7 for one verified, fresh, new event. */
export async function handleWebhookEvent(body: RtkWebhookBody, deps: ClassOpsDeps = {}): Promise<void> {
  const event = body.event ?? "unknown";
  const meetingId = meetingIdOf(body);
  if (!meetingId) {
    console.warn(`classes webhook: ${event} with no meeting id`);
    return;
  }
  const { data } = await createAdminClient().from("classes").select(CLASS_REF_COLUMNS).eq("rtk_meeting_id", meetingId).maybeSingle();
  const cls = data as ClassRef | null;
  if (!cls) return unknownMeeting(meetingId, event);
  if (cls.rtk_app !== rtkApp()) {
    console.warn(`classes webhook: ${event} for a ${cls.rtk_app} class on the ${rtkApp()} app; dropped`);
    return;
  }

  const sessionId = sessionIdOf(body);
  switch (event) {
    case "meeting.started":
      return onStarted(cls, sessionId, body);
    case "meeting.participantJoined":
      return onJoined(cls, sessionId, body, deps);
    case "meeting.participantLeft":
      return onLeft(cls, sessionId, body);
    case "meeting.ended":
      return onEnded(cls, sessionId, body, deps);
    case "recording.statusUpdate":
      return onRecording(cls, sessionId, body);
    case "meeting.transcript":
      return onTranscript(cls, sessionId, body, deps);
    default:
      // meeting.chatSynced and the rest aren't subscribed; the stored row is enough.
      return;
  }
}

async function unknownMeeting(meetingId: string, event: string): Promise<void> {
  const admin = createAdminClient();
  const { data: prior } = await admin
    .from("class_events")
    .select("id")
    .eq("kind", "unknown_meeting")
    .contains("detail", { meetingId })
    .limit(1);
  if (prior?.length) {
    console.warn(`classes webhook: another ${event} for unknown meeting ${meetingId}`);
    return;
  }
  // At most 10 alarm emails a day, whatever someone points at the webhook.
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await admin
    .from("class_events")
    .select("id", { count: "exact", head: true })
    .eq("kind", "unknown_meeting")
    .gte("created_at", dayAgo);
  const email = (count ?? 0) < 10;
  await admin.from("class_events").insert({ class_id: null, kind: "unknown_meeting", detail: { meetingId, event, emailed: email } });
  if (email) {
    const mail = unknownMeetingMail({ meetingId, event, adminUrl: `${SITE_URL}/admin/classes` });
    await sendClassMails("unknown meeting", null, [{ ...mail, audience: "owner" }, mail]);
  }
}

async function onStarted(cls: ClassRef, sessionId: string | null, body: RtkWebhookBody): Promise<void> {
  const startedAt = isoOf(body.meeting?.startedAt) ?? new Date().toISOString();
  if (sessionId) await upsertSession(cls.id, sessionId, { started_at: startedAt });
  await createAdminClient()
    .from("classes")
    .update({ status: "live", live_started_at: cls.live_started_at ?? startedAt, updated_at: new Date().toISOString() })
    .eq("id", cls.id)
    .in("status", ["scheduled", "live"]);
}

async function onJoined(cls: ClassRef, sessionId: string | null, body: RtkWebhookBody, deps: ClassOpsDeps): Promise<void> {
  const p = body.participant;
  if (!sessionId || !p?.peerId) return;
  const admin = createAdminClient();
  const now = deps.now?.() ?? new Date();
  await upsertSession(cls.id, sessionId, { started_at: isoOf(body.meeting?.startedAt) });
  const joinedAt = isoOf(p.joinedAt) ?? now.toISOString();
  const joined = await recordJoin(cls, {
    sessionId,
    peerId: p.peerId,
    customParticipantId: p.customParticipantId ?? null,
    joinedAt,
    source: "webhook",
  });

  if (now.getTime() >= Date.parse(cls.hard_end_at)) {
    await (deps.endClass ?? endClass)(SYSTEM_ACTOR, { classId: cls.id, reason: "time" });
    return;
  }

  // Two live connections for one person: a shared token or a second device.
  if (!joined.userId) return;
  const { data: others } = await admin
    .from("class_attendance")
    .select("id, peer_id, joined_at")
    .eq("class_id", cls.id)
    .eq("user_id", joined.userId)
    .is("left_at", null)
    .neq("peer_id", p.peerId);
  if (!others?.length) return;
  const { data: part } = await admin
    .from("class_participants")
    .select("rtk_participant_id, last_token_at")
    .eq("class_id", cls.id)
    .eq("user_id", joined.userId)
    .maybeSingle();
  // Every join rotates the participant (joinClass), so a connection that
  // started before the newest token belongs to a participant that's already
  // deleted: it's a tab being replaced, not a shared token. Close it.
  const rotatedAt = part?.last_token_at ? Date.parse(part.last_token_at as string) : null;
  const stale = rotatedAt === null ? [] : others.filter((o) => Date.parse(o.joined_at as string) < rotatedAt - 5_000);
  for (const o of stale) {
    await admin.from("class_attendance").update({ left_at: joinedAt }).eq("id", o.id).is("left_at", null);
  }
  const dupes = others.filter((o) => !stale.includes(o));
  if (!dupes.length) return;

  const pid = part?.rtk_participant_id as string | null | undefined;
  let deleted = false;
  if (pid && cls.rtk_meeting_id) {
    const res = await (deps.deleteParticipant ?? deleteParticipant)(cls.rtk_meeting_id, pid, { app: cls.rtk_app });
    deleted = res.ok;
    if (!res.ok) console.error("classes webhook: duplicate peer, deleteParticipant failed:", res.error);
  }
  await admin
    .from("class_participants")
    .update({ rtk_participant_id: null })
    .eq("class_id", cls.id)
    .eq("user_id", joined.userId);
  await admin.from("class_events").insert({
    class_id: cls.id,
    kind: "duplicate_peer",
    detail: { userId: joined.userId, peers: [p.peerId, ...dupes.map((d) => d.peer_id)], participantDeleted: deleted },
  });
}

async function onLeft(cls: ClassRef, sessionId: string | null, body: RtkWebhookBody): Promise<void> {
  const p = body.participant;
  if (!sessionId || !p?.peerId) return;
  await upsertSession(cls.id, sessionId, { started_at: isoOf(body.meeting?.startedAt) });
  const leftAt = isoOf(p.leftAt) ?? new Date().toISOString();
  await recordLeave(cls, {
    sessionId,
    peerId: p.peerId,
    customParticipantId: p.customParticipantId ?? null,
    joinedAt: isoOf(p.joinedAt) ?? leftAt,
    leftAt,
    source: "webhook",
  });
}

async function onEnded(cls: ClassRef, sessionId: string | null, body: RtkWebhookBody, deps: ClassOpsDeps): Promise<void> {
  const admin = createAdminClient();
  const now = deps.now?.() ?? new Date();
  const endedAt = isoOf(body.meeting?.endedAt) ?? isoOf(body.endedAt) ?? now.toISOString();
  if (sessionId) {
    await upsertSession(cls.id, sessionId, {
      started_at: isoOf(body.meeting?.startedAt),
      ended_at: endedAt,
      end_reason: typeof body.reason === "string" ? body.reason.slice(0, 100) : null,
    });
    await admin.from("class_attendance").update({ left_at: endedAt }).eq("session_id", sessionId).is("left_at", null);
  }

  // Ended by the teacher, staff or the system already (endClass set the
  // status), or near the scheduled end: the class is over. An early "everyone
  // left" stays rejoinable; the sweep ends it after 10 empty minutes.
  const { data: fresh } = await admin.from("classes").select("status").eq("id", cls.id).maybeSingle();
  const status = (fresh?.status as string | undefined) ?? cls.status;
  const scheduledEnd = Date.parse(cls.starts_at) + cls.duration_minutes * 60_000;
  if ((status === "live" || status === "scheduled") && now.getTime() >= scheduledEnd - 10 * 60_000) {
    await (deps.endClass ?? endClass)(SYSTEM_ACTOR, { classId: cls.id, reason: "empty" });
  }
  await finalizeMinutes(cls.id);
  if (await allTranscriptsIn(cls.id)) await (deps.runReview ?? ((id: string) => runClassReview(id)))(cls.id);
}

async function onRecording(cls: ClassRef, sessionId: string | null, body: RtkWebhookBody): Promise<void> {
  const r = body.recording;
  if (!r || !isRecordingReady(r.status) || !r.downloadUrl) return;
  let session = sessionId;
  if (!session) {
    const { data } = await createAdminClient()
      .from("class_sessions")
      .select("id")
      .eq("class_id", cls.id)
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(1);
    session = (data?.[0]?.id as string | undefined) ?? null;
  }
  if (!session) return;
  await upsertSession(cls.id, session, {
    started_at: isoOf(body.meeting?.startedAt),
    recording_url: r.downloadUrl,
    recording_expires_at: isoOf(r.downloadUrlExpiry) ?? new Date(Date.now() + 7 * 86_400_000).toISOString(),
  });
  // A hold waiting on this recording copies it to R2 (holds.ts). It does
  // nothing when the class has no live hold.
  startHoldRecordingCopy(cls.id);
}

async function onTranscript(cls: ClassRef, sessionId: string | null, body: RtkWebhookBody, deps: ClassOpsDeps): Promise<void> {
  const url = body.transcriptDownloadUrl;
  if (!sessionId || typeof url !== "string" || !url) return;
  await upsertSession(cls.id, sessionId, { started_at: isoOf(body.meeting?.startedAt), ended_at: isoOf(body.meeting?.endedAt) });
  try {
    const text = await (deps.download ?? downloadTranscript)(url);
    await storeTranscript(cls, sessionId, text);
  } catch (e) {
    console.error("classes webhook: transcript download failed:", e);
    await createAdminClient().from("class_sessions").update({ transcript_status: "failed" }).eq("id", sessionId);
    return; // reconcile pulls it through the REST API
  }
  const { data: fresh } = await createAdminClient().from("classes").select("status").eq("id", cls.id).maybeSingle();
  if ((fresh?.status === "ended" || fresh?.status === "in_review") && (await allTranscriptsIn(cls.id))) {
    await (deps.runReview ?? ((id: string) => runClassReview(id)))(cls.id);
  }
}
