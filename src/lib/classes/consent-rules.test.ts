import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  MONTH_NAMES,
  birthYearOptions,
  cleanParentName,
  isEmailAddress,
  isParentTokenShape,
  mailboxKey,
  monthYearLabel,
  normalizeEmail,
  parentDecision,
  resendWaitMs,
  roughWait,
  safeClassesNext,
  sameMailbox,
  wholeNumber,
} from "./consent-rules.ts";

test("the year select runs from this year back 100, newest first", () => {
  const years = birthYearOptions(new Date("2026-11-08T12:00:00Z"));
  assert.equal(years.length, 101);
  assert.equal(years[0], 2026);
  assert.equal(years[100], 1926);
  assert.equal(MONTH_NAMES.length, 12);
});

test("the confirm step names the month and year", () => {
  assert.equal(monthYearLabel(3, 2011), "March 2011");
  assert.equal(monthYearLabel(12, 2009), "December 2009");
});

test("only plain digit strings count as numbers", () => {
  assert.equal(wholeNumber("2011"), 2011);
  assert.equal(wholeNumber("3"), 3);
  assert.equal(wholeNumber(""), null);
  assert.equal(wholeNumber("3.5"), null);
  assert.equal(wholeNumber("1e3"), null);
  assert.equal(wholeNumber(" 7"), null);
  assert.equal(wholeNumber("-4"), null);
  assert.equal(wholeNumber(null), null);
  assert.equal(wholeNumber(7), 7);
  assert.equal(wholeNumber(7.5), null);
});

test("email addresses: real ones pass, typos and junk don't", () => {
  for (const ok of ["mom@gmail.com", " Dad.Smith+classes@Example.org ", "a.b@school.k12.ca.us", "x_y@sub.domain.io"]) {
    assert.ok(isEmailAddress(ok), ok);
  }
  for (const bad of [
    "",
    "mom",
    "mom@",
    "@gmail.com",
    "mom@gmail",
    "mom@gmail.c",
    "mom gmail@x.com",
    "mom@@gmail.com",
    "mom@gmail..com",
    ".mom@gmail.com",
    "mom.@gmail.com",
    "mo..m@gmail.com",
    "mom@-gmail.com",
    "mom@gmail.com,dad@gmail.com",
    `${"a".repeat(65)}@gmail.com`,
    "<script>@x.com",
  ]) {
    assert.ok(!isEmailAddress(bad), bad);
  }
  assert.equal(normalizeEmail("  Mom@Gmail.COM "), "mom@gmail.com");
});

test("the student's own mailbox is spotted through tags, dots and case", () => {
  assert.ok(sameMailbox("sam.lee@gmail.com", "SamLee+mom@gmail.com"));
  assert.ok(sameMailbox("samlee@googlemail.com", "sam.lee@gmail.com"));
  assert.ok(sameMailbox("kid+a@school.org", "KID@school.org"));
  // Dots matter outside Gmail.
  assert.ok(!sameMailbox("sam.lee@school.org", "samlee@school.org"));
  assert.ok(!sameMailbox("mom@gmail.com", "sam@gmail.com"));
  assert.ok(!sameMailbox(null, "sam@gmail.com"));
  assert.ok(!sameMailbox("sam@gmail.com", undefined));
  assert.equal(mailboxKey("S.a.m+x@GMAIL.com"), "sam@gmail.com");
});

test("the same address waits 24 hours before it can be emailed again", () => {
  const sent = new Date("2026-11-08T10:00:00Z");
  assert.equal(resendWaitMs(sent, new Date("2026-11-09T10:00:00Z"), 24), 0);
  assert.equal(resendWaitMs(sent, new Date("2026-11-10T10:00:00Z"), 24), 0);
  assert.equal(resendWaitMs(sent, new Date("2026-11-09T09:00:00Z"), 24), 60 * 60 * 1000);
  assert.equal(roughWait(23 * 60 * 60 * 1000 + 59 * 60 * 1000), "about 24 hours");
  assert.equal(roughWait(60 * 60 * 1000), "about an hour");
  assert.equal(roughWait(25 * 60 * 1000), "about 25 minutes");
  assert.equal(roughWait(3 * 60 * 1000), "a few minutes");
});

test("tokens are 43 base64url characters, nothing else", () => {
  assert.ok(isParentTokenShape(randomBytes(32).toString("base64url")));
  assert.ok(!isParentTokenShape(randomBytes(32).toString("base64")));
  assert.ok(!isParentTokenShape(randomBytes(31).toString("base64url")));
  assert.ok(!isParentTokenShape("../../etc/passwd"));
  assert.ok(!isParentTokenShape(undefined));
  assert.ok(!isParentTokenShape(`${"a".repeat(42)}/`));
});

test("a decision is agree or decline, nothing else", () => {
  assert.equal(parentDecision("agree"), "agree");
  assert.equal(parentDecision("decline"), "decline");
  assert.equal(parentDecision("yes"), null);
  assert.equal(parentDecision(null), null);
});

test("a parent's name is trimmed, and links, addresses and markup are refused", () => {
  assert.equal(cleanParentName("  Maria   Lopez "), "Maria Lopez");
  assert.equal(cleanParentName("Lê Văn Thành"), "Lê Văn Thành");
  assert.equal(cleanParentName("O'Neil-Smith"), "O'Neil-Smith");
  assert.equal(cleanParentName("J"), null);
  assert.equal(cleanParentName("12345"), null);
  assert.equal(cleanParentName("mom@gmail.com"), null);
  assert.equal(cleanParentName("see https://x.co"), null);
  assert.equal(cleanParentName("www.example.com"), null);
  assert.equal(cleanParentName("<b>Mom</b>"), null);
  assert.equal(cleanParentName("a".repeat(81)), null);
  assert.equal(cleanParentName(undefined), null);
});

test("next only goes back to a classes page on this site", () => {
  for (const ok of ["/classes", "/classes/4f8a0e9e-6a39-4bbb-8a51-1d6b8a6c2f10", "/classes/abc/room", "/apply/teach", "/classes/teaching", "/classes?day=1"]) {
    assert.equal(safeClassesNext(ok), ok, ok);
  }
  for (const bad of [
    "https://evil.example/classes",
    "//evil.example/classes",
    "/\\evil.example",
    "/dashboard",
    "/classes/ready",
    "/classes/parent",
    "/classes/parent/open/abc",
    "/classes/../admin",
    "/apply",
    "classes",
    "",
    null,
  ]) {
    assert.equal(safeClassesNext(bad), null, String(bad));
  }
});
