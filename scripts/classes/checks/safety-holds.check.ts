// The safety-holds package's checks against production with throwaway
// accounts (classes-design.md 15.2, the safety-holds row):
//   - a hold snapshots email, handle, transcript and chat (blocked messages
//     included) from test rows, with peer reports and the recording ledger;
//   - a ban and a self-delete with an open class report both leave a hold
//     after the account is gone, and the consent rows keep their handles;
//     a self-delete with no case leaves none;
//   - a safety-lead account (set in class_settings, then put back) opens the
//     class pages, restricted ones included, and no other /admin page; a
//     super admin sees restricted holds only as "Dhiren is handling this one";
//   - notes, the NCMEC number, extend and release;
//   - the sweep's retries, and expired holds are deleted.
// With HOLDS_DEV_URL set (a `next dev` of this worktree), the same access
// rules are checked over HTTP with real session cookies.
//
// Keys change what the hold steps expect, and the check runs either way.
// With RealtimeKit keys the made-up peer ids are asked about for real
// (Cloudflare refuses them); with R2 keys a recording copy is attempted, and
// a recording served from a local stand-in for RealtimeKit's download link
// is copied into learnfrc-class-holds-dev (never another bucket), opened
// through a 15-minute link and deleted when its hold expires. Peer reports
// for a real peer need a live meeting: that's the flow test (6.10).
// Everything it makes is deleted at the end (test-data.mjs cleanup, and the
// class's prefix in the dev bucket).
//
//   node --import ./scripts/classes/register.mjs scripts/classes/checks/safety-holds.check.ts

import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { devDir, loadEnv } from "../env.mjs";
import { create, cleanup, check, readCredentials } from "../test-data.mjs";

const PKG = "safety-holds";
// This package's own outbox (cleanup removes it), whatever package the
// worktree's .env.local was built for.
process.env.EMAIL_DEV_OUTBOX = join(devDir(), "outbox", PKG);
loadEnv();
process.env.CLASSES_DEV_SWITCHES = "1";
delete process.env.VERCEL_ENV;
const has = (...names: string[]) => names.every((n) => !!process.env[n]?.trim());
const RTK_KEYS = has("CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_REALTIMEKIT_API_TOKEN", "CLOUDFLARE_REALTIMEKIT_APP_ID_DEV");
const R2_KEYS = has("CLOUDFLARE_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY");
console.log(`keys: RealtimeKit ${RTK_KEYS ? "yes" : "no"}, R2 ${R2_KEYS ? "yes" : "no"}`);

const results: { name: string; ok: boolean; error?: string; needsKeys?: boolean }[] = [];
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
/** A check this run can't do: no keys yet, or (with keys) something only the flow test has. */
function needsKeys(name: string, why = "needs keys") {
  results.push({ name, ok: true, needsKeys: true });
  console.log(`skip ${name}: ${why}`);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Account = { id: string; email: string; password: string; username: string | null };
const MIN = 60_000;
const DAY = 86_400_000;
let prevLead: string | null = null;
let leadSet = false;

async function setLead(id: string | null) {
  // Putting back another package's lead: if that account was deleted in the
  // meantime, the column's default (null) is what's right.
  if (id && !(await admin.auth.admin.getUserById(id)).data.user) id = null;
  const { error } = await admin.from("class_settings").update({ safety_lead_user_id: id }).eq("id", true);
  if (error) throw new Error(`class_settings: ${error.message}`);
}

async function newClass(title: string, teacherId: string, opts: { startedMinAgo: number; status: string }) {
  const starts = new Date(Date.now() - opts.startedMinAgo * MIN);
  const { data, error } = await admin
    .from("classes")
    .insert({
      teacher_id: teacherId,
      title,
      starts_at: starts.toISOString(),
      duration_minutes: 30,
      hard_end_at: new Date(starts.getTime() + 45 * MIN).toISOString(),
      capacity: 15,
      status: opts.status,
      rtk_app: "dev",
      rtk_meeting_id: `lftest-safetyholds-${title.replace(/\W+/g, "-")}-${Date.now()}`,
      live_started_at: starts.toISOString(),
      ended_at: new Date(starts.getTime() + 32 * MIN).toISOString(),
    })
    .select("id, starts_at")
    .single();
  if (error) throw new Error(`class ${title}: ${error.message}`);
  return data as { id: string; starts_at: string };
}

/** A signed-in cookie jar, the way @supabase/ssr writes it for the site. */
async function sessionCookie(a: Account): Promise<string> {
  const jar = new Map<string, string>();
  const c = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cs) => cs.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error } = await c.auth.signInWithPassword({ email: a.email, password: a.password });
  if (error) throw new Error(`sign in ${a.username}: ${error.message}`);
  return [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
}

async function main() {
  await cleanup(PKG); // a clean start if an earlier run stopped halfway
  const { data: settings } = await admin.from("class_settings").select("safety_lead_user_id").eq("id", true).single();
  prevLead = (settings?.safety_lead_user_id as string | null) ?? null;

  await create(PKG, [
    "t1:age=16:parent=agreed:teacher",
    "s1:age=14:parent=agreed",
    "s2:age=15:parent=agreed",
    "s3:age=15:parent=agreed",
    "s4:age=15:parent=agreed",
    "lead",
    "boss:superadmin",
    "mem:age=15:parent=agreed",
  ]);
  const acc = readCredentials(PKG).accounts as Record<string, Account>;
  const user = (k: string) => ({ id: acc[k].id, email: acc[k].email, created_at: new Date().toISOString() });
  const handle = (k: string) => `lftest_safetyholds_${k}`;

  const holds = await import("../../../src/lib/classes/holds.ts");
  const hr = await import("../../../src/lib/classes/hold-rules.ts");
  const reviewers = await import("../../../src/lib/app/class-reviewers.ts");
  const access = await import("../../../src/lib/app/admin-access.ts");
  const reportsDesk = await import("../../../src/lib/app/admin-reports.ts");
  const dashboard = await import("../../../src/lib/app/admin-dashboard.ts");
  const profile = await import("../../../src/lib/app/profile.ts");

  // ── Test rows: a restricted class (A) and a plain one (B) ───────────
  const A = await newClass("lftest safety-holds restricted class", acc.t1.id, { startedMinAgo: 120, status: "ended" });
  const B = await newClass("lftest safety-holds plain class", acc.t1.id, { startedMinAgo: 240, status: "ended" });
  const sessionA = `lftest-safetyholds-${A.id.slice(0, 8)}-s1`;
  const sessionB = `lftest-safetyholds-${B.id.slice(0, 8)}-s1`;
  const startedA = A.starts_at;
  const must = (r: { error: { message: string } | null }, what: string) => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
  };
  must(
    await admin.from("class_sessions").insert([
      {
        id: sessionA,
        class_id: A.id,
        started_at: startedA,
        ended_at: new Date(Date.parse(startedA) + 32 * MIN).toISOString(),
        recording_url: "https://example.invalid/lftest/safetyholds-a.mp4",
        recording_expires_at: new Date(Date.now() + 6 * DAY).toISOString(),
        transcript_status: "stored",
      },
      { id: sessionB, class_id: B.id, started_at: B.starts_at, transcript_status: "missing" },
    ]),
    "sessions"
  );
  must(
    await admin.from("class_participants").insert([
      { class_id: A.id, user_id: acc.t1.id, role: "teacher", preset_name: "lfrc-teacher" },
      ...["s1", "s2", "s3"].map((k) => ({ class_id: A.id, user_id: acc[k].id, role: "student", preset_name: "lfrc-student" })),
      { class_id: B.id, user_id: acc.t1.id, role: "teacher", preset_name: "lfrc-teacher" },
      { class_id: B.id, user_id: acc.s4.id, role: "student", preset_name: "lfrc-student" },
    ]),
    "participants"
  );
  must(
    await admin.from("class_attendance").insert(
      ["t1", "s1", "s2", "s3"].map((k) => ({
        class_id: A.id,
        session_id: sessionA,
        user_id: acc[k].id,
        role: k === "t1" ? "teacher" : "student",
        account_age_days: 30,
        peer_id: `lftest-peer-${k}-${A.id.slice(0, 8)}`,
        joined_at: startedA,
        left_at: new Date(Date.parse(startedA) + 30 * MIN).toISOString(),
      }))
    ),
    "attendance"
  );
  const lines = [
    { t0: 3, t1: 6, userId: acc.t1.id, label: `@${handle("t1")}`, role: "teacher", text: "today we're wiring a CAN bus" },
    { t0: 40, t1: 44, userId: acc.s1.id, label: `@${handle("s1")}`, role: "student", text: "what gauge wire for the PDH" },
    { t0: 60, t1: 66, userId: acc.t1.id, label: `@${handle("t1")}`, role: "teacher", text: "lftest marker line for the hold" },
  ];
  must(
    await admin.from("class_transcripts").insert({
      session_id: sessionA,
      class_id: A.id,
      lines,
      word_count: 20,
      purge_after: new Date(Date.now() + 365 * DAY).toISOString().slice(0, 10),
    }),
    "transcript"
  );
  must(
    await admin.from("class_chat_messages").insert([
      { class_id: A.id, sender_id: acc.t1.id, sender_username: handle("t1"), sender_role: "teacher", body: "lesson link: https://learnfrc.com/guides", status: "shown", blocked_kinds: [] },
      { class_id: A.id, sender_id: acc.s1.id, sender_username: handle("s1"), sender_role: "student", body: "thanks", status: "shown", blocked_kinds: [] },
      { class_id: A.id, sender_id: acc.s1.id, sender_username: handle("s1"), sender_role: "student", body: "add me on snap", status: "blocked", blocked_kinds: ["contact_app", "contact_phrase"] },
      { class_id: A.id, sender_id: acc.s2.id, sender_username: handle("s2"), sender_role: "student", body: "my email is lftest at example dot com", status: "blocked", blocked_kinds: ["email"] },
    ]),
    "chat"
  );
  must(
    await admin.from("class_consents").insert(
      ["s2", "s3", "s4"].map((k) => ({
        user_id: acc[k].id,
        user_handle: handle(k),
        user_birth_year: 2011,
        class_id: k === "s4" ? B.id : A.id,
        kind: "recording_notice",
        version: "2026-11-09",
      }))
    ),
    "consents"
  );
  must(
    await admin.from("class_reviews").insert([
      { class_id: A.id, status: "ready", verdict: "urgent", restricted: true, summary_md: "lftest" },
      { class_id: B.id, status: "ready", verdict: "looks_fine", restricted: false, summary_md: "lftest" },
    ]),
    "reviews"
  );

  let holdS1 = "";
  let holdWide = "";

  await step("a hold snapshots email, handle, transcript, chat (blocked included) and peer reports", async () => {
    const r = await holds.holdClass(A.id, { reason: "urgent_flag", subjectUserId: acc.s1.id });
    assert.equal(r.ok, true, JSON.stringify(r));
    if (!r.ok) return;
    holdS1 = r.holdIds[0];
    await holds.holdWorkSettled();
    const { data: h } = await admin.from("class_safety_holds").select("*").eq("id", holdS1).single();
    assert.equal(h.subject_email, acc.s1.email);
    assert.equal(h.subject_handle, handle("s1"));
    assert.equal(h.class_id, A.id);
    assert.equal(h.reason, "urgent_flag");
    assert.equal(h.transcript.length, 3);
    assert.ok(h.transcript.some((l: { text: string }) => l.text === "lftest marker line for the hold"));
    assert.equal(h.transcript[0].sessionId, sessionA);
    assert.equal(h.chat.length, 4);
    assert.equal(h.chat.filter((m: { status: string }) => m.status === "blocked").length, 2, "blocked messages kept");
    assert.ok(h.chat.some((m: { body: string }) => m.body === "add me on snap"));
    const peers = h.peer_reports as { peerId: string; ok: boolean; error: string; handle: string }[];
    assert.deepEqual(
      peers.map((p) => p.peerId).sort(),
      [`lftest-peer-s1-${A.id.slice(0, 8)}`, `lftest-peer-t1-${A.id.slice(0, 8)}`].sort(),
      "the subject's peers plus the teacher's"
    );
    if (RTK_KEYS) {
      // Asked for real: RealtimeKit has never seen these made-up peers.
      assert.ok(
        peers.every((p) => !p.ok && !!p.error && p.error !== "not_configured"),
        `RealtimeKit was asked: ${JSON.stringify(peers.map((p) => p.error))}`
      );
    } else {
      assert.ok(peers.every((p) => !p.ok && p.error === "not_configured"), "no Cloudflare keys yet");
    }
    const days = (Date.parse(h.expires_at) - Date.now()) / DAY;
    assert.ok(days > 364 && days < 366, `expires in a year (${days})`);
    assert.equal(h.recording_status, "failed", R2_KEYS ? "the source can't be fetched" : "no R2 keys: the copy waits");
    if (R2_KEYS) {
      // The copy was tried (example.invalid never answers, so nothing reached
      // the bucket), and the hold points at the class's prefix from then on.
      assert.equal(h.recording_key, hr.holdRecordingPrefix(A.id));
    } else {
      assert.equal(h.recording_key, null, "nothing reached the bucket");
    }
    const { data: c } = await admin.from("classes").select("keep_evidence").eq("id", A.id).single();
    assert.equal(c!.keep_evidence, true);
    const { data: ev } = await admin.from("class_events").select("kind, detail").eq("class_id", A.id).eq("kind", "hold_created");
    assert.ok(ev?.some((e) => (e.detail as { holdId: string }).holdId === holdS1));
  });

  await step("one row per subject per class: a second hold refreshes it; a class-wide hold is its own row", async () => {
    const again = await holds.holdClass(A.id, { reason: "class_report", subjectUserId: acc.s1.id, notes: "second report" });
    assert.ok(again.ok);
    if (!again.ok) return;
    assert.equal(again.holdIds[0], holdS1);
    const { data: h } = await admin.from("class_safety_holds").select("notes, reason").eq("id", holdS1).single();
    assert.equal(h!.reason, "urgent_flag", "the first reason stays");
    assert.match(h!.notes ?? "", /Held again: a report about the class\. second report/);
    const wide = await holds.holdClass(A.id, { reason: "refusal" });
    assert.ok(wide.ok);
    if (!wide.ok) return;
    holdWide = wide.holdIds[0];
    assert.notEqual(holdWide, holdS1);
    const { data: w } = await admin.from("class_safety_holds").select("subject_user_id, peer_reports").eq("id", holdWide).single();
    assert.equal(w!.subject_user_id, null);
    assert.equal((w!.peer_reports as unknown[]).length, 1, "class-wide: the teacher's peers only");
    await holds.holdWorkSettled();
  });

  await step(
    R2_KEYS
      ? "with R2 keys the ledger logs each failed try with its key, never missing keys"
      : "without R2 keys the recording ledger says so once, not on every retry",
    async () => {
      await holds.copyHeldRecordings(A.id);
      await holds.copyHeldRecordings(A.id, { force: true });
      const { data: ev } = await admin
        .from("class_events")
        .select("detail")
        .eq("class_id", A.id)
        .eq("kind", "hold_recording");
      const rows = (ev ?? []).map((e) => e.detail as { status?: string; key?: string; error?: string });
      const notConfigured = rows.filter((d) => d.error === "r2_not_configured");
      if (R2_KEYS) {
        assert.equal(notConfigured.length, 0, `ledger rows: ${JSON.stringify(rows)}`);
        const failed = rows.filter((d) => d.status === "failed");
        assert.ok(failed.length >= 2, `a failed row per try: ${JSON.stringify(rows)}`);
        assert.ok(failed.every((d) => d.key === hr.holdRecordingKey(A.id, sessionA) && !!d.error), JSON.stringify(failed));
      } else {
        assert.equal(notConfigured.length, 1, `ledger rows: ${JSON.stringify(rows)}`);
      }
    }
  );

  await step("a ban leaves a hold after the account is gone; consents keep their handles", async () => {
    const r = await profile.deleteAccountData(user("s2"), { supabase: admin, admin }, { reason: "ban" });
    assert.deepEqual(r, { ok: true });
    await holds.holdWorkSettled();
    const gone = await admin.auth.admin.getUserById(acc.s2.id);
    assert.ok(!gone.data.user, "auth user deleted");
    const { data: h } = await admin.from("class_safety_holds").select("*").eq("subject_user_id", acc.s2.id);
    assert.equal(h?.length, 1, "one hold: the one class s2 was in");
    assert.equal(h![0].reason, "ban");
    assert.equal(h![0].class_id, A.id);
    assert.equal(h![0].subject_email, acc.s2.email, "email kept from before the deletion");
    assert.equal(h![0].subject_handle, handle("s2"));
    assert.ok((h![0].chat as { body: string }[]).some((m) => m.body.startsWith("my email is")), "their blocked message is held");
    const { data: consent } = await admin.from("class_consents").select("user_id, user_handle, account_deleted_at").eq("user_handle", handle("s2"));
    assert.equal(consent?.length, 1);
    assert.equal(consent![0].user_id, null);
    assert.ok(consent![0].account_deleted_at);
    const { data: parent } = await admin
      .from("class_parent_consents")
      .select("student_id, student_handle, account_deleted_at")
      .eq("student_handle", handle("s2"));
    assert.equal(parent![0].student_id, null);
    assert.ok(parent![0].account_deleted_at);
    // The safety lead hears about it (the dev outbox, never a real email).
    const outbox = process.env.EMAIL_DEV_OUTBOX!;
    const mails = existsSync(outbox) ? readdirSync(outbox).map((f) => readFileSync(join(outbox, f), "utf8")) : [];
    const notice = mails.find((m) => m.includes("evidence kept for a banned account"));
    assert.ok(notice, `notice in the outbox (${mails.length} messages)`);
    assert.ok(notice!.includes("lftest-safety@example.com"), "to the safety address");
    assert.ok(!notice!.includes(acc.s2.email), "the email has no email address in it");
  });

  await step("a self-delete with an open class report leaves a hold; without a case, none", async () => {
    must(
      await admin.from("user_reports").insert({
        reporter_id: acc.s1.id,
        reported_user_id: acc.s3.id,
        reported_username: handle("s3"),
        content_kind: "class",
        content_id: A.id,
        content_snapshot: { classId: A.id, classTitle: "lftest safety-holds restricted class", role: "student" },
        surface: "class",
        platform: "web",
        reason: "unsafe",
        status: "open",
      }),
      "report"
    );
    const r = await profile.deleteAccountData(user("s3"), { supabase: admin, admin });
    assert.deepEqual(r, { ok: true });
    await holds.holdWorkSettled();
    assert.ok(!(await admin.auth.admin.getUserById(acc.s3.id)).data.user, "auth user deleted");
    const { data: h } = await admin.from("class_safety_holds").select("reason, subject_email, subject_handle, class_id").eq("subject_user_id", acc.s3.id);
    assert.equal(h?.length, 1);
    assert.equal(h![0].reason, "self_delete_open_case");
    assert.equal(h![0].subject_email, acc.s3.email);
    assert.equal(h![0].subject_handle, handle("s3"));
    const { data: consent } = await admin.from("class_consents").select("user_id, user_handle").eq("user_handle", handle("s3"));
    assert.equal(consent![0].user_id, null);

    const plain = await profile.deleteAccountData(user("s4"), { supabase: admin, admin });
    assert.deepEqual(plain, { ok: true });
    const { count } = await admin.from("class_safety_holds").select("id", { count: "exact", head: true }).eq("subject_user_id", acc.s4.id);
    assert.equal(count, 0, "no open case, no hold");
    const { data: c4 } = await admin.from("class_consents").select("user_id, user_handle").eq("user_handle", handle("s4"));
    assert.equal(c4![0].user_id, null, "consent proof survives a plain self-delete too");
  });

  await step("the safety lead opens class pages, restricted included, and no other /admin page", async () => {
    await setLead(acc.lead.id);
    leadSet = true;
    const g = await reviewers.requireClassReviewer(user("lead"));
    assert.ok(g.ok && g.role === "safety_lead" && g.safetyLead && !g.superAdmin, JSON.stringify(g));
    assert.equal(await reviewers.canSeeRestricted(user("lead")), true);
    assert.equal(await access.siteRoleFor(user("lead")), "member");
    const reports = await reportsDesk.loadReportsDesk(user("lead"));
    assert.ok(!reports.ok && reports.code === "forbidden", "no /admin/reports");
    const summary = await dashboard.loadAdminSummary(user("lead"));
    assert.ok(!summary.ok && summary.code === "forbidden", "no /admin");
    const desk = await holds.loadHoldsDesk(user("lead"));
    assert.ok(desk.ok);
    if (!desk.ok) return;
    const mine = desk.holds.find((x) => x.id === holdS1);
    assert.ok(mine && !mine.hidden && mine.restricted, "restricted hold in full");
    if (mine && !mine.hidden) assert.equal(mine.subjectEmail, acc.s1.email);
    const one = await holds.loadHold(user("lead"), holdS1);
    assert.ok(one.ok && !one.hold.hidden && one.hold.transcript.length === 3);
    const { data: viewed } = await admin.from("class_events").select("actor_id").eq("kind", "hold_viewed").eq("actor_id", acc.lead.id);
    assert.ok((viewed ?? []).length >= 1, "the view is logged");
  });

  await step("a super admin sees restricted holds only as \"Dhiren is handling this one\"", async () => {
    const g = await reviewers.requireClassReviewer(user("boss"));
    assert.ok(g.ok && g.role === "superadmin");
    assert.equal(await reviewers.canSeeRestricted(user("boss")), false);
    assert.equal(reviewers.RESTRICTED_PLACEHOLDER, "Dhiren is handling this one.");
    const desk = await holds.loadHoldsDesk(user("boss"));
    assert.ok(desk.ok);
    if (!desk.ok) return;
    const restricted = desk.holds.filter((x) => x.class?.id === A.id);
    assert.ok(restricted.length >= 3, "s1, class-wide, s2 and s3 holds");
    assert.ok(restricted.every((x) => x.hidden && x.placeholder === "Dhiren is handling this one."));
    const json = JSON.stringify(desk);
    assert.ok(!json.includes(acc.s1.email) && !json.includes("add me on snap") && !json.includes("lftest marker line"));
    const one = await holds.loadHold(user("boss"), holdS1);
    assert.ok(one.ok && one.hold.hidden, "the detail page is a placeholder too");
    assert.ok(!JSON.stringify(one).includes("lftest marker line"));
    const note = await holds.noteHold(user("boss"), { holdId: holdS1, note: "x" });
    assert.ok(!note.ok && note.code === "forbidden");
    const links = await holds.heldRecordingLinks(user("boss"), A.id);
    assert.ok(!links.ok && links.code === "forbidden", "no recording link for a restricted class");
    const rel = await holds.releaseHold(user("boss"), { holdId: holdS1 });
    assert.ok(!rel.ok && rel.code === "forbidden", "only the safety lead releases");
    const mem = await reviewers.requireClassReviewer(user("mem"));
    assert.ok(!mem.ok && mem.code === "forbidden");
    const memDesk = await holds.loadHoldsDesk(user("mem"));
    assert.ok(!memDesk.ok && memDesk.code === "forbidden");
  });

  await step("notes, the CyberTipline number, extend and release", async () => {
    const bad = await holds.noteHold(user("lead"), { holdId: holdS1, ncmecReportId: "call me maybe" });
    assert.ok(!bad.ok && bad.field === "ncmecReportId");
    const n = await holds.noteHold(user("lead"), { holdId: holdS1, note: "Spoke to the parent.", ncmecReportId: "123456789" });
    assert.ok(n.ok, JSON.stringify(n));
    const e = await holds.extendHold(user("lead"), { holdId: holdS1, note: "Law enforcement asked." });
    assert.ok(e.ok, JSON.stringify(e));
    const empty = await holds.extendHold(user("lead"), { holdId: holdS1, note: "" });
    assert.ok(!empty.ok && empty.field === "note");
    const { data: h } = await admin.from("class_safety_holds").select("notes, ncmec_report_id").eq("id", holdS1).single();
    assert.equal(h!.ncmec_report_id, "123456789");
    assert.match(h!.notes!, /\(@lftest_safetyholds_lead\): CyberTipline report number 123456789\./);
    assert.match(h!.notes!, /Spoke to the parent\./);
    assert.match(h!.notes!, /Kept until .*: Law enforcement asked\./);
    const links = await holds.heldRecordingLinks(user("lead"), A.id);
    assert.ok(!links.ok, "nothing of class A is in the bucket (no keys, or a source that never answers)");
    const r = await holds.releaseHold(user("lead"), { holdId: holdS1, note: "fine for Jahaan to see" });
    assert.ok(r.ok && r.released === 1, JSON.stringify(r));
    const desk = await holds.loadHoldsDesk(user("boss"));
    assert.ok(desk.ok);
    if (!desk.ok) return;
    const released = desk.holds.find((x) => x.id === holdS1);
    assert.ok(released && !released.hidden, "a released hold shows to super admins");
    const wide = desk.holds.find((x) => x.id === holdWide);
    assert.ok(wide?.hidden, "the other holds of the class stay restricted");
    const whole = await holds.releaseHold(user("lead"), { classId: A.id });
    assert.ok(whole.ok && whole.released >= 3, JSON.stringify(whole));
    const { data: rv } = await admin.from("class_reviews").select("restricted").eq("class_id", A.id).single();
    assert.equal(rv!.restricted, false, "releasing the class releases its review too");
  });

  await step("the sweep: peer reports and late chat are picked up", async () => {
    const { data: before } = await admin.from("class_safety_holds").select("peer_reports").eq("id", holdS1).single();
    // Failed for a reason that can pass (a timeout) hours ago, so the sweep
    // asks again, keys or not. (A 4xx for a made-up peer is never retried.)
    const aged = (before!.peer_reports as { fetchedAt: string }[]).map((p) => ({
      ...p,
      ok: false,
      error: "timeout",
      fetchedAt: new Date(Date.now() - 7 * 3600_000).toISOString(),
    }));
    must(await admin.from("class_safety_holds").update({ peer_reports: aged }).eq("id", holdS1), "age peer reports");
    must(
      await admin.from("class_chat_messages").insert({
        class_id: A.id, sender_id: acc.t1.id, sender_username: handle("t1"), sender_role: "teacher", body: "late message", status: "shown", blocked_kinds: [],
      }),
      "late chat"
    );
    const s = await holds.retryHoldWork({ classId: A.id });
    assert.ok(s.peerReportsRetried >= 2, JSON.stringify(s));
    assert.ok(s.snapshotsRefreshed >= 1, JSON.stringify(s));
    const { data: after } = await admin.from("class_safety_holds").select("peer_reports, chat").eq("id", holdS1).single();
    assert.ok((after!.peer_reports as { fetchedAt: string }[]).every((p) => Date.now() - Date.parse(p.fetchedAt) < 10 * MIN));
    assert.equal((after!.chat as unknown[]).length, 5);
  });

  await step("expired holds are deleted, live ones stay", async () => {
    const r = await holds.holdClassByHand(user("boss"), { classId: B.id, note: "lftest manual hold" });
    assert.ok(r.ok, JSON.stringify(r));
    if (!r.ok) return;
    const noAccess = await holds.holdClassByHand(user("mem"), { classId: B.id });
    assert.ok(!noAccess.ok && noAccess.code === "forbidden");
    must(
      await admin.from("class_safety_holds").update({ expires_at: new Date(Date.now() - MIN).toISOString() }).eq("id", r.holdIds[0]),
      "expire"
    );
    const d = await holds.deleteExpiredHolds({ classId: B.id });
    assert.equal(d.deleted, 1, JSON.stringify(d));
    const { count } = await admin.from("class_safety_holds").select("id", { count: "exact", head: true }).eq("id", r.holdIds[0]);
    assert.equal(count, 0);
    const { count: live } = await admin.from("class_safety_holds").select("id", { count: "exact", head: true }).eq("class_id", A.id);
    assert.ok((live ?? 0) >= 4, "class A's holds are untouched");
    const { data: ev } = await admin.from("class_events").select("detail").eq("class_id", B.id).eq("kind", "hold_expired");
    assert.equal(ev?.length, 1);
  });

  // ── Over HTTP, against this worktree's dev server ───────────────────
  const devUrl = process.env.HOLDS_DEV_URL;
  if (devUrl) {
    // Restricted again for the page checks: a fresh refusal hold on class A.
    must(await admin.from("class_reviews").update({ restricted: true }).eq("class_id", A.id), "re-restrict");
    must(await admin.from("class_safety_holds").update({ released_at: null, released_by: null }).eq("class_id", A.id), "unrelease");
    const cookies = {
      lead: await sessionCookie(acc.lead),
      boss: await sessionCookie(acc.boss),
      mem: await sessionCookie(acc.mem),
    };
    const get = async (path: string, who: keyof typeof cookies | null) => {
      const res = await fetch(`${devUrl}${path}`, {
        headers: who ? { Cookie: cookies[who] } : {},
        redirect: "manual",
        signal: AbortSignal.timeout(180_000),
      });
      return { status: res.status, location: res.headers.get("location"), body: await res.text() };
    };
    await step("http: the safety lead gets the holds, a hold and the playbook; /admin, /admin/reports and /admin/team stay locked", async () => {
      const list = await get("/admin/classes/holds", "lead");
      assert.equal(list.status, 200);
      assert.ok(list.body.includes("What LearnFRC is keeping"));
      assert.ok(list.body.includes(handle("s1")), "restricted hold shown to the safety lead");
      const one = await get(`/admin/classes/holds/${holdS1}`, "lead");
      assert.equal(one.status, 200);
      assert.ok(one.body.includes("restricted / safety lead only"));
      assert.ok(one.body.includes("lftest marker line for the hold"));
      assert.ok(one.body.includes("add me on snap"), "blocked chat in the hold");
      const pb = await get("/admin/classes/playbook", "lead");
      assert.equal(pb.status, 200);
      assert.ok(pb.body.includes("call or text 988") && pb.body.includes("report.cybertip.org"));
      for (const path of ["/admin", "/admin/reports", "/admin/team"]) {
        const r = await get(path, "lead");
        assert.equal(r.status, 200, path);
        assert.ok(/This drawer is locked|super admins only/i.test(r.body), `${path} is locked for the safety lead`);
        assert.ok(!r.body.includes(handle("s1")), `${path} shows nothing about the classes`);
      }
    });
    await step("http: a super admin sees the placeholder; a member is locked out; signed out goes to /login", async () => {
      const list = await get("/admin/classes/holds", "boss");
      assert.equal(list.status, 200);
      assert.ok(list.body.includes("Dhiren is handling this one."));
      assert.ok(!list.body.includes(acc.s1.email));
      const one = await get(`/admin/classes/holds/${holdS1}`, "boss");
      assert.ok(one.body.includes("Dhiren is handling this one."));
      assert.ok(!one.body.includes("lftest marker line for the hold") && !one.body.includes("add me on snap"));
      const mem = await get("/admin/classes/holds", "mem");
      assert.ok(mem.body.includes("This drawer is locked.") && !mem.body.includes(handle("s1")));
      const memPb = await get("/admin/classes/playbook", "mem");
      assert.ok(memPb.body.includes("This drawer is locked.") && !memPb.body.includes("call or text 988"));
      const anon = await get("/admin/classes/holds", null);
      assert.ok([307, 303, 302].includes(anon.status) && (anon.location ?? "").includes("/login"), `${anon.status} ${anon.location}`);
    });
  } else {
    console.log("skip http checks (no HOLDS_DEV_URL)");
  }

  const realCopy = "a recording copied to learnfrc-class-holds-dev, linked for 15 minutes and deleted when its hold expires";
  if (R2_KEYS) {
    await step(`${realCopy} (from a local stand-in for RealtimeKit's link)`, async () => {
      const config = await import("../../../src/lib/classes/config.ts");
      const r2 = await import("../../../src/lib/classes/r2.ts");
      const bucket = config.r2HoldsBucket();
      assert.equal(bucket, "learnfrc-class-holds-dev", "only ever the dev bucket");
      const r2cfg = { accountId: config.cloudflareAccountId()!, bucket, ...config.r2Credentials()! };

      // Two parts' worth (R2 parts are 10 MB), served like RealtimeKit's download link.
      const size = hr.RECORDING_PART_BYTES + 1_234_567;
      const payload = randomBytes(size);
      const sha = createHash("sha256").update(payload).digest("hex");
      const server = createServer((req, res) => {
        if (req.url !== "/lftest-safetyholds-c.mp4") {
          res.writeHead(404).end();
          return;
        }
        res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": String(size) });
        res.end(payload);
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const port = (server.address() as AddressInfo).port;
      const C = await newClass("lftest safety-holds recording class", acc.t1.id, { startedMinAgo: 90, status: "ended" });
      const prefix = hr.holdRecordingPrefix(C.id);
      const sessionC = `lftest-safetyholds-${C.id.slice(0, 8)}-s1`;
      try {
        must(
          await admin.from("class_sessions").insert({
            id: sessionC,
            class_id: C.id,
            started_at: C.starts_at,
            ended_at: new Date(Date.parse(C.starts_at) + 32 * MIN).toISOString(),
            recording_url: `http://127.0.0.1:${port}/lftest-safetyholds-c.mp4`,
            recording_expires_at: new Date(Date.now() + 6 * DAY).toISOString(),
            transcript_status: "missing",
          }),
          "session C"
        );
        const held = await holds.holdClass(C.id, { reason: "urgent_flag" });
        assert.ok(held.ok, JSON.stringify(held));
        if (!held.ok) return;
        await holds.holdWorkSettled();
        const { data: h } = await admin.from("class_safety_holds").select("recording_status, recording_key").eq("id", held.holdIds[0]).single();
        assert.deepEqual(h, { recording_status: "stored", recording_key: prefix });
        const { data: ev } = await admin.from("class_events").select("detail").eq("class_id", C.id).eq("kind", "hold_recording");
        const stored = (ev ?? []).map((e) => e.detail as { status: string; bytes?: number; parts?: number; bucket?: string }).find((d) => d.status === "stored");
        assert.deepEqual(
          stored && { bytes: stored.bytes, parts: stored.parts, bucket: stored.bucket },
          { bytes: size, parts: 2, bucket },
          JSON.stringify(ev)
        );
        const head = await r2.headObject(r2cfg, hr.holdRecordingKey(C.id, sessionC));
        assert.ok(head.ok, JSON.stringify(head));

        // The safety lead's 15-minute link serves the same bytes, and is logged.
        const links = await holds.heldRecordingLinks(user("lead"), C.id);
        assert.ok(links.ok, JSON.stringify(links));
        if (!links.ok) return;
        const link = links.links[0];
        assert.equal(new URL(link.url).searchParams.get("X-Amz-Expires"), String(hr.RECORDING_LINK_SECONDS));
        const mins = (Date.parse(link.expiresAt) - Date.now()) / MIN;
        assert.ok(mins > 14 && mins <= 15, `expires in 15 minutes (${mins})`);
        const got = await fetch(link.url);
        assert.equal(got.status, 200);
        assert.equal(createHash("sha256").update(Buffer.from(await got.arrayBuffer())).digest("hex"), sha, "the same bytes");
        const unsigned = await fetch(link.url.split("?")[0]);
        assert.notEqual(unsigned.status, 200, "the bucket refuses an unsigned read");
        await unsigned.arrayBuffer().catch(() => null);
        const { count: opened } = await admin
          .from("class_events")
          .select("id", { count: "exact", head: true })
          .eq("class_id", C.id)
          .eq("kind", "hold_recording_opened");
        assert.equal(opened, 1, "the link is logged");

        // The hold expires: the daily sweep deletes the row and the recording.
        must(
          await admin.from("class_safety_holds").update({ expires_at: new Date(Date.now() - MIN).toISOString() }).eq("class_id", C.id),
          "expire C"
        );
        const d = await holds.deleteExpiredHolds({ classId: C.id });
        assert.deepEqual(d, { deleted: 1, kept: 0 });
        const left = await r2.listKeys(r2cfg, prefix);
        assert.ok(left.ok && left.keys.length === 0, JSON.stringify(left));
        const after = await fetch(link.url);
        assert.notEqual(after.status, 200, "the old link is dead");
        await after.arrayBuffer().catch(() => null);
      } finally {
        server.close();
        // Whatever happened above, nothing of this check stays in the bucket.
        const gone = await r2.deletePrefix(r2cfg, prefix);
        if (!gone.ok) console.log(`could not empty ${prefix}: ${gone.error}`);
      }
    });
  } else {
    needsKeys(realCopy);
  }
  needsKeys(
    "peer reports fetched from RealtimeKit (a real peer)",
    RTK_KEYS ? "needs a real peer in a live meeting (the flow test, 6.10)" : "needs keys"
  );

  await step("with the safety lead set back, the lead account is out", async () => {
    await setLead(prevLead);
    leadSet = false;
    const g = await reviewers.requireClassReviewer(user("lead"));
    assert.ok(!g.ok && g.code === "forbidden");
  });

}

try {
  await main();
} catch (e) {
  results.push({ name: "setup", ok: false, error: (e as Error).message });
  console.log(`FAIL setup: ${(e as Error).message}`);
} finally {
  if (leadSet) await setLead(prevLead).catch((e) => console.log(`could not restore the safety lead: ${e.message}`));
  console.log("--- cleanup ---");
  const acc = readCredentials(PKG).accounts as Record<string, Account>;
  const ids = Object.values(acc ?? {}).map((a) => a.id);
  // Hold events about the package's accounts that have no class (account holds).
  if (ids.length) {
    await admin
      .from("class_events")
      .delete()
      .is("class_id", null)
      .like("kind", "hold_%")
      .in("detail->>subjectUserId", ids);
  }
  await cleanup(PKG);
  await check(PKG);
  const failed = results.filter((r) => !r.ok);
  const keys = results.filter((r) => r.needsKeys).length;
  console.log(`\n${results.length - failed.length - keys}/${results.length - keys} passed, ${keys} skipped`);
  console.log(`outbox: ${join(devDir(), "outbox", PKG)} (removed by cleanup)`);
  process.exit(failed.length ? 1 : (process.exitCode ?? 0));
}
