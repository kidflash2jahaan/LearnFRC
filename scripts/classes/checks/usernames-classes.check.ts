// The usernames package's checks against production with throwaway accounts
// (usernames-spec.md section 5): what live classes do with a username nobody
// chose or kept yet (profiles.username_generated, from the 2026-11-11
// migration) and with a rename in the middle of a class.
//   1. joinClass refuses needs_handle for a student, a teacher and staff, each
//      with its own sentence, before any RealtimeKit call or consent row. The
//      same accounts get in before the flag and again once it's kept.
//   2. sendClassChat refuses the student path and the teacher and staff path
//      with the chat's needsHandle sentence, and stores nothing.
//   3. A class report finds the person by userId before username, so a rename
//      mid-class still reaches them and whoever takes the old name is never
//      reported. userId is ignored on a profile report.
//   4. The reports desk's "replace the username" takes a generate_username
//      handle, flags it in its own write and logs the rename; classes then
//      wait on the username step. Without replaceUsername the handle stays.
//   5. What the room view and the roster show for a member whose username is
//      generated.
//   6. scheduleClass refuses a teacher whose username is generated, before
//      RealtimeKit; once it's kept, every gate passes.
//   7. Over HTTP, sent as the app sends them: GET /api/app/me and
//      GET /api/app/apply's teacher role for a generated username,
//      GET /api/app/classes for a generated viewer and teacher, and
//      POST /api/app/reports with the optional userId (a username-only body
//      still files).
//
// The functions run in this process against a fake RealtimeKit (fetch to
// api.cloudflare.com never leaves the machine), as in room-and-chat. The HTTP
// steps need a dev server in this worktree with the classes switches on, on
// its own port:
//
//   scripts/classes/make-env.sh <worktree> usernames 3120
//   env -u RESEND_API_KEY taskpolicy -b nice -n 20 npx next dev -p 3120
//   env -u RESEND_API_KEY node --import ./scripts/classes/register.mjs scripts/classes/checks/usernames-classes.check.ts
//
// APP_BASE overrides the server (default http://localhost:3120). It never
// touches class_settings: the switches come from CLASSES_DEV_SWITCHES, and the
// end of the run checks the row is as it found it. Its test data is package
// "usernames"; everything it makes is deleted at the end, including the
// name_moderation_log rows the desk's rename writes and the per-IP rate-limit
// rows the HTTP reports leave, which test-data.mjs cleanup doesn't know about.

import assert from "node:assert/strict";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { devDir, loadEnv } from "../env.mjs";
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

const PKG = "usernames";
const BASE = (process.env.APP_BASE || "http://localhost:3120").replace(/\/$/, "");
// This package's own outbox (cleanup removes it), whatever package the
// worktree's .env.local was built for.
process.env.EMAIL_DEV_OUTBOX = join(devDir(), "outbox", PKG);

const results: { name: string; ok: boolean; error?: string }[] = [];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const openClients: SupabaseClient[] = [];

/* ── A fake RealtimeKit ────────────────────────────────────────────── */

type RtkCall = { method: string; path: string; body: Record<string, unknown> | undefined };
const rtkCalls: RtkCall[] = [];
let participantSeq = 0;
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
  rtkCalls.push({ method, path, body });
  if (method === "POST" && /^\/meetings\/[^/]+\/participants$/.test(path)) {
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
  if (method === "DELETE") return rtkJson({ success: true, data: {} });
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

/* ── Fixtures ──────────────────────────────────────────────────────── */

type Account = { id: string; email: string; password: string; username: string | null };

async function newClass(slug: string, teacherId: string, opts: { startsInMin: number; meeting: boolean }) {
  const starts = new Date(Date.now() + opts.startsInMin * 60_000);
  const { data, error } = await admin
    .from("classes")
    .insert({
      teacher_id: teacherId,
      title: `lftest ${PKG} ${slug}`,
      description: "A throwaway class for the usernames checks.",
      starts_at: starts.toISOString(),
      duration_minutes: 30,
      hard_end_at: new Date(starts.getTime() + 45 * 60_000).toISOString(),
      capacity: 15,
      status: "scheduled",
      rtk_app: "dev",
    })
    .select("id")
    .single();
  if (error) throw new Error(`class ${slug}: ${error.message}`);
  const id = data.id as string;
  if (opts.meeting) await admin.from("classes").update({ rtk_meeting_id: `lftest-meeting-${id}` }).eq("id", id);
  return id;
}

async function enroll(classId: string, userId: string) {
  const { data, error } = await admin.rpc("class_enroll", { p_class_id: classId, p_user_id: userId });
  if (error || (data !== "ok" && data !== "already")) throw new Error(`enroll: ${error?.message ?? data}`);
}

/** Every account id this package ever made, from the credentials file (read before cleanup deletes it). */
function everIds(): string[] {
  return Object.values((readCredentials(PKG).accounts ?? {}) as Record<string, Account>)
    .map((a) => a?.id)
    .filter((x): x is string => !!x);
}

/**
 * Rows test-data.mjs cleanup doesn't know about: the desk's rename log
 * (name_moderation_log, which would also stop the profile being deleted if
 * its key has no cascade) and the per-IP rate-limit buckets a route leaves
 * (`report:<ip>:<account id>`). Returns how many it found.
 */
async function scrubExtras(ids: string[]): Promise<{ renames: number; limits: number }> {
  let renames = 0;
  let limits = 0;
  if (ids.length) {
    const { count, error } = await admin.from("name_moderation_log").delete({ count: "exact" }).in("user_id", ids);
    if (error) throw new Error(`name_moderation_log: ${error.message}`);
    renames = count ?? 0;
  }
  for (const id of ids) {
    const { count, error } = await admin.from("rate_limit_hits").delete({ count: "exact" }).like("bucket", `%${id}%`);
    if (error) throw new Error(`rate_limit_hits: ${error.message}`);
    limits += count ?? 0;
  }
  return { renames, limits };
}

/* ── The checks ────────────────────────────────────────────────────── */

let settingsAtStart: { classes_visible: boolean; joins_paused: boolean } | null = null;

async function main() {
  const { data: s } = await admin.from("class_settings").select("classes_visible, joins_paused").eq("id", true).single();
  settingsAtStart = s as { classes_visible: boolean; joins_paused: boolean };

  // A clean start if an earlier run stopped halfway.
  await scrubExtras(everIds());
  await cleanup(PKG);
  await create(PKG, [
    "t1:age=16:parent=agreed:teacher",
    "tg:age=16:parent=agreed:teacher:generated",
    "s1:age=14:parent=agreed",
    "s2:age=15:parent=agreed",
    "s3:age=15:parent=agreed",
    "sg:age=15:parent=agreed",
    "mover:age=15:parent=agreed",
    "taker:age=15:parent=agreed",
    "ren:age=15:parent=agreed",
    "kept:age=15:parent=agreed",
    "sa:superadmin",
    "sanon:superadmin:nousername",
    "desk:superadmin",
  ]);
  const acc = readCredentials(PKG).accounts as Record<string, Account>;
  const user = (k: string) => ({ id: acc[k].id, email: acc[k].email, created_at: new Date().toISOString() });
  const handle = (k: string) => acc[k].username as string;

  const room = await import("../../../src/lib/app/classes-room.ts");
  const chat = await import("../../../src/lib/app/class-chat.ts");
  const classes = await import("../../../src/lib/app/classes.ts");
  const teaching = await import("../../../src/lib/app/classes-teaching.ts");
  const reports = await import("../../../src/lib/app/reports.ts");
  const desk = await import("../../../src/lib/app/admin-reports.ts");
  const schedule = await import("../../../src/lib/classes/schedule.ts");
  const notice = await import("../../../src/lib/classes/notice.ts");
  const contact = await import("../../../src/lib/classes/contact-patterns.ts");
  const usernames = await import("../../../src/lib/usernames.ts");
  const S = room.ROOM_SENTENCES;
  const C = chat.CHAT_SENTENCES;

  // `now` is on (the room opens 15 minutes before), `gteach` is taught by the
  // teacher whose username is generated, `http` is upcoming with no meeting
  // (the HTTP reports, so the dev server's hold has no recording to look for).
  const nowId = await newClass("now", acc.t1.id, { startsInMin: 5, meeting: true });
  const gteachId = await newClass("gteach", acc.tg.id, { startsInMin: 5, meeting: true });
  const httpId = await newClass("http", acc.t1.id, { startsInMin: 180, meeting: false });
  for (const k of ["s1", "s2", "sg", "mover", "ren"]) await enroll(nowId, acc[k].id);
  await enroll(gteachId, acc.s1.id);
  {
    const { error } = await admin.from("class_participants").insert(
      ["s3", "mover"].map((k) => ({ class_id: httpId, user_id: acc[k].id, role: "student", preset_name: "lfrc-student" }))
    );
    if (error) throw new Error(`http participants: ${error.message}`);
  }

  const current = async (k: string): Promise<{ username: string; generated: boolean }> => {
    const { data, error } = await admin.from("profiles").select("username, username_generated").eq("id", acc[k].id).single();
    if (error) throw new Error(`profile ${k}: ${error.message}`);
    return { username: data.username as string, generated: data.username_generated as boolean };
  };
  /** The flag alone, as the name scan's second write sets it and Keep clears it. */
  const setGenerated = async (k: string, on: boolean) => {
    const { error } = await admin.from("profiles").update({ username_generated: on }).eq("id", acc[k].id);
    if (error) throw new Error(`flag ${k}: ${error.message}`);
    assert.equal((await current(k)).generated, on, `${k}'s flag didn't take`);
  };
  const countRows = async (table: string, classId: string, col: string, k: string) => {
    const { count, error } = await admin
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("class_id", classId)
      .eq(col, acc[k].id);
    if (error) throw new Error(`${table}: ${error.message}`);
    return count ?? 0;
  };

  // The join limit (6 per 10 minutes) would stop these checks themselves.
  const join = async (k: string, classId: string) => {
    await admin.from("rate_limit_hits").delete().eq("bucket", `class-join:k:${acc[k].id}`);
    return room.joinClass(user(k), {
      classId,
      noticeVersion: notice.CLASS_NOTICE_VERSION,
      userAgent: "lftest-agent",
      ip: "203.0.113.9",
    });
  };
  const joinOk = async (k: string, classId: string, role: "student" | "teacher" | "staff", displayName: string) => {
    const r = await join(k, classId);
    assert.ok(r.ok, r.ok ? "" : `${k} was refused: ${r.reason}: ${r.error}`);
    assert.equal(r.role, role);
    assert.equal(r.displayName, displayName);
  };
  const joinRefused = async (k: string, classId: string, sentence: string) => {
    const calls = rtkCalls.length;
    const consents = await countRows("class_consents", classId, "user_id", k);
    const r = await join(k, classId);
    assert.equal(r.ok, false, `${k} got in`);
    if (r.ok) return;
    assert.equal(r.reason, "needs_handle", `${k}: ${r.reason}: ${r.error}`);
    assert.equal(r.code, "forbidden");
    assert.equal(r.error, sentence);
    assert.equal(rtkCalls.length, calls, "a refusal makes no RealtimeKit call");
    assert.equal(await countRows("class_consents", classId, "user_id", k), consents, "and writes no notice record");
  };
  const send = (k: string, text: string, classId = nowId) => chat.sendClassChat(user(k), { classId, text });
  const chatShown = async (k: string, text: string) => {
    const r = await send(k, text);
    assert.ok(r.ok && r.status === "shown", `${k}: ${JSON.stringify(r)}`);
    if (!r.ok || r.status !== "shown") return;
    assert.equal(r.message.senderUsername, (await current(k)).username);
  };
  const chatRefused = async (k: string, text: string) => {
    const before = await countRows("class_chat_messages", nowId, "sender_id", k);
    const r = await send(k, text);
    assert.ok(!r.ok, `${k}'s message went through: ${JSON.stringify(r)}`);
    if (r.ok) return;
    assert.equal(r.code, "forbidden");
    assert.equal(r.error, C.needsHandle);
    assert.equal(await countRows("class_chat_messages", nowId, "sender_id", k), before, "nothing is stored");
  };

  /* 1 and 2: joining and the chat */

  await step("join and chat: a ready student, teacher and staff get in and are shown (the control)", async () => {
    for (const k of ["s1", "s2", "sg", "mover", "ren"]) await joinOk(k, nowId, "student", `@${handle(k)}`);
    await joinOk("t1", nowId, "teacher", `@${handle("t1")} (teacher)`);
    await joinOk("sa", nowId, "staff", `@${handle("sa")} (LearnFRC staff)`);
    await chatShown("sg", "which gear ratio do you use for the swerve drive");
    await chatShown("t1", "good question, we will get to gear ratios next");
    await chatShown("sa", "hi everyone, LearnFRC staff here for a few minutes");
  });

  await step("the needs_handle sentences are the ones apple/docs/API.md quotes", async () => {
    assert.equal(S.needsHandle, "Choose the username your classmates will see before you join a class.");
    assert.equal(S.needsHandle, classes.CLASS_SENTENCES.needsHandle);
    assert.equal(S.teachNeedsHandle, "Choose the username your students will see before you teach.");
    assert.equal(S.staffNeedsHandle, "Choose the username the class will see before you join it.");
    assert.equal(C.needsHandle, "Choose the username the class will see before you send messages.");
  });

  await step("join: a student whose username turns generated mid-class is refused needs_handle", async () => {
    await setGenerated("sg", true);
    await joinRefused("sg", nowId, S.needsHandle);
  });

  await step("chat: the student path refuses a generated username with needsHandle, storing nothing", async () => {
    await setGenerated("sg", true);
    await chatRefused("sg", "is the gear ratio on the slides");
  });

  await step("join: a teacher whose username is generated is refused teachNeedsHandle", async () => {
    // Made with a generated username (test-data's modifier) ...
    assert.equal((await current("tg")).generated, true);
    await joinRefused("tg", gteachId, S.teachNeedsHandle);
    // ... and one whose username turns generated mid-class.
    await setGenerated("t1", true);
    await joinRefused("t1", nowId, S.teachNeedsHandle);
  });

  await step("chat: the teacher path refuses a generated username with needsHandle, storing nothing", async () => {
    await setGenerated("t1", true);
    await chatRefused("t1", "next we will look at the encoder wiring");
  });

  await step("join: staff whose username is generated are refused staffNeedsHandle", async () => {
    // Signed up with no username: the database named and flagged the account.
    const made = await current("sanon");
    assert.match(made.username, /^[a-z]+_[0-9]{4}$/);
    assert.equal(made.generated, true);
    await joinRefused("sanon", nowId, S.staffNeedsHandle);
    // And staff whose username turns generated mid-class.
    await setGenerated("sa", true);
    await joinRefused("sa", nowId, S.staffNeedsHandle);
  });

  await step("chat: the staff path refuses a generated username with needsHandle, storing nothing", async () => {
    await setGenerated("sa", true);
    await chatRefused("sa", "staff here again, carry on");
  });

  /* 5: what the room and the roster show */

  await step("room view and roster: a generated username is never 'you'll show as', and others see the current handle", async () => {
    await setGenerated("sg", true);
    await setGenerated("t1", true);
    await setGenerated("sa", true);
    const consents = await admin.from("class_consents").select("id", { count: "exact", head: true }).in("class_id", [nowId, gteachId]);

    const mine = await room.getRoomView(user("sg"), nowId);
    assert.equal(mine.kind, "ok");
    if (mine.kind !== "ok") return;
    assert.equal(mine.room.role, "student");
    assert.deepEqual(mine.room.refusal, { reason: "needs_handle", message: S.needsHandle, opensAt: undefined });
    assert.equal(mine.room.username, null, "the generated handle isn't offered as theirs");
    assert.equal(mine.room.displayName, null);
    assert.equal(mine.room.removed, false);
    assert.equal(mine.room.canReport, true, "they were in it, so they can still report");

    const teacher = await room.getRoomView(user("tg"), gteachId);
    assert.ok(teacher.kind === "ok");
    if (teacher.kind !== "ok") return;
    assert.equal(teacher.room.role, "teacher");
    assert.equal(teacher.room.refusal?.reason, "needs_handle");
    assert.equal(teacher.room.refusal?.message, S.teachNeedsHandle);
    assert.equal(teacher.room.username, null);
    assert.equal(teacher.room.displayName, null);

    const staff = await room.getRoomView(user("sa"), nowId);
    assert.ok(staff.kind === "ok");
    if (staff.kind !== "ok") return;
    assert.equal(staff.room.role, "staff");
    assert.equal(staff.room.refusal?.message, S.staffNeedsHandle);
    assert.equal(staff.room.username, null);
    assert.equal(staff.room.displayName, null);

    // Everyone else sees each person by their current username (ClassRosterEntry),
    // generated or not: it's who they are on the site right now, and the report
    // panel sends the id with it.
    const other = await room.getRoomView(user("s1"), nowId);
    assert.ok(other.kind === "ok");
    if (other.kind !== "ok") return;
    assert.equal(other.room.refusal, null, "the ready viewer can join");
    assert.equal(other.room.username, handle("s1"));
    assert.equal(other.room.displayName, `@${handle("s1")}`);
    assert.equal(other.room.teacherUsername, (await current("t1")).username);
    const byId = new Map(other.room.roster.map((r) => [r.userId, r]));
    assert.equal(byId.get(acc.sg.id)?.username, (await current("sg")).username);
    assert.equal(byId.get(acc.sg.id)?.role, "student");
    assert.equal(byId.get(acc.t1.id)?.role, "teacher");
    assert.equal(byId.get(acc.sa.id)?.role, "staff");
    assert.equal(other.room.roster[0].role, "teacher", "teacher first");

    const theirs = await room.getRoomView(user("s1"), gteachId);
    assert.ok(theirs.kind === "ok");
    if (theirs.kind !== "ok") return;
    assert.equal(theirs.room.teacherUsername, (await current("tg")).username);
    assert.equal(theirs.room.refusal, null, "a generated teacher doesn't stop a ready student");
    const roster = await classes.classRoster(gteachId);
    assert.deepEqual(roster, [{ userId: acc.tg.id, role: "teacher", revoked: false, username: (await current("tg")).username }]);

    const after = await admin.from("class_consents").select("id", { count: "exact", head: true }).in("class_id", [nowId, gteachId]);
    assert.equal(after.count, consents.count, "the room view writes nothing");
  });

  await step("join and chat: once the username is kept, the same accounts get in and are shown again", async () => {
    for (const k of ["sg", "t1", "sa"]) await setGenerated(k, false);
    await joinOk("sg", nowId, "student", `@${handle("sg")}`);
    await joinOk("t1", nowId, "teacher", `@${handle("t1")} (teacher)`);
    await joinOk("sa", nowId, "staff", `@${handle("sa")} (LearnFRC staff)`);
    await chatShown("sg", "thanks, the slides make sense now");
    await chatShown("t1", "great, on to the encoders");
    await chatShown("sa", "thanks all, heading out");
    await setGenerated("tg", false);
    try {
      await joinOk("tg", gteachId, "teacher", `@${handle("tg")} (teacher)`);
    } finally {
      await setGenerated("tg", true);
    }
  });

  /* 6: scheduling */

  await step("schedule: a teacher whose username is generated is refused teachNeedsHandle before RealtimeKit; kept, every gate passes", async () => {
    const { data: lesson, error: lessonError } = await admin.from("lessons").select("id").limit(1).single();
    if (lessonError) throw new Error(lessonError.message);
    const starts = new Date(Math.floor((Date.now() + 3 * 86_400_000 + 37 * 60_000) / 60_000) * 60_000);
    const input = {
      title: "lftest usernames schedule",
      description: "",
      lessonId: lesson!.id as string,
      startsAt: starts.toISOString(),
      durationMinutes: 45,
      capacity: 15,
    };
    const tgClasses = async () => {
      const { count } = await admin.from("classes").select("id", { count: "exact", head: true }).eq("teacher_id", acc.tg.id);
      return count ?? 0;
    };
    await setGenerated("tg", true);
    const classesBefore = await tgClasses();
    const calls = rtkCalls.length;
    const r = await teaching.scheduleClass(user("tg"), input);
    assert.equal(r.ok, false, "a generated teacher scheduled a class");
    if (!r.ok) {
      assert.equal(r.code, "forbidden");
      assert.equal(r.error, classes.CLASS_SENTENCES.teachNeedsHandle);
    }
    assert.equal(rtkCalls.length, calls, "no meeting was made");
    assert.equal(await tgClasses(), classesBefore, "no class was saved");
    const deskBefore = await teaching.loadTeachingDesk(user("tg"));
    assert.deepEqual(deskBefore.canSchedule, { ok: false, reason: classes.CLASS_SENTENCES.teachNeedsHandle, next: "username" });

    await setGenerated("tg", false);
    for (const k of Object.keys(FAKE_RTK)) delete process.env[k];
    try {
      // Without keys, the last gate: everything before it passed.
      const kept = await teaching.scheduleClass(user("tg"), input);
      assert.equal(kept.ok, false);
      if (!kept.ok) assert.equal(kept.error, schedule.SCHEDULE_SENTENCES.notConfigured, "the kept handle passes every gate");
      assert.equal(await tgClasses(), classesBefore);
      const deskAfter = await teaching.loadTeachingDesk(user("tg"));
      assert.deepEqual(deskAfter.canSchedule, { ok: true });
    } finally {
      Object.assign(process.env, FAKE_RTK);
      await setGenerated("tg", true);
    }
  });

  /* 3: reports by id */

  const MOVER_OLD = handle("mover");
  const MOVER_NEW = `${MOVER_OLD}2`;
  /** The mover renames mid-class, and the taker (never in a class) takes the old name. Idempotent. */
  const renameMover = async () => {
    if ((await current("mover")).username !== MOVER_NEW) {
      const { error } = await admin.from("profiles").update({ username: MOVER_NEW }).eq("id", acc.mover.id);
      if (error) throw new Error(`rename mover: ${error.message}`);
    }
    if ((await current("taker")).username !== MOVER_OLD) {
      const { error } = await admin.from("profiles").update({ username: MOVER_OLD }).eq("id", acc.taker.id);
      if (error) throw new Error(`rename taker: ${error.message}`);
    }
  };
  const reportsAbout = async (k: string) => {
    const { count } = await admin
      .from("user_reports")
      .select("id", { count: "exact", head: true })
      .eq("reported_user_id", acc[k].id);
    return count ?? 0;
  };
  const classReport = (k: string, classId: string, who: { userId?: string; username?: string }, reason = "harassment") =>
    reports.fileReport(user(k), {
      contentKind: "class",
      contentId: classId,
      ...who,
      reason,
      details: "",
      surface: "class",
      platform: "web",
    });

  await step("reports: by id, a rename mid-class still reaches the right person, and whoever takes the old name isn't reported", async () => {
    await renameMover();
    assert.deepEqual(await current("mover"), { username: MOVER_NEW, generated: false }, "a rename is their own name");
    assert.equal((await current("taker")).username, MOVER_OLD);

    // The room's panel read the roster before the rename: the old username, and the id.
    const byId = await classReport("s1", nowId, { userId: acc.mover.id, username: MOVER_OLD });
    assert.ok(byId.ok && !byId.alreadyReported, byId.ok ? "" : byId.error);
    const { data: row } = await admin
      .from("user_reports")
      .select("reported_user_id, reported_username, content_kind, content_id, content_snapshot")
      .eq("id", byId.reportId!)
      .single();
    assert.equal(row!.reported_user_id, acc.mover.id, "the renamed person");
    assert.equal(row!.reported_username, MOVER_NEW, "by the name they have now");
    assert.equal(row!.content_kind, "class");
    assert.equal(row!.content_id, nowId);
    assert.equal((row!.content_snapshot as { role: string }).role, "student");
    assert.ok(byId.message.includes(`@${MOVER_NEW}`), byId.message);

    // An id alone is enough.
    const idOnly = await classReport("s2", nowId, { userId: acc.mover.id });
    assert.ok(idOnly.ok && !idOnly.alreadyReported, idOnly.ok ? "" : idOnly.error);
    const { data: row2 } = await admin.from("user_reports").select("reported_user_id").eq("id", idOnly.reportId!).single();
    assert.equal(row2!.reported_user_id, acc.mover.id);

    // The old name alone now belongs to someone who was never in the class.
    const stale = await classReport("s2", nowId, { username: MOVER_OLD }, "offensive");
    assert.ok(!stale.ok, "a report by the stale username was filed");
    if (!stale.ok) {
      assert.equal(stale.code, "not_found");
      assert.equal(stale.error, reports.REPORT_SENTENCES.notInClass);
    }
    assert.equal(await reportsAbout("taker"), 0, "nobody reported the person who took the old name");
  });

  await step("reports: a userId that isn't a UUID or isn't in the class is refused; a profile report ignores userId", async () => {
    await renameMover();
    // The id wins over a username that would otherwise work.
    const notUuid = await classReport("s2", nowId, { userId: "not-a-uuid", username: handle("s1") });
    assert.ok(!notUuid.ok);
    if (!notUuid.ok) {
      assert.equal(notUuid.code, "not_found");
      assert.equal(notUuid.error, reports.REPORT_SENTENCES.noPerson);
    }
    const outsider = await classReport("s2", nowId, { userId: acc.taker.id, username: MOVER_OLD });
    assert.ok(!outsider.ok);
    if (!outsider.ok) {
      assert.equal(outsider.code, "not_found");
      assert.equal(outsider.error, reports.REPORT_SENTENCES.notInClass);
    }
    const nobody = await classReport("s2", nowId, {});
    assert.ok(!nobody.ok && nobody.code === "validation" && nobody.error === reports.REPORT_SENTENCES.noPerson);
    assert.equal(await reportsAbout("taker"), 0);

    const profile = await reports.fileReport(user("s1"), {
      contentKind: "profile",
      username: handle("s2"),
      userId: acc.mover.id,
      reason: "spam",
      surface: "profile",
      platform: "web",
    });
    assert.ok(profile.ok, profile.ok ? "" : profile.error);
    const { data: row } = await admin.from("user_reports").select("reported_user_id").eq("id", profile.reportId!).single();
    assert.equal(row!.reported_user_id, acc.s2.id, "a profile report goes by username");
  });

  /* 4: the desk's "replace the username" */

  let renNew = "";
  await step("desk: Remove with replaceUsername gives a generated handle, flagged in its own write, and logs the rename", async () => {
    const filed = await reports.fileReport(user("s1"), {
      contentKind: "profile",
      username: handle("ren"),
      reason: "offensive",
      surface: "profile",
      platform: "web",
    });
    assert.ok(filed.ok && filed.reportId, filed.ok ? "" : filed.error);
    const r = await desk.removeReportedContent(user("desk"), { id: filed.reportId!, note: "lftest", replaceUsername: true });
    assert.ok(r.ok, r.ok ? "" : r.error);
    if (!r.ok) return;
    assert.equal(r.status, "removed");
    assert.ok(r.newUsername, "a new username");
    renNew = r.newUsername!;
    const m = /^([a-z]+)_([0-9]{4})$/.exec(renNew);
    assert.ok(m, `the shape of a generated handle: ${renNew}`);
    assert.ok(usernames.GENERATED_USERNAME_WORDS.includes(m![1]), `${m![1]} is one of the generator's words`);
    assert.equal(usernames.generatedNumberDenied(m![2]), false);
    assert.equal(usernames.isReservedUsername(renNew), false);
    assert.equal(contact.usernameHasContact(renNew), false);

    const { data: prof } = await admin
      .from("profiles")
      .select("username, username_generated, bio, avatar_url")
      .eq("id", acc.ren.id)
      .single();
    assert.deepEqual(prof, { username: renNew, username_generated: true, bio: null, avatar_url: null });
    const { data: taken } = await admin.from("profiles").select("id").eq("username", handle("ren"));
    assert.deepEqual(taken, [], "the old name is free");

    const { data: log } = await admin
      .from("name_moderation_log")
      .select("old_username, new_username, reason")
      .eq("user_id", acc.ren.id);
    assert.equal(log?.length, 1, "one rename logged, so it can be reversed");
    assert.equal(log![0].old_username, handle("ren"));
    assert.equal(log![0].new_username, renNew);
    assert.ok((log![0].reason as string).startsWith("report: "), log![0].reason as string);

    const { data: rep } = await admin.from("user_reports").select("status").eq("id", filed.reportId!).single();
    assert.equal(rep!.status, "removed");
    const { count } = await admin
      .from("moderation_log")
      .select("id", { count: "exact", head: true })
      .eq("kind", "report")
      .eq("ref_id", filed.reportId!)
      .eq("decision", "removed");
    assert.equal(count, 1);
  });

  await step("desk: after the rename, classes wait on the username step; the roster shows the new handle; snapshots keep the old one", async () => {
    assert.ok(renNew, "needs the rename above");
    const detail = await classes.classEligibilityDetail(user("ren"));
    assert.equal(detail.state, "needs_handle");
    assert.equal(detail.username, null);
    await joinRefused("ren", nowId, S.needsHandle);
    await chatRefused("ren", "can I still ask about the gearbox");

    const roster = await classes.classRoster(nowId);
    const entry = roster.find((r) => r.userId === acc.ren.id);
    assert.equal(entry?.username, renNew, "the roster shows the handle they have now");
    assert.ok(!roster.some((r) => r.username === handle("ren")), "and never the removed one");

    // Stored snapshots record what was shown at the time.
    const { data: consents } = await admin
      .from("class_consents")
      .select("user_handle")
      .eq("class_id", nowId)
      .eq("user_id", acc.ren.id);
    assert.ok((consents ?? []).length > 0);
    assert.ok((consents ?? []).every((c) => c.user_handle === handle("ren")), JSON.stringify(consents));

    // A report from the class by id still reaches them, by the new name.
    const r = await classReport("s2", nowId, { userId: acc.ren.id, username: handle("ren") });
    assert.ok(r.ok && !r.alreadyReported, r.ok ? "" : r.error);
    const { data: row } = await admin
      .from("user_reports")
      .select("reported_user_id, reported_username")
      .eq("id", r.reportId!)
      .single();
    assert.deepEqual(row, { reported_user_id: acc.ren.id, reported_username: renNew });
  });

  await step("desk: Remove without replaceUsername keeps the handle and its flag (the control)", async () => {
    const filed = await reports.fileReport(user("s1"), {
      contentKind: "profile",
      username: handle("kept"),
      reason: "offensive",
      surface: "profile",
      platform: "web",
    });
    assert.ok(filed.ok && filed.reportId, filed.ok ? "" : filed.error);
    const r = await desk.removeReportedContent(user("desk"), { id: filed.reportId!, note: "lftest" });
    assert.ok(r.ok, r.ok ? "" : r.error);
    if (r.ok) assert.equal(r.newUsername, null);
    assert.deepEqual(await current("kept"), { username: handle("kept"), generated: false });
    const { count } = await admin
      .from("name_moderation_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", acc.kept.id);
    assert.equal(count, 0, "no rename logged");
    assert.equal(await classes.classEligibility(user("kept")), "ready");
  });

  /* 7: over HTTP, as the app sends it */

  const tokens = new Map<string, string>();
  const token = async (k: string): Promise<string> => {
    const have = tokens.get(k);
    if (have) return have;
    const c = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await c.auth.signInWithPassword({ email: acc[k].email, password: acc[k].password });
    if (error || !data.session) throw new Error(`sign in ${k}: ${error?.message}`);
    openClients.push(c);
    tokens.set(k, data.session.access_token);
    return data.session.access_token;
  };
  /** What the app sends: the same headers APIClient puts on every request. */
  const appHeaders = (bearer?: string, json = false): Record<string, string> => {
    const h: Record<string, string> = {
      Accept: "application/json",
      "X-Client-Info": "learnfrc-apple/1.0",
      "X-LearnFRC-Client": "iOS app",
    };
    if (bearer) h.Authorization = `Bearer ${bearer}`;
    if (json) h["Content-Type"] = "application/json";
    return h;
  };
  type Json = Record<string, unknown>;
  const call = async (method: string, path: string, k: string | null, body?: Json): Promise<{ status: number; body: Json }> => {
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, {
        method,
        headers: appHeaders(k ? await token(k) : undefined, !!body),
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new Error(`no dev server at ${BASE} (${(e as Error).message})`);
    }
    const raw = await res.text();
    try {
      return { status: res.status, body: JSON.parse(raw) as Json };
    } catch {
      throw new Error(`${method} ${path}: not JSON (${res.status}): ${raw.slice(0, 200)}`);
    }
  };

  await step("GET /api/app/me: a generated username asks for the username step; kept, it doesn't", async () => {
    await setGenerated("sg", true);
    const gen = await call("GET", "/api/app/me", "sg");
    assert.equal(gen.status, 200, JSON.stringify(gen.body));
    assert.equal(gen.body.needsUsernameSetup, true);
    assert.equal((gen.body.profile as Json).usernameGenerated, true);
    assert.equal(gen.body.isPlaceholderUsername, false);
    await setGenerated("sg", false);
    const kept = await call("GET", "/api/app/me", "sg");
    assert.equal(kept.body.needsUsernameSetup, false);
    assert.equal((kept.body.profile as Json).usernameGenerated, false);
  });

  await step("GET /api/app/apply: the teacher role is no-handle for a generated username; kept, it's back", async () => {
    const teacherRole = async (k: string) => {
      const r = await call("GET", "/api/app/apply", k);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const roles = r.body.roles as Json[];
      assert.equal(roles.length, 1, "the teacher role while classes are visible");
      assert.equal(roles[0].id, "teacher");
      assert.equal(roles[0].open, true);
      assert.equal(roles[0].url, `${BASE}/apply/teach`);
      return { status: roles[0].status, mode: r.body.mode };
    };
    await setGenerated("tg", true);
    await setGenerated("sg", true);
    assert.equal((await teacherRole("tg")).status, "no-handle", "a teacher with a generated username");
    assert.equal((await teacherRole("sg")).status, "no-handle", "a student with a generated username");
    assert.equal((await teacherRole("t1")).status, "teacher", "a ready teacher (the control)");
    assert.equal((await teacherRole("s1")).status, "new", "a ready student (the control)");
    await setGenerated("tg", false);
    await setGenerated("sg", false);
    try {
      assert.equal((await teacherRole("tg")).status, "teacher", "kept: a teacher again");
      assert.equal((await teacherRole("sg")).status, "new", "kept: can apply");
    } finally {
      await setGenerated("tg", true);
    }
  });

  await step("GET /api/app/classes: a generated viewer gets the normal signed-in list; a generated teacher shows by their current handle", async () => {
    await setGenerated("sg", true);
    await setGenerated("tg", true);
    const ours = new Set([nowId, gteachId, httpId]);
    const rows = (b: Json) => (b.classes as Json[]).filter((r) => ours.has(r.id as string));
    const keys = (r: Json) => Object.keys(r).sort();

    const gen = await call("GET", "/api/app/classes", "sg");
    assert.equal(gen.status, 200, JSON.stringify(gen.body));
    assert.equal(gen.body.visible, true);
    const genRows = new Map(rows(gen.body).map((r) => [r.id as string, r]));
    assert.equal(genRows.size, 3, "every one of our classes is listed");
    assert.equal(genRows.get(nowId)!.enrolled, true, "their seat is still theirs");
    assert.equal(genRows.get(httpId)!.enrolled, false);
    assert.deepEqual(genRows.get(nowId)!.teacher, { username: handle("t1") });
    assert.deepEqual(genRows.get(gteachId)!.teacher, { username: (await current("tg")).username });

    const ready = await call("GET", "/api/app/classes", "s1");
    const readyRows = new Map(rows(ready.body).map((r) => [r.id as string, r]));
    assert.deepEqual(Object.keys(gen.body).sort(), Object.keys(ready.body).sort(), "the same top-level fields");
    assert.deepEqual(keys(genRows.get(nowId)!), keys(readyRows.get(nowId)!), "the same row fields: no eligibility field to read");
    assert.deepEqual(readyRows.get(gteachId)!.teacher, { username: (await current("tg")).username });

    const anon = await call("GET", "/api/app/classes", null);
    const anonRow = rows(anon.body).find((r) => r.id === gteachId);
    assert.ok(anonRow, "listed signed out");
    assert.equal(anonRow!.teacher, null, "no handle signed out, generated or not");
    await setGenerated("sg", false);
  });

  await step("POST /api/app/reports: userId reaches the renamed person; a username-only body still files; a bad userId is 404", async () => {
    await renameMover();
    // The website's class report panel: the id it read, and the stale name.
    const byId = await call("POST", "/api/app/reports", "s3", {
      contentKind: "class",
      contentId: httpId,
      userId: acc.mover.id,
      username: MOVER_OLD,
      reason: "harassment",
      surface: "class",
      platform: "web",
    });
    assert.equal(byId.status, 201, JSON.stringify(byId.body));
    assert.equal(byId.body.alreadyReported, false);
    assert.ok(String(byId.body.message).includes(`@${MOVER_NEW}`), String(byId.body.message));
    const { data: row } = await admin
      .from("user_reports")
      .select("reported_user_id, reported_username, content_id, platform")
      .eq("id", byId.body.reportId as string)
      .single();
    assert.deepEqual(row, { reported_user_id: acc.mover.id, reported_username: MOVER_NEW, content_id: httpId, platform: "web" });

    // An installed copy that has only the stale username.
    const stale = await call("POST", "/api/app/reports", "s3", {
      contentKind: "class",
      contentId: httpId,
      username: MOVER_OLD,
      reason: "offensive",
      surface: "class",
      platform: "ios",
    });
    assert.equal(stale.status, 404, JSON.stringify(stale.body));
    assert.deepEqual(stale.body, { error: reports.REPORT_SENTENCES.notInClass, code: "not_found" });
    assert.equal(await reportsAbout("taker"), 0, "nobody reported the person who took the old name");

    // The app's classes list sends the teacher's username and no id: unchanged.
    const appBody = await call("POST", "/api/app/reports", "s3", {
      username: handle("t1"),
      contentKind: "class",
      contentId: httpId,
      reason: "spam",
      details: "lftest report from the usernames check",
      surface: "classes_list",
      platform: "ios",
    });
    assert.equal(appBody.status, 201, JSON.stringify(appBody.body));
    const { data: row2 } = await admin
      .from("user_reports")
      .select("reported_user_id, surface, platform")
      .eq("id", appBody.body.reportId as string)
      .single();
    assert.deepEqual(row2, { reported_user_id: acc.t1.id, surface: "classes_list", platform: "ios" });

    const bad = await call("POST", "/api/app/reports", "s3", {
      contentKind: "class",
      contentId: httpId,
      userId: "not-a-uuid",
      username: MOVER_NEW,
      reason: "harassment",
    });
    assert.equal(bad.status, 404, JSON.stringify(bad.body));
    assert.deepEqual(bad.body, { error: reports.REPORT_SENTENCES.noPerson, code: "not_found" });

    // A profile report's body is unchanged, and a userId sent with it is ignored.
    const profile = await call("POST", "/api/app/reports", "s3", {
      username: handle("s2"),
      userId: acc.mover.id,
      contentKind: "profile",
      reason: "spam",
      surface: "profile",
      platform: "ios",
    });
    assert.equal(profile.status, 201, JSON.stringify(profile.body));
    const { data: row3 } = await admin
      .from("user_reports")
      .select("reported_user_id, content_kind")
      .eq("id", profile.body.reportId as string)
      .single();
    assert.deepEqual(row3, { reported_user_id: acc.s2.id, content_kind: "profile" });
  });
}

let ids: string[] = [];
try {
  await main();
} catch (e) {
  results.push({ name: "setup", ok: false, error: (e as Error).message });
  console.log(`FAIL setup: ${(e as Error).message}`);
} finally {
  for (const c of new Set(openClients)) {
    try {
      await c.auth.signOut({ scope: "local" });
    } catch {
      // closing is best effort
    }
  }
  console.log("--- cleanup ---");
  ids = everIds();
  try {
    const found = await scrubExtras(ids);
    console.log(`  name_moderation_log: ${found.renames}; per-IP and per-account rate limits: ${found.limits}`);
  } catch (e) {
    results.push({ name: "cleanup extras", ok: false, error: (e as Error).message });
    console.log(`FAIL cleanup extras: ${(e as Error).message}`);
  }
  await cleanup(PKG);
  await check(PKG);
  // What check doesn't look for: the rename log and the rate-limit rows.
  try {
    const left = await scrubExtras(ids);
    if (left.renames || left.limits) throw new Error(`left behind: ${left.renames} renames, ${left.limits} rate-limit rows`);
  } catch (e) {
    results.push({ name: "nothing left", ok: false, error: (e as Error).message });
    console.log(`FAIL nothing left: ${(e as Error).message}`);
  }
  // This run never writes class_settings; say so if anything changed it.
  try {
    const { data: s } = await admin.from("class_settings").select("classes_visible, joins_paused").eq("id", true).single();
    if (settingsAtStart) assert.deepEqual(s, settingsAtStart, "class_settings changed during the run");
    console.log(`class_settings: classes_visible ${s?.classes_visible}, joins_paused ${s?.joins_paused}`);
  } catch (e) {
    results.push({ name: "class_settings unchanged", ok: false, error: (e as Error).message });
    console.log(`FAIL class_settings unchanged: ${(e as Error).message}`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : (process.exitCode ?? 0));
}
