import "server-only";
import {
  classEmailHtml,
  emailListHtml,
  escapeHtml,
  mailClass,
  sendClassEmail,
  type ClassMail,
} from "@/lib/classes/emails";
import { SITE_URL } from "@/lib/classes/config";
import { TEACHER_CODE } from "@/lib/classes/notice";
import { PARENT_STEP_WORDS, type ParentStep } from "@/lib/classes/teacher-rules";
import type { AgeBand } from "@/lib/classes/types";

/**
 * The teacher emails (section 7.5's rules: the shared layout, no quotes from
 * anyone's answers, the sendEmail default reply-to). Sent through
 * src/lib/classes/emails.ts, so a failure leaves an `email_failed` row for
 * /admin/classes.
 *
 * No email here promises anyone a host at a first class: every class, the
 * first included, is recorded on video and reviewed afterwards.
 */

/**
 * Sends after the response when there is one (mailClass), and right away
 * when there isn't (the checks in scripts/classes run these functions
 * outside a request, where `after` throws).
 */
export async function mailTeacher(what: string, message: ClassMail): Promise<void> {
  try {
    mailClass(what, null, message);
  } catch {
    await sendClassEmail(what, null, message);
  }
}

const greet = (username: string | null) => (username ? `Hey @${username},` : "Hey,");
const teachingUrl = () => `${SITE_URL}/classes/teaching`;
const readyUrl = () => `${SITE_URL}/classes/ready`;
const teachUrl = () => `${SITE_URL}/apply/teach`;
const deskUrl = () => `${SITE_URL}/admin/classes/teachers`;

function noteBlock(label: string, note: string | null | undefined): string {
  if (!note) return "";
  return `<div style="margin:16px 0;padding:12px 16px;border-left:3px solid #C4A77D;background:#E6E8E3"><p style="margin:0;color:#565C60;font-size:12px;font-family:ui-monospace,Menlo,Consolas,monospace">${escapeHtml(label)}</p><p style="margin:6px 0 0;white-space:pre-wrap">${escapeHtml(note)}</p></div>`;
}

const p = (text: string) => `<p style="margin:0 0 14px">${escapeHtml(text)}</p>`;

/**
 * To the applicant, the moment they apply. Says how the seasons get checked,
 * and, only when they named a mentor or coach, that we may email that person
 * once if the event results don't settle it.
 */
export function teacherApplicationReceivedMail(input: {
  to: string;
  username: string | null;
  parentStep: ParentStep | null;
  hasReference: boolean;
}): ClassMail {
  const parent =
    input.parentStep && input.parentStep !== "agreed"
      ? p(
          "One more step before you can schedule a class: a parent or guardian says OK once, by email. You can ask them from the link below whenever you're ready. It doesn't hold up your application."
        )
      : "";
  return {
    to: input.to,
    subject: "Your LearnFRC teacher application is in",
    html: classEmailHtml({
      heading: greet(input.username),
      bodyHtml:
        p(
          "Your application to teach live classes on LearnFRC is in. A person reads every application, and you'll get an email either way."
        ) +
        p(
          "We check the FRC seasons you listed against official event results." +
            (input.hasReference
              ? " If we can't confirm them that way, we may email the mentor or coach you named, once, to ask whether you were on the team."
              : "")
        ) +
        parent +
        p("If your plans change, you can withdraw it from the page you applied on."),
      buttons:
        input.parentStep && input.parentStep !== "agreed"
          ? [{ text: "Ask your parent or guardian", url: readyUrl() }]
          : [],
      note: "Thanks for offering to teach.",
    }),
  };
}

/**
 * To the owner (the first ADMIN_EMAILS entry), who decides. Facts only: no
 * written answers, no name for the letters and no reference in the email.
 */
export function teacherApplicationNotifyMail(input: {
  to: string;
  username: string;
  ageBand: AgeBand | null;
  parentStep: ParentStep | null;
  sameNetwork: boolean;
  /** The newest season's team. */
  teamNumber: number | null;
  /** Oldest first. */
  seasonYears: number[];
  teamRoleLabel: string;
  topicTitles: string[];
  sampleLessonTitle: string;
}): ClassMail {
  const rows = [
    { label: "Handle", value: `@${input.username}` },
    { label: "Age", value: input.ageBand ?? "not answered" },
    {
      label: "Parent",
      value: `${input.parentStep ? PARENT_STEP_WORDS[input.parentStep] : "not asked yet"}${input.sameNetwork ? " (decided from the student's own network)" : ""}`,
    },
    { label: "Team", value: input.teamNumber ? String(input.teamNumber) : "not given" },
    { label: "Seasons", value: input.seasonYears.join(", ") },
    { label: "Team role", value: input.teamRoleLabel },
    { label: "Picked", value: input.topicTitles.join(", ") },
    { label: "Sample lesson", value: input.sampleLessonTitle },
  ];
  return {
    to: input.to,
    subject: `LearnFRC: teacher application from @${input.username}`,
    html: classEmailHtml({
      heading: "Someone applied to teach live classes",
      rows,
      buttons: [{ text: "Open the teacher desk", url: deskUrl() }],
      note: "Their answers, the seasons to check on The Blue Alliance, and their reference are on the desk. Accepting locks the name.",
    }),
  };
}

/** To the applicant, accepted. */
export function teacherAcceptedMail(input: {
  to: string;
  username: string | null;
  letterName: string;
  note: string | null;
  needsParent: boolean;
  codeOutdated: boolean;
}): ClassMail {
  const before: string[] = [];
  if (input.needsParent)
    before.push(escapeHtml("Your parent or guardian says OK once, by email, from learnfrc.com/classes/ready."));
  if (input.codeOutdated)
    before.push(escapeHtml("The teacher code changed after you applied. Read it again and agree on learnfrc.com/apply/teach."));
  return {
    to: input.to,
    subject: "You can teach live classes on LearnFRC",
    html: classEmailHtml({
      heading: greet(input.username),
      intro: "Your application to teach live classes was accepted.",
      rows: [{ label: "Name on your hours letters", value: input.letterName }],
      bodyHtml:
        p("That name is locked now, so it reads the same on every letter. If it's wrong, reply to this email and we'll fix it.") +
        noteBlock("note from the reviewer", input.note) +
        (before.length
          ? `<p style="margin:14px 0 4px;font-weight:700">Before your first class</p>${emailListHtml(before)}`
          : "") +
        `<p style="margin:14px 0 4px;font-weight:700">How it works</p>` +
        emailListHtml(
          [
            "Schedule a class from your teaching page: a LearnFRC lesson or module, 15 to 90 minutes, up to 15 students, starting 2 hours to 30 days out.",
            "Classes run in LearnFRC's own video rooms on learnfrc.com. Your camera is optional, and students' cameras stay off.",
            "Every class, your first one included, is recorded on video and transcribed, and LearnFRC reviews it afterwards.",
            "Classes LearnFRC approves count toward an hours letter signed by our volunteer coordinator.",
          ].map(escapeHtml)
        ) +
        `<p style="margin:14px 0 4px;font-weight:700">The teacher code you agreed to</p>` +
        emailListHtml(TEACHER_CODE.map(escapeHtml)),
      buttons: [{ text: "Schedule a class", url: teachingUrl() }],
      note: "Check your school's rules before you count hours. Some schools don't count online service.",
    }),
  };
}

/** To the applicant, turned down. */
export function teacherRejectedMail(input: { to: string; username: string | null; note: string | null }): ClassMail {
  return {
    to: input.to,
    subject: "About your LearnFRC teacher application",
    html: classEmailHtml({
      heading: greet(input.username),
      bodyHtml:
        p("Your application to teach live classes wasn't accepted this time.") +
        noteBlock("note from the reviewer", input.note) +
        p("That isn't a permanent answer. If something changes, you can apply again from the same page. Every lesson on LearnFRC is still yours."),
      buttons: [{ text: "Open the application page", url: teachUrl(), tone: "plain" }],
    }),
  };
}

/** To the teacher, when a super admin corrects the name on their letters. */
export function letterNameChangedMail(input: { to: string; username: string | null; letterName: string }): ClassMail {
  return {
    to: input.to,
    subject: "The name on your LearnFRC hours letters changed",
    html: classEmailHtml({
      heading: greet(input.username),
      intro: "The name LearnFRC prints on your hours letters was changed.",
      rows: [{ label: "Name on your hours letters", value: input.letterName }],
      bodyHtml: p("Letters you request from now on use it. If it's not right, reply to this email."),
    }),
  };
}

/** To the teacher, when their teaching is turned back on. */
export function teacherUnsuspendedMail(input: { to: string; username: string | null }): ClassMail {
  return {
    to: input.to,
    subject: "You can teach live classes on LearnFRC again",
    html: classEmailHtml({
      heading: greet(input.username),
      bodyHtml: p("Your teaching on LearnFRC is back on. You can schedule classes again from your teaching page."),
      buttons: [{ text: "Open your teaching page", url: teachingUrl() }],
    }),
  };
}
