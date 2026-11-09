import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clock,
  codeVerdict,
  computeCodeFlags,
  flaggedStudentIds,
  longClock,
  mediaMinutesFromEvents,
  oneOnOneMs,
  stricterVerdict,
  type CodeFlagInput,
  type ReviewPerson,
} from "./code-flags.ts";

const T0 = Date.parse("2026-11-20T01:00:00Z");
const min = (m: number) => new Date(T0 + m * 60_000).toISOString();

const teacher: ReviewPerson = { userId: "t", username: "maya", role: "teacher", ageBand: "16-17", accountAgeDays: 300 };
const s1: ReviewPerson = { userId: "s1", username: "sam", role: "student", ageBand: "13-15", accountAgeDays: 210 };
const s2: ReviewPerson = { userId: "s2", username: "lee", role: "student", ageBand: "16-17", accountAgeDays: 3 };
const staff: ReviewPerson = { userId: "x", username: "jahaan", role: "staff", ageBand: null, accountAgeDays: 900 };

function base(over: Partial<CodeFlagInput> = {}): CodeFlagInput {
  return {
    people: [teacher, s1, s2],
    attendance: [
      { userId: "t", role: "teacher", joinedAt: min(-5), leftAt: min(60), accountAgeDays: 300 },
      { userId: "s1", role: "student", joinedAt: min(0), leftAt: min(60), accountAgeDays: 210 },
      { userId: "s2", role: "student", joinedAt: min(0), leftAt: min(60), accountAgeDays: 3 },
    ],
    startsAt: min(0),
    hardEndAt: min(75),
    durationMinutes: 60,
    transcript: [{ atSeconds: 60, userId: "t", role: "teacher", text: "today we're wiring a CAN bus to the roboRIO on team 5835's robot" }],
    hasTranscript: true,
    noTranscriptDue: false,
    wordCount: 2000,
    chat: [],
    media: { camera: {}, screenshare: {} },
    duplicatePeerUserIds: [],
    removedUserIds: [],
    reports: [],
    networkHashes: [],
    parentSameNetworkUserIds: [],
    minStudentAccountDays: 7,
    ...over,
  };
}

const kinds = (flags: { kind: string }[]) => flags.map((f) => f.kind).sort();

test("a clean class has only the new-accounts note and looks fine", () => {
  const flags = computeCodeFlags(base());
  assert.deepEqual(kinds(flags), ["new_accounts"]);
  assert.equal(flags[0].severity, "note");
  assert.equal(codeVerdict(flags), "looks_fine");
});

test("robotics talk said aloud raises nothing", () => {
  const flags = computeCodeFlags(
    base({
      people: [teacher, s1],
      transcript: [
        { atSeconds: 10, userId: "t", role: "teacher", text: "set CAN ID 12 and the robot IP is 10.58.35.2 on port 5800" },
        { atSeconds: 20, userId: "s1", role: "student", text: "the shooter killed the brownout, kill the motors, it blew up" },
        { atSeconds: 30, userId: "t", role: "teacher", text: "check chiefdelphi.com and docs.wpilib.org for the @Override example" },
      ],
    })
  );
  assert.deepEqual(kinds(flags), []);
});

test("a phone number said aloud by a student is a check; by the teacher it's urgent", () => {
  const said = "text me at two zero two five five five zero one four three";
  const student = computeCodeFlags(
    base({ people: [teacher, s1], transcript: [{ atSeconds: 751, userId: "s1", role: "student", text: said }] })
  );
  const f = student.find((x) => x.kind === "contact_pattern")!;
  assert.equal(f.severity, "check");
  assert.equal(f.userId, "s1");
  assert.equal(f.atSeconds, 751);
  assert.ok(f.kinds!.includes("phone"));
  assert.ok(f.detail.includes("@sam"));
  assert.ok(!f.detail.includes("two zero"), "no quote of what was said");
  assert.equal(codeVerdict(student), "needs_review");

  const byTeacher = computeCodeFlags(
    base({ people: [teacher, s1], transcript: [{ atSeconds: 5, userId: "t", role: "teacher", text: said }] })
  );
  assert.equal(byTeacher.find((x) => x.kind === "contact_pattern")!.severity, "urgent");
  assert.equal(codeVerdict(byTeacher), "urgent");
});

test("a link off the allowlist said aloud by the teacher is only a check", () => {
  const flags = computeCodeFlags(
    base({ people: [teacher, s1], transcript: [{ atSeconds: 5, userId: "t", role: "teacher", text: "the code is on github.com" }] })
  );
  assert.equal(flags.find((x) => x.kind === "contact_pattern")!.severity, "check");
});

test("staff lines aren't scanned", () => {
  const flags = computeCodeFlags(
    base({
      people: [teacher, s1, staff],
      transcript: [{ atSeconds: 5, userId: "x", role: "staff", text: "email me at help at gmail dot com" }],
    })
  );
  assert.equal(flags.find((x) => x.kind === "contact_pattern"), undefined);
});

test("chat_blocked: a link is a note, contact details a check for a student and urgent for the teacher", () => {
  const flags = computeCodeFlags(
    base({
      people: [teacher, s1, s2],
      chat: [
        { atSeconds: 100, userId: "s2", role: "student", status: "blocked", blockedKinds: ["link"], body: "x" },
        { atSeconds: 120, userId: "s1", role: "student", status: "blocked", blockedKinds: ["contact_app"], body: "x" },
        { atSeconds: 130, userId: "s1", role: "student", status: "blocked", blockedKinds: ["handle"], body: "x" },
        { atSeconds: 140, userId: "t", role: "teacher", status: "blocked", blockedKinds: ["contact_phrase", "contact_app"], body: "x" },
        { atSeconds: 150, userId: "t", role: "teacher", status: "shown", blockedKinds: [], body: "fine" },
      ],
    })
  );
  const blocked = flags.filter((f) => f.kind === "chat_blocked");
  const by = (id: string) => blocked.find((f) => f.userId === id)!;
  assert.equal(by("s2").severity, "note");
  assert.equal(by("s1").severity, "check");
  assert.equal(by("s1").count, 2);
  assert.deepEqual(by("s1").kinds!.sort(), ["contact_app", "handle"]);
  assert.equal(by("t").severity, "urgent");
  assert.equal(codeVerdict(flags), "urgent");
});

test("an adult or an under-13 in the class is urgent; staff never count", () => {
  const flags = computeCodeFlags(
    base({
      people: [
        { ...teacher, ageBand: "18+" },
        { ...s1, ageBand: "under13" },
        staff,
      ],
    })
  );
  assert.ok(flags.some((f) => f.kind === "adult_present" && f.userId === "t" && f.severity === "urgent"));
  assert.ok(flags.some((f) => f.kind === "under_13_present" && f.userId === "s1"));
  assert.ok(!flags.some((f) => f.userId === "x"));
});

test("one-on-one: 5+ minutes with the teacher and exactly one student, no staff", () => {
  const att = [
    { userId: "t", role: "teacher" as const, joinedAt: min(0), leftAt: min(30), accountAgeDays: 300 },
    { userId: "s1", role: "student" as const, joinedAt: min(0), leftAt: min(30), accountAgeDays: 210 },
    // s1's second tab doesn't make a second student.
    { userId: "s1", role: "student" as const, joinedAt: min(5), leftAt: min(10), accountAgeDays: 210 },
    { userId: "s2", role: "student" as const, joinedAt: min(20), leftAt: min(30), accountAgeDays: 210 },
  ];
  assert.equal(oneOnOneMs(att, min(75)), 20 * 60_000);
  const flags = computeCodeFlags(base({ attendance: att }));
  const f = flags.find((x) => x.kind === "one_on_one")!;
  assert.equal(f.count, 20);
  assert.equal(f.severity, "check");

  // Staff in the room makes it not one-on-one.
  const withStaff = [...att, { userId: "x", role: "staff" as const, joinedAt: min(0), leftAt: min(30), accountAgeDays: 900 }];
  assert.equal(oneOnOneMs(withStaff, min(75)), 0);
  // Under 5 minutes isn't flagged.
  const short = att.map((a) => (a.userId === "s2" ? { ...a, joinedAt: min(4) } : a));
  assert.equal(computeCodeFlags(base({ attendance: short })).find((x) => x.kind === "one_on_one"), undefined);
});

test("media minutes union every reporter; a student's camera is urgent, the teacher's is info", () => {
  const media = mediaMinutesFromEvents(
    [
      { subjectUserId: "t", kind: "camera", isOn: true, at: min(0), reportedBy: "s1" },
      { subjectUserId: "t", kind: "camera", isOn: false, at: min(10), reportedBy: "s1" },
      { subjectUserId: "t", kind: "camera", isOn: true, at: min(5), reportedBy: "s2" },
      { subjectUserId: "t", kind: "camera", isOn: false, at: min(12), reportedBy: "s2" },
      // A tampered teacher browser reporting nothing doesn't hide the student's view.
      { subjectUserId: "s1", kind: "camera", isOn: true, at: min(20), reportedBy: "s2" },
      { subjectUserId: "s1", kind: "camera", isOn: false, at: min(20.3), reportedBy: "s2" },
      // Left on: closes at closeAt.
      { subjectUserId: "t", kind: "screenshare", isOn: true, at: min(50), reportedBy: "s1" },
    ],
    min(60)
  );
  assert.deepEqual(media, { camera: { t: 12, s1: 1 }, screenshare: { t: 10 } });
  const flags = computeCodeFlags(base({ media }));
  assert.equal(flags.find((f) => f.kind === "camera_minutes" && f.userId === "s1")!.severity, "urgent");
  assert.equal(flags.find((f) => f.kind === "camera_minutes" && f.userId === "t")!.severity, "info");
  assert.equal(flags.find((f) => f.kind === "screenshare_minutes" && f.userId === "t")!.severity, "info");
});

test("shared networks, parent same-network and the one-click exclusion list", () => {
  const flags = computeCodeFlags(
    base({
      people: [teacher, s1, s2, staff],
      networkHashes: [
        { userId: "t", ipHash: "h1" },
        { userId: "s1", ipHash: "h1" },
        { userId: "s2", ipHash: "h2" },
        { userId: "x", ipHash: "h2" },
      ],
      parentSameNetworkUserIds: ["s2"],
    })
  );
  const shared = flags.filter((f) => f.kind === "shared_network");
  assert.equal(shared.length, 1, "staff sharing a network doesn't count");
  assert.deepEqual(shared[0].userIds, ["t", "s1"]);
  assert.equal(shared[0].severity, "check");
  assert.ok(flags.some((f) => f.kind === "parent_same_network" && f.userId === "s2"));
  assert.deepEqual(flaggedStudentIds(flags, [teacher, s1, s2]).sort(), ["s1", "s2"]);
});

test("duplicates, removals and reports are checks", () => {
  const flags = computeCodeFlags(
    base({
      duplicatePeerUserIds: ["s1", "s1"],
      removedUserIds: ["s2"],
      reports: [{ reportedUserId: "t", reportedUsername: "maya", reason: "private_contact" }],
    })
  );
  assert.equal(flags.filter((f) => f.kind === "duplicate_peer").length, 1);
  assert.ok(flags.some((f) => f.kind === "removed_participant" && f.userId === "s2" && f.severity === "check"));
  const r = flags.find((f) => f.kind === "report_filed")!;
  assert.equal(r.severity, "check");
  assert.ok(r.detail.includes("@maya") && r.detail.includes("private contact"));
});

test("no transcript: a check, or urgent when a report was filed; short transcripts are checks", () => {
  const none = computeCodeFlags(base({ hasTranscript: false, noTranscriptDue: true, transcript: [], wordCount: 0 }));
  assert.equal(none.find((f) => f.kind === "no_transcript")!.severity, "check");
  assert.equal(codeVerdict(none), "needs_review");
  const notYet = computeCodeFlags(base({ hasTranscript: false, noTranscriptDue: false, transcript: [], wordCount: 0 }));
  assert.equal(notYet.find((f) => f.kind === "no_transcript"), undefined);
  const reported = computeCodeFlags(
    base({
      hasTranscript: false,
      noTranscriptDue: true,
      transcript: [],
      wordCount: 0,
      reports: [{ reportedUserId: "t", reportedUsername: "maya", reason: "unsafe" }],
    })
  );
  assert.equal(reported.find((f) => f.kind === "no_transcript")!.severity, "urgent");
  const short = computeCodeFlags(base({ wordCount: 120 }));
  assert.equal(short.find((f) => f.kind === "short_transcript")!.severity, "check");
  assert.equal(computeCodeFlags(base({ wordCount: 120, durationMinutes: 20 })).find((f) => f.kind === "short_transcript"), undefined);
});

test("verdicts: the stricter one wins and flags sort most severe first", () => {
  assert.equal(stricterVerdict("looks_fine", "needs_review"), "needs_review");
  assert.equal(stricterVerdict("urgent", "looks_fine"), "urgent");
  assert.equal(stricterVerdict("needs_review", "needs_review"), "needs_review");
  const flags = computeCodeFlags(
    base({ removedUserIds: ["s2"], people: [{ ...teacher, ageBand: "18+" }, s1, s2] })
  );
  assert.equal(flags[0].severity, "urgent");
  assert.equal(flags[flags.length - 1].severity, "note");
});

test("clocks", () => {
  assert.equal(clock(751), "12:31");
  assert.equal(clock(3723), "1:02:03");
  assert.equal(clock(-4), "0:00");
  assert.equal(longClock(192), "00:03:12");
});
