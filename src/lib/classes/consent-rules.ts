/**
 * Live classes: the pure rules behind the age screen and the parent OK
 * (classes-design.md sections 5 and 5.1).
 *
 * No imports and no `server-only`, so the age form (a client component) can
 * build its selects from here and `node --test` can run every rule
 * (consent-rules.test.ts). The database side lives in
 * src/lib/app/class-consent.ts, which uses these.
 */

/* ── Cookies ───────────────────────────────────────────────────────── */

/**
 * The cookie the parent link leaves (section 5.1): the emailed token, so the
 * token never sits in a page URL. Scoped to /classes/parent, an hour long.
 */
export const PARENT_COOKIE = "lf_parent";
export const PARENT_COOKIE_PATH = "/classes/parent";
export const PARENT_COOKIE_SECONDS = 60 * 60;

/** How long the under-13 cookie (lf_cls_age=u13) stays on a device. */
export const UNDER_13_COOKIE_SECONDS = 365 * 24 * 60 * 60;

/* ── The age screen ────────────────────────────────────────────────── */

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** The year select's options, newest first: this year back 100 (section 5). */
export function birthYearOptions(now: Date = new Date()): number[] {
  const thisYear = now.getUTCFullYear();
  return Array.from({ length: 101 }, (_, i) => thisYear - i);
}

/** "March 2011", for the confirm step. */
export function monthYearLabel(birthMonth: number, birthYear: number): string {
  const name = MONTH_NAMES[birthMonth - 1];
  return name ? `${name} ${birthYear}` : `${birthYear}`;
}

/**
 * A form value as a whole number, or null. Only plain digit strings count,
 * so "3.5", "1e3" and " 7" never slip through as numbers.
 */
export function wholeNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isInteger(raw) ? raw : null;
  if (typeof raw !== "string" || !/^\d{1,4}$/.test(raw)) return null;
  return Number(raw);
}

/* ── Parent email addresses ────────────────────────────────────────── */

/** Trimmed and lowercased, the way class_parent_consents stores it. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * A plausible address: one @, something before it, a dotted domain after it,
 * no spaces, within the lengths mail servers accept. Deliverability is
 * Resend's question; this only stops typos and junk.
 */
export function isEmailAddress(raw: string): boolean {
  const email = normalizeEmail(raw);
  if (email.length < 6 || email.length > 254) return false;
  const m = /^([^\s@]+)@([^\s@]+)$/.exec(email);
  if (!m) return false;
  const [, local, domain] = m;
  if (local.length > 64) return false;
  if (!/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local)) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  if (!labels.every((l) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l))) return false;
  return /^[a-z]{2,}$/.test(labels[labels.length - 1]);
}

/**
 * The mailbox an address delivers to, for the "not your own address" rule:
 * lowercased, without a +tag, and for Gmail without dots (Gmail ignores
 * both), so "Sam.Lee+mom@gmail.com" is the same mailbox as "samlee@gmail.com".
 */
export function mailboxKey(raw: string): string {
  const email = normalizeEmail(raw);
  const at = email.lastIndexOf("@");
  if (at < 0) return email;
  let local = email.slice(0, at);
  let domain = email.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

/** True when both addresses deliver to the same mailbox (mailboxKey). */
export function sameMailbox(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return mailboxKey(a) === mailboxKey(b);
}

/**
 * How long before the same address can be emailed again ("Resend in 24
 * hours"), in milliseconds; 0 when it can go now. A different address can go
 * at once (a typo has to be fixable), within the daily cap.
 */
export function resendWaitMs(lastSentAt: Date, now: Date, resendAfterHours: number): number {
  const ready = lastSentAt.getTime() + resendAfterHours * 60 * 60 * 1000;
  return Math.max(0, ready - now.getTime());
}

/** "about 23 hours", "about an hour", "a few minutes": for resendWaitMs. */
export function roughWait(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes <= 10) return "a few minutes";
  if (minutes < 60) return `about ${Math.round(minutes / 5) * 5} minutes`;
  const hours = Math.round(minutes / 60);
  return hours <= 1 ? "about an hour" : `about ${hours} hours`;
}

/* ── The emailed token ─────────────────────────────────────────────── */

/** 32 random bytes as base64url: exactly 43 characters from that alphabet. */
export function isParentTokenShape(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

/* ── The parent's decision ─────────────────────────────────────────── */

export type ParentDecision = "agree" | "decline";

export function parentDecision(raw: unknown): ParentDecision | null {
  return raw === "agree" || raw === "decline" ? raw : null;
}

/**
 * The name a parent types: trimmed, inner spaces collapsed, 2 to 80
 * characters, at least one letter, and nothing that reads as a link, an
 * address or markup. Null when it doesn't pass.
 */
export function cleanParentName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 80) return null;
  if (!/\p{L}/u.test(name)) return null;
  if (/[<>@]|https?:|www\./i.test(name)) return null;
  return name;
}

/* ── Where to go after the steps ───────────────────────────────────── */

/**
 * The page to send someone back to once they're ready (`?next=`), when it's
 * a classes page on this site. Anything else (another origin, the consent
 * pages themselves, a protocol-relative path) comes back null.
 */
export function safeClassesNext(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 200) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  if (!/^\/(?:classes(?:\/[A-Za-z0-9_-]+)*|apply\/teach)\/?(?:[?#].*)?$/.test(raw)) return null;
  if (/^\/classes\/(?:ready|parent)(?:[/?#]|$)/.test(raw)) return null;
  return raw;
}
