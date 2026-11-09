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
 * The text is normalized first (Unicode NFKC, invisible characters removed,
 * ideographic full stops read as dots, Cyrillic and Greek letters that look
 * Latin folded to Latin, lowercase). App names and phrases are also matched
 * after undoing common letter-for-digit swaps ("d1scord", "sn@p") and
 * spaced-out letters ("d i s c o r d"), and emails and domains after
 * spelled-out "at" and "dot" and spaced-out characters. A link to an allowed
 * site still has its path and query scanned, so "learnfrc.com/login?next=//t.me/x"
 * is caught.
 *
 * One message at a time can't see a detail split across several; the chat
 * filter (./chat-filter.ts, checkChatSequence) runs this on the sender's last
 * few messages joined together too.
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

/**
 * Every character that draws nothing: format characters (zero-width spaces
 * and joiners, direction marks and isolates, tag characters, invisible
 * musical formatting), the other default-ignorable ones (variation selectors,
 * Hangul fillers) and the blank Braille pattern.
 */
const INVISIBLE = /[\p{Default_Ignorable_Code_Point}\p{Cf}⠀]/gu;
const DASHES = /[‐-―−﹘﹣－]/g;
/** Ideographic and halfwidth full stops, which browsers read as a dot in a URL. */
const IDEOGRAPHIC_DOTS = /[。．｡]/g;

/**
 * Cyrillic and Greek letters (and a few Latin variants) that look like Latin
 * ones, so "ѕnapchat" (Cyrillic s) and "discοrd" (Greek o) read as the app
 * names they're drawn to look like. Both cases are listed, since this runs
 * before lowercasing (Greek capital eta looks like H, its lowercase like n).
 */
const CONFUSABLES: Record<string, string> = {
  // Cyrillic capitals
  А: "a", В: "b", Е: "e", К: "k", М: "m", Н: "h", О: "o", Р: "p", С: "c", Т: "t", Х: "x", У: "y",
  Ѕ: "s", І: "i", Ї: "i", Ј: "j", Ԁ: "d", Һ: "h", Ӏ: "l", Ү: "y", Ԛ: "q", Ԝ: "w", Ё: "e",
  // Cyrillic small letters
  а: "a", в: "b", е: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", х: "x", у: "y",
  ѕ: "s", і: "i", ї: "i", ј: "j", ԁ: "d", һ: "h", ӏ: "l", ү: "y", ԛ: "q", ԝ: "w", ё: "e",
  // Greek capitals
  Α: "a", Β: "b", Ε: "e", Ζ: "z", Η: "h", Ι: "i", Κ: "k", Μ: "m", Ν: "n", Ο: "o", Ρ: "p", Τ: "t",
  Υ: "y", Χ: "x",
  // Greek small letters
  α: "a", β: "b", γ: "y", ε: "e", η: "n", ι: "i", κ: "k", μ: "u", ν: "v", ο: "o", ρ: "p", τ: "t",
  υ: "u", χ: "x", ω: "w", ϲ: "c",
  // Latin variants
  ɑ: "a", ɡ: "g", ı: "i", ȷ: "j", ɩ: "i", ʋ: "v",
};
const CONFUSABLE = new RegExp(`[${Object.keys(CONFUSABLES).join("")}]`, "g");

/**
 * NFKC, invisible characters removed, ideographic full stops as dots, every
 * dash a hyphen, lookalike letters folded to Latin, lowercase.
 */
export function normalizeForContact(text: string): string {
  return text
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .replace(IDEOGRAPHIC_DOTS, ".")
    .replace(DASHES, "-")
    .replace(CONFUSABLE, (c) => CONFUSABLES[c] ?? c)
    .toLowerCase();
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

/** decodeURIComponent, or the text as it was when it isn't valid percent-encoding. */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function findBareDomains(text: string, allowlist: readonly string[], out: ContactMatch[]) {
  for (const form of new Set([text, spellDots(text)])) {
    for (const m of form.matchAll(BARE_DOMAIN)) {
      const host = m[0];
      const tld = host.slice(host.lastIndexOf(".") + 1);
      if (!LINK_TLDS.has(tld)) continue;
      if (!isAllowedHost(host, allowlist)) out.push({ kind: "link", text: host });
    }
  }
}

/**
 * Finds links and blanks them out. Returns the text without them, plus the
 * allowed links themselves (scheme dropped, path and query kept, as written
 * and percent-decoded once). The caller runs the app pass on those too, and
 * the bare-domain pass already ran on them here, so a link to an allowed site
 * can't carry another one in its query ("learnfrc.com/login?next=//t.me/x").
 */
function findLinks(base: string, allowlist: readonly string[], out: ContactMatch[]): { rest: string; allowed: string[] } {
  const allowed: string[] = [];
  // Scheme links first; blank them out so the bare-domain pass doesn't see
  // their host a second time.
  let rest = base.replace(SCHEME_URL, (m) => {
    const url = m.replace(/[.,;:!?)\]]+$/, "");
    const host = hostOf(url);
    if (!host || !isAllowedHost(host, allowlist)) out.push({ kind: "link", text: url });
    else {
      const tail = url.replace(/^[a-z]+:\/\//, "");
      allowed.push(tail);
      const decoded = safeDecode(tail);
      if (decoded !== tail) allowed.push(normalizeForContact(decoded));
    }
    return " ".repeat(m.length);
  });
  rest = rest.replace(WWW_URL, (m) => {
    if (!isAllowedHost(m, allowlist)) out.push({ kind: "link", text: m });
    return " ".repeat(m.length);
  });
  findBareDomains(rest, allowlist, out);
  // Each allowed link on its own: its own host passes, anything else in it doesn't.
  for (const a of allowed) findBareDomains(a, allowlist, out);
  return { rest, allowed };
}

/* ── Emails ────────────────────────────────────────────────────────── */

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.([a-z]{2,24})\b/g;
const MAIL_PROVIDERS = /[a-z0-9._%+-]{2,}@(?:gmail|googlemail|yahoo|outlook|hotmail|icloud|aol|protonmail|proton|gmx)\b/g;

/**
 * Runs of four or more single characters with spaces between them, closed up:
 * "m a y a @ g m a i l . c o m" becomes "maya@gmail.com".
 */
function collapseSpacedChars(s: string): string {
  return s.replace(/(?<!\S)(?:[a-z0-9@._+-]\s+){3,}[a-z0-9@._+-](?!\S)/g, (m) => m.replace(/\s+/g, ""));
}

/** Spaces around "@" and a dot before a word closed up: "sam @ gmail . com". */
function closeEmailGaps(s: string): string {
  return s.replace(/\s*@\s*/g, "@").replace(/(?<=[a-z0-9])\s*\.\s*(?=[a-z])/g, ".");
}

/** Finds emails and blanks them out, so their "@" isn't read as a handle. */
function findEmails(base: string, out: ContactMatch[]): string {
  const blank = (s: string) => " ".repeat(s.length);
  // A real "@": any TLD counts.
  const rest = base.replace(EMAIL, (m) => {
    out.push({ kind: "email", text: m });
    return blank(m);
  });
  // Spelled out: "sam at gmail dot com", "sam (at) school [dot] org", "sam at
  // gmail"; spaced out: "s a m @ g m a i l . c o m", "sam @ gmail . com".
  // These need a known TLD or mail provider, since they're guesses.
  const spelled = spellAts(spellDots(rest));
  const loose = new Set([spelled, closeEmailGaps(collapseSpacedChars(spelled))]);
  for (const form of loose) {
    if (form !== rest) {
      for (const m of form.matchAll(EMAIL)) {
        if (LINK_TLDS.has(m[1])) out.push({ kind: "email", text: m[0] });
      }
    }
    for (const m of form.matchAll(MAIL_PROVIDERS)) out.push({ kind: "email", text: m[0] });
  }
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

const PHONE_CANDIDATE = /(?<![\w.])\+?\(?\d[\d\s().\-/_*,]*\d(?![\w]|\.\d)/g;
/** Ten or eleven digits stuck to letters or an underscore: "maya2025550143". */
const PHONE_IN_WORD = /(?<=[a-z_])\d{10,11}(?!\d)/g;

function groupsOf(s: string): number[] {
  return s
    .split(/[^\d]+/)
    .filter(Boolean)
    .map((g) => g.length);
}

const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const PHONE_SHAPES = [[3, 4], [3, 3, 4], [1, 3, 3, 4], [1, 3, 4]];

function isPhoneCandidate(raw: string): boolean {
  const c = raw.trim().replace(/[\s,]+$/, "");
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
  // Thousands written with commas (1,000,000,000) aren't phone numbers.
  if (/,/.test(seps) && /^[,\s]+$/.test(seps) && groups[0] <= 3 && groups.slice(1).every((g) => g === 3)) return false;
  // Ten or eleven digits in up to four groups is a phone number whatever
  // splits it: "202 5550143", "20255 50143", "202/555/0143", "202_555_0143".
  if ((digits.length === 10 || digits.length === 11) && groups.length <= 4) return true;
  if (/-/.test(seps)) {
    // Dates (2026-11-08, 11-08-2026) aren't phone numbers.
    if (same(groups, [4, 2, 2]) || same(groups, [2, 2, 4]) || same(groups, [2, 2, 2])) return false;
    return true;
  }
  // Slashes, underscores, stars and commas count only in the rule above, so
  // lists like "IDs 1,2,3,4,5,6,7" and dates like 11/08/2026 pass.
  if (/[/_*,]/.test(seps)) return false;
  // Spaces only.
  if (groups.every((g) => g === 1)) return groups.length >= 7; // "2 0 2 5 5 5 0"
  if (PHONE_SHAPES.some((s) => same(groups, s))) return true;
  return digits.length >= 10 && groups.every((g) => g <= 4);
}

const DIGIT_WORDS: Record<string, string> = {
  zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9", niner: "9",
  ten: "10", eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15",
  sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19",
  hundred: "00",
};

/** Twenty to ninety: one digit, then the unit after it ("seventy one" is 71) or 0. */
const TENS_WORDS: Record<string, string> = {
  twenty: "2", thirty: "3", forty: "4", fourty: "4", fifty: "5", sixty: "6", seventy: "7",
  eighty: "8", ninety: "9",
};

const UNIT_WORDS = new Set(["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "niner"]);

/**
 * Runs of 7+ digits where at least one is spelled out: "two zero two ...",
 * "two oh two, five fifty five, oh one forty three".
 */
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
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (TENS_WORDS[t] !== undefined) {
      const next = tokens[i + 1];
      if (next && UNIT_WORDS.has(next)) {
        run.push(TENS_WORDS[t] + DIGIT_WORDS[next]);
        i++;
      } else {
        run.push(`${TENS_WORDS[t]}0`);
      }
      spelled = true;
    } else if (DIGIT_WORDS[t] !== undefined && !(t === "oh" && run.length === 0) && !(t === "hundred" && run.length === 0)) {
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
    // A comma with a space beside it separates a list ("teams 5835, 254,
    // 1678"), so each item is looked at on its own; a bare comma
    // ("202,555,0143") stays part of the number.
    for (const piece of m[0].split(/\s*,\s+|\s+,\s*/)) {
      if (isPhoneCandidate(piece)) out.push({ kind: "phone", text: piece.trim() });
    }
  }
  for (const m of text.matchAll(PHONE_IN_WORD)) out.push({ kind: "phone", text: m[0] });
  findSpelledPhones(base, out);
}

/* ── Other apps and "take it private" phrases ──────────────────────── */

/** "my", "your", "on" and the like before an app name: "my snap", "on signal". */
const POSSESSIVE = String.raw`\b(?:my|your|ur|yr|on|via|thru|through)\s+`;
/** The start of a message or sentence, for short "x: name" forms ("dc: maya"). */
const LEAD = String.raw`(?:^|[.!?]\s*)`;
/** Words after "signal" or "dc" that make it robotics: "my signal wire", "your DC motor". */
const ELECTRICAL =
  String.raw`(?!\s+(?:wire|wires|wiring|pin|pins|line|lines|cable|cables|port|ports|ground|light|lights|led|leds|strength|loss|noise|generator|level|levels|path|chain|processing|conditioning|integrity|timing|voltage|volts|current|power|motor|motors|bus|supply|input|output|side|jack|brushed|brushless|offset|gain|component|circuit|signal)\b)`;

const CONTACT_APPS: RegExp[] = [
  /\bdiscord(?:app)?\b/,
  /\bsnapchat\b/,
  /\bsnap\s*(?::|me\b|username\b|handle\b|name\b|id\b|account\b|code\b)/,
  new RegExp(`${POSSESSIVE}snap\\b`),
  // "snap maya_42": snap and a name with a digit or underscore in it.
  /\bsnap\s+[a-z][a-z0-9_.]*[0-9_][a-z0-9_.]*/,
  /\binsta(?:gram)?\b/,
  /\big\b/,
  /\btelegram\b/,
  new RegExp(`${POSSESSIVE}tele\\b`),
  /\bwhats\s?app\b/,
  /\bkik\b/,
  /\btik\s?tok\b/,
  /\broblox\b/,
  /\bfacebook\b/,
  new RegExp(`${POSSESSIVE}fb\\b`),
  /\bmessenger\b/,
  /\btwitter\b/,
  /\bface\s?time\b/,
  /\bimessage\b/,
  /\bgroupme\b/,
  /\bwechat\b/,
  /\bline\s+id\b/,
  /\bskype\b/,
  new RegExp(`${POSSESSIVE}steam\\b`),
  // Signal is also everyday robotics ("PWM signal", "signal wire"), so only
  // as an app: "signal: maya" to start a message, "on signal", "signal me".
  new RegExp(`${LEAD}signal\\s*[:=]`),
  new RegExp(
    `${POSSESSIVE}signal\\b${ELECTRICAL}(?!\\s+(?:is|was|keeps|kept)\\s+(?:weak|bad|low|noisy|dropping|cutting|lost|gone|fine|good|ok|okay|strong)\\b)`
  ),
  /\bsignal\s+me\b/,
  /\breddit\s*[:=]/,
  new RegExp(`${POSSESSIVE}reddit\\b`),
  // A Reddit username, but not a LearnFRC profile path (learnfrc.com/u/maya).
  /(?:^|\s)\/?u\/[a-z0-9_-]{3,}/,
  // Discord and Snapchat by their short names: "dc: maya_42", "my sc is maya".
  new RegExp(`${LEAD}(?:dc|sc)\\s*[:=]\\s*@?[a-z][a-z0-9_.]{2,}`),
  new RegExp(`\\b(?:my|your|ur|yr)\\s+(?:dc|sc)\\b${ELECTRICAL}`),
];

const CONTACT_PHRASES: RegExp[] = [
  /\bd\s?m\s+me\b/,
  /\bd\.\s?m\.?\s*me\b/,
  /\b(?:my|your|ur)\s+dms?\b/,
  /\bdms?\s+(?:are\s+|r\s+)?open\b/,
  /\b(?:pls|plz|please)\s+dm\b/,
  /\bp\s?m\s+me\b/,
  /\bmessage\s+me\b/,
  /\bmsg\s+me\b/,
  /\binbox\s+me\b/,
  /\btext\s+me\b/,
  /\bcall\s+me\s+(?:at|on)\b/,
  /\breach\s+me\s+(?:at|on|via)\b/,
  /\badd\s+me\b/,
  /\bmy\s+(?:phone\s+|cell\s+)?number\b(?!\s+one\b)/,
  // Asking for someone else's: "send me your number", "whats ur phone #".
  /\b(?:your|ur|yr)\s+(?:phone\s+|cell\s+)?(?:number\b|#)(?!\s*(?:of|one)\b)/,
  /\bmy\s+e-?mail\b/,
  /\b(?:your|ur|yr)\s+e-?mail\b(?!\s+(?:for|inbox)\b)/,
  /\be-?mail\s+me\b/,
  new RegExp(`${POSSESSIVE}(?:gmail|hotmail|outlook|yahoo|icloud|proton(?:mail)?)\\b`),
  /\bmy\s+socials?\b/,
  /\bfollow\s+me\s+on\b/,
  /\bhmu\b/,
  /\bhit\s+me\s+up\b/,
];

/** App names written with a symbol for a letter, which aren't caught as plain words ("sn@p", "5nap"). */
const LEET_ONLY_WORDS = new Set(["snap"]);

function findLeetWords(base: string, out: ContactMatch[]) {
  for (const token of base.split(/\s+/)) {
    if (!/[a-z]/.test(token) || !/[0134578@$!|+9]/.test(token)) continue;
    for (const form of unLeet(token)) {
      const word = form.replace(/^[^a-z]+|[^a-z]+$/g, "");
      if (LEET_ONLY_WORDS.has(word)) {
        out.push({ kind: "contact_app", text: token });
        return;
      }
    }
  }
}

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
  const { rest: noLinks, allowed } = findLinks(noEmails, allowlist, out);
  findHandles(noLinks, allowHandles, out);
  findPhones(noLinks, noLinks, out);
  // App names and phrases in the text, and in the path or query of an allowed link.
  findApps(letterForms([noLinks, ...allowed].join("\n")), out);
  findLeetWords(noLinks, out);

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

/**
 * True when a username works as a standing contact detail (section 4):
 * everyone in a class sees each other's full username, so "snapchat_maya",
 * "dm_me_maya" or "maya2025550143" would hand out a way to reach them in
 * every class. Underscores read as spaces (they'd hide the word boundaries
 * the patterns need), and any run of 7 or more digits counts.
 */
export function usernameHasContact(username: string | null | undefined): boolean {
  const u = (username ?? "").trim().toLowerCase();
  if (!u) return false;
  if (/\d{7,}/.test(u)) return true;
  return findContactPatterns(u.replace(/_+/g, " ")).length > 0;
}

/** The distinct kinds found, in a fixed order. */
export function contactKinds(matches: readonly ContactMatch[]): ContactKind[] {
  const order: ContactKind[] = ["link", "handle", "email", "phone", "contact_app", "contact_phrase"];
  const found = new Set(matches.map((m) => m.kind));
  return order.filter((k) => found.has(k));
}
