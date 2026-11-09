import "server-only";
import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { isUuid } from "@/lib/app/http";
import { fail, type AppUser, type Failure, type Result, type Success } from "@/lib/app/result";
import { blockedEitherWay, classEligibilityDetail, classRoster, eligibilitySentence } from "@/lib/app/classes";
// From the leaf module, not classes.ts: ROOM_SENTENCES reads it at load time,
// and this file is in an import cycle with classes.ts (sentences.ts says why).
import { CLASS_SENTENCES } from "@/lib/classes/sentences";
import { getTeacher, suspendTeacher } from "@/lib/app/class-teachers";
import { blockedSetFor } from "@/lib/app/blocks";
import { requireClassReviewer } from "@/lib/app/class-reviewers";
import { holdClass } from "@/lib/classes/holds";
import {
  JOIN_LIMITS,
  adminClassUrl,
  auditSalt,
  classesConfigured,
  classesVisible,
  earliestJoinFor,
  getClassSettings,
  joinsPaused,
  ownerEmail,
  playbookUrl,
  rtkApp,
  safetyEmail,
} from "@/lib/classes/config";
import { CLASS_NOTICE_VERSION } from "@/lib/classes/notice";
import { findContactPatterns, usernameHasContact } from "@/lib/classes/contact-patterns";
import {
  addParticipant,
  deleteParticipant,
  kickAll,
  kickParticipants,
  setMeetingStatus,
  type RtkResult,
} from "@/lib/classes/realtimekit";
import { displayNameFor, presetForRole } from "@/lib/classes/presets";
import {
  capState,
  isLiveNow,
  joinTiming,
  monthKey,
  monthStartUtc,
  participantMinutes,
  withinReportWindow,
} from "@/lib/classes/room-rules";
import { MEDIA_LOG_LIMITS, parseMediaBatch } from "@/lib/classes/media";
import { allRowsById } from "@/lib/classes/paged";
import { classEmailHtml, mailClass, pacificTime } from "@/lib/classes/emails";
import {
  SYSTEM_ACTOR,
  type ClassEndReason,
  type ClassRole,
  type ClassRosterEntry,
  type ClassStatus,
  type RtkApp,
  type SystemActor,
} from "@/lib/classes/types";

/**
 * The room's server rules (sections 6.4 to 6.6): joining, the room page's
 * view, ending, removing, pausing, the media log, and the auto-end on two
 * reports. The website's Server Actions (src/app/actions/class-room.ts), the
 * media-log route, the reports desk, /admin/classes and the sweep all call
 * these, so the rules live here once.
 *
 * Every read and write is service role, scoped by the id the auth server
 * verified. Who's staff (a super admin or the safety lead) is decided by
 * requireClassReviewer (src/lib/app/class-reviewers.ts), and whether a
 * teacher is suspended by getTeacher (src/lib/app/class-teachers.ts).
 *
 * The join token never leaves joinClass except in its return value: it isn't
 * stored, logged or put in a URL, and a new join rotates the participant, so
 * a token someone shared stops working the next time its owner joins.
 */

/* ── Sentences ─────────────────────────────────────────────────────── */

export const ROOM_SENTENCES = {
  hidden: CLASS_SENTENCES.hidden,
  notConfigured: "Live classes open soon. The video rooms aren't switched on yet.",
  paused: "Joining classes is paused right now. Try again in a little while.",
  notFound: CLASS_SENTENCES.notFound,
  rate: CLASS_SENTENCES.rate,
  canceled: "This class was canceled.",
  closed: "This class is over.",
  notReady: "This class's room isn't ready yet. Try again in a minute.",
  earlyStudent: "It's too early to join. The room opens 15 minutes before the class starts.",
  earlyTeacher: "It's too early to open the room. It opens 30 minutes before the class starts.",
  over: "This class is over. The room closed at its end time.",
  notEnrolled: "You're not signed up for this class. Sign up on the class page first.",
  removed: CLASS_SENTENCES.removed,
  suspended: "Your teaching is paused, so you can't open this class. If that's a mistake, write to us.",
  blocked: CLASS_SENTENCES.blocked,
  bio: CLASS_SENTENCES.bio,
  username: CLASS_SENTENCES.username,
  noticeMissing: "Tick the box to say you understand the class is recorded.",
  noticeOld: "The recording notice changed. Read it again and tick the box to join.",
  cap: "Live classes have reached this month's limit. They'll open again next month.",
  rotate: "Couldn't connect you to the room. Try again.",
  rtk: "Couldn't connect you to the room. Try again in a minute.",
  save: CLASS_SENTENCES.save,
  endForbidden: "Only the teacher or LearnFRC staff can end this class.",
  endVideo: "The class is marked over, but the video didn't close. Try again.",
  removeForbidden: "Only the teacher or LearnFRC staff can remove someone.",
  removeTeacher:
    "The teacher can't be removed from their own class. LearnFRC staff can end the class or pause their teaching instead.",
  removeSelf: "You can't remove yourself. Leave the class instead.",
  removeStaff: "LearnFRC staff can't be removed from a class.",
  removeNobody: "That person isn't in this class.",
  removeVideo: "They're removed from the class, but the video didn't drop them yet. Press Remove again.",
  pauseForbidden: "Only a super admin or the safety lead can pause classes.",
  reasonTooLong: "Keep the reason under 200 characters.",
  mediaNotMember: "Join the class first.",
} as const;

/** Why a join was refused, for the room page (the message is in `error`). */
export type JoinRefusal =
  | "hidden"
  | "not_configured"
  | "paused"
  | "rate"
  | "not_found"
  | "canceled"
  | "closed"
  | "not_ready"
  | "early"
  | "over"
  | "not_enrolled"
  | "removed"
  | "suspended"
  | "blocked"
  | "eligibility"
  | "bio"
  | "username"
  | "notice"
  | "cap"
  | "rtk"
  | "save";

export type JoinFailure = Failure & {
  reason: JoinRefusal;
  /** For "early": when the room opens for this person (ISO). */
  opensAt?: string;
};

export type JoinGrant = {
  /** The RealtimeKit join token. Memory only: never stored, logged or put in a URL. */
  authToken: string;
  role: ClassRole;
  hardEndAt: string;
  title: string;
  /** What everyone sees on the tile: "@maya", "@maya (teacher)". */
  displayName: string;
  username: string;
};

function refuse(reason: JoinRefusal, error: string, extra: { opensAt?: string } = {}): JoinFailure {
  const code: Failure["code"] =
    reason === "rate"
      ? "rate_limited"
      : reason === "not_found"
        ? "not_found"
        : reason === "rtk" || reason === "save" || reason === "not_configured"
          ? "server"
          : reason === "notice" || reason === "bio" || reason === "username"
            ? "validation"
            : reason === "closed" || reason === "canceled" || reason === "over" || reason === "early" || reason === "not_ready"
              ? "conflict"
              : "forbidden";
  const base = fail(code, error, reason === "rate" ? JOIN_LIMITS.perUserWindowSeconds : undefined);
  return { ...base, reason, ...extra };
}

/* ── Shared reads ──────────────────────────────────────────────────── */

type RoomClass = {
  id: string;
  title: string;
  teacher_id: string | null;
  status: ClassStatus;
  starts_at: string;
  duration_minutes: number;
  hard_end_at: string;
  rtk_meeting_id: string | null;
  rtk_app: RtkApp;
  end_reason: ClassEndReason | null;
  ended_at: string | null;
};

const ROOM_CLASS_COLS =
  "id, title, teacher_id, status, starts_at, duration_minutes, hard_end_at, rtk_meeting_id, rtk_app, end_reason, ended_at";

const OPEN_STATUSES: readonly ClassStatus[] = ["scheduled", "live"];

async function loadClass(classId: string): Promise<RoomClass | null> {
  if (!isUuid(classId)) return null;
  const { data } = await createAdminClient().from("classes").select(ROOM_CLASS_COLS).eq("id", classId).maybeSingle();
  return (data as RoomClass | null) ?? null;
}

type Membership = {
  enrollment: "enrolled" | "canceled" | "removed" | null;
  participant: { role: ClassRole; revoked_at: string | null; rtk_participant_id: string | null } | null;
};

async function membership(classId: string, userId: string): Promise<Membership> {
  const admin = createAdminClient();
  const [{ data: enr }, { data: part }] = await Promise.all([
    admin.from("class_enrollments").select("status").eq("class_id", classId).eq("user_id", userId).maybeSingle(),
    admin
      .from("class_participants")
      .select("role, revoked_at, rtk_participant_id")
      .eq("class_id", classId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  return {
    enrollment: (enr?.status as Membership["enrollment"]) ?? null,
    participant: (part as Membership["participant"]) ?? null,
  };
}

/** A super admin or the safety lead: they join as visible staff and skip the pause. */
export async function isClassStaff(user: AppUser): Promise<boolean> {
  try {
    return (await requireClassReviewer(user)).ok;
  } catch (e) {
    console.error("isClassStaff:", e);
    return false;
  }
}

async function usernameOf(userId: string): Promise<string | null> {
  const { data } = await createAdminClient().from("profiles").select("username").eq("id", userId).maybeSingle();
  return ((data?.username as string | null | undefined) ?? "").trim() || null;
}

/** Whether the viewer has a report about someone in this class that's still open. */
async function reportedInClass(userId: string, classId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("user_reports")
    .select("id")
    .eq("reporter_id", userId)
    .eq("content_kind", "class")
    .eq("content_id", classId)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();
  if (error) console.error("reportedInClass:", error.message);
  return !!data;
}

/** HMAC of an IP with CLASSES_AUDIT_SALT (class_consents.ip_hash). Null without an IP. */
export function ipHash(ip: string | null | undefined): string | null {
  const v = (ip ?? "").trim();
  if (!v) return null;
  return createHmac("sha256", auditSalt()).update(v).digest("hex");
}

async function logEvent(classId: string | null, actorId: string | null, kind: string, detail: Record<string, unknown>) {
  const { error } = await createAdminClient()
    .from("class_events")
    .insert({ class_id: classId, actor_id: actorId, kind, detail });
  if (error) console.error(`class_events ${kind}:`, error.message);
}

function safetyRecipients(): string[] {
  return [...new Set([safetyEmail(), ownerEmail()].filter((x): x is string => !!x))];
}

/* ── Who may join, and as what (steps 3 to 6 of section 6.4) ───────── */

type JoinCheck =
  | { ok: true; role: ClassRole; username: string; birthYear: number | null }
  | JoinFailure;

/**
 * Everything about a join that doesn't write anything: the class's state and
 * app, the time window, the caller's place in the class, eligibility, the bio
 * and blocks. The room page runs it to decide what to show before anyone
 * presses Join; joinClass runs it again for real.
 */
async function checkJoin(user: AppUser, cls: RoomClass, staff: boolean, now: Date): Promise<JoinCheck> {
  if (cls.rtk_app !== rtkApp()) return refuse("not_found", ROOM_SENTENCES.notFound);
  if (cls.status === "canceled") return refuse("canceled", ROOM_SENTENCES.canceled);
  if (!OPEN_STATUSES.includes(cls.status)) return refuse("closed", ROOM_SENTENCES.closed);

  const m = await membership(cls.id, user.id);
  let role: ClassRole | null = null;
  if (cls.teacher_id === user.id) role = "teacher";
  else if (m.enrollment === "removed" || m.participant?.revoked_at) return refuse("removed", ROOM_SENTENCES.removed);
  else if (staff) role = "staff";
  else if (m.enrollment === "enrolled") role = "student";
  if (!role) return refuse("not_enrolled", ROOM_SENTENCES.notEnrolled);

  const timing = joinTiming(now, cls.starts_at, cls.hard_end_at, role);
  if (timing === "over") return refuse("over", ROOM_SENTENCES.over);
  if (timing === "early") {
    return refuse("early", role === "student" ? ROOM_SENTENCES.earlyStudent : ROOM_SENTENCES.earlyTeacher, {
      opensAt: earliestJoinFor(new Date(cls.starts_at), role).toISOString(),
    });
  }

  if (role === "staff") {
    const username = await usernameOf(user.id);
    return { ok: true, role, username: username ?? "learnfrc", birthYear: null };
  }

  if (role === "teacher") {
    const teacher = await getTeacher(user.id);
    if (!teacher || teacher.suspended_at) return refuse("suspended", ROOM_SENTENCES.suspended);
  }

  const detail = await classEligibilityDetail(user, { now });
  if (detail.state !== "ready" || !detail.username) {
    return refuse("eligibility", eligibilitySentence(detail.state) || ROOM_SENTENCES.notEnrolled);
  }

  if (role === "student" && cls.teacher_id) {
    if ((await blockedEitherWay(user.id, [cls.teacher_id])).size > 0) return refuse("blocked", ROOM_SENTENCES.blocked);
  }

  // Everyone in the room sees each other's full username, so neither it nor
  // the bio it links to may carry a way to reach someone.
  if (usernameHasContact(detail.username)) {
    return { ...refuse("username", ROOM_SENTENCES.username), field: "username" };
  }
  const { data: prof } = await createAdminClient().from("profiles").select("bio").eq("id", user.id).maybeSingle();
  if (findContactPatterns((prof?.bio as string | null) ?? "").length > 0) {
    return { ...refuse("bio", ROOM_SENTENCES.bio), field: "bio" };
  }

  return { ok: true, role, username: detail.username, birthYear: detail.birthYear };
}

/* ── The monthly cap (section 12) ──────────────────────────────────── */

/**
 * Participant-minutes so far this month (UTC): every join in every class,
 * staff included, since Cloudflare bills every participant minute and the cap
 * is the cost control on that bill. An open row counts up to now or the
 * class's hard end, whichever is first. Read in pages of 1000, because
 * production answers at most 1000 rows a request. The cap (joinClass) and
 * the /admin/classes figure both use this, so they always agree.
 */
export async function participantMinutesSoFar(now: Date = new Date()): Promise<number> {
  const rows = await allRowsById<{
    id: string;
    joined_at: string;
    left_at: string | null;
    classes: { hard_end_at: string } | null;
  }>(createAdminClient(), "class_attendance", "id, joined_at, left_at, classes(hard_end_at)", {
    gte: { joined_at: monthStartUtc(now).toISOString() },
  });
  return participantMinutes(
    rows.map((r) => ({ joinedAt: r.joined_at, leftAt: r.left_at ?? null, closesAt: r.classes?.hard_end_at ?? null })),
    now
  );
}

async function monthlyCap(now: Date): Promise<"ok" | "warn" | "over"> {
  try {
    const settings = await getClassSettings();
    const used = await participantMinutesSoFar(now);
    const state = capState(used, settings.monthly_minute_cap);
    if (state !== "ok") await warnCapOnce(now, used, settings.monthly_minute_cap);
    return state;
  } catch (e) {
    // Fail open, like the rate limits: a read problem never locks a class.
    console.error("monthlyCap:", e);
    return "ok";
  }
}

/** One email a month to the owner once 75% of the cap is used. */
async function warnCapOnce(now: Date, used: number, cap: number) {
  const month = monthKey(now);
  const admin = createAdminClient();
  const { count } = await admin
    .from("class_events")
    .select("id", { count: "exact", head: true })
    .eq("kind", "minute_cap_warning")
    .eq("detail->>month", month);
  if ((count ?? 0) > 0) return;
  await logEvent(null, null, "minute_cap_warning", { month, used, cap });
  const to = ownerEmail();
  if (!to) return;
  mailClass("minute cap warning", null, {
    to,
    subject: `LearnFRC classes: ${Math.round((used / cap) * 100)}% of this month's minutes used`,
    html: classEmailHtml({
      heading: "Live classes are close to this month's minute cap.",
      rows: [
        { label: "Participant-minutes used", value: String(used) },
        { label: "Monthly cap", value: String(cap) },
      ],
      note: "At the cap, joins stop until next month (staff can still join). Change the cap in class_settings if it should be higher.",
    }),
  });
}

/* ── Joining (section 6.4) ─────────────────────────────────────────── */

/**
 * Joins a class: every check in section 6.4, the recording-notice consent
 * row (written before any RealtimeKit call), the monthly cap, then a fresh
 * RealtimeKit participant. A previous participant is deleted first, so one
 * person never has two, and a token someone shared stops working.
 *
 * `ip` and `userAgent` come from the request (the Server Action reads them).
 */
export async function joinClass(
  user: AppUser,
  input: { classId: unknown; noticeVersion: unknown; userAgent?: string | null; ip?: string | null }
): Promise<Success<JoinGrant> | JoinFailure> {
  if (!(await classesVisible())) return refuse("hidden", ROOM_SENTENCES.hidden);
  if (!classesConfigured()) return refuse("not_configured", ROOM_SENTENCES.notConfigured);
  const classId = typeof input.classId === "string" ? input.classId.toLowerCase() : "";
  if (!isUuid(classId)) return refuse("not_found", ROOM_SENTENCES.notFound);

  const staff = await isClassStaff(user);
  if (!staff && (await joinsPaused())) return refuse("paused", ROOM_SENTENCES.paused);

  const [perUser, perIp] = await Promise.all([
    rateLimitKey("class-join", JOIN_LIMITS.perUser, JOIN_LIMITS.perUserWindowSeconds, user.id),
    rateLimit("class-join-ip", JOIN_LIMITS.perIp, JOIN_LIMITS.perIpWindowSeconds),
  ]);
  if (!perUser || !perIp) return refuse("rate", ROOM_SENTENCES.rate);

  const cls = await loadClass(classId);
  if (!cls) return refuse("not_found", ROOM_SENTENCES.notFound);
  const now = new Date();
  const check = await checkJoin(user, cls, staff, now);
  if (!check.ok) return check;
  if (!cls.rtk_meeting_id) return refuse("not_ready", ROOM_SENTENCES.notReady);

  // The notice, then its record, before any token exists.
  const version = typeof input.noticeVersion === "string" ? input.noticeVersion.trim() : "";
  if (!version) return refuse("notice", ROOM_SENTENCES.noticeMissing);
  if (version !== CLASS_NOTICE_VERSION) return refuse("notice", ROOM_SENTENCES.noticeOld);
  const admin = createAdminClient();
  const { error: consentError } = await admin.from("class_consents").insert({
    user_id: user.id,
    user_handle: check.username,
    user_birth_year: check.role === "staff" ? null : check.birthYear,
    class_id: cls.id,
    kind: "recording_notice",
    version: CLASS_NOTICE_VERSION,
    ip_hash: ipHash(input.ip),
    user_agent: (input.userAgent ?? "").slice(0, 300) || null,
  });
  if (consentError) {
    console.error("joinClass consent:", consentError.message);
    return refuse("save", ROOM_SENTENCES.save);
  }

  if (check.role !== "staff" && (await monthlyCap(now)) === "over") return refuse("cap", ROOM_SENTENCES.cap);

  // Rotate: the old participant goes first, so two never exist at once.
  const { data: part } = await admin
    .from("class_participants")
    .select("rtk_participant_id, revoked_at")
    .eq("class_id", cls.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (part?.revoked_at) return refuse("removed", ROOM_SENTENCES.removed);
  const old = (part?.rtk_participant_id as string | null | undefined) ?? null;
  const opts = { app: cls.rtk_app };
  if (old) {
    const del = await deleteParticipant(cls.rtk_meeting_id, old, opts);
    if (!del.ok && del.status !== 404) {
      console.error("joinClass rotate:", del.status, del.error);
      return refuse("rtk", ROOM_SENTENCES.rotate);
    }
  }

  const preset = presetForRole(check.role);
  const displayName = displayNameFor(check.username, check.role);
  const add = await addParticipant(
    cls.rtk_meeting_id,
    {
      name: displayName,
      preset_name: preset.name,
      custom_participant_id: user.id,
      token: {
        not_before: earliestJoinFor(new Date(cls.starts_at), check.role).toISOString(),
        expires_on: new Date(cls.hard_end_at).toISOString(),
      },
    },
    opts
  );
  if (!add.ok || !add.data?.id || !add.data?.token) {
    console.error("joinClass addParticipant:", add.ok ? "no id or token" : `${add.status} ${add.error}`);
    return refuse("rtk", ROOM_SENTENCES.rtk);
  }

  // Save the new participant only if nobody rotated in between (a second
  // tab joining at the same moment). Otherwise drop ours and ask to retry.
  const stamp = now.toISOString();
  let saved = false;
  if (!part) {
    const { error } = await admin.from("class_participants").insert({
      class_id: cls.id,
      user_id: user.id,
      role: check.role,
      rtk_participant_id: add.data.id,
      preset_name: preset.name,
      last_token_at: stamp,
    });
    saved = !error;
    if (error && error.code !== "23505") console.error("joinClass participant:", error.message);
  } else {
    let q = admin
      .from("class_participants")
      .update({ rtk_participant_id: add.data.id, role: check.role, preset_name: preset.name, last_token_at: stamp })
      .eq("class_id", cls.id)
      .eq("user_id", user.id)
      .is("revoked_at", null);
    q = old ? q.eq("rtk_participant_id", old) : q.is("rtk_participant_id", null);
    const { data: rows, error } = await q.select("user_id");
    saved = !error && (rows?.length ?? 0) > 0;
    if (error) console.error("joinClass participant:", error.message);
  }
  if (!saved) {
    await deleteParticipant(cls.rtk_meeting_id, add.data.id, opts);
    return refuse("rtk", ROOM_SENTENCES.rotate);
  }

  return {
    ok: true,
    authToken: add.data.token,
    role: check.role,
    hardEndAt: new Date(cls.hard_end_at).toISOString(),
    title: cls.title,
    displayName,
    username: check.username,
  };
}

/* ── The room page (src/app/classes/[id]/room/page.tsx) ────────────── */

export type RoomView = {
  classId: string;
  title: string;
  teacherUsername: string | null;
  startsAt: string;
  hardEndAt: string;
  durationMinutes: number;
  status: ClassStatus;
  endReason: ClassEndReason | null;
  liveNow: boolean;
  viewerId: string;
  /** What the viewer would join as, when they can. */
  role: ClassRole | null;
  username: string | null;
  /** "You'll show as" on the pre-join screen. */
  displayName: string | null;
  /** Removed from this class for good: the room shows the removed screen. */
  removed: boolean;
  /** Null when the viewer may press Join now; otherwise why not. */
  refusal: { reason: JoinRefusal; message: string; opensAt?: string } | null;
  /**
   * For the report panel: everyone who's been in the class, by username, for
   * someone who was in it (or staff); just the teacher for anyone else.
   */
  roster: ClassRosterEntry[];
  /** The viewer can report from this class (they were in it, or teach it, within 30 days). */
  canReport: boolean;
  /** The viewer already reported someone in this class, and that report is still open. */
  reported: boolean;
  /**
   * Accounts the viewer has blocked: the chat panel leaves their messages
   * out. One way, like blocks everywhere on the site (blocks.ts): it hides
   * them from the person who blocked them, and tells nobody else anything.
   */
  hiddenSenderIds: string[];
};

export type RoomViewResult =
  | { kind: "hidden" }
  | { kind: "signed_out" }
  | { kind: "not_found" }
  | { kind: "ok"; room: RoomView };

/**
 * What the room page shows: the class, the viewer's place in it and, without
 * writing anything, whether Join would be refused (and why). joinClass makes
 * the same checks again when they press it.
 */
export async function getRoomView(user: AppUser | null, classId: string): Promise<RoomViewResult> {
  if (!(await classesVisible())) return { kind: "hidden" };
  if (!isUuid(classId)) return { kind: "not_found" };
  if (!user) return { kind: "signed_out" };
  const cls = await loadClass(classId.toLowerCase());
  if (!cls || cls.rtk_app !== rtkApp()) return { kind: "not_found" };

  const now = new Date();
  const staff = await isClassStaff(user);
  const [check, m, teacherUsername, blocks, reported] = await Promise.all([
    checkJoin(user, cls, staff, now),
    membership(cls.id, user.id),
    cls.teacher_id ? usernameOf(cls.teacher_id) : Promise.resolve(null),
    blockedSetFor(user.id),
    reportedInClass(user.id, cls.id),
  ]);

  let refusal: RoomView["refusal"] = null;
  if (!check.ok) refusal = { reason: check.reason, message: check.error, opensAt: check.opensAt };
  else if (!classesConfigured()) refusal = { reason: "not_configured", message: ROOM_SENTENCES.notConfigured };
  else if (!staff && (await joinsPaused())) refusal = { reason: "paused", message: ROOM_SENTENCES.paused };
  else if (!cls.rtk_meeting_id) refusal = { reason: "not_ready", message: ROOM_SENTENCES.notReady };

  const removed = !check.ok && check.reason === "removed";
  const role: ClassRole | null = check.ok
    ? check.role
    : cls.teacher_id === user.id
      ? "teacher"
      : (m.participant?.role ?? (m.enrollment === "enrolled" ? "student" : staff ? "staff" : null));
  const username = check.ok ? check.username : await usernameOf(user.id);
  const wasIn = !!m.participant || cls.teacher_id === user.id;
  // Everyone who's been in the class for those who were in it too; anyone
  // else only gets the teacher, the one person anyone signed in may report.
  const fullRoster = await classRoster(cls.id);
  const roster = wasIn || staff ? fullRoster : fullRoster.filter((r) => r.role === "teacher");

  return {
    kind: "ok",
    room: {
      classId: cls.id,
      title: cls.title,
      teacherUsername,
      startsAt: new Date(cls.starts_at).toISOString(),
      hardEndAt: new Date(cls.hard_end_at).toISOString(),
      durationMinutes: cls.duration_minutes,
      status: cls.status,
      endReason: cls.end_reason,
      liveNow: isLiveNow(cls, now),
      viewerId: user.id,
      role,
      username,
      displayName: username && role ? displayNameFor(username, role) : null,
      removed,
      refusal,
      roster,
      canReport: (wasIn || staff) && withinReportWindow(cls.hard_end_at, now),
      reported,
      hiddenSenderIds: [...blocks.ids],
    },
  };
}

/**
 * The roster for someone in the room (the report panel refreshes it as
 * people arrive). Only for the class's teacher, staff and anyone who has
 * been a participant, removed people included, so they can still report.
 */
export async function roomRoster(user: AppUser, classId: string): Promise<ClassRosterEntry[]> {
  const cls = await loadClass(typeof classId === "string" ? classId.toLowerCase() : "");
  if (!cls || cls.rtk_app !== rtkApp()) return [];
  if (cls.teacher_id !== user.id) {
    const m = await membership(cls.id, user.id);
    if (!m.participant && !(await isClassStaff(user))) return [];
  }
  return classRoster(cls.id);
}

export type RoomStatus = {
  status: ClassStatus | null;
  endReason: ClassEndReason | null;
  removed: boolean;
  /** As RoomView's: the room page's own copy was read before this browser joined. */
  canReport: boolean;
  /** As RoomView's, so the "ended" screen can say they've reported it. */
  reported: boolean;
};

/** Where a class stands now, for a browser that just left the meeting. */
export async function roomStatus(user: AppUser, classId: string): Promise<RoomStatus> {
  const cls = await loadClass(typeof classId === "string" ? classId.toLowerCase() : "");
  if (!cls || cls.rtk_app !== rtkApp())
    return { status: null, endReason: null, removed: false, canReport: false, reported: false };
  const [m, staff, reported] = await Promise.all([
    membership(cls.id, user.id),
    isClassStaff(user),
    reportedInClass(user.id, cls.id),
  ]);
  const teacher = cls.teacher_id === user.id;
  const removed = !teacher && (m.enrollment === "removed" || !!m.participant?.revoked_at);
  const canReport = (!!m.participant || teacher || staff) && withinReportWindow(cls.hard_end_at, new Date());
  return { status: cls.status, endReason: cls.end_reason, removed, canReport, reported };
}

/* ── Ending (section 6.6) ──────────────────────────────────────────── */

type VideoClose = { ok: boolean; state: "closed" | "none" | "skipped" | "failed"; error?: string };

const gone = (r: RtkResult<unknown>) => r.ok || r.status === 404;

/** kick-all (which also stops the recorder), then the meeting INACTIVE. */
async function closeMeeting(cls: RoomClass): Promise<VideoClose> {
  if (!cls.rtk_meeting_id) return { ok: true, state: "none" };
  if (cls.rtk_app !== rtkApp()) return { ok: false, state: "failed", error: "other_app" };
  if (!classesConfigured()) {
    // Without keys no participant can exist, so there's nothing to close.
    console.warn(`closeMeeting ${cls.id}: RealtimeKit isn't configured; skipped`);
    return { ok: true, state: "skipped" };
  }
  const opts = { app: cls.rtk_app };
  const kicked = await kickAll(cls.rtk_meeting_id, opts);
  const inactive = await setMeetingStatus(cls.rtk_meeting_id, "INACTIVE", opts);
  if (gone(kicked) && inactive.ok) return { ok: true, state: "closed" };
  const error = [kicked, inactive]
    .map((r) => (r.ok ? null : `${r.status} ${r.error}`))
    .filter(Boolean)
    .join("; ");
  console.error(`closeMeeting ${cls.id}:`, error);
  return { ok: false, state: "failed", error: error.slice(0, 300) };
}

/** Whether the latest end of this class failed to close the video. */
async function lastEndFailed(classId: string): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("class_events")
    .select("detail")
    .eq("class_id", classId)
    .eq("kind", "ended")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.detail as { rtk?: string } | undefined)?.rtk === "failed";
}

type EndOutcome = { claimed: boolean; video: VideoClose };

/**
 * The end itself, once the caller is allowed: close the video, then claim
 * the class (status ended, guarded on it still being open, so one caller
 * logs it). A class that's already over is left alone, unless its last end
 * didn't manage to close the video, which is tried again.
 */
async function endNow(cls: RoomClass, reason: ClassEndReason, actorId: string | null): Promise<EndOutcome> {
  if (!OPEN_STATUSES.includes(cls.status)) {
    if (cls.rtk_meeting_id && (await lastEndFailed(cls.id))) {
      const video = await closeMeeting(cls);
      await logEvent(cls.id, actorId, "ended", { reason, rtk: video.state, retry: true, error: video.error ?? null });
      return { claimed: false, video };
    }
    return { claimed: false, video: { ok: true, state: "none" } };
  }
  const video = await closeMeeting(cls);
  const stamp = new Date().toISOString();
  const { data: claimed, error } = await createAdminClient()
    .from("classes")
    .update({ status: "ended", ended_at: stamp, end_reason: reason, updated_at: stamp })
    .eq("id", cls.id)
    .in("status", OPEN_STATUSES as ClassStatus[])
    .select("id");
  if (error) console.error("endClass:", error.message);
  const did = (claimed?.length ?? 0) > 0;
  if (did) await logEvent(cls.id, actorId, "ended", { reason, rtk: video.state, error: video.error ?? null });
  return { claimed: did, video };
}

const TEACHER_REASONS: readonly ClassEndReason[] = ["teacher", "time"];
const END_REASONS: readonly ClassEndReason[] = [
  "teacher",
  "admin",
  "time",
  "empty",
  "teacher_gone",
  "reports",
  "paused",
  "sweep",
];

/**
 * Ends a class for everyone: kick-all, the meeting INACTIVE, status `ended`.
 * Allowed for the teacher, staff, the system (sweep, auto-end), or any
 * participant once now >= hard_end_at. Idempotent: `already` is true when
 * the class was over before this call.
 */
export async function endClass(
  actor: AppUser | SystemActor,
  input: { classId: string; reason: ClassEndReason }
): Promise<Result<{ already: boolean }>> {
  const cls = await loadClass(typeof input.classId === "string" ? input.classId.toLowerCase() : "");
  if (!cls) return fail("not_found", ROOM_SENTENCES.notFound);
  const now = Date.now();
  const pastEnd = now >= Date.parse(cls.hard_end_at);
  let reason: ClassEndReason = END_REASONS.includes(input.reason) ? input.reason : "admin";
  let actorId: string | null = null;

  if (!("system" in actor)) {
    actorId = actor.id;
    const teacher = cls.teacher_id === actor.id;
    const staff = !teacher && (await isClassStaff(actor));
    if (teacher) {
      if (!TEACHER_REASONS.includes(reason)) reason = "teacher";
    } else if (!staff) {
      // Anyone still in the class may close it once its time is up.
      const m = await membership(cls.id, actor.id);
      if (!pastEnd || !m.participant || m.participant.revoked_at) return fail("forbidden", ROOM_SENTENCES.endForbidden);
      reason = "time";
    }
    if (reason === "time" && !pastEnd) reason = teacher ? "teacher" : "admin";
  }

  const out = await endNow(cls, reason, actorId);
  if (!out.video.ok) return fail("server", ROOM_SENTENCES.endVideo);
  return { ok: true, already: !out.claimed };
}

/* ── Removing (section 6.6) ────────────────────────────────────────── */

/**
 * Removes someone from a class for good: their enrollment becomes `removed`
 * (so they can't sign up or join again), their class_participants row is
 * revoked (which also ends their chat at once, by the read policy), and
 * their RealtimeKit participant is deleted (immediate removal and every
 * token revoked). Logged, and the owner gets a one-line email. Their earlier
 * chat messages stay in the class.
 *
 * The class's teacher or staff only; the teacher and staff can't be removed
 * this way. Idempotent: removing someone already removed is fine, and a
 * removal whose video step failed tries the video again.
 */
export async function removeFromClass(
  user: AppUser,
  input: { classId: string; userId: string; reason?: string | null }
): Promise<Result<{ already: boolean }>> {
  const cls = await loadClass(typeof input.classId === "string" ? input.classId.toLowerCase() : "");
  if (!cls) return fail("not_found", ROOM_SENTENCES.notFound);
  const targetId = typeof input.userId === "string" ? input.userId.toLowerCase() : "";
  if (!isUuid(targetId)) return fail("not_found", ROOM_SENTENCES.removeNobody);
  const reason = (typeof input.reason === "string" ? input.reason.trim() : "").slice(0, 300) || null;

  const actorIsTeacher = cls.teacher_id === user.id;
  const actorIsStaff = !actorIsTeacher && (await isClassStaff(user));
  if (!actorIsTeacher && !actorIsStaff) return fail("forbidden", ROOM_SENTENCES.removeForbidden);
  if (targetId === user.id) return fail("validation", ROOM_SENTENCES.removeSelf);
  if (targetId === cls.teacher_id) return fail("validation", ROOM_SENTENCES.removeTeacher);

  const m = await membership(cls.id, targetId);
  if (m.participant?.role === "staff") return fail("forbidden", ROOM_SENTENCES.removeStaff);
  if (!m.participant && !m.enrollment) return fail("not_found", ROOM_SENTENCES.removeNobody);

  const already =
    m.enrollment === "removed" && (!m.participant || (!!m.participant.revoked_at && !m.participant.rtk_participant_id));
  if (already) return { ok: true, already: true };

  const admin = createAdminClient();
  const stamp = new Date().toISOString();
  // The database first: chat stops and a rejoin is refused even if the video call fails.
  const { error: enrErr } = await admin.from("class_enrollments").upsert(
    {
      class_id: cls.id,
      user_id: targetId,
      status: "removed",
      removed_by: user.id,
      removed_reason: reason,
      updated_at: stamp,
    },
    { onConflict: "class_id,user_id" }
  );
  if (enrErr) {
    console.error("removeFromClass enrollment:", enrErr.message);
    return fail("server", ROOM_SENTENCES.save);
  }
  if (m.participant && !m.participant.revoked_at) {
    const { error } = await admin
      .from("class_participants")
      .update({ revoked_at: stamp })
      .eq("class_id", cls.id)
      .eq("user_id", targetId)
      .is("revoked_at", null);
    if (error) {
      console.error("removeFromClass participant:", error.message);
      return fail("server", ROOM_SENTENCES.save);
    }
  }

  // Then the video: delete the participant (every connection drops, every
  // token dies). If that fails, kick every connection by our user id.
  let video: "none" | "deleted" | "kicked" | "skipped" | "failed" = "none";
  const pid = m.participant?.rtk_participant_id ?? null;
  if (pid && cls.rtk_meeting_id) {
    if (cls.rtk_app !== rtkApp()) video = "failed";
    else if (!classesConfigured()) video = "skipped";
    else {
      const opts = { app: cls.rtk_app };
      const del = await deleteParticipant(cls.rtk_meeting_id, pid, opts);
      if (gone(del)) video = "deleted";
      else {
        const kick = await kickParticipants(cls.rtk_meeting_id, { customIds: [targetId] }, opts);
        video = gone(kick) ? "kicked" : "failed";
        if (!gone(kick)) console.error("removeFromClass video:", del.ok ? "" : del.error, kick.ok ? "" : kick.error);
      }
    }
    if (video !== "failed") {
      await admin
        .from("class_participants")
        .update({ rtk_participant_id: null })
        .eq("class_id", cls.id)
        .eq("user_id", targetId)
        .eq("rtk_participant_id", pid);
    }
  }

  const [actorName, targetName] = await Promise.all([usernameOf(user.id), usernameOf(targetId)]);
  await logEvent(cls.id, user.id, "removed_participant", {
    userId: targetId,
    username: targetName,
    role: m.participant?.role ?? "student",
    by: actorIsTeacher ? "teacher" : "staff",
    reason,
    video,
  });

  const owner = ownerEmail();
  if (owner) {
    const who = `@${actorName ?? "someone"}`;
    const whom = `@${targetName ?? "a student"}`;
    mailClass("removed participant", cls.id, {
      to: owner,
      subject: `LearnFRC class: ${who} removed ${whom}`,
      html: classEmailHtml({
        heading: `${who} removed ${whom} from ${cls.title}.`,
        rows: [
          { label: "Class", value: `${cls.title}, ${pacificTime(cls.starts_at)}` },
          { label: "Removed by", value: `${who} (${actorIsTeacher ? "the teacher" : "LearnFRC staff"})` },
          ...(reason ? [{ label: "Reason given", value: reason }] : []),
        ],
        buttons: [{ text: "Open the class", url: adminClassUrl(cls.id) }],
        note: "They can't rejoin this class or read its chat. Their earlier messages stay for the review.",
      }),
    });
  }

  if (video === "failed") return fail("server", ROOM_SENTENCES.removeVideo);
  return { ok: true, already: false };
}

/* ── Pausing (section 6.6) ─────────────────────────────────────────── */

/**
 * Pauses or unpauses every join (class_settings.joins_paused). Pausing also
 * ends every class that's live now in this deployment's app (end_reason
 * `paused`): the emergency stop. A super admin or the safety lead.
 */
export async function setJoinsPaused(
  user: AppUser,
  input: { paused: boolean; reason?: string | null }
): Promise<Result<{ ended: number }>> {
  if (!(await isClassStaff(user))) return fail("forbidden", ROOM_SENTENCES.pauseForbidden);
  if (typeof input.paused !== "boolean") return fail("validation", "That request wasn't in the format we expected.");
  const reason = (typeof input.reason === "string" ? input.reason.trim() : "") || null;
  if (reason && reason.length > 200) return { ...fail("validation", ROOM_SENTENCES.reasonTooLong), field: "reason" };

  const admin = createAdminClient();
  const stamp = new Date().toISOString();
  const { error } = await admin
    .from("class_settings")
    .update({
      joins_paused: input.paused,
      paused_reason: input.paused ? (reason ?? "paused by staff") : null,
      updated_at: stamp,
      updated_by: user.id,
    })
    .eq("id", true);
  if (error) {
    console.error("setJoinsPaused:", error.message);
    return fail("server", ROOM_SENTENCES.save);
  }
  await logEvent(null, user.id, input.paused ? "paused" : "unpaused", { reason });

  let ended = 0;
  if (input.paused) {
    const { data } = await admin
      .from("classes")
      .select(ROOM_CLASS_COLS)
      .in("status", OPEN_STATUSES as ClassStatus[])
      .eq("rtk_app", rtkApp())
      .gt("hard_end_at", stamp);
    const now = new Date();
    for (const cls of (data ?? []) as RoomClass[]) {
      if (!isLiveNow(cls, now)) continue;
      const out = await endNow(cls, "paused", user.id);
      if (out.claimed) ended++;
    }
  }

  const to = safetyRecipients();
  if (to.length) {
    const who = `@${(await usernameOf(user.id)) ?? "staff"}`;
    mailClass(input.paused ? "classes paused" : "classes unpaused", null, {
      to,
      subject: input.paused ? `LearnFRC classes paused by ${who}` : `LearnFRC classes unpaused by ${who}`,
      html: classEmailHtml({
        heading: input.paused ? `${who} paused every live class.` : `${who} opened joins again.`,
        rows: [
          ...(reason ? [{ label: "Reason", value: reason }] : []),
          ...(input.paused ? [{ label: "Live classes ended", value: String(ended) }] : []),
        ],
      }),
    });
  }
  return { ok: true, ended };
}

/* ── The auto-end on two reports (section 6.6) ─────────────────────── */

/**
 * Called by fileReport when a second different person in the class reports
 * its teacher while it's live: ends the class (end_reason `reports`), holds
 * the evidence about the teacher, suspends them (which cancels their upcoming
 * classes and emails those students), and sends the urgent email to the
 * safety lead and the owner. Students see "This class was ended for a safety
 * check." Runs once per class: a later report finds it already over.
 */
export async function endClassForReports(
  classId: string,
  input: { teacherId: string; reporters: number }
): Promise<{ ended: boolean }> {
  const cls = await loadClass(classId);
  if (!cls || cls.teacher_id !== input.teacherId || !isLiveNow(cls)) return { ended: false };
  const out = await endNow(cls, "reports", null);
  if (!out.claimed) return { ended: false };

  await logEvent(cls.id, null, "auto_ended", {
    reason: "reports",
    teacherId: input.teacherId,
    reporters: input.reporters,
    rtk: out.video.state,
  });
  try {
    await holdClass(cls.id, {
      reason: "auto_end",
      subjectUserId: input.teacherId,
      createdBy: null,
      notes: "Ended automatically after two people in the class reported the teacher.",
    });
  } catch (e) {
    console.error("endClassForReports hold:", e);
  }
  try {
    const s = await suspendTeacher(SYSTEM_ACTOR, {
      userId: input.teacherId,
      reason: "Two people in a live class reported the teacher. The class was ended for a safety check.",
    });
    if (!s.ok) console.error("endClassForReports suspend:", s.error);
  } catch (e) {
    console.error("endClassForReports suspend:", e);
  }

  const to = safetyRecipients();
  if (to.length) {
    const teacher = await usernameOf(input.teacherId);
    const date = pacificTime(cls.starts_at);
    mailClass("auto-end on reports", cls.id, {
      to,
      subject: `[Check now] LearnFRC safety: class on ${date} ended after two reports`,
      html: classEmailHtml({
        heading: "A live class was ended for a safety check.",
        intro: `Two different people in the class reported the teacher while it was live, so LearnFRC ended it, held the evidence and paused the teacher's classes.`,
        rows: [
          { label: "Class", value: `${cls.title}, ${date}` },
          { label: "Teacher", value: teacher ? `@${teacher}` : "a deleted account" },
          { label: "Reports", value: String(input.reporters) },
          { label: "Video", value: out.video.ok ? "closed" : "didn't close, check the room" },
        ],
        buttons: [
          { text: "Open the class", url: `${adminClassUrl(cls.id)}#recording` },
          { text: "The playbook", url: playbookUrl(), tone: "plain" },
        ],
        note: "The reports are on the reports desk. Nobody is told who reported. A reviewer can lift the suspension if the reports don't hold up.",
      }),
    });
  }
  return { ended: true };
}

/* ── The media log (section 6.5) ───────────────────────────────────── */

/**
 * Stores the camera and screen-share changes one browser saw. The poster has
 * to be in the class (a participant who hasn't been removed); every subject
 * has to be someone who has been in it. Rate limited per account.
 */
export async function logMediaEvents(
  user: AppUser,
  input: { classId: string; body: unknown }
): Promise<Result<{ stored: number; dropped: number }>> {
  if (!(await classesVisible())) return fail("forbidden", ROOM_SENTENCES.hidden);
  const cls = await loadClass(typeof input.classId === "string" ? input.classId.toLowerCase() : "");
  if (!cls || cls.rtk_app !== rtkApp()) return fail("not_found", ROOM_SENTENCES.notFound);
  if (!(await rateLimitKey("class-media", MEDIA_LOG_LIMITS.postsPerMinute, 60, user.id)))
    return fail("rate_limited", ROOM_SENTENCES.rate, 60);

  const admin = createAdminClient();
  const { data: parts } = await admin
    .from("class_participants")
    .select("user_id, revoked_at")
    .eq("class_id", cls.id);
  const members = new Map((parts ?? []).map((p) => [p.user_id as string, (p.revoked_at as string | null) ?? null]));
  if (!members.has(user.id) || members.get(user.id)) return fail("forbidden", ROOM_SENTENCES.mediaNotMember);

  const parsed = parseMediaBatch(input.body, {
    now: new Date(),
    from: earliestJoinFor(new Date(cls.starts_at), "teacher"),
    until: new Date(Date.parse(cls.hard_end_at) + 5 * 60_000),
  });
  if (!parsed) return fail("validation", "That request wasn't in the format we expected.");
  const rows = parsed.events
    .filter((e) => members.has(e.subject))
    .map((e) => ({
      class_id: cls.id,
      subject_user_id: e.subject,
      kind: e.kind,
      is_on: e.on,
      at: e.at,
      reported_by: user.id,
    }));
  const dropped = parsed.dropped + (parsed.events.length - rows.length);
  if (rows.length === 0) return { ok: true, stored: 0, dropped };
  const { error } = await admin.from("class_media_events").insert(rows);
  if (error) {
    console.error("logMediaEvents:", error.message);
    return fail("server", ROOM_SENTENCES.save);
  }
  return { ok: true, stored: rows.length, dropped };
}
