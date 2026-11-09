/**
 * Age from a birth month and year, computed conservatively (section 5).
 *
 * We only ask for the month and year, so the exact birthday is unknown. The
 * rule treats everyone as having their birthday on the FIRST DAY OF THE MONTH
 * AFTER their birth month: someone born in March 2008 turns 18 on April 1,
 * 2026, never earlier. That keeps a 17-year-old from being counted as 18 a
 * few weeks early, and a 12-year-old from being counted as 13. Dates are read
 * in UTC.
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

/** ageBand(ageOn(...)) in one call. */
export function ageBandOn(date: Date, birthYear: number, birthMonth: number): AgeBand {
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
