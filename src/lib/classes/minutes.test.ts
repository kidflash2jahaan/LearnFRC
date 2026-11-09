import { test } from "node:test";
import assert from "node:assert/strict";
import {
  creditedMinutes,
  creditedSeconds,
  intersectIntervals,
  totalMs,
  unionIntervals,
  type AttendanceSpan,
} from "./minutes.ts";

const START = "2026-11-20T01:00:00.000Z";
const HARD_END = "2026-11-20T02:15:00.000Z"; // 60 minutes + 15
const at = (min: number) => new Date(Date.parse(START) + min * 60_000).toISOString();

const teacher = (from: number, to: number | null): AttendanceSpan => ({
  userId: "t",
  role: "teacher",
  joinedAt: at(from),
  leftAt: to === null ? null : at(to),
  accountAgeDays: 300,
});
const student = (id: string, from: number, to: number | null, accountAgeDays = 100): AttendanceSpan => ({
  userId: id,
  role: "student",
  joinedAt: at(from),
  leftAt: to === null ? null : at(to),
  accountAgeDays,
});

const base = { startsAt: START, hardEndAt: HARD_END, minStudentAccountDays: 7 };

test("a teacher alone earns nothing", () => {
  assert.equal(creditedMinutes({ ...base, attendance: [teacher(0, 60)] }), 0);
});

test("only time with a countable student counts", () => {
  const minutes = creditedMinutes({
    ...base,
    attendance: [teacher(0, 60), student("a", 10, 40)],
  });
  assert.equal(minutes, 30);
});

test("overlapping students are counted once", () => {
  const minutes = creditedMinutes({
    ...base,
    attendance: [teacher(0, 60), student("a", 0, 40), student("b", 20, 60)],
  });
  assert.equal(minutes, 60);
});

test("a second tab (two teacher connections at once) counts once", () => {
  const minutes = creditedMinutes({
    ...base,
    attendance: [teacher(0, 60), teacher(10, 50), student("a", 0, 60)],
  });
  assert.equal(minutes, 60);
});

test("new accounts, unknown account ages and staff don't count", () => {
  const minutes = creditedMinutes({
    ...base,
    attendance: [
      teacher(0, 60),
      student("new", 0, 60, 3),
      { ...student("unknown", 0, 60), accountAgeDays: null },
      { userId: "x", role: "staff", joinedAt: at(0), leftAt: at(60), accountAgeDays: 999 },
    ],
  });
  assert.equal(minutes, 0);
});

test("excluded (flagged) students don't count", () => {
  const input = {
    ...base,
    attendance: [teacher(0, 60), student("a", 0, 30), student("b", 30, 60)],
  };
  assert.equal(creditedMinutes(input), 60);
  assert.equal(creditedMinutes({ ...input, excludeUserIds: ["b"] }), 30);
});

test("clipped to [starts_at - 10 min, hard_end_at]", () => {
  const minutes = creditedMinutes({
    ...base,
    attendance: [teacher(-30, 100), student("a", -30, 100)],
  });
  // -10 to 75 (hard end is start + 75 minutes).
  assert.equal(minutes, 85);
});

test("an open interval closes at the session end, else at the hard end", () => {
  const closedBySession = creditedMinutes({
    ...base,
    attendance: [
      { ...teacher(0, null), sessionEndedAt: at(45) },
      { ...student("a", 0, null), sessionEndedAt: at(45) },
    ],
  });
  assert.equal(closedBySession, 45);
  const neverClosed = creditedMinutes({
    ...base,
    attendance: [teacher(0, null), student("a", 0, null)],
  });
  assert.equal(neverClosed, 75);
});

test("seconds floor to whole minutes", () => {
  const input = {
    ...base,
    attendance: [
      teacher(0, 60),
      { ...student("a", 0, 0), leftAt: new Date(Date.parse(START) + 119_000).toISOString() },
    ],
  };
  assert.equal(creditedSeconds(input), 119);
  assert.equal(creditedMinutes(input), 1);
});

test("interval helpers", () => {
  assert.deepEqual(unionIntervals([{ start: 5, end: 10 }, { start: 0, end: 6 }, { start: 20, end: 30 }]), [
    { start: 0, end: 10 },
    { start: 20, end: 30 },
  ]);
  assert.deepEqual(intersectIntervals([{ start: 0, end: 10 }], [{ start: 5, end: 20 }]), [{ start: 5, end: 10 }]);
  assert.equal(totalMs([{ start: 0, end: 10 }, { start: 5, end: 15 }]), 15);
});
