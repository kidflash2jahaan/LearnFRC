import { test } from "node:test";
import assert from "node:assert/strict";
import { ageBand, ageBandOn, ageOn, birthMonthYearForAge, isAdultOn, isValidBirthMonthYear } from "./age.ts";

const d = (s: string) => new Date(`${s}T12:00:00Z`);

test("the birthday counts from the first day of the month after the birth month", () => {
  // Born March 2008: 17 through March 2026, 18 from April 1, 2026.
  assert.equal(ageOn(d("2026-03-01"), 2008, 3), 17);
  assert.equal(ageOn(d("2026-03-31"), 2008, 3), 17);
  assert.equal(ageOn(d("2026-04-01"), 2008, 3), 18);
});

test("December births roll into January", () => {
  assert.equal(ageOn(d("2026-12-31"), 2008, 12), 17);
  assert.equal(ageOn(d("2027-01-01"), 2008, 12), 18);
});

test("January births tick over on February 1", () => {
  assert.equal(ageOn(d("2026-01-31"), 2013, 1), 12);
  assert.equal(ageOn(d("2026-02-01"), 2013, 1), 13);
});

test("for classes, the 18th birth month itself already counts as 18+", () => {
  // Born March 2008: maybe 18 on March 1, 2026, so out of classes from then.
  assert.equal(ageBandOn(d("2026-02-28"), 2008, 3), "16-17");
  assert.equal(ageBandOn(d("2026-03-01"), 2008, 3), "18+");
  assert.equal(ageBandOn(d("2026-11-15"), 2008, 11), "18+");
  assert.equal(ageBandOn(d("2026-10-31"), 2008, 11), "16-17");
  assert.equal(isAdultOn(d("2026-03-01"), 2008, 3), true);
  assert.equal(isAdultOn(d("2026-02-28"), 2008, 3), false);
  // ageOn stays conservative the other way (the safety lead's adult check).
  assert.equal(ageOn(d("2026-03-15"), 2008, 3), 17);
});

test("the 13 cutoff stays on the month after the birth month", () => {
  assert.equal(ageBandOn(d("2026-01-15"), 2013, 1), "under13");
  assert.equal(ageBandOn(d("2026-02-01"), 2013, 1), "13-15");
});

test("December 18th birthdays", () => {
  assert.equal(ageBandOn(d("2026-11-30"), 2008, 12), "16-17");
  assert.equal(ageBandOn(d("2026-12-01"), 2008, 12), "18+");
});

test("bands", () => {
  assert.equal(ageBand(12), "under13");
  assert.equal(ageBand(13), "13-15");
  assert.equal(ageBand(15), "13-15");
  assert.equal(ageBand(16), "16-17");
  assert.equal(ageBand(17), "16-17");
  assert.equal(ageBand(18), "18+");
  assert.equal(ageBand(40), "18+");
});

test("birthMonthYearForAge round-trips in every month", () => {
  for (let m = 0; m < 12; m++) {
    const now = new Date(Date.UTC(2026, m, 15));
    for (const age of [12, 13, 14, 16, 17, 18]) {
      const { birthYear, birthMonth } = birthMonthYearForAge(age, now);
      assert.equal(ageOn(now, birthYear, birthMonth), age, `month ${m + 1}, age ${age}`);
    }
  }
});

test("valid answers", () => {
  const now = d("2026-11-08");
  assert.equal(isValidBirthMonthYear(2011, 3, now), true);
  assert.equal(isValidBirthMonthYear(2026, 12, now), false);
  assert.equal(isValidBirthMonthYear(1900, 1, now), false);
  assert.equal(isValidBirthMonthYear(2011, 13, now), false);
});
