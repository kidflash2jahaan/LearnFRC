// The room-and-chat package's checks against production with throwaway
// accounts (classes-design.md 15.2, room-and-chat acceptance):
//   - every joinClass refusal gives its message, and the recording-notice
//     consent row (with its IP hash) is written before any RealtimeKit call;
//   - sendClassChat stores shown and blocked rows for teacher, student and
//     staff alike, returns the note, rate-limits, and refuses non-members and
//     removed participants, who also stop receiving rows over Realtime;
//   - class reports from the room, the removed screen and the class page
//     reach the reports desk as "Live class" with the new reasons and the
//     username; reporting a student needs shared participation; two reporters
//     against a live class's teacher end it, call suspendTeacher and
//     holdClass (stubs until integration) and send the urgent email to the
//     outbox; existing profile reports still work; a ban passes reason "ban";
//   - the media log, remove, end and the pause switch.
//
// No Cloudflare keys are needed: RealtimeKit's REST API is replaced by an
// in-process mock (fetch to api.cloudflare.com never leaves the machine), so
// the join rotation, remove, kick-all and INACTIVE calls are checked by what
// they send. The real calls are "needs keys" for integration.
//
// Since integration it runs against the real neighbours: who's class staff
// (class-reviewers, safety-holds), getTeacher and suspendTeacher (teachers),
// cancelTeacherClasses (pages) and holdClass and holdAccount (safety-holds).
// Their effects are checked in the database: the hold rows, the teacher's
// suspension and the classes it cancels. After each suspension the check
// puts the teacher and their other test classes back, so later steps can
// use them.
//
//   node --import ./scripts/classes/register.mjs scripts/classes/checks/room-and-chat.check.ts

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnv } from "../env.mjs";
import { create, cleanup, check, readCredentials } from "../test-data.mjs";

loadEnv();
process.env.CLASSES_DEV_SWITCHES = "1";
delete process.env.VERCEL_ENV;
// A pretend RealtimeKit app, so classesConfigured() is true. Every call to it
// is answered by the mock below; none reaches Cloudflare.
const FAKE_RTK = {
  CLOUDFLARE_ACCOUNT_ID: "lftest-account",
  CLOUDFLARE_REALTIMEKIT_APP_ID_DEV: "lftest-app",
  CLOUDFLARE_REALTIMEKIT_API_TOKEN: "lftest-token",
};
Object.assign(process.env, FAKE_RTK);

const PKG = "room-and-chat";
const results: { name: string; ok: boolean; error?: string }[] = [];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const openClients: SupabaseClient[] = [];

/* ── Holds and the teacher's suspension, as stored ─────────────────── */

async function holdReasons(classId: string, subjectUserId?: string): Promise<string[]> {
  let q = admin.from("class_safety_holds").select("reason").eq("class_id", classId);
  if (subjectUserId) q = q.eq("subject_user_id", subjectUserId);
  const { data } = await q;
  return ((data ?? []) as { reason: string }[]).map((h) => h.reason);
}

async function suspendedAt(userId: string): Promise<string | null> {
  const { data } = await admin.from("class_teachers").select("suspended_at").eq("user_id", userId).single();
  return (data?.suspended_at as string | null) ?? null;
}

/**
 * A suspension cancels the teacher's other upcoming classes (the real
 * cancelTeacherClasses). After checking that, put the teacher and those test
 * classes back so later steps can use them. Returns what it restored.
 */
async function restoreTeacher(userId: string, classIds: string[]): Promise<string[]> {
  await admin.from("class_teachers").update({ suspended_at: null, suspended_reason: null }).eq("user_id", userId);
  const { data } = await admin
    .from("classes")
    .update({ status: "scheduled", canceled_at: null, canceled_by: null, cancel_reason: null })
    .in("id", classIds)
    .eq("status", "canceled")
    .select("id");
  return ((data ?? []) as { id: string }[]).map((c) => c.id);
}

/* ── A fake RealtimeKit ────────────────────────────────────────────── */

type RtkCall = { method: string; path: string; body: Record<string, unknown> | undefined; consentFirst?: boolean };
const rtkCalls: RtkCall[] = [];
let participantSeq = 0;
let failNextDelete = false;
const realFetch = globalThis.fetch;
const RTK_BASE = /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/[^/]+\/realtime\/kit\/[^/]+/;

function rtkJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!href.startsWith("https://api.cloudflare.com/")) return realFetch(input, init);
  const method = (init?.method ?? "GET").toUpperCase();
  const path = href.replace(RTK_BASE, "");
  const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
  const call: RtkCall = { method, path, body };
  // When a participant is added, its notice record must already exist.
  const addMatch = /^\/meetings\/lftest-meeting-([0-9a-f-]{36})\/participants$/.exec(path);
  if (method === "POST" && addMatch && body?.custom_participant_id) {
    const { count } = await admin
      .from("class_consents")
      .select("id", { count: "exact", head: true })
      .eq("class_id", addMatch[1])
      .eq("user_id", body.custom_participant_id as string)
      .eq("kind", "recording_notice");
    call.consentFirst = (count ?? 0) > 0;
  }
  rtkCalls.push(call);
  if (method === "POST" && addMatch) {
    participantSeq++;
    return rtkJson({
      success: true,
      data: {
        id: `lftest-participant-${participantSeq}`,
        token: `lftest-join-token-${participantSeq}`,
        custom_participant_id: body?.custom_participant_id,
        preset_name: body?.preset_name,
        name: body?.name,
      },
    });
  }
  if (method === "DELETE" && failNextDelete) {
    failNextDelete = false;
    return rtkJson({ success: false, errors: [{ message: "mock failure" }] }, 500);
  }
  if (method === "DELETE") return rtkJson({ success: true, data: {} });
  if (method === "POST" && /\/active-session\/kick(-all)?$/.test(path)) return rtkJson({ success: true, data: {} });
  if (method === "PATCH" && /^\/meetings\/[^/]+$/.test(path)) return rtkJson({ success: true, data: { status: body?.status } });
  return rtkJson({ success: false, errors: [{ message: "not mocked" }] }, 404);
}) as typeof fetch;

/* ── A request scope for after() and revalidatePath ────────────────── */

// Next's server runtime puts AsyncLocalStorage on globalThis before any of
// its modules load; plain Node doesn't, so do it here.
(globalThis as unknown as { AsyncLocalStorage: unknown }).AsyncLocalStorage = (
  await import("node:async_hooks")
).AsyncLocalStorage;
const { workAsyncStorage } = (await import(
  "next/dist/server/app-render/work-async-storage.external.js"
)) as unknown as { workAsyncStorage: { run<T>(store: unknown, fn: () => T): T } };

async function inRequest<T>(fn: () => Promise<T>): Promise<T> {
  const pending: Promise<unknown>[] = [];
  const store = {
    afterContext: {
      after(task: unknown) {
        pending.push(Promise.resolve().then(() => (typeof task === "function" ? (task as () => unknown)() : task)));
      },
    },
    incrementalCache: {},
    route: "/lftest",
    page: "/lftest/page",
    pendingRevalidatedTags: [],
  };
  const out = await workAsyncStorage.run(store, fn);
  // Let after() work (the emails) finish, including any it starts itself.
  for (let i = 0; i < 5 && pending.length; i++) {
    const batch = pending.splice(0);
    await workAsyncStorage.run(store, () => Promise.allSettled(batch));
  }
  return out;
}

async function step(name: string, fn: () => Promise<void>) {
  try {
    await inRequest(fn);
    results.push({ name, ok: true });
    console.log(`ok   ${name}`);
  } catch (e) {
    results.push({ name, ok: false, error: (e as Error).message });
    console.log(`FAIL ${name}: ${(e as Error).message}`);
  }
}

/* ── The outbox ────────────────────────────────────────────────────── */

type Mail = { to: string[]; subject: string; html: string; sentAt: string };
function outbox(since: number): Mail[] {
  const dir = process.env.EMAIL_DEV_OUTBOX!;
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Mail)
    .filter((m) => Date.parse(m.sentAt) >= since);
}

/* ── Fixtures ──────────────────────────────────────────────────────── */

type Account = { id: string; email: string; password: string; username: string | null };

async function newClass(
  slug: string,
  teacherId: string,
  opts: { startsInMin: number; duration?: number; status?: string; meeting?: boolean }
) {
  const starts = new Date(Date.now() + opts.startsInMin * 60_000);
  const duration = opts.duration ?? 30;
  const { data, error } = await admin
    .from("classes")
    .insert({
      teacher_id: teacherId,
      title: `lftest room-and-chat ${slug}`,
      starts_at: starts.toISOString(),
      duration_minutes: duration,
      hard_end_at: new Date(starts.getTime() + (duration + 15) * 60_000).toISOString(),
      capacity: 15,
      status: opts.status ?? "scheduled",
      rtk_app: "dev",
    })
    .select("id")
    .single();
  if (error) throw new Error(`class ${slug}: ${error.message}`);
  const id = data.id as string;
  if (opts.meeting !== false) await admin.from("classes").update({ rtk_meeting_id: `lftest-meeting-${id}` }).eq("id", id);
  return id;
}

async function enroll(classId: string, userId: string) {
  const { data, error } = await admin.rpc("class_enroll", { p_class_id: classId, p_user_id: userId });
  if (error || (data !== "ok" && data !== "already")) throw new Error(`enroll: ${error?.message ?? data}`);
}

async function signIn(a: Account): Promise<SupabaseClient> {
  const c = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email: a.email, password: a.password });
  if (error) throw new Error(`sign in ${a.username}: ${error.message}`);
  openClients.push(c);
  return c;
}

async function setSettings(patch: Record<string, unknown>) {
  const { error } = await admin.from("class_settings").update(patch).eq("id", true);
  if (error) throw new Error(`class_settings: ${error.message}`);
}

const SETTINGS_DEFAULTS = {
  classes_visible: false,
  joins_paused: true,
  paused_reason: "not launched yet",
  updated_by: null,
};

/* ── The checks ────────────────────────────────────────────────────── */

async function main() {
  await cleanup(PKG); // a clean start if an earlier run stopped halfway
  await create(PKG, [
    "t1:age=16:parent=agreed:teacher",
    "t2:age=17:parent=agreed:teacher",
    "s1:age=14:parent=agreed",
    "s2:age=15:parent=agreed",
    "s3:age=16:parent=agreed",
    "s4:age=15:parent=agreed",
    "bio:age=15:parent=agreed:bio=add%20me%20on%20snap%20jake22",
    "waitp:age=15:parent=sent",
    "notenr:age=15:parent=agreed",
    "rate:age=15:parent=agreed",
    "out:age=15:parent=agreed",
    "staff:superadmin",
  ]);
  const acc = readCredentials(PKG).accounts as Record<string, Account>;
  const user = (k: string) => ({ id: acc[k].id, email: acc[k].email, created_at: new Date().toISOString() });
  const handle = (k: string) => acc[k].username as string;
  await admin.from("class_teachers").update({ suspended_at: new Date().toISOString(), suspended_reason: "lftest" }).eq("user_id", acc.t2.id);

  const room = await import("../../../src/lib/app/classes-room.ts");
  const chat = await import("../../../src/lib/app/class-chat.ts");
  const reports = await import("../../../src/lib/app/reports.ts");
  const desk = await import("../../../src/lib/app/admin-reports.ts");
  const media = await import("../../../src/lib/classes/media.ts");
  const filter = await import("../../../src/lib/classes/chat-filter.ts");
  const notice = await import("../../../src/lib/classes/notice.ts");

  const nowId = await newClass("now", acc.t1.id, { startsInMin: 5 });
  const laterId = await newClass("later", acc.t1.id, { startsInMin: 180 });
  const pastId = await newClass("past", acc.t1.id, { startsInMin: -120 });
  const endedId = await newClass("ended", acc.t1.id, { startsInMin: -20, status: "ended" });
  const noMeetingId = await newClass("nomeeting", acc.t1.id, { startsInMin: 5, meeting: false });
  const endId = await newClass("teacher-ends", acc.t1.id, { startsInMin: 5 });
  const suspendedId = await newClass("suspended", acc.t2.id, { startsInMin: 5 });
  for (const k of ["s1", "s2", "s3", "s4", "bio", "waitp", "rate"]) await enroll(nowId, acc[k].id);
  for (const k of ["s1", "rate"]) await enroll(laterId, acc[k].id);
  await enroll(endId, acc.s1.id);
  // The past class can't be enrolled in any more (it started over 10 minutes ago).
  await admin.from("class_enrollments").insert({ class_id: pastId, user_id: acc.s1.id, status: "enrolled" });

  // The join limit (6 per 10 minutes) would stop these checks themselves, so
  // each join starts from an empty bucket, except in the check of the limit.
  const resetJoinLimit = async (k: string) => {
    await admin.from("rate_limit_hits").delete().eq("bucket", `class-join:k:${acc[k].id}`);
  };
  const join = async (k: string, classId: string, version: string = notice.CLASS_NOTICE_VERSION, reset = true) => {
    if (reset) await resetJoinLimit(k);
    return room.joinClass(user(k), { classId, noticeVersion: version, userAgent: "lftest-agent", ip: "203.0.113.7" });
  };
  const expectRefusal = async (k: string, classId: string, reason: string, message: string, version?: string) => {
    const before = rtkCalls.length;
    const r = await join(k, classId, version);
    assert.equal(r.ok, false, `${k} should be refused (${reason})`);
    if (r.ok) return;
    assert.equal(r.reason, reason, `${k}: ${r.error}`);
    assert.equal(r.error, message);
    assert.equal(rtkCalls.length, before, "a refusal makes no RealtimeKit call");
  };
  const S = room.ROOM_SENTENCES;

  /* joinClass refusals */

  await step("join: hidden when classes aren't visible", async () => {
    process.env.CLASSES_DEV_SWITCHES = "0";
    try {
      await expectRefusal("s1", nowId, "hidden", S.hidden);
    } finally {
      process.env.CLASSES_DEV_SWITCHES = "1";
    }
  });

  await step("join: not configured without RealtimeKit keys", async () => {
    for (const k of Object.keys(FAKE_RTK)) delete process.env[k];
    try {
      await expectRefusal("s1", nowId, "not_configured", S.notConfigured);
    } finally {
      Object.assign(process.env, FAKE_RTK);
    }
  });

  await step("join: each refusal gives its message, before any RealtimeKit call", async () => {
    await expectRefusal("s1", "6b1f0e57-5d7c-4a3b-9c55-000000000000", "not_found", S.notFound);
    await expectRefusal("s1", laterId, "early", S.earlyStudent);
    await expectRefusal("t1", laterId, "early", S.earlyTeacher);
    await expectRefusal("s1", pastId, "over", S.over);
    await expectRefusal("s1", endedId, "closed", S.closed);
    await expectRefusal("notenr", nowId, "not_enrolled", S.notEnrolled);
    await expectRefusal("waitp", nowId, "eligibility", "Waiting for your parent or guardian. Resend in 24 hours.");
    await expectRefusal("bio", nowId, "bio", S.bio);
    await expectRefusal("t2", suspendedId, "suspended", S.suspended);
    await expectRefusal("s1", nowId, "notice", S.noticeMissing, "");
    await expectRefusal("s1", nowId, "notice", S.noticeOld, "2025-01-01");
    await expectRefusal("staff", noMeetingId, "not_ready", S.notReady);
    const early = await join("s1", laterId);
    assert.ok(!early.ok && early.opensAt, "early carries opensAt");
  });

  await step("join: over the per-user limit (6 in 10 minutes)", async () => {
    await resetJoinLimit("rate");
    const outcomes: string[] = [];
    for (let i = 0; i < 7; i++) {
      const r = await join("rate", laterId, undefined, false);
      outcomes.push(r.ok ? "ok" : r.reason);
    }
    assert.deepEqual(outcomes, ["early", "early", "early", "early", "early", "early", "rate"]);
    const r = await join("rate", laterId, undefined, false);
    assert.equal(!r.ok && r.error, S.rate);
  });

  /* joins that work, against the mock */

  await step("join: the consent row (with the IP hash) is written before the participant", async () => {
    const before = rtkCalls.length;
    const r = await join("s1", nowId);
    assert.ok(r.ok, r.ok ? "" : r.error);
    const calls = rtkCalls.slice(before);
    assert.equal(calls.length, 1, JSON.stringify(calls));
    const add = calls[0];
    assert.equal(add.method, "POST");
    assert.equal(add.consentFirst, true, "consent existed when the participant was added");
    assert.equal(add.body?.name, `@${handle("s1")}`, "the full username, never shortened");
    assert.equal(add.body?.preset_name, "lfrc-student");
    assert.equal(add.body?.custom_participant_id, acc.s1.id);
    const token = add.body?.token as { not_before: string; expires_on: string };
    const { data: cls } = await admin.from("classes").select("starts_at, hard_end_at").eq("id", nowId).single();
    assert.equal(token.expires_on, new Date(cls!.hard_end_at).toISOString());
    assert.equal(token.not_before, new Date(Date.parse(cls!.starts_at) - 15 * 60_000).toISOString());
    assert.equal(r.authToken, `lftest-join-token-${participantSeq}`);
    assert.equal(r.displayName, `@${handle("s1")}`);
    assert.equal(r.role, "student");

    const { data: consent } = await admin
      .from("class_consents")
      .select("user_handle, user_birth_year, kind, version, ip_hash, user_agent")
      .eq("class_id", nowId)
      .eq("user_id", acc.s1.id)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .single();
    assert.equal(consent!.kind, "recording_notice");
    assert.equal(consent!.version, notice.CLASS_NOTICE_VERSION);
    assert.equal(consent!.user_handle, handle("s1"));
    assert.ok(consent!.user_birth_year, "birth year snapshot");
    const expected = createHmac("sha256", process.env.CLASSES_AUDIT_SALT!).update("203.0.113.7").digest("hex");
    assert.equal(consent!.ip_hash, expected);
    assert.equal(consent!.user_agent, "lftest-agent");
    const { data: part } = await admin
      .from("class_participants")
      .select("role, rtk_participant_id, preset_name")
      .eq("class_id", nowId)
      .eq("user_id", acc.s1.id)
      .single();
    assert.deepEqual(part, { role: "student", rtk_participant_id: `lftest-participant-${participantSeq}`, preset_name: "lfrc-student" });
  });

  await step("join: a second join deletes the old participant first, then adds a new one", async () => {
    const { data: before } = await admin
      .from("class_participants")
      .select("rtk_participant_id")
      .eq("class_id", nowId)
      .eq("user_id", acc.s1.id)
      .single();
    const n = rtkCalls.length;
    const r = await join("s1", nowId);
    assert.ok(r.ok);
    const calls = rtkCalls.slice(n).map((c) => `${c.method} ${c.path}`);
    assert.deepEqual(calls, [
      `DELETE /meetings/lftest-meeting-${nowId}/participants/${before!.rtk_participant_id}`,
      `POST /meetings/lftest-meeting-${nowId}/participants`,
    ]);
    const { data: after } = await admin
      .from("class_participants")
      .select("rtk_participant_id")
      .eq("class_id", nowId)
      .eq("user_id", acc.s1.id)
      .single();
    assert.equal(after!.rtk_participant_id, `lftest-participant-${participantSeq}`);
    // If the old one can't be deleted, nobody gets a second participant.
    failNextDelete = true;
    const m = rtkCalls.length;
    const refused = await join("s1", nowId);
    assert.equal(refused.ok, false);
    assert.equal(rtkCalls.length - m, 1, "no participant added after a failed delete");
  });

  await step("join: the teacher and staff get their presets and labels", async () => {
    const t = await join("t1", nowId);
    assert.ok(t.ok, t.ok ? "" : t.error);
    assert.equal(t.displayName, `@${handle("t1")} (teacher)`);
    const tAdd = rtkCalls[rtkCalls.length - 1];
    assert.equal(tAdd.body?.preset_name, "lfrc-teacher");
    const { data: cls } = await admin.from("classes").select("starts_at").eq("id", nowId).single();
    assert.equal(
      (tAdd.body?.token as { not_before: string }).not_before,
      new Date(Date.parse(cls!.starts_at) - 30 * 60_000).toISOString()
    );
    const st = await join("staff", nowId);
    assert.ok(st.ok, st.ok ? "" : st.error);
    assert.equal(st.role, "staff");
    assert.match(st.displayName, /\(LearnFRC staff\)$/);
    assert.equal(rtkCalls[rtkCalls.length - 1].body?.preset_name, "lfrc-staff");
    for (const k of ["s2", "s3", "s4"]) {
      const r = await join(k, nowId);
      assert.ok(r.ok, `${k}: ${r.ok ? "" : r.error}`);
    }
  });

  await step("room view: what the page shows, without writing anything", async () => {
    const consentsBefore = await admin.from("class_consents").select("id", { count: "exact", head: true }).eq("class_id", nowId);
    const v = await room.getRoomView(user("s1"), nowId);
    assert.equal(v.kind, "ok");
    if (v.kind !== "ok") return;
    assert.equal(v.room.role, "student");
    assert.equal(v.room.refusal, null);
    assert.equal(v.room.displayName, `@${handle("s1")}`);
    assert.equal(v.room.teacherUsername, handle("t1"));
    assert.ok(v.room.roster.some((r) => r.username === handle("t1") && r.role === "teacher"));
    const other = await room.getRoomView(user("notenr"), nowId);
    assert.ok(other.kind === "ok" && other.room.refusal?.reason === "not_enrolled");
    assert.deepEqual(
      other.room.roster.map((r) => r.role),
      ["teacher"],
      "someone who wasn't in the class only gets the teacher to report"
    );
    assert.deepEqual(await room.getRoomView(null, nowId), { kind: "signed_out" });
    assert.deepEqual(await room.getRoomView(user("s1"), "not-a-class"), { kind: "not_found" });
    const consentsAfter = await admin.from("class_consents").select("id", { count: "exact", head: true }).eq("class_id", nowId);
    assert.equal(consentsAfter.count, consentsBefore.count, "the room view writes nothing");
  });

  /* chat */

  const send = (k: string, text: string, classId = nowId) => chat.sendClassChat(user(k), { classId, text });

  await step("chat: shown and blocked rows for teacher, student and staff alike", async () => {
    const cases: [string, string, "shown" | "blocked", string[]][] = [
      ["s1", "What CAN ID should the front left module use?", "shown", []],
      ["s1", "add me on snap jake22", "blocked", ["contact_app", "contact_phrase"]],
      ["s2", "my email is jake22 at gmail dot com", "blocked", ["email"]],
      ["t1", "Here's the guide: https://docs.wpilib.org/en/stable/docs/software/can-devices/index.html", "shown", []],
      ["t1", "join my discord for the slides", "blocked", ["contact_app"]],
      ["t1", "slides are at https://example.com/slides", "blocked", ["link"]],
      ["staff", "Hi everyone, LearnFRC staff here for a few minutes.", "shown", []],
      ["staff", "follow @frcnews for updates", "blocked", ["handle"]],
      ["s3", `@${handle("s2")} good question`, "shown", []],
      ["s2", "Is the analog input on port 0 or 1?", "shown", []],
      // Stored reversed so the source holds no profanity.
      ["s2", `that was ${"tihs".split("").reverse().join("")}`, "blocked", ["profanity"]],
    ];
    for (const [k, text, status, kinds] of cases) {
      const r = await send(k, text);
      assert.ok(r.ok, `${k} "${text}": ${r.ok ? "" : r.error}`);
      assert.equal(r.status, status, `${k} "${text}"`);
      if (r.status === "blocked") {
        const onlyProfanity = kinds.length === 1 && kinds[0] === "profanity";
        assert.equal(r.note, onlyProfanity ? filter.CHAT_PROFANITY_NOTE : filter.CHAT_BLOCKED_NOTE);
        for (const kind of kinds) assert.ok(r.kinds.includes(kind as never), `${text}: ${r.kinds.join(",")}`);
      } else {
        assert.equal(r.message.body, text);
        assert.equal(r.message.senderUsername, handle(k));
      }
      const { data: row } = await admin
        .from("class_chat_messages")
        .select("status, blocked_kinds, sender_role, sender_username")
        .eq("class_id", nowId)
        .eq("sender_id", acc[k].id)
        .eq("body", text)
        .single();
      assert.equal(row!.status, status);
      assert.equal(row!.sender_username, handle(k), "the full username is stored");
      assert.equal(row!.sender_role, k === "t1" ? "teacher" : k === "staff" ? "staff" : "student");
      if (status === "shown") assert.deepEqual(row!.blocked_kinds, []);
      else for (const kind of kinds) assert.ok(row!.blocked_kinds.includes(kind), `stored kinds ${row!.blocked_kinds}`);
    }
  });

  await step("chat: length, non-members and the rate limit", async () => {
    const empty = await send("s1", "   ");
    assert.ok(!empty.ok && empty.error === chat.CHAT_SENTENCES.empty);
    const long = await send("s1", "x".repeat(301));
    assert.ok(!long.ok && long.error === chat.CHAT_SENTENCES.tooLong);
    const outsider = await send("out", "hello");
    assert.ok(!outsider.ok && outsider.error === chat.CHAT_SENTENCES.notMember);
    const outcomes: string[] = [];
    for (let i = 0; i < 21; i++) {
      const r = await send("s4", `message number ${i + 1}`);
      outcomes.push(r.ok ? r.status : r.code);
    }
    assert.equal(outcomes.filter((o) => o === "shown").length, 20, outcomes.join(","));
    assert.equal(outcomes[20], "rate_limited");
  });

  await step("chat: a removed participant can't send and stops receiving rows", async () => {
    const c = await signIn(acc.s3);
    const got: string[] = [];
    let status = "";
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 8000);
      c.channel("room-and-chat-s3")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "class_chat_messages", filter: `class_id=eq.${nowId}` },
          (payload) => got.push((payload.new as { body: string }).body)
        )
        .subscribe((s) => {
          status = s;
          if (s === "SUBSCRIBED") {
            clearTimeout(timer);
            resolve();
          }
        });
    });
    assert.equal(status, "SUBSCRIBED");
    await sleep(1500);
    assert.ok((await send("t1", "before the removal")).ok);
    for (let i = 0; i < 40 && !got.includes("before the removal"); i++) await sleep(250);
    assert.ok(got.includes("before the removal"), `s3 got ${JSON.stringify(got)}`);

    const removed = await room.removeFromClass(user("t1"), { classId: nowId, userId: acc.s3.id, reason: "lftest" });
    assert.ok(removed.ok, removed.ok ? "" : removed.error);
    assert.ok((await send("t1", "after the removal")).ok);
    await sleep(4000);
    assert.ok(!got.includes("after the removal"), "a removed participant stops receiving rows");
    const polled = await c.from("class_chat_messages").select("body").eq("class_id", nowId);
    assert.deepEqual(polled.data ?? [], [], "and the polling read returns nothing");
    await c.removeAllChannels();
    const r = await send("s3", "can I still talk?");
    assert.ok(!r.ok && r.error === chat.CHAT_SENTENCES.removed);
  });

  /* remove */

  await step("remove: deletes the participant, revokes the row, emails the owner; once only", async () => {
    const since = Date.now();
    const { data: part } = await admin
      .from("class_participants")
      .select("rtk_participant_id")
      .eq("class_id", nowId)
      .eq("user_id", acc.s4.id)
      .single();
    const n = rtkCalls.length;
    const r = await room.removeFromClass(user("t1"), { classId: nowId, userId: acc.s4.id, reason: "lftest" });
    assert.ok(r.ok && !r.already, r.ok ? "" : r.error);
    assert.deepEqual(
      rtkCalls.slice(n).map((c) => `${c.method} ${c.path}`),
      [`DELETE /meetings/lftest-meeting-${nowId}/participants/${part!.rtk_participant_id}`]
    );
    const { data: after } = await admin
      .from("class_participants")
      .select("revoked_at, rtk_participant_id")
      .eq("class_id", nowId)
      .eq("user_id", acc.s4.id)
      .single();
    assert.ok(after!.revoked_at);
    assert.equal(after!.rtk_participant_id, null);
    const { data: enr } = await admin
      .from("class_enrollments")
      .select("status, removed_by")
      .eq("class_id", nowId)
      .eq("user_id", acc.s4.id)
      .single();
    assert.deepEqual(enr, { status: "removed", removed_by: acc.t1.id });
    const { count } = await admin
      .from("class_events")
      .select("id", { count: "exact", head: true })
      .eq("class_id", nowId)
      .eq("kind", "removed_participant");
    assert.ok((count ?? 0) >= 2);
    const mail = outbox(since).find((m) => m.subject.includes(`removed @${handle("s4")}`));
    assert.ok(mail, "the owner's one-line email");
    assert.deepEqual(mail!.to, [process.env.ADMIN_EMAILS]);
    const again = await room.removeFromClass(user("t1"), { classId: nowId, userId: acc.s4.id });
    assert.ok(again.ok && again.already);
    await expectRefusal("s4", nowId, "removed", S.removed);
    const v = await room.getRoomView(user("s4"), nowId);
    assert.ok(v.kind === "ok" && v.room.removed && v.room.roster.length > 0, "the removed screen gets the roster to report");
  });

  await step("remove: only the teacher or staff, and never the teacher or staff", async () => {
    const byStudent = await room.removeFromClass(user("s1"), { classId: nowId, userId: acc.s2.id });
    assert.ok(!byStudent.ok && byStudent.error === S.removeForbidden);
    const teacher = await room.removeFromClass(user("staff"), { classId: nowId, userId: acc.t1.id });
    assert.ok(!teacher.ok && teacher.error === S.removeTeacher);
    const staff = await room.removeFromClass(user("t1"), { classId: nowId, userId: acc.staff.id });
    assert.ok(!staff.ok && staff.error === S.removeStaff);
    const nobody = await room.removeFromClass(user("t1"), { classId: nowId, userId: acc.out.id });
    assert.ok(!nobody.ok && nobody.error === S.removeNobody);
  });

  /* media log */

  await step("media log: members post, subjects must be in the class, minutes add up", async () => {
    const t0 = Date.now() - 4 * 60_000;
    const at = (min: number) => new Date(t0 + min * 60_000).toISOString();
    const r = await room.logMediaEvents(user("s1"), {
      classId: nowId,
      body: {
        events: [
          { subject: acc.t1.id, kind: "camera", on: true, at: at(0) },
          { subject: acc.t1.id, kind: "camera", on: false, at: at(2) },
          { subject: acc.out.id, kind: "camera", on: true, at: at(1) }, // never in the class
          { subject: acc.t1.id, kind: "screenshare", on: true, at: at(1) },
        ],
      },
    });
    assert.ok(r.ok, r.ok ? "" : r.error);
    assert.equal(r.stored, 3);
    assert.equal(r.dropped, 1);
    const r2 = await room.logMediaEvents(user("s2"), {
      classId: nowId,
      body: { events: [{ subject: acc.t1.id, kind: "camera", on: true, at: at(0.5) }, { subject: acc.t1.id, kind: "camera", on: false, at: at(3) }] },
    });
    assert.ok(r2.ok);
    const outsider = await room.logMediaEvents(user("out"), { classId: nowId, body: { events: [] } });
    assert.ok(!outsider.ok && outsider.code === "forbidden");
    const removed = await room.logMediaEvents(user("s4"), { classId: nowId, body: { events: [] } });
    assert.ok(!removed.ok && removed.code === "forbidden", "a removed participant can't post");
    const bad = await room.logMediaEvents(user("s1"), { classId: nowId, body: { nope: true } });
    assert.ok(!bad.ok && bad.code === "validation");

    const { data: rows } = await admin
      .from("class_media_events")
      .select("subject_user_id, kind, is_on, at, reported_by")
      .eq("class_id", nowId);
    assert.ok(rows!.every((x) => x.reported_by === acc.s1.id || x.reported_by === acc.s2.id));
    const minutes = media.mediaMinutes(rows!, { until: at(4) });
    assert.equal(minutes.cameraMinutes[acc.t1.id], 3, "two reporters, unioned: 0 to 3 minutes");
    assert.equal(minutes.screenshareMinutes[acc.t1.id], 3, "still on at the end: 1 to 4 minutes");
  });

  /* reports */

  const fileClassReport = (k: string, about: string, reason: string, classId = nowId, surface = "class") =>
    reports.fileReport(user(k), {
      contentKind: "class",
      contentId: classId,
      username: about,
      reason,
      details: "",
      surface,
      platform: "web",
    });

  await step("reports: a class report reaches the desk with the class, the new reason and the username", async () => {
    const since = Date.now();
    const r = await fileClassReport("s1", handle("t1"), "private_contact");
    assert.ok(r.ok && !r.alreadyReported, r.ok ? "" : r.error);
    const { data: row } = await admin
      .from("user_reports")
      .select("content_kind, content_id, reported_user_id, reported_username, reason, surface, content_snapshot")
      .eq("id", r.reportId!)
      .single();
    assert.equal(row!.content_kind, "class");
    assert.equal(row!.content_id, nowId);
    assert.equal(row!.reported_user_id, acc.t1.id);
    assert.equal(row!.reported_username, handle("t1"));
    assert.equal(row!.reason, "private_contact");
    assert.equal(row!.surface, "class");
    const snap = row!.content_snapshot as Record<string, unknown>;
    assert.equal(snap.classId, nowId);
    assert.equal(snap.role, "teacher");
    assert.equal(snap.liveNow, true);
    assert.equal(snap.classTitle, "lftest room-and-chat now");

    const { data: cls } = await admin.from("classes").select("keep_evidence").eq("id", nowId).single();
    assert.equal(cls!.keep_evidence, true);
    const { count } = await admin
      .from("class_events")
      .select("id", { count: "exact", head: true })
      .eq("class_id", nowId)
      .eq("kind", "reported");
    assert.equal(count, 1);
    assert.deepEqual(await holdReasons(nowId, acc.t1.id), ["class_report"], "a class_report hold about the teacher");
    const mail = outbox(since).find((m) => m.subject.startsWith("LIVE CLASS:"));
    assert.ok(mail, "LIVE CLASS email in the outbox");
    assert.deepEqual([...mail!.to].sort(), [process.env.ADMIN_EMAILS!, process.env.CLASSES_SAFETY_EMAIL!].sort());
    assert.ok(mail!.html.includes(`/admin/classes/${nowId}`), "the button opens the class's review page");
    assert.ok(mail!.html.includes("Asked me to talk privately or meet up"));

    const d = await desk.loadReportsDesk(user("staff"));
    assert.ok(d.ok);
    const onDesk = d.open.find((x) => x.id === r.reportId);
    assert.ok(onDesk, "on the desk");
    assert.equal(onDesk!.contentKindLabel, "Live class");
    assert.equal(onDesk!.reasonLabel, "Asked me to talk privately or meet up");
    assert.equal(onDesk!.reportedUsername, handle("t1"));
    assert.equal(onDesk!.snapshot.classRole, "teacher");
    assert.equal(onDesk!.snapshot.liveNow, true);
    assert.ok(onDesk!.snapshot.target?.startsWith("lftest room-and-chat now, "), onDesk!.snapshot.target ?? "");

    const again = await fileClassReport("s1", handle("t1"), "unsafe");
    assert.ok(again.ok && again.alreadyReported, "one open report per person per thing");
  });

  await step("reports: who may report whom in a class", async () => {
    const student = await fileClassReport("s1", handle("s2"), "harassment");
    assert.ok(student.ok, student.ok ? "" : student.error);
    // From the removed screen: a removed student can still report someone from the class.
    const fromRemovedScreen = await fileClassReport("s4", handle("s1"), "harassment");
    assert.ok(fromRemovedScreen.ok, fromRemovedScreen.ok ? "" : fromRemovedScreen.error);
    const outsiderOnStudent = await fileClassReport("out", handle("s2"), "harassment");
    assert.ok(!outsiderOnStudent.ok && outsiderOnStudent.error === reports.REPORT_SENTENCES.needsClass);
    const notInClass = await fileClassReport("s1", handle("notenr"), "harassment");
    assert.ok(!notInClass.ok && notInClass.error === reports.REPORT_SENTENCES.notInClass);
    const badReason = await fileClassReport("s2", handle("s1"), "nonsense");
    assert.ok(!badReason.ok && badReason.field === "reason");
    // The class-only reasons are for class reports only.
    const profileWithClassReason = await reports.fileReport(user("s1"), {
      username: handle("out"),
      reason: "sexual",
      surface: "profile",
    });
    assert.ok(!profileWithClassReason.ok && profileWithClassReason.field === "reason");
  });

  await step("reports: existing profile reports still work", async () => {
    const since = Date.now();
    const r = await reports.fileReport(user("s1"), { username: handle("out"), reason: "spam", surface: "profile", platform: "web" });
    assert.ok(r.ok && !r.alreadyReported, r.ok ? "" : r.error);
    const { data: row } = await admin.from("user_reports").select("content_kind, reason").eq("id", r.reportId!).single();
    assert.deepEqual(row, { content_kind: "profile", reason: "spam" });
    const mail = outbox(since).find((m) => m.subject === `LearnFRC: report about @${handle("out")}`);
    assert.ok(mail, "the owner's report email");
  });

  await step("reports: a second reporter from a live class ends it, suspends and holds the teacher", async () => {
    const since = Date.now();
    const n = rtkCalls.length;
    // The teacher's other upcoming classes, which the suspension will cancel.
    const { data: upcomingRows } = await admin
      .from("classes")
      .select("id, rtk_meeting_id")
      .eq("teacher_id", acc.t1.id)
      .eq("status", "scheduled")
      .neq("id", nowId);
    const upcoming = (upcomingRows ?? []) as { id: string; rtk_meeting_id: string | null }[];
    assert.ok(upcoming.length > 0, "the teacher has other upcoming test classes");
    // An outsider's report about the teacher doesn't count towards the two.
    const outsider = await fileClassReport("out", handle("t1"), "unsafe");
    assert.ok(outsider.ok);
    let { data: cls } = await admin.from("classes").select("status").eq("id", nowId).single();
    assert.equal(cls!.status, "scheduled", "still on after an outsider's report");

    const second = await fileClassReport("s2", handle("t1"), "unsafe");
    assert.ok(second.ok, second.ok ? "" : second.error);
    ({ data: cls } = await admin.from("classes").select("status, end_reason").eq("id", nowId).single());
    assert.deepEqual(cls, { status: "ended", end_reason: "reports" });
    // GETs are the hold's peer-report reads (the mock has none to give).
    const sent = rtkCalls
      .slice(n)
      .filter((c) => c.method !== "GET")
      .map((c) => `${c.method} ${c.path} ${c.body ? JSON.stringify(c.body) : ""}`.trim());
    assert.deepEqual(sent.slice(0, 2), [
      `POST /meetings/lftest-meeting-${nowId}/active-session/kick-all {}`,
      `PATCH /meetings/lftest-meeting-${nowId} {"status":"INACTIVE"}`,
    ]);
    // The real suspendTeacher (teachers) and cancelTeacherClasses (pages):
    // every other upcoming class is canceled and its meeting set INACTIVE.
    assert.ok(await suspendedAt(acc.t1.id), "the teacher is suspended");
    const { data: afterRows } = await admin.from("classes").select("id, status").in("id", upcoming.map((c) => c.id));
    assert.ok(
      (afterRows ?? []).every((c) => c.status === "canceled"),
      `the teacher's other classes are canceled: ${JSON.stringify(afterRows)}`
    );
    assert.deepEqual(
      sent.slice(2).sort(),
      upcoming
        .filter((c) => c.rtk_meeting_id)
        .map((c) => `PATCH /meetings/${c.rtk_meeting_id} {"status":"INACTIVE"}`)
        .sort()
    );
    // holdClass keeps one hold per person per class: the earlier class_report
    // hold about the teacher is refreshed with the auto-end, not duplicated.
    assert.deepEqual(await holdReasons(nowId, acc.t1.id), ["class_report"], "one hold about the teacher");
    const { data: refreshed } = await admin
      .from("class_events")
      .select("detail")
      .eq("class_id", nowId)
      .eq("kind", "hold_refreshed");
    assert.ok(
      ((refreshed ?? []) as { detail: { reason?: string; subjectUserId?: string } }[]).some(
        (e) => e.detail.reason === "auto_end" && e.detail.subjectUserId === acc.t1.id
      ),
      "the hold was refreshed for the auto-end"
    );
    const { count } = await admin
      .from("class_events")
      .select("id", { count: "exact", head: true })
      .eq("class_id", nowId)
      .eq("kind", "auto_ended");
    assert.equal(count, 1);
    const urgent = outbox(since).find((m) => m.subject.startsWith("[Check now] LearnFRC safety:"));
    assert.ok(urgent, "the urgent email");
    assert.deepEqual([...urgent!.to].sort(), [process.env.ADMIN_EMAILS!, process.env.CLASSES_SAFETY_EMAIL!].sort());
    assert.ok(urgent!.html.includes("/admin/classes/playbook"));

    const status = await room.roomStatus(user("s1"), nowId);
    assert.deepEqual(status, { status: "ended", endReason: "reports", removed: false });
    const closed = await send("s1", "is it over?");
    assert.ok(!closed.ok && closed.error === chat.CHAT_SENTENCES.closed);
    // Put the teacher and their other classes back for the steps below.
    const restored = await restoreTeacher(acc.t1.id, upcoming.map((c) => c.id));
    assert.equal(restored.length, upcoming.length);
    // A third report doesn't end it twice, or suspend the teacher again.
    const third = await fileClassReport("s1", handle("t1"), "harassment");
    assert.ok(third.ok);
    assert.equal(await suspendedAt(acc.t1.id), null);
    const { count: ends } = await admin
      .from("class_events")
      .select("id", { count: "exact", head: true })
      .eq("class_id", nowId)
      .eq("kind", "auto_ended");
    assert.equal(ends, 1);
  });

  await step("desk: Remove on a class report removes the student from the class", async () => {
    const d = await desk.loadReportsDesk(user("staff"));
    assert.ok(d.ok);
    const report = d.open.find((x) => x.contentKind === "class" && x.reportedUsername === handle("s2"));
    assert.ok(report, "the report about s2");
    const notStaff = await desk.removeReportedContent(user("s1"), { id: report!.id });
    assert.ok(!notStaff.ok);
    const r = await desk.removeReportedContent(user("staff"), { id: report!.id, note: "lftest" });
    assert.ok(r.ok, r.ok ? "" : r.error);
    const { data: enr } = await admin
      .from("class_enrollments")
      .select("status")
      .eq("class_id", nowId)
      .eq("user_id", acc.s2.id)
      .single();
    assert.equal(enr!.status, "removed");
    const { data: part } = await admin
      .from("class_participants")
      .select("revoked_at")
      .eq("class_id", nowId)
      .eq("user_id", acc.s2.id)
      .single();
    assert.ok(part!.revoked_at);
  });

  await step("desk: Remove on a report about the teacher suspends their teaching", async () => {
    const d = await desk.loadReportsDesk(user("staff"));
    assert.ok(d.ok);
    const report = d.open.find((x) => x.contentKind === "class" && x.reportedUsername === handle("t1"));
    assert.ok(report, "an open report about the teacher");
    const { data: upcomingRows } = await admin
      .from("classes")
      .select("id")
      .eq("teacher_id", acc.t1.id)
      .eq("status", "scheduled");
    const r = await desk.removeReportedContent(user("staff"), { id: report!.id });
    assert.ok(r.ok, r.ok ? "" : r.error);
    assert.ok(await suspendedAt(acc.t1.id), "the teacher is suspended");
    // Put the teacher and their other classes back for the steps below.
    await restoreTeacher(acc.t1.id, ((upcomingRows ?? []) as { id: string }[]).map((c) => c.id));
    const { count } = await admin
      .from("user_reports")
      .select("id", { count: "exact", head: true })
      .eq("content_kind", "class")
      .eq("content_id", nowId)
      .eq("reported_user_id", acc.t1.id)
      .eq("status", "open");
    assert.equal(count, 0, "every open report about the teacher in this class is closed");
  });

  await step("desk: a ban passes reason ban, so live classes take their hold first", async () => {
    const d = await desk.loadReportsDesk(user("staff"));
    assert.ok(d.ok);
    const report = d.open.find((x) => x.contentKind === "profile" && x.reportedUsername === handle("out"));
    assert.ok(report, "the profile report about out");
    const r = await desk.banReportedAccount(user("staff"), { id: report!.id, note: "lftest" });
    assert.ok(r.ok, r.ok ? "" : r.error);
    // The real holdAccount (safety-holds): a ban hold that outlives the account.
    const { data: held } = await admin
      .from("class_safety_holds")
      .select("reason, subject_handle, subject_user_id")
      .eq("subject_handle", handle("out"));
    assert.deepEqual(
      ((held ?? []) as { reason: string }[]).map((h) => h.reason),
      ["ban"],
      "a ban hold with the handle kept"
    );
    const { data: gone } = await admin.auth.admin.getUserById(acc.out.id);
    assert.equal(gone?.user ?? null, null, "the account is deleted");
  });

  /* end */

  await step("end: a student can't end a class early; the teacher's End kicks all and sets INACTIVE", async () => {
    const early = await room.endClass(user("s1"), { classId: endId, reason: "time" });
    assert.ok(!early.ok && early.error === S.endForbidden);
    const n = rtkCalls.length;
    const r = await room.endClass(user("t1"), { classId: endId, reason: "teacher" });
    assert.ok(r.ok && !r.already, r.ok ? "" : r.error);
    assert.deepEqual(
      rtkCalls.slice(n).map((c) => `${c.method} ${c.path}`),
      [`POST /meetings/lftest-meeting-${endId}/active-session/kick-all`, `PATCH /meetings/lftest-meeting-${endId}`]
    );
    const { data: cls } = await admin.from("classes").select("status, end_reason, ended_at").eq("id", endId).single();
    assert.equal(cls!.status, "ended");
    assert.equal(cls!.end_reason, "teacher");
    assert.ok(cls!.ended_at);
    const m = rtkCalls.length;
    const again = await room.endClass(user("t1"), { classId: endId, reason: "teacher" });
    assert.ok(again.ok && again.already, "idempotent");
    assert.equal(rtkCalls.length, m, "no second kick");
  });

  await step("end: anyone still in the class may end it once its time is up", async () => {
    await admin.from("class_participants").insert({
      class_id: pastId,
      user_id: acc.s1.id,
      role: "student",
      preset_name: "lfrc-student",
    });
    const outsider = await room.endClass(user("s2"), { classId: pastId, reason: "time" });
    assert.ok(!outsider.ok, "not in the class");
    const r = await room.endClass(user("s1"), { classId: pastId, reason: "time" });
    assert.ok(r.ok && !r.already, r.ok ? "" : r.error);
    const { data: cls } = await admin.from("classes").select("status, end_reason").eq("id", pastId).single();
    assert.deepEqual(cls, { status: "ended", end_reason: "time" });
  });

  /* the pause switch (shared settings row: put back in finally) */

  await step("pause: joins are refused while paused, except staff; only staff may flip it", async () => {
    const forbidden = await room.setJoinsPaused(user("s1"), { paused: false });
    assert.ok(!forbidden.ok && forbidden.error === S.pauseForbidden);
    process.env.CLASSES_DEV_SWITCHES = "0";
    try {
      await setSettings({ classes_visible: true, joins_paused: true });
      await expectRefusal("s1", laterId, "paused", S.paused);
      // Staff skip the pause (and are then refused for the missing meeting).
      await expectRefusal("staff", noMeetingId, "not_ready", S.notReady);

      const open = await room.setJoinsPaused(user("staff"), { paused: false });
      assert.ok(open.ok, open.ok ? "" : open.error);
      const { data: s } = await admin.from("class_settings").select("joins_paused, paused_reason").eq("id", true).single();
      assert.deepEqual(s, { joins_paused: false, paused_reason: null });
      await expectRefusal("s1", laterId, "early", S.earlyStudent);

      // Pausing ends every class live now in this app. Run it only when every
      // such class is this check's own, so another package's test class is
      // never ended from here.
      const { data: live } = await admin
        .from("classes")
        .select("id, title, status, starts_at, hard_end_at")
        .in("status", ["scheduled", "live"])
        .eq("rtk_app", "dev")
        .gt("hard_end_at", new Date().toISOString());
      const rules = await import("../../../src/lib/classes/room-rules.ts");
      const liveNow = (live ?? []).filter((c) => rules.isLiveNow(c));
      if (liveNow.every((c) => String(c.title).startsWith("lftest room-and-chat"))) {
        const pauseId = await newClass("pause", acc.t1.id, { startsInMin: 1 });
        const p = await room.setJoinsPaused(user("staff"), { paused: true, reason: "lftest" });
        assert.ok(p.ok && p.ended >= 1, p.ok ? `ended ${p.ended}` : p.error);
        const { data: c } = await admin.from("classes").select("status, end_reason").eq("id", pauseId).single();
        assert.deepEqual(c, { status: "ended", end_reason: "paused" });
      } else {
        console.log("     (pausing with other packages' live classes present: the end-all part is left for integration)");
        const p = await room.setJoinsPaused(user("staff"), { paused: true, reason: "lftest" });
        assert.ok(p.ok);
      }
      await expectRefusal("s1", laterId, "paused", S.paused);
    } finally {
      process.env.CLASSES_DEV_SWITCHES = "1";
      await setSettings(SETTINGS_DEFAULTS);
    }
  });
}

try {
  await main();
} catch (e) {
  results.push({ name: "setup", ok: false, error: (e as Error).message });
  console.log(`FAIL setup: ${(e as Error).message}`);
} finally {
  for (const c of new Set(openClients)) {
    try {
      await c.removeAllChannels();
      c.realtime.disconnect();
      await c.auth.signOut({ scope: "local" });
    } catch {
      // closing is best effort
    }
  }
  try {
    await setSettings(SETTINGS_DEFAULTS);
  } catch (e) {
    console.log(`FAIL restoring class_settings: ${(e as Error).message}`);
  }
  console.log("--- cleanup ---");
  await cleanup(PKG);
  await check(PKG);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : (process.exitCode ?? 0));
}
