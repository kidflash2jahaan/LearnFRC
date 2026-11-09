import { test } from "node:test";
import assert from "node:assert/strict";
import { PLAYBOOK_SECTIONS, playbookPieces, playbookText } from "./playbook.ts";
import { findContactPatterns } from "./contact-patterns.ts";

test("the playbook names no phone numbers besides 911 and 988", () => {
  const text = playbookText();
  const numbers = [...text.matchAll(/\d[\d\s().-]*\d|\d/g)].map((m) => m[0].replace(/\D/g, ""));
  assert.deepEqual([...new Set(numbers)].sort(), ["911", "988"]);
  assert.ok(text.includes("call 911") || text.includes("Call 911"));
  assert.ok(text.includes("call or text 988"));
  const phones = findContactPatterns(text).filter((m) => m.kind === "phone");
  assert.deepEqual(phones, [], "the contact filter finds no phone number either");
});

test("the playbook has no em or en dashes", () => {
  assert.ok(!/[–—]/.test(playbookText()));
});

test("the sexual content steps keep their order and say don't copy first", () => {
  const s = PLAYBOOK_SECTIONS.find((x) => x.id === "sexual");
  assert.ok(s?.steps && s.steps.length === 6);
  assert.match(s!.steps![0], /^Don't download, screenshot, copy, forward or show anyone the material/);
  assert.match(s!.steps![2], /report\.cybertip\.org/);
  assert.match(s!.steps![5], /call 911 first/);
  assert.equal(PLAYBOOK_SECTIONS[0].id, "danger-now");
});

test("paths and the CyberTipline become links, nothing else does", () => {
  const p = playbookPieces("Report to report.cybertip.org, then pause from /admin/classes and ban on /admin/reports.");
  assert.deepEqual(
    p.filter((x) => x.href).map((x) => x.href),
    ["https://report.cybertip.org/", "/admin/classes", "/admin/reports"]
  );
  assert.equal(p.map((x) => x.text).join(""), "Report to report.cybertip.org, then pause from /admin/classes and ban on /admin/reports.");
  assert.equal(playbookPieces("/admin/classes/holds").length, 1);
  assert.equal(playbookPieces("no links here")[0].href, undefined);
});
