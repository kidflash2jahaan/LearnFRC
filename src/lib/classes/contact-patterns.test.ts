import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHAT_LINK_ALLOWLIST,
  SPOKEN_LINK_ALLOWLIST,
  contactKinds,
  findContactPatterns,
  hasContactPatterns,
  isAllowedHost,
  type ContactKind,
} from "./contact-patterns.ts";

const kinds = (text: string, opts = {}) => contactKinds(findContactPatterns(text, opts));

function expectKind(text: string, kind: ContactKind) {
  const found = kinds(text);
  assert.ok(found.includes(kind), `expected ${kind} in ${JSON.stringify(text)}, got ${JSON.stringify(found)}`);
}

function expectClean(text: string, opts = {}) {
  const found = findContactPatterns(text, opts);
  assert.deepEqual(found, [], `expected nothing in ${JSON.stringify(text)}, got ${JSON.stringify(found)}`);
}

test("phone numbers", () => {
  for (const t of [
    "call 202-555-0143",
    "my cell (202) 555-0143 ok",
    "202.555.0143",
    "202 555 0143",
    "2025550143",
    "+44 20 7946 0958",
    "1-800-555-0199",
    "555-0199 after school",
    "5550143",
    "2 0 2 5 5 5 0 1 4 3",
    "two zero two five five five zero one four three",
    "it's 2 zero 2 five 5 5 zero",
    "20 25 55 01 43",
  ]) {
    expectKind(t, "phone");
  }
});

test("emails, including spelled-out ones", () => {
  for (const t of [
    "sam.lee+frc@gmail.com",
    "write to SAM@School.k12.ca.us",
    "sam at gmail dot com",
    "sam (at) gmail (dot) com",
    "sam [at] school [dot] org",
    "sam at gmail.com",
    "just message samlee at gmail",
  ]) {
    expectKind(t, "email");
  }
});

test("links not on the allowlist", () => {
  for (const t of [
    "https://example.com/x",
    "http://bit.ly/abc",
    "www.snapchat.com/add/jake",
    "snap.com/add",
    "join discord.gg/abcd",
    "discord dot gg slash abc",
    "coolbot dot com",
    "linktr.ee/jake",
    "t.me/jake",
    "https://www.chiefdelphi.com/t/thread",
    "github.com/someone/repo",
  ]) {
    expectKind(t, "link");
  }
});

test("allowlisted links pass", () => {
  for (const t of [
    "https://learnfrc.com/guides/programming/commands/intro",
    "learnfrc.com/guides",
    "see https://docs.wpilib.org/en/stable/docs/software/basic-programming/java-units.html",
    "https://wpilib.org",
    "https://www.firstinspires.org/robotics/frc",
    "docs.revrobotics.com/brushless",
    "https://v6.docs.ctr-electronics.com/en/stable/",
    "https://docs.photonvision.org/en/latest/",
    "docs.limelightvision.io",
    "https://pathplanner.dev/home.html",
  ]) {
    expectClean(t);
  }
});

test("robot-network addresses are not links", () => {
  expectClean("open http://10.58.35.2:5800 for the PhotonVision UI");
  expectClean("http://localhost:3000 and roborio-5835-frc.local");
  expectClean("http://192.168.1.11:5801");
});

test("spoken allowlist adds Chief Delphi and TBA", () => {
  assert.equal(hasContactPatterns("chiefdelphi.com has a thread", { allowlist: SPOKEN_LINK_ALLOWLIST }), false);
  assert.equal(hasContactPatterns("look on thebluealliance.com", { allowlist: SPOKEN_LINK_ALLOWLIST }), false);
  assert.equal(hasContactPatterns("chiefdelphi.com has a thread"), true);
});

test("isAllowedHost: subdomains count, parents and lookalikes don't", () => {
  assert.equal(isAllowedHost("docs.wpilib.org"), true);
  assert.equal(isAllowedHost("www.learnfrc.com"), true);
  assert.equal(isAllowedHost("ctr-electronics.com"), false);
  assert.equal(isAllowedHost("learnfrc.com.evil.io"), false);
  assert.equal(isAllowedHost("notlearnfrc.com"), false);
  assert.ok(CHAT_LINK_ALLOWLIST.includes("learnfrc.com"));
});

test("@handles, except code annotations, times and the class roster", () => {
  expectKind("follow @jake_frc", "handle");
  expectKind("@jake.lee hi", "handle");
  expectClean("@Override public void periodic() {}");
  expectClean("@AutoLog public static class Inputs {}");
  expectClean("meet @5pm in the shop");
  expectClean("@maya good question", { allowHandles: ["maya"] });
  expectKind("@maya good question", "handle");
});

test("contact apps and phrases", () => {
  for (const [t, k] of [
    ["add me on discord", "contact_app"],
    ["DISCORD", "contact_app"],
    ["d1scord", "contact_app"],
    ["d i s c o r d", "contact_app"],
    ["my snap is jake", "contact_app"],
    ["snap: jake22", "contact_app"],
    ["snapchat", "contact_app"],
    ["insta", "contact_app"],
    ["1nst4gram", "contact_app"],
    ["my ig", "contact_app"],
    ["telegram", "contact_app"],
    ["WhatsApp", "contact_app"],
    ["kik", "contact_app"],
    ["tik tok", "contact_app"],
    ["DM me", "contact_phrase"],
    ["dm me later", "contact_phrase"],
    ["text me", "contact_phrase"],
    ["add me", "contact_phrase"],
    ["what's my number", "contact_phrase"],
    ["hmu", "contact_phrase"],
    ["slide into my dms", "contact_phrase"],
    ["whats ur snap", "contact_app"],
    ["jake#1234", "handle"],
  ] as const) {
    expectKind(t, k);
  }
});

test("zero-width characters and full-width letters don't hide anything", () => {
  expectKind("dis​cord", "contact_app");
  expectKind("ｄｉｓｃｏｒｄ", "contact_app");
  expectKind("202–555–0143", "phone");
});

test("robotics talk is left alone", () => {
  for (const t of [
    "CAN ID 12",
    "set the CAN IDs to 1, 2, 3 and 4",
    "team 5835",
    "we're team 5835 and 254 is in our division",
    "10.58.35.2",
    "the roboRIO is at 10.58.35.2 on port 5800",
    "port 5800",
    "@Override",
    "WPILib 2026.1.1",
    "kP is 0.0001234",
    "encoder resolution 4096000",
    "1000000 microseconds",
    "import java.io.File;",
    "new Scanner(System.in)",
    "System.out.println(x);",
    "frc.robot.subsystems.Drive",
    "edit Robot.java and build.gradle",
    "main.py and README.md",
    "the snap ring holds the bearing",
    "it should snap into place",
    "oh snap the robot died",
    "kill the motors",
    "the shooter is at 4500 rpm and the intake at 3000",
    "the match is on 2026-03-14",
    "look at the robot",
    "the dot product of the two vectors",
    "e.g. the swerve module",
    "our record was 12 3 and we scored 120 95 88",
    "the 20 amp breaker",
    "it uses i2c and spi",
    "my number one tip: check the breaker",
    "the gear ratio is 6.75:1 at 12.6 volts",
    "set IDs 1, 2, 3, 4, 5, 6, 7",
    "id 21 22 23 24",
  ]) {
    expectClean(t);
  }
});

test("each kind is reported once", () => {
  const found = findContactPatterns("discord discord discord");
  assert.equal(found.filter((f) => f.kind === "contact_app").length, 1);
});
