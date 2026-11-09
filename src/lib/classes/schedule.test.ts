import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classWindow,
  maxConcurrent,
  overlapsOwnClass,
  parseScheduleInput,
  SCHEDULE_SENTENCES,
  siteFull,
  tidyText,
  timingRefusal,
  tooManyUpcoming,
  transcriptionKeywords,
} from "./schedule.ts";

const MIN = 60_000;
const LESSON = "11111111-2222-4333-8444-555555555555";
const MODULE = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const now = new Date("2026-11-10T18:00:00Z");
const at = (mins: number) => new Date(now.getTime() + mins * MIN);

const good = {
  title: "Wiring a CAN bus",
  description: "Bring a roboRIO if you have one.",
  topic: `lesson:${LESSON}`,
  startsAt: at(180).toISOString(),
  durationMinutes: "60",
  capacity: "15",
};

test("parseScheduleInput accepts a normal class and defaults seats to 15", () => {
  const r = parseScheduleInput({ ...good, capacity: "" });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.capacity, 15);
    assert.equal(r.value.lessonId, LESSON);
    assert.equal(r.value.moduleId, null);
    assert.equal(r.value.durationMinutes, 60);
    assert.equal(r.value.startsAt.toISOString(), at(180).toISOString());
  }
  const m = parseScheduleInput({ ...good, topic: `module:${MODULE}` });
  assert.equal(m.ok && m.value.moduleId, MODULE);
  assert.equal(m.ok && m.value.lessonId, null);
});

test("parseScheduleInput refuses each bad field with its own sentence", () => {
  const cases: [Record<string, unknown>, string][] = [
    [{ title: "abc" }, "title"],
    [{ title: "x".repeat(81) }, "title"],
    [{ description: "x".repeat(601) }, "description"],
    [{ topic: "" }, "topic"],
    [{ topic: "lesson:not-a-uuid" }, "topic"],
    [{ topic: "page:" + LESSON }, "topic"],
    [{ startsAt: "2026-11-10T20:00" }, "startsAt"],
    [{ startsAt: "tomorrow" }, "startsAt"],
    [{ durationMinutes: "14" }, "durationMinutes"],
    [{ durationMinutes: "91" }, "durationMinutes"],
    [{ durationMinutes: "30.5" }, "durationMinutes"],
    [{ capacity: "1" }, "capacity"],
    [{ capacity: "16" }, "capacity"],
  ];
  for (const [patch, field] of cases) {
    const r = parseScheduleInput({ ...good, ...patch });
    assert.equal(r.ok, false, JSON.stringify(patch));
    if (!r.ok) assert.equal(r.field, field, JSON.stringify(patch));
  }
  const both = parseScheduleInput({ ...good, topic: "", lessonId: LESSON, moduleId: MODULE });
  assert.equal(both.ok, false);
});

test("a first class gets the full 15 seats like any other", () => {
  const r = parseScheduleInput({ ...good, capacity: "15" });
  assert.equal(r.ok && r.value.capacity, 15);
});

test("tidyText trims and collapses spaces but keeps paragraphs", () => {
  assert.equal(tidyText("  a   b \n\n\n\n c  "), "a b\n\nc");
});

test("timing: at least 2 hours ahead and at most 30 days", () => {
  assert.equal(timingRefusal(at(119), now), "too_soon");
  assert.equal(timingRefusal(at(120), now), null);
  assert.equal(timingRefusal(at(30 * 24 * 60), now), null);
  assert.equal(timingRefusal(at(30 * 24 * 60 + 1), now), "too_far");
  assert.equal(timingRefusal(at(-5), now), "too_soon");
  // A dev server may schedule minutes ahead, never in the past.
  assert.equal(timingRefusal(at(5), now, { allowSoon: true }), null);
  assert.equal(timingRefusal(at(0), now, { allowSoon: true }), "too_soon");
});

test("own classes need 15 minutes between them", () => {
  const own = [{ startsAt: at(240), durationMinutes: 60 }]; // 22:00 to 23:00
  // Ends 21:46, 14 minutes before: too close.
  assert.equal(overlapsOwnClass({ startsAt: at(180 + 1), durationMinutes: 45 }, own), true);
  // Ends 21:45, exactly 15 minutes before: fine.
  assert.equal(overlapsOwnClass({ startsAt: at(180), durationMinutes: 45 }, own), false);
  // Starts 23:14, 14 minutes after it ends: too close.
  assert.equal(overlapsOwnClass({ startsAt: at(314), durationMinutes: 30 }, own), true);
  assert.equal(overlapsOwnClass({ startsAt: at(315), durationMinutes: 30 }, own), false);
  // Inside it.
  assert.equal(overlapsOwnClass({ startsAt: at(250), durationMinutes: 15 }, own), true);
  assert.equal(overlapsOwnClass({ startsAt: at(250), durationMinutes: 15 }, []), false);
});

test("maxConcurrent counts the most classes at one moment, not every overlap", () => {
  const w = { start: 0, end: 100 };
  // A and C overlap each other; B overlaps neither of them.
  const a = { start: 0, end: 30 };
  const c = { start: 10, end: 20 };
  const b = { start: 45, end: 130 };
  assert.equal(maxConcurrent(w, [a, b, c]), 2);
  // Back to back is not at once.
  assert.equal(maxConcurrent(w, [{ start: 0, end: 50 }, { start: 50, end: 100 }]), 1);
  // Outside the window doesn't count.
  assert.equal(maxConcurrent(w, [{ start: 100, end: 200 }, { start: -50, end: 0 }]), 0);
  assert.equal(maxConcurrent(w, []), 0);
});

test("the site cap: three at once by default", () => {
  const w = classWindow(at(180), 60);
  const same = [classWindow(at(180), 60), classWindow(at(200), 30)];
  assert.equal(siteFull(w, same, 3), false);
  assert.equal(siteFull(w, [...same, classWindow(at(170), 60)], 3), true);
  // A class that ended (hard end) before this one starts doesn't count.
  assert.equal(siteFull(w, [...same, classWindow(at(100), 60)], 3), false);
});

test("a 5th upcoming class is refused", () => {
  assert.equal(tooManyUpcoming(3), false);
  assert.equal(tooManyUpcoming(4), true);
});

test("transcription keywords skip small words, numbers and repeats", () => {
  const k = transcriptionKeywords("Wiring the CAN bus for a roboRIO", "CAN bus wiring 101");
  assert.deepEqual(k, ["Wiring", "CAN", "bus", "roboRIO"]);
  assert.equal(transcriptionKeywords("a ".repeat(40) + "word ".repeat(3)).length, 1);
});

test("sentences carry no em dashes", () => {
  for (const s of Object.values(SCHEDULE_SENTENCES)) assert.ok(!s.includes("\u2014"), s);
});
