// The letters pages over HTTP, against a running dev server of this
// worktree (make-env.sh letters <port>, then `next dev -p <port>`), on
// production data with throwaway accounts:
//   - /classes/teaching/letter: signed out, a teacher, a blocked owner, a non-teacher;
//   - /admin/classes/letters: signed out, a non-reviewer, the safety lead, a super admin;
//   - /letters/[code]: its teacher, the safety lead and a super admin see it,
//     anyone else gets a 404, and the QR code decodes to the verify URL
//     (rendered with sharp, read by Apple's Vision, on macOS);
//   - /verify/[code]: valid, not found, withdrawn, and the rate limit.
//
// The requests, signing and withdrawing run in this process through the
// shared functions (the pages' server actions are one-line wrappers over
// them), with the same fakes as letters.check.ts for the two neighbour
// stubs. The dev server needs the real getTeacher and requireClassReviewer
// for the teacher desk and the reviewers' views, so before integration
// those steps only pass with the stubs swapped for checks/fakes on the dev
// server too (not committed). Everything is deleted at the end.
//
// With LETTERS_HIDDEN_URL instead, it checks a dev server started with both
// switches off (CLASSES_DEV_SWITCHES=0 CLASSES_VISIBLE=0 next dev; Next
// runs one dev server per folder, so this is a separate run): the teacher
// page (signed out and in), a letter and a verify for an unknown code all 404.
//
//   LETTERS_DEV_URL=http://localhost:3107 \
//   node --import ./scripts/classes/register.mjs scripts/classes/checks/letters-pages.check.ts
//   LETTERS_HIDDEN_URL=http://localhost:3107 \
//   node --import ./scripts/classes/register.mjs scripts/classes/checks/letters-pages.check.ts

import assert from "node:assert/strict";
// First: swaps the two neighbour stubs for fakes in this process.
import "./fakes/use-fakes.mjs";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { devDir, loadEnv } from "../env.mjs";
import { create, cleanup, check, readCredentials } from "../test-data.mjs";

loadEnv();
process.env.CLASSES_DEV_SWITCHES = "1";
delete process.env.VERCEL_ENV;
const DEV = (process.env.LETTERS_DEV_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3107").replace(/\/$/, "");

const PKG = "letters";
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
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
type Account = { id: string; email: string; password: string; username: string | null };
const DAY = 86_400_000;

/** The auth cookies @supabase/ssr itself writes for a password sign-in. */
async function cookieFor(a: { email: string; password: string }): Promise<string> {
  const jar = new Map<string, string>();
  const c = createServerClient(url, anon, {
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
  const { error } = await c.auth.signInWithPassword({ email: a.email, password: a.password });
  if (error) throw new Error(`sign in: ${error.message}`);
  return [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
}

/** Text a person reads: entities decoded, so copy can be matched as written. */
function readable(html: string): string {
  return html
    .replace(/&#x27;|&#39;|&rsquo;|&#8217;|’/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<!-- -->/g, "");
}

async function get(path: string, cookie?: string, headers: Record<string, string> = {}) {
  // One retry: after a long pause (the QR decode) the dev server may have
  // closed the kept-alive socket, and the first request on it fails.
  let res: Response;
  try {
    res = await fetch(`${DEV}${path}`, { redirect: "manual", headers: { ...(cookie ? { cookie } : {}), ...headers } });
  } catch {
    res = await fetch(`${DEV}${path}`, { redirect: "manual", headers: { ...(cookie ? { cookie } : {}), ...headers } });
  }
  const body = await res.text();
  return { status: res.status, location: res.headers.get("location"), html: body, text: readable(body) };
}

async function waitForServer(base = DEV) {
  const until = Date.now() + 8 * 60_000;
  while (Date.now() < until) {
    try {
      const r = await fetch(`${base}/verify/LF-22222-22222`, { redirect: "manual" });
      if (r.status === 200 || r.status === 404) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`no dev server at ${base}`);
}

/** The hidden run: a dev server with both switches off answers 404 everywhere. */
async function hiddenRun(base: string) {
  const started = new Date().toISOString();
  await waitForServer(base);
  await cleanup(PKG);
  try {
    await create(PKG, ["t1:age=16:parent=agreed:teacher"]);
    const acc = readCredentials(PKG).accounts as Record<string, Account>;
    const cookie = await cookieFor(acc.t1);
    await step("hidden: with both switches off, the letters pages 404", async () => {
      for (const path of ["/classes/teaching/letter", "/letters/LF-22222-22222", "/verify/LF-22222-22222", "/verify/nope"]) {
        const r = await fetch(`${base}${path}`, { redirect: "manual" });
        assert.equal(r.status, 404, path);
        const signedIn = await fetch(`${base}${path}`, { redirect: "manual", headers: { cookie } });
        assert.equal(signedIn.status, 404, `${path} signed in`);
      }
    });
  } finally {
    // A 404 for an unknown code still counted against the address's limit.
    await admin.from("rate_limit_hits").delete().like("bucket", "verify-letter:%").gte("created_at", started);
    await cleanup(PKG);
    await check(PKG);
  }
}

/** Decodes the QR code in an <svg> from the page with Apple's Vision. Null when it can't run here. */
async function decodeQr(svgViewBox: number, pathData: string): Promise<string | null> {
  if (process.platform !== "darwin") return null;
  let sharp: typeof import("sharp") | null = null;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    return null;
  }
  const dir = mkdtempSync(join(tmpdir(), "lf-qr-"));
  try {
    const png = join(dir, "qr.png");
    const scale = 10;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgViewBox} ${svgViewBox}" width="${svgViewBox * scale}" height="${svgViewBox * scale}" shape-rendering="crispEdges"><rect width="${svgViewBox}" height="${svgViewBox}" fill="#ffffff"/><path d="${pathData}" fill="#000000"/></svg>`;
    await sharp(Buffer.from(svg)).png().toFile(png);
    const swiftFile = join(dir, "decode.swift");
    writeFileSync(
      swiftFile,
      [
        "import Foundation",
        "import Vision",
        "import CoreImage",
        "let image = CIImage(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))!",
        "let request = VNDetectBarcodesRequest()",
        "request.symbologies = [.qr]",
        "try VNImageRequestHandler(ciImage: image, options: [:]).perform([request])",
        "for o in request.results ?? [] { if let s = o.payloadStringValue { print(s) } }",
      ].join("\n")
    );
    // The Command Line Tools' swift, with their own SDK: /usr/bin/swift
    // needs the Xcode license, and Xcode's newer SDK doesn't fit this
    // compiler. Interpreting the script takes a minute or two.
    const clt = "/Library/Developer/CommandLineTools";
    const swift = existsSync(`${clt}/usr/bin/swift`) ? `${clt}/usr/bin/swift` : "swift";
    const env = existsSync(`${clt}/SDKs/MacOSX.sdk`) ? { ...process.env, SDKROOT: `${clt}/SDKs/MacOSX.sdk` } : process.env;
    const out = execFileSync(swift, [swiftFile, png], { encoding: "utf8", timeout: 420_000, env });
    return out.trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const started = new Date().toISOString();
  await waitForServer();
  await cleanup(PKG);
  const { data: settingsBefore } = await admin.from("class_settings").select("safety_lead_user_id").eq("id", true).single();
  const leadBefore = (settingsBefore?.safety_lead_user_id as string | null) ?? null;
  let leadSetByUs: string | null = null;

  try {
    await create(PKG, ["t1:age=16:parent=agreed:teacher", "t2:age=15:parent=agreed:teacher", "lead", "boss:superadmin", "nobody"]);
    const acc = readCredentials(PKG).accounts as Record<string, Account>;

    // The dev server's owner is ADMIN_EMAILS = lftest+letters-owner@example.com
    // (make-env.sh). Cleanup finds this account by its lftest+letters- prefix.
    const ownerEmail = "lftest+letters-owner@example.com";
    const ownerPassword = `Lf${Math.random().toString(36).slice(2)}${Date.now().toString(36)}!`;
    const { data: ownerData, error: ownerErr } = await admin.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
      user_metadata: { username: "lftest_letters_owner" },
    });
    if (ownerErr || !ownerData.user) throw new Error(`owner: ${ownerErr?.message}`);
    const ownerId = ownerData.user.id;
    await admin.from("profiles").update({ username: "lftest_letters_owner" }).eq("id", ownerId);
    await admin.from("class_teachers").insert({ user_id: ownerId, letter_name: "Lftest Owner", note: "lftest" });
    process.env.ADMIN_EMAILS = ownerEmail;

    const letters = await import("../../../src/lib/classes/letters.ts");
    const rules = await import("../../../src/lib/classes/letter-rules.ts");
    const user = (k: string) => ({ id: acc[k].id, email: acc[k].email, created_at: new Date().toISOString() });

    const mkClass = async (title: string, teacherId: string, daysAgo: number, minutes: number) => {
      const starts = new Date(Date.now() - daysAgo * DAY);
      const { data, error } = await admin
        .from("classes")
        .insert({
          teacher_id: teacherId,
          title: `lftest letters ${title}`,
          starts_at: starts.toISOString(),
          duration_minutes: 60,
          hard_end_at: new Date(starts.getTime() + 75 * 60_000).toISOString(),
          rtk_app: "dev",
          status: "approved",
          credited_minutes_computed: minutes,
          credited_minutes: minutes,
          decided_at: new Date().toISOString(),
          decided_by: acc.boss.id,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id as string;
    };
    const c1 = await mkClass("Wiring the CAN bus", acc.t1.id, 5, 45);
    await mkClass("Tuning a PID loop", acc.t1.id, 12, 60);
    await mkClass("Reading a schematic", acc.t1.id, 30, 30);
    await mkClass("Owner class", ownerId, 4, 30);

    const cookies = {
      t1: await cookieFor(acc.t1),
      t2: await cookieFor(acc.t2),
      lead: await cookieFor(acc.lead),
      boss: await cookieFor(acc.boss),
      nobody: await cookieFor(acc.nobody),
      owner: await cookieFor({ email: ownerEmail, password: ownerPassword }),
    };

    await step("/classes/teaching/letter: signed out goes to sign in", async () => {
      const r = await get("/classes/teaching/letter");
      assert.ok([303, 307, 308].includes(r.status), String(r.status));
      assert.match(decodeURIComponent(r.location ?? ""), /\/login\?next=\/classes\/teaching\/letter$/);
    });

    await step("/classes/teaching/letter: a teacher sees the locked name, the note, the preview and the button", async () => {
      const r = await get("/classes/teaching/letter", cookies.t1);
      assert.equal(r.status, 200);
      assert.ok(r.text.includes("Lftest T1"), "locked name");
      assert.ok(r.text.includes("Wrong? Write to us"));
      assert.ok(r.text.includes(rules.SCHOOL_RULES_NOTE), "school rules note");
      assert.ok(r.text.includes("Request the letter"));
      assert.ok(r.text.includes("2 hours 15 minutes"), "total");
      assert.ok(r.text.includes("Wiring the CAN bus"));
      assert.equal(r.html.includes("\u2014"), false, "no em dash");
    });

    await step("/classes/teaching/letter: an owner account gets the no-letters note, a student the teachers-only card", async () => {
      const o = await get("/classes/teaching/letter", cookies.owner);
      assert.equal(o.status, 200);
      assert.ok(o.text.includes(letters.LETTER_SENTENCES.noLetters));
      assert.equal(o.text.includes("Request the letter"), false);
      const n = await get("/classes/teaching/letter", cookies.nobody);
      assert.equal(n.status, 200);
      assert.ok(n.text.includes(letters.LETTER_SENTENCES.notTeacher));
    });

    await admin.from("class_settings").update({ safety_lead_user_id: acc.lead.id }).eq("id", true);
    leadSetByUs = acc.lead.id;
    const req = await letters.requestHoursLetter(user("t1"), rules.defaultLetterPeriod());
    if (!req.ok) throw new Error(`request: ${req.error}`);

    await step("/admin/classes/letters: signed out and non-reviewers are kept out", async () => {
      const s = await get("/admin/classes/letters");
      assert.ok([303, 307, 308].includes(s.status), String(s.status));
      assert.match(decodeURIComponent(s.location ?? ""), /\/login/);
      const n = await get("/admin/classes/letters", cookies.nobody);
      assert.equal(n.status, 200);
      assert.ok(n.text.includes("This drawer is locked."));
      assert.equal(n.text.includes("Lftest T1"), false);
    });

    await step("/admin/classes/letters: the safety lead sees the request with its classes and can sign", async () => {
      const r = await get("/admin/classes/letters", cookies.lead);
      assert.equal(r.status, 200);
      assert.ok(r.text.includes("Lftest T1"));
      assert.ok(r.text.includes("@lftest_letters_t1"));
      assert.ok(r.text.includes("Approve and sign"));
      assert.ok(r.html.includes(`/admin/classes/${c1}`), "links each class's review");
      assert.equal(r.text.includes("signs letters, since each one carries his signature"), false);
      assert.equal(r.html.includes("\u2014"), false, "no em dash");
    });

    await step("/admin/classes/letters: a super admin sees it but is told only the safety lead signs", async () => {
      const r = await get("/admin/classes/letters", cookies.boss);
      assert.equal(r.status, 200);
      assert.ok(r.text.includes("Lftest T1"));
      assert.ok(r.text.includes("signs letters, since each one carries his signature"));
    });

    const signed = await letters.approveHoursLetter(user("lead"), { id: req.id });
    if (!signed.ok) throw new Error(`approve: ${signed.error}`);
    const code = signed.code;

    await step("/letters/[code]: its teacher, the safety lead and a super admin; a 404 for anyone else", async () => {
      const s = await get(`/letters/${code}`);
      assert.ok([303, 307, 308].includes(s.status), String(s.status));
      assert.equal((s.location ?? "").includes(code), false, "the code isn't put in the login link");
      for (const k of ["t2", "nobody"] as const) {
        const r = await get(`/letters/${code}`, cookies[k]);
        assert.equal(r.status, 404, k);
        assert.equal(r.text.includes("Lftest T1"), false, k);
      }
      for (const k of ["t1", "lead", "boss"] as const) {
        const r = await get(`/letters/${code}`, cookies[k]);
        assert.equal(r.status, 200, k);
        assert.ok(r.text.includes("To whom it may concern"), k);
      }
      assert.equal((await get(`/letters/LF-22222-22222`, cookies.t1)).status, 404);
    });

    let letterHtml = "";
    await step("/letters/[code]: the letter says what the design says", async () => {
      const r = await get(`/letters/${code}`, cookies.t1);
      letterHtml = r.html;
      const article = r.text.slice(r.text.indexOf('id="letter"'));
      for (const s of [
        "This letter confirms, from LearnFRC's records, that Lftest T1 volunteered as a teacher with LearnFRC (learnfrc.com)",
        "taught 3 live online classes, for 2 hours 15 minutes of teaching time.",
        "How we checked: the time comes from the class video service's join and leave records",
        "An adult volunteer wasn't present for every class.",
        "/s/ Dhiren Pardhanani",
        "Volunteer Coordinator, LearnFRC",
        "dpardhanani@gmail.com",
        "Reviewed and approved by the signer on",
        `Verify this letter at`,
        rules.verifyUrlLabel(DEV, code),
        rules.NOT_A_NONPROFIT,
        "which is not overseeing, involved with, or responsible for this activity",
        "Print, or save as PDF",
      ]) {
        assert.ok(r.text.includes(s), s);
      }
      assert.equal(article.includes("\u2014"), false, "no em dash in the letter");
    });

    await step("/letters/[code]: the QR payload is the verify URL", async () => {
      const m = /<svg[^>]*viewBox="0 0 (\d+) \1"[^>]*aria-label="QR code for this letter[^"]*"[^>]*>[\s\S]*?<path d="([^"]+)"/.exec(
        letterHtml
      );
      assert.ok(m, "a QR svg on the letter");
      const decoded = await decodeQr(Number(m![1]), m![2]);
      if (decoded === null) {
        console.log("     (QR decode skipped: needs macOS Vision and sharp)");
        return;
      }
      assert.equal(decoded, rules.verifyUrlFor(DEV, code));
    });

    await step("/verify/[code]: valid, with the facts; not found for unknown and junk codes", async () => {
      const v = await get(`/verify/${code}`);
      assert.equal(v.status, 200);
      assert.ok(v.text.includes("Valid letter."));
      assert.ok(v.text.includes("Lftest T1"));
      assert.ok(v.text.includes("2 hours 15 minutes, 3 classes"));
      assert.ok(v.text.includes("Dhiren Pardhanani, Volunteer Coordinator"));
      assert.ok(v.text.includes("Wiring the CAN bus"));
      assert.equal(v.html.includes("\u2014"), false);
      const lower = await get(`/verify/${code.toLowerCase()}`);
      assert.ok(lower.text.includes("Valid letter."));
      for (const bad of ["LF-22222-22222", "nope", "LF-0000O-11111"]) {
        const r = await get(`/verify/${bad}`);
        assert.equal(r.status, 200, bad);
        assert.ok(r.text.includes("We can't find that letter."), bad);
      }
    });

    const revoked = await letters.revokeHoursLetter(user("boss"), { id: req.id, reason: "lftest withdraw" });
    if (!revoked.ok) throw new Error(`revoke: ${revoked.error}`);

    await step("/verify/[code] and /letters/[code] after it's withdrawn", async () => {
      const v = await get(`/verify/${code}`);
      assert.ok(v.text.includes(`Withdrawn on ${rules.longDate(rules.pacificDate(new Date()))}.`));
      assert.equal(v.text.includes("Valid letter."), false);
      const l = await get(`/letters/${code}`, cookies.t1);
      assert.equal(l.status, 200);
      assert.ok(l.text.includes("isn't valid any more"));
      assert.equal(l.text.includes("Print, or save as PDF"), false, "no print button on a withdrawn letter");
    });

    await step("/verify/[code] rate-limits at 30 an hour per address", async () => {
      const ip = `lftest-letters-${Math.random().toString(36).slice(2, 10)}`;
      let limitedAt = -1;
      for (let i = 1; i <= 31; i++) {
        const r = await get(`/verify/${code}`, undefined, { "x-forwarded-for": ip });
        if (r.text.includes("Too many checks from here.")) {
          limitedAt = i;
          break;
        }
        assert.ok(r.text.includes("Withdrawn on"), `check ${i}`);
      }
      assert.ok(limitedAt > 0, "limited within 31 checks");
      // With x-forwarded-for passed through, exactly the 31st; if the dev
      // server set its own, earlier checks from here count too.
      console.log(`     (limited at check ${limitedAt})`);
    });
  } finally {
    if (leadSetByUs) {
      const { data } = await admin.from("class_settings").select("safety_lead_user_id").eq("id", true).single();
      if (data?.safety_lead_user_id === leadSetByUs) {
        await admin.from("class_settings").update({ safety_lead_user_id: leadBefore }).eq("id", true);
      }
    }
    // The page's per-IP buckets aren't per account, so cleanup can't find
    // them. Only this package uses verify-letter.
    await admin.from("rate_limit_hits").delete().like("bucket", "verify-letter:%").gte("created_at", started);
    await cleanup(PKG);
    await check(PKG);
    rmSync(join(devDir(), "outbox", PKG), { recursive: true, force: true });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} of ${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

const hiddenUrl = process.env.LETTERS_HIDDEN_URL?.replace(/\/$/, "");
(hiddenUrl
  ? hiddenRun(hiddenUrl).then(() => {
      const failed = results.filter((r) => !r.ok);
      console.log(`\n${results.length - failed.length} of ${results.length} passed`);
      if (failed.length) process.exitCode = 1;
    })
  : main()
).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
