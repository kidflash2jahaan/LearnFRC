import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  GENERATED_USERNAME_DENIED_DIGITS,
  GENERATED_USERNAME_WORDS,
  RESERVED_STAFF_WORDS,
  RESERVED_USERNAMES,
  RESERVED_USERNAME_PREFIXES,
  USERNAME_MAX,
  USERNAME_SENTENCES,
  USERNAME_STEP_PATH,
  chosenUsernameError,
  chosenUsernameShapeError,
  generatedNumberDenied,
  handleReadyForClasses,
  isReservedUsername,
  needsUsernameStep,
  normalizeUsername,
  usernameShapeError,
  usernameStepHref,
} from "./usernames.ts";
import { firstProfaneField } from "./profanity.ts";
import { usernameHasContact } from "./classes/contact-patterns.ts";
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

test("a staff word at the start or end of a name is refused", () => {
  for (const u of [
    "admin1",
    "admin_team",
    "moderator_sam",
    "mod_squad",
    "lf_admin",
    "support_team",
    "official_mod",
    "staff_42",
    "safety_first",
    "team_security",
  ]) {
    assert.equal(isReservedUsername(u), true, u);
    assert.equal(usernameShapeError(u), USERNAME_SENTENCES.reserved, u);
  }
  for (const u of ["stafford", "supporter_9", "modular", "admins_fan", "officially_cool", "nomad"]) {
    assert.equal(isReservedUsername(u), false, u);
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

// Release-1.0: everyone in a live class sees each other's username, so a new
// one can't be a standing contact detail. The pure half of
// validateChosenUsername (src/lib/app/profile.ts), with the classes' own
// usernameHasContact, the check enrolling and joining run.
test("a new username can't carry contact details; keeping your own isn't checked again", () => {
  const err = (u: string, current: string | null) => chosenUsernameError(u, current, usernameHasContact);
  for (const u of ["snapchat_maya", "dm_me_maya", "insta_maya", "maya_ig", "discord_5835", "maya2025550143"]) {
    assert.equal(err(u, null), USERNAME_SENTENCES.contact, `sign-up: ${u}`);
    assert.equal(err(u, "maya_5835"), USERNAME_SENTENCES.contact, `rename: ${u}`);
  }
  // An older name it would catch keeps saving other Settings fields (live
  // classes still refuse it at enrolling and joining).
  assert.equal(err("maya2025550143", "maya2025550143"), null);
  // Shape and reserved names come first, with their own sentences.
  assert.equal(err("", "maya_5835"), USERNAME_SENTENCES.blank);
  assert.equal(err("ab", null), USERNAME_SENTENCES.tooShort);
  assert.equal(err("admin_snapchat", null), USERNAME_SENTENCES.reserved);
  // Robotics names and numbers are fine.
  for (const u of ["maya_5835", "frc5835_maya", "gearbox_4821", "snap_ring_fan", "team5835"]) {
    assert.equal(err(u, null), null, u);
  }
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

test("the migration's reserved lists match this file's", () => {
  const exact = quoted(/u = any \(array\[([\s\S]*?)\]\)/);
  assert.deepEqual([...exact].sort(), [...RESERVED_USERNAMES].sort());
  const prefixes = [...MIGRATION.matchAll(/u like '([a-z0-9_]+)%'/g)].map((m) => m[1]);
  assert.deepEqual([...prefixes].sort(), [...RESERVED_USERNAME_PREFIXES].sort());
  const staff = quoted(/from unnest\(array\[([^\]]*)\]\) w\b/);
  assert.deepEqual([...staff].sort(), [...RESERVED_STAFF_WORDS].sort());
  // The same start and end rule as isReservedUsername.
  assert.ok(MIGRATION.includes(`u ~ ('^' || w || '([_0-9]|$)') or u ~ ('_' || w || '$')`));
});

test("the migration's generator words and denied numbers match this file's", () => {
  const words = quoted(/words constant text\[\] := array\[([\s\S]*?)\];/);
  assert.deepEqual(words, [...GENERATED_USERNAME_WORDS]);
  assert.equal(new Set(words).size, words.length, "no word twice");
  for (const dropped of ["ratchet", "hinge"]) assert.ok(!words.includes(dropped), dropped);
  const denied = quoted(/from unnest\(array\[([^\]]*)\]\) d\b/);
  assert.deepEqual(denied, [...GENERATED_USERNAME_DENIED_DIGITS]);
  // The generator's numbers: 1000 to 9999, skipping the denied ones before a
  // handle is built from them.
  assert.match(MIGRATION, /n := 1000 \+ floor\(random\(\) \* 9000\)::int;\s*continue when public\.username_number_denied\(n::text\);/);
});

test("denied numbers: the codes are refused, ordinary numbers aren't", () => {
  for (const n of [1488, 8814, 1312, 6969, 8008, 4200, 6666, 1069, 2880, 4201]) {
    assert.equal(generatedNumberDenied(n), true, String(n));
  }
  for (const n of [1000, 4821, 2540, 9999, 1234, 6060]) {
    assert.equal(generatedNumberDenied(n), false, String(n));
  }
});

test("classes see a handle only once it's chosen or kept, and fail closed", () => {
  assert.equal(handleReadyForClasses(null), null);
  assert.equal(handleReadyForClasses({ username: "gearbox_4821", username_generated: true }), null);
  assert.equal(handleReadyForClasses({ username: null, username_generated: false }), null);
  assert.equal(handleReadyForClasses({ username: "maya_254", username_generated: false }), "maya_254");
  // A row read without the flag never passes: the gate forgot to select it.
  assert.equal(handleReadyForClasses({ username: "maya_254" }), null);
});

// RELEASE GATE for live classes (release-1.0). Once every account has a
// username, a class gate that tests `!username` never fires, and a generated
// handle the person has never seen would reach classmates, a teacher and a
// parent's consent email. On main there are no class files and this passes;
// after main is merged into release-1.0 it fails until the eligibility and
// teacher gates use handleReadyForClasses (and select username_generated).
test("release gate: live-class handle checks use handleReadyForClasses", () => {
  for (const file of [
    "src/lib/app/classes.ts",
    "src/lib/app/class-teachers.ts",
    "src/lib/app/classes-room.ts",
    "src/lib/app/class-chat.ts",
  ]) {
    const url = new URL(`../../${file}`, import.meta.url);
    if (!existsSync(url)) continue;
    const src = readFileSync(url, "utf8");
    assert.match(
      src,
      /handleReadyForClasses\(/,
      `${file}: a generated username must count as no handle (handleReadyForClasses)`
    );
    assert.match(src, /username_generated/, `${file}: select username_generated for the check`);
    // No stand-in name for someone without a ready handle: they're refused.
    assert.doesNotMatch(src, /\?\? "learnfrc"|\|\| "member"/, `${file}: a stand-in name for a missing handle`);
  }
});

test("every generated handle is a valid, unreserved, clean username with no contact detail (all 202,176)", () => {
  const format = /^[a-z0-9_]{3,32}$/;
  let checked = 0;
  for (const word of GENERATED_USERNAME_WORDS) {
    for (let n = 1000; n <= 9999; n++) {
      if (generatedNumberDenied(n)) continue;
      const handle = `${word}_${n}`;
      assert.ok(handle.length >= 3 && handle.length <= USERNAME_MAX, handle);
      assert.match(handle, format);
      assert.equal(normalizeUsername(handle), handle);
      assert.equal(usernameShapeError(handle), null, handle);
      assert.equal(firstProfaneField({ username: handle }), null, handle);
      // Classes would refuse it at enrolling and joining, and so would the
      // username step when someone keeps it.
      assert.equal(usernameHasContact(handle), false, handle);
      checked++;
    }
  }
  assert.equal(checked, 202_176);
  assert.equal(checked, GENERATED_USERNAME_WORDS.length * 8424);
});
