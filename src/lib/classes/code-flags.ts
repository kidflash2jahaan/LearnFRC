/**
 * Code flags for a class review (classes-design.md section 7.2).
 *
 * Facts the review measures with code, before and regardless of the model:
 * contact details said aloud, what the chat filter stopped, an adult in the
 * room, one-on-one time, cameras and screen shares, duplicate connections,
 * shared networks, new accounts, removals, reports, and a missing or thin
 * transcript. They go in class_reviews.code_flags, in the model's input as
 * facts (never as text to obey), and in the notes email.
 *
 * Any flag above `note` makes the verdict at least `needs_review`; any
 * `urgent` one makes it `urgent` (codeVerdict). The model can add to that but
 * never lower it (stricterVerdict).
 *
 * A flag never carries the words someone said or typed: only kinds, counts and
 * when. Quotes live on the review page, behind sign-in.
 *
 * Pure: imports only the Foundation's pure modules (relative, with .ts
 * extensions) so `node --test` runs it (code-flags.test.ts).
 */

import {
  SPOKEN_LINK_ALLOWLIST,
  contactKinds,
  findContactPatterns,
  type ContactKind,
} from "./contact-patterns.ts";
import { toMs, totalMs, unionIntervals, type AttendanceSpan, type Interval, type TimeInput } from "./minutes.ts";
import type { AgeBand, ClassRole, ReviewVerdict } from "./types.ts";

/* ── Shapes ────────────────────────────────────────────────────────── */

/** `info` is lighter than `note`: a measurement worth showing, nothing more. */
export type FlagSeverity = "urgent" | "check" | "note" | "info";

export type CodeFlagKind =
  | "contact_pattern"
  | "chat_blocked"
  | "adult_present"
  | "under_13_present"
  | "one_on_one"
  | "camera_minutes"
  | "screenshare_minutes"
  | "duplicate_peer"
  | "shared_network"
  | "parent_same_network"
  | "new_accounts"
  | "removed_participant"
  | "report_filed"
  | "no_transcript"
  | "short_transcript";

export type CodeFlag = {
  kind: CodeFlagKind;
  severity: FlagSeverity;
  /** The person it's about, when it's about one. */
  userId: string | null;
  username: string | null;
  role: ClassRole | null;
  /** Seconds from the class's reference time, when it has a moment. */
  atSeconds: number | null;
  count: number;
  /** Plain words, never a quote of what was said or typed. */
  detail: string;
  /** Contact or chat kinds, for contact_pattern and chat_blocked. */
  kinds?: string[];
  /** Everyone involved, for flags about more than one person. */
  userIds?: string[];
};

/** One person who was in the class, as the review knows them. */
export type ReviewPerson = {
  userId: string;
  username: string | null;
  role: ClassRole;
  /** At class time; null for staff or a missing age answer. */
  ageBand: AgeBand | null;
  /** The smallest account age at any of their joins. */
  accountAgeDays: number | null;
};

export type ReviewTranscriptLine = {
  /** Seconds from the class's reference time. */
  atSeconds: number;
  userId: string | null;
  role: ClassRole | null;
  text: string;
};

export type ReviewChatLine = {
  atSeconds: number;
  userId: string | null;
  role: ClassRole;
  status: "shown" | "blocked";
  blockedKinds: string[];
  body: string;
};

export type MediaEventInput = {
  subjectUserId: string | null;
  kind: "camera" | "screenshare";
  isOn: boolean;
  at: TimeInput;
  reportedBy: string | null;
};

/** Minutes per user id. */
export type MediaMinutes = { camera: Record<string, number>; screenshare: Record<string, number> };

export type CodeFlagInput = {
  people: readonly ReviewPerson[];
  attendance: readonly AttendanceSpan[];
  startsAt: TimeInput;
  hardEndAt: TimeInput;
  durationMinutes: number;
  transcript: readonly ReviewTranscriptLine[];
  /** Whether any transcript exists for the class. */
  hasTranscript: boolean;
  /** True once 30 minutes have passed since the end with no transcript. */
  noTranscriptDue: boolean;
  wordCount: number;
  chat: readonly ReviewChatLine[];
  media: MediaMinutes;
  duplicatePeerUserIds: readonly string[];
  removedUserIds: readonly string[];
  reports: readonly { reportedUserId: string | null; reportedUsername: string | null; reason: string }[];
  /** class_consents.ip_hash per join (recording notices for this class). */
  networkHashes: readonly { userId: string; ipHash: string }[];
  /** Students whose parent OK was decided from the request's own network. */
  parentSameNetworkUserIds: readonly string[];
  minStudentAccountDays: number;
};

/* ── Small helpers ─────────────────────────────────────────────────── */

const SEVERITY_RANK: Record<FlagSeverity, number> = { urgent: 3, check: 2, note: 1, info: 0 };
const VERDICT_RANK: Record<ReviewVerdict, number> = { looks_fine: 0, needs_review: 1, urgent: 2 };

/** Contact details proper: what moves a conversation off LearnFRC. */
const CONTACT_DETAIL_KINDS = new Set(["handle", "email", "phone", "contact_app", "contact_phrase"]);

export function severityRank(s: FlagSeverity): number {
  return SEVERITY_RANK[s];
}

/** "12:31", or "1:02:03" past an hour. Negative times read as 0:00. */
export function clock(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.floor(seconds ?? 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** "00:03:12", the transcript's timestamp format in the model's input. */
export function longClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

const at = (p: ReviewPerson | undefined) => (p?.username ? `@${p.username}` : "someone");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Readable names for contact and chat kinds. */
export const KIND_WORDS: Record<string, string> = {
  link: "a link",
  handle: "an @handle",
  email: "an email address",
  phone: "a phone number",
  contact_app: "another app's name",
  contact_phrase: "a private-contact phrase",
  profanity: "profanity",
};

function kindList(kinds: readonly string[]): string {
  const words = kinds.map((k) => KIND_WORDS[k] ?? k);
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/* ── Interval measures ─────────────────────────────────────────────── */

function spanEnd(span: AttendanceSpan, hardEndMs: number): number {
  if (span.leftAt != null) return toMs(span.leftAt);
  if (span.sessionEndedAt != null) return toMs(span.sessionEndedAt);
  return hardEndMs;
}

/**
 * Milliseconds with the teacher in the room, exactly one student, and no
 * staff. Each person's own spans are unioned first, so a second tab doesn't
 * count as a second student.
 */
export function oneOnOneMs(attendance: readonly AttendanceSpan[], hardEndAt: TimeInput): number {
  const hardEndMs = toMs(hardEndAt);
  const byPerson = new Map<string, { role: ClassRole; intervals: Interval[] }>();
  attendance.forEach((s, i) => {
    const key = s.userId ?? `anon-${i}`;
    const entry = byPerson.get(key) ?? { role: s.role, intervals: [] };
    entry.intervals.push({ start: toMs(s.joinedAt), end: spanEnd(s, hardEndMs) });
    byPerson.set(key, entry);
  });
  const events: { t: number; d: number; role: ClassRole }[] = [];
  for (const { role, intervals } of byPerson.values()) {
    for (const iv of unionIntervals(intervals)) {
      events.push({ t: iv.start, d: 1, role }, { t: iv.end, d: -1, role });
    }
  }
  // Leaves before joins at the same instant.
  events.sort((a, b) => a.t - b.t || a.d - b.d);
  const count: Record<ClassRole, number> = { teacher: 0, student: 0, staff: 0 };
  let total = 0;
  let last = events.length ? events[0].t : 0;
  for (const e of events) {
    if (count.teacher > 0 && count.student === 1 && count.staff === 0) total += e.t - last;
    count[e.role] += e.d;
    last = e.t;
  }
  return total;
}

/**
 * Camera and screen-share minutes per person (section 6.7). Every browser in
 * the room reports what it sees; each reporter's on/off pairs become
 * intervals, and the reporters are unioned per person, so one tampered
 * browser can't hide anything. An interval left on closes at `closeAt`.
 * Minutes round up, so 20 seconds of a student's camera still shows.
 */
export function mediaMinutesFromEvents(events: readonly MediaEventInput[], closeAt: TimeInput): MediaMinutes {
  const closeMs = toMs(closeAt);
  const streams = new Map<string, { kind: "camera" | "screenshare"; subject: string; events: { t: number; on: boolean }[] }>();
  for (const e of events) {
    if (!e.subjectUserId) continue;
    const key = `${e.kind}|${e.subjectUserId}|${e.reportedBy ?? "?"}`;
    const s = streams.get(key) ?? { kind: e.kind, subject: e.subjectUserId, events: [] };
    s.events.push({ t: toMs(e.at), on: e.isOn });
    streams.set(key, s);
  }
  const perSubject = new Map<string, Interval[]>();
  for (const s of streams.values()) {
    s.events.sort((a, b) => a.t - b.t);
    let onSince: number | null = null;
    const list = perSubject.get(`${s.kind}|${s.subject}`) ?? [];
    for (const e of s.events) {
      if (e.on && onSince === null) onSince = e.t;
      else if (!e.on && onSince !== null) {
        list.push({ start: onSince, end: e.t });
        onSince = null;
      }
    }
    if (onSince !== null && closeMs > onSince) list.push({ start: onSince, end: closeMs });
    perSubject.set(`${s.kind}|${s.subject}`, list);
  }
  const out: MediaMinutes = { camera: {}, screenshare: {} };
  for (const [key, list] of perSubject) {
    const [kind, subject] = key.split("|") as ["camera" | "screenshare", string];
    const ms = totalMs(list);
    if (ms > 0) out[kind][subject] = Math.ceil(ms / 60_000);
  }
  return out;
}

/* ── The flags ─────────────────────────────────────────────────────── */

/** Contact details said aloud, one flag per person (staff aren't scanned). */
function transcriptContactFlags(input: CodeFlagInput, people: Map<string, ReviewPerson>): CodeFlag[] {
  const roster = input.people.map((p) => p.username).filter((u): u is string => !!u);
  const found = new Map<string, { kinds: Map<ContactKind, number>; first: number; role: ClassRole | null }>();
  for (const line of input.transcript) {
    if (line.role === "staff") continue;
    const matches = findContactPatterns(line.text, { allowlist: SPOKEN_LINK_ALLOWLIST, allowHandles: roster });
    if (matches.length === 0) continue;
    const key = line.userId ?? "unknown";
    const entry = found.get(key) ?? { kinds: new Map(), first: line.atSeconds, role: line.role };
    for (const k of contactKinds(matches)) {
      entry.kinds.set(k, (entry.kinds.get(k) ?? 0) + matches.filter((m) => m.kind === k).length);
    }
    entry.first = Math.min(entry.first, line.atSeconds);
    found.set(key, entry);
  }
  const flags: CodeFlag[] = [];
  for (const [userId, f] of found) {
    const person = people.get(userId);
    const role = person?.role ?? f.role;
    const kinds = [...f.kinds.keys()];
    const count = [...f.kinds.values()].reduce((a, b) => a + b, 0);
    const contact = kinds.some((k) => CONTACT_DETAIL_KINDS.has(k));
    flags.push({
      kind: "contact_pattern",
      severity: role === "teacher" && contact ? "urgent" : "check",
      userId: person?.userId ?? null,
      username: person?.username ?? null,
      role,
      atSeconds: f.first,
      count,
      kinds,
      detail: `${at(person)} said ${kindList(kinds)} aloud${count > 1 ? ` (${plural(count, "time")})` : ""}`,
    });
  }
  return flags;
}

/** What the chat filter stopped, per person and kind. */
function chatBlockedFlags(input: CodeFlagInput, people: Map<string, ReviewPerson>): CodeFlag[] {
  const byPerson = new Map<string, { kinds: Map<string, number>; first: number; role: ClassRole }>();
  for (const m of input.chat) {
    if (m.status !== "blocked") continue;
    const key = m.userId ?? "unknown";
    const entry = byPerson.get(key) ?? { kinds: new Map(), first: m.atSeconds, role: m.role };
    for (const k of m.blockedKinds.length ? m.blockedKinds : ["link"]) {
      entry.kinds.set(k, (entry.kinds.get(k) ?? 0) + 1);
    }
    entry.first = Math.min(entry.first, m.atSeconds);
    byPerson.set(key, entry);
  }
  const flags: CodeFlag[] = [];
  for (const [userId, f] of byPerson) {
    const person = people.get(userId);
    const role = person?.role ?? f.role;
    const kinds = [...f.kinds.keys()];
    const contact = kinds.some((k) => CONTACT_DETAIL_KINDS.has(k));
    const messages = input.chat.filter((m) => m.status === "blocked" && (m.userId ?? "unknown") === userId).length;
    const severity: FlagSeverity =
      !contact || role === "staff" ? "note" : role === "teacher" ? "urgent" : "check";
    flags.push({
      kind: "chat_blocked",
      severity,
      userId: person?.userId ?? null,
      username: person?.username ?? null,
      role,
      atSeconds: f.first,
      count: messages,
      kinds,
      detail: `the chat filter stopped ${plural(messages, "message")} from ${at(person)} with ${kindList(kinds)}`,
    });
  }
  return flags;
}

/** Every code flag for a class, most severe first. */
export function computeCodeFlags(input: CodeFlagInput): CodeFlag[] {
  const people = new Map(input.people.map((p) => [p.userId, p]));
  const flags: CodeFlag[] = [];
  const one = (
    kind: CodeFlagKind,
    severity: FlagSeverity,
    person: ReviewPerson | undefined,
    detail: string,
    extra: Partial<CodeFlag> = {}
  ): CodeFlag => ({
    kind,
    severity,
    userId: person?.userId ?? null,
    username: person?.username ?? null,
    role: person?.role ?? null,
    atSeconds: null,
    count: 1,
    detail,
    ...extra,
  });

  flags.push(...transcriptContactFlags(input, people));
  flags.push(...chatBlockedFlags(input, people));

  // Ages. The gate should make both impossible.
  for (const p of input.people) {
    if (p.role === "staff") continue;
    if (p.ageBand === "18+") flags.push(one("adult_present", "urgent", p, `${at(p)} is 18 or older`));
    if (p.ageBand === "under13") flags.push(one("under_13_present", "urgent", p, `${at(p)} is under 13`));
  }

  const oneOnOne = Math.floor(oneOnOneMs(input.attendance, input.hardEndAt) / 60_000);
  if (oneOnOne >= 5) {
    flags.push(
      one("one_on_one", "check", undefined, `${plural(oneOnOne, "minute")} with the teacher and one student, no staff`, {
        count: oneOnOne,
      })
    );
  }

  for (const kind of ["camera", "screenshare"] as const) {
    for (const [userId, minutes] of Object.entries(input.media[kind])) {
      if (minutes <= 0) continue;
      const p = people.get(userId);
      if (p?.role === "staff") continue;
      const student = p?.role !== "teacher";
      const what = kind === "camera" ? "camera" : "screen share";
      flags.push(
        one(kind === "camera" ? "camera_minutes" : "screenshare_minutes", student ? "urgent" : "info", p, `${at(p)} had a ${what} on for ${plural(minutes, "minute")}${student ? " (students can't turn one on)" : ""}`, {
          userId,
          count: minutes,
        })
      );
    }
  }

  for (const userId of new Set(input.duplicatePeerUserIds)) {
    const p = people.get(userId);
    flags.push(one("duplicate_peer", "check", p, `${at(p)} had two live connections at once`, { userId }));
  }

  // Shared networks among non-staff people.
  const byHash = new Map<string, Set<string>>();
  for (const h of input.networkHashes) {
    const p = people.get(h.userId);
    if (!h.ipHash || p?.role === "staff") continue;
    const set = byHash.get(h.ipHash) ?? new Set<string>();
    set.add(h.userId);
    byHash.set(h.ipHash, set);
  }
  for (const ids of byHash.values()) {
    if (ids.size < 2) continue;
    const list = [...ids].sort((a, b) => (people.get(a)?.role === "teacher" ? -1 : people.get(b)?.role === "teacher" ? 1 : 0));
    const lead = people.get(list[0]);
    flags.push(
      one("shared_network", "check", lead, `${list.map((id) => at(people.get(id))).join(", ")} joined from the same network`, {
        userIds: list,
        count: list.length,
      })
    );
  }

  for (const userId of new Set(input.parentSameNetworkUserIds)) {
    const p = people.get(userId);
    if (!p || p.role !== "student") continue;
    flags.push(one("parent_same_network", "check", p, `${at(p)}'s parent OK came from the student's own network`));
  }

  const newStudents = input.people.filter(
    (p) => p.role === "student" && (p.accountAgeDays == null || p.accountAgeDays < input.minStudentAccountDays)
  );
  if (newStudents.length) {
    flags.push(
      one(
        "new_accounts",
        "note",
        undefined,
        `${plural(newStudents.length, "student")} not counted toward teacher minutes (accounts under ${input.minStudentAccountDays} days old)`,
        { count: newStudents.length, userIds: newStudents.map((p) => p.userId) }
      )
    );
  }

  for (const userId of new Set(input.removedUserIds)) {
    const p = people.get(userId);
    flags.push(one("removed_participant", "check", p, `${at(p)} was removed from the class`, { userId }));
  }

  for (const r of input.reports) {
    const p = r.reportedUserId ? people.get(r.reportedUserId) : undefined;
    const who = p?.username ? `@${p.username}` : r.reportedUsername ? `@${r.reportedUsername}` : "someone";
    flags.push(
      one("report_filed", "check", p, `a report about ${who} (${r.reason.replace(/_/g, " ")})`, {
        userId: r.reportedUserId,
        username: p?.username ?? r.reportedUsername,
      })
    );
  }

  if (!input.hasTranscript && input.noTranscriptDue) {
    flags.push(
      one(
        "no_transcript",
        input.reports.length > 0 ? "urgent" : "check",
        undefined,
        input.reports.length > 0
          ? "no transcript came in, and a report was filed about this class"
          : "no transcript came in within 30 minutes of the end"
      )
    );
  }
  if (input.hasTranscript && input.wordCount < 300 && input.durationMinutes > 20) {
    flags.push(
      one("short_transcript", "check", undefined, `the transcript has only ${plural(input.wordCount, "word")} for a ${input.durationMinutes}-minute class`, {
        count: input.wordCount,
      })
    );
  }

  return flags.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}

/* ── Verdicts ──────────────────────────────────────────────────────── */

/** What the code flags alone say: urgent, needs_review (any `check`), or looks_fine. */
export function codeVerdict(flags: readonly { severity: FlagSeverity }[]): ReviewVerdict {
  if (flags.some((f) => f.severity === "urgent")) return "urgent";
  if (flags.some((f) => f.severity === "check")) return "needs_review";
  return "looks_fine";
}

/** The stricter of two verdicts. The model can raise a verdict, never lower it. */
export function stricterVerdict(a: ReviewVerdict, b: ReviewVerdict): ReviewVerdict {
  return VERDICT_RANK[a] >= VERDICT_RANK[b] ? a : b;
}

/**
 * Students the reviewer may leave out of the teacher's minutes in one click:
 * those sharing a network with the teacher or another student, and those
 * whose parent OK came from their own network.
 */
export function flaggedStudentIds(flags: readonly CodeFlag[], people: readonly ReviewPerson[]): string[] {
  const students = new Set(people.filter((p) => p.role === "student").map((p) => p.userId));
  const out = new Set<string>();
  for (const f of flags) {
    if (f.kind === "shared_network") for (const id of f.userIds ?? []) if (students.has(id)) out.add(id);
    if (f.kind === "parent_same_network" && f.userId && students.has(f.userId)) out.add(f.userId);
  }
  return [...out];
}

/** Total camera or screen-share minutes in a class (class_reviews columns). */
export function sumMinutes(perUser: Record<string, number>): number {
  return Object.values(perUser).reduce((a, b) => a + b, 0);
}
