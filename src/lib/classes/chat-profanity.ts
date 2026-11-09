/**
 * The profanity check for class chat (section 6.5): the site's own check
 * (src/lib/profanity.ts), applied word by word.
 *
 * firstProfaneField squeezes the spaces out of whatever it's given before a
 * second look, which suits a username or a short bio but not a sentence:
 * "Is the analog input on port 0 or 1?" turns into one long run in which a
 * profane word appears across word boundaries, and an ordinary robotics
 * question would be stopped. So each word is checked on its own (which
 * still catches leetspeak, "f.u.c.k" and stretched letters inside a word),
 * plus every run of three or more one-letter words joined up, which is how
 * someone spells a word out with spaces.
 *
 * Imports only ../profanity.ts (and through it the obscenity package), so
 * node --test runs it (chat-profanity.test.ts).
 */

import { firstProfaneField } from "../profanity.ts";

export function chatHasProfanity(text: string): boolean {
  const words = text.split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (firstProfaneField({ word: w }) !== null) return true;
  }
  // "f u c k": runs of single characters, joined.
  let run: string[] = [];
  const checkRun = () => {
    if (run.length >= 3 && firstProfaneField({ word: run.join("") }) !== null) return true;
    run = [];
    return false;
  };
  for (const w of words) {
    const bare = w.replace(/[^\p{L}\p{N}]/gu, "");
    if (bare.length === 1) run.push(bare);
    else if (checkRun()) return true;
  }
  return checkRun();
}
