import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHAT_BLOCKED_NOTE,
  CHAT_MAX_CHARS,
  chatLengthProblem,
  checkChatMessage,
  cleanChatText,
} from "./chat-filter.ts";

function blockedAs(text: string, kind: string) {
  const r = checkChatMessage(text);
  assert.equal(r.ok, false, `expected ${JSON.stringify(text)} to be blocked`);
  if (!r.ok) assert.ok(r.kinds.includes(kind as never), `expected ${kind}, got ${r.kinds.join(",")}`);
}

test("each blocked kind reports its kind", () => {
  blockedAs("check https://example.com", "link");
  blockedAs("follow @jake_frc", "handle");
  blockedAs("sam@gmail.com", "email");
  blockedAs("202-555-0143", "phone");
  blockedAs("add me on snapchat", "contact_app");
  blockedAs("dm me", "contact_phrase");
});

test("allowlisted docs links pass", () => {
  assert.deepEqual(checkChatMessage("https://docs.wpilib.org/en/stable/"), { ok: true });
  assert.deepEqual(checkChatMessage("lesson: https://learnfrc.com/guides/x/y/z"), { ok: true });
  assert.deepEqual(checkChatMessage("pathplanner.dev has the docs"), { ok: true });
});

test("simple tricks are caught", () => {
  blockedAs("d1scord", "contact_app");
  blockedAs("name at gmail dot com", "email");
  blockedAs("my site is coolbot dot com", "link");
  blockedAs("two zero two five five five zero one four three", "phone");
  blockedAs("s n a p c h a t", "contact_app");
});

test("ordinary class chat sends", () => {
  for (const t of [
    "what does kP do?",
    "my motor is on CAN ID 12",
    "we're team 5835",
    "@Override goes above periodic()",
    "is the roboRIO at 10.58.35.2?",
    "thanks!",
  ]) {
    assert.deepEqual(checkChatMessage(t), { ok: true }, t);
  }
});

test("classmates can be @-mentioned when the roster is passed", () => {
  assert.deepEqual(checkChatMessage("@maya same question", { allowHandles: ["Maya"] }), { ok: true });
  assert.equal(checkChatMessage("@maya same question").ok, false);
});

test("length rules", () => {
  assert.equal(chatLengthProblem("   "), "empty");
  assert.equal(chatLengthProblem("x".repeat(CHAT_MAX_CHARS)), null);
  assert.equal(chatLengthProblem("x".repeat(CHAT_MAX_CHARS + 1)), "too_long");
  assert.equal(cleanChatText("  hi\r\n "), "hi");
  assert.match(CHAT_BLOCKED_NOTE, /^That can't be sent here\./);
  assert.ok(!CHAT_BLOCKED_NOTE.includes("\u2014"), "no em dashes in copy");
});
