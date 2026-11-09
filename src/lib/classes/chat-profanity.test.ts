import { test } from "node:test";
import assert from "node:assert/strict";
import { chatHasProfanity } from "./chat-profanity.ts";

// The test words are stored reversed, so the source holds no profanity.
const word = (reversed: string) => reversed.split("").reverse().join("");
const W = word("tihs");

test("ordinary robotics chat passes, including words that only look bad squeezed together", () => {
  for (const line of [
    "Is the analog input on port 0 or 1?",
    "What CAN ID should the front left module use?",
    "Can you assemble the bumpers before inspection?",
    "what about the shaft collar on the hex shaft",
    "assist the drivers with a vision target",
    "I think the class is about pass through intakes",
    "Should we use a snap ring or a shaft collar?",
    "that's a sick auto routine",
    "We had a brownout at our last competition",
  ]) {
    assert.equal(chatHasProfanity(line), false, line);
  }
});

test("a profane word is caught on its own, inside punctuation, and disguised in the word", () => {
  assert.equal(chatHasProfanity(`this is ${W}`), true);
  assert.equal(chatHasProfanity(`${W}!!`), true);
  assert.equal(chatHasProfanity(`what ${W.split("").join(".")} is this`), true);
  assert.equal(chatHasProfanity(`${W[0]}${W[1]}${W[2]}${W[2]}${W[2]}${W[3]} wiring`), true);
});

test("a word spelled out with spaces is caught", () => {
  assert.equal(chatHasProfanity(`that is ${W.split("").join(" ")} honestly`), true);
  assert.equal(chatHasProfanity(W.split("").join(" ")), true);
});

test("single letters that spell nothing pass", () => {
  assert.equal(chatHasProfanity("press a b x y on the controller"), false);
  assert.equal(chatHasProfanity("is it option a or b"), false);
});
