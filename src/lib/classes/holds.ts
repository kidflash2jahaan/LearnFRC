import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/app/http";
import { fail, type AppUser, type Failure, type Result } from "@/lib/app/result";
import {
  RESTRICTED_PLACEHOLDER,
  requireClassReviewer,
  type ClassReviewer,
} from "@/lib/app/class-reviewers";
import {
  CLASS_LIMITS,
  SITE_URL,
  cloudflareAccountId,
  ownerEmail,
  r2Credentials,
  r2HoldsBucket,
  safetyEmail,
} from "@/lib/classes/config";
import { peerReport } from "@/lib/classes/realtimekit";
import { classEmailHtml, sendClassEmail } from "@/lib/classes/emails";
import { copyUrlToR2, deletePrefix, presignGet, type R2Config } from "@/lib/classes/r2";
import { allClassRows } from "@/lib/classes/paged";
import {
  HOLD_NOTE_MAX,
  HOLD_REASON_LABELS,
  HOLD_RECORDING_LABELS,
  NCMEC_ID_PATTERN,
  PEERS_PER_PERSON,
  RECORDING_LINK_SECONDS,
  aggregateRecordingStatus,
  appendHoldNote,
  holdExpiry,
  holdRecordingKey,
  holdRecordingPrefix,
  isHoldRestricted,
  latestCopyStates,
  laterOf,
  mergePeerReports,
  noteDay,
  peerReportsToRetry,
  planRecordingCopies,
  summarizePeerReport,
  type HoldPeerReport,
  type PeerSummary,
  type SessionCopyState,
  type SessionRecording,
} from "@/lib/classes/hold-rules";
import type {
  ClassChatMessageRow,
  ClassRole,
  ClassSafetyHoldRow,
  ClassStatus,
  HoldReason,
  HoldRecordingStatus,
  RtkApp,
  TranscriptLine,
} from "@/lib/classes/types";

/**
 * Evidence holds (classes-design.md sections 3.8, 8.2 and 3.11).
 *
 * A hold keeps what may need to go to NCMEC, the police, a parent or a ban
 * review, for a year: one class_safety_holds row per subject per class, with
 * the subject's email and handle (read before anything is deleted), the
 * class's transcript and chat (messages the filter stopped included), the
 * RealtimeKit peer reports (IP, city, device) for the subject and the
 * teacher, and the class's composite recordings, copied from RealtimeKit's
 * 7-day links into the private R2 bucket. The table has no foreign key to
 * auth.users, so a ban or a self-delete never deletes the evidence.
 *
 * Who calls what:
 *   - holdClass: a class report and the two-report auto-end (room-and-chat),
 *     an urgent flag or a refusal (the review), "Reject for safety" and
 *     "Hold this class" (the review page, through holdClassByHand).
 *   - holdAccount: beforeAccountDeleted (src/lib/app/classes.ts) on a ban or a
 *     self-delete with an open case, before the account is gone.
 *   - startHoldRecordingCopy: the recording.statusUpdate webhook, on UPLOADED.
 *   - retryHoldWork: the 5-minute sweep (copies, peer reports, late transcripts).
 *   - deleteExpiredHolds: the sweep's once-a-day part.
 *   - heldRecordingLinks: the review page's #recording section.
 *   - releaseHold, extendHold, noteHold, retryHoldCopy, loadHoldsDesk,
 *     loadHold, holdRecordingLinks: /admin/classes/holds.
 *
 * Restricted holds (a restricted review or a refusal) are the safety lead's
 * alone until he releases them (section 7.6); everyone else sees
 * RESTRICTED_PLACEHOLDER. Every view of a hold, every recording link and
 * every change is a class_events row (kinds hold_*), so there's a record of
 * who opened evidence.
 *
 * The recording copy runs in after(), within the calling route's
 * maxDuration (the webhook, the sweep and the holds pages set 300 seconds).
 * The recording ledger is class_events kind "hold_recording" (one row per
 * attempt per session), so no schema change was needed to know what's
 * stored, running or failed.
 */

const DAY_MS = 86_400_000;
const COPY_BUDGET_MS = 280_000;

type Admin = SupabaseClient;

export type HoldInput = {
  reason: HoldReason;
  /** The person the hold is about, when there is one. */
  subjectUserId?: string | null;
  /** Who took it; null for the system. */
  createdBy?: string | null;
  notes?: string | null;
};

type ClassInfo = {
  id: string;
  title: string;
  starts_at: string;
  teacher_id: string | null;
  rtk_app: RtkApp;
  status: ClassStatus;
};

type Subject = { userId: string; email: string | null; handle: string | null };

/** A transcript line as a hold keeps it: which session it's from, too. */
export type HeldTranscriptLine = TranscriptLine & { sessionId?: string };

/* ── Running work after the response ───────────────────────────────── */

const pending = new Set<Promise<unknown>>();

/**
 * after() when there's a request (pages, actions, routes); outside one (a
 * script or a test), the task runs at once and holdWorkSettled() waits for it.
 */
function later(label: string, task: () => Promise<unknown>): void {
  const run = () =>
    task().catch((e) => {
      console.error(`holds: ${label}:`, e);
    });
  try {
    after(run);
  } catch {
    const p: Promise<unknown> = run().finally(() => pending.delete(p));
    pending.add(p);
  }
}

/** Scripts and tests: waits for work that ran outside a request. */
export async function holdWorkSettled(): Promise<void> {
  while (pending.size) await Promise.allSettled([...pending]);
}

/* ── Small reads ───────────────────────────────────────────────────── */

async function readClass(admin: Admin, classId: string): Promise<ClassInfo | null> {
  const { data } = await admin
    .from("classes")
    .select("id, title, starts_at, teacher_id, rtk_app, status")
    .eq("id", classId)
    .maybeSingle();
  return (data as ClassInfo | null) ?? null;
}

async function readSubject(admin: Admin, userId: string): Promise<Subject> {
  const [au, prof] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("username").eq("id", userId).maybeSingle(),
  ]);
  return {
    userId,
    email: au.data?.user?.email ?? null,
    handle: (prof.data?.username as string | null | undefined) ?? null,
  };
}

async function handlesFor(admin: Admin, ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const want = [...new Set(ids.filter((x): x is string => !!x))];
  const out = new Map<string, string>();
  if (!want.length) return out;
  const { data } = await admin.from("profiles").select("id, username").in("id", want);
  for (const p of data ?? []) if (p.username) out.set(p.id as string, p.username as string);
  return out;
}

async function handleOf(admin: Admin, id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  const h = (await handlesFor(admin, [id])).get(id);
  return h ? `@${h}` : null;
}

async function logEvent(
  admin: Admin,
  classId: string | null,
  actorId: string | null,
  kind: string,
  detail: Record<string, unknown>
): Promise<void> {
  const { error } = await admin.from("class_events").insert({ class_id: classId, actor_id: actorId, kind, detail });
  if (error) console.error(`holds: class_events ${kind}:`, error.message);
}

/* ── What a hold copies ────────────────────────────────────────────── */

async function snapshotClass(
  admin: Admin,
  classId: string
): Promise<{ transcript: HeldTranscriptLine[]; chat: ClassChatMessageRow[] }> {
  const [sessions, transcripts, chat] = await Promise.all([
    admin.from("class_sessions").select("id, started_at").eq("class_id", classId),
    admin.from("class_transcripts").select("session_id, lines").eq("class_id", classId),
    // Paged: production answers at most 1000 rows a request, and the latest
    // messages (blocked ones included) are the ones a hold most needs.
    allClassRows<ClassChatMessageRow>(
      admin,
      "class_chat_messages",
      "id, class_id, sender_id, sender_username, sender_role, body, status, blocked_kinds, sent_at",
      classId
    ).then((data) => ({ data })),
  ]);
  const order = new Map(
    (sessions.data ?? [])
      .slice()
      .sort((a, b) => String(a.started_at ?? "").localeCompare(String(b.started_at ?? "")))
      .map((s, i) => [s.id as string, i])
  );
  const blocks = (transcripts.data ?? [])
    .slice()
    .sort((a, b) => (order.get(a.session_id as string) ?? 99) - (order.get(b.session_id as string) ?? 99));
  const transcript: HeldTranscriptLine[] = [];
  for (const b of blocks) {
    for (const line of (b.lines as TranscriptLine[] | null) ?? []) {
      transcript.push({ ...line, sessionId: b.session_id as string });
    }
  }
  return { transcript, chat: (chat.data as ClassChatMessageRow[] | null) ?? [] };
}

function peerError(res: { status: number; error: string }): string {
  if (res.status === 0) {
    return ["not_configured", "other_app", "timeout"].includes(res.error) ? res.error : "network";
  }
  return `http_${res.status}`;
}

/** Peer reports for these people's connections in the class (subject and teacher). */
async function fetchPeerReports(admin: Admin, cls: ClassInfo, userIds: string[]): Promise<HoldPeerReport[]> {
  if (!userIds.length) return [];
  const [{ data: att }, handles] = await Promise.all([
    admin
      .from("class_attendance")
      .select("user_id, role, peer_id, session_id, joined_at")
      .eq("class_id", cls.id)
      .in("user_id", userIds)
      .order("joined_at", { ascending: true }),
    handlesFor(admin, userIds),
  ]);
  const perPerson = new Map<string, number>();
  const seen = new Set<string>();
  const peers: { userId: string; role: ClassRole; peerId: string; sessionId: string }[] = [];
  for (const a of att ?? []) {
    const uid = a.user_id as string;
    const peerId = a.peer_id as string;
    if (seen.has(peerId)) continue;
    const n = perPerson.get(uid) ?? 0;
    if (n >= PEERS_PER_PERSON) continue;
    seen.add(peerId);
    perPerson.set(uid, n + 1);
    peers.push({ userId: uid, role: a.role as ClassRole, peerId, sessionId: a.session_id as string });
  }
  return Promise.all(
    peers.map(async (p): Promise<HoldPeerReport> => {
      const base = {
        userId: p.userId,
        handle: handles.get(p.userId) ?? null,
        role: p.role,
        sessionId: p.sessionId,
        peerId: p.peerId,
        fetchedAt: new Date().toISOString(),
      };
      const res = await peerReport(p.peerId, { app: cls.rtk_app });
      return res.ok ? { ...base, ok: true, report: res.data } : { ...base, ok: false, error: peerError(res) };
    })
  );
}

/* ── Taking a hold ─────────────────────────────────────────────────── */

const HOLD_COLUMNS =
  "id, class_id, subject_user_id, subject_handle, subject_email, reason, recording_key, recording_status, created_by, created_at, expires_at, ncmec_report_id, notes, released_at, released_by";

/**
 * One row per subject per class: takes it, or refreshes the one that's there
 * (newer transcript and chat, more peer reports, a year from now at least,
 * and back to unreleased, since new evidence arrived). A refresh from another
 * class report doesn't push the expiry out: anyone in a class can file one,
 * so repeat reports would keep minors' data forever. Extending is
 * extendHold's, a reviewer's choice.
 */
async function holdOne(
  admin: Admin,
  cls: ClassInfo,
  subject: Subject | null,
  input: HoldInput,
  by: string | null
): Promise<{ id: string; created: boolean }> {
  const now = new Date();
  const people = [...new Set([subject?.userId, cls.teacher_id].filter((x): x is string => !!x))];
  const [snap, peers] = await Promise.all([snapshotClass(admin, cls.id), fetchPeerReports(admin, cls, people)]);

  let q = admin
    .from("class_safety_holds")
    .select("id, expires_at, notes, peer_reports, subject_email, subject_handle, transcript, chat")
    .eq("class_id", cls.id);
  q = subject ? q.eq("subject_user_id", subject.userId) : q.is("subject_user_id", null);
  const { data: existing } = await q.order("created_at", { ascending: true }).limit(1).maybeSingle();

  if (existing) {
    const oldT = (existing.transcript as unknown[] | null) ?? [];
    const oldC = (existing.chat as unknown[] | null) ?? [];
    let notes = appendHoldNote(
      existing.notes as string | null,
      `Held again: ${HOLD_REASON_LABELS[input.reason].toLowerCase()}${input.notes ? `. ${input.notes}` : ""}`.slice(0, HOLD_NOTE_MAX),
      by,
      now
    );
    if (notes === null) notes = existing.notes as string | null;
    const { error } = await admin
      .from("class_safety_holds")
      .update({
        transcript: snap.transcript.length >= oldT.length ? snap.transcript : existing.transcript,
        chat: snap.chat.length >= oldC.length ? snap.chat : existing.chat,
        peer_reports: mergePeerReports(existing.peer_reports as HoldPeerReport[] | null, peers),
        subject_email: (existing.subject_email as string | null) ?? subject?.email ?? null,
        subject_handle: (existing.subject_handle as string | null) ?? subject?.handle ?? null,
        expires_at:
          input.reason === "class_report"
            ? (existing.expires_at as string)
            : laterOf(existing.expires_at as string, holdExpiry(now)).toISOString(),
        notes,
        released_at: null,
        released_by: null,
      })
      .eq("id", existing.id);
    if (error) throw new Error(`refresh hold: ${error.message}`);
    await logEvent(admin, cls.id, input.createdBy ?? null, "hold_refreshed", {
      holdId: existing.id,
      reason: input.reason,
      subjectUserId: subject?.userId ?? null,
    });
    return { id: existing.id as string, created: false };
  }

  const { data: row, error } = await admin
    .from("class_safety_holds")
    .insert({
      class_id: cls.id,
      subject_user_id: subject?.userId ?? null,
      subject_handle: subject?.handle ?? null,
      subject_email: subject?.email ?? null,
      reason: input.reason,
      transcript: snap.transcript,
      chat: snap.chat,
      peer_reports: peers,
      recording_status: "none",
      created_by: input.createdBy ?? null,
      expires_at: holdExpiry(now).toISOString(),
      notes: input.notes ? appendHoldNote(null, input.notes.slice(0, HOLD_NOTE_MAX), by, now) : null,
    })
    .select("id")
    .single();
  if (error || !row) throw new Error(`insert hold: ${error?.message ?? "no row"}`);
  await logEvent(admin, cls.id, input.createdBy ?? null, "hold_created", {
    holdId: row.id,
    reason: input.reason,
    subjectUserId: subject?.userId ?? null,
  });
  return { id: row.id as string, created: true };
}

/** An account-only hold (no class in the window): the email and handle. */
async function holdAccountOnly(
  admin: Admin,
  subject: Subject,
  input: HoldInput,
  by: string | null
): Promise<{ id: string; created: boolean }> {
  const now = new Date();
  const { data: existing } = await admin
    .from("class_safety_holds")
    .select("id, expires_at, notes, subject_email, subject_handle")
    .is("class_id", null)
    .eq("subject_user_id", subject.userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing) {
    const notes =
      appendHoldNote(existing.notes as string | null, `Held again: ${HOLD_REASON_LABELS[input.reason].toLowerCase()}`, by, now) ??
      (existing.notes as string | null);
    const { error } = await admin
      .from("class_safety_holds")
      .update({
        subject_email: (existing.subject_email as string | null) ?? subject.email,
        subject_handle: (existing.subject_handle as string | null) ?? subject.handle,
        expires_at: laterOf(existing.expires_at as string, holdExpiry(now)).toISOString(),
        notes,
      })
      .eq("id", existing.id);
    if (error) throw new Error(`refresh account hold: ${error.message}`);
    return { id: existing.id as string, created: false };
  }
  const { data: row, error } = await admin
    .from("class_safety_holds")
    .insert({
      class_id: null,
      subject_user_id: subject.userId,
      subject_handle: subject.handle,
      subject_email: subject.email,
      reason: input.reason,
      recording_status: "none",
      created_by: input.createdBy ?? null,
      expires_at: holdExpiry(now).toISOString(),
      notes: input.notes ? appendHoldNote(null, input.notes.slice(0, HOLD_NOTE_MAX), by, now) : null,
    })
    .select("id")
    .single();
  if (error || !row) throw new Error(`insert account hold: ${error?.message ?? "no row"}`);
  await logEvent(admin, null, input.createdBy ?? null, "hold_created", {
    holdId: row.id,
    reason: input.reason,
    subjectUserId: subject.userId,
  });
  return { id: row.id as string, created: true };
}

/** Tells the safety lead when a ban or a self-delete kept evidence from classes. */
function notifyAccountHold(reason: HoldReason, subject: Subject, classIds: string[]): void {
  const to = safetyEmail() ?? ownerEmail();
  if (!to || classIds.length === 0) return;
  const who = subject.handle ? `@${subject.handle}` : "An account";
  const what =
    reason === "ban"
      ? `${who} was banned.`
      : `${who} deleted their own account while a class safety case about them was open.`;
  const html = classEmailHtml({
    heading: "Evidence kept for a year",
    intro: `${what} Before the account was deleted, LearnFRC kept its email address and handle, and from ${classIds.length === 1 ? "the class" : `the ${classIds.length} classes`} it was in over the last ${CLASS_LIMITS.banHoldLookbackDays} days: the transcript, the chat, connection details and the recording.`,
    rows: [
      { label: "Account", value: who },
      { label: "Classes held", value: String(classIds.length) },
    ],
    buttons: [{ text: "Open the holds", url: `${SITE_URL}/admin/classes/holds` }],
    note: "Nothing from the classes is in this email. The holds page is behind sign-in.",
  });
  const subjectLine =
    reason === "ban"
      ? "LearnFRC safety: evidence kept for a banned account"
      : "LearnFRC safety: evidence kept before an account was deleted";
  later("hold notice", () => sendClassEmail("hold notice", classIds[0] ?? null, { to, subject: subjectLine, html }));
}

/**
 * Holds a class: one class_safety_holds row per subject (or one class-wide
 * row when there's no subject), with the email and handle (read before
 * anything is deleted), peer reports for the subject and the teacher, the
 * transcript and the chat (blocked messages included), and starts the
 * recording copy to R2. Also sets classes.keep_evidence. Never throws.
 */
export async function holdClass(
  classId: string,
  input: HoldInput
): Promise<Result<{ holdIds: string[] }>> {
  try {
    if (!isUuid(classId)) return fail("not_found", "That class doesn't exist.");
    const admin = createAdminClient();
    const cls = await readClass(admin, classId);
    if (!cls) return fail("not_found", "That class doesn't exist.");
    const subject = input.subjectUserId && isUuid(input.subjectUserId) ? await readSubject(admin, input.subjectUserId) : null;
    const by = await handleOf(admin, input.createdBy);
    const one = await holdOne(admin, cls, subject, input, by);
    await admin.from("classes").update({ keep_evidence: true }).eq("id", classId);
    await refreshRecordingStatus(admin, classId);
    startHoldRecordingCopy(classId);
    return { ok: true, holdIds: [one.id] };
  } catch (e) {
    console.error("holdClass:", e);
    return fail("server", "Couldn't keep the evidence for that class. Try again.");
  }
}

/**
 * Holds an account before it's deleted (a ban, or a self-delete with an open
 * case): the account plus every class it was in during the last 90 days.
 * Never throws.
 */
export async function holdAccount(
  userId: string,
  input: Omit<HoldInput, "subjectUserId">
): Promise<Result<{ holdIds: string[] }>> {
  try {
    if (!isUuid(userId)) return fail("not_found", "That account doesn't exist.");
    const admin = createAdminClient();
    // First, while the account still exists.
    const subject = await readSubject(admin, userId);
    const by = await handleOf(admin, input.createdBy);
    const since = new Date(Date.now() - CLASS_LIMITS.banHoldLookbackDays * DAY_MS).toISOString();
    const soon = new Date(Date.now() + CLASS_LIMITS.teacherEarlyJoinMinutes * 60_000).toISOString();

    const [{ data: parts }, { data: taught }] = await Promise.all([
      admin.from("class_participants").select("class_id").eq("user_id", userId),
      admin.from("classes").select("id").eq("teacher_id", userId).gte("starts_at", since),
    ]);
    const ids = [
      ...new Set([...(parts ?? []).map((p) => p.class_id as string), ...(taught ?? []).map((c) => c.id as string)]),
    ];
    let classes: ClassInfo[] = [];
    if (ids.length) {
      const { data } = await admin
        .from("classes")
        .select("id, title, starts_at, teacher_id, rtk_app, status")
        .in("id", ids)
        .gte("starts_at", since)
        .lte("starts_at", soon)
        .neq("status", "canceled")
        .order("starts_at", { ascending: true });
      classes = (data as ClassInfo[] | null) ?? [];
    }

    const full = { ...input, subjectUserId: userId };
    const holdIds: string[] = [];
    let created = false;
    for (const cls of classes) {
      const one = await holdOne(admin, cls, subject, full, by);
      holdIds.push(one.id);
      created ||= one.created;
    }
    if (classes.length === 0) {
      const one = await holdAccountOnly(admin, subject, full, by);
      holdIds.push(one.id);
      created ||= one.created;
    } else {
      await admin.from("classes").update({ keep_evidence: true }).in("id", classes.map((c) => c.id));
      for (const cls of classes) {
        await refreshRecordingStatus(admin, cls.id);
        startHoldRecordingCopy(cls.id);
      }
    }
    if (created && (input.reason === "ban" || input.reason === "self_delete_open_case")) {
      notifyAccountHold(input.reason, subject, classes.map((c) => c.id));
    }
    return { ok: true, holdIds };
  } catch (e) {
    console.error("holdAccount:", e);
    return fail("server", "Couldn't keep the evidence for that account. Try again.");
  }
}

/**
 * "Hold this class" on the review page, and "Reject for safety": a class
 * reviewer holds a class by hand, optionally about one person.
 */
export async function holdClassByHand(
  user: AppUser,
  input: { classId: unknown; subjectUserId?: unknown; note?: unknown; reason?: "manual" | "reject_safety" }
): Promise<Result<{ holdIds: string[] }>> {
  const gate = await requireClassReviewer(user);
  if (!gate.ok) return gate;
  if (!isUuid(input.classId)) return fail("not_found", "That class doesn't exist.");
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > HOLD_NOTE_MAX) return { ...fail("validation", `Keep the note under ${HOLD_NOTE_MAX} characters.`), field: "note" };
  return holdClass(input.classId, {
    reason: input.reason ?? "manual",
    subjectUserId: isUuid(input.subjectUserId) ? input.subjectUserId : null,
    createdBy: user.id,
    notes: note || null,
  });
}

/* ── Recordings ────────────────────────────────────────────────────── */

function r2Config(): R2Config | null {
  const creds = r2Credentials();
  const accountId = cloudflareAccountId();
  if (!creds || !accountId) return null;
  return { accountId, bucket: r2HoldsBucket(), ...creds };
}

async function recordingState(admin: Admin, classId: string) {
  const [{ data: sessions }, { data: events }] = await Promise.all([
    admin.from("class_sessions").select("id, recording_url, recording_expires_at, started_at").eq("class_id", classId),
    admin
      .from("class_events")
      .select("created_at, detail")
      .eq("class_id", classId)
      .eq("kind", "hold_recording")
      .order("created_at", { ascending: true })
      .limit(1000),
  ]);
  const recs: SessionRecording[] = (sessions ?? [])
    .slice()
    .sort((a, b) => String(a.started_at ?? "").localeCompare(String(b.started_at ?? "")))
    .map((s) => ({
      sessionId: s.id as string,
      recordingUrl: (s.recording_url as string | null) ?? null,
      recordingExpiresAt: (s.recording_expires_at as string | null) ?? null,
    }));
  const ledger = latestCopyStates(
    (events ?? []) as { created_at: string; detail: Record<string, unknown> | null }[]
  );
  return { sessions: recs, ledger };
}

/** Writes the class's aggregate recording status onto every hold of the class. */
async function refreshRecordingStatus(admin: Admin, classId: string): Promise<HoldRecordingStatus> {
  const { sessions, ledger } = await recordingState(admin, classId);
  const status = aggregateRecordingStatus(sessions, ledger);
  // The key only once something was actually sent to the bucket, so a hold
  // with nothing in R2 never waits on R2 keys to be deleted.
  const tried = [...ledger.values()].some((s) => !!s.key);
  const patch: Record<string, unknown> = { recording_status: status };
  if (tried) patch.recording_key = holdRecordingPrefix(classId);
  let q = admin.from("class_safety_holds").update(patch).eq("class_id", classId);
  if (!tried) q = q.neq("recording_status", status);
  await q;
  return status;
}

async function ledger(admin: Admin, classId: string, detail: Record<string, unknown>): Promise<void> {
  await logEvent(admin, classId, null, "hold_recording", detail);
}

const copying = new Map<string, Promise<void>>();

/**
 * Copies every not-yet-kept recording of a held class into the holds bucket.
 * Does nothing for a class with no live hold. One copy per class at a time in
 * this process; a copy started elsewhere in the last 6 minutes is left alone.
 */
export async function copyHeldRecordings(classId: string, opts: { force?: boolean } = {}): Promise<void> {
  const running = copying.get(classId);
  if (running) return running;
  const job = (async () => {
    const admin = createAdminClient();
    const { count } = await admin
      .from("class_safety_holds")
      .select("id", { count: "exact", head: true })
      .eq("class_id", classId)
      .gt("expires_at", new Date().toISOString());
    if (!count) return;

    const { sessions, ledger: states } = await recordingState(admin, classId);
    const plan = planRecordingCopies(sessions, states, new Date(), opts);
    const cfg = r2Config();
    const deadline = Date.now() + COPY_BUDGET_MS;

    for (const p of plan) {
      if (p.action === "gone") {
        await ledger(admin, classId, { sessionId: p.sessionId, status: "gone" });
        continue;
      }
      if (p.action !== "copy") continue;
      if (!cfg) {
        // Once, not on every sweep: the holds page says why until keys are in.
        const last = states.get(p.sessionId);
        if (!(last?.status === "failed" && last.error === "r2_not_configured")) {
          await ledger(admin, classId, { sessionId: p.sessionId, status: "failed", error: "r2_not_configured" });
        }
        continue;
      }
      const key = holdRecordingKey(classId, p.sessionId);
      await ledger(admin, classId, { sessionId: p.sessionId, status: "copying", key });
      await refreshRecordingStatus(admin, classId);
      const left = deadline - Date.now();
      const res =
        left > 10_000
          ? await copyUrlToR2(cfg, p.url, key, { signal: AbortSignal.timeout(left) })
          : ({ ok: false, error: "out of time" } as const);
      await ledger(
        admin,
        classId,
        res.ok
          ? { sessionId: p.sessionId, status: "stored", key, bytes: res.bytes, parts: res.parts, bucket: cfg.bucket }
          : { sessionId: p.sessionId, status: "failed", key, error: res.error.slice(0, 300) }
      );
    }
    await refreshRecordingStatus(admin, classId);
  })().finally(() => copying.delete(classId));
  copying.set(classId, job);
  return job;
}

/**
 * Starts the recording copy for a held class after the response. The
 * recording.statusUpdate webhook calls it on UPLOADED (it does nothing when
 * the class has no hold), and every new hold calls it.
 */
export function startHoldRecordingCopy(classId: string): void {
  if (!isUuid(classId)) return;
  later("recording copy", () => copyHeldRecordings(classId));
}

/* ── The sweep ─────────────────────────────────────────────────────── */

export type HoldSweepSummary = { classesCopied: number; peerReportsRetried: number; snapshotsRefreshed: number };

/**
 * The 5-minute sweep's hold step (section 6.9 step 6): retries recording
 * copies that are copying, failed or not started while the source link
 * lasts, fetches peer reports that failed for a reason that can pass (no keys
 * yet, a timeout), and refreshes transcripts and chat that arrived after the
 * hold was taken (a report during a live class). `classId` limits it to one
 * class, for a package's test.
 */
export async function retryHoldWork(opts: { classId?: string } = {}): Promise<HoldSweepSummary> {
  const admin = createAdminClient();
  const now = new Date();
  const summary: HoldSweepSummary = { classesCopied: 0, peerReportsRetried: 0, snapshotsRefreshed: 0 };

  // Recordings: any held class with a session whose recording isn't kept yet.
  let q = admin
    .from("class_safety_holds")
    .select("class_id")
    .not("class_id", "is", null)
    .in("recording_status", ["none", "copying", "failed"])
    .gt("expires_at", now.toISOString())
    .gt("created_at", new Date(now.getTime() - 8 * DAY_MS).toISOString())
    .limit(200);
  if (opts.classId) q = q.eq("class_id", opts.classId);
  const { data: toCopy } = await q;
  for (const classId of new Set((toCopy ?? []).map((r) => r.class_id as string))) {
    await copyHeldRecordings(classId);
    summary.classesCopied++;
  }

  // Peer reports and late transcripts, on recent holds.
  let h = admin
    .from("class_safety_holds")
    .select("id, class_id, created_at, peer_reports, transcript, chat")
    .gt("expires_at", now.toISOString())
    .gt("created_at", new Date(now.getTime() - 150 * DAY_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(50);
  if (opts.classId) h = h.eq("class_id", opts.classId);
  const { data: recent } = await h;
  const classCache = new Map<string, ClassInfo | null>();
  for (const hold of recent ?? []) {
    const classId = hold.class_id as string | null;
    if (!classId) continue;
    if (!classCache.has(classId)) classCache.set(classId, await readClass(admin, classId));
    const cls = classCache.get(classId);
    if (!cls) continue;
    const patch: Record<string, unknown> = {};

    const kept = (hold.peer_reports as HoldPeerReport[] | null) ?? [];
    const retry = peerReportsToRetry(kept, hold.created_at as string, now);
    if (retry.length) {
      const fresh = await Promise.all(
        retry.map(async (r): Promise<HoldPeerReport> => {
          const res = await peerReport(r.peerId, { app: cls.rtk_app });
          const fetchedAt = new Date().toISOString();
          return res.ok
            ? { ...r, fetchedAt, ok: true, error: null, report: res.data }
            : { ...r, fetchedAt, ok: false, error: peerError(res) };
        })
      );
      patch.peer_reports = mergePeerReports(kept, fresh);
      summary.peerReportsRetried += retry.length;
    }

    if (now.getTime() - new Date(hold.created_at as string).getTime() < 14 * DAY_MS) {
      const snap = await snapshotClass(admin, classId);
      const oldT = (hold.transcript as unknown[] | null) ?? [];
      const oldC = (hold.chat as unknown[] | null) ?? [];
      if (snap.transcript.length > oldT.length) patch.transcript = snap.transcript;
      if (snap.chat.length > oldC.length) patch.chat = snap.chat;
      if (patch.transcript || patch.chat) summary.snapshotsRefreshed++;
    }

    if (Object.keys(patch).length) await admin.from("class_safety_holds").update(patch).eq("id", hold.id);
  }
  return summary;
}

/**
 * The sweep's once-a-day part: deletes holds past expires_at, and their
 * recordings in R2 once no live hold of the class points at them. A hold
 * whose recording can't be deleted yet (no R2 keys, or R2 refused) stays
 * until a later run can, so nothing is left in the bucket without a row.
 */
export async function deleteExpiredHolds(opts: { classId?: string } = {}): Promise<{ deleted: number; kept: number }> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  let q = admin
    .from("class_safety_holds")
    .select("id, class_id, reason, recording_key")
    .lte("expires_at", nowIso)
    .order("expires_at", { ascending: true })
    .limit(200);
  if (opts.classId) q = q.eq("class_id", opts.classId);
  const { data: expired } = await q;
  let deleted = 0;
  let kept = 0;
  const cfg = r2Config();
  for (const h of expired ?? []) {
    const key = h.recording_key as string | null;
    if (key) {
      const { count } = await admin
        .from("class_safety_holds")
        .select("id", { count: "exact", head: true })
        .eq("recording_key", key)
        .gt("expires_at", nowIso);
      if (!count) {
        if (!cfg) {
          kept++;
          console.warn(`deleteExpiredHolds: hold ${h.id} keeps its row until R2 keys are set`);
          continue;
        }
        const res = await deletePrefix(cfg, key);
        if (!res.ok) {
          kept++;
          console.error(`deleteExpiredHolds: R2 delete for hold ${h.id}: ${res.error}`);
          continue;
        }
        if (h.class_id) await ledger(admin, h.class_id as string, { sessionId: "*", status: "deleted", key, objects: res.deleted });
      }
    }
    const { error } = await admin.from("class_safety_holds").delete().eq("id", h.id);
    if (error) {
      kept++;
      continue;
    }
    deleted++;
    await logEvent(admin, (h.class_id as string | null) ?? null, null, "hold_expired", {
      holdId: h.id,
      reason: h.reason,
    });
  }
  return { deleted, kept };
}

/* ── The holds pages ───────────────────────────────────────────────── */

type HoldListRow = Omit<ClassSafetyHoldRow, "transcript" | "chat" | "peer_reports">;

export type HoldClassInfo = {
  id: string;
  title: string;
  startsAt: string;
  status: ClassStatus;
  teacherHandle: string | null;
};

/** A restricted hold, as anyone but the safety lead sees it. */
export type HiddenHold = {
  id: string;
  hidden: true;
  placeholder: string;
  createdAt: string;
  expiresAt: string;
  class: HoldClassInfo | null;
};

export type HoldSummary = {
  id: string;
  hidden: false;
  restricted: boolean;
  reason: HoldReason;
  reasonLabel: string;
  createdAt: string;
  createdByHandle: string | null;
  expiresAt: string;
  expired: boolean;
  class: HoldClassInfo | null;
  subjectUserId: string | null;
  subjectHandle: string | null;
  subjectEmail: string | null;
  /** The subject's account still exists. */
  subjectAccountExists: boolean;
  recordingStatus: HoldRecordingStatus;
  recordingLabel: string;
  ncmecReportId: string | null;
  notes: string | null;
  releasedAt: string | null;
  releasedByHandle: string | null;
};

export type HoldsDesk = {
  role: ClassReviewer["role"];
  safetyLead: boolean;
  holds: (HoldSummary | HiddenHold)[];
  r2Configured: boolean;
};

async function summarize(
  admin: Admin,
  rows: HoldListRow[],
  safetyLead: boolean
): Promise<(HoldSummary | HiddenHold)[]> {
  const classIds = [...new Set(rows.map((r) => r.class_id).filter((x): x is string => !!x))];
  const [classes, reviews] = await Promise.all([
    classIds.length
      ? admin.from("classes").select("id, title, starts_at, status, teacher_id").in("id", classIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    classIds.length
      ? admin.from("class_reviews").select("class_id, restricted").in("class_id", classIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);
  const classRows = new Map((classes.data ?? []).map((c) => [c.id as string, c]));
  const restrictedReview = new Map((reviews.data ?? []).map((r) => [r.class_id as string, r.restricted === true]));
  const subjects = [...new Set(rows.map((r) => r.subject_user_id).filter((x): x is string => !!x))];
  const [handles, alive] = await Promise.all([
    handlesFor(admin, [
      ...rows.map((r) => r.created_by),
      ...rows.map((r) => r.released_by),
      ...[...classRows.values()].map((c) => c.teacher_id as string | null),
    ]),
    subjects.length
      ? admin.from("profiles").select("id").in("id", subjects)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);
  const aliveIds = new Set((alive.data ?? []).map((p) => p.id as string));
  const now = Date.now();

  return rows.map((r) => {
    const c = r.class_id ? classRows.get(r.class_id) : null;
    const cls: HoldClassInfo | null = c
      ? {
          id: c.id as string,
          title: c.title as string,
          startsAt: c.starts_at as string,
          status: c.status as ClassStatus,
          teacherHandle: c.teacher_id ? handles.get(c.teacher_id as string) ?? null : null,
        }
      : null;
    const restricted = isHoldRestricted({
      reason: r.reason,
      releasedAt: r.released_at,
      reviewRestricted: r.class_id ? restrictedReview.get(r.class_id) : false,
    });
    if (restricted && !safetyLead) {
      return {
        id: r.id,
        hidden: true,
        placeholder: RESTRICTED_PLACEHOLDER,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
        class: cls,
      } satisfies HiddenHold;
    }
    return {
      id: r.id,
      hidden: false,
      restricted,
      reason: r.reason,
      reasonLabel: HOLD_REASON_LABELS[r.reason] ?? r.reason,
      createdAt: r.created_at,
      createdByHandle: r.created_by ? handles.get(r.created_by) ?? null : null,
      expiresAt: r.expires_at,
      expired: new Date(r.expires_at).getTime() <= now,
      class: cls,
      subjectUserId: r.subject_user_id,
      subjectHandle: r.subject_handle,
      subjectEmail: r.subject_email,
      subjectAccountExists: !!r.subject_user_id && aliveIds.has(r.subject_user_id),
      recordingStatus: r.recording_status,
      recordingLabel: HOLD_RECORDING_LABELS[r.recording_status] ?? r.recording_status,
      ncmecReportId: r.ncmec_report_id,
      notes: r.notes,
      releasedAt: r.released_at,
      releasedByHandle: r.released_by ? handles.get(r.released_by) ?? null : null,
    } satisfies HoldSummary;
  });
}

/** /admin/classes/holds: every hold, newest first. Restricted ones are the safety lead's alone. */
export async function loadHoldsDesk(user: AppUser): Promise<Result<HoldsDesk>> {
  const gate = await requireClassReviewer(user);
  if (!gate.ok) return gate;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("class_safety_holds")
    .select(HOLD_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return fail("server", "Couldn't load the holds. Try again.");
  const holds = await summarize(admin, (data ?? []) as HoldListRow[], gate.safetyLead);
  return { ok: true, role: gate.role, safetyLead: gate.safetyLead, holds, r2Configured: !!r2Config() };
}

export type HeldPeer = HoldPeerReport & { summary: PeerSummary };

export type HoldRecordingSession = {
  sessionId: string;
  status: SessionCopyState["status"] | "pending" | "none";
  error: string | null;
  bytes: number | null;
  sourceExpiresAt: string | null;
};

export type HoldDetail = HoldSummary & {
  transcript: HeldTranscriptLine[];
  chat: ClassChatMessageRow[];
  peers: HeldPeer[];
  recordings: HoldRecordingSession[];
};

async function readHold(admin: Admin, holdId: string): Promise<ClassSafetyHoldRow | null> {
  const { data } = await admin.from("class_safety_holds").select("*").eq("id", holdId).maybeSingle();
  return (data as ClassSafetyHoldRow | null) ?? null;
}

/** Whether a hold is restricted right now (its class's review, or a refusal). */
async function holdRestricted(admin: Admin, row: Pick<ClassSafetyHoldRow, "reason" | "released_at" | "class_id">) {
  let reviewRestricted = false;
  if (row.class_id) {
    const { data } = await admin.from("class_reviews").select("restricted").eq("class_id", row.class_id).maybeSingle();
    reviewRestricted = data?.restricted === true;
  }
  return isHoldRestricted({ reason: row.reason, releasedAt: row.released_at, reviewRestricted });
}

const GONE = "That hold doesn't exist any more.";
const RESTRICTED_ONLY = `Only the safety lead can do that while this hold is restricted. ${RESTRICTED_PLACEHOLDER}`;

/** One hold, in full for whoever may see it; a placeholder otherwise. Logs the view. */
export async function loadHold(user: AppUser, holdId: unknown): Promise<Result<{ hold: HoldDetail | HiddenHold; safetyLead: boolean; r2Configured: boolean }>> {
  const gate = await requireClassReviewer(user);
  if (!gate.ok) return gate;
  if (!isUuid(holdId)) return fail("not_found", GONE);
  const admin = createAdminClient();
  const row = await readHold(admin, holdId);
  if (!row) return fail("not_found", GONE);
  const [summary] = await summarize(admin, [row], gate.safetyLead);
  if (summary.hidden) return { ok: true, hold: summary, safetyLead: gate.safetyLead, r2Configured: !!r2Config() };

  let recordings: HoldRecordingSession[] = [];
  if (row.class_id) {
    const { sessions, ledger: states } = await recordingState(admin, row.class_id);
    recordings = sessions.map((s) => {
      const st = states.get(s.sessionId);
      return {
        sessionId: s.sessionId,
        status: st?.status ?? (s.recordingUrl ? "pending" : "none"),
        error: st?.error ?? null,
        bytes: st?.bytes ?? null,
        sourceExpiresAt: s.recordingExpiresAt,
      };
    });
  }
  const peers = ((row.peer_reports as HoldPeerReport[] | null) ?? []).map((p) => ({
    ...p,
    summary: summarizePeerReport(p.report),
  }));
  await logEvent(admin, row.class_id, user.id, "hold_viewed", { holdId: row.id, restricted: summary.restricted });
  return {
    ok: true,
    safetyLead: gate.safetyLead,
    r2Configured: !!r2Config(),
    hold: {
      ...summary,
      transcript: (row.transcript as HeldTranscriptLine[] | null) ?? [],
      chat: (row.chat as ClassChatMessageRow[] | null) ?? [],
      peers,
      recordings,
    },
  };
}

/** Reads a hold for a change: the reviewer gate, then the restricted gate. */
async function holdForChange(
  user: AppUser,
  holdId: unknown
): Promise<{ ok: true; gate: ClassReviewer; row: ClassSafetyHoldRow; restricted: boolean; admin: Admin } | Failure> {
  const gate = await requireClassReviewer(user);
  if (!gate.ok) return gate;
  if (!isUuid(holdId)) return fail("not_found", GONE);
  const admin = createAdminClient();
  const row = await readHold(admin, holdId);
  if (!row) return fail("not_found", GONE);
  const restricted = await holdRestricted(admin, row);
  if (restricted && !gate.safetyLead) return fail("forbidden", RESTRICTED_ONLY);
  return { ok: true, gate, row, restricted, admin };
}

function text(v: unknown): string | null {
  if (v === undefined || v === null) return "";
  return typeof v === "string" ? v.trim() : null;
}

/**
 * Adds a dated note ("Write down what you did on the hold") and/or sets the
 * NCMEC CyberTipline report number.
 */
export async function noteHold(
  user: AppUser,
  input: { holdId: unknown; note?: unknown; ncmecReportId?: unknown }
): Promise<Result<{ message: string }>> {
  const note = text(input.note);
  const ncmec = text(input.ncmecReportId);
  if (note === null || ncmec === null) return fail("validation", "That request wasn't in the format we expected.");
  if (!note && !ncmec) return { ...fail("validation", "Write a note or a report number first."), field: "note" };
  if (note.length > HOLD_NOTE_MAX)
    return { ...fail("validation", `Keep the note under ${HOLD_NOTE_MAX} characters.`), field: "note" };
  if (ncmec && !NCMEC_ID_PATTERN.test(ncmec))
    return {
      ...fail("validation", "The report number is the one the CyberTipline gave you: letters, digits and dashes only."),
      field: "ncmecReportId",
    };
  const h = await holdForChange(user, input.holdId);
  if (!h.ok) return h;
  const by = await handleOf(h.admin, user.id);
  let notes = h.row.notes;
  if (ncmec && ncmec !== h.row.ncmec_report_id) notes = appendHoldNote(notes, `CyberTipline report number ${ncmec}.`, by);
  if (note && notes !== null) notes = appendHoldNote(notes, note, by);
  if (notes === null) return { ...fail("validation", "This hold's notes are full. Keep the note shorter."), field: "note" };
  const { error } = await h.admin
    .from("class_safety_holds")
    .update({ notes, ...(ncmec ? { ncmec_report_id: ncmec } : {}) })
    .eq("id", h.row.id);
  if (error) return fail("server", "Couldn't save that. Try again.");
  await logEvent(h.admin, h.row.class_id, user.id, "hold_noted", { holdId: h.row.id, ncmec: !!ncmec });
  return { ok: true, message: ncmec ? "Saved, with the report number." : "Saved." };
}

/**
 * Extends a hold to a year from today (never shorter than it already is), for
 * "law enforcement asked" or "NCMEC report filed". The reason is required and
 * goes on the hold.
 */
export async function extendHold(
  user: AppUser,
  input: { holdId: unknown; note: unknown }
): Promise<Result<{ expiresAt: string; message: string }>> {
  const note = text(input.note);
  if (note === null) return fail("validation", "That request wasn't in the format we expected.");
  if (!note) return { ...fail("validation", "Say why it's being kept longer."), field: "note" };
  if (note.length > HOLD_NOTE_MAX)
    return { ...fail("validation", `Keep the note under ${HOLD_NOTE_MAX} characters.`), field: "note" };
  const h = await holdForChange(user, input.holdId);
  if (!h.ok) return h;
  const until = laterOf(h.row.expires_at, holdExpiry());
  const by = await handleOf(h.admin, user.id);
  const notes = appendHoldNote(h.row.notes, `Kept until ${noteDay(until)}: ${note}`, by);
  if (notes === null) return { ...fail("validation", "This hold's notes are full. Keep the reason shorter."), field: "note" };
  const { error } = await h.admin
    .from("class_safety_holds")
    .update({ expires_at: until.toISOString(), notes })
    .eq("id", h.row.id);
  if (error) return fail("server", "Couldn't save that. Try again.");
  await logEvent(h.admin, h.row.class_id, user.id, "hold_extended", { holdId: h.row.id, until: until.toISOString() });
  return { ok: true, expiresAt: until.toISOString(), message: `Kept until ${noteDay(until)}.` };
}

/**
 * The safety lead releases restricted material to the super admins.
 *
 * With `holdId`, that one hold. With `classId`, every hold of the class and
 * the class's review (class_reviews.restricted goes false), which is what the
 * review page's "Release to reviewers" button calls, so the review and its
 * holds can never disagree. Only the safety lead can release.
 */
export async function releaseHold(
  user: AppUser,
  input: { holdId?: unknown; classId?: unknown; note?: unknown }
): Promise<Result<{ released: number; message: string }>> {
  const gate = await requireClassReviewer(user);
  if (!gate.ok) return gate;
  if (!gate.safetyLead) return fail("forbidden", "Only the safety lead can release restricted material.");
  const note = text(input.note);
  if (note === null) return fail("validation", "That request wasn't in the format we expected.");
  if (note.length > HOLD_NOTE_MAX)
    return { ...fail("validation", `Keep the note under ${HOLD_NOTE_MAX} characters.`), field: "note" };
  const admin = createAdminClient();
  const by = await handleOf(admin, user.id);
  const stamp = new Date().toISOString();
  const line = `Released to reviewers${note ? `: ${note}` : "."}`;

  let rows: Pick<ClassSafetyHoldRow, "id" | "notes" | "class_id">[] = [];
  let classId: string | null = null;
  if (isUuid(input.holdId)) {
    const row = await readHold(admin, input.holdId);
    if (!row) return fail("not_found", GONE);
    if (row.released_at) return fail("conflict", "That hold is already released.");
    rows = [row];
    classId = row.class_id;
  } else if (isUuid(input.classId)) {
    classId = input.classId;
    const { data } = await admin
      .from("class_safety_holds")
      .select("id, notes, class_id")
      .eq("class_id", classId)
      .is("released_at", null);
    rows = (data ?? []) as typeof rows;
    const { error } = await admin.from("class_reviews").update({ restricted: false }).eq("class_id", classId);
    if (error) return fail("server", "Couldn't release that. Try again.");
  } else {
    return fail("not_found", GONE);
  }

  for (const r of rows) {
    const notes = appendHoldNote(r.notes, line, by) ?? r.notes;
    const { error } = await admin
      .from("class_safety_holds")
      .update({ released_at: stamp, released_by: user.id, notes })
      .eq("id", r.id);
    if (error) return fail("server", "Couldn't release that. Try again.");
  }
  await logEvent(admin, classId, user.id, "hold_released", {
    holdIds: rows.map((r) => r.id),
    wholeClass: !isUuid(input.holdId),
  });
  return {
    ok: true,
    released: rows.length,
    message: rows.length === 1 ? "Released. Super admins can see it now." : `Released ${rows.length} holds to reviewers.`,
  };
}

/** "Try the copy again" on a hold whose recording copy failed. */
export async function retryHoldCopy(user: AppUser, input: { holdId: unknown }): Promise<Result<{ message: string }>> {
  const h = await holdForChange(user, input.holdId);
  if (!h.ok) return h;
  if (!h.row.class_id) return fail("validation", "This hold has no class, so there's no recording to copy.");
  if (!r2Config()) return fail("validation", "The holds bucket isn't set up yet (R2 keys), so nothing can be copied.");
  const classId = h.row.class_id;
  later("recording copy (by hand)", () => copyHeldRecordings(classId, { force: true }));
  await logEvent(h.admin, classId, user.id, "hold_copy_retried", { holdId: h.row.id });
  return { ok: true, message: "Copying. Reload in a few minutes." };
}

export type HeldRecordingLink = { sessionId: string; url: string; expiresAt: string };

async function linksFor(admin: Admin, classId: string): Promise<Result<{ links: HeldRecordingLink[] }>> {
  const cfg = r2Config();
  if (!cfg) return fail("validation", "The holds bucket isn't set up yet (R2 keys).");
  const { sessions, ledger: states } = await recordingState(admin, classId);
  const links: HeldRecordingLink[] = [];
  for (const s of sessions) {
    const st = states.get(s.sessionId);
    if (st?.status !== "stored") continue;
    const res = await presignGet(cfg, holdRecordingKey(classId, s.sessionId), RECORDING_LINK_SECONDS);
    if (res.ok) links.push({ sessionId: s.sessionId, url: res.url, expiresAt: res.expiresAt });
  }
  if (!links.length) return fail("not_found", "No recording of this class is kept in the holds bucket yet.");
  return { ok: true, links };
}

/**
 * 15-minute links to a held class's recordings, for the holds page. Never
 * stored or emailed; each request is logged.
 */
export async function holdRecordingLinks(
  user: AppUser,
  input: { holdId: unknown }
): Promise<Result<{ links: HeldRecordingLink[] }>> {
  const h = await holdForChange(user, input.holdId);
  if (!h.ok) return h;
  if (!h.row.class_id) return fail("not_found", "This hold has no class, so there's no recording.");
  const res = await linksFor(h.admin, h.row.class_id);
  if (res.ok) await logEvent(h.admin, h.row.class_id, user.id, "hold_recording_opened", { holdId: h.row.id });
  return res;
}

/**
 * The review page's #recording section, when the class is held: 15-minute
 * links to the kept recordings. Refuses anyone but the safety lead while the
 * class's review is restricted or a refusal hold is unreleased.
 */
export async function heldRecordingLinks(
  user: AppUser,
  classId: unknown
): Promise<Result<{ links: HeldRecordingLink[] }>> {
  const gate = await requireClassReviewer(user);
  if (!gate.ok) return gate;
  if (!isUuid(classId)) return fail("not_found", "That class doesn't exist.");
  const admin = createAdminClient();
  if (!gate.safetyLead) {
    const { data: holds } = await admin
      .from("class_safety_holds")
      .select("reason, released_at, class_id")
      .eq("class_id", classId);
    const { data: review } = await admin.from("class_reviews").select("restricted").eq("class_id", classId).maybeSingle();
    const restricted =
      review?.restricted === true ||
      (holds ?? []).some((h) =>
        isHoldRestricted({ reason: h.reason as HoldReason, releasedAt: h.released_at as string | null, reviewRestricted: false })
      );
    if (restricted) return fail("forbidden", RESTRICTED_ONLY);
  }
  const res = await linksFor(admin, classId);
  if (res.ok) await logEvent(admin, classId, user.id, "hold_recording_opened", { from: "review" });
  return res;
}
