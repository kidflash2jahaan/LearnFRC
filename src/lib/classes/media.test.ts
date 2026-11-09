import { test } from "node:test";
import assert from "node:assert/strict";
import { MEDIA_LOG_LIMITS, mediaIntervals, mediaMinutes, parseMediaBatch, sumMinutes, type MediaEventInput } from "./media.ts";

const START = Date.parse("2026-11-20T01:00:00.000Z");
const END = "2026-11-20T02:15:00.000Z";
const at = (min: number) => new Date(START + min * 60_000).toISOString();

const T = "11111111-1111-4111-8111-111111111111"; // teacher
const S = "22222222-2222-4222-8222-222222222222"; // student
const R1 = "33333333-3333-4333-8333-333333333333";
const R2 = "44444444-4444-4444-8444-444444444444";

const ev = (
  subject: string,
  kind: "camera" | "screenshare",
  isOn: boolean,
  min: number,
  reporter: string
): MediaEventInput => ({ subjectUserId: subject, kind, isOn, at: at(min), reportedBy: reporter });

test("one reporter: on then off counts the span", () => {
  const m = mediaMinutes([ev(T, "camera", true, 0, R1), ev(T, "camera", false, 10, R1)], { until: END });
  assert.deepEqual(m.cameraMinutes, { [T]: 10 });
  assert.deepEqual(m.screenshareMinutes, {});
});

test("two reporters seeing the same camera count it once", () => {
  const m = mediaMinutes(
    [
      ev(T, "camera", true, 0, R1),
      ev(T, "camera", true, 0.2, R2),
      ev(T, "camera", false, 10, R1),
      ev(T, "camera", false, 10.1, R2),
    ],
    { until: END }
  );
  assert.equal(m.cameraMinutes[T], 11); // 0 to 10.1 minutes, rounded up
});

test("a reporter who hides the camera can't erase what another saw", () => {
  const m = mediaMinutes(
    [
      // R1 (tampered) says the camera was only on for a minute.
      ev(T, "camera", true, 0, R1),
      ev(T, "camera", false, 1, R1),
      // R2 saw it on for 20.
      ev(T, "camera", true, 0, R2),
      ev(T, "camera", false, 20, R2),
    ],
    { until: END }
  );
  assert.equal(m.cameraMinutes[T], 20);
});

test("an open span closes at the class end, clipped to the window", () => {
  const m = mediaMinutes([ev(S, "screenshare", true, 70, R1)], { until: END });
  assert.equal(m.screenshareMinutes[S], 5);
  const clipped = mediaMinutes([ev(T, "camera", true, -40, R1), ev(T, "camera", false, 5, R1)], {
    from: at(-30),
    until: END,
  });
  assert.equal(clipped.cameraMinutes[T], 35);
});

test("a repeated on keeps the first start; an off with nothing open is ignored", () => {
  const spans = mediaIntervals(
    [
      ev(T, "camera", false, 1, R1),
      ev(T, "camera", true, 2, R1),
      ev(T, "camera", true, 5, R1),
      ev(T, "camera", false, 8, R1),
    ],
    { until: END }
  );
  assert.equal(spans[T].camera.length, 1);
  assert.equal(spans[T].camera[0].start, Date.parse(at(2)));
  assert.equal(spans[T].camera[0].end, Date.parse(at(8)));
});

test("20 seconds of a student camera still shows as a minute", () => {
  const m = mediaMinutes([ev(S, "camera", true, 3, R1), ev(S, "camera", false, 3 + 1 / 3, R1)], { until: END });
  assert.equal(m.cameraMinutes[S], 1);
  assert.equal(sumMinutes(m.cameraMinutes), 1);
});

test("stored rows (snake_case) work the same, and null subjects are skipped", () => {
  const m = mediaMinutes(
    [
      { subject_user_id: T, kind: "camera", is_on: true, at: at(0), reported_by: R1 },
      { subject_user_id: T, kind: "camera", is_on: false, at: at(4), reported_by: R1 },
      { subject_user_id: null, kind: "camera", is_on: true, at: at(0), reported_by: R1 },
    ],
    { until: END }
  );
  assert.deepEqual(m.cameraMinutes, { [T]: 4 });
});

test("kinds are kept apart", () => {
  const m = mediaMinutes(
    [ev(T, "camera", true, 0, R1), ev(T, "screenshare", true, 5, R1), ev(T, "camera", false, 10, R1), ev(T, "screenshare", false, 7, R1)],
    { until: END }
  );
  assert.equal(m.cameraMinutes[T], 10);
  assert.equal(m.screenshareMinutes[T], 2);
});

/* ── parseMediaBatch ───────────────────────────────────────────────── */

const now = new Date(START + 30 * 60_000);
const window = { now, from: new Date(START - 30 * 60_000), until: new Date(Date.parse(END)) };

test("a good batch passes through, cleaned", () => {
  const r = parseMediaBatch(
    { events: [{ subject: T.toUpperCase(), kind: "camera", on: true, at: at(29) }] },
    window
  );
  assert.ok(r);
  assert.equal(r.dropped, 0);
  assert.deepEqual(r.events, [{ subject: T, kind: "camera", on: true, at: at(29) }]);
});

test("malformed events, other kinds and bad subjects are dropped", () => {
  const r = parseMediaBatch(
    {
      events: [
        { subject: "not-a-uuid", kind: "camera", on: true, at: at(1) },
        { subject: T, kind: "microphone", on: true, at: at(1) },
        { subject: T, kind: "camera", on: "yes", at: at(1) },
        { subject: T, kind: "camera", on: true, at: "yesterday" },
        null,
        "camera",
        { subject: T, kind: "screenshare", on: false, at: at(2) },
      ],
    },
    window
  );
  assert.ok(r);
  assert.equal(r.events.length, 1);
  assert.equal(r.dropped, 6);
});

test("events outside the class window or in the future are dropped", () => {
  const r = parseMediaBatch(
    {
      events: [
        { subject: T, kind: "camera", on: true, at: at(-45) }, // before the earliest join
        { subject: T, kind: "camera", on: true, at: at(32) }, // 2 minutes ahead of the server
        { subject: T, kind: "camera", on: true, at: at(30.5) }, // 30 s ahead: fine
      ],
    },
    window
  );
  assert.ok(r);
  assert.equal(r.events.length, 1);
  assert.equal(r.dropped, 2);
});

test("duplicates are dropped and the batch is capped", () => {
  const one = { subject: T, kind: "camera", on: true, at: at(1) };
  const dup = parseMediaBatch({ events: [one, { ...one }] }, window);
  assert.equal(dup?.events.length, 1);
  assert.equal(dup?.dropped, 1);

  const many = Array.from({ length: MEDIA_LOG_LIMITS.maxEvents + 5 }, (_, i) => ({
    subject: T,
    kind: "camera",
    on: i % 2 === 0,
    at: new Date(START + i * 1000).toISOString(),
  }));
  const capped = parseMediaBatch({ events: many }, window);
  assert.equal(capped?.events.length, MEDIA_LOG_LIMITS.maxEvents);
  assert.equal(capped?.dropped, 5);
});

test("a body that isn't { events: [...] } is refused", () => {
  assert.equal(parseMediaBatch(null, window), null);
  assert.equal(parseMediaBatch([], window), null);
  assert.equal(parseMediaBatch({ events: "x" }, window), null);
  assert.equal(parseMediaBatch({}, window), null);
});
