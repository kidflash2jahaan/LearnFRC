import "server-only";
import {
  classEmailHtml,
  escapeHtml,
  emailListHtml,
  mailClass,
  sendClassEmail,
  type ClassMail,
} from "@/lib/classes/emails";
import { COORDINATOR } from "@/lib/classes/coordinator";
import { SITE_URL, ownerEmail, safetyEmail } from "@/lib/classes/config";
import { hoursAndMinutes, longDate, verifyUrlFor } from "@/lib/classes/letter-rules";

/**
 * Hours letter email (section 9.2): the request to Dhiren, and the answer to
 * the teacher (signed, declined, or withdrawn later).
 *
 * Per section 7.5, letter requests go to the safety lead only (Dhiren signs
 * them), never to Jahaan. Every message goes through mailClass, so a send
 * that fails shows on /admin/classes, and on a dev server it lands in the
 * EMAIL_DEV_OUTBOX folder instead of anyone's inbox. No raw verify or letter
 * links that change anything: the buttons only open pages, and every change
 * happens on a page after sign-in.
 */

/**
 * Sends after the response when there is one (mailClass), and right away
 * when there isn't (a script or test calling the shared functions, where
 * after() has no request to wait for).
 */
export async function sendLetterMail(what: string, message: ClassMail): Promise<void> {
  try {
    mailClass(what, null, message);
  } catch {
    await sendClassEmail(what, null, message);
  }
}

/** Where letter requests go: the safety lead's address, else the owner's. */
export function letterSignerAddress(): string | null {
  return safetyEmail() ?? ownerEmail();
}

const lettersDeskUrl = () => `${SITE_URL}/admin/classes/letters`;
const teacherLetterUrl = () => `${SITE_URL}/classes/teaching/letter`;

export function letterRequestEmail(input: {
  to: string;
  teacherHandle: string | null;
  letterName: string;
  start: string;
  end: string;
  classCount: number;
  totalMinutes: number;
  classes: { date: string; title: string; minutes: number }[];
}): ClassMail {
  const who = input.teacherHandle ? `@${input.teacherHandle}` : "A teacher";
  const items = input.classes
    .slice(0, 20)
    .map((c) => `${escapeHtml(longDate(c.date))}: ${escapeHtml(c.title)} (${c.minutes} min)`);
  if (input.classes.length > 20) items.push(`and ${input.classes.length - 20} more on the page`);
  return {
    to: input.to,
    subject: `LearnFRC hours letter to sign: ${who}`,
    html: classEmailHtml({
      heading: "A teacher asked for an hours letter",
      intro: `${who} asked for a letter covering their approved classes. Nothing is issued until you approve it on the letters page.`,
      rows: [
        { label: "Teacher", value: who },
        { label: "Name on the letter", value: input.letterName },
        { label: "Dates", value: `${longDate(input.start)} to ${longDate(input.end)}` },
        { label: "Classes", value: String(input.classCount) },
        { label: "Teaching time", value: hoursAndMinutes(input.totalMinutes) },
      ],
      bodyHtml: emailListHtml(items),
      buttons: [{ text: "Open the letters", url: lettersDeskUrl() }],
      note: "Each class links to its review page there, with any flags. Approve and sign, or decline with a reason the teacher will see.",
    }),
  };
}

export function letterIssuedEmail(input: {
  to: string;
  letterName: string;
  code: string;
  classCount: number;
  totalMinutes: number;
}): ClassMail {
  return {
    to: input.to,
    subject: "Your LearnFRC hours letter is ready",
    html: classEmailHtml({
      heading: "Your hours letter is signed",
      intro: `${COORDINATOR.name} approved your letter. It covers ${input.classCount} ${input.classCount === 1 ? "class" : "classes"} and ${hoursAndMinutes(input.totalMinutes)} of teaching time.`,
      rows: [
        { label: "Name on the letter", value: input.letterName },
        { label: "Letter code", value: input.code },
      ],
      buttons: [
        { text: "Open your letter", url: `${SITE_URL}/letters/${input.code}` },
        { text: "Your letters", url: teacherLetterUrl(), tone: "plain" },
      ],
      note: `Print it or save it as a PDF from that page. Anyone you hand it to can check it at ${verifyUrlFor(SITE_URL, input.code)}. Check your school's rules for online service before you hand it in.`,
    }),
  };
}

export function letterDeclinedEmail(input: { to: string; reason: string }): ClassMail {
  return {
    to: input.to,
    subject: "About your LearnFRC hours letter request",
    html: classEmailHtml({
      heading: "Your letter request wasn't approved",
      intro: "Your request for an hours letter wasn't approved this time. Here's why:",
      bodyHtml: `<p style="margin:0 0 14px;padding:10px 14px;border-left:3px solid #16181B;background:#F5F6F2">${escapeHtml(input.reason)}</p>`,
      buttons: [{ text: "Your letters", url: teacherLetterUrl() }],
      note: "You can ask again once it's sorted. If something here looks wrong, reply to this email.",
    }),
  };
}

export function letterRevokedEmail(input: { to: string; code: string; reason: string }): ClassMail {
  return {
    to: input.to,
    subject: "Your LearnFRC hours letter was withdrawn",
    html: classEmailHtml({
      heading: "Your hours letter was withdrawn",
      intro: `Letter ${input.code} is no longer valid. Its verify page now says it was withdrawn. Here's why:`,
      bodyHtml: `<p style="margin:0 0 14px;padding:10px 14px;border-left:3px solid #16181B;background:#F5F6F2">${escapeHtml(input.reason)}</p>`,
      buttons: [{ text: "Your letters", url: teacherLetterUrl() }],
      note: "If you think this is a mistake, reply to this email.",
    }),
  };
}
