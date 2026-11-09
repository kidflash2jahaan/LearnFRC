import "server-only";
import { PUBLIC_CONTACT_EMAIL } from "@/lib/email";
import { SITE_URL, PARENT_LIMITS } from "@/lib/classes/config";
import { COORDINATOR } from "@/lib/classes/coordinator";
import { classEmailHtml, emailListHtml, escapeHtml, type ClassMail } from "@/lib/classes/emails";

/**
 * The parent OK emails (classes-design.md section 5.1): the one email a
 * parent or guardian gets, and the note the student gets once they decide
 * (or once staff revoke it).
 *
 * The parent's email and the decision page (/classes/parent) show the same
 * facts, PARENT_NOTICE, so what a parent agrees to on the page is what the
 * email told them. Changing it bumps PARENT_NOTICE_VERSION, which each
 * request records (class_parent_consents.notice_version).
 *
 * Every message goes out with the sendEmail default reply-to, never the
 * student's address. No em dashes, no phone numbers.
 */

export const PARENT_NOTICE_VERSION = "2026-11-09";

export const PARENT_REQUEST_SUBJECT = "Your teen asked to join live classes on LearnFRC";

/** What a parent is agreeing to, one paragraph per fact. */
export const PARENT_NOTICE: readonly string[] = [
  "LearnFRC is a free, student-run website that teaches the FIRST Robotics Competition (FRC). Its live classes are short online lessons taught by high school FRC students aged 13 to 17, for students aged 13 to 17. LearnFRC isn't run by FIRST.",
  "Every class is recorded on video and transcribed by Cloudflare, LearnFRC's video service. Anthropic's Claude AI reads the transcript and the class chat and writes notes, so LearnFRC can check that every class is safe and on topic. LearnFRC's volunteer safety lead, " +
    COORDINATOR.name +
    ", reviews anything that gets flagged.",
  "Everyone in a class sees each other's LearnFRC usernames. Student cameras are off and can't be turned on. There's no private messaging, and the class chat blocks links, @handles, email addresses, phone numbers and usernames from other apps.",
  "Recordings are deleted after 7 days unless there's a safety problem. Transcripts, the class chat and the notes are kept for up to a year.",
  `You can change your mind at any time. Write to ${PUBLIC_CONTACT_EMAIL} and we'll close live classes for your teen.`,
];

/** The link in the parent's email. Opening it decides nothing (section 5.1). */
export function parentOpenUrl(token: string): string {
  return `${SITE_URL}/classes/parent/open/${token}`;
}

/** The email to the parent or guardian, with the one button. */
export function classParentRequestHtml(input: { studentHandle: string; token: string }): string {
  const handle = escapeHtml(`@${input.studentHandle}`);
  return classEmailHtml({
    heading: "A request about live classes",
    bodyHtml:
      `<p style="margin:0 0 14px"><strong>${handle}</strong> asked to join or teach live classes on LearnFRC and gave this address for a parent or guardian. Classes open for them only if you say OK.</p>` +
      emailListHtml(PARENT_NOTICE.map((p) => escapeHtml(p))),
    buttons: [{ text: "Read it and decide", url: parentOpenUrl(input.token) }],
    note: `The button works for ${PARENT_LIMITS.tokenDays} days. Nothing changes unless you open it and choose. If you don't know who this is, you can ignore this email.`,
  });
}

/** The whole parent email, ready for sendClassEmail. */
export function parentRequestMail(input: {
  parentEmail: string;
  studentHandle: string;
  token: string;
}): ClassMail {
  return {
    to: input.parentEmail,
    subject: PARENT_REQUEST_SUBJECT,
    html: classParentRequestHtml(input),
  };
}

/** The student's email once their parent or guardian decides (either way). */
export function studentDecisionMail(input: { to: string; agreed: boolean }): ClassMail {
  if (input.agreed) {
    return {
      to: input.to,
      subject: "Live classes are open for you on LearnFRC",
      html: classEmailHtml({
        heading: "Your parent or guardian said OK",
        intro:
          "You can sign up for live classes and join them now. Before every class you'll see the recording notice, and you'll show up under your LearnFRC username.",
        buttons: [{ text: "Find a class", url: `${SITE_URL}/classes` }],
        note: `Questions? Write to ${PUBLIC_CONTACT_EMAIL}.`,
      }),
    };
  }
  return {
    to: input.to,
    subject: "About your live classes request on LearnFRC",
    html: classEmailHtml({
      heading: "Your parent or guardian didn't OK live classes",
      intro:
        "Live classes stay closed for your account. Every lesson on LearnFRC is still yours to read.",
      buttons: [{ text: "Back to the lessons", url: `${SITE_URL}/guides`, tone: "plain" }],
      note: `If that changes, your parent or guardian can write to ${PUBLIC_CONTACT_EMAIL}.`,
    }),
  };
}

/** The student's email when LearnFRC staff withdraw a parent OK. */
export function studentRevokedMail(input: { to: string }): ClassMail {
  return {
    to: input.to,
    subject: "Live classes are closed for your account on LearnFRC",
    html: classEmailHtml({
      heading: "Your parent or guardian's OK was withdrawn",
      intro:
        "Live classes are closed for your account for now, so you can't join one. Every lesson on LearnFRC is still yours to read.",
      note: `If you think that's a mistake, write to ${PUBLIC_CONTACT_EMAIL}.`,
    }),
  };
}
