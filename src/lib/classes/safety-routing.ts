/**
 * Who gets what after a class review (classes-design.md section 7.5).
 *
 *   | What happened                                  | Jahaan (owner) | Dhiren (safety lead)        |
 *   | notes, looks_fine or needs_review              | full notes     | nothing                     |
 *   | urgent, not restricted                         | full notes     | full notes, recording link, |
 *   |                                                |                | the playbook                |
 *   | urgent and restricted, or a refusal            | one line       | full notes, recording,      |
 *   |                                                |                | the playbook                |
 *   | restricted, not urgent                         | one line       | full notes, the playbook    |
 *
 * Restricted means grooming, sexual content, sextortion or signs of abuse in
 * the model's flags, a refusal, a student's camera or screen share being on,
 * or a class report with reason `sexual` (review.ts and reports.ts set it).
 * Jahaan is a minor, so those reach him only as "A class needs a safety
 * review. Dhiren has it.", whatever the verdict.
 *
 * Every message: no quotes of anything said or typed (flags are described,
 * never quoted, and quoted text in a description is cut out), the line saying
 * video wasn't reviewed by the AI, and links to the review page rather than
 * to a recording (a recording link is presigned, so anyone holding the email
 * could watch). Approve and Reject only open the page with that choice
 * picked, since mail scanners follow links.
 *
 * Pure: it builds the messages as data. review.ts addresses them
 * (ownerEmail(), and CLASSES_SAFETY_EMAIL for the safety lead) and renders
 * them in the classes email layout. No imports from `@/`, so node --test runs
 * it (safety-routing.test.ts).
 */

import { clock, KIND_WORDS, type CodeFlag } from "./code-flags.ts";
import { modelFlagLine, stripQuoted, type StoredModelFlag } from "./review-prompt.ts";
import type { ReviewVerdict } from "./types.ts";

export type ReviewAudience = "owner" | "safety";

export type Routing = {
  owner: "full" | "one_line";
  safety: "full" | "none";
  urgent: boolean;
};

/** Section 7.5's table. */
export function routeReview(r: { verdict: ReviewVerdict; restricted: boolean; refused: boolean }): Routing {
  if (r.refused || (r.verdict === "urgent" && r.restricted)) return { owner: "one_line", safety: "full", urgent: true };
  // Restricted but not urgent (a "check" grooming flag, a report): still the
  // safety lead's alone, so the owner gets the one line.
  if (r.restricted) return { owner: "one_line", safety: "full", urgent: false };
  if (r.verdict === "urgent") return { owner: "full", safety: "full", urgent: true };
  return { owner: "full", safety: "none", urgent: false };
}

/**
 * Whether a review run leaves the class restricted: what the run found (the
 * model's restricted categories or a refusal), a student's camera or screen
 * share being on (urgent code flags the AI can't judge, since it never sees
 * video), or a restriction already in place. A run never lowers one; only the
 * safety lead's release does (releaseReview, releaseHold).
 */
export function reviewRestricted(input: {
  runRestricted: boolean;
  codeFlags: readonly Pick<CodeFlag, "kind" | "severity">[];
  alreadyRestricted: boolean;
}): boolean {
  const studentMedia = input.codeFlags.some(
    (f) => (f.kind === "camera_minutes" || f.kind === "screenshare_minutes") && f.severity === "urgent"
  );
  return input.runRestricted || studentMedia || input.alreadyRestricted;
}

export const VIDEO_LINE =
  "Video and screen share weren't reviewed by the AI. Camera and screen share minutes are above; watch the recording on the review page if they matter.";

export const DANGER_LINE =
  "If someone may be in danger now, call 911. The 988 Suicide & Crisis Lifeline (call or text 988) can advise you on what to do.";

export const OWNER_RESTRICTED_LINE = "A class needs a safety review. Dhiren has it.";

export type MailButton = { text: string; url: string; tone?: "primary" | "plain" };

/** One message as data. `rows` and every string are plain text (escaped when rendered). */
export type ReviewMail = {
  audience: ReviewAudience;
  subject: string;
  heading: string;
  intro: string | null;
  rows: { label: string; value: string }[];
  /** Section title, then plain-text lines. */
  sections: { title: string; lines: string[] }[];
  notes: string[];
  buttons: MailButton[];
};

export type PersonMinutes = { username: string | null; minutes: number };

export type ReviewMailFacts = {
  classId: string;
  title: string;
  /** "Thu, Nov 20, 5:00 PM PT" */
  whenPacific: string;
  /** "Thu, Nov 20" */
  datePacific: string;
  teacherUsername: string | null;
  firstClass: boolean;
  studentsJoined: number;
  teacherMinutes: number;
  /** "2 sessions, 1,840 words", or "none". */
  transcriptCoverage: string;
  camera: PersonMinutes[];
  screenshare: PersonMinutes[];
  chatBlockedCount: number;
  status: "ready" | "refused" | "no_transcript";
  verdict: ReviewVerdict;
  restricted: boolean;
  summary: string[];
  oneLine: string;
  codeFlags: readonly CodeFlag[];
  modelFlags: readonly StoredModelFlag[];
  /** https://learnfrc.com/admin/classes/<id> */
  reviewUrl: string;
  playbookUrl: string;
};

const VERDICT_WORDS: Record<ReviewVerdict, string> = {
  looks_fine: "looks fine",
  needs_review: "needs a look",
  urgent: "urgent",
};

const CODE_KIND_WORDS: Record<string, string> = {
  contact_pattern: "contact details said aloud",
  chat_blocked: "chat filter",
  adult_present: "adult in the class",
  under_13_present: "under 13 in the class",
  one_on_one: "one-on-one time",
  camera_minutes: "camera",
  screenshare_minutes: "screen share",
  duplicate_peer: "duplicate connection",
  shared_network: "shared network",
  parent_same_network: "parent OK from the same network",
  new_accounts: "new accounts",
  removed_participant: "removed",
  report_filed: "report filed",
  no_transcript: "no transcript",
  short_transcript: "short transcript",
};

/** "[12:31] check, contact details said aloud: @sam said a phone number aloud" */
export function codeFlagLine(f: CodeFlag): string {
  return `${f.atSeconds != null ? `[${clock(f.atSeconds)}] ` : ""}${f.severity}, ${CODE_KIND_WORDS[f.kind] ?? f.kind}: ${f.detail}`;
}

function minutesList(list: readonly PersonMinutes[]): string {
  const parts = list.filter((p) => p.minutes > 0).map((p) => `${p.username ? `@${p.username}` : "someone"} ${p.minutes}`);
  return parts.length ? parts.join(", ") : "none";
}

/** The subject for a review mail (section 7.5). */
export function reviewSubject(f: Pick<ReviewMailFacts, "title" | "datePacific" | "verdict">, urgent: boolean): string {
  if (urgent) return `[Check now] LearnFRC safety: class on ${f.datePacific}`;
  return `LearnFRC class notes: ${f.title} (${f.verdict === "looks_fine" ? "looks fine" : "needs a look"})`;
}

function fullMail(f: ReviewMailFacts, audience: ReviewAudience, routing: Routing): ReviewMail {
  const urgent = routing.urgent;
  const rows = [
    { label: "When", value: f.whenPacific },
    { label: "Teacher", value: f.teacherUsername ? `@${f.teacherUsername}` : "a deleted account" },
    { label: "Teacher's first class", value: f.firstClass ? "yes" : "no" },
    { label: "Students who joined", value: String(f.studentsJoined) },
    { label: "Teacher minutes to credit", value: String(f.teacherMinutes) },
    { label: "Transcript", value: f.transcriptCoverage },
    { label: "Camera minutes", value: minutesList(f.camera) },
    { label: "Screen share minutes", value: minutesList(f.screenshare) },
    { label: "Chat messages the filter stopped", value: String(f.chatBlockedCount) },
    { label: "Verdict", value: VERDICT_WORDS[f.verdict] },
  ];

  let heading: string;
  let intro: string | null;
  if (f.status === "refused") {
    heading = `Claude declined to write notes for "${f.title}".`;
    intro =
      "A refusal on a class transcript usually means the class needs a person to look first. Follow the playbook before reading the transcript.";
  } else if (f.status === "no_transcript") {
    heading = `No transcript came in for "${f.title}".`;
    intro = "The notes are from code checks only. Watch the recording or pull from Cloudflare on the review page.";
  } else {
    heading = urgent ? `A class needs a safety check: "${f.title}".` : `Notes for "${f.title}".`;
    intro = f.oneLine ? stripQuoted(f.oneLine) : null;
  }

  const sections: ReviewMail["sections"] = [];
  if (f.summary.length) sections.push({ title: "What happened", lines: f.summary.map((s) => stripQuoted(s)) });
  const flagLines = [
    ...f.modelFlags.map((m) => modelFlagLine(m, { stripQuotes: true })),
    ...f.codeFlags.filter((c) => c.severity !== "info" || audience === "safety").map(codeFlagLine),
  ];
  sections.push({ title: "Things to check", lines: flagLines.length ? flagLines : ["Nothing flagged."] });

  const notes = [VIDEO_LINE];
  if (f.modelFlags.some((m) => m.category === "self_harm")) notes.unshift(DANGER_LINE);
  if (audience === "safety") notes.push("Quotes and the transcript are only on the review page, behind sign-in.");

  const reviewLink = urgent ? `${f.reviewUrl}#recording` : f.reviewUrl;
  const buttons: MailButton[] = [{ text: "Open the review", url: reviewLink }];
  if (!urgent) {
    buttons.push(
      { text: "Approve", url: `${f.reviewUrl}?decide=approve`, tone: "plain" },
      { text: "Reject", url: `${f.reviewUrl}?decide=reject`, tone: "plain" }
    );
  }
  if (audience === "safety") buttons.push({ text: "The playbook", url: f.playbookUrl, tone: "plain" });

  return { audience, subject: reviewSubject(f, urgent), heading, intro, rows, sections, notes, buttons };
}

/** The messages a finished review sends, by section 7.5's table. */
export function reviewMails(f: ReviewMailFacts): ReviewMail[] {
  const routing = routeReview({ verdict: f.verdict, restricted: f.restricted, refused: f.status === "refused" });
  const mails: ReviewMail[] = [];
  if (routing.owner === "full") {
    mails.push(fullMail(f, "owner", routing));
  } else {
    mails.push({
      audience: "owner",
      subject: `LearnFRC safety: a class on ${f.datePacific} needs a safety review`,
      heading: OWNER_RESTRICTED_LINE,
      intro: null,
      rows: [],
      sections: [],
      notes: [],
      buttons: [{ text: "Open the class page", url: f.reviewUrl }],
    });
  }
  if (routing.safety === "full") mails.push(fullMail(f, "safety", routing));
  return mails;
}

/** The alarm for an event about a meeting LearnFRC didn't create (section 6.8). */
export function unknownMeetingMail(input: { meetingId: string; event: string; adminUrl: string }): ReviewMail {
  return {
    audience: "safety",
    subject: "LearnFRC classes: an event for a meeting we didn't create",
    heading: "RealtimeKit sent an event for a meeting LearnFRC didn't create. It could be a breakout room.",
    intro: "Every meeting in LearnFRC's RealtimeKit app should be a class, so this one is worth a look.",
    rows: [
      { label: "Meeting", value: input.meetingId },
      { label: "Event", value: input.event },
    ],
    sections: [],
    notes: ["This email goes out once per meeting. Later events for it are logged, not emailed."],
    buttons: [{ text: "Open the classes desk", url: input.adminUrl }],
  };
}

/** Kind words, re-exported for the review page. */
export { KIND_WORDS, CODE_KIND_WORDS, VERDICT_WORDS };
