/**
 * Contact details in text: links, @handles, emails, phone numbers and the
 * names of other apps people use to take a conversation private.
 *
 * One function, two uses:
 *   - the class chat filter (./chat-filter.ts) stops a message that carries
 *     any of these before anyone sees it (section 6.5);
 *   - the review's code flags (src/lib/classes/code-flags.ts) scan the
 *     transcript for what was said aloud (section 7.2), and the bio checks
 *     (teachers before scheduling, students before enrolling and joining).
 *
 * It errs toward catching, since a blocked chat message costs a student one
 * rephrase and a missed one can cost far more. But it has to leave robotics
 * talk alone: CAN IDs, team numbers, robot IP addresses, ports, version
 * numbers, pasted Java (`@Override`, `java.io.File`, `System.in`) and words
 * like "snap ring" all pass. contact-patterns.test.ts holds both lists.
 *
 * The text is normalized first (Unicode NFKC, lowercase, zero-width characters
 * removed). App names and phrases are also matched after undoing common
 * letter-for-digit swaps ("d1scord") and spaced-out letters ("d i s c o r d"),
 * and emails and domains after spelled-out "at" and "dot".
 *
 * Pure, no imports, unit tested. Tested modules import nothing from `@/`, so
 * the link allowlists live here too.
 */

export type ContactKind = "link" | "handle" | "email" | "phone" | "contact_app" | "contact_phrase";

export type ContactMatch = {
  kind: ContactKind;
  /** The matched text, from the normalized string (lowercase). */
  text: string;
};

export type ContactOptions = {
  /** Hosts whose links are fine. Defaults to CHAT_LINK_ALLOWLIST. */
  allowlist?: readonly string[];
  /** Usernames that may be @-mentioned (the class's own roster). */
  allowHandles?: Iterable<string>;
};

/**
 * Links that may be sent in class chat: LearnFRC and documentation sites with
 * no private messages. Subdomains count (docs.wpilib.org is under wpilib.org),
 * parent domains don't. Forums and sites with private messages, like
 * chiefdelphi.com, stay off.
 */
export const CHAT_LINK_ALLOWLIST: readonly string[] = [
  "learnfrc.com",
  "docs.wpilib.org",
  "wpilib.org",
  "firstinspires.org",
  "docs.revrobotics.com",
  "v6.docs.ctr-electronics.com",
  "docs.photonvision.org",
  "docs.limelightvision.io",
  "pathplanner.dev",
];

/**
 * Sites that are fine to name aloud in a class, for the transcript scan: the
 * chat list plus Chief Delphi and The Blue Alliance.
 */
export const SPOKEN_LINK_ALLOWLIST: readonly string[] = [
  ...CHAT_LINK_ALLOWLIST,
  "chiefdelphi.com",
  "thebluealliance.com",
];

/* ── Normalizing ───────────────────────────────────────────────────── */

const ZERO_WIDTH =
  /[­͏؜ᅟᅠ឴឵᠋-᠏​-‏‪-‮⁠-⁤⁪-⁯︀-️﻿]/g;
const DASHES = /[‐-―−﹘﹣－]/g;

/** NFKC, lowercase, zero-width characters removed, every dash a hyphen. */
export function normalizeForContact(text: string): string {
  return text.normalize("NFKC").replace(ZERO_WIDTH, "").replace(DASHES, "-").toLowerCase();
}

/** Spelled-out "dot" between words becomes ".": "gmail dot com", "x [dot] gg". */
function spellDots(s: string): string {
  return s
    .replace(/\s*[([{<]\s*dot\s*[)\]}>]\s*/g, ".")
    .replace(/(?<=[a-z0-9])\s+dot\s+(?=[a-z0-9])/g, ".");
}

/** Spelled-out "at" between words becomes "@" (only used for email matching). */
function spellAts(s: string): string {
  return s
    .replace(/\s*[([{<]\s*at\s*[)\]}>]\s*/g, "@")
    .replace(/(?<=[a-z0-9])\s+at\s+(?=[a-z0-9])/g, "@");
}

const LEET_COMMON: Record<string, string> = {
  "0": "o",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  $: "s",
  "!": "i",
  "|": "l",
  "+": "t",
};

/**
 * Two letter-for-digit readings, since "1" stands in for both i and l. Only a
 * symbol touching a letter is swapped ("d1scord", "5nap"), so plain numbers
 * like "team 19" never turn into words.
 */
function unLeet(s: string): string[] {
  const swap = (one: string) =>
    s.replace(/(?<=[a-z])[0134578@$!|+9]|[0134578@$!|+9](?=[a-z])/g, (c) =>
      c === "1" ? one : (LEET_COMMON[c] ?? c)
    );
  return [swap("i"), swap("l")];
}

/** "d i s c o r d", "d.i.s.c.o.r.d", "d-i-s-c-o-r-d" become "discord". */
function collapseSpacedLetters(s: string): string {
  return s.replace(/\b(?:[a-z][\s.\-_*·•]+){2,}[a-z]\b/g, (m) => m.replace(/[^a-z]/g, ""));
}

/** The versions of the text that app names and phrases are matched against. */
function letterForms(base: string): string[] {
  const forms = new Set<string>([base, collapseSpacedLetters(base)]);
  for (const f of unLeet(base)) {
    forms.add(f);
    forms.add(collapseSpacedLetters(f));
  }
  return [...forms];
}

/* ── Links ─────────────────────────────────────────────────────────── */

/**
 * Top-level domains that make a bare "word.tld" a link. Deliberately not every
 * TLD: the ones that are also common file extensions or code (in, is, it, sh,
 * py, rs, md, pl, cc, so, ml, zip, mov, java and friends) are left out, so
 * `System.in`, `main.py` and `Robot.java` pass. A link with a scheme or "www."
 * is a link whatever its TLD.
 */
const LINK_TLDS = new Set([
  "com", "net", "org", "edu", "gov", "mil", "int", "io", "gg", "dev", "app", "info", "biz",
  "xyz", "link", "page", "site", "online", "live", "chat", "social", "club", "fun", "lol",
  "wtf", "top", "shop", "store", "tech", "space", "website", "blog", "news", "email", "icu",
  "vip", "pro", "one", "world", "today", "life", "cool", "zone", "digital", "network",
  "group", "art", "games", "media", "studio", "me", "co", "tv", "ly", "be", "gl", "us",
  "uk", "ca", "au", "nz", "ai", "to", "im", "gd", "fm", "la", "ws", "ee", "de", "fr",
  "jp", "kr", "br", "mx", "es", "nl", "ch", "se", "eu", "ie", "za", "ru", "cn", "tk",
  "ga", "cf", "gq", "cx",
]);

/** Robot-network and local addresses: never contact details. */
function isLocalHost(host: string): boolean {
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".localhost")) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/** True when `host` is on the allowlist or a subdomain of an entry. */
export function isAllowedHost(host: string, allowlist: readonly string[] = CHAT_LINK_ALLOWLIST): boolean {
  const h = host.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  if (isLocalHost(h)) return true;
  return allowlist.some((a) => h === a || h.endsWith(`.${a}`));
}

const SCHEME_URL = /\b(?:https?|ftp):\/\/[^\s<>"'`]+/g;
const WWW_URL = /(?<![\w.-])www\.[a-z0-9-]+(?:\.[a-z0-9-]+)+/g;
const BARE_DOMAIN =
  /(?<![@\w.-])[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?![\w-]|\.[\w-])/g;

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    const m = /^[a-z]+:\/\/([^/:?#\s]+)/.exec(url);
    return m ? m[1] : null;
  }
}

function findLinks(base: string, allowlist: readonly string[], out: ContactMatch[]): string {
  // Scheme links first; blank them out so the bare-domain pass doesn't see
  // their host a second time.
  let rest = base.replace(SCHEME_URL, (m) => {
    const url = m.replace(/[.,;:!?)\]]+$/, "");
    const host = hostOf(url);
    if (!host || !isAllowedHost(host, allowlist)) out.push({ kind: "link", text: url });
    return " ".repeat(m.length);
  });
  rest = rest.replace(WWW_URL, (m) => {
    if (!isAllowedHost(m, allowlist)) out.push({ kind: "link", text: m });
    return " ".repeat(m.length);
  });
  for (const form of new Set([rest, spellDots(rest)])) {
    for (const m of form.matchAll(BARE_DOMAIN)) {
      const host = m[0];
      const tld = host.slice(host.lastIndexOf(".") + 1);
      if (!LINK_TLDS.has(tld)) continue;
      if (!isAllowedHost(host, allowlist)) out.push({ kind: "link", text: host });
    }
  }
  return rest;
}

/* ── Emails ────────────────────────────────────────────────────────── */

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.([a-z]{2,24})\b/g;
const MAIL_PROVIDERS = /[a-z0-9._%+-]{2,}@(?:gmail|googlemail|yahoo|outlook|hotmail|icloud|aol|protonmail|proton|gmx)\b/g;

/** Finds emails and blanks them out, so their "@" isn't read as a handle. */
function findEmails(base: string, out: ContactMatch[]): string {
  const blank = (s: string) => " ".repeat(s.length);
  // A real "@": any TLD counts.
  const rest = base.replace(EMAIL, (m) => {
    out.push({ kind: "email", text: m });
    return blank(m);
  });
  // Spelled out: "sam at gmail dot com", "sam (at) school [dot] org", "sam at gmail".
  const spelled = spellAts(spellDots(rest));
  if (spelled !== rest) {
    for (const m of spelled.matchAll(EMAIL)) {
      if (LINK_TLDS.has(m[1])) out.push({ kind: "email", text: m[0] });
    }
  }
  for (const m of spelled.matchAll(MAIL_PROVIDERS)) out.push({ kind: "email", text: m[0] });
  return rest;
}

/* ── @handles ──────────────────────────────────────────────────────── */

/** Code annotations and decorators that look like handles (lowercased). */
const CODE_ANNOTATIONS = new Set([
  "override", "deprecated", "suppresswarnings", "functionalinterface", "safevarargs",
  "test", "beforeeach", "aftereach", "beforeall", "afterall", "parameterizedtest",
  "valuesource", "disabled", "nested", "inject", "autowired", "component", "autolog",
  "autologoutput", "nullable", "nonnull", "notnull", "param", "return", "returns", "throws",
  "see", "author", "since", "link", "code", "inheritdoc", "value", "interface", "property",
  "staticmethod", "classmethod", "dataclass", "abstractmethod", "cached_property",
  "jsonproperty", "serializedname", "target", "retention", "documented", "everyone", "here",
]);

const HANDLE = /(?<![\w@.])@([a-z0-9_](?:[a-z0-9_.]{0,29}[a-z0-9_])?)/g;
const TIME_LIKE = /^\d{1,2}(?::\d{2})?(?:am|pm)?$/;

/** An old-style Discord tag: name#1234. */
const DISCORD_TAG = /(?<![\w@.])[a-z0-9_.]{2,32}#\d{4}\b/g;

function findHandles(text: string, allowHandles: Set<string>, out: ContactMatch[]) {
  for (const m of text.matchAll(DISCORD_TAG)) out.push({ kind: "handle", text: m[0] });
  for (const m of text.matchAll(HANDLE)) {
    const name = m[1];
    if (!/[a-z]/.test(name)) continue; // @5835 is a team, not a handle
    if (TIME_LIKE.test(name)) continue; // "meet @5pm"
    if (CODE_ANNOTATIONS.has(name)) continue;
    if (allowHandles.has(name)) continue;
    out.push({ kind: "handle", text: m[0] });
  }
}

/* ── Phone numbers ─────────────────────────────────────────────────── */

const PHONE_CANDIDATE = /(?<![\w.])\+?\(?\d[\d\s().-]*\d(?![\w]|\.\d)/g;

function groupsOf(s: string): number[] {
  return s
    .split(/[^\d]+/)
    .filter(Boolean)
    .map((g) => g.length);
}

const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const PHONE_SHAPES = [[3, 4], [3, 3, 4], [1, 3, 3, 4], [1, 3, 4]];

function isPhoneCandidate(raw: string): boolean {
  const c = raw.trim();
  const digits = c.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return false;
  const groups = groupsOf(c);
  const seps = c.replace(/[\d]/g, "");
  if (c.startsWith("+")) return true;
  if (seps === "") {
    // Plain digits. Round numbers (4096000, 1000000) and leading zeros aren't
    // phone numbers; anything else 7 long or more is treated as one.
    if (digits.length >= 10) return true;
    return !/000$/.test(digits) && !digits.startsWith("0");
  }
  if (/^[.]+$/.test(seps)) {
    // Dots only: robot IPs (10.58.35.2), versions and decimals pass; only
    // the dotted phone shapes (202.555.0143) count.
    return PHONE_SHAPES.some((s) => same(groups, s));
  }
  if (/[()]/.test(seps)) return true;
  if (/-/.test(seps)) {
    // Dates (2026-11-08, 11-08-2026) aren't phone numbers.
    if (same(groups, [4, 2, 2]) || same(groups, [2, 2, 4]) || same(groups, [2, 2, 2])) return false;
    return true;
  }
  // Spaces only.
  if (groups.every((g) => g === 1)) return groups.length >= 7; // "7 1 4 7 2 8 2"
  if (PHONE_SHAPES.some((s) => same(groups, s))) return true;
  return digits.length >= 10 && groups.every((g) => g <= 4);
}

const DIGIT_WORDS: Record<string, string> = {
  zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9", niner: "9",
};

/** Runs of 7+ digits where at least one is spelled out: "two zero two ...". */
function findSpelledPhones(base: string, out: ContactMatch[]) {
  const tokens = base.split(/[\s,.;:()\-]+/).filter(Boolean);
  let run: string[] = [];
  let spelled = false;
  const flush = () => {
    const digits = run.join("");
    if (spelled && digits.length >= 7) out.push({ kind: "phone", text: run.join(" ") });
    run = [];
    spelled = false;
  };
  for (const t of tokens) {
    if (DIGIT_WORDS[t] !== undefined && !(t === "oh" && run.length === 0)) {
      run.push(DIGIT_WORDS[t]);
      spelled = true;
    } else if (/^\d{1,4}$/.test(t)) {
      run.push(t);
    } else {
      flush();
    }
  }
  flush();
}

function findPhones(text: string, base: string, out: ContactMatch[]) {
  for (const m of text.matchAll(PHONE_CANDIDATE)) {
    if (isPhoneCandidate(m[0])) out.push({ kind: "phone", text: m[0].trim() });
  }
  findSpelledPhones(base, out);
}

/* ── Other apps and "take it private" phrases ──────────────────────── */

const CONTACT_APPS: RegExp[] = [
  /\bdiscord(?:app)?\b/,
  /\bsnapchat\b/,
  /\bsnap\s*(?::|me\b|username\b|handle\b|name\b|id\b|account\b|code\b)/,
  /\b(?:my|your|ur|on|via|thru|through)\s+snap\b/,
  /\binsta(?:gram)?\b/,
  /\big\b/,
  /\btelegram\b/,
  /\bwhats\s?app\b/,
  /\bkik\b/,
  /\btik\s?tok\b/,
];

const CONTACT_PHRASES: RegExp[] = [
  /\bd\s?m\s+me\b/,
  /\b(?:my|your|ur)\s+dms?\b/,
  /\bp\s?m\s+me\b/,
  /\bmessage\s+me\b/,
  /\btext\s+me\b/,
  /\bcall\s+me\s+(?:at|on)\b/,
  /\badd\s+me\b/,
  /\bmy\s+(?:phone\s+|cell\s+)?number\b(?!\s+one\b)/,
  /\bmy\s+e-?mail\b/,
  /\be-?mail\s+me\b/,
  /\bmy\s+socials?\b/,
  /\bfollow\s+me\s+on\b/,
  /\bhmu\b/,
  /\bhit\s+me\s+up\b/,
];

function findApps(forms: string[], out: ContactMatch[]) {
  const seen = new Set<string>();
  for (const form of forms) {
    for (const re of CONTACT_APPS) {
      const m = re.exec(form);
      if (m && !seen.has(re.source)) {
        seen.add(re.source);
        out.push({ kind: "contact_app", text: m[0] });
      }
    }
    for (const re of CONTACT_PHRASES) {
      const m = re.exec(form);
      if (m && !seen.has(re.source)) {
        seen.add(re.source);
        out.push({ kind: "contact_phrase", text: m[0] });
      }
    }
  }
}

/* ── The one entry point ───────────────────────────────────────────── */

/**
 * Every contact detail in `text`, or an empty list. Duplicates (the same kind
 * and text) are reported once.
 */
export function findContactPatterns(text: string, opts: ContactOptions = {}): ContactMatch[] {
  if (!text) return [];
  const allowlist = opts.allowlist ?? CHAT_LINK_ALLOWLIST;
  const allowHandles = new Set([...(opts.allowHandles ?? [])].map((h) => h.toLowerCase().replace(/^@/, "")));
  const base = normalizeForContact(text);
  const out: ContactMatch[] = [];

  const noEmails = findEmails(base, out);
  const noLinks = findLinks(noEmails, allowlist, out);
  findHandles(noLinks, allowHandles, out);
  findPhones(noLinks, noLinks, out);
  findApps(letterForms(noLinks), out);

  const seen = new Set<string>();
  return out.filter((m) => {
    const key = `${m.kind}\u0000${m.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** True when `text` carries any contact detail. */
export function hasContactPatterns(text: string | null | undefined, opts: ContactOptions = {}): boolean {
  return !!text && findContactPatterns(text, opts).length > 0;
}

/** The distinct kinds found, in a fixed order. */
export function contactKinds(matches: readonly ContactMatch[]): ContactKind[] {
  const order: ContactKind[] = ["link", "handle", "email", "phone", "contact_app", "contact_phrase"];
  const found = new Set(matches.map((m) => m.kind));
  return order.filter((k) => found.has(k));
}
