import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LETTER_CODE_ALPHABET,
  LETTER_CODE_PATTERN,
  checkLetterPeriod,
  classesForLetter,
  defaultLetterPeriod,
  hoursAndMinutes,
  isIsoDate,
  letterParagraphs,
  letterTotals,
  longDate,
  makeLetterCode,
  normalizeLetterCode,
  pacificDate,
  schoolYearStart,
  snapshotDrift,
  verifyUrlFor,
  verifyUrlLabel,
  type CurrentClass,
  type LetterSourceClass,
} from "./letter-rules.ts";

const T = "teacher-1";

const cls = (over: Partial<LetterSourceClass> & { id: string }): LetterSourceClass => ({
  teacherId: T,
  status: "approved",
  rtkApp: "prod",
  startsAt: "2026-10-01T01:00:00.000Z",
  creditedMinutes: 45,
  title: `Class ${over.id}`,
  topic: "Wiring a CAN bus",
  ...over,
});

test("pacificDate uses Pacific time, not UTC", () => {
  // 01:00 UTC on Oct 2 is still Oct 1 in California.
  assert.equal(pacificDate("2026-10-02T01:00:00.000Z"), "2026-10-01");
  assert.equal(pacificDate("2026-10-02T08:00:00.000Z"), "2026-10-02");
  // Winter (PST, UTC-8).
  assert.equal(pacificDate("2026-12-01T07:59:00.000Z"), "2026-11-30");
  assert.equal(pacificDate("2026-12-01T08:00:00.000Z"), "2026-12-01");
});

test("isIsoDate takes real calendar dates only", () => {
  assert.equal(isIsoDate("2026-11-08"), true);
  assert.equal(isIsoDate("2028-02-29"), true);
  assert.equal(isIsoDate("2026-02-29"), false);
  assert.equal(isIsoDate("2026-13-01"), false);
  assert.equal(isIsoDate("2026-1-1"), false);
  assert.equal(isIsoDate("11/08/2026"), false);
  assert.equal(isIsoDate(""), false);
  assert.equal(isIsoDate(null), false);
  assert.equal(isIsoDate(20261108), false);
});

test("the default range is the school year so far, Aug 1 to today", () => {
  assert.equal(schoolYearStart("2026-11-08"), "2026-08-01");
  assert.equal(schoolYearStart("2026-08-01"), "2026-08-01");
  assert.equal(schoolYearStart("2026-07-31"), "2025-08-01");
  assert.equal(schoolYearStart("2027-03-15"), "2026-08-01");
  assert.deepEqual(defaultLetterPeriod(new Date("2026-11-08T20:00:00.000Z")), {
    start: "2026-08-01",
    end: "2026-11-08",
  });
  // 03:00 UTC Jan 1 is still Dec 31 in California, so still that school year.
  assert.deepEqual(defaultLetterPeriod(new Date("2027-01-01T03:00:00.000Z")), {
    start: "2026-08-01",
    end: "2026-12-31",
  });
});

test("checkLetterPeriod: real dates, in order, not in the future", () => {
  const today = "2026-11-08";
  assert.deepEqual(checkLetterPeriod("2026-08-01", "2026-11-08", today), {
    ok: true,
    start: "2026-08-01",
    end: "2026-11-08",
  });
  assert.deepEqual(checkLetterPeriod("2026-11-08", "2026-11-08", today), {
    ok: true,
    start: "2026-11-08",
    end: "2026-11-08",
  });
  const future = checkLetterPeriod("2026-08-01", "2026-11-09", today);
  assert.equal(future.ok, false);
  assert.equal(!future.ok && future.field, "end");
  const backwards = checkLetterPeriod("2026-10-02", "2026-10-01", today);
  assert.equal(!backwards.ok && backwards.field, "start");
  assert.equal(checkLetterPeriod("", "2026-10-01", today).ok, false);
  assert.equal(checkLetterPeriod("2026-10-01", "nope", today).ok, false);
});

test("only approved classes the teacher taught, in this app, with minutes, in range", () => {
  const source: LetterSourceClass[] = [
    cls({ id: "a", startsAt: "2026-10-20T01:00:00.000Z", creditedMinutes: 60 }),
    cls({ id: "b", startsAt: "2026-09-05T18:00:00.000Z", creditedMinutes: 45 }),
    cls({ id: "c", startsAt: "2026-10-28T18:00:00.000Z", creditedMinutes: 30 }),
    cls({ id: "rejected", status: "rejected" }),
    cls({ id: "ended", status: "ended", creditedMinutes: null }),
    cls({ id: "in_review", status: "in_review", creditedMinutes: null }),
    cls({ id: "zero", creditedMinutes: 0 }),
    cls({ id: "nulled", creditedMinutes: null }),
    cls({ id: "other", teacherId: "teacher-2" }),
    cls({ id: "orphan", teacherId: null }),
    cls({ id: "devapp", rtkApp: "dev" }),
    cls({ id: "july", startsAt: "2026-07-20T18:00:00.000Z" }),
    // 06:30 UTC Aug 1 is 23:30 Jul 31 in California: outside the range.
    cls({ id: "edge-out", startsAt: "2026-08-01T06:30:00.000Z" }),
    // 07:30 UTC Aug 1 is 00:30 Aug 1 in California: inside.
    cls({ id: "edge-in", startsAt: "2026-08-01T07:30:00.000Z", creditedMinutes: 15 }),
  ];
  const picked = classesForLetter(source, { teacherId: T, app: "prod", start: "2026-08-01", end: "2026-11-08" });
  assert.deepEqual(
    picked.map((c) => c.classId),
    ["edge-in", "b", "a", "c"]
  );
  assert.deepEqual(picked[2], {
    classId: "a",
    date: "2026-10-19",
    title: "Class a",
    topic: "Wiring a CAN bus",
    minutes: 60,
  });
  assert.deepEqual(letterTotals(picked), { totalMinutes: 150, classCount: 4 });

  // A narrower range, and the dev app on a dev server.
  assert.deepEqual(
    classesForLetter(source, { teacherId: T, app: "prod", start: "2026-10-01", end: "2026-10-27" }).map((c) => c.classId),
    ["a"]
  );
  assert.deepEqual(
    classesForLetter(source, { teacherId: T, app: "dev", start: "2026-08-01", end: "2026-11-08" }).map((c) => c.classId),
    ["devapp"]
  );
  assert.deepEqual(letterTotals([]), { totalMinutes: 0, classCount: 0 });
});

test("hoursAndMinutes reads naturally", () => {
  assert.equal(hoursAndMinutes(0), "0 minutes");
  assert.equal(hoursAndMinutes(1), "1 minute");
  assert.equal(hoursAndMinutes(45), "45 minutes");
  assert.equal(hoursAndMinutes(60), "1 hour");
  assert.equal(hoursAndMinutes(61), "1 hour 1 minute");
  assert.equal(hoursAndMinutes(135), "2 hours 15 minutes");
  assert.equal(hoursAndMinutes(600), "10 hours");
});

test("snapshotDrift names every class that changed since the request", () => {
  const snap = [
    { classId: "a", date: "2026-10-19", title: "A", topic: null, minutes: 60 },
    { classId: "b", date: "2026-10-20", title: "B", topic: null, minutes: 45 },
    { classId: "c", date: "2026-10-21", title: "C", topic: null, minutes: 30 },
    { classId: "d", date: "2026-10-22", title: "D", topic: null, minutes: 30 },
    { classId: "e", date: "2026-10-23", title: "E", topic: null, minutes: 30 },
  ];
  const ok: CurrentClass = { teacherId: T, status: "approved", rtkApp: "prod", creditedMinutes: 60 };
  const current = new Map<string, CurrentClass>([
    ["a", ok],
    ["b", { ...ok, creditedMinutes: 40 }],
    ["c", { ...ok, status: "rejected", creditedMinutes: 0 }],
    ["d", { ...ok, teacherId: "someone-else", creditedMinutes: 30 }],
  ]);
  const drift = snapshotDrift(snap, current, T, "prod");
  assert.equal(drift.length, 4);
  assert.match(drift[0], /"B".*40 minutes now, not 45/);
  assert.match(drift[1], /"C".*isn't approved/);
  assert.match(drift[2], /"D".*isn't theirs/);
  assert.match(drift[3], /"E".*isn't in the records/);
  assert.deepEqual(snapshotDrift(snap.slice(0, 1), current, T, "prod"), []);
  assert.equal(snapshotDrift(snap.slice(0, 1), current, T, "dev").length, 1);
});

test("codes: LF-XXXXX-XXXXX from the unambiguous alphabet", () => {
  for (const ch of "01ILOU") assert.equal(LETTER_CODE_ALPHABET.includes(ch), false, ch);
  let i = 0;
  const seq = (n: number) => i++ % n;
  const code = makeLetterCode(seq);
  assert.equal(code, "LF-23456-789AB");
  assert.match(code, LETTER_CODE_PATTERN);
  for (let k = 0; k < 200; k++) {
    assert.match(makeLetterCode((n) => Math.floor(Math.random() * n)), LETTER_CODE_PATTERN);
  }
});

test("normalizeLetterCode accepts what people type, rejects the rest", () => {
  assert.equal(normalizeLetterCode("LF-23456-789AB"), "LF-23456-789AB");
  assert.equal(normalizeLetterCode("lf-23456-789ab"), "LF-23456-789AB");
  assert.equal(normalizeLetterCode(" LF 23456 789AB "), "LF-23456-789AB");
  assert.equal(normalizeLetterCode("LF23456789AB"), "LF-23456-789AB");
  assert.equal(normalizeLetterCode("LF-23456-789A"), null);
  assert.equal(normalizeLetterCode("LF-23456-789AB1"), null);
  // 0, 1, I, L, O and U are never in a code.
  assert.equal(normalizeLetterCode("LF-23456-789A0"), null);
  assert.equal(normalizeLetterCode("LF-2345O-789AB"), null);
  assert.equal(normalizeLetterCode("XX-23456-789AB"), null);
  assert.equal(normalizeLetterCode("LF-23456-789AB'; drop table"), null);
  assert.equal(normalizeLetterCode(""), null);
  assert.equal(normalizeLetterCode(undefined), null);
  assert.equal(normalizeLetterCode("x".repeat(100)), null);
});

test("the QR payload and the printed line are the verify URL", () => {
  assert.equal(verifyUrlFor("https://learnfrc.com", "LF-23456-789AB"), "https://learnfrc.com/verify/LF-23456-789AB");
  assert.equal(verifyUrlFor("https://learnfrc.com/", "LF-23456-789AB"), "https://learnfrc.com/verify/LF-23456-789AB");
  assert.equal(verifyUrlLabel("https://learnfrc.com", "LF-23456-789AB"), "learnfrc.com/verify/LF-23456-789AB");
  assert.equal(verifyUrlLabel("http://localhost:3107", "LF-23456-789AB"), "localhost:3107/verify/LF-23456-789AB");
});

test("the letter's sentences carry the facts, with no em dashes", () => {
  const p = letterParagraphs({
    name: "Maya Example",
    start: "2026-08-01",
    end: "2026-11-08",
    classCount: 3,
    totalMinutes: 135,
  });
  assert.match(p.confirms, /that Maya Example volunteered as a teacher with LearnFRC \(learnfrc\.com\)/);
  assert.match(p.confirms, /Between August 1, 2026 and November 8, 2026, Maya Example taught 3 live online classes, for 2 hours 15 minutes of teaching time\./);
  assert.match(p.howChecked, /^How we checked: /);
  assert.match(p.howChecked, /An adult volunteer wasn't present for every class\.$/);
  const one = letterParagraphs({ name: "A B", start: "2026-08-01", end: "2026-08-01", classCount: 1, totalMinutes: 60 });
  assert.match(one.confirms, /taught 1 live online class, for 1 hour of teaching time/);
  for (const s of [p.confirms, p.howChecked, one.confirms]) assert.equal(s.includes("\u2014"), false);
  assert.equal(longDate("2026-11-08"), "November 8, 2026");
});
