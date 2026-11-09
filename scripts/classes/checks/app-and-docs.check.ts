// The app-and-docs package's checks (classes-design.md 15.2): GET /api/app/classes
// over HTTP against a running dev server in this worktree, on production with
// throwaway lftest accounts, plus report and block on a row through the
// existing /api/app/reports and /api/app/blocks routes, sent exactly as the app
// sends them. Everything it makes is deleted at the end (test-data.mjs cleanup).
//
//   # a dev server with the classes switches on (make-env.sh's .env.local):
//   taskpolicy -b nice -n 20 npx next dev -p 3110
//   node --import ./scripts/classes/register.mjs scripts/classes/checks/app-and-docs.check.ts
//
//   # a dev server with them off (CLASSES_DEV_SWITCHES=0 in the environment
//   # wins over .env.local, and production's class_settings row is hidden):
//   CLASSES_DEV_SWITCHES=0 taskpolicy -b nice -n 20 npx next dev -p 3110
//   node --import ./scripts/classes/register.mjs scripts/classes/checks/app-and-docs.check.ts --hidden
//
// APP_BASE overrides the server (default http://localhost:3110). The route's
// fields are also compared, key for key, with the example in apple/docs/API.md,
// so the docs can't drift from the code.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnv, repoRoot } from "../env.mjs";
import { create, cleanup, check, readCredentials } from "../test-data.mjs";

loadEnv();

const PKG = "app-and-docs";
const BASE = (process.env.APP_BASE || "http://localhost:3110").replace(/\/$/, "");
const HIDDEN = process.argv.includes("--hidden");

const results: { name: string; ok: boolean; pending?: boolean; error?: string }[] = [];
async function step(name: string, fn: () => Promise<void | "pending">) {
  try {
    const r = await fn();
    if (r === "pending") {
      results.push({ name, ok: true, pending: true });
      console.log(`wait ${name}`);
    } else {
      results.push({ name, ok: true });
      console.log(`ok   ${name}`);
    }
  } catch (e) {
    results.push({ name, ok: false, error: (e as Error).message });
    console.log(`FAIL ${name}: ${(e as Error).message}`);
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Account = { id: string; email: string; password: string; username: string };
type Row = Record<string, unknown> & {
  id: string;
  teacher: { username: string } | null;
  enrolled: boolean | null;
  status: string;
};
type Feed = { visible: boolean; classes: Row[]; liveNow?: number; teachUrl?: string; version?: string };

const openClients: SupabaseClient[] = [];

async function token(a: Account): Promise<string> {
  const c = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await c.auth.signInWithPassword({ email: a.email, password: a.password });
  if (error || !data.session) throw new Error(`sign in ${a.username}: ${error?.message}`);
  openClients.push(c);
  return data.session.access_token;
}

/** What the app sends: the same headers APIClient puts on every request. */
function appHeaders(bearer?: string, json = false): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/json",
    "X-Client-Info": "learnfrc-apple/1.0",
    "X-LearnFRC-Client": "iOS app",
  };
  if (bearer) h.Authorization = `Bearer ${bearer}`;
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function feed(bearer?: string): Promise<{ res: Response; body: Feed; raw: string }> {
  const res = await fetch(`${BASE}/api/app/classes`, { headers: appHeaders(bearer) });
  const raw = await res.text();
  let body: Feed;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new Error(`not JSON (${res.status}): ${raw.slice(0, 200)}`);
  }
  return { res, body, raw };
}

async function newClass(title: string, teacherId: string, opts: { live?: boolean; lessonId?: string } = {}) {
  const starts = opts.live ? new Date(Date.now() - 5 * 60_000) : new Date(Date.now() + 180 * 60_000);
  const { data, error } = await admin
    .from("classes")
    .insert({
      teacher_id: teacherId,
      title,
      description: "A throwaway class for the app route's checks.",
      starts_at: starts.toISOString(),
      duration_minutes: 45,
      hard_end_at: new Date(starts.getTime() + 60 * 60_000).toISOString(),
      capacity: 15,
      status: opts.live ? "live" : "scheduled",
      rtk_app: "dev",
      lesson_id: opts.lessonId ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`class ${title}: ${error.message}`);
  return data.id as string;
}

/* ── The docs, field for field ─────────────────────────────────────── */

/** The JSON example under "### GET /api/app/classes" in apple/docs/API.md. */
function documentedExample(): Record<string, unknown> {
  const doc = readFileSync(join(repoRoot, "apple", "docs", "API.md"), "utf8");
  const start = doc.indexOf("### GET /api/app/classes");
  assert.ok(start >= 0, "API.md has a GET /api/app/classes section");
  const fence = doc.indexOf("```json", start);
  const end = doc.indexOf("```", fence + 7);
  assert.ok(fence > start && end > fence, "the section has a json example");
  return JSON.parse(doc.slice(fence + 7, end));
}

/** Every key path in a JSON value; arrays contribute their first element's paths. */
function keyPaths(v: unknown, prefix = ""): string[] {
  if (Array.isArray(v)) return v.length ? keyPaths(v[0], `${prefix}[]`) : [`${prefix}[]`];
  if (v && typeof v === "object") {
    const out: string[] = [];
    for (const [k, child] of Object.entries(v)) {
      const p = prefix ? `${prefix}.${k}` : k;
      out.push(p);
      // A null in either value has no shape to compare (teacher, topic).
      if (child !== null) out.push(...keyPaths(child, p));
    }
    return out;
  }
  return [];
}

/* ── Visible ───────────────────────────────────────────────────────── */

async function visibleChecks() {
  await cleanup(PKG); // a clean start if an earlier run stopped halfway
  await create(PKG, [
    "t1:age=16:parent=agreed:teacher",
    "t2:age=17:parent=agreed:teacher",
    "t3:age=15:parent=agreed:teacher",
    "s1:age=14:parent=agreed",
  ]);
  const acc = readCredentials(PKG).accounts as Record<string, Account>;

  const { data: lesson } = await admin.from("lessons").select("id, slug").limit(1).single();
  const a = await newClass("lftest app-and-docs A", acc.t1.id, { lessonId: lesson?.id as string });
  const b = await newClass("lftest app-and-docs B", acc.t2.id);
  const c = await newClass("lftest app-and-docs C", acc.t3.id);
  const live = await newClass("lftest app-and-docs live", acc.t1.id, { live: true });
  const ours = new Set([a, b, c, live]);
  const mine = (f: Feed) => f.classes.filter((r) => ours.has(r.id));
  const s1 = await token(acc.s1);
  const t3 = await token(acc.t3);

  await step("signed out: public, cached 60 s, Vary Authorization, no handles", async () => {
    const { res, body, raw } = await feed();
    assert.equal(res.status, 200);
    const cc = res.headers.get("cache-control") ?? "";
    assert.match(cc, /public/, cc);
    assert.match(cc, /s-maxage=60/, cc);
    assert.match(res.headers.get("vary") ?? "", /authorization/i);
    assert.equal(body.visible, true);
    const rows = mine(body);
    assert.equal(rows.length, 4, `our 4 classes listed (got ${rows.length})`);
    for (const r of body.classes) {
      assert.equal(r.teacher, null, "teacher is null signed out");
      assert.equal(r.enrolled, null, "enrolled is null signed out");
      assert.equal(r.teacherLabel, "Taught by an FRC student");
    }
    for (const who of Object.values(acc)) assert.ok(!raw.includes(who.username), `no ${who.username} in the body`);
    assert.ok(!JSON.stringify(rows).includes('"@'), "no @handle in our rows");
    assert.ok((body.liveNow ?? 0) >= 1, "liveNow counts the live class");
    assert.equal(body.teachUrl, `${BASE}/apply/teach`);
    assert.equal(body.version, "1");
    const liveRow = rows.find((r) => r.id === live)!;
    assert.equal(liveRow.status, "live");
    const rowA = rows.find((r) => r.id === a)!;
    assert.equal(rowA.url, `${BASE}/classes/${a}`);
    assert.deepEqual(rowA.seats, { capacity: 15, taken: 0, left: 15 });
    assert.equal(rowA.durationMinutes, 45);
    assert.equal(
      Date.parse(rowA.endsAt as string) - Date.parse(rowA.startsAt as string),
      45 * 60_000,
      "endsAt is the scheduled end"
    );
    const topic = rowA.topic as { kind: string; url: string } | null;
    assert.ok(topic && topic.kind === "lesson" && topic.url.startsWith(`${BASE}/guides/`), "lesson topic with a site URL");
    // Soonest first.
    const starts = body.classes.map((r) => Date.parse(r.startsAt as string));
    assert.deepEqual(starts, [...starts].sort((x, y) => x - y));
  });

  await step("a token that's sent but invalid gets 401", async () => {
    const { res, body } = await feed("not-a-real-token");
    assert.equal(res.status, 401);
    assert.equal((body as unknown as { code: string }).code, "unauthorized");
    assert.match(res.headers.get("cache-control") ?? "", /no-store/);
  });

  await step("with a Bearer: no-store, the teacher's username, enrolled", async () => {
    const ok = await admin.rpc("class_enroll", { p_class_id: a, p_user_id: acc.s1.id });
    assert.equal(ok.data, "ok", `enroll s1 in A: ${ok.error?.message ?? ok.data}`);
    const { res, body } = await feed(s1);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("cache-control") ?? "", /no-store/);
    const rows = mine(body);
    assert.equal(rows.length, 4);
    const byId = new Map(rows.map((r) => [r.id, r]));
    assert.deepEqual(byId.get(a)!.teacher, { username: acc.t1.username });
    assert.deepEqual(byId.get(b)!.teacher, { username: acc.t2.username });
    assert.equal(byId.get(a)!.enrolled, true);
    assert.equal(byId.get(b)!.enrolled, false);
    assert.equal((byId.get(a)!.seats as { taken: number }).taken, 1);
  });

  await step("the route matches apple/docs/API.md field for field", async () => {
    const doc = keyPaths(documentedExample()).sort();
    const { body } = await feed(s1);
    const sample = { ...body, classes: mine(body).filter((r) => r.id === a) };
    const real = keyPaths(sample).sort();
    assert.deepEqual(real, doc);
    const hidden = keyPaths({ visible: false, classes: [] });
    assert.deepEqual(hidden.sort(), ["classes", "classes[]", "visible"]);
  });

  await step("Block @teacher on a row (POST /api/app/blocks) hides their classes", async () => {
    const res = await fetch(`${BASE}/api/app/blocks`, {
      method: "POST",
      headers: appHeaders(s1, true),
      body: JSON.stringify({ username: acc.t2.username }),
    });
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.block?.username, acc.t2.username);
    const { body: after } = await feed(s1);
    const ids = new Set(mine(after).map((r) => r.id));
    assert.ok(!ids.has(b), "the blocked teacher's class is gone");
    assert.ok(ids.has(a) && ids.has(c), "the others stay");
    const { body: anon } = await feed();
    assert.ok(mine(anon).some((r) => r.id === b), "the signed-out list is unchanged");
  });

  await step("a teacher who blocked the viewer is hidden too (blocked either way)", async () => {
    const res = await fetch(`${BASE}/api/app/blocks`, {
      method: "POST",
      headers: appHeaders(t3, true),
      body: JSON.stringify({ username: acc.s1.username }),
    });
    assert.equal(res.status, 200, await res.text());
    const { body } = await feed(s1);
    assert.ok(!mine(body).some((r) => r.id === c), "C is gone for s1");
  });

  await step("Unblock (DELETE /api/app/blocks/{username}) brings the class back", async () => {
    const res = await fetch(`${BASE}/api/app/blocks/${acc.t2.username}`, { method: "DELETE", headers: appHeaders(s1) });
    assert.equal(res.status, 200, await res.text());
    const { body } = await feed(s1);
    assert.ok(mine(body).some((r) => r.id === b), "B is back");
  });

  await step("Report this class (POST /api/app/reports, contentKind class)", async () => {
    // The body ReportRequest encodes for a class row.
    const res = await fetch(`${BASE}/api/app/reports`, {
      method: "POST",
      headers: appHeaders(s1, true),
      body: JSON.stringify({
        username: acc.t1.username,
        contentKind: "class",
        contentId: a,
        reason: "spam",
        details: "lftest report from the app-and-docs check",
        surface: "classes_list",
        platform: "ios",
      }),
    });
    const body = await res.json();
    if (res.status === 400 && body.error === "That request wasn't in the format we expected.") {
      // reports.ts learns "class" in the room-and-chat package (design 10.2);
      // until that merges, the shared function refuses the kind.
      return "pending";
    }
    assert.equal(res.status, 201, JSON.stringify(body));
    assert.equal(typeof body.message, "string");
    assert.equal(body.alreadyReported, false);
    const { data } = await admin
      .from("user_reports")
      .select("content_kind, content_id, surface, platform, reported_user_id")
      .eq("id", body.reportId)
      .single();
    assert.deepEqual(data, {
      content_kind: "class",
      content_id: a,
      surface: "classes_list",
      platform: "ios",
      reported_user_id: acc.t1.id,
    });
  });

  await step("a profile report from the app still files (unchanged body)", async () => {
    const res = await fetch(`${BASE}/api/app/reports`, {
      method: "POST",
      headers: appHeaders(s1, true),
      body: JSON.stringify({
        username: acc.t3.username,
        contentKind: "profile",
        reason: "spam",
        surface: "profile",
        platform: "ios",
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 201, JSON.stringify(body));
    assert.match(body.message, /isn't told who sent it/);
  });
}

/* ── Hidden ────────────────────────────────────────────────────────── */

async function hiddenChecks() {
  await cleanup(PKG);
  await create(PKG, ["s1:age=14:parent=agreed"]);
  const acc = readCredentials(PKG).accounts as Record<string, Account>;
  const s1 = await token(acc.s1);

  await step("hidden, signed out: { visible: false, classes: [] }, cached", async () => {
    const { res, body } = await feed();
    assert.equal(res.status, 200);
    assert.deepEqual(body, { visible: false, classes: [] });
    assert.match(res.headers.get("cache-control") ?? "", /s-maxage=60/);
  });

  await step("hidden, with a Bearer: { visible: false, classes: [] }, no-store", async () => {
    const { res, body } = await feed(s1);
    assert.equal(res.status, 200);
    assert.deepEqual(body, { visible: false, classes: [] });
    assert.match(res.headers.get("cache-control") ?? "", /no-store/);
  });
}

try {
  if (HIDDEN) await hiddenChecks();
  else await visibleChecks();
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
  await cleanup(PKG);
  await check(PKG);
  const failed = results.filter((r) => !r.ok);
  const pending = results.filter((r) => r.pending);
  console.log(
    `\n${results.length - failed.length}/${results.length} passed` +
      (pending.length ? ` (${pending.length} waiting on another package: ${pending.map((p) => p.name).join("; ")})` : "")
  );
  process.exit(failed.length ? 1 : (process.exitCode ?? 0));
}
