/**
 * The class chat filter (section 6.5).
 *
 * Every message in a class goes through `checkChatMessage` on the server
 * before anyone sees it, the teacher's and staff's included: links outside
 * LearnFRC and the docs, @handles, emails, phone numbers and other apps'
 * contact names are stopped. sendClassChat (src/lib/app/class-chat.ts) then
 * runs the site's profanity check (src/lib/profanity.ts, kind `profanity`),
 * which isn't here because this module has to stay import-free for tests.
 *
 * A stopped message is stored as `blocked` with its kinds (it goes into the
 * review and holds) and the sender sees CHAT_BLOCKED_NOTE; nobody else sees it.
 *
 * Pure, imports only ./contact-patterns.ts, unit tested (chat-filter.test.ts).
 */

import {
  CHAT_LINK_ALLOWLIST,
  contactKinds,
  findContactPatterns,
  type ContactKind,
} from "./contact-patterns.ts";

export type ChatCheck = { ok: true } | { ok: false; kinds: ContactKind[] };

/** Matches class_chat_messages.body's check and CHAT_LIMITS.maxChars. */
export const CHAT_MAX_CHARS = 300;

/** What the sender sees when the filter stops a message. */
export const CHAT_BLOCKED_NOTE =
  "That can't be sent here. Class chat can't carry links outside LearnFRC and the docs, @handles, email addresses, phone numbers or usernames from other apps.";

/** What the sender sees when the profanity check stops a message. */
export const CHAT_PROFANITY_NOTE = "That can't be sent here. Keep the class chat friendly.";

export const CHAT_EMPTY_NOTE = "Type a message first.";
export const CHAT_TOO_LONG_NOTE = `Keep messages under ${CHAT_MAX_CHARS} characters.`;

/** A message trimmed the way it's stored. */
export function cleanChatText(text: string): string {
  return text.replace(/\r\n?/g, "\n").trim();
}

/** "empty", "too_long", or null when the length is fine. */
export function chatLengthProblem(text: string): "empty" | "too_long" | null {
  const t = cleanChatText(text);
  if (!t) return "empty";
  if (t.length > CHAT_MAX_CHARS) return "too_long";
  return null;
}

/**
 * Whether a chat message may be shown. `allowHandles` is the class's own
 * roster, so "@maya good question" to a classmate still sends; every other
 * @handle is stopped.
 */
export function checkChatMessage(
  text: string,
  opts: { allowHandles?: Iterable<string> } = {}
): ChatCheck {
  const matches = findContactPatterns(cleanChatText(text), {
    allowlist: CHAT_LINK_ALLOWLIST,
    allowHandles: opts.allowHandles,
  });
  if (matches.length === 0) return { ok: true };
  return { ok: false, kinds: contactKinds(matches) };
}
