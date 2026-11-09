import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewDue, sweepDecision, type SweepClass, type SweepSpan } from "./sweep-rules.ts";

const S = Date.parse("2026-11-20T01:00:00Z");
const m = (min: number) => S + min * 60_000;
const live: SweepClass = { status: "live", startsAt: S, hardEndAt: m(75), hasSession: true };

test("hard end: live classes end with time, never-started ones with sweep", () => {
  assert.deepEqual(sweepDecision(live, [], m(75)), { action: "end", reason: "time" });
  assert.deepEqual(sweepDecision({ ...live, status: "scheduled", hasSession: false }, [], m(80)), { action: "end", reason: "sweep" });
  assert.deepEqual(sweepDecision({ ...live, status: "scheduled", hasSession: true }, [], m(80)), { action: "end", reason: "time" });
  assert.deepEqual(sweepDecision({ ...live, status: "ended" }, [], m(80)), { action: "none" });
  assert.deepEqual(sweepDecision({ ...live, status: "scheduled", hasSession: false }, [], m(70)), { action: "none" });
});

test("teacher gone for 10 minutes with students present", () => {
  const att: SweepSpan[] = [
    { role: "teacher", joinedAt: m(-5), leftAt: m(20) },
    { role: "student", joinedAt: m(0), leftAt: null },
  ];
  assert.deepEqual(sweepDecision(live, att, m(29)), { action: "none" });
  assert.deepEqual(sweepDecision(live, att, m(30)), { action: "end", reason: "teacher_gone" });
  // The teacher came back.
  const back = [...att, { role: "teacher" as const, joinedAt: m(25), leftAt: null }];
  assert.deepEqual(sweepDecision(live, back, m(40)), { action: "none" });
  // Never joined: counted from the start, not from early student joins.
  const never: SweepSpan[] = [{ role: "student", joinedAt: m(-10), leftAt: null }];
  assert.deepEqual(sweepDecision(live, never, m(-1)), { action: "none" });
  assert.deepEqual(sweepDecision(live, never, m(9)), { action: "none" });
  assert.deepEqual(sweepDecision(live, never, m(10)), { action: "end", reason: "teacher_gone" });
  // Staff alone with students doesn't keep it going without the teacher.
  const staff: SweepSpan[] = [...never, { role: "staff", joinedAt: m(0), leftAt: null }];
  assert.deepEqual(sweepDecision(live, staff, m(11)), { action: "end", reason: "teacher_gone" });
});

test("empty for 10 minutes after the start", () => {
  const att: SweepSpan[] = [
    { role: "teacher", joinedAt: m(-5), leftAt: m(15) },
    { role: "student", joinedAt: m(0), leftAt: m(18) },
  ];
  assert.deepEqual(sweepDecision(live, att, m(27)), { action: "none" }, "early empty stays rejoinable");
  assert.deepEqual(sweepDecision(live, att, m(28)), { action: "end", reason: "empty" });
  // Nobody ever came: from the start.
  assert.deepEqual(sweepDecision(live, [], m(9)), { action: "none" });
  assert.deepEqual(sweepDecision(live, [], m(10)), { action: "end", reason: "empty" });
  // A teacher alone isn't empty or teacher-gone.
  assert.deepEqual(sweepDecision(live, [{ role: "teacher", joinedAt: m(0), leftAt: null }], m(60)), { action: "none" });
});

test("reviews due 30 minutes after the end, and failed ones retried up to 3 times", () => {
  const ended = { status: "ended", endedAt: m(60), hardEndAt: m(75) };
  assert.equal(reviewDue(ended, null, m(89)), null);
  assert.equal(reviewDue(ended, null, m(90)), "run");
  assert.equal(reviewDue(ended, { status: "pending", attempts: 0, updatedAt: m(61) }, m(90)), "run");
  assert.equal(reviewDue({ ...ended, endedAt: null }, null, m(100)), null, "falls back to the hard end");
  assert.equal(reviewDue({ ...ended, endedAt: null }, null, m(105)), "run");
  assert.equal(reviewDue(ended, { status: "ready", attempts: 1, updatedAt: m(70) }, m(200)), null);
  assert.equal(reviewDue(ended, { status: "failed", attempts: 1, updatedAt: m(70) }, m(99)), null);
  assert.equal(reviewDue(ended, { status: "failed", attempts: 1, updatedAt: m(70) }, m(100)), "retry");
  assert.equal(reviewDue(ended, { status: "failed", attempts: 3, updatedAt: m(70) }, m(300)), null);
  assert.equal(reviewDue({ ...ended, status: "live" }, null, m(300)), null);
  assert.equal(reviewDue({ ...ended, status: "approved" }, null, m(300)), null);
});
