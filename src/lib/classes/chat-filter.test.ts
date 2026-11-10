import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHAT_BLOCKED_NOTE,
  CHAT_MAX_CHARS,
  CHAT_SEQUENCE,
  chatLengthProblem,
  checkChatMessage,
  checkChatSequence,
  cleanChatText,
  type ChatSequenceMessage,
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

test("review bypasses are blocked (Nov 8 review)", () => {
  for (const t of [
    // An allowed link carrying another one in its query, as written or encoded.
    "https://learnfrc.com/login?next=//t.me/maya",
    "https://learnfrc.com/login?next=//wa.me/12025550143",
    "https://docs.wpilib.org/x?u=//linktr.ee/maya",
    "https://learnfrc.com/x?u=%2F%2Ft%2Eme%2Fmaya",
    // Lookalike letters and invisible characters.
    "my ѕnapchat is maya",
    "discοrd: maya_42",
    "dіscord",
    "disc⁦ord: maya",
    "202⁦555⁦0143",
    "disc\u{E0020}ord",
    "disc\u{1D173}ord",
    "disc⠀ord",
    // Phone formats.
    "202 5550143",
    "202555 0143",
    "20255 50143",
    "202/555/0143",
    "202_555_0143",
    "202,555,0143",
    "two oh two, five fifty five, oh one forty three",
    // The ideographic full stop, and a spaced-out email.
    "bit。ly/xyz",
    "m a y a @ g m a i l . c o m",
    // Other apps, short names and asking for someone's details.
    "signal: maya",
    "my roblox is maya",
    "facebook: maya",
    "my messenger",
    "twitter: maya",
    "u/maya_42",
    "imessage me",
    "facetime me",
    "my dc is maya_42",
    "sc: maya_42",
    "snap maya_42",
    "sn@p",
    "d.m. me",
    "pls dm",
    "inbox me",
    "msg me on reddit u/coolkid",
    "my tele is coolkid",
    "send me your number",
    "can i have your number",
    "whats ur phone number",
    "give me your email",
    "wanna facetime",
    "reach me at robo kid on gmail",
  ]) {
    assert.equal(checkChatMessage(t).ok, false, `expected ${JSON.stringify(t)} to be blocked`);
  }
});

test("robotics talk near the new patterns still sends", () => {
  for (const t of [
    "the DC motor is hot",
    "my dc motor stalls",
    "check the signal wire",
    "the PWM signal is 50 Hz",
    "my signal is weak in the shop",
    "your number of motors matters",
    "teams 5835, 254, 1678 all run swerve",
    "set IDs 1, 2, 3, 4, 5, 6, 7",
    "https://learnfrc.com/u/maya",
    "it should snap into place",
    "add FF and FB terms",
  ]) {
    assert.deepEqual(checkChatMessage(t), { ok: true }, t);
  }
});

test("a contact detail split across messages is stopped at the last piece", () => {
  assert.deepEqual(checkChatMessage("0143"), { ok: true });
  const split = checkChatSequence(["202", "555"], "0143");
  assert.equal(split.ok, false);
  if (!split.ok) assert.ok(split.kinds.includes("phone"));
  const app = checkChatSequence(["disc"], "ord maya_42");
  assert.equal(app.ok, false);
  if (!app.ok) assert.ok(app.kinds.includes("contact_app"));
  assert.equal(checkChatSequence(["2 0 2", "5 5 5"], "0 1 4 3").ok, false);
});

test("the sequence check leaves ordinary chat and already-stopped messages alone", () => {
  assert.deepEqual(checkChatSequence([], "0143"), { ok: true });
  assert.deepEqual(checkChatSequence(["what does kP do?", "is it the P term"], "thanks!"), { ok: true });
  // The earlier message was already stopped on its own; the next one isn't stopped for it.
  assert.deepEqual(checkChatSequence(["add me on discord"], "anyway, back to PID"), { ok: true });
  assert.deepEqual(checkChatSequence(["4500"], "3000"), { ok: true });
  assert.deepEqual(checkChatSequence(["@maya"], "same question", { allowHandles: ["maya"] }), { ok: true });
  assert.deepEqual(checkChatSequence(["go to"], "learnfrc.com/guides"), { ok: true });
  assert.deepEqual(checkChatSequence(["my team is 5835"], "254 is in our division"), { ok: true });
  assert.equal(CHAT_SEQUENCE.messages, 5);
});

/** What sendClassChat decides: the message on its own, then with the sender's last few. */
function sends(previous: ChatSequenceMessage[], text: string, opts: { allowHandles?: string[] } = {}): boolean {
  return checkChatMessage(text, opts).ok && checkChatSequence(previous, text, opts).ok;
}

test("a symbol is read as a letter only inside its own message", () => {
  // "1" ending one message and "message" starting the next read "imessage"
  // when the messages were glued and then swapped (Nov 9 verification).
  for (const [previous, text] of [
    [["check step 1"], "message the mentor channel on the docs page if stuck"],
    [["message number 1"], "message number 2"],
    [["message number 1", "message number 2"], "message number 3"],
    [["see slide 1"], "message board is pinned"],
    [["lesson 1 is https://learnfrc.com/guides/1"], "message the mentor channel if stuck"],
    [["give me 5"], "nap time lol"],
  ] as [string[], string][]) {
    assert.deepEqual(checkChatSequence(previous, text), { ok: true }, `${JSON.stringify(previous)} then ${JSON.stringify(text)}`);
    assert.ok(sends(previous, text), `${JSON.stringify(previous)} then ${JSON.stringify(text)}`);
  }
});

test("contact details split over 2 to 4 messages are still stopped", () => {
  for (const [previous, text] of [
    // Emails.
    [["maya"], "@gmail.com"],
    [["maya", "@gmail"], ".com"],
    [["maya at"], "gmail dot com"],
    [["m a y a"], "@ g m a i l . c o m"],
    // Phone numbers.
    [["202", "555"], "0143"],
    [["202-555"], "-0143"],
    [["(202)", "555", "01"], "43"],
    // @handles.
    [["@"], "maya_42"],
    [["follow me", "@"], "maya_42 on there"],
    // Discord, Snap and Insta, as names and links, symbols included when
    // they touch a letter in their own message.
    [["disc"], "ord maya_42"],
    [["d", "is", "co"], "rd"],
    [["d1"], "scord"],
    [["disc"], "0rd"],
    [["disc"], "ord.gg/abc"],
    [["https://learnfrc.com/x?u=disc"], "ord"],
    [["sn"], "ap me"],
    [["5n"], "ap"],
    [["snap"], "maya_42"],
    [["snap maya"], "42"],
    [["in", "sta"], "gram"],
    [["ins"], "ta: maya_42"],
    [["insta"], "gram.com/maya"],
    // A link with its dot spelled out.
    [["coolbot"], "dot com"],
  ] as [string[], string][]) {
    assert.equal(sends(previous, text), false, `expected ${JSON.stringify(previous)} then ${JSON.stringify(text)} to be blocked`);
  }
  // A classmate's handle split the same way still sends.
  assert.ok(sends(["@"], "maya same question", { allowHandles: ["maya"] }));
  assert.ok(sends(["@"], "5835 is our team"));
});

/** A message the filter stopped, as class_chat_messages stores it. */
const blocked = (body: string) => ({ body, status: "blocked" as const });
const shown = (body: string) => ({ body, status: "shown" as const });

test("a stopped message doesn't stop the innocent ones after it (Nov 9 flow test)", () => {
  const email = "email me at maya.robotics@gmail.com";
  const phone = "text me 714 555 0134";
  const thanks = "thanks, that makes sense now";
  // The production rows: the first two stopped (rightly), the third wasn't
  // anything but was stopped as an email, the earlier email glued to it.
  assert.equal(checkChatMessage(email).ok, false);
  assert.equal(checkChatMessage(phone).ok, false);
  assert.deepEqual(checkChatSequence([blocked(email), blocked(phone)], thanks), { ok: true });
  // Read as if they'd been shown, the third still isn't blamed for details
  // that sit wholly inside the earlier two.
  assert.deepEqual(checkChatSequence([email, phone], thanks), { ok: true });

  for (const [previous, text] of [
    // An email, then anything.
    [[blocked(email)], thanks],
    [[blocked("sam@gmail.com")], "ok"],
    [[blocked("my email is maya at gmail dot com")], "got it"],
    // A phone number, then anything, numbers included.
    [[blocked(phone)], thanks],
    [[blocked("call me 202-555-0143")], "2 more questions about PID"],
    [[blocked("202 555 0143")], "5835 is our team"],
    [[shown("202"), blocked("555 0143")], "thanks"],
    // Snap, Discord, Insta and a handle, then anything.
    [[blocked("add me on snap")], "chat about it later?"],
    [[blocked("my snap is maya_42")], "ok cool"],
    [[blocked("snap: maya_42")], "me too"],
    [[blocked("add me on insta")], "gram is a unit of mass btw"],
    [[blocked("join my discord")], "app inventor is fun"],
    [[blocked("follow @maya_42")], "thanks"],
    [[blocked("@maya_42")], "thanks"],
    // Several stopped in a row.
    [[blocked(email), blocked(phone), blocked("add me on snap")], thanks],
  ] as [ChatSequenceMessage[], string][]) {
    assert.deepEqual(checkChatSequence(previous, text), { ok: true }, `${JSON.stringify(previous)} then ${JSON.stringify(text)}`);
    assert.ok(sends(previous, text), `${JSON.stringify(previous)} then ${JSON.stringify(text)}`);
  }
});

test("splits are still stopped around a stopped message", () => {
  for (const [previous, text] of [
    // Shown first pieces still count.
    [[shown("maya.robotics@")], "gmail"],
    [[shown("maya.robotics@")], "gmail.com"],
    [[shown("maya"), shown("@")], "gmail.com"],
    [[shown("202"), shown("555")], "0143"],
    [[shown("disc")], "ord maya_42"],
    [[shown("sn")], "ap me"],
    // A stopped message between the pieces: the shown ones still meet.
    [[shown("202"), blocked("lol add me on snap"), shown("555")], "0143"],
    [[shown("maya.robotics@"), blocked("call me 202-555-0143")], "gmail"],
    [[shown("disc"), blocked("sam@gmail.com")], "ord"],
    // After a stopped full number, sending it again in pieces.
    [[blocked("my number is 714 555 0134"), shown("714"), shown("555")], "0134"],
    [[blocked("202 5550"), shown("202")], "5550"],
    // Four pieces.
    [[shown("2"), shown("02"), shown("555")], "0143"],
    [[shown("d"), shown("is"), shown("co")], "rd"],
  ] as [ChatSequenceMessage[], string][]) {
    assert.equal(sends(previous, text), false, `expected ${JSON.stringify(previous)} then ${JSON.stringify(text)} to be blocked`);
  }
});

test("a detail the earlier messages already make isn't blamed on the next one", () => {
  // Joined, "202" + "555 0143" is a number; "thanks" adds nothing to it.
  assert.deepEqual(checkChatSequence(["202", "555 0143"], "thanks"), { ok: true });
  // Glued, "my dis" + "cord is maya" is Discord; "ok" adds nothing to it.
  assert.deepEqual(checkChatSequence(["my dis", "cord is maya"], "ok"), { ok: true });
  // A new detail in the same window still counts.
  assert.equal(checkChatSequence(["my dis", "cord is maya.", "sn"], "ap me").ok, false);
  assert.equal(checkChatSequence(["202", "555 0143", "ok so", "714", "555"], "0134").ok, false);
});

test("length rules", () => {
  assert.equal(chatLengthProblem("   "), "empty");
  assert.equal(chatLengthProblem("x".repeat(CHAT_MAX_CHARS)), null);
  assert.equal(chatLengthProblem("x".repeat(CHAT_MAX_CHARS + 1)), "too_long");
  assert.equal(cleanChatText("  hi\r\n "), "hi");
  assert.match(CHAT_BLOCKED_NOTE, /^That can't be sent here\./);
  assert.ok(!CHAT_BLOCKED_NOTE.includes("\u2014"), "no em dashes in copy");
});
