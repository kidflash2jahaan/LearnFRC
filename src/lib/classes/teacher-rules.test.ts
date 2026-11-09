import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EFFORT_SENTENCES,
  NOT_YET_SENTENCE,
  TEACHER_CODE_SENTENCE,
  TEACH_ANSWERS,
  TEACH_ANSWER_KEYS,
  applicationFlags,
  canApplyIn,
  checkTeacherApplication,
  letterNameProblem,
  lettersBlockedFor,
  normalizeName,
  parentStepFromRows,
  parentStepFor,
  seasonLinks,
  teachApplyMode,
  wordCount,
  type TeachAnswerKey,
} from "./teacher-rules.ts";
import { GOOD_ANSWERS, goodTeacherApplication } from "./teacher-application.fixture.ts";

const CODE = "2026-11-08";
const NOW = new Date("2026-11-09T12:00:00Z");
const MODULE = "0b8f8d4e-5a7c-4b5e-9d1a-2f3c4d5e6f70";
const LESSON = "1c9e8d4e-5a7c-4b5e-9d1a-2f3c4d5e6f71";
const good = goodTeacherApplication({ moduleId: MODULE, lessonId: LESSON, codeVersion: CODE });

const check = (patch: Record<string, unknown> = {}, now = NOW) =>
  checkTeacherApplication({ ...good, ...patch }, { codeVersion: CODE, now });

/** Every problem as "field: error". */
const problems = (patch: Record<string, unknown>, now = NOW) => {
  const r = check(patch, now);
  return r.ok ? [] : r.problems.map((p) => `${p.field}: ${p.error}`);
};

/** `n` different words, none of them shared with any other answer or prompt. */
const wordsOf = (key: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${key}${i}`).join(" ");

test("a good application passes, trimmed, with the seasons newest first", () => {
  const r = check({
    seasonYear: ["2024", "2026", "2025"],
    seasonTeam: ["5835", "5835", "5835"],
    seasonEvents: ["Orange County Regional", "Los Angeles Regional", "Ventura County Regional"],
  });
  assert.equal(r.ok, true, r.ok ? "" : r.problems.map((p) => p.error).join(" / "));
  if (!r.ok) return;
  assert.equal(r.value.legalName, "Maya Chen");
  assert.deepEqual(
    r.value.seasons.map((s) => s.year),
    [2026, 2025, 2024]
  );
  assert.equal(r.value.seasons[0].events, "Los Angeles Regional");
  assert.equal(r.value.seasons[0].team, 5835);
  assert.deepEqual(r.value.roles, ["electrical"]);
  assert.deepEqual(r.value.topicIds, [MODULE]);
  assert.equal(r.value.sampleLessonId, LESSON);
  assert.equal(r.value.teachOften, "weekly");
  assert.equal(r.value.referenceName, null);
  assert.equal(r.value.referenceEmail, null);
  assert.equal(r.value.codeQuestions, null);
  assert.equal(r.value.availability, "weekday evenings, Pacific time");
  assert.equal(r.value.otherPrograms, "Two years of FLL in middle school");
});

test("the floors add up to 440 words", () => {
  const total = TEACH_ANSWER_KEYS.reduce((n, k) => n + TEACH_ANSWERS[k].minWords, 0);
  assert.equal(total, 440);
});

test("wordCount: contractions, decimals and hyphens are one word each", () => {
  assert.equal(wordCount(""), 0);
  assert.equal(wordCount("   "), 0);
  assert.equal(wordCount("don't"), 1);
  assert.equal(wordCount("it’s"), 1);
  assert.equal(wordCount("1.5"), 1);
  assert.equal(wordCount("CAN-bus"), 1);
  assert.equal(wordCount("Hello, world! It's 1.5 volts... on the CAN-bus."), 8);
  assert.equal(wordCount("-- , . !"), 0);
});

test("without a full FRC season, that's the only refusal", () => {
  for (const fullSeason of ["no", "", undefined, "maybe"]) {
    const r = check({ fullSeason, experience: "" });
    assert.equal(r.ok, false);
    if (r.ok) continue;
    assert.equal(r.field, "fullSeason");
    assert.equal(r.error, NOT_YET_SENTENCE);
    assert.equal(r.problems.length, 1);
  }
});

test("seasons", () => {
  const thisYear = NOW.getUTCFullYear();
  assert.deepEqual(problems({ seasonYear: [], seasonTeam: [], seasonEvents: [] }), [
    "seasons: Add at least one FRC season.",
  ]);
  // A row left completely empty is skipped, not refused.
  assert.equal(check({ seasonYear: ["2026", ""], seasonTeam: ["5835", ""], seasonEvents: [good.seasonEvents[0], ""] }).ok, true);
  const six = [2021, 2022, 2023, 2024, 2025, 2026].map(String);
  assert.deepEqual(problems({ seasonYear: six, seasonTeam: six.map(() => "5835"), seasonEvents: six.map(() => "Some Regional") }), [
    "seasons: List up to 5 seasons.",
  ]);
  assert.deepEqual(problems({ seasonYear: ["20x6"] }), ["season-1-year: Season 1: pick the year."]);
  assert.deepEqual(problems({ seasonYear: [String(thisYear + 1)] }), ["season-1-year: Season 1: pick the year."]);
  assert.deepEqual(problems({ seasonYear: ["1991"] }), ["season-1-year: Season 1: pick the year."]);
  assert.equal(check({ seasonYear: ["1992"] }).ok, true);
  assert.deepEqual(
    problems({ seasonYear: ["2026", "2026"], seasonTeam: ["5835", "5835"], seasonEvents: ["Some Regional", "Another Regional"] }),
    ["season-2-year: Season 2: you already listed 2026."]
  );
  assert.deepEqual(problems({ seasonTeam: ["0"] }), ["season-1-team: Season 1: add your team number for that year."]);
  assert.deepEqual(problems({ seasonTeam: ["100000"] }), ["season-1-team: Season 1: add your team number for that year."]);
  assert.deepEqual(problems({ seasonTeam: [""] }), ["season-1-team: Season 1: add your team number for that year."]);
  assert.equal(check({ seasonTeam: [5835] }).ok, true, "a number is read like the form's string");
  assert.deepEqual(problems({ seasonEvents: ["abc"] }), ["season-1-events: Season 1: name the official events you went to."]);
  assert.deepEqual(problems({ seasonEvents: ["x".repeat(201)] }), [
    "season-1-events: Season 1: keep the events under 200 characters.",
  ]);
  // A single row can be sent as plain values too.
  assert.equal(check({ seasonYear: "2026", seasonTeam: "5835", seasonEvents: "Orange County Regional" }).ok, true);
});

test("roles", () => {
  assert.deepEqual(problems({ frcRoles: [] }), ["frcRoles: Tick at least one thing you worked on."]);
  assert.deepEqual(problems({ frcRoles: ["electrical", "astronaut"] }), ["frcRoles: Pick from the list."]);
  const r = check({ frcRoles: ["programming", "electrical", "electrical"] });
  assert.equal(r.ok && r.value.roles.join(","), "electrical,programming", "deduped, in list order");
});

test("each long answer: one word under its floor is refused, the floor passes, over the cap is refused", () => {
  for (const key of TEACH_ANSWER_KEYS) {
    const { minWords, maxChars } = TEACH_ANSWERS[key];
    assert.deepEqual(
      problems({ [key]: wordsOf(key, minWords - 1) }),
      [`${key}: Write at least ${minWords} words. You’re at ${minWords - 1}.`],
      key
    );
    assert.equal(check({ [key]: wordsOf(key, minWords) }).ok, true, `${key} at the floor`);
    assert.deepEqual(problems({ [key]: "a".repeat(maxChars + 1) }), [`${key}: Keep this under ${maxChars} characters.`], key);
  }
});

test("effort: the same text twice refuses the later answer, naming the other by the question on the form", () => {
  assert.deepEqual(problems({ scenarioTeaching: GOOD_ANSWERS.scenarioSafety }), [
    `scenarioTeaching: ${EFFORT_SENTENCES.repeats(TEACH_ANSWERS.scenarioSafety.question)}`,
  ]);
  assert.equal(
    EFFORT_SENTENCES.repeats(TEACH_ANSWERS.scenarioSafety.question),
    "This repeats your answer to “A student asks to keep talking somewhere else”. Write this one fresh."
  );
  assert.equal(
    EFFORT_SENTENCES.repeats("Why do you want to teach on LearnFRC?"),
    "This repeats your answer to “Why do you want to teach on LearnFRC?” Write this one fresh.",
    "no period after a question mark"
  );
  // Mostly the same, with a sentence added, is still the same answer.
  assert.deepEqual(problems({ motivation: `${GOOD_ANSWERS.experience} I would like to teach.` }), [
    `motivation: ${EFFORT_SENTENCES.repeats(TEACH_ANSWERS.experience.question)}`,
  ]);
});

test("a line break counts once, the way the textarea counts it, and is stored as \\n", () => {
  // A multipart post turns every \n into \r\n.
  for (const key of TEACH_ANSWER_KEYS) {
    const { maxChars } = TEACH_ANSWERS[key];
    let lf = "";
    for (let i = 0; lf.length < maxChars + 50; i++) lf += `${key}${i}${i % 10 === 9 ? "\n\n" : " "}`;
    lf = lf.slice(0, maxChars).replace(/\s+$/, "");
    lf = lf + "x".repeat(maxChars - lf.length);
    assert.equal(lf.length, maxChars);
    const crlf = lf.replace(/\n/g, "\r\n");
    assert.ok(crlf.length > maxChars, `${key}: the CRLF copy is longer than the cap`);
    const r = check({ [key]: crlf });
    assert.equal(r.ok, true, r.ok ? "" : `${key}: ${r.problems.map((p) => p.error).join(" / ")}`);
    assert.equal(r.ok && r.value[key], lf, `${key}: stored with \\n`);
  }
  const lone = check({ codeQuestions: "line one\rline two" });
  assert.equal(lone.ok && lone.value.codeQuestions, "line one\nline two", "a lone \\r is a line break too");
});

test("effort: pasting the question back is refused", () => {
  const situation = TEACH_ANSWERS.scenarioSafety.situation;
  assert.deepEqual(problems({ scenarioSafety: `${situation} I would tell them no.` }), [
    `scenarioSafety: ${EFFORT_SENTENCES.copiedPrompt}`,
  ]);
});

test("effort: padding is refused", () => {
  assert.deepEqual(problems({ motivation: `${GOOD_ANSWERS.motivation} robot robot robot robot robot` }), [
    `motivation: ${EFFORT_SENTENCES.padding}`,
  ]);
  const few = Array.from({ length: 80 }, (_, i) => ["the", "robot", "is", "good"][i % 4]).join(" ");
  assert.deepEqual(problems({ experience: few }), [`experience: ${EFFORT_SENTENCES.padding}`]);
});

test("effort: a normal answer that shares a phrase or two passes", () => {
  const r = check({
    scenarioTeaching: `${GOOD_ANSWERS.scenarioTeaching} If we run short, I point them to the LearnFRC lesson instead.`,
  });
  assert.equal(r.ok, true, r.ok ? "" : r.error);
});

test("references: both or neither", () => {
  assert.deepEqual(problems({ referenceName: "Coach Rivera" }), ["referenceEmail: Add their email too."]);
  assert.deepEqual(problems({ referenceEmail: "coach@example.com" }), ["referenceName: Add their name too."]);
  assert.deepEqual(problems({ referenceName: "Coach Rivera", referenceEmail: "coach at team" }), [
    "referenceEmail: That email address doesn't look right.",
  ]);
  // Nothing that would add a recipient or a header to the desk's mailto link.
  for (const bad of ["coach@team.org?bcc=x%40y.com&a=", "coach@team.org,x%40y.com", "coach@team.org&cc=x@y.com", "co%40ch@team.org"])
    assert.deepEqual(
      problems({ referenceName: "Coach Rivera", referenceEmail: bad }),
      ["referenceEmail: That email address doesn't look right."],
      bad
    );
  for (const ok of ["o'brien@team.org", "coach.rivera+frc@mail.team-5835.org"])
    assert.equal(check({ referenceName: "Coach Rivera", referenceEmail: ok }).ok, true, ok);
  const r = check({ referenceName: " Coach   Rivera ", referenceEmail: "Coach@Example.com" });
  assert.equal(r.ok && r.value.referenceName, "Coach Rivera");
  assert.equal(r.ok && r.value.referenceEmail, "coach@example.com");
});

test("the other fields", () => {
  assert.deepEqual(problems({ topicIds: [] }), ["topicIds: Pick at least one module you could teach."]);
  assert.deepEqual(
    problems({ topicIds: [1, 2, 3, 4, 5, 6].map((n) => `0b8f8d4e-5a7c-4b5e-9d1a-2f3c4d5e6f7${n}`) }),
    ["topicIds: Pick up to 5 modules."]
  );
  assert.deepEqual(problems({ topicIds: ["not-a-uuid"] }), ["topicIds: One of the picked modules isn’t on LearnFRC."]);
  assert.equal(check({ topicIds: MODULE }).ok, true, "a single id is accepted");
  assert.deepEqual(problems({ sampleLessonId: "" }), ["sampleLessonId: Pick the lesson you’d teach."]);
  assert.deepEqual(problems({ teachOften: "daily" }), ["teachOften: Pick about how often you could teach."]);
  assert.deepEqual(problems({ availability: "x".repeat(201) }), ["availability: Keep availability to a line."]);
  assert.deepEqual(problems({ otherPrograms: "x".repeat(301) }), ["otherPrograms: Keep this under 300 characters."]);
  assert.deepEqual(problems({ codeQuestions: "x".repeat(501) }), ["codeQuestions: Keep this under 500 characters."]);
  assert.deepEqual(problems({ code: "" }), [`code: ${TEACHER_CODE_SENTENCE}`]);
  assert.deepEqual(problems({ code: "2000-01-01" }), [`code: ${TEACHER_CODE_SENTENCE}`]);
  assert.deepEqual(problems({ ownWords: "" }), ["ownWords: Tick the box to say you wrote these answers yourself."]);
  for (const bad of ["", "M", "x".repeat(81), "Maya 5835", "maya@example.com", "www.maya.dev"]) {
    assert.equal(check({ legalName: bad }).ok ? null : (check({ legalName: bad }) as { field: string }).field, "legalName", bad);
  }
  assert.equal(check({ experience: 42 }).ok, false, "a non-string counts as empty");
});

test("every problem comes back at once, in form order", () => {
  const r = checkTeacherApplication({ fullSeason: "yes" }, { codeVersion: CODE, now: NOW });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.deepEqual(
    r.problems.map((p) => p.field),
    [
      "seasons",
      "frcRoles",
      "experience",
      "topicIds",
      "sampleLessonId",
      "teachingSample",
      "samplePlan",
      "scenarioSafety",
      "scenarioTeaching",
      "motivation",
      "teachOften",
      "legalName",
      "code",
      "ownWords",
    ]
  );
  assert.equal(r.field, r.problems[0].field);
  assert.equal(r.error, r.problems[0].error);
  // An effort refusal sits in its field's place, not at the end.
  const mixed = check({ ownWords: "", scenarioTeaching: GOOD_ANSWERS.scenarioSafety, frcRoles: [] });
  assert.deepEqual(mixed.ok ? [] : mixed.problems.map((p) => p.field), ["frcRoles", "scenarioTeaching", "ownWords"]);
});

test("applicationFlags", () => {
  const seasons = [{ year: 2026, team: 5835, events: "Orange County Regional" }];
  const answers: Partial<Record<TeachAnswerKey, string>> = { ...GOOD_ANSWERS };
  assert.deepEqual(applicationFlags({ seasons, answers }, { profileTeam: 5835, now: NOW }), []);
  assert.deepEqual(applicationFlags({ seasons, answers }, { profileTeam: null, now: NOW }), []);

  const mismatch = applicationFlags({ seasons, answers }, { profileTeam: 1234, now: NOW });
  assert.deepEqual(mismatch, ["Their profile says team 1234, which isn’t in their seasons."]);

  const january = applicationFlags({ seasons, answers }, { profileTeam: 5835, now: new Date("2026-01-15T00:00:00Z") });
  assert.deepEqual(january, ["A season is 2026. Check its events have happened."]);
  const april = applicationFlags({ seasons, answers }, { profileTeam: 5835, now: new Date("2026-04-15T00:00:00Z") });
  assert.deepEqual(april, []);

  const nearFloor = applicationFlags(
    { seasons, answers: { ...answers, motivation: wordsOf("m", 30) } },
    { profileTeam: 5835, now: NOW }
  );
  assert.deepEqual(nearFloor, ["Why you want to teach is right at the minimum (30 words)."]);

  const half = GOOD_ANSWERS.motivation.split(" ").slice(0, 20).join(" ");
  const overlap = applicationFlags(
    { seasons, answers: { motivation: GOOD_ANSWERS.motivation, scenarioTeaching: `${half} ${wordsOf("s", 40)}` } },
    { profileTeam: 5835, now: NOW }
  );
  assert.deepEqual(overlap, ["The question you can’t answer and Why you want to teach share a lot of wording."]);

  const letters = applicationFlags(
    { seasons, answers: { ...answers, motivation: `${GOOD_ANSWERS.motivation} Thisssssss.` } },
    { profileTeam: 5835, now: NOW }
  );
  assert.deepEqual(letters, ["There’s a long run of one letter in Why you want to teach."]);
});

test("season links", () => {
  assert.deepEqual(seasonLinks({ year: 2026, team: 5835 }), {
    tbaUrl: "https://www.thebluealliance.com/team/5835/2026",
    frcEventsUrl: "https://frc-events.firstinspires.org/2026/team/5835",
  });
});

test("letter names: real names pass, odd ones don't", () => {
  for (const ok of ["Maya Chen", "José Álvarez-Ruiz", "Siobhan O'Neill", "J. R. Smith", "李明"]) {
    assert.equal(letterNameProblem(ok), null, ok);
  }
  for (const bad of ["", "  ", "--", "Maya_Chen", "Maya #1", "http://x.co", "Maya/Chen"]) {
    assert.notEqual(letterNameProblem(bad), null, bad);
  }
  assert.equal(normalizeName("  A   B  "), "A B");
});

test("owner and staff accounts get letters_blocked", () => {
  const none = { ownerEmail: false, siteAdmin: false, safetyLead: false, noLetterId: false };
  assert.equal(lettersBlockedFor(none), false);
  assert.equal(lettersBlockedFor({ ...none, ownerEmail: true }), true);
  assert.equal(lettersBlockedFor({ ...none, siteAdmin: true }), true);
  assert.equal(lettersBlockedFor({ ...none, safetyLead: true }), true);
  assert.equal(lettersBlockedFor({ ...none, noLetterId: true }), true);
});

test("the apply mode follows eligibility, then the teacher row, then the application", () => {
  const m = (eligibility: Parameters<typeof teachApplyMode>[0]["eligibility"], extra = {}) =>
    teachApplyMode({ eligibility, teacher: null, latest: null, ...extra });
  assert.equal(m("hidden"), "hidden");
  assert.equal(m("signed_out"), "signed-out");
  assert.equal(m("needs_handle"), "no-handle");
  assert.equal(m("device_blocked"), "device-blocked");
  assert.equal(m("needs_age"), "needs-age");
  assert.equal(m("adult"), "adult");
  // An adult teacher can't teach new classes either.
  assert.equal(m("adult", { teacher: { suspended: false, codeCurrent: true } }), "adult");
  assert.equal(m("parent_declined"), "parent-declined");
  assert.equal(m("needs_parent"), "new");
  assert.equal(m("waiting_parent"), "new");
  assert.equal(m("ready"), "new");
  assert.equal(m("ready", { latest: "pending" }), "pending");
  assert.equal(m("waiting_parent", { latest: "pending" }), "pending");
  assert.equal(m("ready", { latest: "rejected" }), "again");
  assert.equal(m("ready", { latest: "withdrawn" }), "again");
  assert.equal(m("ready", { teacher: { suspended: true, codeCurrent: true } }), "suspended");
  assert.equal(m("ready", { teacher: { suspended: false, codeCurrent: false } }), "code-outdated");
  assert.equal(m("ready", { teacher: { suspended: false, codeCurrent: true } }), "teacher");
  assert.equal(m("needs_parent", { teacher: { suspended: false, codeCurrent: true } }), "teacher");
  assert.equal(canApplyIn("new"), true);
  assert.equal(canApplyIn("again"), true);
  for (const mode of ["pending", "teacher", "adult", "needs-age", "no-handle", "parent-declined"] as const) {
    assert.equal(canApplyIn(mode), false, mode);
  }
});

test("parent steps", () => {
  assert.equal(parentStepFor("ready"), "agreed");
  assert.equal(parentStepFor("waiting_parent"), "waiting");
  assert.equal(parentStepFor("needs_parent"), "not_asked");
  assert.equal(parentStepFor("parent_declined"), "declined");
  assert.equal(parentStepFor("adult"), null);
  const now = new Date("2026-11-10T00:00:00Z");
  const later = "2026-11-20T00:00:00Z";
  const earlier = "2026-11-01T00:00:00Z";
  assert.equal(parentStepFromRows([], now), "not_asked");
  assert.equal(parentStepFromRows([{ status: "sent", expires_at: later }], now), "waiting");
  assert.equal(parentStepFromRows([{ status: "sent", expires_at: earlier }], now), "not_asked");
  assert.equal(parentStepFromRows([{ status: "declined", expires_at: later }], now), "declined");
  assert.equal(parentStepFromRows([{ status: "revoked", expires_at: later }], now), "declined");
  assert.equal(
    parentStepFromRows(
      [
        { status: "sent", expires_at: later },
        { status: "agreed", expires_at: earlier },
      ],
      now
    ),
    "agreed"
  );
});
