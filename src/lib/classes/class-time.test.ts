import { test } from "node:test";
import assert from "node:assert/strict";
import { classTimeParts, dayKey, formatClassTime, pacificTime, zoneLabel } from "./class-time.ts";

// 01:00 UTC on Nov 20 is 5:00 PM on Nov 19 in California (PST, UTC-8).
const WINTER = "2026-11-20T01:00:00.000Z";
// 00:00 UTC on Jul 20 is 5:00 PM on Jul 19 in California (PDT, UTC-7).
const SUMMER = "2026-07-20T00:00:00.000Z";

test("Pacific is labeled PT, winter and summer, never PST or PDT", () => {
  assert.equal(pacificTime(WINTER), "Thu, Nov 19, 5:00 PM PT");
  assert.equal(pacificTime(SUMMER), "Sun, Jul 19, 5:00 PM PT");
  assert.equal(pacificTime(new Date(WINTER)), "Thu, Nov 19, 5:00 PM PT");
});

test("the reader's own zone uses the same plain US names", () => {
  // A reader in California gets the same text the server printed.
  assert.equal(formatClassTime(WINTER, "datetime", { timeZone: "America/Los_Angeles" }), pacificTime(WINTER));
  assert.equal(formatClassTime(WINTER, "datetime", { timeZone: "America/Vancouver" }), "Thu, Nov 19, 5:00 PM PT");
  assert.equal(formatClassTime(WINTER, "datetime", { timeZone: "America/New_York" }), "Thu, Nov 19, 8:00 PM ET");
  assert.equal(formatClassTime(SUMMER, "time", { timeZone: "America/Chicago" }), "7:00 PM CT");
  assert.equal(formatClassTime(SUMMER, "time", { timeZone: "America/Phoenix" }), "5:00 PM MT");
  assert.equal(formatClassTime(WINTER, "datetime", { timeZone: "UTC" }), "Fri, Nov 20, 1:00 AM UTC");
  assert.equal(formatClassTime(SUMMER, "time", { timeZone: "Europe/London" }), "1:00 AM GMT+1");
});

test("styles", () => {
  const end = "2026-11-20T02:00:00.000Z";
  assert.equal(formatClassTime(WINTER, "date"), "Thursday, November 19");
  assert.equal(formatClassTime(WINTER, "day"), "Thu, Nov 19");
  assert.equal(formatClassTime(WINTER, "time"), "5:00 PM PT");
  assert.equal(formatClassTime(WINTER, "range", { end }), "5:00 to 6:00 PM PT");
  // Across noon both halves keep their AM and PM.
  assert.equal(
    formatClassTime("2026-11-20T19:30:00.000Z", "range", { end: "2026-11-20T20:30:00.000Z" }),
    "11:30 AM to 12:30 PM PT"
  );
  assert.equal(formatClassTime("2026-11-20T08:05:00.000Z", "time"), "12:05 AM PT");
});

test("a bad date or zone gives empty text instead of throwing", () => {
  assert.equal(pacificTime("nope"), "");
  assert.equal(formatClassTime(WINTER, "datetime", { timeZone: "Not/AZone" }), "");
  assert.equal(classTimeParts("nope"), null);
});

test("days are the zone's days", () => {
  const pacific = classTimeParts(WINTER);
  const utc = classTimeParts(WINTER, "UTC");
  assert.ok(pacific && utc);
  assert.equal(dayKey(pacific), "2026-11-19");
  assert.equal(dayKey(utc), "2026-11-20");
});

test("zone labels", () => {
  assert.equal(zoneLabel("PST"), "PT");
  assert.equal(zoneLabel("EDT"), "ET");
  assert.equal(zoneLabel("HST"), "HST");
  assert.equal(zoneLabel("GMT+5:30"), "GMT+5:30");
});
