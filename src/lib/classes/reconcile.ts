import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/app/http";
import { fail, type Result } from "@/lib/app/result";
import { endClass } from "@/lib/app/classes-room";
import { classesConfigured, getClassSettings, rtkApp } from "@/lib/classes/config";
import { creditedMinutes, type AttendanceSpan } from "@/lib/classes/minutes";
import {
  deleteParticipant,
  rtkRequest,
  sessionParticipants,
  sessionTranscript,
  type RtkResult,
  type RtkSessionParticipant,
} from "@/lib/classes/realtimekit";
import { runClassReview } from "@/lib/classes/review";
import { deleteExpiredHolds, retryHoldWork, type HoldSweepSummary } from "@/lib/classes/holds";
import { expireParentRequests } from "@/lib/app/class-consent";
import { reviewDue, sweepDecision } from "@/lib/classes/sweep-rules";
import { isEmptyTranscriptFile, isoOf, parseTranscriptFile, wordCount } from "@/lib/classes/webhook-events";
import {
  SYSTEM_ACTOR,
  type ClassEndReason,
  type ClassRole,
  type ClassStatus,
  type ReviewStatus,
  type RtkApp,
  type SystemActor,
  type TranscriptLine,
} from "@/lib/classes/types";
import type { AppUser } from "@/lib/app/result";

/**
 * Keeping a class's records whole (classes-design.md 6.8 and 6.9):
 *
 *   reconcileClass(classId)   fills attendance gaps from Cloudflare's session
 *                             records, pulls missing transcripts, recomputes
 *                             the teacher's minutes, and runs the review when
 *                             it's due. Idempotent. The sweep, "Pull from
 *                             Cloudflare" on /admin/classes/[id] and the flow
 *                             test call it.
 *   runSweep()                the 5-minute sweep: hard ends, teacher gone,
 *                             empty rooms, never-started classes, reviews
 *                             due, RealtimeKit cleanup retries, and once a
 *                             day, retention.
 *
 * The shared pieces the webhook uses live here too (sessions, joins, leaves,
 * transcripts, minutes), so the webhook and reconcile write rows the same way.
 *
 * Only this deployment's app's classes are touched: dev and prod share one
 * database (section 1). Ending a class always goes through endClass (the
 * room's shared rule: kick-all, the meeting INACTIVE, status `ended`).
 *
 * `deps` lets tests stand in for Cloudflare, the transcript download, endClass
 * and the review, so the decisions can be checked without keys.
 */

/* ── Test seams ────────────────────────────────────────────────────── */

export type RtkSessionRecord = {
  id: string;
  associated_id?: string;
  started_at?: string;
  ended_at?: string | null;
  status?: string;
};

export type ClassOpsDeps = {
  now?: () => Date;
  endClass?: (actor: AppUser | SystemActor, input: { classId: string; reason: ClassEndReason }) => Promise<Result>;
  runReview?: (classId: string) => Promise<Result<{ status: ReviewStatus }>>;
  download?: (url: string) => Promise<string>;
  deleteParticipant?: (meetingId: string, participantId: string, opts: { app: RtkApp }) => Promise<RtkResult<unknown>>;
  rtk?: {
    configured?: () => boolean;
    listSessions?: (meetingId: string, app: RtkApp) => Promise<RtkResult<{ sessions?: RtkSessionRecord[] } | RtkSessionRecord[]>>;
    participants?: (
      sessionId: string,
      app: RtkApp
    ) => Promise<RtkResult<{ participants?: RtkSessionParticipant[] } | RtkSessionParticipant[]>>;
    transcript?: (sessionId: string, app: RtkApp) => Promise<RtkResult<{ transcript_download_url?: string; [k: string]: unknown }>>;
  };
};

const nowOf = (deps?: ClassOpsDeps) => deps?.now?.() ?? new Date();
const endClassOf = (deps?: ClassOpsDeps) => deps?.endClass ?? endClass;
const reviewOf = (deps?: ClassOpsDeps) => deps?.runReview ?? ((id: string) => runClassReview(id));

/** Downloads a transcript file Cloudflare points at. https only, 20 MB at most. */
export async function downloadTranscript(url: string): Promise<string> {
  const u = new URL(url);
  if (u.protocol !== "https:") throw new Error("transcript links must be https");
  const res = await fetch(u, { signal: AbortSignal.timeout(20_000), cache: "no-store" });
  if (!res.ok) throw new Error(`transcript download answered ${res.status}`);
  const text = await res.text();
  if (text.length > 20_000_000) throw new Error("transcript too large");
  return text;
}

/* ── Rows the webhook and reconcile share ──────────────────────────── */

export type ClassRef = {
  id: string;
  teacher_id: string | null;
  starts_at: string;
  duration_minutes: number;
  hard_end_at: string;
  status: ClassStatus;
  rtk_app: RtkApp;
  rtk_meeting_id: string | null;
  live_started_at: string | null;
  ended_at: string | null;
};

export const CLASS_REF_COLUMNS =
  "id, teacher_id, starts_at, duration_minutes, hard_end_at, status, rtk_app, rtk_meeting_id, live_started_at, ended_at";

/**
 * Creates the session row if it's missing and sets the given fields. Every
 * webhook handler calls this first, so a join that beats meeting.started
 * can't fail the attendance foreign key.
 */
export async function upsertSession(
  classId: string,
  sessionId: string,
  fields: Partial<{ started_at: string | null; ended_at: string | null; end_reason: string | null; recording_url: string; recording_expires_at: string | null }> = {}
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("class_sessions")
    .upsert({ id: sessionId, class_id: classId }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error(`class_sessions: ${error.message}`);
  const set = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== null));
  if (Object.keys(set).length) {
    const { error: e2 } = await admin.from("class_sessions").update(set).eq("id", sessionId).eq("class_id", classId);
    if (e2) throw new Error(`class_sessions: ${e2.message}`);
  }
}

/** The user id behind a custom_participant_id, if it's one of our accounts. */
async function knownUser(cpi: string | null | undefined): Promise<{ id: string; createdAt: string | null } | null> {
  if (!isUuid(cpi)) return null;
  try {
    const { data } = await createAdminClient().auth.admin.getUserById(cpi);
    return data?.user ? { id: data.user.id, createdAt: data.user.created_at ?? null } : null;
  } catch {
    return null;
  }
}

/** The person's role in this class: the teacher, their participant row's role, or a student. */
async function roleIn(cls: Pick<ClassRef, "id" | "teacher_id">, userId: string | null): Promise<ClassRole> {
  if (!userId) return "student";
  if (userId === cls.teacher_id) return "teacher";
  const { data } = await createAdminClient()
    .from("class_participants")
    .select("role")
    .eq("class_id", cls.id)
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.role as ClassRole | undefined) ?? "student";
}

export type JoinInput = {
  sessionId: string;
  peerId: string;
  customParticipantId: string | null;
  joinedAt: string;
  leftAt?: string | null;
  source: "webhook" | "reconcile";
};

/**
 * Records one connection (class_attendance), once per (session, peer).
 * Returns whether a row was added and whose it is.
 */
export async function recordJoin(
  cls: Pick<ClassRef, "id" | "teacher_id">,
  j: JoinInput
): Promise<{ added: boolean; userId: string | null; role: ClassRole }> {
  const user = await knownUser(j.customParticipantId);
  const role = await roleIn(cls, user?.id ?? null);
  const accountAgeDays =
    user?.createdAt != null ? Math.max(0, Math.floor((Date.parse(j.joinedAt) - Date.parse(user.createdAt)) / 86_400_000)) : null;
  const { data, error } = await createAdminClient()
    .from("class_attendance")
    .upsert(
      {
        class_id: cls.id,
        session_id: j.sessionId,
        user_id: user?.id ?? null,
        role,
        account_age_days: accountAgeDays,
        peer_id: j.peerId,
        joined_at: j.joinedAt,
        left_at: j.leftAt ?? null,
        source: j.source,
      },
      { onConflict: "session_id,peer_id", ignoreDuplicates: true }
    )
    .select("id");
  if (error) throw new Error(`class_attendance: ${error.message}`);
  return { added: (data?.length ?? 0) > 0, userId: user?.id ?? null, role };
}

/**
 * Closes one connection. If the join was never recorded (a missed webhook),
 * the whole interval is inserted instead.
 */
export async function recordLeave(
  cls: Pick<ClassRef, "id" | "teacher_id">,
  j: JoinInput & { leftAt: string }
): Promise<"closed" | "inserted" | "already"> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("class_attendance")
    .update({ left_at: j.leftAt })
    .eq("session_id", j.sessionId)
    .eq("peer_id", j.peerId)
    .is("left_at", null)
    .select("id");
  if (error) throw new Error(`class_attendance: ${error.message}`);
  if (data?.length) return "closed";
  const res = await recordJoin(cls, j);
  return res.added ? "inserted" : "already";
}

/**
 * Recomputes and stores the teacher's credited minutes (section 3.4) for a
 * class that has ended and isn't decided yet. Returns the minutes, or null
 * when the class isn't in that state.
 */
export async function finalizeMinutes(classId: string): Promise<number | null> {
  const admin = createAdminClient();
  const { data: cls } = await admin
    .from("classes")
    .select("id, status, starts_at, hard_end_at")
    .eq("id", classId)
    .maybeSingle();
  if (!cls || (cls.status !== "ended" && cls.status !== "in_review")) return null;
  const [settings, att, sessions] = await Promise.all([
    getClassSettings(),
    admin.from("class_attendance").select("user_id, role, joined_at, left_at, account_age_days, session_id").eq("class_id", classId),
    admin.from("class_sessions").select("id, ended_at").eq("class_id", classId),
  ]);
  const ends = new Map((sessions.data ?? []).map((s) => [s.id as string, s.ended_at as string | null]));
  const spans: AttendanceSpan[] = (att.data ?? []).map((a) => ({
    userId: a.user_id as string | null,
    role: a.role as ClassRole,
    joinedAt: a.joined_at as string,
    leftAt: a.left_at as string | null,
    accountAgeDays: a.account_age_days as number | null,
    sessionEndedAt: ends.get(a.session_id as string) ?? null,
  }));
  const minutes = creditedMinutes({
    attendance: spans,
    startsAt: cls.starts_at as string,
    hardEndAt: cls.hard_end_at as string,
    minStudentAccountDays: settings.min_student_account_days,
  });
  await admin
    .from("classes")
    .update({ credited_minutes_computed: minutes, updated_at: new Date().toISOString() })
    .eq("id", classId)
    .in("status", ["ended", "in_review"]);
  return minutes;
}

/** "2026-11-20" plus a year: when a transcript is purged (section 3.10). */
function purgeAfter(startsAt: string): string {
  const d = new Date(startsAt);
  d.setUTCDate(d.getUTCDate() + 365);
  return d.toISOString().slice(0, 10);
}

/**
 * Stores a downloaded transcript for one session (class_transcripts), with
 * each line's speaker mapped to their current @username and role, and marks
 * the session's transcript stored. Returns the number of lines.
 */
export async function storeTranscript(
  cls: Pick<ClassRef, "id" | "teacher_id" | "starts_at">,
  sessionId: string,
  fileText: string
): Promise<number> {
  const admin = createAdminClient();
  const { data: session } = await admin.from("class_sessions").select("started_at").eq("id", sessionId).maybeSingle();
  const startMs = session?.started_at ? Date.parse(session.started_at as string) : null;
  const raw = parseTranscriptFile(fileText, startMs);
  const ids = [...new Set(raw.map((l) => l.cpi).filter((x): x is string => isUuid(x)))];
  const [profiles, parts] = await Promise.all([
    ids.length ? admin.from("profiles").select("id, username").in("id", ids) : Promise.resolve({ data: [] }),
    ids.length ? admin.from("class_participants").select("user_id, role").eq("class_id", cls.id).in("user_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const names = new Map(((profiles.data ?? []) as { id: string; username: string | null }[]).map((p) => [p.id, p.username]));
  const roles = new Map(((parts.data ?? []) as { user_id: string; role: ClassRole }[]).map((p) => [p.user_id, p.role]));
  const lines: TranscriptLine[] = raw.map((l) => {
    const userId = isUuid(l.cpi) ? l.cpi : null;
    const username = userId ? names.get(userId) : null;
    const fallback = (l.displayName ?? "").replace(/\s*\((teacher|LearnFRC staff)\)\s*$/, "").trim();
    return {
      t0: Math.round(l.t0 * 10) / 10,
      t1: Math.round(l.t1 * 10) / 10,
      userId,
      label: username ? `@${username}` : fallback || "unknown speaker",
      role: userId ? (userId === cls.teacher_id ? "teacher" : (roles.get(userId) ?? "student")) : null,
      text: l.text,
    };
  });
  const { error } = await admin.from("class_transcripts").upsert(
    {
      session_id: sessionId,
      class_id: cls.id,
      lines,
      word_count: wordCount(lines),
      fetched_at: new Date().toISOString(),
      purge_after: purgeAfter(cls.starts_at),
    },
    { onConflict: "session_id" }
  );
  if (error) throw new Error(`class_transcripts: ${error.message}`);
  await admin
    .from("class_sessions")
    .update({ transcript_status: "stored", transcript_fetched_at: new Date().toISOString() })
    .eq("id", sessionId);
  return lines.length;
}

/** True when the class is over and every session's transcript is stored. */
export async function allTranscriptsIn(classId: string): Promise<boolean> {
  const { data } = await createAdminClient().from("class_sessions").select("transcript_status").eq("class_id", classId);
  return !!data?.length && data.every((s) => s.transcript_status === "stored");
}

/* ── Reconcile ─────────────────────────────────────────────────────── */

export type ReconcileReport = {
  cloudflare: "ok" | "not_configured" | "error";
  sessions: number;
  attendanceAdded: number;
  attendanceClosed: number;
  transcriptsStored: number;
  /** Sessions whose transcript link served an empty file: not ready yet, fetched again next time. */
  transcriptsWaiting: number;
  minutes: number | null;
  review: ReviewStatus | null;
  errors: string[];
};

function listOf<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[];
  const v = (data as Record<string, unknown> | null)?.[key];
  return Array.isArray(v) ? (v as T[]) : [];
}

/**
 * Brings one class's rows up to date with Cloudflare, recomputes minutes and
 * runs the review when it's due (section 6.9). Idempotent. Without
 * RealtimeKit keys it still recomputes minutes and runs a due review.
 */
export async function reconcileClass(
  classId: string,
  opts: { deps?: ClassOpsDeps; review?: boolean } = {}
): Promise<Result<ReconcileReport>> {
  if (!isUuid(classId)) return fail("not_found", "That class doesn't exist.");
  const deps = opts.deps;
  const admin = createAdminClient();
  const { data: row } = await admin.from("classes").select(CLASS_REF_COLUMNS).eq("id", classId).maybeSingle();
  const cls = row as ClassRef | null;
  if (!cls) return fail("not_found", "That class doesn't exist.");
  if (cls.rtk_app !== rtkApp()) return fail("forbidden", "That class belongs to the other RealtimeKit app.");

  const report: ReconcileReport = {
    cloudflare: "ok",
    sessions: 0,
    attendanceAdded: 0,
    attendanceClosed: 0,
    transcriptsStored: 0,
    transcriptsWaiting: 0,
    minutes: null,
    review: null,
    errors: [],
  };
  const configured = deps?.rtk?.configured?.() ?? classesConfigured();
  const app = cls.rtk_app;

  if (!configured || !cls.rtk_meeting_id) {
    report.cloudflare = "not_configured";
  } else {
    const listSessions =
      deps?.rtk?.listSessions ??
      ((meetingId: string, a: RtkApp) =>
        rtkRequest<{ sessions?: RtkSessionRecord[] }>("GET", `/sessions?associated_id=${encodeURIComponent(meetingId)}&per_page=50`, undefined, { app: a }));
    const participants = deps?.rtk?.participants ?? ((id: string, a: RtkApp) => sessionParticipants(id, { app: a }));
    const transcript = deps?.rtk?.transcript ?? ((id: string, a: RtkApp) => sessionTranscript(id, { app: a }));
    const download = deps?.download ?? downloadTranscript;

    const listed = await listSessions(cls.rtk_meeting_id, app);
    if (!listed.ok) {
      report.cloudflare = "error";
      report.errors.push(`sessions: ${listed.error}`);
    } else {
      for (const s of listOf<RtkSessionRecord>(listed.data, "sessions")) {
        if (!s?.id) continue;
        await upsertSession(cls.id, s.id, { started_at: isoOf(s.started_at), ended_at: isoOf(s.ended_at) });
      }
    }

    const { data: sessions } = await admin
      .from("class_sessions")
      .select("id, started_at, ended_at, transcript_status")
      .eq("class_id", cls.id);
    report.sessions = sessions?.length ?? 0;
    for (const s of sessions ?? []) {
      const res = await participants(s.id as string, app);
      if (!res.ok) {
        report.cloudflare = "error";
        report.errors.push(`participants ${s.id}: ${res.error}`);
      } else {
        for (const p of listOf<RtkSessionParticipant>(res.data, "participants")) {
          const peerId = (p.peer_id as string | undefined) ?? (p.id as string | undefined);
          const joinedAt = isoOf(p.joined_at);
          if (!peerId || !joinedAt) continue;
          const leftAt = isoOf(p.left_at);
          const j = { sessionId: s.id as string, peerId, customParticipantId: p.custom_participant_id ?? null, joinedAt, source: "reconcile" as const };
          if (leftAt) {
            const r = await recordLeave(cls, { ...j, leftAt });
            if (r === "closed") report.attendanceClosed++;
            if (r === "inserted") report.attendanceAdded++;
          } else if ((await recordJoin(cls, j)).added) report.attendanceAdded++;
        }
      }
      if (s.transcript_status !== "stored") {
        // Cloudflare keeps transcripts 7 days; after that it's gone.
        const markMissingIfGone = async () => {
          const ended = s.ended_at ? Date.parse(s.ended_at as string) : null;
          if (ended && nowOf(deps).getTime() - ended > 7 * 86_400_000) {
            await admin.from("class_sessions").update({ transcript_status: "missing" }).eq("id", s.id);
          }
        };
        const t = await transcript(s.id as string, app);
        const url = t.ok ? (t.data?.transcript_download_url as string | undefined) : undefined;
        if (url) {
          try {
            const text = await download(url);
            if (isEmptyTranscriptFile(text)) {
              // Cloudflare answers with a download link even before a session's
              // transcript exists, and the link serves an empty file. That's
              // "not yet", not an empty class: storing it would mark the
              // session done and never fetch the real one.
              report.transcriptsWaiting++;
              await markMissingIfGone();
            } else {
              await storeTranscript(cls, s.id as string, text);
              report.transcriptsStored++;
            }
          } catch (e) {
            report.errors.push(`transcript ${s.id}: ${(e as Error).message}`);
            await admin.from("class_sessions").update({ transcript_status: "failed" }).eq("id", s.id);
          }
        } else if (!t.ok) {
          report.errors.push(`transcript ${s.id}: ${t.error}`);
          await markMissingIfGone();
        }
      }
    }
  }

  report.minutes = await finalizeMinutes(cls.id);

  if (opts.review !== false && (cls.status === "ended" || cls.status === "in_review" || report.minutes !== null)) {
    const { data: rev } = await admin.from("class_reviews").select("status").eq("class_id", cls.id).maybeSingle();
    const done = rev && (rev.status === "ready" || rev.status === "refused" || rev.status === "no_transcript");
    if (!done) {
      const r = await reviewOf(deps)(cls.id);
      report.review = r.ok ? r.status : null;
      if (!r.ok) report.errors.push(`review: ${r.error}`);
    } else {
      report.review = rev.status as ReviewStatus;
    }
  }
  return { ok: true, ...report };
}

/* ── The sweep ─────────────────────────────────────────────────────── */

export type SweepReport = {
  app: RtkApp;
  /** The one class a test scoped the run to (never in production). */
  scoped: string | null;
  ended: { classId: string; reason: ClassEndReason; ok: boolean }[];
  reviewed: { classId: string; status: ReviewStatus | null }[];
  cleanup: { deleted: number; failed: number };
  daily: boolean;
  /** Step 6, the holds' retries (recording copies, peer reports, late transcripts). */
  holds?: HoldSweepSummary;
  /** The daily part's expired holds. */
  holdsExpired?: { deleted: number; kept: number };
  errors: string[];
};

/**
 * One sweep run (section 6.9). With `classId` (dev servers and tests only:
 * the route ignores it in production builds) it acts on that class alone and
 * skips everything site-wide: the cleanup queue, the daily retention and the
 * shared settings row.
 */
export async function runSweep(opts: { classId?: string | null; deps?: ClassOpsDeps } = {}): Promise<SweepReport> {
  const deps = opts.deps;
  const now = nowOf(deps);
  const app = rtkApp();
  const admin = createAdminClient();
  const scoped = opts.classId && isUuid(opts.classId) ? opts.classId : null;
  const report: SweepReport = { app, scoped, ended: [], reviewed: [], cleanup: { deleted: 0, failed: 0 }, daily: false, errors: [] };
  if (opts.classId && !scoped) {
    report.errors.push("classId isn't a class id");
    return report;
  }

  // 1 to 4: ends.
  let q = admin
    .from("classes")
    .select(CLASS_REF_COLUMNS)
    .eq("rtk_app", app)
    .in("status", ["scheduled", "live"])
    .or(`status.eq.live,hard_end_at.lte.${now.toISOString()}`)
    .limit(200);
  if (scoped) q = q.eq("id", scoped);
  const { data: open, error: openErr } = await q;
  if (openErr) report.errors.push(`classes: ${openErr.message}`);
  for (const c of (open ?? []) as ClassRef[]) {
    try {
      const [att, sess] = await Promise.all([
        admin.from("class_attendance").select("role, joined_at, left_at").eq("class_id", c.id),
        admin.from("class_sessions").select("id", { count: "exact", head: true }).eq("class_id", c.id),
      ]);
      const decision = sweepDecision(
        { status: c.status, startsAt: c.starts_at, hardEndAt: c.hard_end_at, hasSession: (sess.count ?? 0) > 0 },
        (att.data ?? []).map((a) => ({ role: a.role as ClassRole, joinedAt: a.joined_at as string, leftAt: a.left_at as string | null })),
        now
      );
      if (decision.action !== "end") continue;
      const res = await endClassOf(deps)(SYSTEM_ACTOR, { classId: c.id, reason: decision.reason });
      report.ended.push({ classId: c.id, reason: decision.reason, ok: res.ok });
      if (!res.ok) report.errors.push(`end ${c.id}: ${res.error}`);
      await finalizeMinutes(c.id);
    } catch (e) {
      report.errors.push(`end ${c.id}: ${(e as Error).message}`);
    }
  }

  // 5: reviews due, after a reconcile.
  let rq = admin
    .from("classes")
    .select("id, status, ended_at, hard_end_at")
    .eq("rtk_app", app)
    .in("status", ["ended", "in_review"])
    .order("ended_at", { ascending: true, nullsFirst: true })
    .limit(50);
  if (scoped) rq = rq.eq("id", scoped);
  const { data: done } = await rq;
  const ids = (done ?? []).map((c) => c.id as string);
  const { data: reviews } = ids.length
    ? await admin.from("class_reviews").select("class_id, status, attempts, updated_at").in("class_id", ids)
    : { data: [] };
  const byClass = new Map((reviews ?? []).map((r) => [r.class_id as string, r]));
  let reviewedThisRun = 0;
  for (const c of done ?? []) {
    const r = byClass.get(c.id as string);
    const due = reviewDue(
      { status: c.status as string, endedAt: c.ended_at as string | null, hardEndAt: c.hard_end_at as string },
      r ? { status: r.status as string, attempts: r.attempts as number, updatedAt: r.updated_at as string } : null,
      now
    );
    if (!due || reviewedThisRun >= 3) continue; // a few per run keeps each run short
    reviewedThisRun++;
    const rec = await reconcileClass(c.id as string, { deps, review: false });
    if (!rec.ok) report.errors.push(`reconcile ${c.id}: ${rec.error}`);
    const res = await reviewOf(deps)(c.id as string);
    report.reviewed.push({ classId: c.id as string, status: res.ok ? res.status : null });
  }

  // 6: evidence holds (holds.ts): recording copies still to make, peer
  // reports to fetch again, transcripts and chat that came in after the hold.
  try {
    report.holds = await retryHoldWork(scoped ? { classId: scoped } : {});
  } catch (e) {
    report.errors.push(`holds: ${(e as Error).message}`);
  }
  if (scoped) return report;

  // 7: RealtimeKit participants still to delete (account deletions).
  const del = deps?.deleteParticipant ?? deleteParticipant;
  const { data: queue } = await admin
    .from("class_rtk_cleanup")
    .select("meeting_id, participant_id, attempts")
    .eq("rtk_app", app)
    .lt("attempts", 20)
    .limit(50);
  for (const item of queue ?? []) {
    const res = await del(item.meeting_id as string, item.participant_id as string, { app });
    if (res.ok || res.status === 404) {
      await admin.from("class_rtk_cleanup").delete().eq("meeting_id", item.meeting_id).eq("participant_id", item.participant_id);
      report.cleanup.deleted++;
    } else {
      await admin
        .from("class_rtk_cleanup")
        .update({ attempts: (item.attempts as number) + 1, last_error: res.error.slice(0, 300) })
        .eq("meeting_id", item.meeting_id)
        .eq("participant_id", item.participant_id);
      report.cleanup.failed++;
    }
  }

  // Once a day.
  const settings = await getClassSettings();
  const last = settings.last_daily_sweep_at ? Date.parse(settings.last_daily_sweep_at) : 0;
  if (now.getTime() - last >= 23 * 3600_000) {
    report.daily = true;
    try {
      await dailyRetention(now);
    } catch (e) {
      report.errors.push(`daily: ${(e as Error).message}`);
    }
    try {
      report.holdsExpired = await deleteExpiredHolds();
    } catch (e) {
      report.errors.push(`expired holds: ${(e as Error).message}`);
    }
    await admin.from("class_settings").update({ last_daily_sweep_at: now.toISOString() }).eq("id", true);
  }
  return report;
}

/** Classes whose evidence must stay: keep_evidence, or a hold. */
async function protectedClasses(classIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!classIds.length) return out;
  const admin = createAdminClient();
  const [kept, held] = await Promise.all([
    admin.from("classes").select("id").in("id", classIds).eq("keep_evidence", true),
    admin.from("class_safety_holds").select("class_id").in("class_id", classIds),
  ]);
  for (const r of kept.data ?? []) out.add(r.id as string);
  for (const r of held.data ?? []) if (r.class_id) out.add(r.class_id as string);
  return out;
}

/**
 * The daily part (section 3.10): transcripts and chat past 365 days unless
 * kept, parent requests past their expiry, old rejected or withdrawn teacher
 * applications, and webhook payloads past 90 days. Expired holds and their R2
 * copies are the safety-holds package's.
 */
async function dailyRetention(now: Date): Promise<void> {
  const admin = createAdminClient();
  const today = now.toISOString().slice(0, 10);

  const { data: oldTranscripts } = await admin.from("class_transcripts").select("session_id, class_id").lt("purge_after", today).limit(500);
  if (oldTranscripts?.length) {
    const keep = await protectedClasses([...new Set(oldTranscripts.map((t) => t.class_id as string))]);
    const drop = oldTranscripts.filter((t) => !keep.has(t.class_id as string)).map((t) => t.session_id as string);
    if (drop.length) await admin.from("class_transcripts").delete().in("session_id", drop);
  }

  const yearAgo = new Date(now.getTime() - 365 * 86_400_000).toISOString();
  const { data: oldChat } = await admin.from("class_chat_messages").select("class_id").lt("sent_at", yearAgo).limit(1000);
  if (oldChat?.length) {
    const classes = [...new Set(oldChat.map((c) => c.class_id as string))];
    const keep = await protectedClasses(classes);
    const drop = classes.filter((id) => !keep.has(id));
    if (drop.length) await admin.from("class_chat_messages").delete().in("class_id", drop).lt("sent_at", yearAgo);
  }

  await expireParentRequests(now);

  const halfYearAgo = new Date(now.getTime() - 180 * 86_400_000).toISOString();
  await admin
    .from("teacher_applications")
    .delete()
    .in("status", ["rejected", "withdrawn"])
    .or(`reviewed_at.lt.${halfYearAgo},and(reviewed_at.is.null,created_at.lt.${halfYearAgo})`);

  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000).toISOString();
  await admin.from("class_webhook_events").delete().lt("received_at", ninetyDaysAgo);
}
