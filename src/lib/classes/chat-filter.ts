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
 * checkChatSequence also looks at the sender's last few shown messages
 * together, so a phone number, email, @handle or app name split across
 * messages is stopped when the last piece arrives, and a stopped message
 * never stops the ones after it.
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
  type ContactMatch,
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

/**
 * How far back checkChatSequence looks: the sender's last 5 shown messages in
 * the last 3 minutes.
 */
export const CHAT_SEQUENCE = { messages: 5, windowMs: 3 * 60_000 } as const;

/**
 * One of the sender's earlier messages, as checkChatSequence reads it: a
 * class_chat_messages row's body and status. A plain string is a message
 * that was shown.
 */
export type ChatSequenceMessage = string | { body: string; status: "shown" | "blocked" };

/** Mostly digits: at least half of what isn't a space is a digit ("202", "555-"). */
function mostlyDigits(s: string): boolean {
  const compact = s.replace(/\s+/g, "");
  const digits = compact.replace(/\D/g, "").length;
  return digits > 0 && digits * 2 >= compact.length;
}

type ScanOptions = { allowlist: readonly string[]; allowHandles?: Iterable<string> };

/**
 * The contact details that `messages` (oldest first) make read together:
 * joined with spaces, every kind. Glued with nothing between them, words run
 * into each other ("go to" + "learnfrc.com" reads "tolearnfrc.com", "@maya" +
 * "same" reads "@mayasame"), so only app names, phrases and emails count, and
 * a symbol reads as a letter only inside its own message ("d1" + "scord" is
 * "discord", but "step 1" + "message" isn't "imessage"; see
 * findGluedContactPatterns). A message ending in "@" is read with the name
 * that starts the next ("@" then "maya_42"). The run of mostly-digit messages
 * that ends the list counts as digits only, and only as a full 10 or 11 digit
 * number.
 */
function acrossMessages(messages: readonly string[], scanOpts: ScanOptions): ContactMatch[] {
  const scan = (s: string) => findContactPatterns(s, scanOpts);
  const found = [
    ...scan(messages.join(" ")),
    ...findGluedContactPatterns(messages, scanOpts).filter(
      (m) => m.kind === "contact_app" || m.kind === "contact_phrase" || m.kind === "email"
    ),
  ];
  for (let i = 0; i + 1 < messages.length; i++) {
    if (normalizeForContact(messages[i]).endsWith("@")) {
      found.push(...scan(`@${messages[i + 1]}`).filter((m) => m.kind === "handle"));
    }
  }
  const digitRun: string[] = [];
  for (let i = messages.length - 1; i >= 0 && mostlyDigits(messages[i]); i--) {
    digitRun.unshift(messages[i].replace(/\D/g, ""));
  }
  const digits = digitRun.join("");
  if (digitRun.length >= 2 && (digits.length === 10 || digits.length === 11)) {
    found.push(...scan(digits).filter((m) => m.kind === "phone"));
  }
  return found;
}

/**
 * A message that's fine on its own but finishes a contact detail split across
 * the sender's last few messages: "202", "555", "0143", or "disc" then "ord
 * maya_42". `previous` is the sender's recent messages in this class, oldest
 * first (the caller picks them with CHAT_SEQUENCE), read with this one as
 * acrossMessages says.
 *
 * Only a detail this message helps make counts against it:
 *   - a blocked message is left out, since nobody saw it. A stopped email
 *     glued to the next message reads "maya@gmail.comthanks", which would
 *     otherwise stop every innocent message after it (and, for a teacher,
 *     raise a new urgent flag each time);
 *   - a detail the earlier messages already make without this one, or that
 *     one message makes on its own, doesn't count again.
 * A split still counts when its first pieces were shown: "maya.robotics@"
 * then "gmail", or "202", "555", "0143".
 */
export function checkChatSequence(
  previous: readonly ChatSequenceMessage[],
  text: string,
  opts: { allowHandles?: Iterable<string> } = {}
): ChatCheck {
  const recent = previous
    .filter((m) => typeof m === "string" || m.status !== "blocked")
    .map((m) => cleanChatText(typeof m === "string" ? m : m.body))
    .filter(Boolean)
    .slice(-CHAT_SEQUENCE.messages);
  const current = cleanChatText(text);
  if (recent.length === 0 || !current) return { ok: true };
  const handles = opts.allowHandles ? [...opts.allowHandles] : undefined;
  const scanOpts: ScanOptions = { allowlist: CHAT_LINK_ALLOWLIST, allowHandles: handles };
  const key = (m: ContactMatch) => `${m.kind}\u0000${m.text}`;

  const all = [...recent, current];
  const already = new Set<string>();
  for (const m of all) for (const found of findContactPatterns(m, scanOpts)) already.add(key(found));
  for (const found of acrossMessages(recent, scanOpts)) already.add(key(found));

  const added = acrossMessages(all, scanOpts).filter((m) => !already.has(key(m)));
  if (added.length === 0) return { ok: true };
  return { ok: false, kinds: contactKinds(added) };
}
