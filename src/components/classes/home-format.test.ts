import { test } from "node:test";
import assert from "node:assert/strict";
import { formatClassWhenLocal, formatClassWhenUtc, lengthLabel, seatsLabel, topicLine } from "./home-format.ts";

test("UTC time is built by hand, so server and browser print the same string", () => {
  assert.equal(formatClassWhenUtc("2026-11-20T01:00:00.000Z"), "Fri, Nov 20, 1:00 AM UTC");
  assert.equal(formatClassWhenUtc("2026-11-20T00:05:00.000Z"), "Fri, Nov 20, 12:05 AM UTC");
  assert.equal(formatClassWhenUtc("2026-11-20T12:30:00.000Z"), "Fri, Nov 20, 12:30 PM UTC");
  assert.equal(formatClassWhenUtc("2026-12-31T23:59:00.000Z"), "Thu, Dec 31, 11:59 PM UTC");
  assert.equal(formatClassWhenUtc("not a date"), "");
});

test("local time follows the reader's time zone", () => {
  // 01:00 UTC on Nov 20 is still the evening of Nov 19 in California.
  assert.equal(
    formatClassWhenLocal("2026-11-20T01:00:00.000Z", "America/Los_Angeles"),
    "Thu, Nov 19, 5:00 PM PST"
  );
  assert.equal(
    formatClassWhenLocal("2026-11-20T01:00:00.000Z", "America/New_York"),
    "Thu, Nov 19, 8:00 PM EST"
  );
  assert.equal(formatClassWhenLocal("2026-11-20T01:00:00.000Z", "UTC"), "Fri, Nov 20, 1:00 AM UTC");
  // A bad zone falls back to the UTC form instead of throwing.
  assert.equal(formatClassWhenLocal("2026-11-20T01:00:00.000Z", "Not/AZone"), "Fri, Nov 20, 1:00 AM UTC");
  assert.equal(formatClassWhenLocal("nope"), "");
});

test("length and seats", () => {
  assert.equal(lengthLabel(45), "45 min");
  assert.equal(lengthLabel(90), "90 min");
  assert.equal(seatsLabel({ left: 9 }), "9 seats left");
  assert.equal(seatsLabel({ left: 1 }), "1 seat left");
  assert.equal(seatsLabel({ left: 0 }), "full");
  assert.equal(seatsLabel({ left: -2 }), "full");
});

test("topic line", () => {
  assert.equal(topicLine({ kind: "lesson", title: "Wiring a CAN bus" }), "lesson / Wiring a CAN bus");
  assert.equal(topicLine({ kind: "module", title: " Swerve " }), "module / Swerve");
  assert.equal(topicLine(null), null);
  assert.equal(topicLine({ kind: "lesson", title: "  " }), null);
});
