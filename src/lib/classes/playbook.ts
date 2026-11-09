/**
 * The escalation playbook (classes-design.md section 8.4): what the safety
 * lead does when a class review, a report or a hold says someone may be in
 * danger. One page at /admin/classes/playbook, linked from every urgent email.
 *
 * Plain data, no imports, so the page renders it and `node --test` checks it.
 * The only phone numbers anywhere in it are 911 and 988 (the CyberTipline's
 * own site lists its line), and nothing in it is an em dash.
 *
 * The one change from the design's text: the safety lead isn't on the admin
 * team, so he can't open /admin/reports to ban an account himself. Step 4 asks
 * a super admin to do it, without passing on the material.
 */

export const PLAYBOOK_VERSION = "2026-11-09";

export type PlaybookSection = {
  id: string;
  /** The situation, as a heading. */
  title: string;
  /** Examples that say what counts, shown under the heading. */
  examples?: string;
  /** Paragraphs, in order. */
  paragraphs?: readonly string[];
  /** Numbered steps, in order. */
  steps?: readonly string[];
  /** The first thing to do, called out. */
  urgent?: boolean;
};

export const PLAYBOOK_TITLE = "When a class may have put someone in danger";

export const PLAYBOOK_INTRO =
  "For LearnFRC's safety lead. Every class is recorded, transcribed and reviewed, and anything urgent comes to you first. This page says what to do with it. Read the section that fits, do the steps in order, and write down what you did on the hold.";

export const PLAYBOOK_SECTIONS: readonly PlaybookSection[] = [
  {
    id: "danger-now",
    urgent: true,
    title: "If someone may be in danger right now",
    examples: "A threat to hurt someone, a self-harm plan, someone saying they're being hurt.",
    paragraphs: [
      "Call 911. Tell them what you know: the class time, what was said, and the student's parent email from the review page and the city from the hold, if it helps them find the person.",
      "Then pause classes from /admin/classes if it could happen again.",
    ],
  },
  {
    id: "self-harm",
    title: "Self-harm or suicide talk, not imminent",
    paragraphs: [
      "Contact the student's parent or guardian (their email is on the review page) unless the parent may be the danger.",
      "The 988 Suicide & Crisis Lifeline (call or text 988) advises adults on what to do, and the student can use it too.",
      "Don't promise secrecy.",
    ],
  },
  {
    id: "sexual",
    title: "Sexual content involving a minor, sharing images, sextortion, or trying to meet a minor",
    examples:
      "Sexual content involving a minor, an adult or teen trying to get a minor to share images, sextortion, or someone trying to meet a minor.",
    steps: [
      "Don't download, screenshot, copy, forward or show anyone the material, not even to report it. Watch or read only as much as you need to know what it is.",
      "The site has already kept a copy in the restricted holds bucket. Press \"Hold this class\" on the review page if it hasn't. That copy is the preservation.",
      "Report to the NCMEC CyberTipline at report.cybertip.org (the site also lists its phone line) as soon as you can. Give the class date, the person's handle and email, the IP and city from the hold, and what happened. Don't attach the material; NCMEC will ask for it through law enforcement if they need it. Write the report number into the hold.",
      "Remove the person: end the class from /admin/classes, suspend them on /admin/classes/teachers if they teach, and ask a super admin to ban the account from /admin/reports. The ban takes its own hold first. Don't pass on the material or what it showed; \"a safety ban\" is enough.",
      "Tell the affected student's parent what happened in plain words, without the material.",
      "If a child is in immediate danger, call 911 first.",
    ],
  },
  {
    id: "grooming",
    title: "Grooming signs without anything explicit",
    examples:
      "Asking a student's age, location or school, \"are you alone\", gifts, secrecy, offers to meet one-on-one.",
    paragraphs: [
      "End the teacher's teaching (suspend them on /admin/classes/teachers), hold the class, tell the student's parent, and decide on a ban.",
      "If it's an adult or the signs are strong, also report it to the CyberTipline at report.cybertip.org (online enticement is reportable).",
    ],
  },
  {
    id: "bullying",
    title: "Bullying, slurs, personal info shared",
    paragraphs: [
      "Remove or suspend, reject the class if needed, and let the affected student's parent know if it was serious.",
    ],
  },
  {
    id: "law-enforcement",
    title: "Law enforcement asks for records",
    paragraphs: [
      "Send what they ask for from the hold, extend the hold on /admin/classes/holds, and note the request on it.",
    ],
  },
];

/** The rules under every situation. */
export const PLAYBOOK_ALWAYS: readonly string[] = [
  "Never confront the person about a report before acting.",
  "Never tell anyone who reported.",
  "Write down what you did on the hold.",
];

export const PLAYBOOK_HOLDS_NOTE =
  "Holds last a year from when they're taken, the period the law asks evidence reported to NCMEC to be kept. Extend one when law enforcement asks or a report is filed. Restricted material (sexual content, grooming, sextortion, or a class the AI refused to review) shows only to you until you release it.";

/** Every sentence on the page, for the checks. */
export function playbookText(): string {
  return [
    PLAYBOOK_TITLE,
    PLAYBOOK_INTRO,
    ...PLAYBOOK_SECTIONS.flatMap((s) => [s.title, s.examples ?? "", ...(s.paragraphs ?? []), ...(s.steps ?? [])]),
    ...PLAYBOOK_ALWAYS,
    PLAYBOOK_HOLDS_NOTE,
  ].join("\n");
}

/** Pieces of a sentence: plain text, a site path, or the CyberTipline. */
export type PlaybookPiece = { text: string; href?: string; external?: boolean };

const LINKABLE = /(\/admin\/classes(?:\/(?:holds|teachers))?|\/admin\/reports|report\.cybertip\.org)/g;

/** Splits a sentence so the page can link the paths and the CyberTipline. */
export function playbookPieces(sentence: string): PlaybookPiece[] {
  const out: PlaybookPiece[] = [];
  let last = 0;
  for (const m of sentence.matchAll(LINKABLE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: sentence.slice(last, at) });
    const t = m[0];
    out.push(
      t === "report.cybertip.org"
        ? { text: t, href: "https://report.cybertip.org/", external: true }
        : { text: t, href: t }
    );
    last = at + t.length;
  }
  if (last < sentence.length) out.push({ text: sentence.slice(last) });
  return out;
}
