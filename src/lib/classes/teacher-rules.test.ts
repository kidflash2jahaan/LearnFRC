import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TEACHER_APPLY_LIMITS,
  canApplyIn,
  checkTeacherApplication,
  letterNameProblem,
  lettersBlockedFor,
  normalizeName,
  parentStepFromRows,
  parentStepFor,
  teachApplyMode,
} from "./teacher-rules.ts";

const long = (n: number) => "x".repeat(n);
const good = {
  legalName: "  Maya   Chen ",
  topics: "CAN wiring, swerve basics",
  topicIds: ["0b8f8d4e-5a7c-4b5e-9d1a-2f3c4d5e6f70"],
  experience: "Two seasons on electrical, I wired our 2026 robot and taught rookies.",
  samplePlan: "Ten minutes on why CAN, twenty on wiring a loop, then questions and a quiz.",
  availability: "weekends",
  referenceName: "",
  referenceEmail: "",
};

test("a good application passes, trimmed", () => {
  const r = checkTeacherApplication(good);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.legalName, "Maya Chen");
  assert.deepEqual(r.value.topicIds, good.topicIds);
  assert.equal(r.value.referenceName, null);
  assert.equal(r.value.referenceEmail, null);
  assert.equal(r.value.availability, "weekends");
});

test("each field reports itself", () => {
  const field = (patch: Record<string, unknown>) => {
    const r = checkTeacherApplication({ ...good, ...patch });
    return r.ok ? null : r.field;
  };
  assert.equal(field({ legalName: "" }), "legalName");
  assert.equal(field({ legalName: "M" }), "legalName");
  assert.equal(field({ legalName: long(81) }), "legalName");
  assert.equal(field({ legalName: "Maya 5835" }), "legalName");
  assert.equal(field({ legalName: "maya@example.com" }), "legalName");
  assert.equal(field({ legalName: "www.maya.dev" }), "legalName");
  assert.equal(field({ topics: "" }), "topics");
  assert.equal(field({ topics: long(301) }), "topics");
  assert.equal(field({ topicIds: ["not-a-uuid"] }), "topicIds");
  assert.equal(
    field({
      topicIds: [1, 2, 3, 4, 5, 6].map((n) => `0b8f8d4e-5a7c-4b5e-9d1a-2f3c4d5e6f7${n}`),
    }),
    "topicIds"
  );
  assert.equal(field({ experience: "short" }), "experience");
  assert.equal(field({ experience: long(TEACHER_APPLY_LIMITS.longMax + 1) }), "experience");
  assert.equal(field({ samplePlan: "short" }), "samplePlan");
  assert.equal(field({ availability: long(201) }), "availability");
  assert.equal(field({ referenceName: long(81) }), "referenceName");
  assert.equal(field({ referenceEmail: "coach at team" }), "referenceEmail");
  assert.equal(field({ referenceEmail: "Coach@Example.com" }), null);
});

test("non-strings count as empty, and a single topic id is accepted", () => {
  assert.equal(checkTeacherApplication({ ...good, experience: 42 }).ok, false);
  const one = checkTeacherApplication({ ...good, topicIds: good.topicIds[0] });
  assert.equal(one.ok, true);
  const dupes = checkTeacherApplication({ ...good, topicIds: [good.topicIds[0], good.topicIds[0]] });
  assert.equal(dupes.ok && dupes.value.topicIds.length, 1);
  const none = checkTeacherApplication({ ...good, topicIds: undefined });
  assert.equal(none.ok && none.value.topicIds.length, 0);
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
