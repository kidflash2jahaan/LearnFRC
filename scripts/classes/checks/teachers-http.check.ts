// The teachers package's page checks against a running dev server
// (classes-design.md 15.2, and teacher-application-spec.md section 7): /apply
// is a 307 to /apply/teach while classes are visible and a closed page that
// never mentions classes while hidden; the footer's "Teach a class" only while
// visible; /apply/teach for each state, the second form's opening question
// included; the desk for super admins only; GET /api/app/apply over Bearer
// keeps every old key and lists only the teacher role; POST is closed.
// Signed-in requests carry a real session cookie for a throwaway account,
// made the way @supabase/ssr makes it.
//
//   BASE=http://localhost:3013 node --import ./scripts/classes/register.mjs \
//     scripts/classes/checks/teachers-http.check.ts [--hidden]
//
// --hidden: the dev server was started without the switches
// (CLASSES_DEV_SWITCHES=0, CLASSES_VISIBLE unset); everything about classes
// must be gone from these pages.

import assert from "node:assert/strict";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "../env.mjs";
import { create, cleanup, check, readCredentials } from "../test-data.mjs";

loadEnv();
const BASE = (process.env.BASE || "http://localhost:3013").replace(/\/$/, "");
const HIDDEN = process.argv.includes("--hidden");
const PKG = "teachers";

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

type Account = { id: string; email: string; password: string; username: string | null };

/** Signs in as @supabase/ssr does and returns the Cookie header and the access token. */
async function session(a: Account): Promise<{ cookie: string; token: string }> {
  const jar = new Map<string, string>();
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => {
        for (const { name, value } of list) {
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
      },
    },
  });
  const { data, error } = await client.auth.signInWithPassword({ email: a.email, password: a.password });
  if (error || !data.session) throw new Error(`sign in ${a.username}: ${error?.message}`);
  const cookie = [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
  return { cookie, token: data.session.access_token };
}

async function page(path: string, cookie?: string): Promise<{ status: number; html: string }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
    signal: AbortSignal.timeout(180_000),
  });
  return { status: res.status, html: await res.text() };
}

/** Just the page's own content (the layout's <main>), without the nav and footer. */
function mainOf(html: string): string {
  const m = html.match(/<main\b[\s\S]*?<\/main>/);
  return m ? m[0] : html;
}

/** The footer's markup. */
function footerOf(html: string): string {
  const m = html.match(/<footer\b[\s\S]*?<\/footer>/);
  return m ? m[0] : "";
}

/** The page's visible text, roughly: tags out, entities for quotes back. */
function text(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    // React's separators between adjacent text nodes ("@<!-- -->maya").
    .replace(/<!-- -->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&rsquo;|&#39;/g, "’")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
}

async function main() {
  await cleanup(PKG);
  await create(PKG, [
    "ready:age=16:parent=agreed",
    "noage",
    "adult:age=19",
    "teach:age=16:parent=agreed:teacher",
    "sa:superadmin",
    "member",
  ]);
  const acc = readCredentials(PKG).accounts as Record<string, Account>;
  const s: Record<string, { cookie: string; token: string }> = {};
  for (const k of Object.keys(acc)) s[k] = await session(acc[k]);

  // One pending application for the desk, straight into the table.
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await admin.from("teacher_applications").insert({
    user_id: acc.member.id,
    legal_name: "Lftest Desk Applicant",
    topics: "lftest topics",
    experience: "lftest experience ".repeat(4),
    sample_plan: "lftest plan ".repeat(5),
    code_version: "2026-11-09",
  });
  if (error) throw new Error(`desk application: ${error.message}`);

  if (HIDDEN) {
    await step("hidden: /apply/teach is a 404 and /apply says there's nothing to apply for", async () => {
      const teach = await page("/apply/teach", s.ready.cookie);
      assert.equal(teach.status, 404);
      for (const cookie of [undefined, s.member.cookie]) {
        const out = await page("/apply", cookie);
        assert.equal(out.status, 200);
        const t = text(mainOf(out.html));
        assert.ok(t.includes("Nothing to apply for right now"), "the closed page");
        for (const word of ["class", "teach", "market", "spread"]) {
          assert.ok(!t.toLowerCase().includes(word), `no "${word}" on the closed page`);
        }
        assert.ok(!t.includes("—"), "no em dash");
        const footer = text(footerOf(out.html));
        assert.ok(!footer.includes("Teach a class"), "no apply link in the footer while hidden");
        assert.ok(!footer.includes("Help run it"));
        assert.ok(!footerOf(out.html).includes('href="/apply'), "the footer links nowhere under /apply");
      }
    });
    await step("hidden: GET /api/app/apply lists no roles; POST is closed", async () => {
      const res = await fetch(`${BASE}/api/app/apply`, { headers: { authorization: `Bearer ${s.ready.token}` } });
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.deepEqual(body.roles, []);
      assert.equal(body.applicationsOpen, false);
      assert.ok(!JSON.stringify(body).includes("Teach a live class"));
      const post = await fetch(`${BASE}/api/app/apply`, {
        method: "POST",
        headers: { authorization: `Bearer ${s.member.token}`, "content-type": "application/json" },
        body: JSON.stringify({ experience: "x".repeat(60), why: "x".repeat(60) }),
      });
      assert.equal(post.status, 409);
    });
    return;
  }

  await step("/apply is a temporary redirect to /apply/teach; the footer says Teach a class", async () => {
    for (const cookie of [undefined, s.member.cookie]) {
      const out = await page("/apply", cookie);
      assert.equal(out.status, 307, `a 307, not a permanent redirect (${out.status})`);
      const res = await fetch(`${BASE}/apply`, { headers: cookie ? { cookie } : {}, redirect: "manual" });
      assert.equal(new URL(res.headers.get("location") ?? "", BASE).pathname, "/apply/teach");
    }
    const home = await page("/");
    const footer = footerOf(home.html);
    assert.ok(text(footer).includes("Teach a class"), "the footer's apply link");
    assert.ok(footer.includes('href="/apply/teach"'));
    assert.ok(!text(footer).includes("Help run it"));
  });

  await step("/apply/teach signed out: what it is, sign in, and no age range or code yet", async () => {
    const out = await page("/apply/teach");
    assert.equal(out.status, 200);
    const t = text(out.html);
    assert.ok(t.includes("What teachers do"));
    assert.ok(t.includes("Sign in and apply"));
    assert.ok(t.includes("your first one included"), "every class reviewed, the first included");
    assert.ok(!t.includes("13 to 17"), "no age range before the age answer");
    assert.ok(!/\bhost/i.test(t), "no host promised");
    assert.ok(!t.includes("\u2014"), "no em dash");
  });

  await step("/apply/teach for each signed-in state", async () => {
    const noageHtml = (await page("/apply/teach", s.noage.cookie)).html;
    const noage = text(noageHtml);
    assert.ok(noage.includes("One quick question first"));
    assert.ok(noageHtml.includes('href="/classes/ready?next=/apply/teach"'), "links the age question");
    assert.ok(!noage.includes("13 to 17"));
    const adult = text((await page("/apply/teach", s.adult.cookie)).html);
    assert.ok(adult.includes("Live classes are for students 13 to 17"));
    assert.ok(!adult.includes("Send the application"));
    const ready = text((await page("/apply/teach", s.ready.cookie)).html);
    // The form opens on the full-season question; the rest renders after
    // "Yes" in the browser, so the server's HTML has the question, the
    // requirements and the before-you-start note.
    assert.ok(ready.includes("Have you finished at least one full FRC season?"));
    assert.ok(ready.includes("about 25 minutes") || ready.includes("About 25 minutes"));
    assert.ok(ready.includes("At least one full FRC season"), "the requirement");
    assert.ok(ready.includes("before you start"));
    assert.ok(ready.includes(`@${acc.ready.username}`));
    assert.ok(!/Help run it|spread LearnFRC/i.test(ready), "no marketing role");
    const teach = text((await page("/apply/teach", s.teach.cookie)).html);
    assert.ok(teach.includes("You’re a teacher"));
    assert.ok(teach.includes("Lftest Teach"), "the locked letter name");
    assert.ok(teach.includes("Open your teaching page"));
    for (const t of [noage, adult, ready, teach]) {
      assert.ok(!/\bhost/i.test(t), "no host promised");
      assert.ok(!t.includes("\u2014"), "no em dash");
    }
  });

  await step("the teacher desk: super admins only", async () => {
    const out = await page("/admin/classes/teachers");
    assert.ok(out.status === 307 || out.status === 302 || out.status === 303, `signed out redirects (${out.status})`);
    const member = text((await page("/admin/classes/teachers", s.member.cookie)).html);
    assert.ok(member.includes("This desk is for class reviewers."));
    assert.ok(!member.includes("Lftest Desk Applicant"));
    const sa = text((await page("/admin/classes/teachers", s.sa.cookie)).html);
    assert.ok(sa.includes("Who teaches live classes."));
    assert.ok(sa.includes(`@${acc.member.username}`), "the pending application");
    assert.ok(sa.includes("Lftest Desk Applicant"), "the name for letters");
    assert.ok(sa.includes("how to score one"), "the folded scoring guide");
    assert.ok(sa.includes("first form: no season check"), "a first-form row is marked");
    // The Teachers drawer stays shut while applications wait (its rows mount
    // when it's opened, so they aren't in this HTML); its badge counts them.
    assert.ok(/\d+ teaching/.test(sa), "the teachers drawer's count");
  });

  await step("GET /api/app/apply keeps every old key, closed, with only the teacher role", async () => {
    const res = await fetch(`${BASE}/api/app/apply`, { headers: { authorization: `Bearer ${s.ready.token}` } });
    assert.equal(res.status, 200);
    const body = await res.json();
    for (const k of ["applicationsOpen", "mode", "heading", "record", "application", "jobs", "limits", "posting", "rules", "marketer"]) {
      assert.ok(k in body, `kept ${k}`);
    }
    assert.equal(body.applicationsOpen, false);
    assert.deepEqual(body.jobs, []);
    assert.equal(body.posting, "");
    assert.deepEqual(body.rules, []);
    assert.equal(body.marketer, null);
    assert.deepEqual(body.roles.map((r: { id: string }) => r.id), ["teacher"]);
    assert.equal(body.roles[0].title, "Teach a live class");
    assert.ok(body.roles[0].url.endsWith("/apply/teach"));
    assert.equal(body.roles[0].open, true);
    assert.equal(body.roles[0].status, "new");
    const teacher = await (
      await fetch(`${BASE}/api/app/apply`, { headers: { authorization: `Bearer ${s.teach.token}` } })
    ).json();
    assert.equal(teacher.roles[0].status, "teacher");
    const post = await fetch(`${BASE}/api/app/apply`, {
      method: "POST",
      headers: { authorization: `Bearer ${s.member.token}`, "content-type": "application/json" },
      body: JSON.stringify({ experience: "x".repeat(60), why: "x".repeat(60) }),
    });
    assert.equal(post.status, 409);
    assert.equal((await post.json()).error, "Applications are closed for now. Check back later.");
  });
}

try {
  await main();
} catch (e) {
  results.push({ name: "setup", ok: false, error: (e as Error).message });
  console.log(`FAIL setup: ${(e as Error).message}`);
} finally {
  console.log("--- cleanup ---");
  await cleanup(PKG);
  await check(PKG);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : (process.exitCode ?? 0));
}
