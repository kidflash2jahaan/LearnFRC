// The letters package's checks against production with throwaway accounts
// (classes-design.md 15.2, the letters row):
//   - only approved classes count, and the totals match;
//   - requests wait for the safety lead, and the code exists only after
//     approval (only the safety lead signs; the request must still match
//     the records);
//   - owner, staff, listed and letters_blocked accounts are refused;
//   - the teacher can't change the name;
//   - verify shows valid, withdrawn and not found, and rate-limits;
//   - the open and daily request limits, decline, withdraw, the letter's
//     viewers, the dev/prod app guard, the emails in the dev outbox, and
//     everything hidden while classes are switched off.
//
// The teachers and safety-holds packages own getTeacher and
// requireClassReviewer, which are still Foundation stubs on this branch
// (getTeacher returns null, requireClassReviewer denies). This check swaps
// in fakes with the same signatures and the design's rules
// (checks/fakes/*.ts) and records that the letters code called them;
// integration runs it against the real ones.
//
// "Approved through the admin action": decideClass (webhooks-and-review)
// isn't on this branch, so the check approves its test classes the way the
// design says that action does: status approved, credited_minutes frozen
// from credited_minutes_computed, decided_at and decided_by set.
//
// Everything it makes is deleted at the end (test-data.mjs cleanup letters).
//
//   node --import ./scripts/classes/register.mjs scripts/classes/checks/letters.check.ts

import assert from "node:assert/strict";
// First: swaps the two neighbour stubs for fakes before anything imports
// them (every src import below is dynamic).
import { fakeCalls as recordedCalls } from "./fakes/use-fakes.mjs";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv, repoRoot } from "../env.mjs";
import { create, cleanup, check, readCredentials } from "../test-data.mjs";

loadEnv();
process.env.CLASSES_DEV_SWITCHES = "1";
delete process.env.VERCEL_ENV;

const fakeCalls = recordedCalls() as { name: string; arg: unknown }[];

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

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Account = { id: string; email: string; password: string; username: string | null };
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

const outbox = () => process.env.EMAIL_DEV_OUTBOX || join(repoRoot, ".claude-scratch/classes-dev/outbox", PKG);
function outboxMessages(): { to: string[]; subject: string; html: string }[] {
  const dir = outbox();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
}

/** A class the way the admin action leaves an approved one. */
async function approvedClass(
  title: string,
  teacherId: string,
  startsAt: Date,
  minutes: number | null,
  opts: { status?: string; rtkApp?: "dev" | "prod"; decidedBy?: string } = {}
): Promise<string> {
  const { data, error } = await admin
    .from("classes")
    .insert({
      teacher_id: teacherId,
      title: `lftest letters ${title}`,
      starts_at: startsAt.toISOString(),
      duration_minutes: 60,
      hard_end_at: new Date(startsAt.getTime() + 75 * 60_000).toISOString(),
      capacity: 15,
      rtk_app: opts.rtkApp ?? "dev",
      status: "ended",
      ended_at: new Date(startsAt.getTime() + 60 * 60_000).toISOString(),
      credited_minutes_computed: minutes,
    })
    .select("id")
    .single();
  if (error) throw new Error(`class ${title}: ${error.message}`);
  const status = opts.status ?? "approved";
  if (status !== "ended") {
    const { error: e } = await admin
      .from("classes")
      .update({
        status,
        credited_minutes: status === "approved" ? minutes : status === "rejected" ? 0 : null,
        decided_at: new Date().toISOString(),
        decided_by: opts.decidedBy ?? null,
        decision_note: "lftest",
      })
      .eq("id", data.id);
    if (e) throw new Error(`approve ${title}: ${e.message}`);
  }
  return data.id as string;
}

async function setSafetyLead(id: string | null) {
  const { error } = await admin.from("class_settings").update({ safety_lead_user_id: id }).eq("id", true);
  if (error) throw new Error(`class_settings: ${error.message}`);
}

async function main() {
  await cleanup(PKG); // a clean start if an earlier run stopped halfway
  const { data: settingsBefore } = await admin.from("class_settings").select("safety_lead_user_id").eq("id", true).single();
  const leadBefore = (settingsBefore?.safety_lead_user_id as string | null) ?? null;
  let leadSetByUs: string | null = null;

  try {
    await create(PKG, [
      "t1:age=16:parent=agreed:teacher",
      "t2:age=15:parent=agreed:teacher",
      "owner:teacher",
      "staff:teacher:admin",
      "listed:teacher",
      "blocked:teacher",
      "boss:superadmin",
      "lead",
      "nobody:age=14:parent=agreed",
    ]);
    const acc = readCredentials(PKG).accounts as Record<string, Account>;
    const user = (k: string) => ({ id: acc[k].id, email: acc[k].email, created_at: new Date().toISOString() });

    // The owner is whoever ADMIN_EMAILS names; auth.ts reads it when it loads.
    process.env.ADMIN_EMAILS = acc.owner.email;
    process.env.CLASSES_NO_LETTER_USER_IDS = `${acc.listed.id}, 00000000-0000-0000-0000-000000000000`;
    await admin.from("class_teachers").update({ letters_blocked: true }).eq("user_id", acc.blocked.id);

    const letters = await import("../../../src/lib/classes/letters.ts");
    const rules = await import("../../../src/lib/classes/letter-rules.ts");
    const { SITE_URL } = await import("../../../src/lib/classes/config.ts");
    const { LETTER_SENTENCES: S } = letters;
    const today = rules.pacificDate(new Date());
    const boss = acc.boss.id;

    // t1's classes. Default range (Aug 1 to today): c1 + c2 + c3 = 135 minutes.
    const c1 = await approvedClass("c1 approved", acc.t1.id, daysAgo(5), 45, { decidedBy: boss });
    const c2 = await approvedClass("c2 approved", acc.t1.id, daysAgo(12), 60, { decidedBy: boss });
    const c3 = await approvedClass("c3 approved", acc.t1.id, daysAgo(30), 30, { decidedBy: boss });
    const c4 = await approvedClass("c4 rejected", acc.t1.id, daysAgo(8), 50, { status: "rejected", decidedBy: boss });
    const c5 = await approvedClass("c5 ended", acc.t1.id, daysAgo(3), 40, { status: "ended" });
    const c6 = await approvedClass("c6 in review", acc.t1.id, daysAgo(4), 40, { status: "in_review" });
    const c7 = await approvedClass("c7 empty room", acc.t1.id, daysAgo(9), 0, { decidedBy: boss });
    const c8 = await approvedClass("c8 prod app", acc.t1.id, daysAgo(7), 50, { rtkApp: "prod", decidedBy: boss });
    const c9 = await approvedClass("c9 july", acc.t1.id, new Date("2026-07-15T18:00:00.000Z"), 40, { decidedBy: boss });
    const c10 = await approvedClass("c10 t2", acc.t2.id, daysAgo(6), 55, { decidedBy: boss });
    for (const k of ["owner", "staff", "listed", "blocked"]) {
      await approvedClass(`${k} class`, acc[k].id, daysAgo(4), 30, { decidedBy: boss });
    }
    const period = rules.defaultLetterPeriod();

    await step("hidden: the teacher desk and requests refuse while classes are off", async () => {
      process.env.CLASSES_DEV_SWITCHES = "";
      const visibleBefore = process.env.CLASSES_VISIBLE;
      delete process.env.CLASSES_VISIBLE;
      try {
        const desk = await letters.loadTeacherLetterDesk(user("t1"));
        assert.equal(desk.ok, false);
        if (!desk.ok) assert.equal(desk.error, S.hidden);
        const r = await letters.requestHoursLetter(user("t1"), period);
        assert.equal(r.ok, false);
        if (!r.ok) assert.equal(r.error, S.hidden);
        const { count } = await admin.from("hours_letters").select("*", { count: "exact", head: true }).eq("teacher_id", acc.t1.id);
        assert.equal(count, 0);
      } finally {
        process.env.CLASSES_DEV_SWITCHES = "1";
        if (visibleBefore !== undefined) process.env.CLASSES_VISIBLE = visibleBefore;
      }
    });

    await step("only teachers: a student who isn't one is refused", async () => {
      const r = await letters.requestHoursLetter(user("nobody"), period);
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.error, S.notTeacher);
      const d = await letters.loadTeacherLetterDesk(user("nobody"));
      assert.equal(d.ok, false);
    });

    await step("only approved classes count, in this app, with minutes, and the totals match", async () => {
      const d = await letters.loadTeacherLetterDesk(user("t1"));
      assert.equal(d.ok, true);
      if (!d.ok) return;
      assert.equal(d.desk.letterName, "Lftest T1");
      assert.equal(d.desk.blocked, false);
      assert.deepEqual(new Set(d.desk.classes.map((c) => c.classId)), new Set([c1, c2, c3, c9]));
      for (const id of [c4, c5, c6, c7, c8, c10]) assert.equal(d.desk.classes.some((c) => c.classId === id), false);
      assert.equal(d.desk.defaultPeriod.end, today);
      assert.equal(d.desk.defaultPeriod.start, rules.schoolYearStart(today));
      const inDefault = d.desk.classes.filter((c) => c.date >= period.start && c.date <= period.end);
      assert.deepEqual(rules.letterTotals(inDefault), { totalMinutes: 135, classCount: 3 });
      assert.ok(fakeCalls.some((c) => c.name === "getTeacher" && c.arg === acc.t1.id), "getTeacher was called");
    });

    await step("bad ranges are refused with the field they're about", async () => {
      const tomorrow = rules.pacificDate(new Date(Date.now() + DAY));
      const future = await letters.requestHoursLetter(user("t1"), { start: period.start, end: tomorrow });
      assert.equal(future.ok, false);
      if (!future.ok) assert.equal(future.field, "end");
      const backwards = await letters.requestHoursLetter(user("t1"), { start: today, end: period.start });
      assert.equal(backwards.ok, false);
      if (!backwards.ok) assert.equal(backwards.field, "start");
      const empty = await letters.requestHoursLetter(user("t1"), { start: "2026-07-20", end: "2026-07-21" });
      assert.equal(empty.ok, false);
      if (!empty.ok) assert.equal(empty.error, S.noClasses);
      const junk = await letters.requestHoursLetter(user("t1"), { start: "yesterday", end: 5 });
      assert.equal(junk.ok, false);
    });

    let firstId = "";
    await step("a request snapshots the classes with the locked name, and has no code", async () => {
      // A name sent along with the request is ignored: the teacher can't change it.
      const input = { ...period, letterName: "Somebody Else", letter_name: "Somebody Else" } as unknown as {
        start: string;
        end: string;
      };
      const r = await letters.requestHoursLetter(user("t1"), input);
      assert.equal(r.ok, true, r.ok ? "" : r.error);
      if (!r.ok) return;
      firstId = r.id;
      assert.equal(r.classCount, 3);
      assert.equal(r.totalMinutes, 135);
      const { data: row } = await admin.from("hours_letters").select("*").eq("id", r.id).single();
      assert.equal(row.status, "requested");
      assert.equal(row.code, null);
      assert.equal(row.issued_at, null);
      assert.equal(row.letter_name, "Lftest T1");
      assert.equal(row.total_minutes, 135);
      assert.equal(row.class_count, 3);
      assert.equal(row.period_start, period.start);
      assert.equal(row.period_end, period.end);
      assert.deepEqual(
        (row.classes as { classId: string }[]).map((c) => c.classId),
        [c3, c2, c1]
      );
      assert.deepEqual(
        (row.classes as { minutes: number }[]).map((c) => c.minutes),
        [30, 60, 45]
      );
      assert.equal(row.coordinator_name, "Dhiren Pardhanani");
      assert.equal(row.coordinator_email, "dpardhanani@gmail.com");
      const { data: ev } = await admin.from("class_events").select("kind, actor_id, detail").eq("kind", "letter_requested").eq("actor_id", acc.t1.id);
      assert.equal(ev?.length, 1);
      const mail = outboxMessages().filter((m) => m.subject.includes("hours letter to sign"));
      assert.equal(mail.length, 1);
      assert.deepEqual(mail[0].to, [process.env.CLASSES_SAFETY_EMAIL]);
      assert.match(mail[0].subject, /@lftest_letters_t1/);
      assert.match(mail[0].html, /Lftest T1/);
      assert.match(mail[0].html, /2 hours 15 minutes/);
    });

    await step("owner, staff, listed and letters_blocked accounts are refused", async () => {
      for (const k of ["owner", "staff", "listed", "blocked"]) {
        const r = await letters.requestHoursLetter(user(k), period);
        assert.equal(r.ok, false, k);
        if (!r.ok) assert.equal(r.error, S.noLetters, k);
        const d = await letters.loadTeacherLetterDesk(user(k));
        assert.equal(d.ok && d.desk.blocked, true, `${k} desk shows blocked`);
        const { count } = await admin.from("hours_letters").select("*", { count: "exact", head: true }).eq("teacher_id", acc[k].id);
        assert.equal(count, 0, k);
      }
      assert.match(S.noLetters, /^Letters are signed by Dhiren Pardhanani, who can't sign for you\./);
    });

    await step("only class reviewers reach the desk; a super admin can't sign", async () => {
      const nobodyDesk = await letters.loadLettersDesk(user("nobody"));
      assert.equal(nobodyDesk.ok, false);
      if (!nobodyDesk.ok) assert.equal(nobodyDesk.code, "forbidden");
      const t1Approve = await letters.approveHoursLetter(user("t1"), { id: firstId });
      assert.equal(t1Approve.ok, false);
      const bossDesk = await letters.loadLettersDesk(user("boss"));
      assert.equal(bossDesk.ok, true);
      if (bossDesk.ok) {
        assert.equal(bossDesk.desk.canSign, false);
        const req = bossDesk.desk.requests.find((l) => l.id === firstId);
        assert.ok(req, "the request is on the desk");
        assert.equal(req!.teacherHandle, "lftest_letters_t1");
        assert.deepEqual(req!.drift, []);
        assert.equal(req!.classes.length, 3);
        assert.equal(req!.classes[0].reviewPath, `/admin/classes/${c3}`);
      }
      const r = await letters.approveHoursLetter(user("boss"), { id: firstId });
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.error, S.signerOnly);
      const { data: row } = await admin.from("hours_letters").select("status, code").eq("id", firstId).single();
      assert.deepEqual(row, { status: "requested", code: null });
      assert.ok(fakeCalls.some((c) => c.name === "requireClassReviewer"), "requireClassReviewer was called");
    });

    await setSafetyLead(acc.lead.id);
    leadSetByUs = acc.lead.id;

    await step("signing refuses a request that no longer matches the records", async () => {
      await admin.from("class_teachers").update({ letter_name: "Lftest Renamed" }).eq("user_id", acc.t1.id);
      try {
        const r = await letters.approveHoursLetter(user("lead"), { id: firstId });
        assert.equal(r.ok, false);
        if (!r.ok) assert.equal(r.error, S.nameChanged);
        const desk = await letters.loadLettersDesk(user("lead"));
        assert.equal(desk.ok && desk.desk.requests.find((l) => l.id === firstId)?.currentLetterName, "Lftest Renamed");
      } finally {
        await admin.from("class_teachers").update({ letter_name: "Lftest T1" }).eq("user_id", acc.t1.id);
      }
      await admin.from("classes").update({ credited_minutes: 50 }).eq("id", c2);
      try {
        const r = await letters.approveHoursLetter(user("lead"), { id: firstId });
        assert.equal(r.ok, false);
        if (!r.ok) assert.match(r.error, /c2 approved.*50 minutes now, not 60/);
      } finally {
        await admin.from("classes").update({ credited_minutes: 60 }).eq("id", c2);
      }
      await admin.from("classes").update({ status: "rejected" }).eq("id", c1);
      try {
        const r = await letters.approveHoursLetter(user("lead"), { id: firstId });
        assert.equal(r.ok, false);
        if (!r.ok) assert.match(r.error, /c1 approved.*isn't approved any more/);
      } finally {
        await admin.from("classes").update({ status: "approved" }).eq("id", c1);
      }
      const { data: row } = await admin.from("hours_letters").select("status, code").eq("id", firstId).single();
      assert.deepEqual(row, { status: "requested", code: null });
    });

    let code = "";
    await step("the safety lead signs it: the code exists only now, and the teacher is emailed", async () => {
      const r = await letters.approveHoursLetter(user("lead"), { id: firstId });
      assert.equal(r.ok, true, r.ok ? "" : r.error);
      if (!r.ok) return;
      code = r.code;
      assert.match(code, rules.LETTER_CODE_PATTERN);
      const { data: row } = await admin.from("hours_letters").select("*").eq("id", firstId).single();
      assert.equal(row.status, "issued");
      assert.equal(row.code, code);
      assert.equal(row.approved_by, acc.lead.id);
      assert.ok(row.issued_at);
      const again = await letters.approveHoursLetter(user("lead"), { id: firstId });
      assert.equal(again.ok, false);
      if (!again.ok) assert.equal(again.error, S.answered);
      const { data: ev } = await admin.from("class_events").select("detail").eq("kind", "letter_issued").eq("actor_id", acc.lead.id);
      assert.equal((ev?.[0]?.detail as { code?: string })?.code, code);
      const mail = outboxMessages().filter((m) => m.subject === "Your LearnFRC hours letter is ready");
      assert.equal(mail.length, 1);
      assert.deepEqual(mail[0].to, [acc.t1.email]);
      assert.ok(mail[0].html.includes(`/letters/${code}`));
      assert.ok(mail[0].html.includes(rules.verifyUrlFor(SITE_URL, code)));
    });

    await step("the safety lead can't sign a letter of their own", async () => {
      const { data, error } = await admin
        .from("hours_letters")
        .insert({
          teacher_id: acc.lead.id,
          letter_name: "Lftest Lead",
          period_start: period.start,
          period_end: period.end,
          total_minutes: 30,
          class_count: 1,
          classes: [],
          coordinator_name: "Dhiren Pardhanani",
          coordinator_email: "dpardhanani@gmail.com",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const r = await letters.approveHoursLetter(user("lead"), { id: data.id });
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.error, S.ownLetter);
    });

    await step("the letter page: its teacher, the safety lead and super admins only", async () => {
      const own = await letters.getLetterForViewer(user("t1"), code);
      assert.equal(own?.viewer, "owner");
      assert.equal(own?.letter.letterName, "Lftest T1");
      assert.equal(own?.letter.totalMinutes, 135);
      assert.equal(own?.letter.issuedOn, today);
      assert.equal((await letters.getLetterForViewer(user("lead"), code))?.viewer, "safety_lead");
      assert.equal((await letters.getLetterForViewer(user("boss"), code))?.viewer, "superadmin");
      assert.equal(await letters.getLetterForViewer(user("t2"), code), null);
      assert.equal(await letters.getLetterForViewer(user("nobody"), code), null);
      assert.equal(await letters.getLetterForViewer(null, code), null);
      assert.equal((await letters.getLetterForViewer(user("t1"), code.toLowerCase()))?.viewer, "owner");
      // The QR code on the page encodes exactly the verify URL (the page passes this to InviteQr).
      assert.equal(rules.verifyUrlFor(SITE_URL, code), `${SITE_URL}/verify/${code}`);
    });

    await step("verify: valid, with the letter's facts, however the code is typed", async () => {
      const v = await letters.verifyHoursLetter(code, { rateKey: acc.t2.id });
      assert.equal(v.state, "valid");
      if (v.state !== "valid") return;
      assert.equal(v.letter.letterName, "Lftest T1");
      assert.equal(v.letter.totalMinutes, 135);
      assert.equal(v.letter.classCount, 3);
      assert.equal(v.letter.classes.length, 3);
      assert.equal(v.letter.coordinatorName, "Dhiren Pardhanani");
      assert.equal(v.letter.coordinatorEmail, "dpardhanani@gmail.com");
      assert.equal(v.letter.issuedOn, today);
      assert.equal((await letters.verifyHoursLetter(code.toLowerCase().replace(/-/g, " "), { rateKey: acc.t2.id })).state, "valid");
      assert.equal((await letters.verifyHoursLetter("LF-22222-22222", { rateKey: acc.t2.id })).state, "not_found");
      assert.equal((await letters.verifyHoursLetter("../../etc", { rateKey: acc.t2.id })).state, "not_found");
    });

    await step("verify: a letter from the other RealtimeKit app never verifies here", async () => {
      const mk = async (classId: string, c: string) => {
        const { error } = await admin.from("hours_letters").insert({
          teacher_id: acc.t2.id,
          letter_name: "Lftest T2",
          period_start: period.start,
          period_end: period.end,
          total_minutes: 50,
          class_count: 1,
          classes: [{ classId, date: today, title: "x", topic: null, minutes: 50 }],
          coordinator_name: "Dhiren Pardhanani",
          coordinator_email: "dpardhanani@gmail.com",
          status: "issued",
          code: c,
          issued_at: new Date().toISOString(),
          approved_by: acc.lead.id,
        });
        if (error) throw new Error(error.message);
      };
      await mk(c8, "LF-ZZZZZ-ZZZZ2"); // a prod-app class, read on a dev server
      await mk(c10, "LF-ZZZZZ-ZZZZ3"); // a dev-app class
      assert.equal((await letters.verifyHoursLetter("LF-ZZZZZ-ZZZZ2", { rateKey: acc.t2.id })).state, "not_found");
      assert.equal((await letters.verifyHoursLetter("LF-ZZZZZ-ZZZZ3", { rateKey: acc.t2.id })).state, "valid");
    });

    await step("decline needs a reason, any reviewer can decline, and the teacher is told why", async () => {
      const r = await letters.requestHoursLetter(user("t1"), { start: "2026-07-01", end: today });
      assert.equal(r.ok, true, r.ok ? "" : r.error);
      if (!r.ok) return;
      assert.equal(r.classCount, 4);
      assert.equal(r.totalMinutes, 175);
      const short = await letters.declineHoursLetter(user("boss"), { id: r.id, reason: "no" });
      assert.equal(short.ok, false);
      if (!short.ok) assert.equal(short.field, "reason");
      const nobody = await letters.declineHoursLetter(user("nobody"), { id: r.id, reason: "Not yours to decide." });
      assert.equal(nobody.ok, false);
      const ok = await letters.declineHoursLetter(user("boss"), { id: r.id, reason: "July is before you were a teacher." });
      assert.equal(ok.ok, true);
      const { data: row } = await admin.from("hours_letters").select("status, code, decline_reason").eq("id", r.id).single();
      assert.deepEqual(row, { status: "declined", code: null, decline_reason: "July is before you were a teacher." });
      const again = await letters.declineHoursLetter(user("lead"), { id: r.id, reason: "Twice." });
      assert.equal(again.ok, false);
      const mail = outboxMessages().filter((m) => m.subject === "About your LearnFRC hours letter request");
      assert.equal(mail.length, 1);
      assert.ok(mail[0].html.includes("July is before you were a teacher."));
    });

    await step("at most 3 open requests, and 10 a day", async () => {
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        const r = await letters.requestHoursLetter(user("t1"), period);
        assert.equal(r.ok, true, r.ok ? "" : r.error);
        if (r.ok) ids.push(r.id);
      }
      const fourth = await letters.requestHoursLetter(user("t1"), period);
      assert.equal(fourth.ok, false);
      if (!fourth.ok) assert.equal(fourth.error, S.tooManyOpen);
      for (const id of ids) {
        const d = await letters.declineHoursLetter(user("lead"), { id, reason: "Testing the limits." });
        assert.equal(d.ok, true);
      }
      // 5 asked today so far (1 signed, 4 declined); fill the day to 10.
      const { count } = await admin
        .from("hours_letters")
        .select("*", { count: "exact", head: true })
        .eq("teacher_id", acc.t1.id)
        .gte("requested_at", new Date(Date.now() - DAY).toISOString());
      const filler = Array.from({ length: 10 - (count ?? 0) }, () => ({
        teacher_id: acc.t1.id,
        letter_name: "Lftest T1",
        period_start: period.start,
        period_end: period.end,
        total_minutes: 1,
        class_count: 1,
        classes: [],
        coordinator_name: "Dhiren Pardhanani",
        coordinator_email: "dpardhanani@gmail.com",
        status: "declined",
        decline_reason: "lftest filler",
      }));
      if (filler.length) {
        const { error } = await admin.from("hours_letters").insert(filler);
        if (error) throw new Error(error.message);
      }
      const eleventh = await letters.requestHoursLetter(user("t1"), period);
      assert.equal(eleventh.ok, false);
      if (!eleventh.ok) {
        assert.equal(eleventh.error, S.tooManyToday);
        assert.equal(eleventh.code, "rate_limited");
      }
    });

    await step("withdraw: a reviewer withdraws a signed letter and verify says so", async () => {
      const noReason = await letters.revokeHoursLetter(user("boss"), { id: firstId, reason: "" });
      assert.equal(noReason.ok, false);
      const t1 = await letters.revokeHoursLetter(user("t1"), { id: firstId, reason: "I want to." });
      assert.equal(t1.ok, false);
      const r = await letters.revokeHoursLetter(user("boss"), { id: firstId, reason: "A class was misreported." });
      assert.equal(r.ok, true, r.ok ? "" : r.error);
      const v = await letters.verifyHoursLetter(code, { rateKey: acc.t2.id });
      assert.equal(v.state, "withdrawn");
      if (v.state === "withdrawn") {
        assert.equal(v.revokedOn, today);
        assert.equal(v.code, code);
      }
      const own = await letters.getLetterForViewer(user("t1"), code);
      assert.equal(own?.letter.status, "revoked");
      assert.equal(own?.letter.revokedReason, "A class was misreported.");
      const again = await letters.revokeHoursLetter(user("lead"), { id: firstId, reason: "Again." });
      assert.equal(again.ok, false);
      if (!again.ok) assert.equal(again.error, S.notIssued);
      const mail = outboxMessages().filter((m) => m.subject === "Your LearnFRC hours letter was withdrawn");
      assert.equal(mail.length, 1);
      assert.deepEqual(mail[0].to, [acc.t1.email]);
      const d = await letters.loadTeacherLetterDesk(user("t1"));
      assert.equal(d.ok && d.desk.letters.find((l) => l.id === firstId)?.status, "revoked");
    });

    await step("verify rate-limits at 30 checks an hour", async () => {
      const key = acc.nobody.id;
      const states: string[] = [];
      for (let i = 0; i < 31; i++) states.push((await letters.verifyHoursLetter(code, { rateKey: key })).state);
      assert.equal(states.slice(0, 30).every((s) => s === "withdrawn"), true, states.join(","));
      assert.equal(states[30], "rate_limited");
    });

    await step("no email from this package has an em dash", async () => {
      const all = outboxMessages();
      assert.ok(all.length >= 6, `outbox has ${all.length}`);
      for (const m of all) {
        assert.equal(m.subject.includes("\u2014"), false, m.subject);
        assert.equal(m.html.includes("\u2014"), false, m.subject);
      }
    });
  } finally {
    // Put the shared settings row back, unless someone else changed it since.
    if (leadSetByUs) {
      const { data } = await admin.from("class_settings").select("safety_lead_user_id").eq("id", true).single();
      if (data?.safety_lead_user_id === leadSetByUs) await setSafetyLead(leadBefore);
    }
    await cleanup(PKG);
    await check(PKG);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} of ${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch(async (e) => {
  console.error(e);
  process.exitCode = 1;
});
