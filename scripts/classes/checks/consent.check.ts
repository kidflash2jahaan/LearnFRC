// The consent package's checks against production with throwaway accounts
// (classes-design.md 15.2, the "consent" row):
//   - the age screen: selects start empty, no cutoff text, a confirm step for
//     every answer, one answer only, 18+ gets `adult`;
//   - under 13: the account is deleted through deleteAccountData, the device
//     cookie is set, nothing else is stored, and a second account carrying
//     that cookie gets `device_blocked`;
//   - the parent email (read from the dev outbox) covers video recording,
//     usernames shown in class and the chat filter;
//   - its link sets the cookie and answers 303 to a clean URL (curl), works
//     once, and is refused once expires_at has passed;
//   - a same-network decision sets same_network; the student is emailed;
//   - the rate limits hold.
// Everything it makes is deleted at the end (test-data.mjs cleanup, plus the
// under13_deleted events and the class-consent-* rate-limit rows it caused).
//
//   node --import ./scripts/classes/register.mjs scripts/classes/checks/consent.check.ts
//
// The HTTP half needs this worktree's dev server (next dev -p 3104, with the
// .env.local from make-env.sh); without it those steps are reported skipped.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { devDir, loadEnv } from "../env.mjs";
import { create, cleanup, check, readCredentials } from "../test-data.mjs";

loadEnv();
process.env.CLASSES_DEV_SWITCHES = "1";
delete process.env.VERCEL_ENV;

const PKG = "consent";
const BASE = process.env.CONSENT_CHECK_BASE || "http://localhost:3104";
const results: { name: string; ok: boolean | "skipped"; error?: string }[] = [];
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`ok   ${name}`);
  } catch (e) {
    if ((e as Error).message === "SKIP") {
      results.push({ name, ok: "skipped" });
      console.log(`skip ${name} (no dev server at ${BASE})`);
      return;
    }
    results.push({ name, ok: false, error: (e as Error).message });
    console.log(`FAIL ${name}: ${(e as Error).message}`);
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Account = { id: string; email: string; password: string; username: string | null };

/* ── helpers ───────────────────────────────────────────────────────── */

const OUTBOX = process.env.EMAIL_DEV_OUTBOX || join(devDir(), "outbox", PKG);
type Mail = { to: string[]; subject: string; html: string; replyTo: string; file: string };
function outbox(): Mail[] {
  let files: string[] = [];
  try {
    files = readdirSync(OUTBOX).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }
  return files.map((f) => ({ ...JSON.parse(readFileSync(join(OUTBOX, f), "utf8")), file: f }));
}
function lastMailTo(addr: string): Mail {
  const m = outbox().filter((x) => x.to.map((t) => t.toLowerCase()).includes(addr.toLowerCase()));
  if (!m.length) throw new Error(`no mail to ${addr}`);
  return m[m.length - 1];
}
function tokenIn(mail: Mail): string {
  const m = /\/classes\/parent\/open\/([A-Za-z0-9_-]{43})"/.exec(mail.html);
  if (!m) throw new Error("no parent link in the email");
  return m[1];
}
/** Em and en dashes (copy never uses them). */
const DASHES = new RegExp(`[${String.fromCharCode(0x2014, 0x2013)}]`);

const textOf = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    // React's text-node separators, so "@{handle}" reads as one word.
    .replace(/<!-- -->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;|&rsquo;|’/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

/**
 * fetch with one retry: the dev server closes idle keep-alive sockets after a
 * few seconds, and Node's fetch can pick one up just as it closes.
 */
async function http(input: string, init: RequestInit = {}): Promise<Response> {
  const go = () => fetch(input, { signal: AbortSignal.timeout(180_000), ...init });
  try {
    return await go();
  } catch (e) {
    if ((e as Error).message !== "fetch failed") throw e;
    return go();
  }
}

let serverUp: boolean | null = null;
async function needServer() {
  if (serverUp === null) {
    try {
      const r = await http(`${BASE}/classes/parent`);
      serverUp = r.status === 200;
    } catch {
      serverUp = false;
    }
  }
  if (!serverUp) throw new Error("SKIP");
}

/** Signs a throwaway account in and returns its @supabase/ssr cookies. */
async function sessionCookie(a: Account): Promise<string> {
  const jar = new Map<string, string>();
  const c = createServerClient(url, anon, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error } = await c.auth.signInWithPassword({ email: a.email, password: a.password });
  if (error) throw new Error(`sign in ${a.username}: ${error.message}`);
  return [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
}

const decodeEntities = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/**
 * The hidden fields React renders on a server-action form (the no-JS path),
 * for the form that contains `marker`.
 */
function actionFields(html: string, marker: string): [string, string][] {
  let at = 0;
  while ((at = html.indexOf("<form", at)) >= 0) {
    const end = html.indexOf("</form>", at);
    const form = html.slice(at, end);
    if (form.includes(marker)) {
      const out: [string, string][] = [];
      for (const m of form.matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?\/>/g)) {
        out.push([m[1], decodeEntities(m[2] ?? "")]);
      }
      if (!out.length) throw new Error("form has no action fields");
      return out;
    }
    at = end;
  }
  throw new Error(`no form containing ${marker}`);
}

/** Submits a server-action form the way a browser without JavaScript does. */
async function postForm(
  path: string,
  fields: [string, string][],
  extra: Record<string, string>,
  headers: Record<string, string>
) {
  const body = () => {
    const b = new FormData();
    for (const [k, v] of fields) b.append(k, v);
    for (const [k, v] of Object.entries(extra)) b.append(k, v);
    return b;
  };
  const go = () =>
    fetch(`${BASE}${path}`, {
      method: "POST",
      body: body(),
      redirect: "manual",
      headers: { origin: BASE, ...headers },
      signal: AbortSignal.timeout(180_000),
    });
  try {
    return await go();
  } catch (e) {
    // Only a socket that closed before the request went out (see http()).
    if ((e as Error).message !== "fetch failed") throw e;
    return go();
  }
}

/** curl -sD -, for the 303 check (the acceptance says curl). */
function curlHead(path: string, cookie?: string): { status: number; headers: Record<string, string[]> } {
  const args = ["-s", "-o", "/dev/null", "-D", "-", "--max-time", "180", `${BASE}${path}`];
  if (cookie) args.unshift("-H", `Cookie: ${cookie}`);
  const out = execFileSync("curl", args, { encoding: "utf8" });
  const lines = out.split(/\r?\n/).filter(Boolean);
  const status = Number(/^HTTP\/[\d.]+ (\d+)/.exec(lines[0] ?? "")?.[1] ?? 0);
  const headers: Record<string, string[]> = {};
  for (const l of lines.slice(1)) {
    const i = l.indexOf(":");
    if (i < 0) continue;
    const k = l.slice(0, i).trim().toLowerCase();
    (headers[k] ??= []).push(l.slice(i + 1).trim());
  }
  return { status, headers };
}

/* ── main ──────────────────────────────────────────────────────────── */

async function main() {
  const t0 = new Date(Date.now() - 1000).toISOString();
  await cleanup(PKG); // a clean start if an earlier run stopped halfway
  await create(PKG, [
    "kid",
    "kidweb",
    "second",
    "adult",
    "teen",
    "teenweb",
    "nohandle:nousername",
    "adultp:age=19",
    "readyp:age=15:parent=agreed",
    "declp:age=15:parent=declined",
    "own:age=15",
    "p1:age=15",
    "p2:age=16",
    "p3:age=14",
    "p4:age=15",
    "r1:age=15",
    "r2:age=15",
    "r3:age=15",
    "r4:age=15",
    "r5:age=15",
  ]);
  const acc = readCredentials(PKG).accounts as Record<string, Account>;
  const user = (k: string) => ({ id: acc[k].id, email: acc[k].email, created_at: new Date().toISOString() });
  const clients = { supabase: admin, admin };
  const parentAddr = (k: string, n = 1) => `lftest-consent-parent-${k}-${n}@example.com`;

  const consent = await import("../../../src/lib/app/class-consent.ts");
  const classes = await import("../../../src/lib/app/classes.ts");
  const { birthMonthYearForAge } = await import("../../../src/lib/classes/age.ts");
  const { PARENT_REQUEST_SUBJECT } = await import("../../../src/lib/classes/emails-parent.ts");
  const S = consent.CONSENT_SENTENCES;
  const C = classes.CLASS_SENTENCES;
  const answer = (age: number) => {
    const b = birthMonthYearForAge(age);
    return { birthMonth: String(b.birthMonth), birthYear: String(b.birthYear), confirmed: "yes" };
  };
  const ageRow = async (id: string) =>
    (await admin.from("class_age_checks").select("birth_year").eq("user_id", id).maybeSingle()).data;
  const exists = async (id: string) => {
    const { data } = await admin.auth.admin.getUserById(id);
    return !!data?.user;
  };
  const under13Events = async () => {
    const { data, error } = await admin
      .from("class_events")
      .select("id, class_id, actor_id, detail")
      .eq("kind", "under13_deleted")
      .gte("created_at", t0);
    if (error) throw new Error(error.message);
    return data ?? [];
  };

  /* ── the age screen ──────────────────────────────────────────────── */

  await step("an answer needs the confirm step, a real month, and a username", async () => {
    const a = answer(15);
    let r = await consent.recordAgeCheck(user("teen"), clients, { ...a, confirmed: "" });
    assert.ok(!r.ok && r.error === S.confirmFirst, JSON.stringify(r));
    r = await consent.recordAgeCheck(user("teen"), clients, { birthMonth: "", birthYear: a.birthYear, confirmed: "yes" });
    assert.ok(!r.ok && r.error === S.pickBoth && r.field === "birth_month", JSON.stringify(r));
    const now = new Date();
    if (now.getUTCMonth() < 11) {
      r = await consent.recordAgeCheck(user("teen"), clients, {
        birthMonth: String(now.getUTCMonth() + 2),
        birthYear: String(now.getUTCFullYear()),
        confirmed: "yes",
      });
      assert.ok(!r.ok && r.error === S.notYet, JSON.stringify(r));
    }
    r = await consent.recordAgeCheck(user("nohandle"), clients, answer(15));
    assert.ok(!r.ok && r.error === C.needsHandle, JSON.stringify(r));
    assert.equal(await ageRow(acc.teen.id), null);
  });

  await step("13 to 17 is stored once; a second answer is refused and deletes nothing", async () => {
    const r = await consent.recordAgeCheck(user("teen"), clients, answer(15));
    assert.ok(r.ok && r.outcome === "parent", JSON.stringify(r));
    assert.equal(await classes.classEligibility(user("teen")), "needs_parent");
    const again = await consent.recordAgeCheck(user("teen"), clients, answer(16));
    assert.ok(!again.ok && again.error === S.alreadySaved, JSON.stringify(again));
    let marked = 0;
    const under = await consent.recordAgeCheck(user("teen"), clients, answer(11), {
      deviceBlocked: false,
      markDevice: () => void marked++,
    });
    assert.ok(!under.ok && under.error === S.alreadySaved, JSON.stringify(under));
    assert.equal(marked, 0, "no cookie for a refused answer");
    assert.ok(await exists(acc.teen.id), "the account is still there");
    assert.equal((await ageRow(acc.teen.id))?.birth_year, Number(answer(15).birthYear));
  });

  await step("18+ gets adult", async () => {
    const r = await consent.recordAgeCheck(user("adult"), clients, answer(18));
    assert.ok(r.ok && r.outcome === "adult", JSON.stringify(r));
    assert.equal(await classes.classEligibility(user("adult")), "adult");
  });

  await step("under 13 deletes the account through deleteAccountData, sets the cookie, stores nothing else", async () => {
    const before = (await under13Events()).length;
    const calls: string[] = [];
    const r = await consent.recordAgeCheck(user("kid"), clients, answer(12), {
      deviceBlocked: false,
      markDevice: () => void calls.push("u13"),
    });
    assert.ok(r.ok && r.outcome === "deleted", JSON.stringify(r));
    assert.deepEqual(calls, ["u13"]);
    assert.equal(await exists(acc.kid.id), false, "auth user gone");
    const { data: prof } = await admin.from("profiles").select("id").eq("id", acc.kid.id).maybeSingle();
    assert.equal(prof, null, "profile gone");
    assert.equal(await ageRow(acc.kid.id), null, "no age row");
    for (const [t, col] of [
      ["class_parent_consents", "student_handle"],
      ["class_consents", "user_handle"],
      ["class_safety_holds", "subject_handle"],
    ] as const) {
      const { count } = await admin
        .from(t)
        .select("*", { count: "exact", head: true })
        .eq(col, acc.kid.username as string);
      assert.equal(count, 0, `${t} has nothing for the account`);
    }
    const events = await under13Events();
    assert.equal(events.length, before + 1, "one under13_deleted event");
    const e = events[events.length - 1];
    assert.equal(e.actor_id, null);
    assert.equal(e.class_id, null);
    assert.deepEqual(e.detail, {});
  });

  await step("a second account carrying the cookie gets device_blocked and can't answer", async () => {
    assert.equal(await classes.classEligibility(user("second"), { deviceBlocked: true }), "device_blocked");
    const r = await consent.recordAgeCheck(user("second"), clients, answer(15), { deviceBlocked: true });
    assert.ok(!r.ok && r.error === C.deviceBlocked, JSON.stringify(r));
    assert.equal(await ageRow(acc.second.id), null);
  });

  /* ── the parent email ────────────────────────────────────────────── */

  await step("only needs_parent or waiting_parent can ask; bad and own addresses are refused", async () => {
    let r = await consent.requestParentOk(user("adultp"), { parentEmail: parentAddr("adultp") }, { ip: "192.0.2.1" });
    assert.ok(!r.ok && r.error === C.adult, JSON.stringify(r));
    r = await consent.requestParentOk(user("readyp"), { parentEmail: parentAddr("readyp") }, { ip: "192.0.2.1" });
    assert.ok(!r.ok && r.error === S.alreadyAgreed, JSON.stringify(r));
    r = await consent.requestParentOk(user("declp"), { parentEmail: parentAddr("declp") }, { ip: "192.0.2.1" });
    assert.ok(!r.ok && r.error === C.parentDeclined, JSON.stringify(r));
    r = await consent.requestParentOk(user("second"), { parentEmail: parentAddr("second") }, { ip: "192.0.2.1" });
    assert.ok(!r.ok && r.error === C.needsAge, JSON.stringify(r));
    r = await consent.requestParentOk(user("own"), { parentEmail: "not an email" }, { ip: "192.0.2.1" });
    assert.ok(!r.ok && r.error === S.emailInvalid, JSON.stringify(r));
    const own = acc.own.email.replace(/^lftest\+[^@]*/, "LFTEST+mom");
    r = await consent.requestParentOk(user("own"), { parentEmail: own }, { ip: "192.0.2.1" });
    assert.ok(!r.ok && r.error === S.ownEmail, JSON.stringify(r));
    const { count } = await admin
      .from("class_parent_consents")
      .select("*", { count: "exact", head: true })
      .in("student_id", [acc.adultp.id, acc.own.id, acc.second.id]);
    assert.equal(count, 0);
  });

  let ownFirstToken = "";
  await step("the email covers video recording, usernames in class and the chat filter", async () => {
    const r = await consent.requestParentOk(user("own"), { parentEmail: parentAddr("own").toUpperCase() }, { ip: "192.0.2.2" });
    assert.ok(r.ok && r.parentEmail === parentAddr("own"), JSON.stringify(r));
    assert.equal(await classes.classEligibility(user("own")), "waiting_parent");
    const mail = lastMailTo(parentAddr("own"));
    ownFirstToken = tokenIn(mail);
    assert.equal(mail.subject, PARENT_REQUEST_SUBJECT);
    assert.equal(mail.replyTo, "kidflash2jahaan@gmail.com", "the default reply-to, never the student's");
    const t = textOf(mail.html);
    for (const must of [
      `@${acc.own.username}`,
      "free, student-run",
      "aged 13 to 17",
      "recorded on video",
      "transcribed by Cloudflare",
      "Anthropic's Claude",
      "Dhiren Pardhanani",
      "sees each other's LearnFRC usernames",
      "Student cameras are off and can't be turned on",
      "no private messaging",
      "class chat blocks links, @handles, email addresses, phone numbers and usernames from other apps",
      "deleted after 7 days",
      "up to a year",
      "29pardhananij@sagehillschool.org",
      "Read it and decide",
    ]) {
      assert.ok(t.includes(must), `email mentions: ${must}`);
    }
    assert.ok(mail.html.includes(`${process.env.NEXT_PUBLIC_SITE_URL}/classes/parent/open/${ownFirstToken}`));
    assert.ok(!DASHES.test(mail.html), "no em or en dashes");
    assert.ok(!/\d{3}[-. )]\s?\d{3}[-. ]\d{4}/.test(t), "no phone numbers");
    const { data: row } = await admin
      .from("class_parent_consents")
      .select("token_hash, requested_ip_hash, parent_email, student_handle, notice_version, expires_at, sent_at")
      .eq("student_id", acc.own.id)
      .single();
    assert.ok(row, "the request row exists");
    assert.equal(row.token_hash, consent.hashParentToken(ownFirstToken), "only the hash is stored");
    assert.equal(row.requested_ip_hash, consent.classIpHash("192.0.2.2"));
    assert.equal(row.student_handle, acc.own.username);
    const days = (Date.parse(row.expires_at) - Date.parse(row.sent_at)) / 86_400_000;
    assert.ok(Math.abs(days - 14) < 0.01, `expires in 14 days (${days})`);
  });

  await step("the same address waits 24 hours; a new address replaces the old link", async () => {
    let r = await consent.requestParentOk(user("own"), { parentEmail: parentAddr("own") }, { ip: "192.0.2.2" });
    assert.ok(!r.ok && r.code === "conflict" && r.error.startsWith("We emailed that address recently"), JSON.stringify(r));
    r = await consent.requestParentOk(user("own"), { parentEmail: parentAddr("own", 2) }, { ip: "192.0.2.2" });
    assert.ok(r.ok, JSON.stringify(r));
    assert.equal(await consent.openParentLink(ownFirstToken, { ip: "192.0.2.2" }), "closed", "old link closed");
    const second = tokenIn(lastMailTo(parentAddr("own", 2)));
    assert.equal(await consent.openParentLink(second, { ip: "192.0.2.2" }), "open");
    const { data } = await admin
      .from("class_parent_consents")
      .select("status")
      .eq("student_id", acc.own.id)
      .order("sent_at", { ascending: true });
    assert.deepEqual(
      (data ?? []).map((x) => x.status),
      ["expired", "sent"]
    );
  });

  await step("rate limits hold: 3 a day per account, 10 a day per network", async () => {
    const ipA = "198.51.100.11";
    for (let n = 1; n <= 3; n++) {
      const r = await consent.requestParentOk(user("r1"), { parentEmail: parentAddr("r1", n) }, { ip: ipA });
      assert.ok(r.ok, `send ${n}: ${JSON.stringify(r)}`);
    }
    const r4 = await consent.requestParentOk(user("r1"), { parentEmail: parentAddr("r1", 4) }, { ip: ipA });
    assert.ok(!r4.ok && r4.code === "rate_limited" && r4.error === S.rateAccount, JSON.stringify(r4));

    const ipB = "198.51.100.22";
    let sent = 0;
    for (const k of ["r2", "r3", "r4"]) {
      for (let n = 1; n <= 3; n++) {
        const r = await consent.requestParentOk(user(k), { parentEmail: parentAddr(k, n) }, { ip: ipB });
        assert.ok(r.ok, `${k} send ${n}: ${JSON.stringify(r)}`);
        sent++;
      }
    }
    const tenth = await consent.requestParentOk(user("r5"), { parentEmail: parentAddr("r5", 1) }, { ip: ipB });
    assert.ok(tenth.ok, `tenth: ${JSON.stringify(tenth)}`);
    sent++;
    assert.equal(sent, 10);
    const eleventh = await consent.requestParentOk(user("r5"), { parentEmail: parentAddr("r5", 2) }, { ip: ipB });
    assert.ok(!eleventh.ok && eleventh.error === S.rateNetwork, JSON.stringify(eleventh));
  });

  await step("rate limits hold: age answers, link opens and decisions", async () => {
    // Age answers: 10 an hour per account. `adult` has answered, so each
    // try is refused as already saved until the limit takes over.
    for (let n = 1; n <= 9; n++) {
      const r = await consent.recordAgeCheck(user("adult"), clients, answer(18));
      assert.ok(!r.ok && r.error === S.alreadySaved, `try ${n}: ${JSON.stringify(r)}`);
    }
    const age = await consent.recordAgeCheck(user("adult"), clients, answer(18));
    assert.ok(!age.ok && age.code === "rate_limited", JSON.stringify(age));

    // Opening links: 60 an hour per network, so tokens can't be guessed.
    const ipOpen = "203.0.113.50";
    const fake = "A".repeat(43);
    for (let n = 1; n <= 60; n++) assert.equal(await consent.openParentLink(fake, { ip: ipOpen }), "closed");
    assert.equal(await consent.openParentLink(fake, { ip: ipOpen }), "busy");

    // Decisions: 20 an hour per network.
    const ipDecide = "203.0.113.51";
    for (let n = 1; n <= 20; n++) {
      const d = await consent.decideParentOk({ token: fake, decision: "decline", parentName: "" }, { ip: ipDecide });
      assert.ok(!d.ok && d.error === S.linkClosed, `try ${n}: ${JSON.stringify(d)}`);
    }
    const d21 = await consent.decideParentOk({ token: fake, decision: "decline", parentName: "" }, { ip: ipDecide });
    assert.ok(!d21.ok && d21.error === S.busy, JSON.stringify(d21));
  });

  /* ── the parent's side ───────────────────────────────────────────── */

  await step("a same-network decision sets same_network; it works once; the student is emailed", async () => {
    const ip = "192.0.2.10";
    const r = await consent.requestParentOk(user("p1"), { parentEmail: parentAddr("p1") }, { ip });
    assert.ok(r.ok, JSON.stringify(r));
    const token = tokenIn(lastMailTo(parentAddr("p1")));
    const view = await consent.loadParentRequest(token);
    assert.ok(view.open && view.studentHandle === acc.p1.username, JSON.stringify(view));

    let d = await consent.decideParentOk({ token, decision: "agree", parentName: "" }, { ip, userAgent: "lftest" });
    assert.ok(!d.ok && d.error === S.nameNeeded, JSON.stringify(d));
    d = await consent.decideParentOk({ token, decision: "agree", parentName: "<b>Mom</b>" }, { ip, userAgent: "lftest" });
    assert.ok(!d.ok && d.error === S.nameInvalid, JSON.stringify(d));
    d = await consent.decideParentOk({ token, decision: "maybe", parentName: "Lftest Parent" }, { ip, userAgent: "lftest" });
    assert.ok(!d.ok && d.error === S.pickDecision, JSON.stringify(d));

    d = await consent.decideParentOk(
      { token, decision: "agree", parentName: "  Lftest   Parent " },
      { ip, userAgent: "lftest-agent/1.0" }
    );
    assert.ok(d.ok && d.decision === "agree" && d.sameNetwork === true, JSON.stringify(d));
    const { data: row } = await admin
      .from("class_parent_consents")
      .select("status, parent_name, decided_at, decided_ip_hash, decided_user_agent, same_network")
      .eq("student_id", acc.p1.id)
      .single();
    assert.ok(row, "the request row exists");
    assert.equal(row.status, "agreed");
    assert.equal(row.parent_name, "Lftest Parent");
    assert.ok(row.decided_at);
    assert.equal(row.decided_ip_hash, consent.classIpHash(ip));
    assert.equal(row.decided_user_agent, "lftest-agent/1.0");
    assert.equal(row.same_network, true);
    assert.equal(await classes.classEligibility(user("p1")), "ready");

    const again = await consent.decideParentOk({ token, decision: "decline", parentName: "" }, { ip });
    assert.ok(!again.ok && again.error === S.linkClosed, JSON.stringify(again));
    assert.equal(await consent.openParentLink(token, { ip }), "closed");
    const mail = lastMailTo(acc.p1.email);
    assert.equal(mail.subject, "Live classes are open for you on LearnFRC");
    assert.ok(!DASHES.test(mail.html));
  });

  await step("a decline from another network: same_network false, parent_declined, student told", async () => {
    const r = await consent.requestParentOk(user("p2"), { parentEmail: parentAddr("p2") }, { ip: "192.0.2.20" });
    assert.ok(r.ok, JSON.stringify(r));
    const token = tokenIn(lastMailTo(parentAddr("p2")));
    const d = await consent.decideParentOk({ token, decision: "decline", parentName: "" }, { ip: "192.0.2.21" });
    assert.ok(d.ok && d.decision === "decline" && d.sameNetwork === false, JSON.stringify(d));
    const { data: row } = await admin
      .from("class_parent_consents")
      .select("status, parent_name, same_network")
      .eq("student_id", acc.p2.id)
      .single();
    assert.deepEqual(row, { status: "declined", parent_name: null, same_network: false });
    assert.equal(await classes.classEligibility(user("p2")), "parent_declined");
    const mail = lastMailTo(acc.p2.email);
    assert.equal(mail.subject, "About your live classes request on LearnFRC");
    // Declined: no new request from the student's side.
    const again = await consent.requestParentOk(user("p2"), { parentEmail: parentAddr("p2", 2) }, { ip: "192.0.2.20" });
    assert.ok(!again.ok && again.error === C.parentDeclined, JSON.stringify(again));
  });

  let expiredToken = "";
  await step("a link past expires_at is refused", async () => {
    const r = await consent.requestParentOk(user("p3"), { parentEmail: parentAddr("p3") }, { ip: "192.0.2.30" });
    assert.ok(r.ok, JSON.stringify(r));
    expiredToken = tokenIn(lastMailTo(parentAddr("p3")));
    assert.equal(await consent.openParentLink(expiredToken, { ip: "192.0.2.30" }), "open");
    // This run's own row: move its expiry into the past.
    const { error } = await admin
      .from("class_parent_consents")
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("student_id", acc.p3.id);
    if (error) throw new Error(error.message);
    assert.equal(await consent.openParentLink(expiredToken, { ip: "192.0.2.30" }), "closed");
    assert.deepEqual(await consent.loadParentRequest(expiredToken), { open: false });
    const d = await consent.decideParentOk(
      { token: expiredToken, decision: "agree", parentName: "Lftest Parent" },
      { ip: "192.0.2.30" }
    );
    assert.ok(!d.ok && d.error === S.linkClosed, JSON.stringify(d));
    assert.equal(await classes.classEligibility(user("p3")), "needs_parent");
    assert.equal(await consent.openParentLink("not-a-token", { ip: "192.0.2.30" }), "closed");
  });

  await step("the staff consent lookup and revoke stay closed until safety-holds builds requireClassReviewer", async () => {
    const l = await consent.listParentConsents(user("p1"), { handle: acc.p1.username });
    assert.ok(!l.ok && l.code === "forbidden", JSON.stringify(l));
    const r = await consent.revokeParentConsent(user("p1"), { consentId: acc.p1.id });
    assert.ok(!r.ok && r.code === "forbidden", JSON.stringify(r));
  });

  /* ── over HTTP, against the dev server ───────────────────────────── */

  await step("curl: the link answers 303 to a clean URL and sets an httpOnly cookie on /classes/parent", async () => {
    await needServer();
    const r = await consent.requestParentOk(user("p4"), { parentEmail: parentAddr("p4") }, { ip: "192.0.2.40" });
    assert.ok(r.ok, JSON.stringify(r));
    const token = tokenIn(lastMailTo(parentAddr("p4")));
    const h = curlHead(`/classes/parent/open/${token}`);
    assert.equal(h.status, 303);
    const loc = h.headers.location?.[0] ?? "";
    assert.equal(new URL(loc, BASE).pathname + new URL(loc, BASE).search, "/classes/parent", `location ${loc}`);
    assert.ok(!loc.includes(token), "the token isn't in the redirect");
    const cookie = (h.headers["set-cookie"] ?? []).find((c) => c.startsWith("lf_parent="));
    assert.ok(cookie, "sets lf_parent");
    assert.ok(cookie.startsWith(`lf_parent=${token};`));
    assert.match(cookie, /Path=\/classes\/parent/i);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=lax/i);
    assert.match(cookie, /Max-Age=3600/i);
    assert.match(h.headers["cache-control"]?.[0] ?? "", /no-store/);
    assert.equal(h.headers["referrer-policy"]?.[0], "no-referrer");

    // The page reads the cookie, shows the notice, and never prints the token.
    const page = await http(`${BASE}/classes/parent`, { headers: { cookie: `lf_parent=${token}` } });
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.ok(textOf(html).includes(`@${acc.p4.username} asked to join live classes.`), "names the student");
    assert.ok(textOf(html).includes("recorded on video"));
    assert.ok(html.includes('name="robots" content="noindex, nofollow"'));
    assert.ok(!html.includes(token), "no token in the page");

    // The parent decides with a POST (the no-JS form path), from the same network.
    const fields = actionFields(html, 'name="parent_name"');
    const res = await postForm(
      "/classes/parent",
      fields,
      { parent_name: "Lftest Parent", decision: "agree" },
      { cookie: `lf_parent=${token}`, "x-forwarded-for": "192.0.2.40", "user-agent": "lftest-curl" }
    );
    assert.equal(res.status, 303, `decide answered ${res.status}`);
    assert.equal(new URL(res.headers.get("location") ?? "", BASE).search, "?done=agreed");
    const cleared = res.headers.getSetCookie().find((c) => c.startsWith("lf_parent="));
    assert.ok(cleared && /Max-Age=0/i.test(cleared), "cookie cleared");
    const { data: row } = await admin
      .from("class_parent_consents")
      .select("status, parent_name, same_network, decided_user_agent")
      .eq("student_id", acc.p4.id)
      .single();
    assert.ok(row, "the request row exists");
    assert.equal(row.status, "agreed");
    assert.equal(row.parent_name, "Lftest Parent");
    assert.equal(row.decided_user_agent, "lftest-curl");
    assert.equal(row.same_network, true, "x-forwarded-for matched the request's network");

    // Works once: the same link now lands on the closed message, no cookie.
    const again = curlHead(`/classes/parent/open/${token}`);
    assert.equal(again.status, 303);
    assert.equal(new URL(again.headers.location?.[0] ?? "", BASE).search, "?link=closed");
    assert.ok(!(again.headers["set-cookie"] ?? []).some((c) => c.startsWith("lf_parent=")));
    const closed = await (await http(`${BASE}/classes/parent?link=closed`)).text();
    assert.ok(textOf(closed).includes("This link has been used, or it has expired."));
  });

  await step("curl: an expired link lands on the closed message with no cookie", async () => {
    await needServer();
    const h = curlHead(`/classes/parent/open/${expiredToken}`);
    assert.equal(h.status, 303);
    assert.equal(new URL(h.headers.location?.[0] ?? "", BASE).search, "?link=closed");
    assert.ok(!(h.headers["set-cookie"] ?? []).some((c) => c.startsWith("lf_parent=")));
  });

  await step("the age screen: selects start empty, no cutoff text, nothing chosen for you", async () => {
    await needServer();
    const cookie = await sessionCookie(acc.teenweb);
    const res = await http(`${BASE}/classes/ready`, { headers: { cookie } });
    const html = await res.text();
    assert.equal(res.status, 200);
    const at = html.indexOf('data-consent-step="needs_age"');
    assert.ok(at > 0, "the age step renders");
    const start = html.indexOf(">", at) + 1;
    const section = html.slice(start, html.indexOf("</section>", start));
    const selects = [...section.matchAll(/<select[\s\S]*?<\/select>/g)].map((m) => m[0]);
    assert.equal(selects.length, 2, "two selects");
    for (const s of selects) {
      const chosen = [...s.matchAll(/<option value="([^"]*)"[^>]*selected=""/g)].map((m) => m[1]);
      assert.deepEqual(chosen, [""], "only the empty placeholder is selected");
    }
    assert.ok(section.includes("birth month and year"));
    assert.ok(!/name="confirmed"/.test(section), "Yes only appears on the confirm step");
    const words = textOf(section.replace(/<select[\s\S]*?<\/select>/g, " "));
    assert.ok(!/\d/.test(words), `no numbers outside the selects: ${words}`);
    assert.ok(
      !/\b(older|younger|under|over|teen|adult|minor|child|kid|age[sd]?|old|year-old|birthday)\b/i.test(words),
      `no cutoff words: ${words}`
    );
    const head = html.slice(0, html.indexOf("<body"));
    assert.ok(!/\b1[0-9]\b/.test(textOf(head.replace(/<script[\s\S]*?<\/script>/g, ""))), "nothing in the head either");
  });

  await step("under 13 over HTTP: account deleted, u13 cookie set, signed out, second account device_blocked", async () => {
    await needServer();
    const cookie = await sessionCookie(acc.kidweb);
    const page = await (await http(`${BASE}/classes/ready`, { headers: { cookie } })).text();
    const fields = actionFields(page, "birth month and year");
    const before = (await under13Events()).length;
    const a12 = answer(12);
    // The confirm step's hidden fields and its Yes button.
    const res = await postForm(
      "/classes/ready",
      fields,
      { birth_month: a12.birthMonth, birth_year: a12.birthYear, confirmed: "yes" },
      { cookie }
    );
    assert.equal(res.status, 303, `answered ${res.status}`);
    assert.equal(new URL(res.headers.get("location") ?? "", BASE).pathname, "/classes/ready/deleted");
    const set = res.headers.getSetCookie();
    const u13 = set.find((c) => c.startsWith("lf_cls_age="));
    assert.ok(u13 && u13.startsWith("lf_cls_age=u13;"), "u13 cookie");
    assert.match(u13, /Max-Age=31536000/i);
    assert.match(u13, /HttpOnly/i);
    assert.match(u13, /Path=\//i);
    assert.ok(
      set.some((c) => c.startsWith("sb-") && /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c)),
      "the session cookie is cleared"
    );
    assert.equal(await exists(acc.kidweb.id), false, "account deleted");
    assert.equal(await ageRow(acc.kidweb.id), null);
    assert.equal((await under13Events()).length, before + 1);

    const gone = await http(`${BASE}/classes/ready/deleted`, { headers: { cookie: "lf_cls_age=u13" } });
    assert.equal(gone.status, 200);
    assert.ok(textOf(await gone.text()).includes("LearnFRC accounts are for people 13 and up, so we've deleted this one."));
    const noCookie = await http(`${BASE}/classes/ready/deleted`);
    assert.equal(noCookie.status, 404, "nothing to show without the cookie");

    // A different account in the same browser.
    const second = `${await sessionCookie(acc.second)}; lf_cls_age=u13`;
    const blocked = await (await http(`${BASE}/classes/ready`, { headers: { cookie: second } })).text();
    assert.ok(blocked.includes('data-consent-step="device_blocked"'), "device_blocked");
    assert.ok(textOf(blocked).includes("Live classes aren't available on this device."));
    // Posting an answer anyway (the same action) stores nothing.
    const a15 = answer(15);
    const tried = await postForm(
      "/classes/ready",
      fields,
      { birth_month: a15.birthMonth, birth_year: a15.birthYear, confirmed: "yes" },
      { cookie: second }
    );
    assert.equal(tried.status, 200);
    assert.equal(await ageRow(acc.second.id), null, "nothing stored for the second account");
    assert.ok(await exists(acc.second.id), "and it isn't deleted");
  });

  await step("/classes/ready renders every other state, and ?next= only goes back to classes pages", async () => {
    await needServer();
    const stepOf = (html: string) => /data-consent-step="([a-z_]+)"/.exec(html)?.[1];
    const signedOut = await (await http(`${BASE}/classes/ready?next=/classes`)).text();
    assert.equal(stepOf(signedOut), "signed_out");
    assert.ok(signedOut.includes(`href="/login?next=${encodeURIComponent("/classes/ready?next=%2Fclasses")}"`));
    for (const [k, state, phrase] of [
      ["nohandle", "needs_handle", "Pick a username in Settings"],
      ["adult", "adult", "Live classes are for students 13 to 17."],
      ["teen", "needs_parent", "Your parent or guardian's email"],
      ["own", "waiting_parent", `We emailed ${parentAddr("own", 2)}.`],
      ["p2", "parent_declined", "Your parent or guardian didn't OK live classes."],
      ["p1", "ready", "Your parent or guardian said OK"],
    ] as const) {
      const res = await http(`${BASE}/classes/ready?next=${encodeURIComponent("/classes/4f8a0e9e-6a39-4bbb-8a51-1d6b8a6c2f10")}`, {
        headers: { cookie: await sessionCookie(acc[k]) },
      });
      const html = await res.text();
      assert.equal(res.status, 200, k);
      assert.equal(stepOf(html), state, k);
      assert.ok(textOf(html).includes(phrase), `${k} says: ${phrase}`);
      if (state === "ready") assert.ok(html.includes('href="/classes/4f8a0e9e-6a39-4bbb-8a51-1d6b8a6c2f10"'));
    }
    const bad = await (
      await http(`${BASE}/classes/ready?next=${encodeURIComponent("https://evil.example/")}`, {
        headers: { cookie: await sessionCookie(acc.p1) },
      })
    ).text();
    // (The router's own payload echoes the request URL; no link may use it.)
    assert.ok(!/href="[^"]*evil\.example/.test(bad), "an outside next is dropped");
    assert.ok(bad.includes('href="/classes"'));
  });

  /* ── report and clean up ─────────────────────────────────────────── */

  await cleanup(PKG);
  // What cleanup can't find: rows with no account left to tie them to.
  const ev = await admin
    .from("class_events")
    .delete({ count: "exact" })
    .in("kind", ["under13_deleted", "under13_delete_failed"])
    .gte("created_at", t0);
  if (ev.error) throw new Error(ev.error.message);
  const rl = await admin.from("rate_limit_hits").delete({ count: "exact" }).like("bucket", "class-consent-%");
  if (rl.error) throw new Error(rl.error.message);
  console.log(`  class_events: ${ev.count ?? 0} (under-13 events)  rate_limit_hits: ${rl.count ?? 0} (class-consent-*)`);
  await check(PKG);

  const failed = results.filter((r) => r.ok === false);
  const skipped = results.filter((r) => r.ok === "skipped");
  console.log(
    `\n${results.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} skipped`
  );
  if (failed.length) process.exitCode = 1;
}

main().catch(async (e) => {
  console.error(e);
  try {
    await cleanup(PKG);
  } catch (e2) {
    console.error("cleanup failed:", e2);
  }
  process.exit(1);
});
