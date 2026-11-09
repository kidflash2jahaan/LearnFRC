/**
 * Age from a birth month and year, computed conservatively (section 5).
 *
 * We only ask for the month and year, so the exact birthday is unknown, and
 * each cutoff is rounded the way that keeps classes safe:
 *
 *   - ageOn treats everyone as having their birthday on the FIRST DAY OF THE
 *     MONTH AFTER their birth month, so a 12-year-old is never counted as 13
 *     (and the safety lead, who has to be an adult, is never counted as 18
 *     early).
 *   - isAdultOn treats the 18th birthday as the FIRST DAY OF THE BIRTH MONTH,
 *     so nobody who may already be 18 counts as 17: someone born in March
 *     2008 is 18+ for classes from March 1, 2026. Classes are for 13 to 17
 *     with no adult in the room, so here the early side is the safe one.
 *
 * ageBandOn uses both: under13 by ageOn, 18+ by isAdultOn. Dates are read in
 * UTC.
 *
 * Pure, no imports, unit tested (age.test.ts).
 */

import type { AgeBand } from "./types.ts";

/** Whole years old on `date`, by the conservative rule above. */
export function ageOn(date: Date, birthYear: number, birthMonth: number): number {
  let effectiveYear = birthYear;
  let effectiveMonth = birthMonth + 1;
  if (effectiveMonth === 13) {
    effectiveMonth = 1;
    effectiveYear += 1;
  }
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  let age = year - effectiveYear;
  if (month < effectiveMonth) age -= 1;
  return age;
}

/** The band an age falls in. Classes are for 13-15 and 16-17 only. */
export function ageBand(age: number): AgeBand {
  if (age < 13) return "under13";
  if (age <= 15) return "13-15";
  if (age <= 17) return "16-17";
  return "18+";
}

/**
 * True from the first day of someone's 18th birth month: the side that keeps
 * anyone who may already be 18 out of classes for 13 to 17 year olds.
 */
export function isAdultOn(date: Date, birthYear: number, birthMonth: number): boolean {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const age = year - birthYear - (month < birthMonth ? 1 : 0);
  return age >= 18;
}

/**
 * The band for classes: 18+ from the first day of the 18th birth month
 * (isAdultOn), under 13 until the month after the 13th (ageOn), otherwise by
 * ageOn. Eligibility, the age screen, teacher applications and the review's
 * code flags all use this.
 */
export function ageBandOn(date: Date, birthYear: number, birthMonth: number): AgeBand {
  if (isAdultOn(date, birthYear, birthMonth)) return "18+";
  return ageBand(ageOn(date, birthYear, birthMonth));
}

/** True when the month and year are a real answer we can store. */
export function isValidBirthMonthYear(
  birthYear: number,
  birthMonth: number,
  now: Date = new Date()
): boolean {
  const thisYear = now.getUTCFullYear();
  return (
    Number.isInteger(birthYear) &&
    Number.isInteger(birthMonth) &&
    birthMonth >= 1 &&
    birthMonth <= 12 &&
    birthYear >= thisYear - 100 &&
    birthYear <= thisYear &&
    // Not a month that hasn't happened yet.
    (birthYear < thisYear || birthMonth <= now.getUTCMonth() + 1)
  );
}

/**
 * A birth month and year that make someone exactly `age` on `date` by this
 * rule, for test accounts and fixtures.
 */
export function birthMonthYearForAge(age: number, date: Date = new Date()): {
  birthYear: number;
  birthMonth: number;
} {
  // Born two months before this month, `age` years ago: the effective birthday
  // (the first of the month after) has already passed this year.
  let month = date.getUTCMonth() + 1 - 2;
  let year = date.getUTCFullYear() - age;
  if (month < 1) {
    month += 12;
    year -= 1;
  }
  return { birthYear: year, birthMonth: month };
}
