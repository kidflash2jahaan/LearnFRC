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
 * checkChatSequence also looks at the sender's last few messages together,
 * so a phone number, email, @handle or app name split across messages is
 * stopped when the last piece arrives.
 *
 * Pure, imports only ./contact-patterns.ts, unit tested (chat-filter.test.ts).
 */

import {
  CHAT_LINK_ALLOWLIST,
  contactKinds,
  findContactPatterns,
  findGluedContactPatterns,
  normalizeForContact,
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

/** How far back checkChatSequence looks: the sender's last 5 messages in the last 3 minutes. */
export const CHAT_SEQUENCE = { messages: 5, windowMs: 3 * 60_000 } as const;

/** Mostly digits: at least half of what isn't a space is a digit ("202", "555-"). */
function mostlyDigits(s: string): boolean {
  const compact = s.replace(/\s+/g, "");
  const digits = compact.replace(/\D/g, "").length;
  return digits > 0 && digits * 2 >= compact.length;
}

/**
 * A message that's fine on its own but finishes a contact detail split across
 * the sender's last few messages: "202", "555", "0143", or "disc" then "ord
 * maya_42". `previous` is the sender's recent messages in this class, oldest
 * first, whatever happened to them (the caller picks them with
 * CHAT_SEQUENCE). They're joined with spaces, with nothing between them, and
 * (for the run of mostly-digit messages that ends with this one) as digits
 * only; a message ending in "@" is also read with the name that starts the
 * next ("@" then "maya_42"). Only details that no single message carries
 * count, so a message the filter already stopped doesn't stop the next one
 * too.
 */
export function checkChatSequence(
  previous: readonly string[],
  text: string,
  opts: { allowHandles?: Iterable<string> } = {}
): ChatCheck {
  const recent = previous.map(cleanChatText).filter(Boolean).slice(-CHAT_SEQUENCE.messages);
  const current = cleanChatText(text);
  if (recent.length === 0 || !current) return { ok: true };
  const handles = opts.allowHandles ? [...opts.allowHandles] : undefined;
  const scanOpts = { allowlist: CHAT_LINK_ALLOWLIST, allowHandles: handles };
  const scan = (s: string) => findContactPatterns(s, scanOpts);
  const key = (m: { kind: string; text: string }) => `${m.kind}\u0000${m.text}`;

  const all = [...recent, current];
  const alone = new Set<string>();
  for (const m of all) for (const found of scan(m)) alone.add(key(found));

  // Joined with spaces, every kind counts. Glued together, words run into
  // each other ("go to" + "learnfrc.com" reads "tolearnfrc.com", "@maya" +
  // "same" reads "@mayasame"), so only app names, phrases and emails count.
  // Glued, a symbol reads as a letter only inside its own message ("d1" +
  // "scord" is "discord", but "step 1" + "message" isn't "imessage"); see
  // findGluedContactPatterns. The digits-only run counts only as a full 10 or
  // 11 digit number.
  const found = [
    ...scan(all.join(" ")),
    ...findGluedContactPatterns(all, scanOpts).filter(
      (m) => m.kind === "contact_app" || m.kind === "contact_phrase" || m.kind === "email"
    ),
  ];
  // The one glued handle that counts: "@" ending a message, the name starting
  // the next.
  for (let i = 0; i + 1 < all.length; i++) {
    if (normalizeForContact(all[i]).endsWith("@")) {
      found.push(...scan(`@${all[i + 1]}`).filter((m) => m.kind === "handle"));
    }
  }
  const digitRun: string[] = [];
  for (let i = all.length - 1; i >= 0 && mostlyDigits(all[i]); i--) digitRun.unshift(all[i].replace(/\D/g, ""));
  const digits = digitRun.join("");
  if (digitRun.length >= 2 && (digits.length === 10 || digits.length === 11)) {
    found.push(...scan(digits).filter((m) => m.kind === "phone"));
  }

  const added = found.filter((m) => !alone.has(key(m)));
  if (added.length === 0) return { ok: true };
  return { ok: false, kinds: contactKinds(added) };
}
