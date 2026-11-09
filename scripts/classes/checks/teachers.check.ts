// The teachers package's checks against production with throwaway accounts
// (classes-design.md 15.2, the teachers row, and the second form decided Nov 9:
// teacher-application-spec.md section 7):
//   - applying needs a handle, an age answer of 13 to 17, a full FRC season
//     and the code; the second form's answers are checked all at once (every
//     problem listed), against the catalog (modules picked, the sample lesson
//     inside one of them) and for effort (the same answer twice); one pending
//     at a time; an 18+ account and a parent's refusal are turned away;
//   - a good application stores every second-form column, form_version 2,
//     `topics` from the module titles and team_number from the newest season;
//   - accept needs the "I checked their seasons" tick and refuses a
//     first-form row; it copies the name and locks it; the teacher can't
//     change it; a super admin can, with a note;
//   - owner and staff accounts get letters_blocked;
//   - suspend sets suspended_at and calls cancelTeacherClasses; unsuspend works;
//   - GET /api/app/apply's closed state keeps every old key, empty, and lists
//     only the teacher role (none while hidden); POST is refused as closed;
//   - the emails land in the dev outbox and promise no host at a first class.
// Everything it makes is deleted at the end (test-data.mjs cleanup teachers).
// Needs supabase/migrations/20261109121800_teacher_application_answers.sql
// applied first.
//
//   node --import ./scripts/classes/register.mjs scripts/classes/checks/teachers.check.ts

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "../env.mjs";
import { create, cleanup, check, readCredentials } from "../test-data.mjs";

loadEnv();
process.env.CLASSES_DEV_SWITCHES = "1";
process.env.CLASSES_VISIBLE = "1";
delete process.env.VERCEL_ENV;

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

// Stub calls (cancelTeacherClasses, requireClassReviewer) log "[stub] <name>".
const stubCalls: string[] = [];
const warn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  const first = String(args[0] ?? "");
  if (first.startsWith("[stub] ")) stubCalls.push(first.slice(7));
  else warn(...args);
};

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Account = { id: string; email: string; password: string; username: string | null };
type Mail = { to: string[]; subject: string; html: string; replyTo: string };

function outbox(): Mail[] {
  const dir = process.env.EMAIL_DEV_OUTBOX!;
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Mail);
}
const mailTo = (email: string) => outbox().filter((m) => m.to.includes(email));

async function main() {
  await cleanup(PKG);
  await create(PKG, [
    "a1:age=16:parent=agreed",
    "a2:age=14",
    "nohandle:nousername",
    "noage",
    "adult:age=19",
    "declp:age=15:parent=declined",
    "owner:age=16:parent=agreed",
    "staff:age=17:parent=agreed:admin",
    "nolet:age=15:parent=agreed",
    "aged:age=16:parent=agreed",
    "t2:age=15:teacher",
    "sa:superadmin",
    "member",
    "lead",
  ]);
  const acc = readCredentials(PKG).accounts as Record<string, Account>;
  const user = (k: string) => ({ id: acc[k].id, email: acc[k].email, created_at: new Date().toISOString() });

  // Owners come from ADMIN_EMAILS, read when src/lib/auth.ts loads, so set it
  // before importing anything that imports it. The first entry stays the
  // worktree's test owner address (notifications go there, into the outbox).
  const firstOwner = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim() || "lftest+teachers-owner@example.com";
  process.env.ADMIN_EMAILS = `${firstOwner},${acc.owner.email}`;
  process.env.CLASSES_NO_LETTER_USER_IDS = acc.nolet.id;

  const teachers = await import("../../../src/lib/app/class-teachers.ts");
  const apply = await import("../../../src/lib/app/admin-apply.ts");
  const { TEACHER_CODE_VERSION } = await import("../../../src/lib/classes/notice.ts");
  const { NOT_YET_SENTENCE } = await import("../../../src/lib/classes/teacher-rules.ts");
  const { GOOD_ANSWERS, goodTeacherApplication } = await import(
    "../../../src/lib/classes/teacher-application.fixture.ts"
  );

  // A module with a lesson, and a second module (for "a lesson outside the
  // picked modules").
  const { data: lessons } = await admin.from("lessons").select("id, module_id").limit(50);
  const lessonId = lessons![0].id as string;
  const moduleId = lessons![0].module_id as string;
  const otherModuleId = lessons!.find((l) => l.module_id !== moduleId)?.module_id as string;
  assert.ok(otherModuleId, "the catalog has two modules with lessons");
  const { data: mod } = await admin.from("modules").select("title").eq("id", moduleId).single();
  const moduleTitle = mod!.title as string;
  const form = (patch: Record<string, unknown> = {}) => ({
    ...goodTeacherApplication({ moduleId, lessonId, codeVersion: TEACHER_CODE_VERSION }),
    legalName: "Lftest Teacher Applicant",
    ...patch,
  });
  const submit = (k: string, patch: Record<string, unknown> = {}) =>
    teachers.submitTeacherApplication(user(k), form(patch));
  const pendingId = async (k: string) => {
    const { data } = await admin
      .from("teacher_applications")
      .select("id")
      .eq("user_id", acc[k].id)
      .eq("status", "pending")
      .single();
    return data!.id as string;
  };
  const teacherRow = async (k: string) =>
    (await admin.from("class_teachers").select("*").eq("user_id", acc[k].id).maybeSingle()).data;

  await step("can't submit without a handle, an age answer of 13 to 17, or the code", async () => {
    const noHandle = await submit("nohandle");
    assert.equal(noHandle.ok, false);
    assert.equal(!noHandle.ok && noHandle.field, "username");
    const noAge = await submit("noage");
    assert.equal(!noAge.ok && noAge.error, teachers.TEACHER_SENTENCES.needsAge);
    const declined = await submit("declp");
    assert.equal(!declined.ok && declined.code, "forbidden");
    const noCode = await submit("a1", { code: "" });
    assert.equal(!noCode.ok && noCode.field, "code");
    const oldCode = await submit("a1", { code: "2000-01-01" });
    assert.equal(!oldCode.ok && oldCode.field, "code");
    const badName = await submit("a1", { legalName: "Agent 5835" });
    assert.equal(!badName.ok && badName.field, "legalName");
    const badTopic = await submit("a1", { topicIds: ["00000000-0000-4000-8000-000000000000"] });
    assert.equal(!badTopic.ok && badTopic.field, "topicIds");
    const { count } = await admin
      .from("teacher_applications")
      .select("id", { count: "exact", head: true })
      .in("user_id", [acc.nohandle.id, acc.noage.id, acc.declp.id, acc.a1.id]);
    assert.equal(count, 0, "no refused application was stored");
  });

  await step("the second form: a full season, the catalog, effort, and every problem at once", async () => {
    const notYet = await submit("a1", { fullSeason: "no" });
    assert.equal(!notYet.ok && notYet.field, "fullSeason");
    assert.equal(!notYet.ok && notYet.error, NOT_YET_SENTENCE);

    // A lesson id where a module should be.
    const lessonAsModule = await submit("a1", { topicIds: [lessonId] });
    assert.equal(!lessonAsModule.ok && lessonAsModule.field, "topicIds");
    assert.equal(!lessonAsModule.ok && lessonAsModule.error, teachers.TEACHER_SENTENCES.topics);

    // A real lesson, but not in the picked module.
    const outside = await submit("a1", { topicIds: [otherModuleId] });
    assert.equal(!outside.ok && outside.field, "sampleLessonId");
    assert.equal(!outside.ok && outside.error, teachers.TEACHER_SENTENCES.sampleLesson);

    const twice = await submit("a1", { scenarioTeaching: GOOD_ANSWERS.scenarioSafety });
    assert.equal(!twice.ok && twice.field, "scenarioTeaching");
    assert.ok(!twice.ok && /This repeats your answer to/.test(twice.error));

    const everything = await submit("a1", {
      seasonYear: [],
      seasonTeam: [],
      seasonEvents: [],
      frcRoles: [],
      experience: "too short",
      teachingSample: "",
      ownWords: "",
      code: "",
    });
    assert.equal(everything.ok, false);
    const problems = !everything.ok && "problems" in everything ? (everything.problems ?? []) : [];
    assert.deepEqual(
      problems.map((p) => p.field),
      ["seasons", "frcRoles", "experience", "teachingSample", "code", "ownWords"],
      "every problem, in form order"
    );
    assert.equal(!everything.ok && everything.field, "seasons", "field is the first problem");

    const { count } = await admin
      .from("teacher_applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", acc.a1.id);
    assert.equal(count, 0, "no refused application was stored");
  });

  await step("an 18+ account is refused", async () => {
    const r = await submit("adult");
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.code, "forbidden");
    assert.equal(!r.ok && r.error, teachers.TEACHER_SENTENCES.adult);
    assert.equal((await teachers.loadTeachApplyState(user("adult"))).mode, "adult");
  });

  await step("a good application is stored with a teacher_code consent row and two emails", async () => {
    const r = await submit("a1", {
      legalName: "  Lftest   Maya Chen ",
      seasonYear: ["2025", "2026"],
      seasonTeam: ["5835", "5835"],
      seasonEvents: ["Orange County Regional", "Los Angeles Regional, Orange County Regional"],
      frcRoles: ["programming", "electrical"],
    });
    assert.equal(r.ok, true, !r.ok ? r.error : "");
    const { data: row } = await admin
      .from("teacher_applications")
      .select("*")
      .eq("user_id", acc.a1.id)
      .single();
    assert.equal(row!.status, "pending");
    assert.equal(row!.legal_name, "Lftest Maya Chen");
    assert.deepEqual(row!.topic_ids, [moduleId]);
    assert.equal(row!.code_version, TEACHER_CODE_VERSION);
    // The second form's columns.
    assert.equal(row!.form_version, 2);
    assert.deepEqual(row!.frc_seasons, [
      { year: 2026, team: 5835, events: "Los Angeles Regional, Orange County Regional" },
      { year: 2025, team: 5835, events: "Orange County Regional" },
    ]);
    assert.deepEqual(row!.frc_roles, ["electrical", "programming"]);
    assert.equal(row!.team_number, 5835, "the newest season's team");
    assert.equal(row!.topics, moduleTitle, "topics filled from the module titles");
    assert.equal(row!.experience, GOOD_ANSWERS.experience);
    assert.equal(row!.sample_plan, GOOD_ANSWERS.samplePlan);
    assert.equal(row!.teaching_sample, GOOD_ANSWERS.teachingSample);
    assert.equal(row!.scenario_safety, GOOD_ANSWERS.scenarioSafety);
    assert.equal(row!.scenario_teaching, GOOD_ANSWERS.scenarioTeaching);
    assert.equal(row!.motivation, GOOD_ANSWERS.motivation);
    assert.equal(row!.sample_lesson_id, lessonId);
    assert.equal(row!.teach_often, "weekly");
    assert.equal(row!.other_programs, "Two years of FLL in middle school");
    assert.equal(row!.code_questions, null);
    assert.equal(row!.own_words, true);
    const receipt = mailTo(acc.a1.email).find((m) => /application is in/.test(m.subject));
    assert.ok(receipt?.html.includes("against official event results"), "the receipt mentions the season check");
    assert.ok(!receipt?.html.includes("mentor or coach you named"), "no reference line without a reference");
    const { data: consent } = await admin
      .from("class_consents")
      .select("kind, version, user_handle, user_birth_year, class_id")
      .eq("user_id", acc.a1.id);
    assert.equal(consent?.length, 1);
    assert.equal(consent![0].kind, "teacher_code");
    assert.equal(consent![0].version, TEACHER_CODE_VERSION);
    assert.equal(consent![0].user_handle, acc.a1.username);
    assert.ok(consent![0].user_birth_year);
    assert.equal(consent![0].class_id, null);
    assert.equal(mailTo(acc.a1.email).filter((m) => /application is in/.test(m.subject)).length, 1);
    const notify = mailTo(firstOwner).filter((m) => m.subject.includes(`@${acc.a1.username}`));
    assert.equal(notify.length, 1, "the owner was told");
    assert.ok(!notify[0].html.includes("Lftest Maya Chen"), "the owner email doesn't carry the name");
  });

  await step("once while pending (the server check and the unique index)", async () => {
    assert.equal((await teachers.loadTeachApplyState(user("a1"))).mode, "pending");
    const again = await submit("a1");
    assert.equal(!again.ok && again.error, teachers.TEACHER_SENTENCES.pending);
    const raced = await admin.from("teacher_applications").insert({
      user_id: acc.a1.id,
      legal_name: "Lftest Race",
      topics: "x",
      experience: "x",
      sample_plan: "x",
      code_version: TEACHER_CODE_VERSION,
    });
    assert.equal(raced.error?.code, "23505");
  });

  await step("someone without a parent OK yet can apply; withdraw then apply again", async () => {
    const s = await teachers.loadTeachApplyState(user("a2"));
    assert.equal(s.mode, "new");
    assert.equal(s.parentStep, "not_asked");
    assert.equal(
      (
        await submit("a2", {
          legalName: "Lftest Sam Ortiz",
          referenceName: "Lftest Coach",
          referenceEmail: "lftest+teachers-coach@example.com",
        })
      ).ok,
      true
    );
    const receipt = mailTo(acc.a2.email).find((m) => /application is in/.test(m.subject));
    assert.ok(receipt?.html.includes("parent or guardian"), "the receipt mentions the parent step");
    assert.ok(receipt?.html.includes("mentor or coach you named"), "the reference line, with a reference");
    assert.equal((await teachers.withdrawTeacherApplication(user("a2"))).ok, true);
    assert.equal((await teachers.loadTeachApplyState(user("a2"))).mode, "again");
    assert.equal((await teachers.withdrawTeacherApplication(user("a2"))).ok, false);
    assert.equal((await submit("a2", { legalName: "Lftest Sam Ortiz" })).ok, true);
  });

  await step("the desk is for super admins (the safety lead goes through requireClassReviewer)", async () => {
    const denied = await teachers.loadTeacherDesk(user("member"));
    assert.equal(!denied.ok && denied.code, "forbidden");
    const desk = await teachers.loadTeacherDesk(user("sa"));
    assert.equal(desk.ok, true);
    if (!desk.ok) return;
    assert.equal(desk.canDecide, true);
    const a1 = desk.pending.find((p) => p.userId === acc.a1.id);
    assert.ok(a1, "a1 is on the desk");
    assert.equal(a1!.ageBand, "16-17");
    assert.equal(a1!.parentStep, "agreed");
    assert.equal(a1!.legalName, "Lftest Maya Chen");
    assert.equal(a1!.pickedTopics[0]?.id, moduleId);
    assert.equal(a1!.formVersion, 2);
    assert.equal(a1!.seasons.length, 2);
    assert.equal(a1!.seasons[0].tbaUrl, "https://www.thebluealliance.com/team/5835/2026");
    assert.equal(a1!.seasons[0].frcEventsUrl, "https://frc-events.firstinspires.org/2026/team/5835");
    assert.deepEqual(a1!.roles, ["Electrical", "Programming"]);
    assert.equal(a1!.sampleLesson?.id, lessonId);
    assert.ok(a1!.sampleLesson?.url.startsWith("/guides/"), "the sample lesson links to the guide");
    assert.equal(a1!.teachOften, "Once a week or more");
    assert.equal(a1!.ownWords, true);
    assert.ok((a1!.wordCounts.teachingSample ?? 0) >= 150, "word counts");
    assert.ok(Array.isArray(a1!.flags));
    const a2 = desk.pending.find((p) => p.userId === acc.a2.id);
    assert.equal(a2!.ageBand, "13-15");
    assert.equal(a2!.parentStep, "not_asked");
  });

  await step("a first-form application can only be turned down", async () => {
    const { data: old, error } = await admin
      .from("teacher_applications")
      .insert({
        user_id: acc.member.id,
        legal_name: "Lftest First Form",
        topics: "swerve",
        experience: "A first-form answer.",
        sample_plan: "A first-form plan.",
        code_version: TEACHER_CODE_VERSION,
      })
      .select("id")
      .single();
    assert.ok(old, error?.message);
    const accept = await teachers.decideTeacherApplication(user("sa"), {
      id: old!.id,
      decision: "accept",
      seasonsChecked: "yes",
    });
    assert.equal(!accept.ok && accept.code, "conflict");
    assert.equal(!accept.ok && accept.error, teachers.TEACHER_SENTENCES.firstForm);
    const desk = await teachers.loadTeacherDesk(user("sa"));
    const entry = desk.ok ? desk.pending.find((p) => p.id === old!.id) : null;
    assert.equal(entry?.formVersion, null, "the desk marks it as the first form");
    assert.deepEqual(entry?.flags, [], "no flags on a first-form row");
    const reject = await teachers.decideTeacherApplication(user("sa"), { id: old!.id, decision: "reject" });
    assert.equal(reject.ok, true, !reject.ok ? reject.error : "");
  });

  await step("accept copies the name to the locked letter name; a second decision is refused", async () => {
    const id = await pendingId("a1");
    const notAllowed = await teachers.decideTeacherApplication(user("member"), { id, decision: "accept" });
    assert.equal(!notAllowed.ok && notAllowed.code, "forbidden");
    const unchecked = await teachers.decideTeacherApplication(user("sa"), { id, decision: "accept" });
    assert.equal(!unchecked.ok && unchecked.field, "seasonsChecked");
    assert.equal(await teacherRow("a1"), null, "nothing was decided without the tick");
    const r = await teachers.decideTeacherApplication(user("sa"), {
      id,
      decision: "accept",
      note: "Welcome aboard.",
      seasonsChecked: "yes",
    });
    assert.equal(r.ok, true, !r.ok ? r.error : "");
    const { data: event } = await admin
      .from("class_events")
      .select("detail")
      .eq("actor_id", acc.sa.id)
      .eq("kind", "teacher_accepted")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    assert.equal((event!.detail as { seasonsChecked?: boolean }).seasonsChecked, true, "the tick is logged");
    const t = await teacherRow("a1");
    assert.equal(t!.letter_name, "Lftest Maya Chen");
    assert.equal(t!.application_id, id);
    assert.equal(t!.granted_by, acc.sa.id);
    assert.equal(t!.code_version, TEACHER_CODE_VERSION);
    assert.equal(t!.letters_blocked, false);
    assert.equal(t!.suspended_at, null);
    const again = await teachers.decideTeacherApplication(user("sa"), { id, decision: "reject" });
    assert.equal(!again.ok && again.code, "conflict");
    const mail = mailTo(acc.a1.email).find((m) => /can teach live classes/.test(m.subject));
    assert.ok(mail, "the acceptance email went out");
    assert.ok(mail!.html.includes("Lftest Maya Chen"));
    assert.ok(mail!.html.includes("Welcome aboard."));
    const s = await teachers.loadTeachApplyState(user("a1"));
    assert.equal(s.mode, "teacher");
    assert.equal(s.teacher?.letterName, "Lftest Maya Chen");
    const resubmit = await submit("a1");
    assert.equal(!resubmit.ok && resubmit.error, teachers.TEACHER_SENTENCES.already);
    const gate = await teachers.teachingGate(user("a1"));
    assert.equal(gate.ok, true, !gate.ok ? gate.error : "");
  });

  await step("reject sends the note; they can apply again", async () => {
    const id = await pendingId("a2");
    const r = await teachers.decideTeacherApplication(user("sa"), { id, decision: "reject", note: "Try again after your first season." });
    assert.equal(r.ok, true);
    assert.equal(await teacherRow("a2"), null);
    const mail = mailTo(acc.a2.email).find((m) => /About your LearnFRC teacher application/.test(m.subject));
    assert.ok(mail?.html.includes("Try again after your first season."));
    const s = await teachers.loadTeachApplyState(user("a2"));
    assert.equal(s.mode, "again");
    assert.equal(s.application?.reviewNote, "Try again after your first season.");
  });

  await step("the teacher can't change the letter name; a super admin can, with a note", async () => {
    const self = await teachers.changeLetterName(user("a1"), {
      userId: acc.a1.id,
      letterName: "Lftest Someone Else",
      note: "I changed my mind",
    });
    assert.equal(!self.ok && self.code, "forbidden");
    assert.equal((await teacherRow("a1"))!.letter_name, "Lftest Maya Chen");
    const noNote = await teachers.changeLetterName(user("sa"), {
      userId: acc.a1.id,
      letterName: "Lftest Maya L Chen",
      note: "",
    });
    assert.equal(!noNote.ok && noNote.field, "note");
    const badName = await teachers.changeLetterName(user("sa"), {
      userId: acc.a1.id,
      letterName: "Lftest 123",
      note: "school record",
    });
    assert.equal(!badName.ok && badName.field, "letterName");
    const ok = await teachers.changeLetterName(user("sa"), {
      userId: acc.a1.id,
      letterName: "Lftest Maya L. Chen",
      note: "Matches the school record",
    });
    assert.equal(ok.ok, true, !ok.ok ? ok.error : "");
    const t = await teacherRow("a1");
    assert.equal(t!.letter_name, "Lftest Maya L. Chen");
    assert.equal(t!.letter_name_changed_by, acc.sa.id);
    assert.ok(t!.letter_name_changed_at);
    assert.equal(t!.letter_name_change_note, "Matches the school record");
    assert.ok(mailTo(acc.a1.email).some((m) => /name on your LearnFRC hours letters changed/.test(m.subject)));
    const { count } = await admin
      .from("class_events")
      .select("id", { count: "exact", head: true })
      .eq("actor_id", acc.sa.id)
      .eq("kind", "letter_name_changed");
    assert.equal(count, 1);
  });

  await step("owner and staff accounts get letters_blocked", async () => {
    for (const k of ["owner", "staff", "nolet"]) {
      const r = await submit(k, { legalName: `Lftest ${k.charAt(0).toUpperCase()}${k.slice(1)} Person` });
      assert.equal(r.ok, true, `${k}: ${!r.ok ? r.error : ""}`);
      const d = await teachers.decideTeacherApplication(user("sa"), {
        id: await pendingId(k),
        decision: "accept",
        seasonsChecked: "yes",
      });
      assert.equal(d.ok, true, `${k}: ${!d.ok ? d.error : ""}`);
      assert.equal((await teacherRow(k))!.letters_blocked, true, k);
    }
  });

  await step("accepting someone who has turned 18 is refused", async () => {
    assert.equal((await submit("aged", { legalName: "Lftest Aged Out" })).ok, true);
    await admin
      .from("class_age_checks")
      .update({ birth_year: new Date().getUTCFullYear() - 20 })
      .eq("user_id", acc.aged.id);
    const id = await pendingId("aged");
    const r = await teachers.decideTeacherApplication(user("sa"), { id, decision: "accept", seasonsChecked: "yes" });
    assert.equal(!r.ok && r.code, "conflict");
    assert.equal(await teacherRow("aged"), null);
    const { data } = await admin.from("teacher_applications").select("status").eq("id", id).single();
    assert.equal(data!.status, "pending", "nothing was decided");
  });

  await step("suspend sets suspended_at and calls cancelTeacherClasses; unsuspend works", async () => {
    const denied = await teachers.suspendTeacher(user("member"), { userId: acc.a1.id, reason: "test" });
    assert.equal(!denied.ok && denied.code, "forbidden");
    const noReason = await teachers.suspendTeacher(user("sa"), { userId: acc.a1.id, reason: "" });
    assert.equal(!noReason.ok && noReason.field, "reason");
    // An upcoming class of a1's (no meeting, so nothing reaches Cloudflare):
    // the real cancelTeacherClasses (pages) cancels it.
    const startsAt = new Date(Date.now() + 3 * 86_400_000);
    const { data: cls, error: clsErr } = await admin
      .from("classes")
      .insert({
        teacher_id: acc.a1.id,
        title: "lftest teachers upcoming",
        module_id: moduleId,
        starts_at: startsAt.toISOString(),
        duration_minutes: 30,
        hard_end_at: new Date(startsAt.getTime() + 45 * 60_000).toISOString(),
        capacity: 5,
        status: "scheduled",
        rtk_app: "dev",
      })
      .select("id")
      .single();
    assert.ok(cls, clsErr?.message);
    const r = await teachers.suspendTeacher(user("sa"), { userId: acc.a1.id, reason: "lftest suspension" });
    assert.equal(r.ok, true, !r.ok ? r.error : "");
    let t = await teacherRow("a1");
    assert.ok(t!.suspended_at, "suspended_at set");
    assert.equal(t!.suspended_reason, "lftest suspension");
    const { data: after } = await admin.from("classes").select("status").eq("id", cls!.id).single();
    assert.equal(after!.status, "canceled", "cancelTeacherClasses canceled the upcoming class");
    assert.equal((await teachers.loadTeachApplyState(user("a1"))).mode, "suspended");
    const gate = await teachers.teachingGate(user("a1"));
    assert.equal(!gate.ok && gate.error, teachers.TEACHER_SENTENCES.teachSuspended);
    const firstAt = t!.suspended_at;
    assert.equal((await teachers.suspendTeacher(user("sa"), { userId: acc.a1.id, reason: "again" })).ok, true);
    t = await teacherRow("a1");
    assert.equal(t!.suspended_at, firstAt, "a second suspension keeps the first time");
    assert.equal(t!.suspended_reason, "lftest suspension");

    const un = await teachers.unsuspendTeacher(user("sa"), { userId: acc.a1.id });
    assert.equal(un.ok, true);
    t = await teacherRow("a1");
    assert.equal(t!.suspended_at, null);
    assert.equal(t!.suspended_reason, null);
    assert.equal((await teachers.loadTeachApplyState(user("a1"))).mode, "teacher");
    assert.ok(mailTo(acc.a1.email).some((m) => /teach live classes on LearnFRC again/.test(m.subject)));
    const notTeacher = await teachers.suspendTeacher(user("sa"), { userId: acc.member.id, reason: "x" });
    assert.equal(!notTeacher.ok && notTeacher.code, "not_found");
  });

  await step("the system (auto-end) can suspend, without a staff check or an actor event", async () => {
    const { SYSTEM_ACTOR } = await import("../../../src/lib/classes/types.ts");
    const r = await teachers.suspendTeacher({ ...SYSTEM_ACTOR, reason: "two reports in a live class" }, {
      userId: acc.staff.id,
      reason: "",
    });
    assert.equal(r.ok, true, !r.ok ? r.error : "");
    const t = await teacherRow("staff");
    assert.ok(t!.suspended_at);
    assert.equal(t!.suspended_reason, "two reports in a live class");
    const { count } = await admin
      .from("class_events")
      .select("id", { count: "exact", head: true })
      .is("actor_id", null)
      .eq("kind", "teacher_suspended");
    assert.equal(count, 0, "no orphan event row");
  });

  await step("the safety lead sees the desk and can suspend and unsuspend, but not decide", async () => {
    // With the real requireClassReviewer (safety-holds) merged. The shared
    // class_settings row is put back in a finally step.
    const { data: before } = await admin.from("class_settings").select("safety_lead_user_id").eq("id", true).single();
    await admin.from("class_settings").update({ safety_lead_user_id: acc.lead.id }).eq("id", true);
    try {
      const desk = await teachers.loadTeacherDesk(user("lead"));
      assert.equal(desk.ok, true, !desk.ok ? desk.error : "");
      if (!desk.ok) return;
      assert.equal(desk.role, "safety_lead");
      assert.equal(desk.canDecide, false);
      const decide = await teachers.decideTeacherApplication(user("lead"), {
        id: "00000000-0000-4000-8000-000000000000",
        decision: "accept",
      });
      assert.equal(!decide.ok && decide.code, "forbidden");
      const s = await teachers.suspendTeacher(user("lead"), { userId: acc.t2.id, reason: "lftest lead suspension" });
      assert.equal(s.ok, true, !s.ok ? s.error : "");
      assert.ok((await teacherRow("t2"))!.suspended_at);
      const u = await teachers.unsuspendTeacher(user("lead"), { userId: acc.t2.id });
      assert.equal(u.ok, true, !u.ok ? u.error : "");
      assert.equal((await teacherRow("t2"))!.suspended_at, null);
    } finally {
      await admin
        .from("class_settings")
        .update({ safety_lead_user_id: before?.safety_lead_user_id ?? null })
        .eq("id", true);
    }
  });

  await step("teaching waits for the parent OK and a current code", async () => {
    const gate = await teachers.teachingGate(user("t2"));
    assert.equal(!gate.ok && gate.error, teachers.TEACHER_SENTENCES.teachNeedsParent);
    await admin.from("class_teachers").update({ code_version: "2000-01-01" }).eq("user_id", acc.t2.id);
    assert.equal((await teachers.loadTeachApplyState(user("t2"))).mode, "code-outdated");
    const outdated = await teachers.teachingGate(user("t2"));
    assert.equal(!outdated.ok && outdated.error, teachers.TEACHER_SENTENCES.codeOutdated);
    const wrong = await teachers.agreeToTeacherCode(user("t2"), { code: "2000-01-01" });
    assert.equal(!wrong.ok && wrong.field, "code");
    assert.equal((await teachers.agreeToTeacherCode(user("t2"), { code: TEACHER_CODE_VERSION })).ok, true);
    assert.equal((await teacherRow("t2"))!.code_version, TEACHER_CODE_VERSION);
    const { count } = await admin
      .from("class_consents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", acc.t2.id)
      .eq("kind", "teacher_code");
    assert.equal(count, 1);
    assert.equal((await teachers.loadTeachApplyState(user("t2"))).mode, "teacher");
  });

  await step("GET /api/app/apply's closed state keeps every old key and lists only the teacher role", async () => {
    const s = await apply.loadApplyState(user("a1"));
    assert.equal(s.ok, true);
    if (!s.ok) return;
    for (const k of [
      "applicationsOpen",
      "mode",
      "heading",
      "record",
      "application",
      "jobs",
      "limits",
      "posting",
      "rules",
      "marketer",
      "roles",
    ]) {
      assert.ok(k in s, `kept ${k}`);
    }
    assert.equal(s.applicationsOpen, false);
    assert.equal(s.mode, "new");
    assert.deepEqual(s.jobs, []);
    assert.equal(s.posting, "");
    assert.deepEqual(s.rules, []);
    assert.equal(s.marketer, null);
    assert.equal(s.roles.length, 1);
    assert.deepEqual(
      { ...s.roles[0], url: s.roles[0].url.replace(/^https?:\/\/[^/]+/, "") },
      { id: "teacher", title: "Teach a live class", url: "/apply/teach", open: true, status: "teacher" }
    );
    const adult = await apply.loadApplyState(user("adult"));
    assert.equal(adult.ok && adult.roles[0]?.status, "adult");

    const closed = await apply.submitApplication(user("member"), { experience: "x".repeat(60), why: "x".repeat(60) });
    assert.equal(!closed.ok && closed.code, "conflict");
    assert.equal(!closed.ok && closed.error, "Applications are closed for now. Check back later.");
    const { count } = await admin
      .from("admin_applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", acc.member.id);
    assert.equal(count, 0, "nothing was filed");

    // Hidden: no teacher role at all, so nothing about classes reaches the app.
    process.env.CLASSES_DEV_SWITCHES = "0";
    process.env.CLASSES_VISIBLE = "";
    try {
      const hidden = await apply.loadApplyState(user("a1"));
      assert.equal(hidden.ok && hidden.roles.length, 0);
      assert.equal(await teachers.teacherApplyRole(user("a1")), null);
      assert.equal((await teachers.loadTeachApplyState(user("a1"))).mode, "hidden");
      const refused = await submit("a2");
      assert.equal(!refused.ok && refused.error, teachers.TEACHER_SENTENCES.hidden);
    } finally {
      process.env.CLASSES_DEV_SWITCHES = "1";
      process.env.CLASSES_VISIBLE = "1";
    }
  });

  await step("the emails carry no em dash and promise no host at a first class", async () => {
    const mine = outbox();
    assert.ok(mine.length >= 8, `${mine.length} emails in the outbox`);
    for (const m of mine) {
      const text = `${m.subject} ${m.html}`;
      assert.ok(!text.includes("\u2014"), `em dash in "${m.subject}"`);
      assert.ok(!/\bhost/i.test(text), `"host" in "${m.subject}"`);
      assert.ok(!/\bsupervis/i.test(text), `"supervise" in "${m.subject}"`);
      assert.ok(!/\d{3}[-. ]\d{3}[-. ]\d{4}/.test(text), `a phone number in "${m.subject}"`);
      assert.equal(m.replyTo, "kidflash2jahaan@gmail.com");
    }
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
