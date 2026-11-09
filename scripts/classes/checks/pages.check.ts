// The pages package's checks against production with throwaway accounts
// (classes-design.md 15.2, the "pages" row):
//   - every scheduling refusal holds without keys and runs before any
//     RealtimeKit call: not a teacher, suspended, an old code, not ready,
//     too soon, too far, overlap, a 5th upcoming class, the site-wide cap,
//     profanity, contact details in the title, description or bio;
//   - without keys, classesConfigured() is false and scheduling refuses
//     politely, saving nothing;
//   - with a recorded RealtimeKit double standing in for Cloudflare, a first
//     class schedules like any other (15 seats, no host step), stores
//     rtk_app 'dev' and the meeting id, and Jahaan's FYI marks it;
//   - enroll, leave, full and the student bio rule on a class it scheduled,
//     and the enrollment email only when CLASSES_ENROLL_EMAILS=1;
//   - cancelClass and cancelTeacherClasses, with one email per student;
//   - with PAGES_DEV_URL set to a running dev server (CLASSES_DEV_SWITCHES=1):
//     signed out the HTML has no handle; signed in it shows the teacher's
//     handle and hides classes by blocked teachers.
// Everything it makes is deleted at the end (test-data.mjs cleanup pages).
//
//   PAGES_DEV_URL=http://localhost:3418 \
//   node --import ./scripts/classes/register.mjs scripts/classes/checks/pages.check.ts

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { devDir, loadEnv } from "../env.mjs";
import { create, cleanup, check, readCredentials } from "../test-data.mjs";

loadEnv();
process.env.CLASSES_DEV_SWITCHES = "1";
delete process.env.VERCEL_ENV;
delete process.env.CLASSES_ENROLL_EMAILS;
const DEV_URL = (process.env.PAGES_DEV_URL || "").replace(/\/$/, "");

// Cloudflare keys aren't in yet, so RealtimeKit is swapped for a recorded
// double (scripts/classes/checks/doubles). getTeacher is the real one
// (teachers) since integration.
const HERE = fileURLToPath(new URL(".", import.meta.url));
const DOUBLES: Record<string, string> = {
  "@/lib/classes/realtimekit": pathToFileURL(join(HERE, "doubles", "realtimekit.ts")).href,
};
// module.registerHooks is newer than this repo's @types/node.
type Resolved = { url: string; shortCircuit?: boolean };
const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: {
    resolve: (specifier: string, context: unknown, next: (s: string, c: unknown) => Resolved) => Resolved;
  }) => void;
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    const url = DOUBLES[specifier];
    if (url) return { url, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const PKG = "pages";
const results: { name: string; ok: boolean; error?: string }[] = [];
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`ok   ${name}`);
  } catch (e) {
    results.push({ name, ok: false, error: (e as Error).message });
    console.log(`FAIL ${name}: ${(e as Error).message}`);
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Account = { id: string; email: string; password: string; username: string | null };
const MIN = 60_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Pretend the Cloudflare keys are in (the double answers), or take them away. */
const FAKE_KEYS = {
  CLOUDFLARE_ACCOUNT_ID: "lftest-account",
  CLOUDFLARE_REALTIMEKIT_API_TOKEN: "lftest-token",
  CLOUDFLARE_REALTIMEKIT_APP_ID_DEV: "lftest-dev-app",
};
const realKeys = Object.fromEntries(Object.keys(FAKE_KEYS).map((k) => [k, process.env[k]]));
function keys(on: boolean) {
  for (const [k, v] of Object.entries(FAKE_KEYS)) {
    if (on) process.env[k] = v;
    else if (realKeys[k] === undefined) delete process.env[k];
    else process.env[k] = realKeys[k];
  }
}

function outbox(): { to: string[]; subject: string; html: string }[] {
  const dir = join(devDir(), "outbox", PKG);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
}

async function insertClass(teacherId: string, title: string, startsAt: Date, minutes = 60, capacity = 15) {
  const { data, error } = await admin
    .from("classes")
    .insert({
      teacher_id: teacherId,
      title,
      starts_at: startsAt.toISOString(),
      duration_minutes: minutes,
      hard_end_at: new Date(startsAt.getTime() + (minutes + 15) * MIN).toISOString(),
      capacity,
      rtk_app: "dev",
    })
    .select("id")
    .single();
  if (error) throw new Error(`class ${title}: ${error.message}`);
  return data.id as string;
}

/** A Cookie header for a signed-in session, made the way @supabase/ssr makes it. */
async function sessionCookie(a: Account): Promise<string> {
  const jar: { name: string; value: string }[] = [];
  const c = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => jar,
      setAll: (set) => {
        for (const s of set) {
          const i = jar.findIndex((x) => x.name === s.name);
          if (i >= 0) jar.splice(i, 1);
          if (s.value) jar.push({ name: s.name, value: s.value });
        }
      },
    },
  });
  const { error } = await c.auth.signInWithPassword({ email: a.email, password: a.password });
  if (error) throw new Error(`sign in ${a.username}: ${error.message}`);
  return jar.map((x) => `${x.name}=${x.value}`).join("; ");
}

async function get(path: string, cookie?: string) {
  const res = await fetch(`${DEV_URL}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
    signal: AbortSignal.timeout(240_000),
  });
  return { status: res.status, location: res.headers.get("location"), html: await res.text() };
}

async function main() {
  await cleanup(PKG); // a clean start if an earlier run stopped halfway
  await create(PKG, [
    "t1:age=16:parent=agreed:teacher",
    "t2:age=15:parent=agreed:teacher:bio=add%20me%20on%20snap%20jake22",
    "t3:age=16:parent=agreed:teacher",
    "t4:age=16:parent=agreed:teacher",
    "t5:age=16:parent=agreed:teacher",
    "t6:age=16:parent=agreed:teacher",
    "t7:age=16:parent=sent:teacher",
    "t8:age=16:parent=agreed:teacher",
    "t9:age=16:parent=agreed:teacher",
    "nt:age=16:parent=agreed",
    "s1:age=14:parent=agreed",
    "s2:age=15:parent=agreed",
    "s3:age=14:parent=agreed",
    "sbio:age=15:parent=agreed:bio=dm%20me%20on%20discord",
    "blk:age=15:parent=agreed",
    "blkd:age=15:parent=agreed",
  ]);
  const acc = readCredentials(PKG).accounts as Record<string, Account>;
  const user = (k: string) => ({ id: acc[k].id, email: acc[k].email, created_at: new Date().toISOString() });

  await admin.from("class_teachers").update({ suspended_at: new Date().toISOString(), suspended_reason: "lftest" }).eq("user_id", acc.t8.id);
  await admin.from("class_teachers").update({ code_version: "2020-01-01" }).eq("user_id", acc.t9.id);

  const teaching = await import("../../../src/lib/app/classes-teaching.ts");
  const classes = await import("../../../src/lib/app/classes.ts");
  const schedule = await import("../../../src/lib/classes/schedule.ts");
  const emails = await import("../../../src/lib/classes/emails-enroll.ts");
  const rtk = (await import("./doubles/realtimekit.ts")) as { rtkCalls: () => { fn: string; args: unknown[] }[] };
  const S = schedule.SCHEDULE_SENTENCES;

  const { data: lesson } = await admin.from("lessons").select("id, title").limit(1).single();
  const { data: mod } = await admin.from("modules").select("id, title").limit(1).single();
  const now = Date.now();
  // Odd minutes far out, so other packages' test classes don't share the slot.
  const base = new Date(Math.ceil((now + 9 * 86_400_000) / MIN) * MIN + 17 * MIN);
  const at = (mins: number) => new Date(base.getTime() + mins * MIN).toISOString();
  const valid = (patch: Record<string, unknown> = {}) => ({
    title: "lftest pages class",
    description: "Bring questions. The docs are at https://docs.wpilib.org/en/stable/ if you want to read ahead.",
    lessonId: lesson!.id as string,
    startsAt: at(0),
    durationMinutes: 60,
    capacity: 15,
    ...patch,
  });
  const meetingsCreated = () => rtk.rtkCalls().filter((c) => c.fn === "createMeeting").length;

  // ── Refusals, with the keys "in", so only order keeps RealtimeKit out ──
  keys(true);
  delete process.env.CLASSES_DEV_ALLOW_SOON;

  const t1Classes = [
    await insertClass(acc.t1.id, "lftest pages t1 a", new Date(at(24 * 60))),
    await insertClass(acc.t1.id, "lftest pages t1 b", new Date(at(2 * 24 * 60))),
    await insertClass(acc.t1.id, "lftest pages t1 c", new Date(at(3 * 24 * 60))),
  ];
  const capSlot = at(5 * 24 * 60 + 7);
  for (const k of ["t4", "t5", "t6"]) await insertClass(acc[k].id, `lftest pages cap ${k}`, new Date(capSlot));

  const refusals: [string, string, Record<string, unknown>, string][] = [
    ["not a teacher", "nt", {}, S.notTeacher],
    ["suspended teacher", "t8", {}, S.suspended],
    ["old teacher code", "t9", {}, S.codeUpdate],
    ["teacher still waiting on a parent", "t7", {}, classes.CLASS_SENTENCES.waitingParent],
    ["too soon", "t3", { startsAt: new Date(now + 90 * MIN).toISOString() }, S.tooSoon],
    ["too far", "t3", { startsAt: new Date(now + 31 * 86_400_000).toISOString() }, S.tooFar],
    ["in the past", "t3", { startsAt: new Date(now - 10 * MIN).toISOString() }, S.tooSoon],
    ["profanity in the title", "t3", { title: "lftest pages fucking motors" }, S.profaneTitle],
    ["profanity in the description", "t3", { description: "this shit is hard" }, S.profaneDescription],
    ["contact details in the title", "t3", { title: "lftest pages add me on discord" }, S.contactTitle],
    ["an email in the description", "t3", { description: "questions to jake22@gmail.com" }, S.contactDescription],
    ["a link off the allowlist", "t3", { description: "slides at https://bit.ly/abc123" }, S.contactDescription],
    ["contact details in the bio", "t2", {}, S.bio],
    ["overlap with your own class", "t1", { startsAt: at(24 * 60 + 70) }, S.overlap],
    ["a missing topic", "t3", { lessonId: null }, S.topic],
    ["a topic that isn't there", "t3", { lessonId: "00000000-0000-4000-8000-000000000000" }, S.topicMissing],
    ["a 16th seat", "t3", { capacity: 16 }, S.capacity],
    ["the site-wide cap", "t3", { startsAt: capSlot }, S.siteFull],
  ];
  for (const [name, who, patch, sentence] of refusals) {
    await step(`refused before RealtimeKit: ${name}`, async () => {
      const before = meetingsCreated();
      const r = await teaching.scheduleClass(user(who), valid(patch) as never);
      assert.equal(r.ok, false, `${name} was scheduled`);
      if (!r.ok) assert.equal(r.error, sentence);
      assert.equal(meetingsCreated(), before, "a RealtimeKit meeting was made");
    });
  }

  await step("refused before RealtimeKit: a 5th upcoming class", async () => {
    await insertClass(acc.t1.id, "lftest pages t1 d", new Date(at(4 * 24 * 60)));
    const before = meetingsCreated();
    const r = await teaching.scheduleClass(user("t1"), valid({ startsAt: at(6 * 24 * 60) }) as never);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error, S.tooMany);
    assert.equal(meetingsCreated(), before);
  });

  await step("without keys, scheduling refuses politely and saves nothing", async () => {
    keys(false);
    try {
      const r = await teaching.scheduleClass(user("t3"), valid({ title: "lftest pages no keys" }) as never);
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.error, S.notConfigured);
      const { count } = await admin
        .from("classes")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", acc.t3.id);
      assert.equal(count, 0);
    } finally {
      keys(true);
    }
  });

  // ── The success path, with the RealtimeKit double ───────────────────
  let firstId = "";
  let smallId = "";
  await step("a first class schedules like any other: 15 seats, no host step, rtk_app dev", async () => {
    const before = meetingsCreated();
    const r = await teaching.scheduleClass(
      user("t3"),
      valid({ title: "  lftest pages   first class  ", startsAt: at(90), capacity: 15 }) as never
    );
    assert.equal(r.ok, true, r.ok ? "" : r.error);
    if (!r.ok) return;
    firstId = r.classId;
    assert.equal(meetingsCreated(), before + 1);
    const cfg = rtk.rtkCalls().filter((c) => c.fn === "createMeeting").at(-1)!.args[0] as {
      title: string;
      record_on_start: boolean;
      recording_config: { max_seconds: number; file_name_prefix: string };
      ai_config: { transcription: { keywords: string[] } };
    };
    assert.equal(cfg.title, `LearnFRC class ${firstId}`, "the meeting title carries no class title or handle");
    assert.equal(cfg.record_on_start, true);
    assert.equal(cfg.recording_config.max_seconds, (60 + 45) * 60);
    assert.equal(cfg.recording_config.file_name_prefix, firstId);
    const { data: row } = await admin.from("classes").select("*").eq("id", firstId).single();
    assert.equal(row!.title, "lftest pages first class");
    assert.equal(row!.capacity, 15);
    assert.equal(row!.rtk_app, "dev");
    assert.equal(row!.status, "scheduled");
    assert.match(row!.rtk_meeting_id, /^lftest-meeting-/);
    assert.equal(row!.lesson_id, lesson!.id);
    assert.equal(Date.parse(row!.hard_end_at) - Date.parse(row!.starts_at), 75 * MIN);
    const { data: ev } = await admin.from("class_events").select("kind, detail, actor_id").eq("class_id", firstId);
    assert.equal(ev?.length, 1);
    assert.equal(ev![0].kind, "scheduled");
    assert.equal((ev![0].detail as { first_class: boolean }).first_class, true);
    const fyi = outbox().filter((m) => m.subject.includes("lftest pages first class"));
    assert.equal(fyi.length, 1, "one FYI");
    assert.deepEqual(fyi[0].to, [process.env.ADMIN_EMAILS!.split(",")[0]]);
    assert.ok(fyi[0].subject.startsWith("[First class] "), fyi[0].subject);
    assert.ok(fyi[0].html.includes("@lftest_pages_t3"));
    assert.ok(!fyi[0].html.includes("\u2014"), "no em dash");
  });

  await step("a later class isn't marked first, and a whole module works", async () => {
    const r = await teaching.scheduleClass(
      user("t3"),
      valid({ title: "lftest pages small class", lessonId: null, moduleId: mod!.id, startsAt: at(200), durationMinutes: 30, capacity: 2 }) as never
    );
    assert.equal(r.ok, true, r.ok ? "" : r.error);
    if (!r.ok) return;
    smallId = r.classId;
    const { data: row } = await admin.from("classes").select("module_id, lesson_id, capacity").eq("id", smallId).single();
    assert.deepEqual(row, { module_id: mod!.id, lesson_id: null, capacity: 2 });
    const fyi = outbox().find((m) => m.subject.includes("lftest pages small class"));
    assert.ok(fyi, "FYI sent");
    assert.ok(!fyi!.subject.startsWith("[First class]"), fyi!.subject);
  });

  let soonId = "";
  await step("CLASSES_DEV_ALLOW_SOON lets a dev server schedule minutes ahead", async () => {
    process.env.CLASSES_DEV_ALLOW_SOON = "1";
    try {
      const r = await teaching.scheduleClass(
        user("t3"),
        valid({ title: "lftest pages soon class", startsAt: new Date(Date.now() + 20 * MIN).toISOString(), durationMinutes: 15 }) as never
      );
      assert.equal(r.ok, true, r.ok ? "" : r.error);
      if (r.ok) soonId = r.classId;
    } finally {
      delete process.env.CLASSES_DEV_ALLOW_SOON;
    }
  });

  // ── Enroll, leave, full, the bio rule ───────────────────────────────
  await step("enroll, full, leave and the student bio rule", async () => {
    assert.deepEqual(await classes.enrollInClass(user("s1"), { classId: smallId }), { ok: true, status: "enrolled" });
    assert.deepEqual(await classes.enrollInClass(user("s2"), { classId: smallId }), { ok: true, status: "enrolled" });
    const full = await classes.enrollInClass(user("s3"), { classId: smallId });
    assert.equal(full.ok, false);
    if (!full.ok) assert.equal(full.error, classes.CLASS_SENTENCES.full);
    const bio = await classes.enrollInClass(user("sbio"), { classId: firstId });
    assert.equal(bio.ok, false);
    if (!bio.ok) assert.equal(bio.error, classes.CLASS_SENTENCES.bio);
    assert.deepEqual(await classes.leaveClass(user("s1"), { classId: smallId }), { ok: true });
    assert.deepEqual(await classes.enrollInClass(user("s3"), { classId: smallId }), { ok: true, status: "enrolled" });
    const d = await classes.getClassDetail(smallId, user("s3"));
    assert.deepEqual(d?.seats, { capacity: 2, taken: 2, left: 0 });
    assert.equal(d?.enrollment, "enrolled");
    const own = await classes.enrollInClass(user("t3"), { classId: smallId });
    assert.equal(own.ok, false);
  });

  await step("the enrollment email goes out only with CLASSES_ENROLL_EMAILS=1", async () => {
    const mine = () => outbox().filter((m) => m.to.includes(acc.s1.email) && m.subject.startsWith("You're in"));
    await emails.confirmEnrollment(user("s1"), firstId);
    assert.equal(mine().length, 0);
    process.env.CLASSES_ENROLL_EMAILS = "1";
    try {
      await emails.confirmEnrollment(user("s1"), firstId);
    } finally {
      delete process.env.CLASSES_ENROLL_EMAILS;
    }
    assert.equal(mine().length, 1);
    assert.ok(mine()[0].html.includes("lftest pages first class"));
  });

  await step("the teaching desk lists upcoming classes with counts", async () => {
    const desk = await teaching.loadTeachingDesk(user("t3"));
    assert.equal(desk.visible, true);
    assert.equal(desk.isTeacher, true);
    assert.deepEqual(desk.canSchedule, { ok: true });
    const small = desk.upcoming.find((c) => c.id === smallId);
    assert.equal(small?.enrolled, 2);
    assert.deepEqual(desk.upcoming.map((c) => c.id), [soonId, firstId, smallId], "soonest first");
    assert.equal(desk.slotsLeft, 1);
    const nt = await teaching.loadTeachingDesk(user("nt"));
    assert.equal(nt.isTeacher, false);
    assert.equal(nt.canSchedule.ok, false);
    const t9 = await teaching.loadTeachingDesk(user("t9"));
    assert.ok(!t9.canSchedule.ok && t9.canSchedule.next === "apply");
  });

  // ── The pages, through a dev server ─────────────────────────────────
  if (DEV_URL) {
    await admin.from("user_blocks").insert([
      { blocker_id: acc.blk.id, blocked_id: acc.t3.id },
      { blocker_id: acc.t3.id, blocked_id: acc.blkd.id },
    ]);
    const cookies: Record<string, string> = {};
    for (const k of ["s1", "blk", "blkd", "t3"]) cookies[k] = await sessionCookie(acc[k]);

    await step("http: signed out, /classes and the class page carry no handle", async () => {
      const list = await get("/classes");
      assert.equal(list.status, 200);
      assert.ok(list.html.includes("lftest pages first class"), "class listed");
      assert.ok(list.html.includes("Taught by an FRC student"));
      assert.ok(!list.html.includes("lftest_pages_"), "a handle leaked into /classes");
      assert.ok(!/@lftest/i.test(list.html));
      const page = await get(`/classes/${firstId}`);
      assert.equal(page.status, 200);
      assert.ok(page.html.includes("lftest pages first class"));
      assert.ok(!page.html.includes("lftest_pages_"), "a handle leaked into the class page");
      assert.ok(page.html.includes("Sign in to sign up"));
      assert.ok(page.html.includes("noindex"), "class pages aren't indexed");
    });

    await step("http: signed in, the teacher's handle shows", async () => {
      const list = await get("/classes", cookies.s1);
      assert.equal(list.status, 200);
      assert.ok(list.html.includes("@lftest_pages_t3"), "no handle signed in");
      const page = await get(`/classes/${smallId}`, cookies.s1);
      assert.ok(page.html.includes("@lftest_pages_t3"));
      assert.ok(page.html.includes("Sign up for this class") || page.html.includes("This class is full."));
      const mine = await get(`/classes/${smallId}`, await sessionCookie(acc.s2));
      assert.ok(mine.html.includes("you&rsquo;re in") || mine.html.includes("you’re in"), "enrolled view");
      assert.ok(mine.html.includes("Leave this class"));
    });

    await step("http: classes by a teacher blocked either way are hidden", async () => {
      for (const k of ["blk", "blkd"]) {
        const list = await get("/classes", cookies[k]);
        assert.equal(list.status, 200);
        assert.ok(!list.html.includes("lftest pages first class"), `${k} still sees the class`);
        assert.ok(!list.html.includes("lftest_pages_t3"), `${k} sees the handle`);
        const page = await get(`/classes/${firstId}`, cookies[k]);
        assert.ok(page.html.includes("You can&#x27;t join this class.") || page.html.includes("You can't join this class."), `${k} page`);
        assert.ok(!page.html.includes("@lftest_pages_t3"), `${k} sees the handle on the page`);
      }
    });

    await step("http: the teaching page needs a session; unknown classes are 404", async () => {
      const out = await get("/classes/teaching");
      assert.equal(out.status, 307);
      assert.ok(out.location?.includes("/login?next=/classes/teaching"), out.location ?? "");
      const signedIn = await get("/classes/teaching", cookies.t3);
      assert.equal(signedIn.status, 200);
      assert.ok(signedIn.html.includes("Your classes"));
      assert.equal((await get("/classes/00000000-0000-4000-8000-000000000000")).status, 404);
      assert.equal((await get("/classes/not-a-class")).status, 404);
    });
  } else {
    console.log("skip http checks (set PAGES_DEV_URL to a running dev server)");
  }

  // ── Cancel ──────────────────────────────────────────────────────────
  await step("cancelClass: only the teacher or staff; students get one email each", async () => {
    const no = await teaching.cancelClass(user("s3"), { classId: smallId, reason: "" });
    assert.equal(no.ok, false);
    const before = outbox().length;
    const r = await teaching.cancelClass(user("t3"), { classId: smallId, reason: "" });
    assert.deepEqual(r, { ok: true });
    const { data: row } = await admin.from("classes").select("status, canceled_by, canceled_at").eq("id", smallId).single();
    assert.equal(row!.status, "canceled");
    assert.equal(row!.canceled_by, acc.t3.id);
    const mail = outbox().slice(before).filter((m) => m.subject === "Class canceled: lftest pages small class");
    assert.equal(mail.length, 2, "one email per enrolled student");
    for (const m of mail) assert.equal(m.to.length, 1, "never a shared To line");
    assert.deepEqual(new Set(mail.map((m) => m.to[0])), new Set([acc.s2.email, acc.s3.email]));
    const inactive = rtk.rtkCalls().filter((c) => c.fn === "setMeetingStatus" && c.args[1] === "INACTIVE");
    assert.equal(inactive.length, 1, "the meeting was closed");
    assert.deepEqual(await teaching.cancelClass(user("t3"), { classId: smallId, reason: "" }), { ok: true });
    const listed = await classes.listUpcomingClasses({ viewer: user("s1") });
    assert.ok(!listed.classes.some((c) => c.id === smallId), "a canceled class isn't listed");
  });

  await step("cancelTeacherClasses cancels every upcoming class and never throws", async () => {
    const r = await teaching.cancelTeacherClasses(acc.t1.id, "lftest suspended");
    assert.equal(r.canceled, 4);
    const { data } = await admin.from("classes").select("status, cancel_reason").in("id", t1Classes);
    assert.ok(data!.every((c) => c.status === "canceled" && c.cancel_reason === "lftest suspended"));
    assert.deepEqual(await teaching.cancelTeacherClasses("not-a-uuid", "x"), { canceled: 0 });
  });

  await sleep(10);
}

try {
  await main();
} catch (e) {
  results.push({ name: "setup", ok: false, error: (e as Error).message });
  console.log(`FAIL setup: ${(e as Error).stack}`);
} finally {
  keys(false);
  console.log("--- cleanup ---");
  await cleanup(PKG);
  await check(PKG);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : (process.exitCode ?? 0));
}
