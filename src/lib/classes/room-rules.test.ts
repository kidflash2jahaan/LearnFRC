import { test } from "node:test";
import assert from "node:assert/strict";
import {
  capState,
  isLiveNow,
  joinTiming,
  monthKey,
  monthStartUtc,
  participantMinutes,
  withinReportWindow,
} from "./room-rules.ts";

const START = Date.parse("2026-11-20T01:00:00.000Z");
const HARD_END = new Date(START + 75 * 60_000); // 60 minutes + 15
const at = (min: number) => new Date(START + min * 60_000);

test("students may join from 15 minutes before the start", () => {
  assert.equal(joinTiming(at(-16), at(0), HARD_END, "student"), "early");
  assert.equal(joinTiming(at(-15), at(0), HARD_END, "student"), "open");
  assert.equal(joinTiming(at(30), at(0), HARD_END, "student"), "open");
});

test("the teacher and staff may join from 30 minutes before", () => {
  assert.equal(joinTiming(at(-31), at(0), HARD_END, "teacher"), "early");
  assert.equal(joinTiming(at(-30), at(0), HARD_END, "teacher"), "open");
  assert.equal(joinTiming(at(-20), at(0), HARD_END, "staff"), "open");
});

test("nobody joins at or past the hard end", () => {
  for (const role of ["teacher", "student", "staff"] as const) {
    assert.equal(joinTiming(at(75), at(0), HARD_END, role), "over");
    assert.equal(joinTiming(at(80), at(0), HARD_END, role), "over");
  }
});

test("live now: a live class, or a scheduled one inside the teacher's window", () => {
  const cls = (status: string) => ({ status, starts_at: at(0), hard_end_at: HARD_END });
  assert.equal(isLiveNow(cls("live"), at(10)), true);
  assert.equal(isLiveNow(cls("scheduled"), at(-10)), true);
  assert.equal(isLiveNow(cls("scheduled"), at(-31)), false);
  assert.equal(isLiveNow(cls("live"), at(75)), false);
  assert.equal(isLiveNow(cls("ended"), at(10)), false);
  assert.equal(isLiveNow(cls("canceled"), at(10)), false);
});

test("the report window is 30 days after the hard end", () => {
  assert.equal(withinReportWindow(HARD_END, new Date(HARD_END.getTime() + 29 * 86_400_000)), true);
  assert.equal(withinReportWindow(HARD_END, new Date(HARD_END.getTime() + 31 * 86_400_000)), false);
});

test("participant minutes: closed rows, open rows up to now, clipped to the month", () => {
  const now = new Date("2026-11-20T02:00:00.000Z");
  const rows = [
    { joinedAt: "2026-11-20T01:00:00.000Z", leftAt: "2026-11-20T01:30:00.000Z" }, // 30
    { joinedAt: "2026-11-20T01:30:00.000Z", leftAt: null }, // 30, still in
    { joinedAt: "2026-10-31T23:50:00.000Z", leftAt: "2026-11-01T00:10:00.000Z" }, // 10 in November
  ];
  assert.equal(participantMinutes(rows, now), 70);
});

test("an open row never counts past its class's hard end", () => {
  const now = new Date("2026-11-21T01:00:00.000Z");
  const rows = [{ joinedAt: "2026-11-20T01:00:00.000Z", leftAt: null, closesAt: "2026-11-20T02:15:00.000Z" }];
  assert.equal(participantMinutes(rows, now), 75);
});

test("cap states: warn at 75%, over at the cap", () => {
  assert.equal(capState(0, 40000), "ok");
  assert.equal(capState(29999, 40000), "ok");
  assert.equal(capState(30000, 40000), "warn");
  assert.equal(capState(40000, 40000), "over");
  assert.equal(capState(5, 0), "over");
});

test("month helpers are UTC", () => {
  const now = new Date("2026-12-01T03:00:00.000Z");
  assert.equal(monthStartUtc(now).toISOString(), "2026-12-01T00:00:00.000Z");
  assert.equal(monthKey(now), "2026-12");
});
