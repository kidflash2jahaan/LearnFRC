import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GENERATED_USERNAME_WORDS,
  RESERVED_USERNAMES,
  RESERVED_USERNAME_PREFIXES,
  USERNAME_MAX,
  USERNAME_SENTENCES,
  USERNAME_STEP_PATH,
  chosenUsernameShapeError,
  isReservedUsername,
  needsUsernameStep,
  normalizeUsername,
  usernameShapeError,
  usernameStepHref,
} from "./usernames.ts";
import { firstProfaneField } from "./profanity.ts";
import { hookSourceFor } from "./signup-source.ts";
import { safeNextPath } from "./safe-next.ts";

const MIGRATION = readFileSync(
  new URL("../../supabase/migrations/20261111120000_usernames_always_set.sql", import.meta.url),
  "utf8"
);

/** Every single-quoted string inside the first match of `re`'s group 1. */
function quoted(re: RegExp): string[] {
  const m = re.exec(MIGRATION);
  assert.ok(m, `pattern not found in the migration: ${re}`);
  return [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
}

test("normalizing keeps a-z, 0-9 and _ and lowercases", () => {
  assert.equal(normalizeUsername("Maya_254"), "maya_254");
  assert.equal(normalizeUsername("  r.o-b@t! "), "robt");
  assert.equal(normalizeUsername(""), "");
});

test("shape: blank, too short, too long, fine", () => {
  assert.equal(usernameShapeError(""), USERNAME_SENTENCES.blank);
  assert.equal(usernameShapeError("ab"), USERNAME_SENTENCES.tooShort);
  assert.equal(usernameShapeError("abc"), null);
  assert.equal(usernameShapeError("a".repeat(20)), null);
  assert.equal(usernameShapeError("a".repeat(21)), USERNAME_SENTENCES.tooLong);
});

test("reserved exact names and prefixes are refused", () => {
  for (const u of ["admin", "moderator", "support", "teacher", "parent", "null", "deleted"]) {
    assert.equal(isReservedUsername(u), true, u);
    assert.equal(usernameShapeError(u), USERNAME_SENTENCES.reserved, u);
  }
  for (const u of ["learner", "learner_1", "learners", "learnfrc", "learnfrc_team", "learnfrcbot"]) {
    assert.equal(isReservedUsername(u), true, u);
    assert.equal(usernameShapeError(u), USERNAME_SENTENCES.reserved, u);
  }
  for (const u of ["admins_fan", "the_learner", "maya_254", "modular", "rootbeer"]) {
    assert.equal(isReservedUsername(u), false, u);
    assert.equal(usernameShapeError(u), null, u);
  }
});

test("the sign-up hook tokens can't be anyone's username", () => {
  for (const token of ["lessonhook", "articlehook"]) {
    assert.ok(hookSourceFor(token), token);
    assert.equal(isReservedUsername(token), true, token);
  }
});

test("a submitted name: blank always refused, keeping your own always fine, a change checked in full", () => {
  assert.equal(chosenUsernameShapeError("", "gearbox_4821"), USERNAME_SENTENCES.blank);
  assert.equal(chosenUsernameShapeError("", null), USERNAME_SENTENCES.blank);
  // Older names over 20 characters, or on today's reserved list, keep working.
  const long = "a".repeat(21);
  assert.equal(chosenUsernameShapeError(long, long), null);
  assert.equal(chosenUsernameShapeError("member", "member"), null);
  // Changing to them doesn't.
  assert.equal(chosenUsernameShapeError(long, "maya_254"), USERNAME_SENTENCES.tooLong);
  assert.equal(chosenUsernameShapeError("member", "maya_254"), USERNAME_SENTENCES.reserved);
  assert.equal(chosenUsernameShapeError("ab", null), USERNAME_SENTENCES.tooShort);
  assert.equal(chosenUsernameShapeError("maya_255", "maya_254"), null);
});

test("needsUsernameStep: no profile, no username, a generated one, a chosen one", () => {
  assert.equal(needsUsernameStep(null), false);
  assert.equal(needsUsernameStep(undefined), false);
  assert.equal(needsUsernameStep({ username: null }), true);
  assert.equal(needsUsernameStep({ username: "" }), true);
  assert.equal(needsUsernameStep({ username: "gearbox_4821", username_generated: true }), true);
  assert.equal(needsUsernameStep({ username: "maya_254", username_generated: false }), false);
  // A row read before the column existed has no flag at all: a chosen name.
  assert.equal(needsUsernameStep({ username: "maya_254" }), false);
});

test("usernameStepHref encodes next, and the step page gets it back as a same-site path", () => {
  assert.equal(usernameStepHref("/dashboard"), `${USERNAME_STEP_PATH}?next=%2Fdashboard`);
  const next = "/guides/programming/intro?x=1&y=2#top";
  const href = usernameStepHref(next);
  assert.equal(href, `/account/username?next=${encodeURIComponent(next)}`);
  const back = new URL(href, "https://learnfrc.com").searchParams.get("next");
  assert.equal(back, next);
  assert.equal(safeNextPath(back), next);
});

test("the migration's reserved list matches this file's", () => {
  const exact = quoted(/u = any \(array\[([\s\S]*?)\]\)/);
  assert.deepEqual([...exact].sort(), [...RESERVED_USERNAMES].sort());
  const prefixes = [...MIGRATION.matchAll(/u like '([a-z0-9_]+)%'/g)].map((m) => m[1]);
  assert.deepEqual([...prefixes].sort(), [...RESERVED_USERNAME_PREFIXES].sort());
});

test("the migration's generator words match this file's", () => {
  const words = quoted(/words constant text\[\] := array\[([\s\S]*?)\];/);
  assert.deepEqual(words, [...GENERATED_USERNAME_WORDS]);
  assert.equal(new Set(words).size, words.length, "no word twice");
  // The generator's numbers: 1000 to 9999.
  assert.match(MIGRATION, /\(1000 \+ floor\(random\(\) \* 9000\)\)::int/);
});

test("every generated handle is a valid, unreserved, clean username (all 234,000)", () => {
  const format = /^[a-z0-9_]{3,32}$/;
  let checked = 0;
  for (const word of GENERATED_USERNAME_WORDS) {
    for (let n = 1000; n <= 9999; n++) {
      const handle = `${word}_${n}`;
      assert.ok(handle.length >= 3 && handle.length <= USERNAME_MAX, handle);
      assert.match(handle, format);
      assert.equal(normalizeUsername(handle), handle);
      assert.equal(usernameShapeError(handle), null, handle);
      assert.equal(firstProfaneField({ username: handle }), null, handle);
      checked++;
    }
  }
  assert.equal(checked, GENERATED_USERNAME_WORDS.length * 9000);
});
