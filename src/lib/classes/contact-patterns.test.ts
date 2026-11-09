import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHAT_LINK_ALLOWLIST,
  SPOKEN_LINK_ALLOWLIST,
  contactKinds,
  findContactPatterns,
  hasContactPatterns,
  isAllowedHost,
  usernameHasContact,
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

test("an allowed link's path and query are scanned too", () => {
  expectKind("https://learnfrc.com/login?next=//t.me/maya", "link");
  expectKind("https://learnfrc.com/login?next=//wa.me/12025550143", "link");
  expectKind("https://docs.wpilib.org/x?u=//linktr.ee/maya", "link");
  expectKind("https://learnfrc.com/x?u=%2F%2Ft%2Eme%2Fmaya", "link");
  expectKind("https://learnfrc.com/x?ref=discord", "contact_app");
  expectClean("https://learnfrc.com/u/maya");
  expectClean("learnfrc.com/u/maya");
  expectClean("https://docs.wpilib.org/en/stable/docs/software/basic-programming/java-units.html");
});

test("lookalike letters, invisible characters and ideographic dots", () => {
  expectKind("my ѕnapchat is maya", "contact_app"); // Cyrillic s
  expectKind("discοrd: maya_42", "contact_app"); // Greek o
  expectKind("DІSCORD", "contact_app"); // Cyrillic capital I
  expectKind("disc⁦ord: maya", "contact_app");
  expectKind("disc\u{E0020}ord", "contact_app");
  expectKind("disc\u{1D173}ord", "contact_app");
  expectKind("disc⠀ord", "contact_app");
  expectKind("202⁦555⁦0143", "phone");
  expectKind("bit。ly/xyz", "link");
  expectKind("bit｡ly/xyz", "link");
});

test("more phone formats", () => {
  for (const t of [
    "202 5550143",
    "202555 0143",
    "20255 50143",
    "2025550 143",
    "202/555/0143",
    "202_555_0143",
    "202*555*0143",
    "202,555,0143",
    "maya2025550143",
    "two oh two, five fifty five, oh one forty three",
    "eight hundred five five five zero one nine nine",
  ]) {
    expectKind(t, "phone");
  }
  for (const t of [
    "teams 5835, 254, 1678 all run swerve",
    "set IDs 1, 2, 3, 4, 5, 6, 7",
    "IDs 1,2,3,4,5,6,7",
    "1,000,000,000 ticks",
    "the match is 11/08/2026",
    "the roboRIO 2 at 192.168.1.110",
    "we scored twenty two points in thirty seconds",
    "your # of motors",
  ]) {
    expectClean(t);
  }
});

test("spaced-out emails", () => {
  expectKind("m a y a @ g m a i l . c o m", "email");
  expectKind("maya @ gmail . com", "email");
  expectClean("meet @ 5 in the shop");
});

test("more apps, short names and asking for someone's details", () => {
  for (const [t, k] of [
    ["signal: maya", "contact_app"],
    ["add me on signal", "contact_app"],
    ["my roblox is maya", "contact_app"],
    ["facebook: maya", "contact_app"],
    ["my fb is maya", "contact_app"],
    ["my messenger", "contact_app"],
    ["twitter: maya", "contact_app"],
    ["u/maya_42", "contact_app"],
    ["imessage me", "contact_app"],
    ["facetime me", "contact_app"],
    ["wanna facetime", "contact_app"],
    ["my dc is maya_42", "contact_app"],
    ["dc: maya_42", "contact_app"],
    ["sc: maya_42", "contact_app"],
    ["snap maya_42", "contact_app"],
    ["sn@p", "contact_app"],
    ["5nap", "contact_app"],
    ["my tele is coolkid", "contact_app"],
    ["msg me on reddit u/coolkid", "contact_app"],
    ["add me on steam", "contact_app"],
    ["groupme", "contact_app"],
    ["d.m. me", "contact_phrase"],
    ["pls dm", "contact_phrase"],
    ["dms open", "contact_phrase"],
    ["inbox me", "contact_phrase"],
    ["msg me", "contact_phrase"],
    ["send me your number", "contact_phrase"],
    ["can i have your number", "contact_phrase"],
    ["whats ur phone number", "contact_phrase"],
    ["give me your email", "contact_phrase"],
    ["reach me at robo kid on gmail", "contact_phrase"],
  ] as const) {
    expectKind(t, k);
  }
});

test("robotics words near the new patterns are left alone", () => {
  for (const t of [
    "DC motor",
    "my dc motor is hot",
    "your DC power supply",
    "the signal wire",
    "check my signal wire",
    "the PWM signal is 50 Hz",
    "my signal is weak in the shop",
    "your number of motors",
    "your number one priority is safety",
    "check your email for the link",
    "add FF and FB terms",
    "a STEAM night at school",
    "the snap ring",
  ]) {
    expectClean(t);
  }
});

test("usernames that work as contact details", () => {
  for (const u of ["snapchat_maya", "maya_on_insta", "dm_me_maya", "add_me_on_ig", "maya2025550143", "hmu_maya", "kik_maya"]) {
    assert.equal(usernameHasContact(u), true, u);
  }
  for (const u of ["maya_42", "lftest_roomandchat_t1", "team5835_coder", "my_dc_motor", "big_robot", "frc_2026", "snap_ring", null, ""]) {
    assert.equal(usernameHasContact(u), false, String(u));
  }
});

test("each kind is reported once", () => {
  const found = findContactPatterns("discord discord discord");
  assert.equal(found.filter((f) => f.kind === "contact_app").length, 1);
});
