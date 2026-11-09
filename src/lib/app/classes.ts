import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimitKey } from "@/lib/rate-limit";
import { blockedSetFor } from "@/lib/app/blocks";
import { isUuid } from "@/lib/app/http";
import { fail, type AppUser, type Result } from "@/lib/app/result";
import {
  CLASS_LIMITS,
  SITE_URL,
  TEACHER_LABEL,
  UNDER_13_COOKIE,
  UNDER_13_COOKIE_VALUE,
  classUrl,
  classesVisible,
  rtkApp,
  scheduledEndFor,
} from "@/lib/classes/config";
import { ageBandOn, ageOn } from "@/lib/classes/age";
import { CLASS_SENTENCES } from "@/lib/classes/sentences";
import { findContactPatterns, usernameHasContact } from "@/lib/classes/contact-patterns";
import { deleteParticipant } from "@/lib/classes/realtimekit";
import { holdAccount } from "@/lib/classes/holds";
import { cancelTeacherClasses } from "@/lib/app/classes-teaching";
import type {
  AccountDeletionReason,
  AgeBand,
  ClassDetail,
  ClassListing,
  ClassParentConsentRow,
  ClassRole,
  ClassRosterEntry,
  ClassStatus,
  ClassTopic,
  Eligibility,
  EnrollmentStatus,
  RtkApp,
} from "@/lib/classes/types";

/**
 * Live classes: the shared rules every door uses (the website's pages and
 * actions, and the app's GET /api/app/classes). Eligibility, the listings,
 * one class's page, enrolling and leaving, the roster, and what happens to a
 * person's classes when their account is deleted.
 *
 * Every read and write is service role, scoped by the id auth.getUser()
 * verified. Nothing here is visible while classesVisible() is false
 * (section 1): listings come back empty and actions refuse.
 *
 * Signed-out viewers never see a handle (teacher is null, the label says
 * "Taught by an FRC student"). Signed-in viewers see the teacher's username,
 * and never a class taught by someone they blocked or who blocked them.
 */

/* ── Sentences ─────────────────────────────────────────────────────── */

/**
 * What each refusal says, on the site and in the app. Defined in a leaf
 * module (src/lib/classes/sentences.ts) so modules in an import cycle with
 * this file can build their own tables from it at load time.
 */
export { CLASS_SENTENCES };

/** The refusal for an eligibility state that can't enroll. */
export function eligibilitySentence(state: Eligibility): string {
  switch (state) {
    case "hidden":
      return CLASS_SENTENCES.hidden;
    case "signed_out":
      return CLASS_SENTENCES.signedOut;
    case "needs_handle":
      return CLASS_SENTENCES.needsHandle;
    case "device_blocked":
      return CLASS_SENTENCES.deviceBlocked;
    case "needs_age":
      return CLASS_SENTENCES.needsAge;
    case "adult":
      return CLASS_SENTENCES.adult;
    case "needs_parent":
      return CLASS_SENTENCES.needsParent;
    case "waiting_parent":
      return CLASS_SENTENCES.waitingParent;
    case "parent_declined":
      return CLASS_SENTENCES.parentDeclined;
    case "ready":
      return "";
  }
}

/* ── Eligibility (section 4) ───────────────────────────────────────── */

export type EligibilityDetail = {
  state: Eligibility;
  username: string | null;
  /** Conservative age (src/lib/classes/age.ts), null without an age answer. */
  age: number | null;
  ageBand: AgeBand | null;
  birthYear: number | null;
  /** The latest parent OK request, if any. */
  consent: Pick<
    ClassParentConsentRow,
    "id" | "status" | "sent_at" | "expires_at" | "decided_at" | "same_network"
  > | null;
};

/** Whether this device carries the under-13 cookie. False outside a request. */
async function deviceBlockedCookie(): Promise<boolean> {
  try {
    return (await cookies()).get(UNDER_13_COOKIE)?.value === UNDER_13_COOKIE_VALUE;
  } catch {
    return false;
  }
}

/**
 * Where someone stands with classes, with the facts behind it. Staff (super
 * admins and the safety lead) don't go through this: they join as staff,
 * never as a teacher or student.
 *
 * `opts.deviceBlocked` overrides the cookie (the app has no cookie; tests).
 */
export async function classEligibilityDetail(
  user: AppUser | null,
  opts: { deviceBlocked?: boolean; now?: Date } = {}
): Promise<EligibilityDetail> {
  const empty = { username: null, age: null, ageBand: null, birthYear: null, consent: null };
  if (!(await classesVisible())) return { state: "hidden", ...empty };
  if (!user) return { state: "signed_out", ...empty };
  const now = opts.now ?? new Date();
  const admin = createAdminClient();

  const [{ data: profile }, { data: ageRow }, { data: consents }] = await Promise.all([
    admin.from("profiles").select("username").eq("id", user.id).maybeSingle(),
    admin.from("class_age_checks").select("birth_year, birth_month").eq("user_id", user.id).maybeSingle(),
    admin
      .from("class_parent_consents")
      .select("id, status, sent_at, expires_at, decided_at, same_network")
      .eq("student_id", user.id)
      .order("sent_at", { ascending: false })
      .limit(20),
  ]);

  const username = (profile?.username as string | null | undefined)?.trim() || null;
  if (!username) return { state: "needs_handle", ...empty };

  if (!ageRow) {
    const blocked = opts.deviceBlocked ?? (await deviceBlockedCookie());
    return { state: blocked ? "device_blocked" : "needs_age", ...empty, username };
  }

  const birthYear = ageRow.birth_year as number;
  const age = ageOn(now, birthYear, ageRow.birth_month as number);
  // 18+ from the first day of the 18th birth month, so nobody who may
  // already be an adult is in a class of 13 year olds (age.ts).
  const band = ageBandOn(now, birthYear, ageRow.birth_month as number);
  const facts = { username, age, ageBand: band, birthYear };
  // An under-13 answer deletes the account, so this row shouldn't exist.
  // If it ever does, classes stay closed.
  if (band === "under13") return { state: "device_blocked", ...facts, consent: null };
  if (band === "18+") return { state: "adult", ...facts, consent: null };

  const rows = (consents ?? []) as EligibilityDetail["consent"][];
  const agreed = rows.find((r) => r?.status === "agreed");
  const latest = rows[0] ?? null;
  if (agreed) return { state: "ready", ...facts, consent: agreed };
  if (!latest) return { state: "needs_parent", ...facts, consent: null };
  if (latest.status === "sent" && Date.parse(latest.expires_at) > now.getTime())
    return { state: "waiting_parent", ...facts, consent: latest };
  if (latest.status === "declined" || latest.status === "revoked")
    return { state: "parent_declined", ...facts, consent: latest };
  return { state: "needs_parent", ...facts, consent: latest };
}

/** Where someone stands with classes (section 4's table). */
export async function classEligibility(
  user: AppUser | null,
  opts: { deviceBlocked?: boolean; now?: Date } = {}
): Promise<Eligibility> {
  return (await classEligibilityDetail(user, opts)).state;
}

/* ── Blocks, both ways ─────────────────────────────────────────────── */

/**
 * The ids among `others` that the viewer blocked, or that blocked the viewer.
 * A class taught by any of them is hidden from the viewer and can't be
 * joined. blocks.ts answers one direction (what the viewer hides); classes
 * need both, so neither side ends up in a room with the other.
 */
export async function blockedEitherWay(viewerId: string, others: string[]): Promise<Set<string>> {
  const ids = [...new Set(others.filter((id) => id && id !== viewerId))];
  if (ids.length === 0) return new Set();
  const out = new Set<string>();
  const mine = await blockedSetFor(viewerId);
  for (const id of ids) if (mine.ids.has(id)) out.add(id);
  try {
    const { data } = await createAdminClient()
      .from("user_blocks")
      .select("blocker_id")
      .eq("blocked_id", viewerId)
      .in("blocker_id", ids);
    for (const r of data ?? []) out.add(r.blocker_id as string);
  } catch {
    // A read error leaves out who blocked the viewer; the viewer's own blocks
    // still apply, as they do everywhere else on the site (blocks.ts fails open).
  }
  return out;
}

/* ── Listings (/classes, the homepage, the app) ────────────────────── */

type ClassListRow = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  duration_minutes: number;
  hard_end_at: string;
  capacity: number;
  status: ClassStatus;
  teacher_id: string | null;
  rtk_app: RtkApp;
  lesson: {
    id: string;
    title: string;
    slug: string;
    modules: { slug: string; departments: { slug: string } | null } | null;
  } | null;
  module: { id: string; title: string; slug: string; departments: { slug: string } | null } | null;
};

const LIST_SELECT =
  "id, title, description, starts_at, duration_minutes, hard_end_at, capacity, status, teacher_id, rtk_app, " +
  "lesson:lessons!classes_lesson_id_fkey(id, title, slug, modules(slug, departments(slug))), " +
  "module:modules!classes_module_id_fkey(id, title, slug, departments(slug))";

function topicOf(row: ClassListRow): ClassTopic | null {
  const l = row.lesson;
  if (l?.modules?.departments) {
    return {
      kind: "lesson",
      id: l.id,
      title: l.title,
      url: `${SITE_URL}/guides/${l.modules.departments.slug}/${l.modules.slug}/${l.slug}`,
    };
  }
  const m = row.module;
  if (m?.departments) {
    return { kind: "module", id: m.id, title: m.title, url: `${SITE_URL}/guides/${m.departments.slug}/${m.slug}` };
  }
  return null;
}

async function seatsTaken(classIds: string[]): Promise<Map<string, number>> {
  const taken = new Map<string, number>();
  if (classIds.length === 0) return taken;
  const { data } = await createAdminClient()
    .from("class_enrollments")
    .select("class_id")
    .in("class_id", classIds)
    .eq("status", "enrolled");
  for (const r of data ?? []) taken.set(r.class_id as string, (taken.get(r.class_id as string) ?? 0) + 1);
  return taken;
}

async function usernamesFor(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return out;
  const { data } = await createAdminClient().from("profiles").select("id, username").in("id", unique);
  for (const p of data ?? []) if (p.username) out.set(p.id as string, p.username as string);
  return out;
}

function toListing(
  row: ClassListRow,
  taken: number,
  teacherUsername: string | null,
  enrolled: boolean | null
): ClassListing {
  const capacity = row.capacity;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: scheduledEndFor(new Date(row.starts_at), row.duration_minutes).toISOString(),
    durationMinutes: row.duration_minutes,
    status: row.status === "live" ? "live" : "scheduled",
    teacher: teacherUsername ? { username: teacherUsername } : null,
    teacherLabel: TEACHER_LABEL,
    topic: topicOf(row),
    seats: { capacity, taken, left: Math.max(0, capacity - taken) },
    url: classUrl(row.id),
    enrolled,
  };
}

/**
 * Upcoming and live classes, soonest first. Only this deployment's app's
 * classes (dev test classes never reach production pages). With a viewer:
 * the teacher's username, the viewer's enrollment, and no class taught by
 * someone blocked either way.
 */
export async function listUpcomingClasses(
  opts: { viewer?: AppUser | null; limit?: number; now?: Date } = {}
): Promise<{ visible: boolean; classes: ClassListing[]; liveNow: number }> {
  if (!(await classesVisible())) return { visible: false, classes: [], liveNow: 0 };
  const now = opts.now ?? new Date();
  const limit = Math.min(Math.max(opts.limit ?? 60, 1), 200);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("classes")
    .select(LIST_SELECT)
    .in("status", ["scheduled", "live"])
    .eq("rtk_app", rtkApp())
    .gt("hard_end_at", now.toISOString())
    .not("teacher_id", "is", null)
    .order("starts_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("listUpcomingClasses:", error.message);
    return { visible: true, classes: [], liveNow: 0 };
  }
  let rows = (data ?? []) as unknown as ClassListRow[];
  const viewer = opts.viewer ?? null;

  if (viewer) {
    const blocked = await blockedEitherWay(
      viewer.id,
      rows.map((r) => r.teacher_id as string)
    );
    rows = rows.filter((r) => !blocked.has(r.teacher_id as string));
  }

  const ids = rows.map((r) => r.id);
  const [taken, names, mine] = await Promise.all([
    seatsTaken(ids),
    viewer ? usernamesFor(rows.map((r) => r.teacher_id as string)) : Promise.resolve(new Map<string, string>()),
    viewer && ids.length
      ? admin
          .from("class_enrollments")
          .select("class_id")
          .eq("user_id", viewer.id)
          .eq("status", "enrolled")
          .in("class_id", ids)
          .then(({ data: e }) => new Set((e ?? []).map((x) => x.class_id as string)))
      : Promise.resolve(new Set<string>()),
  ]);

  const classes = rows.map((r) =>
    toListing(
      r,
      taken.get(r.id) ?? 0,
      viewer ? (names.get(r.teacher_id as string) ?? null) : null,
      viewer ? mine.has(r.id) : null
    )
  );
  return { visible: true, classes, liveNow: classes.filter((c) => c.status === "live").length };
}

/* ── One class (/classes/[id]) ─────────────────────────────────────── */

/**
 * One class's page, or null when it doesn't exist, isn't this deployment's
 * app's, or classes are hidden. Past and canceled classes come back too
 * (classStatus says which); the page decides what to show.
 */
export async function getClassDetail(
  classId: string,
  viewer: AppUser | null = null,
  opts: { now?: Date } = {}
): Promise<ClassDetail | null> {
  if (!isUuid(classId)) return null;
  if (!(await classesVisible())) return null;
  const now = opts.now ?? new Date();
  const admin = createAdminClient();
  const { data } = await admin.from("classes").select(LIST_SELECT).eq("id", classId).maybeSingle();
  const row = data as unknown as ClassListRow | null;
  if (!row || row.rtk_app !== rtkApp()) return null;

  let viewerRole: ClassRole | null = null;
  let enrollment: EnrollmentStatus | null = null;
  let wasParticipant = false;
  let blockedEither = false;
  let teacherName: string | null = null;

  const taken = (await seatsTaken([row.id])).get(row.id) ?? 0;
  if (viewer) {
    const [names, enr, part, blocked] = await Promise.all([
      usernamesFor(row.teacher_id ? [row.teacher_id] : []),
      admin
        .from("class_enrollments")
        .select("status")
        .eq("class_id", row.id)
        .eq("user_id", viewer.id)
        .maybeSingle(),
      admin
        .from("class_participants")
        .select("role, revoked_at")
        .eq("class_id", row.id)
        .eq("user_id", viewer.id)
        .maybeSingle(),
      row.teacher_id ? blockedEitherWay(viewer.id, [row.teacher_id]) : Promise.resolve(new Set<string>()),
    ]);
    teacherName = row.teacher_id ? (names.get(row.teacher_id) ?? null) : null;
    enrollment = (enr.data?.status as EnrollmentStatus | undefined) ?? null;
    wasParticipant = !!part.data;
    blockedEither = blocked.size > 0;
    viewerRole =
      row.teacher_id === viewer.id
        ? "teacher"
        : ((part.data?.role as ClassRole | undefined) ?? (enrollment === "enrolled" ? "student" : null));
  }

  const reportUntil = Date.parse(row.hard_end_at) + CLASS_LIMITS.reportWindowDays * 86_400_000;
  const listing = toListing(row, taken, teacherName, viewer ? enrollment === "enrolled" : null);
  return {
    ...listing,
    hardEndAt: new Date(row.hard_end_at).toISOString(),
    rtkApp: row.rtk_app,
    classStatus: row.status,
    viewerRole,
    enrollment,
    wasParticipant,
    blockedEitherWay: blockedEither,
    canReportFromClass: !!viewer && (wasParticipant || viewerRole === "teacher") && now.getTime() <= reportUntil,
  };
}

/* ── Enroll and leave ──────────────────────────────────────────────── */

/**
 * Enrolls a student (section 4): eligible (`ready`, or `waiting_parent`,
 * since joining waits for the parent OK anyway), not the teacher, no block
 * either way, a username and bio free of contact details, and a seat taken
 * safely by class_enroll (which locks the class row and closes 10 minutes
 * after start).
 */
export async function enrollInClass(
  user: AppUser,
  input: { classId: string }
): Promise<Result<{ status: "enrolled" | "already" }>> {
  if (!(await classesVisible())) return fail("forbidden", CLASS_SENTENCES.hidden);
  if (!isUuid(input.classId)) return fail("not_found", CLASS_SENTENCES.notFound);
  if (!(await rateLimitKey("class-enroll", 30, 3600, user.id)))
    return fail("rate_limited", CLASS_SENTENCES.rate, 3600);

  const state = await classEligibility(user);
  if (state !== "ready" && state !== "waiting_parent") {
    return fail(state === "signed_out" ? "unauthorized" : "forbidden", eligibilitySentence(state));
  }

  const admin = createAdminClient();
  const { data: cls } = await admin
    .from("classes")
    .select("id, teacher_id, status, rtk_app")
    .eq("id", input.classId)
    .maybeSingle();
  if (!cls || cls.rtk_app !== rtkApp()) return fail("not_found", CLASS_SENTENCES.notFound);
  if (cls.status !== "scheduled" && cls.status !== "live") return fail("conflict", CLASS_SENTENCES.closed);
  if (cls.teacher_id === user.id) return fail("conflict", CLASS_SENTENCES.ownClass);
  if (!cls.teacher_id) return fail("conflict", CLASS_SENTENCES.closed);
  if ((await blockedEitherWay(user.id, [cls.teacher_id as string])).size > 0)
    return fail("forbidden", CLASS_SENTENCES.blocked);

  const { data: profile } = await admin.from("profiles").select("username, bio").eq("id", user.id).maybeSingle();
  // Everyone in a class sees each other's full username, so it can't be a
  // standing contact detail ("snapchat_maya", "maya2025550143").
  if (usernameHasContact(profile?.username as string | null | undefined)) {
    return { ...fail("validation", CLASS_SENTENCES.username), field: "username" };
  }
  if (findContactPatterns((profile?.bio as string | null) ?? "").length > 0) {
    return { ...fail("validation", CLASS_SENTENCES.bio), field: "bio" };
  }

  const { data: outcome, error } = await admin.rpc("class_enroll", {
    p_class_id: input.classId,
    p_user_id: user.id,
  });
  if (error) {
    console.error("enrollInClass:", error.message);
    return fail("server", CLASS_SENTENCES.save);
  }
  switch (outcome as string) {
    case "ok":
      return { ok: true, status: "enrolled" };
    case "already":
      return { ok: true, status: "already" };
    case "full":
      return fail("conflict", CLASS_SENTENCES.full);
    case "removed":
      return fail("forbidden", CLASS_SENTENCES.removed);
    case "closed":
      return fail("conflict", CLASS_SENTENCES.closed);
    default:
      return fail("not_found", CLASS_SENTENCES.notFound);
  }
}

/**
 * Gives up a seat. Idempotent; a removal stays a removal. Someone who had
 * already joined loses the room as well: their RealtimeKit participant is
 * deleted (every token they hold stops working), and the chat refuses them
 * (sendClassChat and the read policy only count enrolled students). They can
 * sign up and join again while the class is open. A participant the video
 * service couldn't delete goes to class_rtk_cleanup for the sweep.
 */
export async function leaveClass(user: AppUser, input: { classId: string }): Promise<Result> {
  if (!isUuid(input.classId)) return fail("not_found", CLASS_SENTENCES.notFound);
  const admin = createAdminClient();
  const { error } = await admin
    .from("class_enrollments")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("class_id", input.classId)
    .eq("user_id", user.id)
    .eq("status", "enrolled");
  if (error) {
    console.error("leaveClass:", error.message);
    return fail("server", CLASS_SENTENCES.save);
  }

  // The room: a student who joined and then left the class keeps no token.
  try {
    const { data: part } = await admin
      .from("class_participants")
      .select("role, rtk_participant_id, classes(rtk_meeting_id, rtk_app, teacher_id)")
      .eq("class_id", input.classId)
      .eq("user_id", user.id)
      .maybeSingle();
    const cls = (part as unknown as { classes: { rtk_meeting_id: string | null; rtk_app: RtkApp; teacher_id: string | null } | null } | null)
      ?.classes;
    const pid = (part?.rtk_participant_id as string | null | undefined) ?? null;
    if (part && part.role === "student" && pid && cls?.rtk_meeting_id && cls.teacher_id !== user.id) {
      const res =
        cls.rtk_app === rtkApp()
          ? await deleteParticipant(cls.rtk_meeting_id, pid, { app: cls.rtk_app })
          : ({ ok: false, status: 0, error: "other_app" } as const);
      if (res.ok || res.status === 404) {
        await admin
          .from("class_participants")
          .update({ rtk_participant_id: null })
          .eq("class_id", input.classId)
          .eq("user_id", user.id)
          .eq("rtk_participant_id", pid);
      } else {
        await admin.from("class_rtk_cleanup").upsert(
          { rtk_app: cls.rtk_app, meeting_id: cls.rtk_meeting_id, participant_id: pid, last_error: res.error.slice(0, 300) },
          { onConflict: "meeting_id,participant_id" }
        );
      }
    }
  } catch (e) {
    console.error("leaveClass: participant:", e);
  }
  return { ok: true };
}

/* ── The roster (report panel, class controls) ─────────────────────── */

/**
 * Everyone who has been in the class (class_participants, including people
 * who left or were removed), plus the teacher even before they join, with
 * their current usernames. Server-side only: the panel gets it as a prop.
 */
export async function classRoster(classId: string): Promise<ClassRosterEntry[]> {
  if (!isUuid(classId)) return [];
  const admin = createAdminClient();
  const [{ data: cls }, { data: parts }] = await Promise.all([
    admin.from("classes").select("teacher_id").eq("id", classId).maybeSingle(),
    admin.from("class_participants").select("user_id, role, revoked_at, first_joined_at").eq("class_id", classId),
  ]);
  const rows = (parts ?? []).map((p) => ({
    userId: p.user_id as string,
    role: p.role as ClassRole,
    revoked: !!p.revoked_at,
  }));
  const teacherId = cls?.teacher_id as string | null | undefined;
  if (teacherId && !rows.some((r) => r.userId === teacherId)) {
    rows.unshift({ userId: teacherId, role: "teacher", revoked: false });
  }
  const names = await usernamesFor(rows.map((r) => r.userId));
  const order: Record<ClassRole, number> = { teacher: 0, staff: 1, student: 2 };
  return rows
    .map((r) => ({ ...r, username: names.get(r.userId) ?? null }))
    .sort((a, b) => order[a.role] - order[b.role] || (a.username ?? "").localeCompare(b.username ?? ""));
}

/* ── Account deletion (section 3.11) ───────────────────────────────── */

/**
 * Runs before deleteAccountData deletes anything (src/lib/app/profile.ts):
 *
 * 1. Holds first, when the reason is a ban, or the account is the subject of
 *    an open class report, was in a class with an urgent review in the last
 *    365 days, or already has a hold: the email, handle, peer reports,
 *    transcripts and chat (blocked messages included) are kept.
 * 2. Cancels the person's upcoming classes as a teacher (emailing students).
 * 3. Deletes every RealtimeKit participant the person has. A failure, or a
 *    participant in the other app's meeting, goes to class_rtk_cleanup for
 *    the sweep to retry.
 * 4. Stamps account_deleted_at on their consent records, which then lose
 *    their user id (on delete set null) but keep the handle snapshot.
 *
 * Each step is on its own: one failing doesn't stop the next, and nothing
 * here throws, so a classes problem can never block someone deleting their
 * own account.
 */
export async function beforeAccountDeleted(uid: string, reason: AccountDeletionReason): Promise<void> {
  const admin = createAdminClient();
  const stamp = new Date().toISOString();

  // 1. Holds.
  try {
    let openCase = reason === "ban";
    if (!openCase) {
      const yearAgo = new Date(Date.now() - 365 * 86_400_000).toISOString();
      const [reports, holds, classesIn] = await Promise.all([
        admin
          .from("user_reports")
          .select("id", { count: "exact", head: true })
          .eq("reported_user_id", uid)
          .eq("content_kind", "class")
          .eq("status", "open"),
        admin.from("class_safety_holds").select("id", { count: "exact", head: true }).eq("subject_user_id", uid),
        admin.from("class_participants").select("class_id").eq("user_id", uid),
      ]);
      openCase = (reports.count ?? 0) > 0 || (holds.count ?? 0) > 0;
      const classIds = (classesIn.data ?? []).map((r) => r.class_id as string);
      if (!openCase && classIds.length) {
        const { count } = await admin
          .from("class_reviews")
          .select("class_id", { count: "exact", head: true })
          .in("class_id", classIds)
          .eq("verdict", "urgent")
          .gte("created_at", yearAgo);
        openCase = (count ?? 0) > 0;
      }
    }
    if (openCase) {
      await holdAccount(uid, { reason: reason === "ban" ? "ban" : "self_delete_open_case" });
    }
  } catch (e) {
    console.error("beforeAccountDeleted: holds:", e);
  }

  // 2. Upcoming classes as a teacher.
  try {
    const { count } = await admin
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", uid)
      .in("status", ["scheduled", "live"]);
    if ((count ?? 0) > 0) await cancelTeacherClasses(uid, "The teacher's account was deleted.");
  } catch (e) {
    console.error("beforeAccountDeleted: cancel classes:", e);
  }

  // 3. RealtimeKit participants.
  try {
    const { data: parts } = await admin
      .from("class_participants")
      .select("class_id, rtk_participant_id, classes(rtk_meeting_id, rtk_app)")
      .eq("user_id", uid)
      .not("rtk_participant_id", "is", null);
    const here = rtkApp();
    for (const p of parts ?? []) {
      const cls = (p as unknown as { classes: { rtk_meeting_id: string | null; rtk_app: RtkApp } | null }).classes;
      const pid = p.rtk_participant_id as string;
      if (!cls?.rtk_meeting_id) continue;
      const res =
        cls.rtk_app === here
          ? await deleteParticipant(cls.rtk_meeting_id, pid, { app: cls.rtk_app })
          : ({ ok: false, status: 0, error: "other_app" } as const);
      if (!res.ok) {
        await admin.from("class_rtk_cleanup").upsert(
          {
            rtk_app: cls.rtk_app,
            meeting_id: cls.rtk_meeting_id,
            participant_id: pid,
            last_error: res.error.slice(0, 300),
          },
          { onConflict: "meeting_id,participant_id" }
        );
      }
    }
  } catch (e) {
    console.error("beforeAccountDeleted: participants:", e);
  }

  // 4. Consent records outlive the account.
  try {
    await Promise.all([
      admin.from("class_consents").update({ account_deleted_at: stamp }).eq("user_id", uid),
      admin.from("class_parent_consents").update({ account_deleted_at: stamp }).eq("student_id", uid),
    ]);
  } catch (e) {
    console.error("beforeAccountDeleted: consents:", e);
  }
}
