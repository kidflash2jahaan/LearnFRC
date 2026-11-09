import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DANGER_LINE,
  OWNER_RESTRICTED_LINE,
  VIDEO_LINE,
  codeFlagLine,
  reviewMails,
  routeReview,
  unknownMeetingMail,
  type ReviewMail,
  type ReviewMailFacts,
} from "./safety-routing.ts";
import type { StoredModelFlag } from "./review-prompt.ts";
import type { CodeFlag } from "./code-flags.ts";

const QUOTE = "are you home alone right now";

function flag(over: Partial<StoredModelFlag>): StoredModelFlag {
  return {
    severity: "check",
    category: "personal_info",
    atSeconds: 751,
    speaker: "S1",
    quote: QUOTE,
    why: 'shared a phone number, saying "text me at the number"',
    speakerUserId: "s1",
    speakerUsername: "sam_the_student",
    ...over,
  };
}

const codeFlag: CodeFlag = {
  kind: "contact_pattern",
  severity: "check",
  userId: "s1",
  username: "sam_the_student",
  role: "student",
  atSeconds: 751,
  count: 1,
  kinds: ["phone"],
  detail: "@sam_the_student said a phone number aloud",
};

function facts(over: Partial<ReviewMailFacts> = {}): ReviewMailFacts {
  return {
    classId: "c1",
    title: "Wiring a CAN bus",
    whenPacific: "Thu, Nov 19, 5:00 PM PT",
    datePacific: "Thu, Nov 19",
    teacherUsername: "maya_teaches",
    firstClass: true,
    studentsJoined: 2,
    teacherMinutes: 52,
    transcriptCoverage: "1 session, 2,104 words",
    camera: [{ username: "maya_teaches", minutes: 12 }],
    screenshare: [],
    chatBlockedCount: 1,
    status: "ready",
    verdict: "needs_review",
    restricted: false,
    summary: ["Wired a CAN bus.", 'A student said "this is so cool".'],
    oneLine: "A solid first class.",
    codeFlags: [codeFlag],
    modelFlags: [flag({})],
    reviewUrl: "https://learnfrc.com/admin/classes/c1",
    playbookUrl: "https://learnfrc.com/admin/classes/playbook",
    ...over,
  };
}

/** Everything a mail would put in front of a reader, as one string. */
function text(m: ReviewMail): string {
  return [
    m.subject,
    m.heading,
    m.intro ?? "",
    ...m.rows.map((r) => `${r.label}: ${r.value}`),
    ...m.sections.flatMap((s) => [s.title, ...s.lines]),
    ...m.notes,
    ...m.buttons.map((b) => `${b.text} ${b.url}`),
  ].join("\n");
}

test("routing follows section 7.5's table", () => {
  assert.deepEqual(routeReview({ verdict: "looks_fine", restricted: false, refused: false }), { owner: "full", safety: "none", urgent: false });
  assert.deepEqual(routeReview({ verdict: "needs_review", restricted: false, refused: false }), { owner: "full", safety: "none", urgent: false });
  assert.deepEqual(routeReview({ verdict: "urgent", restricted: false, refused: false }), { owner: "full", safety: "full", urgent: true });
  assert.deepEqual(routeReview({ verdict: "urgent", restricted: true, refused: false }), { owner: "one_line", safety: "full", urgent: true });
  assert.deepEqual(routeReview({ verdict: "needs_review", restricted: true, refused: true }), { owner: "one_line", safety: "full", urgent: true });
});

test("routine notes go to the owner only, with usernames, the video line and no quotes", () => {
  const mails = reviewMails(facts());
  assert.equal(mails.length, 1);
  const m = mails[0];
  assert.equal(m.audience, "owner");
  assert.equal(m.subject, "LearnFRC class notes: Wiring a CAN bus (needs a look)");
  const t = text(m);
  assert.ok(t.includes("@maya_teaches"));
  assert.ok(t.includes("[12:31] check, personal info, @sam_the_student: shared a phone number"));
  assert.ok(t.includes("check, contact details said aloud: @sam_the_student said a phone number aloud"));
  assert.ok(t.includes(VIDEO_LINE));
  assert.ok(!t.includes(QUOTE), "the model's quote never reaches an email");
  assert.ok(!t.includes("text me at the number"), "quoted words in a description are cut");
  assert.ok(!t.includes("this is so cool"), "quoted words in the summary are cut");
  assert.ok(!t.includes(DANGER_LINE));
  assert.deepEqual(
    m.buttons.map((b) => b.url),
    [
      "https://learnfrc.com/admin/classes/c1",
      "https://learnfrc.com/admin/classes/c1?decide=approve",
      "https://learnfrc.com/admin/classes/c1?decide=reject",
    ]
  );
  assert.ok(t.includes("Teacher's first class: yes"));
  assert.ok(t.includes("Chat messages the filter stopped: 1"));
  assert.ok(t.includes("Camera minutes: @maya_teaches 12"));
  assert.equal(reviewMails(facts({ verdict: "looks_fine", modelFlags: [], codeFlags: [] }))[0].subject, "LearnFRC class notes: Wiring a CAN bus (looks fine)");
});

test("urgent and not restricted: both get full notes, the safety lead also the playbook", () => {
  const mails = reviewMails(
    facts({ verdict: "urgent", modelFlags: [flag({ severity: "urgent", category: "self_harm", why: "talked about not wanting to be here" })] })
  );
  assert.deepEqual(mails.map((m) => m.audience), ["owner", "safety"]);
  for (const m of mails) {
    assert.equal(m.subject, "[Check now] LearnFRC safety: class on Thu, Nov 19");
    const t = text(m);
    assert.ok(t.includes(DANGER_LINE), "self-harm carries the 911 and 988 line");
    assert.ok(t.includes(VIDEO_LINE));
    assert.equal(m.buttons[0].url, "https://learnfrc.com/admin/classes/c1#recording");
    assert.ok(!m.buttons.some((b) => b.url.includes("decide=")), "no approve button on an urgent class");
    assert.ok(!t.includes(QUOTE));
  }
  assert.ok(mails[1].buttons.some((b) => b.url.endsWith("/admin/classes/playbook")));
  assert.ok(!mails[0].buttons.some((b) => b.url.endsWith("/playbook")));
});

test("urgent and restricted: the owner gets one line, the safety lead the notes without quotes", () => {
  const mails = reviewMails(
    facts({
      verdict: "urgent",
      restricted: true,
      modelFlags: [flag({ severity: "urgent", category: "grooming", quote: "", why: "Asked a student whether they were home alone." })],
    })
  );
  const [owner, safety] = mails;
  assert.equal(owner.audience, "owner");
  assert.equal(owner.heading, OWNER_RESTRICTED_LINE);
  assert.equal(owner.rows.length, 0);
  assert.equal(owner.sections.length, 0);
  assert.ok(!text(owner).includes("grooming"));
  assert.ok(!text(owner).includes("@sam_the_student"));
  assert.equal(safety.audience, "safety");
  assert.ok(text(safety).includes("urgent, grooming signs, @sam_the_student"));
  assert.ok(text(safety).includes("Quotes and the transcript are only on the review page"));
});

test("a refusal routes to the safety lead as urgent", () => {
  const mails = reviewMails(facts({ status: "refused", verdict: "urgent", restricted: true, summary: [], modelFlags: [], oneLine: "" }));
  assert.deepEqual(mails.map((m) => m.audience), ["owner", "safety"]);
  assert.equal(mails[0].heading, OWNER_RESTRICTED_LINE);
  assert.equal(mails[1].subject, "[Check now] LearnFRC safety: class on Thu, Nov 19");
  assert.match(mails[1].heading, /declined to write notes/);
  assert.match(mails[1].intro ?? "", /playbook/);
});

test("code flag lines and the unknown-meeting alarm", () => {
  assert.equal(codeFlagLine(codeFlag), "[12:31] check, contact details said aloud: @sam_the_student said a phone number aloud");
  const m = unknownMeetingMail({ meetingId: "m-x", event: "meeting.started", adminUrl: "https://learnfrc.com/admin/classes" });
  assert.match(m.heading, /could be a breakout room/);
  assert.ok(m.rows.some((r) => r.value === "m-x"));
});

test("no em dashes in any mail copy", () => {
  const all = [
    ...reviewMails(facts()),
    ...reviewMails(facts({ verdict: "urgent", restricted: true })),
    ...reviewMails(facts({ status: "no_transcript", verdict: "needs_review" })),
    unknownMeetingMail({ meetingId: "m", event: "e", adminUrl: "u" }),
  ];
  for (const m of all) assert.ok(!/\u2014/.test(text(m)), m.subject);
});
